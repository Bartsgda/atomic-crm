# CLAUDE.md — CRM-Atomic

> **Router AI dla `rr-claude --crm` / `rr-claude --alina`**. Hub agentowy: [`../CONSIS BartsGda/`](../CONSIS%20BartsGda/) — zasady ogólne, mapa MCP, vault, hooks.
>
> **Hierarchia:** CONSIS = nadrzędny hub · **CRM-Atomic** = repo (framework atomic-crm fork, ~15k LOC) · **"Alina"** = alias deployu produkcyjnego na Hostido (insurance feedback) — NIE osobne repo (vault `CRM_ALINA_*`, project_ref `crm-alina`).

## Kim jesteś

Deweloper CRM RedRoad — modyfikujesz atomic-crm framework lokalnie i deploy'ujesz na produkcję dla **Aliny** (klient Bartka, biuro ubezpieczeniowe). Stack: React 19 + TypeScript + Vite + Supabase. Default `rr-claude --crm` = Sonnet 4.6 z `--no-pull` flag (sync ręczny). `--alina` = shortcut do `--crm --topic alina`.

## 🎯 Pierwsze 3 ruchy

1. **Twoje TODO z brain:**
   ```
   mcp__MCP-CONSIS__list_tasks(project_ref="crm-alina", status="pending")
   ```
   Albo CLI: `python C:\BartsGda4-MCP-SKILLS\CONSIS-MCP\tools\brain_cli.py list-tasks --project-ref crm-alina --status pending`

   ✅ **project_ref znormalizowane 2026-05-12** — kanon `crm-alina` (task 29162f1d DONE). `list_tasks(project_ref="crm-alina")` wystarczy (crm/crm-atomic = stare, znormalizowane).

2. **Briefing globalny:** `python C:\BartsGda4\start_session.py` (status repo, RAG context, brain.ai_tasks per project_ref dzięki `$env:RR_SESSION_SLUG`)

3. **Architektura frameworka:** `cat AGENTS.md` (upstream atomic-crm reference — `<CRM>` component, mutable deps, FakeRest vs Supabase, edge functions). Jest też w pamięci kontekstu CC przez `@AGENTS.md` na końcu tego pliku.

## 🛠️ Twoje narzędzia

| Co robisz | Narzędzie | Lokalizacja |
|---|---|---|
| **Lokalny dev** (Supabase + Vite) | `make start` | terminal |
| **Demo z FakeRest** | `make start-demo` | terminal |
| **Test + typecheck + lint** | `make test`, `make typecheck`, `make lint` | terminal |
| **Build production bundle** | `make build` (tsc + vite build) | terminal |
| **DB migration z deklaratywnego schema** | `npx supabase db diff --local -f <name>` → `migration up` | `supabase/schemas/` |
| **Push DB do remote** | `npx supabase db push` | po review migracji |
| **Deploy na Hostido (FTP)** | `mcp__RedRoad-Hostido__hostido_deploy_zip` | po `make build` + akcept Bartka |
| **Health check Hostido** | `mcp__RedRoad-Hostido__hostido_check_health` | sanity przed deployem |
| **Supabase CRM-ALINA query** | PostgREST + vault `CRM_ALINA_SB_SECRET` / `CRM_ALINA_E2E_SERVICE_ROLE` | Python httpx |
| **AI auto-reply** (insurance_feedback) | `consis_flash.call_gemini` + Supabase MCP | task brain |
| **Skill dot. CRM** | `mcp__MCP-CONSIS__get_skill(name="...")` | brain |

**MCP serwery typowe dla CRM:**
- **`RedRoad-Hostido`** (5) — deploy ZIP, FTP upload, list remote, SSH run, health check
- **`MCP-CONSIS`** — list_tasks (project_ref=crm-alina), get_skill, send_message
- **claude.ai Supabase** (33) — full CRM-ALINA project management (gdy tryb mobile/cloud)
- pełna mapa: [`../CONSIS BartsGda/AGENTS.md § MCP`](../CONSIS%20BartsGda/AGENTS.md)

## ⭐ Specyfika domeny

### Dual project: CRM-Atomic ↔ CRM-ALINA

- **CRM-Atomic** (ten folder) = atomic-crm framework fork od marblecore. Mutable deps (`src/components/admin`, `src/components/ui`). Domain-specific config przez `<CRM>` component w `App.tsx`.
- **CRM-ALINA** = ten sam codebase **deployowany na Hostido** dla Aliny (biuro ubezpieczeniowe). Production Supabase project: `xqznrssrlnxqkdvisnck`. Klienci: ~50, dane wrażliwe (uwagi pisane do polis OC/AC), **PassphraseGate + StatusEye** szyfrują listę zgłoszeń client-side.

### PassphraseGate + StatusEye (zabezpieczenia 2026-05)

- **PassphraseGate**: hasło wpisywane jednorazowo w UI → AES-GCM kluczem session storage → odszyfrowuje pole `notes` w `insurance_feedback`.
- **StatusEye widget** — bug 2026-05-04: lista uwag widoczna PRZED odszyfrowaniem (race condition). Fix: warunek `isUnlocked` przed renderem. **Status: pending (task `7bba1ffc`)**.

### insurance_feedback — kanban i AI auto-reply

- Kanban: `status='open'` (nowe od klientów) → `'in_review'` → `'resolved'`. UI `KanbanBoard` w `src/components/atomic-crm/insurance/`.
- **Cron AI** (Bartek 2026-05-05): Claude/Gemini odpowiada na otwarte zgłoszenia automatycznie zamiast manualnego `admin_reply`. Workflow: `query insurance_feedback WHERE status='open' AND admin_reply IS NULL` → generate reply → `set_feedback_admin_reply(id, reply)`. **Status: design proposal (task `6118ead1`)**.

### Mutable dependencies (atomic-crm convention)

- `src/components/admin/` — Shadcn Admin Kit (modyfikuj bezpośrednio)
- `src/components/ui/` — Shadcn UI (modyfikuj bezpośrednio)
- NIE traktuj jako node_modules — to są kopie do lokalnego customu.

### Migracje DB — schema-first

- Source of truth: `supabase/schemas/01_tables.sql`, `02_functions.sql`, `03_views.sql`, `04_triggers.sql`
- Generuj migrację: `npx supabase db diff --local -f <name>` (NIGDY ręcznie w `migrations/`)
- Functions w `02_functions.sql` MUSZĄ być w formacie `pg_dump` (run `npx supabase db dump --local --schema public`) inaczej phantom diffs.

## 🚫 Czego NIE ruszaj (krótka lista cross-tryb)

> Pełne zasady: [`../CONSIS BartsGda/ZASADY.md`](../CONSIS%20BartsGda/ZASADY.md).

1. **Sekrety CRM-ALINA** — wszystkie 5 w vault (`CRM_ALINA_SB_SECRET`, `CRM_ALINA_SB_PUBLISHABLE`, `CRM_ALINA_E2E_SERVICE_ROLE`, `CRM_ALINA_E2E_SB_PUBLISHABLE`, `CRM_ALINA_SUPABASE_URL`). NIGDY plaintext, NIGDY w `.env*` repo. Po incydencie 2026-05-04 Bartek pilnuje `gitleaks detect --no-banner` przed każdym push.
2. **Production deploy na Hostido** — TYLKO z explicit akceptem Bartka. `make build` lokalnie OK, `hostido_deploy_zip` blokowany do potwierdzenia. ~5 min downtime alina.prod (klienci czekają).
3. **Brain cross-machine** — NIE pisz `brain.messages` do MSI/REDROAD/DOM bez zgody. CRM-Alina obsługuje tylko sam siebie + brain.ai_tasks (lokalna koordynacja).
4. **Migracje DB** — NIE edytuj plików w `supabase/migrations/` ręcznie. Zawsze przez `npx supabase db diff`. Wyjątek: column rename (DROP+CREATE → ALTER TABLE RENAME) — manualnie tylko po review.
5. **Brain z Supabase keys/PAT** — task `d3f4d051` (wyprostować dostęp przez Management API + service_role w vault). Aktualnie SQL ręczny przez Bartka.
6. **TODO** — single source = `brain.ai_tasks` (project_ref=crm-alina/crm-atomic). NIE dopisuj nowych do MD — używaj `mcp__MCP-CONSIS__create_task(project_ref="crm-alina", title=..., priority=..., deadline=...)`.
7. **Sąsiednie tryby** — `../BIURO/`, `../OCR9/`, `../REDROAD_DROGOWIEC/` traktuj read-only.

## 📂 Aktywne tematy

**Pending z brain.ai_tasks (stan 2026-05-09):**
- 🔥 `7bba1ffc` StatusEye widoczne przed PassphraseGate — fix (high)
- 🔥 `e0a0c184` Kanban zgłoszeń (insurance_feedback) (high)
- `6118ead1` AI auto-reply na uwagi w insurance_feedback (normal)
- `d3f4d051` Supabase keys/PAT CRM-Alina — wyprostować dostęp (normal)
- 🔥 `64ffac70` Audyt rrv — rotacja kluczy alina prod (high)
- `07ece980` Audyt rrv — reflog purge + gitleaks verify (normal)
- `5dd43109` Deploy finalny po stabilizacji StatusEye + admin_reply (normal)
- `0e23f07f` keyboard-nav-dashboard-clientdetails (?) — sprawdź `mcp__MCP-CONSIS__list_tasks`

Zaległe weekendowe (audyt 2026-05-04 DOM 22:30): rotacja `sb_secret_*` + `sb_publishable_*` (mit "1h sekret" obalony — nadal HTTP 200), reflog purge 4 osierocone commity, sweep konwersacji Claude/Antigravity na transkryptach.

Pełna lista: `mcp__MCP-CONSIS__list_tasks(project_ref="crm-alina")`.

## 🔗 Powiązane

| Zasób | Lokalizacja |
|---|---|
| Hub agentowy | [`../CONSIS BartsGda/`](../CONSIS%20BartsGda/) |
| Zasady ogólne | [`../CONSIS BartsGda/ZASADY.md`](../CONSIS%20BartsGda/ZASADY.md) |
| Mapa MCP/skilli/vault | [`../CONSIS BartsGda/AGENTS.md`](../CONSIS%20BartsGda/AGENTS.md) |
| Mapa ścieżek per maszyna | [`../CONSIS BartsGda/.agent/MACHINE_IDENTITY.md`](../CONSIS%20BartsGda/.agent/MACHINE_IDENTITY.md) |
| Architektura atomic-crm framework | [`AGENTS.md`](AGENTS.md) — upstream reference (mutable deps, schema-first, edge functions) |
| Doc developera | [`doc/src/content/docs/developers/architecture-choices.mdx`](doc/src/content/docs/developers/architecture-choices.mdx) |
| Sąsiednie: BIURO | [`../BIURO/CLAUDE.md`](../BIURO/CLAUDE.md) — Gmail/Notion/kalendarze |
| Sąsiednie: kpir-automator | [`../kpir-automator/CLAUDE.md`](../kpir-automator/CLAUDE.md) — księgowość |

---

## ❓ Notki dla AI (meta)

- **`rr-claude --crm`** ustawia `cwd=CRM-Atomic/`, `--add-dir` na hub + MCP-SKILLS, sync pull repo.
- **`rr-claude --alina`** = `--crm --topic alina`. `$env:RR_SESSION_SLUG=alina_<YYYY-MM-DD>` (uwaga: prefix=alina, project_ref filter w start_session musi to mapować na crm-alina).
- **Production deploy alina.redroad.pl** — flow: edytuj schema/code → `make build` → `make typecheck` → `hostido_deploy_zip --target alina-prod` PO akcepcie Bartka.
- Token: `CRM_ALINA_*` w vault, sekrety zerowane co rotację (Bartek pilnuje).

@AGENTS.md

# ZASADY PRACY — CRM-Alina (OBOWIĄZKOWE)

> **AI: zanim dotkniesz `src/legacy-v1/*.tsx` lub piszesz mapper/parser/import — przeczytaj NAJPIERW [`src/legacy-v1/CLAUDE.md`](./src/legacy-v1/CLAUDE.md). Tam jest indeks 38 plików `.md` per moduł + SUPREME_RULES + anti-patterns (lekcja 2026-05-11: AI 4 razy poprawiał błędy bo zignorował te spec).**


## 1. Deploy — jedyna poprawna procedura

```
python scripts/ftp_deploy.py
```

**ZAKAZY:**
- NIE `--no-build` gdy był nowy kod — stale dist/ zgubi zmiany
- NIE Hostido MCP SSH — klucz SSH nie ma hasła w vault
- NIE deploy bez potwierdzenia użytkownika ("czy wrzucić?")
- NIE deploy bez sprawdzenia ścieżki przez `hostido_list_remote /`

**Przed każdym deployem:**
1. `mcp__RedRoad-Hostido__hostido_list_remote({ remote_path: "/" })` — potwierdź że `alina` jest w FTP root
2. Zapytaj użytkownika o zgodę
3. `python scripts/ftp_deploy.py` (pełny build)

**Struktura FTP:**
- FTP root `/` = web root `https://redroad.pl/`
- `/alina/` = `https://redroad.pl/alina/` ← tutaj wgrywa deploy
- `/public_html/alina/` = STARY/BŁĘDNY folder — ignoruj!

**Jeśli Firefox blokuje dist/ (EBUSY):**
```
# zamknij Firefox/DevTools, potem:
rm -rf dist/ && python scripts/ftp_deploy.py
```
NIGDY `--emptyOutDir false` jako workflow — STOR nie kasuje, FTP zaśmieci się starymi bundle (zdarzyło się 2026-05-10: 35 starych bundle na FTP po 4 deployach).

**ZAKAZ ad-hoc Service Worker / kill-switcha** — nie dodawać `public/sw.js` ani `<script>navigator.serviceWorker.register</script>` w `index.html`. Jeśli klient ma stary SW, hard reload (Ctrl+Shift+R) lub karta incognito to wystarczy. Każda próba "fixu" przez nowy SW miesza w localStorage Supabase Auth.

**Skansen `/public_html/alina/`** — okresowo (raz/tydzień) sprawdzaj `ftplib.mlsd('/public_html')` że jest pusty. 2026-05-10 znaleziono tam **61 plików + `unzip_helper.php` z hardcoded `crm2026`** (backdoor pattern, prawdopodobny powód flagi Safe Browsing) + `deploy_temp.zip` (2.4 MB pobieralne publicznie). Pozostałości po porzuconym workflow zip→PHP unzip. Cleanup w jednym Python skrypcie (rekurencyjny `ftp.delete` + `ftp.rmd`).

**ZAKAZ workflow zip→PHP unzip** — `ftp_deploy.py` ze STOR działa pewnie i nie zostawia plików wykonywalnych. Każdy `*_helper.php`, `*_upload.php`, `unzip_*.php` na hostingu = automat flag dla Google Safe Browsing/Sucuri/Norton.

## 2. Testowanie — zawsze przez BAT

```
START_ALINA_TEST.bat
```

NIE: `npx vite`, `npm run dev`, ani inne ręczne komendy.
BAT poprawnie ustawia env zmienne i konfigurację.

## 3. stage 'sprzedaz' vs 'sprzedaż' — ZAWSZE oba

localStorage zapisuje polisy z `stage='sprzedaz'` (bez ż). Runtime może mieć obie formy.
W każdym porównaniu stage zawsze dodawaj trzecią formę:

```ts
// POPRAWNIE:
const SOLD_STAGES = ['sprzedaż', 'sprzedany', 'sprzedaz'];
p.stage === 'sprzedaż' || p.stage === 'sprzedany' || p.stage === 'sprzedaz'

// BŁĘDNIE (pomija starszy localStorage):
p.stage === 'sprzedaż' || p.stage === 'sprzedany'
```

## 4. Dokumentacja przed kodem (SUPREME_RULES §4)

Przy każdej zmianie logiki — najpierw zaktualizuj odpowiedni `.md`:
- `src/legacy-v1/WYMAGANIA-KLIENT.md`
- `src/legacy-v1/CLIENTS_SPEC.md`
- inne `*_SPEC.md` w danym module

## 5. Changelog po każdej sesji

Dodaj wpis do `src/components/atomic-crm/alina-splash/AlinaSplash.tsx` → `CHANGELOG[]`
z datą dzisiejszą i opisem co się zmieniło (dla Aliny, nie technicznie).
