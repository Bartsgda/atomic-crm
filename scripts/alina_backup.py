#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
alina_backup.py — Lokalny szyfrowany backup CRM-Alina
=====================================================
Pobiera 14 tabel z Supabase public schema i zapisuje do zaszyfrowanego
pliku SQLite w %LOCALAPPDATA%\\RedRoad\\alina_backup\\alina_backup.db.enc

Tech stack spójny z kpir-automator:
  sqlite3  — identycznie jak kpir-automator/tools/db_tool.py
  Fernet   — identycznie jak rrv vault (cryptography library)

Użycie:
  python scripts/alina_backup.py              # backup (skip jeśli dzisiaj był)
  python scripts/alina_backup.py --force      # wymuś nawet jeśli był dzisiaj
  python scripts/alina_backup.py --decrypt    # odszyfruj → .db (do podglądu w DB Browser)
  python scripts/alina_backup.py --status     # kiedy ostatni backup
  python scripts/alina_backup.py --check      # tylko sprawdź czy potrzebny (exit 0=skip, 1=potrzebny)

Klucz szyfrowania:
  rrv set CRM_ALINA_BACKUP_KEY --value "<fernet-key>"
  Fernet key generuj raz: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Integracja z start_session.py (tryb crm/alina):
  Wywoływany automatycznie przy starcie sesji — uruchamia się tylko raz dziennie.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path

# ── Deps check ────────────────────────────────────────────────────────────────

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("[alina_backup] FAIL: brak cryptography. Zainstaluj: pip install cryptography")
    sys.exit(2)

try:
    from supabase import create_client
except ImportError:
    print("[alina_backup] FAIL: brak supabase-py. Zainstaluj: pip install supabase")
    sys.exit(2)

# ── Config ────────────────────────────────────────────────────────────────────

BACKUP_DIR = Path(
    os.environ.get("LOCALAPPDATA", "C:/Users/Default/AppData/Local")
) / "RedRoad" / "alina_backup"
BACKUP_FILE = BACKUP_DIR / "alina_backup.db.enc"
META_FILE   = BACKUP_DIR / "alina_backup_meta.json"

KEY_VAULT_NAME = "CRM_ALINA_BACKUP_KEY"

# 14 tabel sync (te same co schema sync prod→test w Edge Function)
TABLES = [
    "insurance_clients",
    "policies",
    "policy_notes",
    "sub_agents",
    "policy_sub_agent_shares",
    "insurance_feedback",
    "insurance_activity_log",
    "insurance_login_log",
    "insurance_snapshots",
    "insurance_trash",
    "insurers",
    "terminations",
    "checklist_templates",
    "init_state",
]

# ── Vault helpers ─────────────────────────────────────────────────────────────

def _rrv(name: str) -> str:
    try:
        out = subprocess.check_output(
            f'powershell -Command "rrv get {name}"',
            shell=True, stderr=subprocess.DEVNULL, timeout=10
        )
        return out.decode("utf-8-sig").strip()
    except Exception:
        return ""


def _get_fernet_key() -> bytes:
    key_str = _rrv(KEY_VAULT_NAME)
    if not key_str:
        print(f"[alina_backup] Klucz {KEY_VAULT_NAME} nie istnieje w vault.")
        print("  Wygeneruj i zapisz raz:")
        print('  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"')
        print(f'  rrv set {KEY_VAULT_NAME} --value "<wynik>"')
        sys.exit(1)
    return key_str.encode()

# ── Meta ──────────────────────────────────────────────────────────────────────

def _load_meta() -> dict:
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _save_meta(meta: dict) -> None:
    META_FILE.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def _backed_up_today() -> bool:
    return _load_meta().get("last_backup_date") == str(date.today())

# ── Supabase fetch ────────────────────────────────────────────────────────────

def _fetch_all(sb) -> dict[str, list]:
    data: dict[str, list] = {}
    for table in TABLES:
        rows: list = []
        offset = 0
        while True:
            resp = sb.table(table).select("*").range(offset, offset + 999).execute()
            batch = resp.data or []
            rows.extend(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        data[table] = rows
        print(f"  {table:<35} {len(rows):>5} wierszy")
    return data

# ── SQLite builder ────────────────────────────────────────────────────────────

def _to_sqlite(data: dict[str, list], db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")

    for table, rows in data.items():
        if not rows:
            conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ("_empty" INTEGER)')
            continue
        cols = list(rows[0].keys())
        col_defs = ", ".join(f'"{c}" TEXT' for c in cols)
        conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({col_defs})')
        ph = ", ".join("?" * len(cols))
        for row in rows:
            vals = [
                json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                for v in (row.get(c) for c in cols)
            ]
            conn.execute(f'INSERT INTO "{table}" VALUES ({ph})', vals)

    conn.commit()
    conn.close()

# ── Crypto ────────────────────────────────────────────────────────────────────

def _encrypt(src: str, dst: Path, key: bytes) -> None:
    dst.write_bytes(Fernet(key).encrypt(Path(src).read_bytes()))


def _decrypt(src: Path, key: bytes) -> bytes:
    return Fernet(key).decrypt(src.read_bytes())

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_backup(force: bool = False, quiet: bool = False) -> int:
    if not force and _backed_up_today():
        meta = _load_meta()
        if not quiet:
            print(f"[alina_backup] SKIP — backup dzisiaj już był ({meta.get('last_backup_time', '?')}). Użyj --force aby wymusić.")
        return 0

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    key = _get_fernet_key()

    url    = _rrv("CRM_ALINA_SUPABASE_URL")
    secret = _rrv("CRM_ALINA_SB_SECRET")
    if not url or not secret:
        print("[alina_backup] FAIL: brak CRM_ALINA_SUPABASE_URL lub CRM_ALINA_SB_SECRET w vault.")
        return 1

    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[alina_backup {ts}] Łączę z Supabase…")
    sb = create_client(url, secret)

    print("[alina_backup] Pobieram tabele:")
    data = _fetch_all(sb)
    total = sum(len(v) for v in data.values())
    print(f"[alina_backup] Łącznie: {total} wierszy")

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        print("[alina_backup] Buduję SQLite…")
        _to_sqlite(data, tmp_path)
        size_kb = Path(tmp_path).stat().st_size // 1024
        print(f"[alina_backup] Szyfruję ({size_kb} KB) → {BACKUP_FILE.name}…")
        _encrypt(tmp_path, BACKUP_FILE, key)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    enc_kb = BACKUP_FILE.stat().st_size // 1024
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    meta = _load_meta()
    meta.update({
        "last_backup_date":    str(date.today()),
        "last_backup_time":    now_str,
        "last_backup_rows":    total,
        "last_backup_size_kb": enc_kb,
        "backup_file":         str(BACKUP_FILE),
    })
    _save_meta(meta)

    print(f"[alina_backup] DONE ✓  {BACKUP_FILE} ({enc_kb} KB)  —  {now_str}")
    return 0


def cmd_decrypt() -> int:
    if not BACKUP_FILE.exists():
        print(f"[alina_backup] FAIL: brak pliku {BACKUP_FILE}")
        print("  Najpierw wykonaj backup: python scripts/alina_backup.py")
        return 1

    key = _get_fernet_key()
    out = BACKUP_DIR / "alina_backup_DECRYPTED.db"
    out.write_bytes(_decrypt(BACKUP_FILE, key))

    print(f"[alina_backup] Odszyfrowano → {out}")
    print("  Otwórz w: DB Browser for SQLite (standardowa wersja, bez SQLCipher).")
    print(f"  WAŻNE: usuń po skończeniu pracy:\n    del \"{out}\"")
    return 0


def cmd_status() -> int:
    meta = _load_meta()
    if not meta:
        print("[alina_backup] Brak historii — backup nigdy nie był wykonany.")
        return 0

    exists = "✓" if BACKUP_FILE.exists() else "✗ BRAK PLIKU!"
    today  = "✓ tak" if _backed_up_today() else "✗ nie"
    print(f"  Ostatni backup:   {meta.get('last_backup_time', '?')}")
    print(f"  Wierszy:          {meta.get('last_backup_rows', '?')}")
    print(f"  Rozmiar pliku:    {meta.get('last_backup_size_kb', '?')} KB")
    print(f"  Plik:             {meta.get('backup_file', BACKUP_FILE)}  {exists}")
    print(f"  Dzisiaj:          {today}")
    return 0


def cmd_check() -> int:
    """Exit 0 = backup dzisiaj był (skip). Exit 1 = potrzebny."""
    return 0 if _backed_up_today() else 1


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="Lokalny szyfrowany backup CRM-Alina → SQLite + Fernet"
    )
    ap.add_argument("--force",   action="store_true", help="Wymuś backup nawet jeśli był dzisiaj")
    ap.add_argument("--decrypt", action="store_true", help="Odszyfruj .db.enc → .db (podgląd)")
    ap.add_argument("--status",  action="store_true", help="Kiedy ostatni backup")
    ap.add_argument("--check",   action="store_true", help="Exit 0=skip, 1=potrzebny (dla skryptów)")
    ap.add_argument("--quiet",   action="store_true", help="Mniej output (dla start_session.py)")
    args = ap.parse_args()

    if args.check:
        sys.exit(cmd_check())
    elif args.status:
        sys.exit(cmd_status())
    elif args.decrypt:
        sys.exit(cmd_decrypt())
    else:
        sys.exit(cmd_backup(force=args.force, quiet=args.quiet))


if __name__ == "__main__":
    main()
