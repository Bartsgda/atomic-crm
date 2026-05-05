"""
ftp_audit.py — Read-only diagnostyka serwera Hostido FTP

Architektura serwera:
  FTP root = web root redroad.pl (index.php, drogi.php itp. są tu bezpośrednio)
  /alina/  = redroad.pl/alina/ = aktywny CRM

Pokazuje: root FTP, /alina/ (mlsd: rozmiar+data), /alina/assets/,
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


def check_index_html(ftp, path="alina"):
    """Pobiera index.html i wypisuje src/href — weryfikacja base URL."""
    try:
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {path}/index.html", buf.write)
        content = buf.getvalue().decode("utf-8")
        matches = re.findall(r'(?:src|href)="([^"]+)"', content)
        print(f"\n=== Ścieżki w /{path}/index.html (weryfikacja base URL) ===")
        for m in matches:
            print(f"  {m}")
    except Exception as e:
        print(f"[!] Nie można pobrać {path}/index.html: {e}")


def main():
    ftp = connect()
    print(f"[*] Połączono: {ftp.getwelcome()[:80]}")

    print("\n=== ROOT FTP = web root redroad.pl ===")
    lines = []
    ftp.dir(lines.append)
    for ln in lines:
        print(f"  {ln}")

    print("\n=== /alina/ (aktywny CRM) ===")
    list_mlsd(ftp, "alina")

    print("\n=== /alina/assets/ ===")
    list_mlsd(ftp, "alina/assets")

    check_index_html(ftp, "alina")

    ftp.quit()
    print("\n[OK] Audit zakończony.")


if __name__ == "__main__":
    main()
