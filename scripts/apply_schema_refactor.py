"""Aplikuj migrację schema_refactor na remote test schema Aliny."""
import os, urllib.request, json, sys

URL = os.environ['CRM_ALINA_SUPABASE_URL']
KEY = os.environ['CRM_ALINA_E2E_SERVICE_ROLE']  # service_role wymagany do DDL

MIGRATION = open(
    r'C:/BartsGda4/CRM-Atomic/supabase/migrations/20260514_schema_refactor_vehicles_insured.sql',
    encoding='utf-8'
).read()

def run_sql(sql, label):
    req = urllib.request.Request(
        f"{URL}/rest/v1/rpc/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            'apikey': KEY,
            'Authorization': f'Bearer {KEY}',
            'Content-Type': 'application/json',
            'Accept-Profile': 'test',
            'Content-Profile': 'test',
        },
        method='POST'
    )
    try:
        resp = urllib.request.urlopen(req)
        print(f"  ✅ {label}")
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ❌ {label}: {e.code} {body[:200]}")
        return False

# Podziel na bloki po średniku (uproszczone - pomija ;; w stringach)
# Lepszy sposób: cały plik jako jeden request przez /sql endpoint Supabase Management API
# PostgREST rpc nie obsługuje DDL — potrzebujemy Management API

import urllib.parse

MGMT_URL = "https://api.supabase.com/v1"

# Sprawdź czy mamy management token
mgmt_token = os.environ.get('SUPABASE_MANAGEMENT_TOKEN') or os.environ.get('GH_TOKEN_REDROAD')

print("PostgREST nie obsługuje DDL bezpośrednio.")
print("Potrzebny: Supabase Management API lub bezpośredni dostęp do Postgres.")
print()
print("Opcje:")
print("1. Uruchom Docker Desktop → npx supabase start → apply lokalnie")
print("2. Wklej SQL ręcznie w Supabase Dashboard → SQL Editor")
print(f"   URL: https://supabase.com/dashboard/project/xqznrssrlnxqkdvisnck/sql")
print()
print(f"Plik migracji: supabase/migrations/20260514_schema_refactor_vehicles_insured.sql")
print(f"Rozmiar: {len(MIGRATION)} znaków")

# Sprawdź czy mamy claude_ai_Supabase MCP (przez env)
print()
print("Alternatywa: użyj mcp__claude_ai_Supabase__execute_sql (jeśli MCP aktywny)")
