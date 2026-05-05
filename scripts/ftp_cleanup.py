"""
ftp_cleanup.py — Usuwa pomyłkowe pliki z serwera Hostido FTP

Architektura serwera:
  FTP root = web root redroad.pl (index.php, drogi.php itp. są tu bezpośrednio)
  /alina/  = redroad.pl/alina/ = aktywny CRM — NIE DOTYKAMY

Przeznaczony do usuwania plików wgranych przez pomyłkę do złego miejsca,
np. do /public_html/ zamiast /alina/. Pyta o potwierdzenie przed usunięciem.

Użycie:
  python scripts/ftp_cleanup.py          # interaktywnie (pyta o potwierdzenie)
  python scripts/ftp_cleanup.py --yes    # bez pytań (UWAGA: destruktywne)
"""
import sys
import subprocess
from ftplib import FTP


# Foldery i pliki które Flash omyłkowo wgrywa poza /alina/
# Klucz = ścieżka względem FTP root, wartość = opis
KNOWN_JUNK = {
    # Omyłkowy deploy do public_html zamiast do /alina/
    "public_html/alina":           "omyłkowy deploy CRM do public_html/",
    "public_html/logos":           "śmieci Vite w public_html/",
    "public_html/img":             "śmieci Vite w public_html/",
    "public_html/appIcon":         "śmieci Vite w public_html/",
    # Gdyby kiedyś Flash wrzucił luzem w FTP root (nie do /alina/)
    "auth-callback.html":          "pomyłkowy plik Vite w root",
    "manifest.json":               "pomyłkowy plik Vite w root",
    "robots.txt":                  "pomyłkowy plik Vite w root",
    "stats.html":                  "pomyłkowy plik Vite w root",
}

# BEZWZGLEDNIE CHRONIONE — nigdy nie usuwamy
PROTECTED = {
    "alina",         # aktywny CRM redroad.pl/alina/
    "index.php",     # główna strona redroad.pl
    "public_html",   # folder z subprojektami (sam folder — nie usuwamy)
    "calc",
    "portfolio",
    "domains",
    "assets",        # zasoby głównej strony (nie Vite!)
    "src",
    "core",
    "nadzory",
    "konsultacje",
    "working",
}


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
    Usuwa folder rekurencyjnie przez mlsd (mlsd daje typ 'dir'/'file' —
    bezpieczniejsze niż nlst które tylko zwraca nazwy).
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


def connect():
    host   = get_vault_secret("HOSTIDO_FTP_HOST")
    user   = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    if not all([host, user, passwd]):
        print("[ERR] Brak danych FTP w vault.")
        sys.exit(1)
    ftp = FTP(host)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    return ftp


def main():
    auto_yes = "--yes" in sys.argv

    ftp = connect()
    root_items = set(ftp.nlst())

    # Sprawdź ochronę — potwierdź że /alina/ jest nienaruszony
    if "alina" not in root_items:
        print("[!!! UWAGA !!!] /alina/ NIE ISTNIEJE w FTP root!")
        print("  To jest aktywny CRM redroad.pl/alina/ — coś jest nie tak.")
        print("  Uruchom ftp_deploy.py --no-build żeby przywrócić.")
        ftp.quit()
        sys.exit(1)
    else:
        print(f"[OK] /alina/ istnieje — aktywny CRM chroniony.")

    # Ustal co faktycznie istnieje na serwerze z listy KNOWN_JUNK
    found = []
    for path, desc in KNOWN_JUNK.items():
        top = path.split("/")[0]
        if top in root_items or "/" in path:
            try:
                # Sprawdź czy ścieżka istnieje (nlst rzuci wyjątek jeśli nie)
                ftp.nlst(path)
                found.append((path, desc))
            except Exception:
                pass

    if not found:
        print("[OK] Brak pomyłkowych plików — serwer czysty.")
        ftp.quit()
        return

    print("\nZnalezione elementy do usunięcia:")
    for path, desc in found:
        print(f"  {path:<40} ← {desc}")

    print("\n[OCHRONA] Następujące foldery NIGDY nie będą dotknięte:")
    for p in sorted(PROTECTED):
        print(f"  /{p}/")

    if not auto_yes:
        ans = input("\nPotwierdzasz usunięcie? Wpisz 'tak' aby kontynuować: ").strip().lower()
        if ans != "tak":
            print("Anulowano — nic nie usunięto.")
            ftp.quit()
            return

    for path, desc in found:
        top = path.split("/")[0]
        if top in PROTECTED and "/" not in path:
            print(f"[SKIP] Chroniony: {path}")
            continue
        delete_dir_recursive(ftp, path)

    # Finalna weryfikacja — upewnij się że /alina/ nadal istnieje
    remaining = set(ftp.nlst())
    if "alina" in remaining:
        print("\n[OK] Cleanup zakończony. /alina/ nienaruszony.")
    else:
        print("\n[!!! KRYTYCZNY BŁĄD !!!] /alina/ zniknął po cleanup!")
        print("  Natychmiast uruchom: python scripts/ftp_deploy.py --no-build")

    ftp.quit()


if __name__ == "__main__":
    main()
