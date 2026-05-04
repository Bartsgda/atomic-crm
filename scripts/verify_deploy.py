import subprocess
from ftplib import FTP

def get_vault_secret(name):
    try:
        cmd = f'powershell -Command "rrv get {name}"'
        val = subprocess.check_output(cmd, shell=True).decode("utf-8").strip()
        val = val.replace('\ufeff', '').strip()
        return val
    except:
        return None

def main():
    host = get_vault_secret("HOSTIDO_FTP_HOST")
    user = get_vault_secret("HOSTIDO_FTP_USER")
    passwd = get_vault_secret("HOSTIDO_FTP_PASS")
    
    ftp = FTP(host)
    ftp.login(user, passwd)
    ftp.set_pasv(True)
    
    if "public_html" in ftp.nlst():
        ftp.cwd("public_html")
    
    print(f"{'FILE PATH':<60} | {'SIZE (B)':<10} | {'MODIFIED (UTC)'}")
    print("-" * 100)

    def walk_and_list(path):
        try:
            ftp.cwd(path)
            # Używamy MLSx dla dokładnych dat i typów
            for name, attrs in ftp.mlsd():
                if name in [".", ".."]: continue
                
                full_path = f"{path}/{name}".strip("/")
                
                if attrs['type'] == 'dir':
                    walk_and_list(name)
                    ftp.cwd("..")
                else:
                    size = attrs.get('size', '0')
                    modify = attrs.get('modify', 'UNKNOWN')
                    # Format modify: YYYYMMDDHHMMSS
                    print(f"{full_path:<60} | {size:<10} | {modify}")
        except Exception as e:
            # print(f"Error in {path}: {e}")
            pass

    walk_and_list("alina")
    ftp.quit()

if __name__ == "__main__":
    main()
