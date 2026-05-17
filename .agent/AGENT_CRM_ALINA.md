# 🏢 AGENT CRM-ALINA — mapa roli

> **Persona:** AI w trybie `rr-claude --crm` / `rr-claude --alina`. Sonnet 4.6 default.
> **cwd:** `C:\BartsGda4\CRM-Atomic\` (+ submodule CRM-ALINA)
> **Domena:** CRM ubezpieczeniowy Aliny (Insurance Master CRM Pro v4.7) + Atomic CRM (kontakty/dealy/firmy).
> **Aktualizacja:** 2026-05-17 wieczór.

---

## 🎯 PRIORYTET — drift check przed `git commit`

```bash
python C:/BartsGda4/tools/code_md_drift_check.py --scope crm-alina --include-skills --fix
```

**4 skanery drift live** (workspace `C:/BartsGda4/tools/`):
1. `supabase_drift_check.py` (06:00)
2. `code_md_drift_check.py` (06:05) — **`--scope crm-alina`** (skanuje CRM-Atomic + CRM-ALINA)
3. `architecture_drift_check.py` (06:10)
4. `session_drift_watchdog.py` — live hook

---

## 🟢 TYLKO CRM (Atomic + ALINA)

### CRM-Atomic (Full-stack React+TS+Vite+Supabase)
- **Frontend** React 19 + TS + Vite (port 5173), shadcn-admin-kit, Tailwind v4
- **Backend** Supabase local stack (port 54321 REST API, 54323 Dashboard)
- **Stack:** React Hook Form + TanStack Query + ra-core (react-admin headless)
- **Path aliases:** `@/components`, `@/lib`, `@/hooks`
- **Schema:** `supabase/schemas/` (declarative source) + `supabase/migrations/` (auto-gen)
- **Komendy:** `make install` / `make start` / `make test` / `make typecheck` / `make lint` / `make build`
- **Skille:** `backend-dev` (RLS/triggers/edge functions) + `frontend-dev` (komponenty/formy/listy)

### CRM-ALINA (Insurance Master CRM)
- **Stack:** React + Vite + Gemini AI (local-first dla agenta ubezpieczeniowego Aliny)
- **Pliki:** `MASTER_MANUAL.md`, `MIGRATION_PLAN_V2.md`, `AI_ARCHITECT_WARNING.md`, `ANALYSIS_ARCH_LOG.md`
- **Brak `.git`** (subfolder, nie osobne repo)
- **Sekrety:** `CRM_ALINA_*` w rrv (`CRM_ALINA_SB_*`, `CRM_ALINA_SUPABASE_*`)

---

## 🔵 WSPÓŁDZIELONE

- **MCP claude_ai_Supabase** — osobny projekt Supabase (CRM-Alina), nie nasz brain workspace
- **MCP RedRoad-Hostido** — deploy CRM-Atomic na FTP (Hostido) — **⚠️ 2026-05-17 AUDIT: hasło FTP w git history od 19.04, rotacja wymagana!**
- **MCP CONSIS-MCP** — `list_tasks(project_ref="crm-alina")`, `recall_memory`
- **MCP RedRoad-Calendar** — eventy Aliny (klientów ubezpieczeniowych)

---

## 🚨 OBOWIĄZKI per sesja (od 2026-05-17)

1. **Pierwsze 3 ruchy:** `start_session.py` → `make start` (CRM-Atomic local stack) → `list_tasks(project_ref="crm-alina")`
2. **Drift check przed commit:** `--scope crm-alina --include-skills --fix`
3. **Watchdog 8-min** — po Write/Edit `.py` PostToolUse
4. **Schema changes:** edit `supabase/schemas/` PIERWSZE, potem `npx supabase db diff --local -f <name>` (NIE edit raw migrations)
5. **Path aliases:** używaj `@/components` (tsconfig.json) zamiast względnych `../../`
6. **Mutable deps:** `src/components/admin/` i `src/components/ui/` MOŻNA edytować direct

---

## 📊 Stan (snapshot 2026-05-17)

| Element | Stan |
|---|---:|
| Brain pending (`crm-alina`) | ~20 |
| CRM-Atomic LOC | ~15 000 (`src/components/atomic-crm`) |
| Feature branch | `schema-refactor-vehicles-insured-2026-05-14` (37+ commitów, NIE w main!) |
| StatusEye PassphraseGate | P3 fix pending (Faza 2 audit) |

## 🌅 NEXT STEPS

1. **🚨 Hostido FTP password rotation** + `git filter-repo` na 2 repo (P0 SECURITY)
2. **Merge feature branch** `schema-refactor-vehicles-insured-2026-05-14` → main (37+ commitów wisi)
3. **CRM-Alina MIGRATION_STATUS.md** → DEPRECATED notice (Faza 2 audit task)
4. **StatusEye PassphraseGate fix** (Faza 2 audit, P3)

---

*Konwencja AGENT_<NAZWA>.md per `<repo>/.agent/`. Inne role: AGENT_REDROAD_DROGOWIEC ✅, AGENT_BIURO ✅, AGENT_KSIEGOWA ✅, AGENT_OCR ✅, AGENT_DEV — TODO.*
