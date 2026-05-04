import subprocess
from ftplib import FTP
import io
import re

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
    
    ftp.cwd("alina")
    r = io.BytesIO()
    ftp.retrbinary("RETR index.html", r.write)
    content = r.getvalue().decode("utf-8")
    
    print("\n--- FOUND PATHS IN REMOTE index.html ---")
    # Szukaj src="..." i href="..."
    matches = re.findall(r'(src|href)="([^"]+)"', content)
    for m_type, path in matches:
        print(f"{m_type}: {path}")
        
    ftp.quit()

if __name__ == "__main__":
    main()
