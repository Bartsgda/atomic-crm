"""
ftp_audit.py — Read-only diagnostyka serwera Hostido FTP

Pokazuje: root FTP, web root, /alina/ (mlsd: rozmiar+data), /alina/assets/,
oraz src/href ścieżki z zdalnego index.html (weryfikacja czy Vite build ma
dobre base URL).

Użycie:
  python scripts/ftp_audit.py
"""
import io
import re
import sys
import subprocess
from ftplib import FTP


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


def enter_webroot(ftp):
    """
    Hostido: konto deploy@redroad.pl loguje się NAD public_html.
    Web root to public_html/ — wchodzimy tam automatycznie.
    Zwraca ścieżkę (string) do późniejszego wyświetlania.
    """
    root_items = ftp.nlst()
    if "public_html" in root_items:
        ftp.cwd("public_html")
        return "public_html"
    return "(ftp root)"


def list_mlsd(ftp, path, indent=0):
    """Listuje katalog przez mlsd — daje typ, rozmiar i datę modyfikacji."""
    pad = "  " * indent
    try:
        for name, attrs in ftp.mlsd(path):
            if name in (".", ".."): continue
            ftype = attrs.get("type", "?")
            size  = attrs.get("size", "-")
            mtime = attrs.get("modify", "")[:12]  # YYYYMMDDHHMM
            if ftype == "dir":
                print(f"{pad}[D] {name}/")
            else:
                print(f"{pad}[F] {name:<52} {size:>10}B  {mtime}")
    except Exception as e:
        print(f"{pad}[!] Błąd mlsd dla '{path}': {e}")


def check_index_html(ftp, alina_path="alina"):
    """Pobiera index.html ze zdalnego /alina/ i wypisuje src/href ścieżki."""
    try:
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {alina_path}/index.html", buf.write)
        content = buf.getvalue().decode("utf-8")
        matches = re.findall(r'(?:src|href)="([^"]+)"', content)
        print(f"\n=== Ścieżki w /{alina_path}/index.html (weryfikacja base URL) ===")
        for m in matches:
            print(f"  {m}")
    except Exception as e:
        print(f"[!] Nie można pobrać {alina_path}/index.html: {e}")


def main():
    ftp = connect()
    print(f"[*] Połączono: {ftp.getwelcome()[:80]}")

    print("\n=== ROOT FTP (surowy) ===")
    lines = []
    ftp.dir(lines.append)
    for ln in lines:
        print(f"  {ln}")

    webroot = enter_webroot(ftp)
    print(f"\n=== WEB ROOT ({webroot}/) ===")
    list_mlsd(ftp, ".")

    print(f"\n=== /{webroot}/alina/ ===")
    list_mlsd(ftp, "alina")

    print(f"\n=== /{webroot}/alina/assets/ ===")
    list_mlsd(ftp, "alina/assets")

    check_index_html(ftp, "alina")

    ftp.quit()
    print("\n[OK] Audit zakończony.")


if __name__ == "__main__":
    main()
