import subprocess, requests, json

def rrv(n):
    return subprocess.check_output(f'powershell -Command "rrv get {n}"', shell=True).decode('utf-8-sig').strip()

pat = rrv("1h_SUPABASE_MOZNA_KASOWAC")
ref = "xqznrssrlnxqkdvisnck"

TABLES = [
    'insurance_clients','sub_agents','insurers','checklist_templates',
    'policies','policy_notes','policy_sub_agent_shares',
    'insurance_feedback','insurance_activity_log','insurance_login_log',
    'insurance_snapshots','insurance_trash','terminations','init_state'
]
tables_sql = "','".join(TABLES)

def query(sql):
    r = requests.post(
        f"https://api.supabase.com/v1/projects/{ref}/database/query",
        headers={"Authorization": f"Bearer {pat}", "Content-Type": "application/json"},
        json={"query": sql}, timeout=30
    )
    return r.json()

# FK constraints na tabelach sync (obie schematy)
fk_sql = f"""
SELECT
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS ref_schema,
    ccu.table_name   AS ref_table,
    ccu.column_name  AS ref_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema IN ('public','test')
  AND tc.table_name IN ('{tables_sql}')
ORDER BY tc.table_schema, tc.table_name, kcu.column_name;
"""

# Różnice kolumn między public i test
col_diff_sql = f"""
SELECT
    COALESCE(p.table_name, t.table_name) AS table_name,
    COALESCE(p.column_name, t.column_name) AS column_name,
    CASE WHEN p.column_name IS NULL THEN 'tylko test'
         WHEN t.column_name IS NULL THEN 'tylko public'
         ELSE 'obie' END AS presence,
    p.data_type AS public_type,
    t.data_type AS test_type
FROM
    (SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name IN ('{tables_sql}')) p
FULL OUTER JOIN
    (SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema='test' AND table_name IN ('{tables_sql}')) t
    ON p.table_name=t.table_name AND p.column_name=t.column_name
WHERE p.column_name IS NULL OR t.column_name IS NULL
ORDER BY table_name, presence, column_name;
"""

print("=" * 70)
print("FK CONSTRAINTS (public + test) na tabelach sync:")
print("=" * 70)
fks = query(fk_sql)
if fks:
    for r in fks:
        print(f"  [{r['table_schema']}].{r['table_name']}.{r['column_name']}")
        print(f"    → [{r['ref_schema']}].{r['ref_table']}.{r['ref_column']}")
        print(f"    constraint: {r['constraint_name']}")
else:
    print("  (brak FK)")

print()
print("=" * 70)
print("RÓŻNICE KOLUMN (public vs test):")
print("=" * 70)
diffs = query(col_diff_sql)
if diffs:
    cur_table = None
    for r in diffs:
        if r['table_name'] != cur_table:
            cur_table = r['table_name']
            print(f"\n  {cur_table}:")
        print(f"    {r['presence']:<12} {r['column_name']}  ({r['public_type'] or r['test_type']})")
else:
    print("  (brak różnic — schematy identyczne)")
