import subprocess
from ftplib import FTP
import io

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
    
    # Pobierz index.html
    r = io.BytesIO()
    ftp.retrbinary("RETR index.html", r.write)
    content = r.getvalue().decode("utf-8")
    
    print("--- CONTENT OF REMOTE index.html ---")
    # Pokaż linie z 'src=' lub 'href='
    for line in content.split("\n"):
        if "src=" in line or "href=" in line:
            print(line.strip())
            
    ftp.quit()

if __name__ == "__main__":
    main()
