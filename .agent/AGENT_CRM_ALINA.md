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

---

## 🗺️ MAPA KOMPLET (snapshot 2026-05-17)

### 🟢 TYLKO CRM (moje foldery)

| Folder | Pliki | .py | .md | Co tam siedzi |
|---|---:|---:|---:|---|
| `.agent/` | 1 | 0 | 1 | Ten plik — mapa roli agenta |
| `.claude/` | 5 | 0 | 2 | Hooki CC, settings, skills lokalny CRM |
| `scripts/` | 47 | 26 | 1 | Narzędzia ops: ftp_deploy, backup Supabase, migrate, audit, crm-crypt — **ma `_INDEX.md`** |
| `src/` | 593 | 0 | 76 | Cały frontend React+TS+shadcn (atomic-crm ~15k LOC + legacy-v1) |
| `src/legacy-v1/` | ~72 | 0 | ~38 | Insurance Master CRM Pro — 38 spec MD + full TS stack (dataMapper, supabaseStorage, FinanceView) |
| `src/_demo_sandbox_ui/` | 6 | 0 | 1 | DesignSahara.tsx + stitch HTML prototypy UI (eksperymentalne, nie prodowe) |
| `supabase/` | 87 | 0 | 0 | Schemas (declarative) + migrations (auto-gen) + edge functions |
| `test-data/` | 3 | 0 | 0 | CSV z danymi testowymi do importu |
| `e2e/` | 4 | 0 | 0 | Playwright testy E2E |
| `_archive_scratch_2026-05-17/` | 29 | 1 | 0 | **ARCHIWUM** — jednorazowe skrypty debug/probe z sesji dev (JS/MJS/SQL/PY) |
| `_archive_sandbox_design/` | 15 | 0 | 1 | **ARCHIWUM** — stitch design HTML/PNG prototypy dashboardów Sahara |
| `_archive_sesje/` | 1 | 0 | 1 | **ARCHIWUM** — wiedza z sesji 2026-05-01 (Supabase API knowledge) |
| `ftp_backups/` | 393 | 0 | 0 | Operacyjne backupy plików przed FTP deploy (whitelist w canon, `.gitignore`) |
| `backups/` | 0 | 0 | 0 | Pusty katalog — do usunięcia przy okazji |

### 🔵 WSPÓŁDZIELONE (nie moje)

| Zasób | Skąd | Do czego |
|---|---|---|
| `brain.ai_tasks` (project_ref=crm-alina) | CONSIS / Supabase | kolejka zadań CRM |
| `mcp__RedRoad-Hostido__*` | MCP-SKILLS | FTP deploy, health check |
| `mcp__claude_ai_Supabase__*` | MCP claude.ai | CRM-ALINA remote Supabase project |
| `mcp__MCP-CONSIS__*` | CONSIS hub | tasks, memory, messaging |
| `C:\BartsGda4\tools\*.py` | workspace root | drift check, architecture scan |
| `C:\BartsGda4-MCP-SKILLS\CONSIS-SKILLS\universal\*.md` | MCP-SKILLS | skille uniwersalne |

### ⚠️ Docelowo zabrane / zreorganizowane

- `backups/` (pusty) → usunąć przy okazji
- `ftp_backups/` → whitelist w canon ✅ (operacyjne, `.gitignore`)
- `demo/` — 2 pliki, nie w kanonie CRM-Atomic — sprawdzić co tam jest

### 📊 Stan (snapshot 2026-05-17 — po porządkach)

| Metryka | Wartość |
|---|---:|
| Foldery z `.py` | 8 |
| `_INDEX.md` wygenerowane przez drift check | 8 |
| Migracje git mv wykonane | 4 |
| Linki MD naprawione | 5 |
| Architecture drift po migracji | 0 |

### 🌅 NEXT STEPS (post-inwentaryzacja)

1. **`backups/` (empty)** — usunąć pusty katalog
2. **`demo/`** — sprawdzić co tam jest, czy nie do archiwum
3. **Scripts `_recover.py` / `_recover2.py`** — dwa podobne pliki w scripts/, może dedup?
4. **FTP password rotation** — P0 SECURITY (Hostido hasło w git history od 2026-04-19)

### 🔄 Migracje wykonane dziś (2026-05-17)

| Stara ścieżka | Nowa ścieżka | Metoda | Uzasadnienie |
|---|---|---|---|
| `scratch/` | `_archive_scratch_2026-05-17/` | `git mv` | forbidden w canon (jednorazowe skrypty debug) |
| `sandbox/` | `_archive_sandbox_design/` | `git mv` | forbidden w canon (stitch design prototypy) |
| `SESJE/` | `_archive_sesje/` | `git mv` | ALL-CAPS niestandardowe, archiwum wiedzy sesji |
| `src/sandbox/` | `src/_demo_sandbox_ui/` | `git mv` | forbidden w canon (eksperymentalne UI) |
| import w `App.tsx:43` | `../_demo_sandbox_ui/DesignSahara` | Edit | fix po rename src/sandbox |
| 5 linków w MD | zaktualizowane | Edit | DOCS_TEST_ENVIRONMENT, NEXT_SESSION (×2), PROGRESS (×2) |
| `ftp_backups/` | whitelist w canon | Edit | operacyjne backupy, `.gitignore`, legalne |
