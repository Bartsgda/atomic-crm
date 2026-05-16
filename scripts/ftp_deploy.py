"""
ftp_deploy.py — Build produkcyjny + deploy CRM-Alina na Hostido FTP

Architektura serwera:
  FTP root = web root redroad.pl (index.php, drogi.php itp. są tu bezpośrednio)
  /alina/  = redroad.pl/alina/ = właściwy cel deploymentu

Pobiera klucze z rrv vault, buduje Vite z wstrzykniętym env (bez zapisywania
sekretów do pliku), wgrywa dist/ → /alina/.

Pre-overwrite backup (default ON, 2026-05-16):
  Przed każdym STOR nowego pliku → RETR aktualnego pliku z serwera do
  `ftp_backups/YYYY-MM-DD_HHMMSS/<remote-path>`. 50 plików w deployu = 50
  plików w folderze backup. Rollback = wgranie tych plików z powrotem.
  Pomijane gdy plik nie istnieje jeszcze na serwerze (świeży deploy).

Użycie:
  python scripts/ftp_deploy.py             # build + deploy + backup
  python scripts/ftp_deploy.py --no-build  # tylko upload + backup
  python scripts/ftp_deploy.py --no-backup # bez pre-overwrite backupu
"""
import os
import sys
import subprocess
from datetime import datetime
from ftplib import FTP, error_perm


SB_URL           = "https://xqznrssrlnxqkdvisnck.supabase.co"
REMOTE_SUBFOLDER = "alina"
LOCAL_DIST       = "dist"
BACKUP_ROOT      = "ftp_backups"


def get_vault_secret(name):
    try:
        val = subprocess.check_output(
            f'powershell -Command "rrv get {name}"', shell=True
        ).decode("utf-8").replace("﻿", "").strip()
        return val or None
    except Exception as e:
        print(f"[!] vault error ({name}): {e}")
        return None


def build(sb_pub, sb_sec):
    """Uruchamia npm run build z kluczami wstrzykniętymi przez env (nie przez plik)."""
    env = os.environ.copy()
    env.update({
        "VITE_SUPABASE_URL":        SB_URL,
        "VITE_SB_PUBLISHABLE_KEY":  sb_pub,
        "VITE_SB_SECRET_KEY":       sb_sec,
        "VITE_IS_DEMO":             "false",
        "VITE_ATTACHMENTS_BUCKET":  "attachments",
    })
    print("[*] npm run build (prod) ...")
    subprocess.check_call("npm run build", env=env, shell=True)
    print("[OK] Build zakończony.")


def backup_remote_file(ftp, remote_path, backup_dir):
    """Pobiera plik z FTP do backup_dir/<remote_path>. Zwraca True jeśli pobrano.
    False = plik nie istnieje (świeży deploy) albo błąd RETR.
    """
    local_target = os.path.join(backup_dir, remote_path.replace("/", os.sep))
    os.makedirs(os.path.dirname(local_target), exist_ok=True)
    try:
        with open(local_target, "wb") as f:
            ftp.retrbinary(f"RETR {remote_path}", f.write)
        return True
    except error_perm as e:
        # 550 = file not found — to OK przy pierwszym deployu nowego pliku
        if str(e).startswith("550"):
            os.remove(local_target)
            try:
                os.removedirs(os.path.dirname(local_target))
            except OSError:
                pass
            return False
        raise


def upload_directory(ftp, local_dir, remote_dir, backup_dir=None):
    """Rekurencyjnie wgrywa local_dir → remote_dir przez STOR.
    Jeśli backup_dir podany — przed każdym STOR robi RETR do backup_dir.
    """
    uploaded = 0
    backed_up = 0
    new_files = 0
    for root, _dirs, files in os.walk(local_dir):
        rel    = os.path.relpath(root, local_dir)
        target = remote_dir if rel == "." else f"{remote_dir}/{rel}".replace("\\", "/")
        try:
            ftp.mkd(target)
        except Exception:
            pass  # katalog już istnieje — OK
        for fname in files:
            remote_path = f"{target}/{fname}".replace("\\", "/")
            if backup_dir:
                if backup_remote_file(ftp, remote_path, backup_dir):
                    backed_up += 1
                else:
                    new_files += 1
            with open(os.path.join(root, fname), "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f)
            print(f"  -> {remote_path}")
            uploaded += 1
    return uploaded, backed_up, new_files


def connect():
    """Łączy z FTP. FTP root = web root redroad.pl — nie wchodzimy do public_html."""
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


def main():
    skip_build  = "--no-build"  in sys.argv
    skip_backup = "--no-backup" in sys.argv

    if not skip_build:
        sb_pub = get_vault_secret("CRM_ALINA_SB_PUBLISHABLE")
        sb_sec = get_vault_secret("CRM_ALINA_SB_SECRET")
        if not all([sb_pub, sb_sec]):
            print("[ERR] Brak kluczy Supabase w vault (CRM_ALINA_SB_PUBLISHABLE/SECRET).")
            sys.exit(1)
        try:
            build(sb_pub, sb_sec)
        except subprocess.CalledProcessError:
            print("[ERR] Build nieudany — przerywam.")
            sys.exit(1)

    if not os.path.exists(LOCAL_DIST):
        print(f"[ERR] Folder {LOCAL_DIST}/ nie istnieje. Uruchom bez --no-build.")
        sys.exit(1)

    backup_dir = None
    if not skip_backup:
        stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        backup_dir = os.path.join(BACKUP_ROOT, stamp)
        os.makedirs(backup_dir, exist_ok=True)
        print(f"[*] Pre-overwrite backup -> {backup_dir}/")
    else:
        print("[!] --no-backup: SKIP pre-overwrite backup (rollback nie bedzie mozliwy z tego deployu)")

    ftp = connect()
    print(f"[*] Upload: {LOCAL_DIST}/ -> /{REMOTE_SUBFOLDER}/ ...")
    n, backed_up, new_files = upload_directory(ftp, LOCAL_DIST, REMOTE_SUBFOLDER, backup_dir)
    ftp.quit()
    print(f"[OK] Deploy OK: {n} plikow -> redroad.pl/{REMOTE_SUBFOLDER}/")
    if backup_dir:
        print(f"[OK] Backup: {backed_up} plikow pobrano przed nadpisaniem, {new_files} nowych (bez backupu)")
        print(f"     Rollback: python scripts/ftp_rollback.py {stamp}")
    print()
    print("=" * 60)
    print("  PAMIETAJ: powiedz Alinie co sie zmienilo!")
    print("  Nie technicznie — tylko co inaczej dziala lub wyglada.")
    print("  Np.: 'poprawilam ze klikasz raz zamiast dwa razy',")
    print("       'godziny w kalendarzu sa teraz poprawne',")
    print("       'sekcja wypowidzen wyglada teraz lepiej'.")
    print("=" * 60)


if __name__ == "__main__":
    main()
