# 📦 ARCHIVE NOTE — CRM-ALINA v1 pierwowzór (2026-05-17)

> **Status:** ZARCHIWIZOWANE 2026-05-17 wieczór. Atomic CRM przejął funkcjonalność.
> **Nie używaj produkcyjnie** — to historyczny pierwowzór, czytaj jako referencja.
> **Oryginalny `README.md`** v1 w tym folderze (Insurance Master CRM Pro v4.7).

## Co przeniesione (3.9 MB z 225 MB pierwotnie)

| Folder / plik | Status |
|---|---|
| `MASTER_MANUAL.md`, `MIGRATION_PLAN_V2.md`, `REPAIR_PLAN.md`, `PROJECT_CHRONICLE.md` | Dokumentacja v1 (zachowana) |
| `crm-pro/` (1.6 MB) | Kod aplikacji v1 |
| `python/` (2.2 MB) | Python tools v1 |
| `index.html`, `index.tsx`, `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json` | Stack v1 |
| `README.md` | Oryginalny CRM-ALINA README |
| `AI_ARCHITECT_WARNING.md`, `ANALYSIS_ARCH_LOG.md`, `DELETE_ME_INSTRUCTIONS.md` | Dokumentacja procesu |

## Co usunięto z balastu (do `.trash` TTL 14d):

- `node_modules/` (**219 MB**) — odbuduj `npm install` z `package-lock.json` jeśli potrzeba
- `_ZIPS/` (1.5 MB) — backupy archeologiczne
- `DANE-POZNIEJ-USUN/` (132 KB) — Bartek sam nazwał do usunięcia

## Co USUNIĘTE 2026-05-17 (odpięcie integracji)

| Element | Lokalizacja | Akcja |
|---|---|---|
| `rr-claude --alina` mode | `rr-claude.ps1` ValidateSet | usunięte (wcześniej Bartek) |
| `MODE_PROFILES["alina"]` | `start_session.py:113-118` | usunięte 2026-05-17 |
| CRM-Alina backup mode "alina" | `start_session.py:1893` | zostaje tylko `mode == "crm"` |
| `SCOPE_ROOTS["crm-alina"]` | `tools/code_md_drift_check.py` | usunięto `CRM-ALINA` → tylko `CRM-Atomic` |
| Top-level `C:\BartsGda4\CRM-ALINA\` | git tracked w ROOT repo | fizycznie przeniesione tu, `git rm -r CRM-ALINA/` w ROOT |
| `.git` w CRM-ALINA | NIE istniał (był tracked w ROOT) | n/d |

## Jak odbudować jeśli potrzebne

```bash
cd CRM-Atomic/_archive_alina_v1_pierwowzor/
npm install         # odbuduje node_modules z package-lock
npm run dev         # uruchom v1 lokalnie
```

## 🚨 TODO: Cleanup GitHub repo (sprawdzić + zarchiwizować/usunąć)

**Bartek 2026-05-17 wieczór:** *"dopisz aby w githubie te stare CRM-ALINA czyścić"*.

Sprawdzić czy istnieją na `Bartsgda` te zdalne repo (kandydaci do archive/delete):
- `Bartsgda/CRM-ALINA`
- `Bartsgda/insurance-master-crm-pro`
- `Bartsgda/crm-alina-v1`
- inne zawierające `alina` / `insurance`

**Procedura** (Bartek manualnie, bo wymaga decyzji per repo):

```bash
# 1. Lista repo (PowerShell na maszynie z gh CLI)
gh repo list Bartsgda --limit 100 | findstr /I "crm alina insurance"

# 2. Per repo decyzja:
gh repo view Bartsgda/CRM-ALINA --json description,visibility,updatedAt
gh repo archive Bartsgda/CRM-ALINA          # ZALECANE: archive (zachowuje historię, read-only)
# LUB
gh repo delete Bartsgda/CRM-ALINA --confirm # DESTRUKTYWNE: tylko jeśli pewny

# 3. W opisie zarchiwizowanego repo dodać:
gh repo edit Bartsgda/CRM-ALINA --description "ARCHIVED 2026-05-17. Migrated to Bartsgda/BartsGda4 → CRM-Atomic/_archive_alina_v1_pierwowzor/. See _ARCHIVE_NOTE.md."
```

**Status workspace local:** ✅ usunięte z tracking ROOT repo (`git rm -r CRM-ALINA/`, commit `cf78d7f` 2026-05-17).
**Status GitHub:** ⚠️ **TODO** — sprawdzić + decyzja archive/delete.

## Powiązane

- `../CLAUDE.md` — Atomic CRM router (aktualny source of truth)
- `../AGENTS.md` — Atomic CRM agent spec
- `../.agent/AGENT_CRM_ALINA.md` — mapa roli (zaktualizowana 2026-05-17 — `--alina` usunięte)

---

*Bartek 2026-05-17 wieczór: "CRM-alina to chyba stara instancja działała była wzorcem do przerzucenia na atomic - jeżeli tak to najwyższa pora przenieść do atomic jako archive, odpiąć rr...crm alina i logikę, łącznie z odpięciem gita".*
