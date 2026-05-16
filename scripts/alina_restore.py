#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
alina_restore.py — Restore CRM-Alina backup → nowy projekt Supabase
====================================================================
Czyta zaszyfrowany backup (alina_backup.db.enc) i wgrywa dane
do pustego projektu Supabase (dkfksrbkyegijomzidgq).

Użycie:
  python scripts/alina_restore.py              # pełny restore
  python scripts/alina_restore.py --data-only  # tylko dane (schemat już jest)
  python scripts/alina_restore.py --schema-only  # tylko schemat
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
from pathlib import Path

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    from cryptography.hazmat.primitives import hashes
except ImportError:
    print("FAIL: pip install cryptography"); sys.exit(2)

try:
    import requests
    from supabase import create_client
except ImportError:
    print("FAIL: pip install requests supabase"); sys.exit(2)

# ── Config ────────────────────────────────────────────────────────────────────

BACKUP_FILE     = Path(os.environ.get("LOCALAPPDATA", "")) / "RedRoad" / "alina_backup" / "alina_backup.db.enc"
SALT_SIZE       = 32
KDF_ITERS       = 600_000

SRC_REF         = "xqznrssrlnxqkdvisnck"   # prod CRM-Alina
DST_URL         = "https://dkfksrbkyegijomzidgq.supabase.co"
DST_VAULT_KEY   = "2_MAGICHEAD_ALINASUPABASE_BACKUP"
PASS_VAULT_NAME = "1_MAGICHEAD_ALINASUPABASE_LOKALNABAZA"
PAT_VAULT_NAME  = "1h_SUPABASE_MOZNA_KASOWAC"

TABLES = [
    "insurers", "sub_agents", "checklist_templates",
    "insurance_clients",
    "policies", "policy_notes", "policy_sub_agent_shares",
    "insurance_feedback", "insurance_activity_log",
    "insurance_login_log", "insurance_snapshots",
    "insurance_trash", "terminations", "init_state",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def rrv(n: str) -> str:
    try:
        return subprocess.check_output(
            f'powershell -Command "rrv get {n}"',
            shell=True, stderr=subprocess.DEVNULL, timeout=10
        ).decode("utf-8-sig").strip()
    except Exception:
        return ""

def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=KDF_ITERS)
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))

def decrypt_backup(path: Path, password: str) -> bytes:
    data = path.read_bytes()
    salt, enc = data[:SALT_SIZE], data[SALT_SIZE:]
    return Fernet(derive_key(password, salt)).decrypt(enc)

# ── Schema copy via Management API ───────────────────────────────────────────

DST_REF = "dkfksrbkyegijomzidgq"

def mgmt_query(pat: str, ref: str, sql: str) -> tuple[int, any]:
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
        json={"query": sql},
        timeout=60
    )
    return r.status_code, r.json() if r.content else []


def copy_schema(pat: str) -> None:
    print("[schema] Pobieram DDL z projektu prod…")
    sql = """
        SELECT
            table_name,
            string_agg(
                quote_ident(column_name) || ' ' ||
                CASE
                    WHEN data_type = 'uuid' AND column_name = 'id' THEN 'uuid PRIMARY KEY'
                    WHEN data_type = 'ARRAY' THEN udt_name || '[]'
                    WHEN character_maximum_length IS NOT NULL THEN data_type || '(' || character_maximum_length || ')'
                    ELSE data_type
                END ||
                CASE WHEN is_nullable = 'NO' AND column_name != 'id' THEN ' NOT NULL' ELSE '' END,
                ', ' ORDER BY ordinal_position
            ) AS cols
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN (
            'insurance_clients','policies','policy_notes','sub_agents',
            'policy_sub_agent_shares','insurance_feedback','insurance_activity_log',
            'insurance_login_log','insurance_snapshots','insurance_trash',
            'insurers','terminations','checklist_templates','init_state'
          )
        GROUP BY table_name ORDER BY table_name;
    """
    status, rows = mgmt_query(pat, SRC_REF, sql)
    if status not in (200, 201) or not isinstance(rows, list):
        print(f"[schema] FAIL {status}: {str(rows)[:200]}"); sys.exit(1)

    print(f"[schema] Tworzę {len(rows)} tabel w projekcie backup…")
    for row in rows:
        tname = row["table_name"]
        ddl   = f'CREATE TABLE IF NOT EXISTS public."{tname}" ({row["cols"]});'
        s2, r2 = mgmt_query(pat, DST_REF, ddl)
        status_str = "OK" if s2 in (200, 201) else f"FAIL {s2}: {str(r2)[:60]}"
        print(f"  {tname:<35} {status_str}")

# ── Data restore ──────────────────────────────────────────────────────────────

def _pg_literal(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        v = json.dumps(v, ensure_ascii=False)
    s = str(v).replace("'", "''")
    return f"'{s}'"


def restore_data(db_path: str, pat: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    for table in TABLES:
        rows_raw = conn.execute(f'SELECT * FROM "{table}"').fetchall()
        if not rows_raw:
            print(f"  {table:<35}     0 (pusta)")
            continue

        rows = []
        for r in rows_raw:
            parsed = {}
            for k, v in dict(r).items():
                if k == "_empty":
                    continue
                if isinstance(v, str) and v and v[0] in ("{", "["):
                    try:
                        v = json.loads(v)
                    except Exception:
                        pass
                parsed[k] = v
            if parsed:
                rows.append(parsed)

        if not rows:
            print(f"  {table:<35}     0 (pusta)")
            continue

        cols = list(rows[0].keys())
        col_list = ", ".join(f'"{c}"' for c in cols)
        inserted = 0

        for i in range(0, len(rows), 50):
            batch = rows[i:i+50]
            values_sql = ",\n  ".join(
                "(" + ", ".join(_pg_literal(row.get(c)) for c in cols) + ")"
                for row in batch
            )
            sql = (
                f'INSERT INTO public."{table}" ({col_list}) VALUES\n  {values_sql}\n'
                f'ON CONFLICT (id) DO NOTHING;'
            )
            status, result = mgmt_query(pat, DST_REF, sql)
            if status in (200, 201):
                inserted += len(batch)
            else:
                print(f"  {table} batch {i}: WARN {str(result)[:100]}")

        print(f"  {table:<35} {inserted:>5} wierszy")

    conn.close()

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Restore CRM-Alina backup → Supabase backup project")
    ap.add_argument("--data-only",   action="store_true")
    ap.add_argument("--schema-only", action="store_true")
    args = ap.parse_args()

    if not BACKUP_FILE.exists():
        print(f"FAIL: brak pliku {BACKUP_FILE}")
        print("  Uruchom najpierw: python scripts/alina_backup.py")
        sys.exit(1)

    # Hasło do odszyfrowania backupu
    password = rrv(PASS_VAULT_NAME) or os.environ.get("CRM_ALINA_BACKUP_PASS", "")
    if not password:
        password = getpass.getpass("Hasło backupu CRM-Alina: ")

    dst_secret = rrv(DST_VAULT_KEY)
    if not dst_secret:
        print(f"FAIL: brak {DST_VAULT_KEY} w vault"); sys.exit(1)

    pat = rrv(PAT_VAULT_NAME)

    # Schema
    if not args.data_only:
        if not pat:
            print("FAIL: brak PAT (1h_SUPABASE_MOZNA_KASOWAC)"); sys.exit(1)
        copy_schema(pat)

    # Dane
    if not args.schema_only:
        if not pat:
            print("FAIL: brak PAT (1h_SUPABASE_MOZNA_KASOWAC)"); sys.exit(1)
        print("\n[data] Odszyfrowuję backup…")
        try:
            plaintext = decrypt_backup(BACKUP_FILE, password)
        except Exception:
            print("FAIL: złe hasło lub uszkodzony plik"); sys.exit(1)

        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp_path = tmp.name
        tmp.close()
        try:
            Path(tmp_path).write_bytes(plaintext)
            print("[data] Wgrywam dane:")
            restore_data(tmp_path, pat)
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    print("\nDONE ✓")

if __name__ == "__main__":
    main()
