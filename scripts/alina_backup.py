#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
alina_backup.py — Lokalny szyfrowany backup CRM-Alina
=====================================================
Pobiera 14 tabel z Supabase public schema i zapisuje do zaszyfrowanego
pliku SQLite. Szyfrowanie: hasło Bartka → PBKDF2 → Fernet (AES-128-CBC).

Tech stack spójny z kpir-automator:
  sqlite3  — identycznie jak kpir-automator/tools/db_tool.py
  Fernet   — identycznie jak rrv vault (cryptography library)

Disaster recovery (rrv padł, laptop nowy):
  1. pip install cryptography supabase
  2. python scripts/alina_backup.py --decrypt
     → wpisz hasło → plik .db gotowy do otwarcia w DB Browser

Format pliku backup:
  [32B salt jawny][Fernet(klucz=PBKDF2(hasło,salt)) encrypted SQLite]
  Salt nie jest sekretem — klucz bez hasła bezużyteczny.

Użycie:
  python scripts/alina_backup.py              # backup (pyta o hasło)
  python scripts/alina_backup.py --force      # wymuś nawet jeśli był dzisiaj
  python scripts/alina_backup.py --decrypt    # odszyfruj → .db
  python scripts/alina_backup.py --status     # kiedy ostatni backup
  python scripts/alina_backup.py --setup      # inicjalizacja: generuje salt, test hasła

Automatyczny backup (start_session.py):
  Jeśli $env:CRM_ALINA_BACKUP_PASS ustawiony (np. przez rrv export-env) → bez pytania.
  Jeśli nie ma → skip z komunikatem (nie blokuje sesji).
"""
from __future__ import annotations

import argparse
import base64
import getpass
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
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    print("[alina_backup] FAIL: pip install cryptography")
    sys.exit(2)

try:
    from supabase import create_client
except ImportError:
    print("[alina_backup] FAIL: pip install supabase")
    sys.exit(2)

# ── Config ────────────────────────────────────────────────────────────────────

BACKUP_DIR  = Path(os.environ.get("LOCALAPPDATA", "C:/Users/Default/AppData/Local")) / "RedRoad" / "alina_backup"
BACKUP_FILE = BACKUP_DIR / "alina_backup.db.enc"
META_FILE   = BACKUP_DIR / "alina_backup_meta.json"

SALT_SIZE        = 32
KDF_ITERS        = 600_000  # spójne z rrv vault
PASS_VAULT_NAME  = "1_MAGICHEAD_ALINASUPABASE_LOKALNABAZA"
PASS_ENV_VAR     = "CRM_ALINA_BACKUP_PASS"  # fallback env (rr-claude.ps1 może eksportować)

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

# ── Crypto ────────────────────────────────────────────────────────────────────

def _derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=KDF_ITERS,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))


def _encrypt(plaintext: bytes, password: str, salt: bytes) -> bytes:
    key = _derive_key(password, salt)
    return salt + Fernet(key).encrypt(plaintext)


def _decrypt(ciphertext: bytes, password: str) -> bytes:
    salt       = ciphertext[:SALT_SIZE]
    encrypted  = ciphertext[SALT_SIZE:]
    key        = _derive_key(password, salt)
    return Fernet(key).decrypt(encrypted)

# ── Password resolution ───────────────────────────────────────────────────────

def _get_password(quiet: bool = False) -> str | None:
    # 1) Env var (ustawiony przez rr-claude.ps1 przez rrv export-env)
    pwd = os.environ.get(PASS_ENV_VAR, "").strip()
    if pwd:
        return pwd
    # 2) Vault (automatycznie — bez pytania)
    pwd = _rrv(PASS_VAULT_NAME)
    if pwd:
        return pwd
    # 3) Interaktywne (--decrypt, --setup, ręczny backup gdy vault zablokowany)
    if not quiet:
        try:
            return getpass.getpass("Hasło backupu CRM-Alina: ")
        except (EOFError, KeyboardInterrupt):
            return None
    return None  # tryb cichy bez hasła → caller decyduje co zrobić


def _rrv(name: str) -> str:
    try:
        out = subprocess.check_output(
            f'powershell -Command "rrv get {name}"',
            shell=True, stderr=subprocess.DEVNULL, timeout=10
        )
        return out.decode("utf-8-sig").strip()
    except Exception:
        return ""

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

def _fetch_schema(sb, schema: str) -> dict[str, list]:
    """Pobiera wszystkie TABLES z danego schematu Supabase."""
    data: dict[str, list] = {}
    sb_schema = sb.schema(schema) if schema != "public" else sb
    for table in TABLES:
        rows: list = []
        offset = 0
        try:
            while True:
                resp  = sb_schema.table(table).select("*").range(offset, offset + 999).execute()
                batch = resp.data or []
                rows.extend(batch)
                if len(batch) < 1000:
                    break
                offset += 1000
        except Exception as e:
            # Tabela może nie istnieć w danym schemacie (np. init_state jest VIEW)
            print(f"  [{schema}] {table:<35} SKIP ({e})")
            rows = []
        data[table] = rows
        if rows:
            print(f"  [{schema}] {table:<35} {len(rows):>5} wierszy")
    return data


def _fetch_all(sb) -> dict[str, list]:
    """Pobiera public schema — kompatybilność wsteczna."""
    return _fetch_schema(sb, "public")

# ── SQLite builder ────────────────────────────────────────────────────────────

def _to_sqlite(data: dict[str, list], db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    for table, rows in data.items():
        if not rows:
            conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ("_empty" INTEGER)')
            continue
        cols     = list(rows[0].keys())
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

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_backup(force: bool = False, quiet: bool = False) -> int:
    if not force and _backed_up_today():
        if not quiet:
            meta = _load_meta()
            print(f"[alina_backup] SKIP — backup dzisiaj już był ({meta.get('last_backup_time', '?')}). Użyj --force aby wymusić.")
        return 0

    password = _get_password(quiet=quiet)
    if not password:
        if not quiet:
            print("[alina_backup] Brak hasła — pomiń lub ustaw $env:CRM_ALINA_BACKUP_PASS")
        return 0  # nie blokuj sesji

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    url    = _rrv("CRM_ALINA_SUPABASE_URL")
    secret = _rrv("CRM_ALINA_SB_SECRET")
    if not url or not secret:
        print("[alina_backup] FAIL: brak CRM_ALINA_SUPABASE_URL lub CRM_ALINA_SB_SECRET w vault.")
        return 1

    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[alina_backup {ts}] Łączę z Supabase…")
    sb = create_client(url, secret)

    print("[alina_backup] Pobieram tabele (public + test):")
    pub_data  = _fetch_schema(sb, "public")
    test_data = _fetch_schema(sb, "test")
    # Łącz dane: tabele public bez prefiksu, test z prefiksem "test__"
    data: dict[str, list] = {}
    for t, rows in pub_data.items():
        data[t] = rows
    for t, rows in test_data.items():
        data[f"test__{t}"] = rows
    total = sum(len(v) for v in data.values())
    print(f"[alina_backup] Łącznie: {total} wierszy (public + test)")

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        print("[alina_backup] Buduję SQLite…")
        _to_sqlite(data, tmp_path)
        size_kb = Path(tmp_path).stat().st_size // 1024

        salt = os.urandom(SALT_SIZE)
        print(f"[alina_backup] Szyfruję ({size_kb} KB, PBKDF2 {KDF_ITERS//1000}k iter)…")
        ciphertext = _encrypt(Path(tmp_path).read_bytes(), password, salt)
        BACKUP_FILE.write_bytes(ciphertext)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    enc_kb  = BACKUP_FILE.stat().st_size // 1024
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    meta = _load_meta()
    meta.update({
        "last_backup_date":    str(date.today()),
        "last_backup_time":    now_str,
        "last_backup_rows":    total,
        "last_backup_size_kb": enc_kb,
        "backup_file":         str(BACKUP_FILE),
        "kdf":                 f"PBKDF2-SHA256-{KDF_ITERS}-iter",
        "note":                "Odszyfruj: python scripts/alina_backup.py --decrypt",
    })
    _save_meta(meta)

    print(f"[alina_backup] DONE ✓  {BACKUP_FILE} ({enc_kb} KB)  —  {now_str}")
    return 0


def cmd_decrypt() -> int:
    if not BACKUP_FILE.exists():
        print(f"[alina_backup] FAIL: brak pliku {BACKUP_FILE}")
        print("  Najpierw wykonaj backup: python scripts/alina_backup.py")
        return 1

    password = _get_password(quiet=False)
    if not password:
        print("[alina_backup] Anulowano.")
        return 1

    print("[alina_backup] Odszyfrowuję…")
    try:
        plaintext = _decrypt(BACKUP_FILE.read_bytes(), password)
    except Exception:
        print("[alina_backup] FAIL: złe hasło lub uszkodzony plik.")
        return 1

    out = BACKUP_DIR / "alina_backup_DECRYPTED.db"
    out.write_bytes(plaintext)
    print(f"[alina_backup] OK → {out}")
    print("  Otwórz: DB Browser for SQLite (standardowy, bez SQLCipher).")
    print(f"  WAŻNE: usuń po skończeniu:\n    del \"{out}\"")
    return 0


def cmd_status() -> int:
    meta = _load_meta()
    if not meta:
        print("[alina_backup] Backup nigdy nie był wykonany.")
        return 0
    exists = "✓" if BACKUP_FILE.exists() else "✗ BRAK!"
    today  = "✓ tak" if _backed_up_today() else "✗ nie"
    print(f"  Ostatni backup:  {meta.get('last_backup_time', '?')}")
    print(f"  Wierszy:         {meta.get('last_backup_rows', '?')}")
    print(f"  Rozmiar:         {meta.get('last_backup_size_kb', '?')} KB")
    print(f"  Plik:            {meta.get('backup_file', BACKUP_FILE)}  {exists}")
    print(f"  KDF:             {meta.get('kdf', '?')}")
    print(f"  Dzisiaj:         {today}")
    return 0


def cmd_setup() -> int:
    print("=== Inicjalizacja backup CRM-Alina ===")
    print("Hasło musi być zapamiętane — jest jedynym kluczem do odszyfrowywania.")
    pwd1 = getpass.getpass("Nowe hasło backupu: ")
    pwd2 = getpass.getpass("Powtórz hasło:      ")
    if pwd1 != pwd2:
        print("FAIL: hasła się nie zgadzają.")
        return 1
    if len(pwd1) < 8:
        print("FAIL: hasło za krótkie (min 8 znaków).")
        return 1

    # Test round-trip
    salt      = os.urandom(SALT_SIZE)
    test_data = b"crm-alina-backup-test-2026"
    enc       = _encrypt(test_data, pwd1, salt)
    dec       = _decrypt(enc, pwd1)
    assert dec == test_data, "Round-trip FAIL"

    print()
    print("OK — hasło działa. Zapisz je w bezpiecznym miejscu (np. Google Keep).")
    print()
    print("Aby backup był automatyczny przy starcie sesji:")
    print(f'  rrv set CRM_ALINA_BACKUP_PASS --value "<twoje-haslo>"')
    print("  (rr-claude.ps1 wyeksportuje je do env → skrypt go użyje bez pytania)")
    print()
    print("Pierwsze uruchomienie backup:")
    print("  python scripts/alina_backup.py")
    return 0

# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Backup CRM-Alina → SQLite zaszyfrowany hasłem")
    ap.add_argument("--force",   action="store_true", help="Wymuś backup nawet jeśli był dzisiaj")
    ap.add_argument("--decrypt", action="store_true", help="Odszyfruj .db.enc → .db (podgląd)")
    ap.add_argument("--status",  action="store_true", help="Kiedy ostatni backup")
    ap.add_argument("--setup",   action="store_true", help="Inicjalizacja: test hasła + instrukcje")
    ap.add_argument("--quiet",   action="store_true", help="Mniej output (dla start_session.py)")
    args = ap.parse_args()

    if args.setup:
        sys.exit(cmd_setup())
    elif args.status:
        sys.exit(cmd_status())
    elif args.decrypt:
        sys.exit(cmd_decrypt())
    else:
        sys.exit(cmd_backup(force=args.force, quiet=args.quiet))


if __name__ == "__main__":
    main()
