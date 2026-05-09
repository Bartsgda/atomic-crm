"""
crm-crypt.py — Szyfrowanie/deszyfrowanie plikow RODO dla CRM-Alina

Algorytm: PBKDF2-SHA256 (600k iteracji) -> AES-256-GCM
  identyczny z PassphraseGate w przegladarce (services/crypto.ts)

Format pliku .enc: [16B salt][12B IV][AES-GCM ciphertext+tag]
Konwencja nazw:  dane.xlsx -> dane.xlsx.enc  (inner ext z nazwy)

Uzycie:
  python scripts/crm-crypt.py encrypt dane.xlsx
      Pyta o haslo, szyfruje, usuwa oryginal

  python scripts/crm-crypt.py encrypt dane.csv --keep
      Szyfruje, zachowuje oryginal (np. do testow)

  python scripts/crm-crypt.py encrypt crm-pro/data/legacy/
      Szyfruje caly folder (.ts .csv .xlsx .xls .json .txt)

  python scripts/crm-crypt.py decrypt dane.xlsx.enc
      Pyta o haslo, odszyfrowuje do pliku obok

  python scripts/crm-crypt.py decrypt crm-pro/data/legacy/
      Odszyfrowuje wszystkie .enc w folderze
"""
import os
import sys
import getpass
import secrets
from pathlib import Path

SUPPORTED_PLAIN = {".xlsx", ".xls", ".csv", ".ts", ".txt", ".json"}
PBKDF2_ITER     = 600_000
SALT_LEN        = 16
IV_LEN          = 12


def _libs():
    try:
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        return PBKDF2HMAC, hashes, AESGCM
    except ImportError:
        print("[ERR] Brak biblioteki: pip install cryptography")
        sys.exit(1)


def derive_key(passphrase: str, salt: bytes) -> bytes:
    PBKDF2HMAC, hashes, _ = _libs()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=PBKDF2_ITER,
    )
    return kdf.derive(passphrase.encode("utf-8"))


def ask_passphrase(confirm: bool = False) -> str:
    p = getpass.getpass("Haslo: ")
    if confirm:
        p2 = getpass.getpass("Potwierdz haslo: ")
        if p != p2:
            print("[ERR] Hasla nie sa zgodne.")
            sys.exit(1)
    if not p:
        print("[ERR] Haslo nie moze byc puste.")
        sys.exit(1)
    return p


def encrypt_file(path: Path, passphrase: str, keep_original: bool = False) -> Path:
    _, _, AESGCM = _libs()
    salt = secrets.token_bytes(SALT_LEN)
    iv   = secrets.token_bytes(IV_LEN)
    key  = derive_key(passphrase, salt)
    data = path.read_bytes()
    ct   = AESGCM(key).encrypt(iv, data, None)
    out  = path.with_name(path.name + ".enc")
    out.write_bytes(salt + iv + ct)
    if not keep_original:
        path.unlink()
        print(f"[OK] {path.name} ({len(data)/1024:.1f} KB) -> {out.name}  [oryginal usuniety]")
    else:
        print(f"[OK] {path.name} ({len(data)/1024:.1f} KB) -> {out.name}")
    return out


def decrypt_file(path: Path, passphrase: str) -> Path:
    _, _, AESGCM = _libs()
    raw = path.read_bytes()
    if len(raw) < SALT_LEN + IV_LEN + 16:
        print("[ERR] Plik za krotki — uszkodzony?")
        sys.exit(1)
    salt = raw[:SALT_LEN]
    iv   = raw[SALT_LEN:SALT_LEN + IV_LEN]
    ct   = raw[SALT_LEN + IV_LEN:]
    key  = derive_key(passphrase, salt)
    try:
        data = AESGCM(key).decrypt(iv, ct, None)
    except Exception:
        print("[ERR] Deszyfrowanie nieudane — bledne haslo lub uszkodzony plik.")
        sys.exit(1)
    # dane.xlsx.enc -> dane.xlsx
    out = path.with_suffix("")
    out.write_bytes(data)
    print(f"[OK] {path.name} -> {out.name}  ({len(data)/1024:.1f} KB)")
    return out


def encrypt_folder(folder: Path, passphrase: str, keep_original: bool = False):
    files = [f for f in folder.rglob("*")
             if f.is_file() and f.suffix in SUPPORTED_PLAIN]
    if not files:
        print(f"[!] Brak plikow do zaszyfrowania w {folder}/")
        return
    print(f"[*] Szyfrowanie {len(files)} plikow w {folder}/")
    for f in files:
        encrypt_file(f, passphrase, keep_original=keep_original)


def decrypt_folder(folder: Path, passphrase: str):
    files = list(folder.rglob("*.enc"))
    if not files:
        print(f"[!] Brak plikow .enc w {folder}/")
        return
    print(f"[*] Deszyfrowanie {len(files)} plikow w {folder}/")
    for f in files:
        decrypt_file(f, passphrase)


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    cmd = args[0]
    if cmd not in ("encrypt", "decrypt"):
        print(f"[ERR] Nieznana komenda: {cmd}. Uzyj: encrypt / decrypt")
        sys.exit(1)

    if len(args) < 2:
        print("[ERR] Podaj sciezke pliku lub folderu.")
        sys.exit(1)

    target = Path(args[1])
    keep   = "--keep" in args or "-k" in args

    if not target.exists():
        print(f"[ERR] Nie znaleziono: {target}")
        sys.exit(1)

    if cmd == "encrypt":
        passphrase = ask_passphrase(confirm=True)
        if target.is_dir():
            encrypt_folder(target, passphrase, keep_original=keep)
        else:
            if target.suffix == ".enc":
                print("[ERR] Plik juz zaszyfrowany (.enc).")
                sys.exit(1)
            encrypt_file(target, passphrase, keep_original=keep)

    elif cmd == "decrypt":
        passphrase = ask_passphrase(confirm=False)
        if target.is_dir():
            decrypt_folder(target, passphrase)
        else:
            if target.suffix != ".enc":
                print("[ERR] Plik nie ma rozszerzenia .enc")
                sys.exit(1)
            decrypt_file(target, passphrase)


if __name__ == "__main__":
    main()
