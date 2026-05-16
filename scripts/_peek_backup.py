import sqlite3, json, sys

DB = r"C:\Users\Barts\AppData\Local\RedRoad\alina_backup\alina_backup_DECRYPTED.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row

tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]

print("\n=== TABELE ===")
for t in tables:
    count = conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
    print(f"  {t:<35} {count:>5} wierszy")

print("\n=== insurance_clients (pierwsze 5) ===")
for row in conn.execute('SELECT id, first_name, last_name, source FROM insurance_clients LIMIT 5'):
    print(f"  {dict(row)}")

print("\n=== policies (pierwsze 5) ===")
for row in conn.execute('SELECT id, type, stage, created_at FROM policies LIMIT 5'):
    print(f"  {dict(row)}")

print("\n=== insurers (pierwsze 10) ===")
for row in conn.execute('SELECT id, name FROM insurers LIMIT 10'):
    print(f"  {row['id'][:8]}…  {row['name']}")

conn.close()
