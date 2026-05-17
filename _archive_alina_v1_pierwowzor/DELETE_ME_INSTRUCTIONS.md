
# 🗑️ LISTA PLIKÓW DO USUNIĘCIA (CLEANUP TASK)

Poniższe pliki są reliktami starej architektury lub zostały zastąpione nowszymi wersjami. Należy je bezpiecznie usunąć, aby zachować higienę projektu.

1.  `crm-pro/components/PolicyWindowHost.tsx` (Zastąpiony przez `PolicyFormModal.tsx`)
2.  `crm-pro/components/Insurers/InsurersView.tsx` (Zastąpiony przez `TowarzystwaView.tsx`)
3.  `FAILURE_REPORT.md` (Nieaktualny)
4.  `ANALYSIS_ARCH_LOG.md` (Rozwiązany)
5.  `REPAIR_PLAN.md` (Wykonany)
6.  Wszelkie pliki `*.ts` / `*.tsx` w katalogu głównym (ROOT) **POZA** `index.tsx` (który jest mostem) i plikami konfiguracyjnymi (`vite.config.ts`, `package.json`, `tsconfig.json`).

**UWAGA:** Nie usuwaj `crm-pro/towarzystwa.ts` - to jest teraz źródło prawdy dla listy ubezpieczycieli.
