"""
ftp_cleanup.py — Usuwa pomyłkowe pliki z web roota na Hostido FTP

Przeznaczony do usuwania plików wgranych przez pomyłkę do web roota
zamiast do /alina/. Pyta o potwierdzenie przed każdą operacją.

Użycie:
  python scripts/ftp_cleanup.py          # interaktywnie (pyta o potwierdzenie)
  python scripts/ftp_cleanup.py --yes    # bez pytań (UWAGA: destruktywne)
"""
import sys
import subprocess
from ftplib import FTP


# Pliki wrzucane przez Vite do roota przez pomyłkę
JUNK_FILES = [
    "auth-callback.html",
    "favicon.ico",
    "index.html",
    "manifest.json",
    "robots.txt",
    "stats.html",
    ".htaccess",
]
# Foldery wrzucane przez Vite do roota przez pomyłkę
JUNK_DIRS = [
    "assets",
    "img",
    "logos",
    "appIcon",
]


def get_vault_secret(name):
    try:
        val = subprocess.check_output(
            f'powershell -Command "rrv get {name}"', shell=True
        ).decode("utf-8").replace("﻿", "").strip()
        return val or None
    except Exception as e:
        print(f"[!] vault error ({name}): {e}")
        return None


def delete_dir_recursive(ftp, path):
    """
    Usuwa folder rekurencyjnie przez mlsd (bezpieczne — mlsd daje typ 'dir'/'file').
    FTP nie ma odpowiednika rm -rf więc musimy czyścić od liści.
    """
    try:
        for name, attrs in ftp.mlsd(path):
            if name in (".", ".."): continue
            child = f"{path}/{name}"
            if attrs.get("type") == "dir":
                delete_dir_recursive(ftp, child)
            else:
                ftp.delete(child)
                print(f"  [-] {child}")
        ftp.rmd(path)
        print(f"  [-] DIR {path}/")
    except Exception as e:
        print(f"  [!] Błąd przy {path}: {e}")


def connect_and_enter_webroot():
    host   = get_vault_secret("HOSTIDO_FTP_HOST")
    user   = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    if not all([host, user, passwd]):
        print("[ERR] Brak danych FTP w vault (HOSTIDO_FTP_HOST/USER/PASS).")
        sys.exit(1)
    ftp = FTP(host)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    if "public_html" in ftp.nlst():
        ftp.cwd("public_html")
        print("[*] Weszłem do public_html/ (web root Hostido)")
    else:
        print("[*] public_html nie znaleziono — zostaję w FTP root")
    return ftp


def main():
    auto_yes = "--yes" in sys.argv

    ftp = connect_and_enter_webroot()
    existing = set(ftp.nlst())

    found_files = [f for f in JUNK_FILES if f in existing]
    found_dirs  = [d for d in JUNK_DIRS  if d in existing]

    if not found_files and not found_dirs:
        print("[OK] Brak pomyłkowych plików — web root czysty.")
        ftp.quit()
        return

    print("\nZnalezione elementy do usunięcia:")
    for f in found_files: print(f"  [plik] {f}")
    for d in found_dirs:  print(f"  [dir]  {d}/")

    if not auto_yes:
        ans = input("\nPotwierdzasz usunięcie? Wpisz 'tak' aby kontynuować: ").strip().lower()
        if ans != "tak":
            print("Anulowano — nic nie usunięto.")
            ftp.quit()
            return

    for fname in found_files:
        try:
            ftp.delete(fname)
            print(f"[-] Usunięto: {fname}")
        except Exception as e:
            print(f"[!] {fname}: {e}")

    for dname in found_dirs:
        delete_dir_recursive(ftp, dname)

    ftp.quit()
    print("\n[OK] Cleanup zakończony.")


if __name__ == "__main__":
    main()
