---
name: crm-atomic-typecheck-validation
description: How to validate TypeScript in CRM-Atomic — `npx tsc` is a no-op (root config files:[]); real check is tsconfig.app.json with a large pre-existing error baseline, so diff don't trust absolute EXIT.
metadata:
  type: feedback
---

W CRM-Atomic `npx tsc` (root `tsconfig.json`) NIE sprawdza niczego i zawsze daje EXIT 0.

**Why:** root `tsconfig.json` ma `"files": []` + `references` do `tsconfig.app.json`/`tsconfig.node.json`. Plain `tsc` (bez `-b`) kompiluje tylko pliki root projektu = zero. Build script `"tsc && vite build"` przepuszcza więc błędy typów (vite/esbuild nie typecheckuje). Realny typecheck: `npx tsc --noEmit --project tsconfig.app.json` (= npm script `typecheck`).

**How to apply:** przy walidacji zmian w tym repo NIE polegaj na `npx tsc` EXIT 0 — to fałszywy zielony. Uruchom `tsc --noEmit -p tsconfig.app.json`, ale ma on **duży pre-existing baseline** (~414 błędów 2026-07-25, głównie `noUnusedLocals` TS6133 + `Object is possibly null` w legacy-v1 i providers/supabase). Nie da się dojść do absolutnego EXIT 0. Poprawna metoda: zrzuć baseline PRZED zmianą, po zmianie policz total + zdiffuj — Twój cel to **zero NOWYCH błędów** (total niezmieniony, plik docelowy czysty), a nie EXIT 0. `noUnusedLocals`/`noUnusedParameters` są ON → nowe pliki muszą mieć zero nieużywanych importów/zmiennych. JSX = react-jsx transform → NIE importuj `React` (inaczej TS6133).
