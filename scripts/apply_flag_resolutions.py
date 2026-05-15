"""Aplikuj migrację flag_resolutions na remote test schema Aliny."""
import os, sys

MIGRATION_FILE = r'C:/BartsGda4/CRM-Atomic/supabase/migrations/20260515_flag_resolutions.sql'
DASHBOARD_URL = 'https://supabase.com/dashboard/project/xqznrssrlnxqkdvisnck/sql'

MIGRATION = open(MIGRATION_FILE, encoding='utf-8').read()

print("=" * 60)
print("apply_flag_resolutions.py")
print("=" * 60)
print()
print("PostgREST nie obsługuje DDL (analogicznie do apply_schema_refactor.py).")
print()
print("Opcja 1 — Supabase SQL Editor (zalecane):")
print(f"  URL: {DASHBOARD_URL}")
print("  Wklej zawartość pliku poniżej i kliknij 'Run'.")
print()
print("Opcja 2 — MCP claude_ai_Supabase__apply_migration (gdy MCP aktywny).")
print()
print(f"Plik: {MIGRATION_FILE}")
print(f"Rozmiar: {len(MIGRATION)} znaków")
print()
print("-" * 60)
print("SQL do wklejenia:")
print("-" * 60)
print(MIGRATION)
