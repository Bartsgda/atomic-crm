"""
ftp_rollback.py — Rollback CRM-Alina FTP do snapshotu z pre-overwrite backupu.

Każdy `python scripts/ftp_deploy.py` (bez `--no-backup`) tworzy folder
`ftp_backups/YYYY-MM-DD_HHMMSS/` z plikami pobranymi z serwera PRZED ich
nadpisaniem. Ten skrypt bierze taki folder i wgrywa go z powrotem.

Użycie:
  python scripts/ftp_rollback.py                       # lista dostępnych snapshotów
  python scripts/ftp_rollback.py 2026-05-16_223045     # rollback do tego snapshotu
  python scripts/ftp_rollback.py latest                # rollback do najnowszego snapshotu
"""
import os
import sys
import subprocess
from ftplib import FTP


BACKUP_ROOT = "ftp_backups"


def get_vault_secret(name):
    try:
        val = subprocess.check_output(
            f'powershell -Command "rrv get {name}"', shell=True
        ).decode("utf-8").replace("﻿", "").strip()
        return val or None
    except Exception as e:
        print(f"[!] vault error ({name}): {e}")
        return None


def connect():
    host   = get_vault_secret("HOSTIDO_FTP_HOST")
    user   = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    if not all([host, user, passwd]):
        print("[ERR] Brak danych FTP w vault (HOSTIDO_FTP_HOST/USER/PASS).")
        sys.exit(1)
    ftp = FTP(host)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    return ftp


def list_snapshots():
    if not os.path.isdir(BACKUP_ROOT):
        print(f"[!] Brak folderu {BACKUP_ROOT}/ — nie ma czego cofać.")
        return []
    snaps = sorted(
        d for d in os.listdir(BACKUP_ROOT)
        if os.path.isdir(os.path.join(BACKUP_ROOT, d))
    )
    return snaps


def count_files(folder):
    n = 0
    for _root, _dirs, files in os.walk(folder):
        n += len(files)
    return n


def restore_snapshot(snapshot_name):
    snap_dir = os.path.join(BACKUP_ROOT, snapshot_name)
    if not os.path.isdir(snap_dir):
        print(f"[ERR] Snapshot nie istnieje: {snap_dir}")
        sys.exit(1)

    total = count_files(snap_dir)
    if total == 0:
        print(f"[ERR] Snapshot {snapshot_name} jest pusty.")
        sys.exit(1)

    print(f"[!] ROLLBACK: {total} plikow z {snap_dir} -> serwer FTP")
    answer = input("    Kontynuowac? [y/N]: ").strip().lower()
    if answer != "y":
        print("[*] Anulowano.")
        return

    ftp = connect()
    restored = 0
    for root, _dirs, files in os.walk(snap_dir):
        rel = os.path.relpath(root, snap_dir)
        remote_dir = "" if rel == "." else rel.replace(os.sep, "/")
        for fname in files:
            local_path = os.path.join(root, fname)
            remote_path = (
                f"{remote_dir}/{fname}".lstrip("/")
                if remote_dir else fname
            )
            # mkd dla podkatalogow — best-effort
            parts = remote_path.split("/")[:-1]
            cur = ""
            for p in parts:
                cur = f"{cur}/{p}" if cur else p
                try:
                    ftp.mkd(cur)
                except Exception:
                    pass
            with open(local_path, "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f)
            print(f"  <- {remote_path}")
            restored += 1
    ftp.quit()
    print(f"[OK] Rollback OK: {restored} plikow przywrocono.")


def main():
    if len(sys.argv) < 2:
        snaps = list_snapshots()
        if not snaps:
            return
        print("Dostepne snapshoty (od najstarszego):")
        for s in snaps:
            folder = os.path.join(BACKUP_ROOT, s)
            print(f"  {s}  ({count_files(folder)} plikow)")
        print()
        print("Uzycie: python scripts/ftp_rollback.py <snapshot>")
        print("        python scripts/ftp_rollback.py latest")
        return

    target = sys.argv[1]
    if target == "latest":
        snaps = list_snapshots()
        if not snaps:
            print("[ERR] Brak snapshotow.")
            sys.exit(1)
        target = snaps[-1]
        print(f"[*] latest -> {target}")

    restore_snapshot(target)


if __name__ == "__main__":
    main()
