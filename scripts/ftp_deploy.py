"""
ftp_deploy.py — Build produkcyjny + deploy CRM-Alina na Hostido FTP

Architektura serwera:
  FTP root = web root redroad.pl (index.php, drogi.php itp. są tu bezpośrednio)
  /alina/  = redroad.pl/alina/ = właściwy cel deploymentu

Pobiera klucze z rrv vault, buduje Vite z wstrzykniętym env (bez zapisywania
sekretów do pliku), wgrywa dist/ → /alina/.

Użycie:
  python scripts/ftp_deploy.py             # build + deploy
  python scripts/ftp_deploy.py --no-build  # tylko upload (dist/ musi istnieć)
"""
import os
import sys
import subprocess
from ftplib import FTP


SB_URL           = "https://xqznrssrlnxqkdvisnck.supabase.co"
REMOTE_SUBFOLDER = "alina"
LOCAL_DIST       = "dist"


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


def upload_directory(ftp, local_dir, remote_dir):
    """Rekurencyjnie wgrywa local_dir → remote_dir przez STOR."""
    uploaded = 0
    for root, _dirs, files in os.walk(local_dir):
        rel    = os.path.relpath(root, local_dir)
        target = remote_dir if rel == "." else f"{remote_dir}/{rel}".replace("\\", "/")
        try:
            ftp.mkd(target)
        except Exception:
            pass  # katalog już istnieje — OK
        for fname in files:
            remote_path = f"{target}/{fname}".replace("\\", "/")
            with open(os.path.join(root, fname), "rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f)
            print(f"  -> {remote_path}")
            uploaded += 1
    return uploaded


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
    skip_build = "--no-build" in sys.argv

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

    ftp = connect()
    print(f"[*] Upload: {LOCAL_DIST}/ -> /{REMOTE_SUBFOLDER}/ ...")
    n = upload_directory(ftp, LOCAL_DIST, REMOTE_SUBFOLDER)
    ftp.quit()
    print(f"[OK] Deploy OK: {n} plikow -> redroad.pl/{REMOTE_SUBFOLDER}/")
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
