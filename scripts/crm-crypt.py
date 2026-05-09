"""
crm-crypt.py — Szyfrowanie/deszyfrowanie plikow RODO dla CRM-Alina

Format .enc: [12B IV][AES-GCM ciphertext+tag]
Klucz: CRM_DATA_KEY z rrv vault (hex 64 znaki = 32B = AES-256)

Konwencja nazw:
  dane.xlsx  -> dane.xlsx.enc
  dane.csv   -> dane.csv.enc
  dane.ts    -> dane.ts.enc
  (po .enc widac wewnetrzny format, przegladarka umie go rozpoznac)

Uzycie:
  python scripts/crm-crypt.py keygen
      Generuje nowy klucz -> wyswietla komende rrv set

  python scripts/crm-crypt.py encrypt dane.xlsx
      Szyfruje plik, usuwa oryginal (bezpieczne)

  python scripts/crm-crypt.py encrypt dane.csv --keep
      Szyfruje, zachowuje oryginal (np. do testow)

  python scripts/crm-crypt.py decrypt dane.xlsx.enc
      Odszyfrowuje do pliku obok (tylko lokalnie, dev)

  python scripts/crm-crypt.py encrypt test-data/          (folder)
      Szyfruje wszystkie .xlsx/.xls/.csv/.ts w folderze
"""
import os
import sys
import secrets
import subprocess
from pathlib import Path

SUPPORTED_PLAIN = {".xlsx", ".xls", ".csv", ".ts", ".txt", ".json"}


def get_key() -> bytes:
    key_hex = (
        os.environ.get("VITE_DATA_KEY")
        or os.environ.get("CRM_DATA_KEY")
    )
    if not key_hex:
        try:
            key_hex = subprocess.check_output(
                'powershell -Command "rrv get CRM_DATA_KEY"', shell=True
            ).decode().replace("﻿", "").strip()
        except Exception as e:
            print(f"[ERR] Brak CRM_DATA_KEY w env/vault: {e}")
            sys.exit(1)
    key_hex = key_hex.strip()
    if len(key_hex) != 64:
        print(f"[ERR] CRM_DATA_KEY musi byc hex 64 znaki (32B). Mam: {len(key_hex)}")
        print("      Wygeneruj nowy: python scripts/crm-crypt.py keygen")
        sys.exit(1)
    return bytes.fromhex(key_hex)


def _aesgcm():
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        return AESGCM
    except ImportError:
        print("[ERR] Brak biblioteki: pip install cryptography")
        sys.exit(1)


def encrypt_file(path: Path, keep_original: bool = False) -> Path:
    AESGCM = _aesgcm()
    key = get_key()
    iv = secrets.token_bytes(12)
    data = path.read_bytes()
    ct = AESGCM(key).encrypt(iv, data, None)
    out = path.with_name(path.name + ".enc")
    out.write_bytes(iv + ct)
    size_kb = len(data) / 1024
    if not keep_original:
        path.unlink()
        print(f"[OK] {path.name} ({size_kb:.1f} KB) -> {out.name}  [oryginal usuniety]")
    else:
        print(f"[OK] {path.name} ({size_kb:.1f} KB) -> {out.name}")
    return out


def decrypt_file(path: Path) -> Path:
    AESGCM = _aesgcm()
    key = get_key()
    raw = path.read_bytes()
    if len(raw) < 28:
        print("[ERR] Plik za krotki — uszkodzony?")
        sys.exit(1)
    iv, ct = raw[:12], raw[12:]
    try:
        data = AESGCM(key).decrypt(iv, ct, None)
    except Exception:
        print("[ERR] Deszyfrowanie nieudane — zly klucz lub uszkodzony plik.")
        sys.exit(1)
    out = path.with_name(path.stem if path.suffix == ".enc" else path.name)
    out.write_bytes(data)
    print(f"[OK] {path.name} -> {out.name}  ({len(data)/1024:.1f} KB)")
    return out


def encrypt_folder(folder: Path, keep_original: bool = False):
    files = [f for f in folder.rglob("*") if f.is_file() and f.suffix in SUPPORTED_PLAIN]
    if not files:
        print(f"[!] Brak plikow do zaszyfrowania w {folder}/")
        return
    print(f"[*] Szyfrowanie {len(files)} plikow w {folder}/")
    for f in files:
        encrypt_file(f, keep_original=keep_original)


def keygen():
    key = secrets.token_bytes(32).hex()
    print(f"\n  Nowy klucz AES-256:\n  {key}\n")
    print(f"  Zapisz w vault:\n  rrv set CRM_DATA_KEY --value {key}\n")
    print("  UWAGA: Klucz widac tylko teraz. Zapisz go bezpiecznie.")


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    cmd = args[0]

    if cmd == "keygen":
        keygen()
        return

    if len(args) < 2:
        print("[ERR] Podaj sciezke pliku lub folderu.")
        sys.exit(1)

    target = Path(args[1])
    keep = "--keep" in args or "-k" in args

    if not target.exists():
        print(f"[ERR] Nie znaleziono: {target}")
        sys.exit(1)

    if cmd == "encrypt":
        if target.is_dir():
            encrypt_folder(target, keep_original=keep)
        else:
            if target.suffix == ".enc":
                print("[ERR] Plik juz zaszyfrowany (.enc). Pomijam.")
                sys.exit(1)
            encrypt_file(target, keep_original=keep)

    elif cmd == "decrypt":
        if target.is_dir():
            files = list(target.rglob("*.enc"))
            if not files:
                print(f"[!] Brak plikow .enc w {target}/")
                return
            for f in files:
                decrypt_file(f)
        else:
            if target.suffix != ".enc":
                print("[ERR] Plik nie ma rozszerzenia .enc")
                sys.exit(1)
            decrypt_file(target)

    else:
        print(f"[ERR] Nieznana komenda: {cmd}")
        print("      Dostepne: keygen / encrypt / decrypt")
        sys.exit(1)


if __name__ == "__main__":
    main()
