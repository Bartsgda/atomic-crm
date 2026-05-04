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
    
    # Root do public_html
    if "public_html" in ftp.nlst():
        ftp.cwd("public_html")
    
    print("\n--- CONTENT OF /alina/ ---")
    ftp.cwd("alina")
    for name, attrs in ftp.mlsd():
        if attrs['type'] == 'file':
            print(f"{name:<50} | {attrs['modify']}")
            
    print("\n--- CONTENT OF /alina/assets/ ---")
    ftp.cwd("assets")
    for name, attrs in ftp.mlsd():
        if attrs['type'] == 'file':
            print(f"{name:<50} | {attrs['modify']}")
            
    ftp.quit()

if __name__ == "__main__":
    main()
