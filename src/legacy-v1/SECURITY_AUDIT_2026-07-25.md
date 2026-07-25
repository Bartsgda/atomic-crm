# AUDYT BEZPIECZEŃSTWA — warstwa AI + dokumenty (CRM-ALINA)

**Data:** 2026-07-25
**Zakres:** `src/legacy-v1/*` (klucze/DEK, tokenizacja RODO, kanały AI Gemini, dokumenty, blokada hasła, tryb testowy) + `supabase/migrations/*` + `vite.config.ts` + `scripts/*`
**Charakter:** aplikacja produkcyjna dla biura ubezpieczeniowego — PESEL, polisy, dane wrażliwe ~106 klientów (w tym ankiety medyczne ŻYCIE = dane szczególnej kategorii RODO art. 9).
**Metoda:** przegląd kodu + śledzenie przepływu danych do Google Gemini + weryfikacja RLS + analiza budowania bundla.
**Uwaga:** to jest ANALIZA. Żaden kod nie został zmieniony.

---

## STATUS NAPRAW (2026-07-25, po decyzjach Bartka)

**✅ Naprawione:**
- **K3+W3** (footgun buildu): `vite.config.ts` (root + legacy-v1) nie inline'uje już klucza Gemini (stała `""` zamiast `process.env.GEMINI_API_KEY`); `ftp_deploy.py` czyści env buildu z sekretów (GEMINI/AISTUDIO/CRM_ALINA/service_role) i **nie przekazuje `VITE_SB_SECRET_KEY`** (service_role) do frontu.
- **S1+W1** (tokenizer): walidacja sumy kontrolnej PESEL (telefon `48…` nie łapany jako PESEL), indeksowane tokeny per wystąpienie, sanityzacja tel/e-mail/kodów w notatkach.
- **S2** (chatService): re-tokenizacja `history` przed wysłaniem do modelu (helper `detokenize`).
- **S5** (apiKeyStore): `get('ocr')` bez fallbacku do klucza `main` (twardy `null`).
- **S4** (Dokumenty): limit 20 MB, whitelist MIME + twarde odrzucenie SVG, `sandbox="allow-same-origin"` na iframe PDF.
- **N5** (docstring `set_ai_key.mjs`).
- **K1 częściowo**: docstring `supabaseStorage.ts` sprostowany (deklarował fałszywie szyfrowanie notatek). Samo szyfrowanie NIE wdrożone — patrz decyzja niżej.

**🟡 Decyzja Bartka (świadomie zaakceptowane ryzyko RODO):**
- **K1** (szyfrowanie `content`/`life_details`): **ODŁOŻONE**. W bazie znikomo danych medycznych; granica = RLS Supabase. Wrócić gdy dojdą ankiety ŻYCIE.
- **K2** (OCR chmurowy do Gemini): **DOPUSZCZONE**. Uzasadnienie: skany i tak są na Google Drive agentów; płatny (paid-tier) klucz API Gemini = brak trenowania na danych; API lepsze niż wklejanie do losowej strony/czatu.
- **W2** (surowe PII w Karateka/ClientAgent/fetchCompanyData): nie priorytetyzowane teraz. Tokenizacja czatu (`chatService`) zostaje jako defense-in-depth.

**⏳ Do rozważenia później:** W4 (CSP, TTL sesji Supabase, wymóg silnego hasła), W2 (ograniczenie payloadów fetchCompanyData → tylko NIP).

---

## Podsumowanie liczbowe

| Severity | Liczba |
|---|---|
| KRYTYCZNY | 3 |
| WYSOKI | 4 |
| ŚREDNI | 5 |
| NISKI | 5 |
| **RAZEM** | **17** |

**Werdykt ogólny:** fundament kryptograficzny (envelope AES-256-GCM + PBKDF2 600k, per-user wrapped DEK, server-side lockout z poprawnym RLS, auto-lock idle/suspend/bfcache) jest **dobrze zaprojektowany**. Natomiast **obietnice RODO nie są dotrzymane w praktyce**: (a) treść notatek i dane life/health leżą w bazie plaintext mimo deklaracji szyfrowania; (b) tokenizacja PII chroni tylko 1 z 6 kanałów AI i to niepodłączony; (c) budowanie bundla ma latentny footgun na wyciek klucza Gemini i service_role. To NIE jest gotowe na produkcję z realnym PII bez naprawy TOP-5.

---

## KRYTYCZNY

### K1. Treść notatek (i dane life/health) przechowywane PLAINTEXT w bazie — sprzeczność z deklaracją szyfrowania

- **Plik:** `services/supabaseStorage.ts:249` (`noteToRow` → `content: n.content || null`), odczyt `:268` (`rowToNote` → `content: r.content ?? ''`), pola polisy `:191` (`auto_details`), `:194` (`life_details`), `:195` (`travel_details`) — wszystkie plaintext.
- **Dowód sprzeczności:** docstring pliku `supabaseStorage.ts:3-6` twierdzi „Szyfrowane są TYLKO wrażliwe pola (…**treść notatek**)", ale komentarz `:124` mówi „Plaintext: … **notatki**", a KOD faktycznie NIE szyfruje `content` (brak `encStr`). Trzy źródła, dwie wersje prawdy — realne zachowanie = plaintext.
- **Dlaczego to krytyczne:** notatki to najwrażliwszy wolny tekst w aplikacji — uwagi do polis OC/AC, dane o szkodach, telefony, uwagi o kliencie. `life_details` może zawierać odpowiedzi z **ankiety medycznej** (checklist ŻYCIE `:335` „Ankieta Medyczna") = dane o zdrowiu (RODO art. 9). Wszystko to jest w Supabase jawnie.
- **Scenariusz wycieku:** wyciek/kompromitacja service_role, luka RLS, dostęp providera hostingu, błędny snapshot/backup, SQL na złym schemacie → czytelnik widzi pełną treść notatek i dane medyczne **bez potrzeby DEK/hasła**. Cały mechanizm PassphraseGate/DEK jest omijany, bo te pola nigdy nie były szyfrowane.
- **Rekomendacja:** zaszyfrować `content` (i `life_details`, potencjalnie `auto_details/travel_details` jeśli trzymają PII) DEK-iem, tak jak `pesel_encrypted`/`home_details`. Jeśli notatki muszą być przeszukiwalne — rozważyć oddzielny zaszyfrowany indeks/HMAC, nie plaintext. Ujednolicić docstring z faktycznym zachowaniem.

### K2. OCR wysyła cały obraz dokumentu tożsamości (PESEL, zdjęcie, adres) do Google Gemini bez anonimizacji

- **Plik:** `services/ocrService.ts:45-65` (`processDocument`), `:56-60` (`inlineData` = surowy base64 obrazu), prompt `:5-43` żąda ekstrakcji PESEL/imienia/adresu.
- **Charakter:** SYSTEM_PROMPT wprost obsługuje „dowód osobisty" i wyciąga `pesel`, `street`, `city`, `zipCode`. Do Google leci **cały skan** — a więc PESEL, zdjęcie twarzy, podpis, adres, nr polisy. Obraz z natury nietokenizowalny.
- **Status:** zbudowane, ale **jeszcze niepodłączone do UI** (grep: brak konsumenta `processDocument`; `DocumentCenter.tsx:193` ma tylko TODO OCR). Ryzyko latentne, ale kanał gotowy do włączenia jednym importem.
- **Scenariusz wycieku:** Alina wrzuca skan dowodu → pełny obraz PII i danych biometrycznych (twarz) trafia do Google. Brak umowy powierzenia (DPA) / brak kontroli retencji po stronie Google = niezgodność RODO dla danych szczególnej kategorii.
- **Rekomendacja:** przed włączeniem OCR podjąć świadomą decyzję prawną (DPA z Google, zgoda klienta, retencja). Rozważyć OCR lokalny/on-prem (Surya/Gemma lokalnie — infrastruktura RedRoad już to ma) zamiast chmurowego Gemini dla dokumentów tożsamości. Minimum: jawny banner „skan wychodzi do Google" + wyłączalność.

### K3. Klucz Gemini może zostać wbudowany w publiczny bundle przez `vite define` + `os.environ.copy()`

- **Pliki:** `vite.config.ts:43-44` (`"process.env.API_KEY": JSON.stringify(process.env.GEMINI_API_KEY || "")`), bliźniaczo `src/legacy-v1/vite.config.ts:16-17`; deploy `scripts/ftp_deploy.py:46` (`env = os.environ.copy()` — build **dziedziczy całe środowisko**).
- **Mechanizm:** `ftp_deploy.build()` kopiuje `os.environ`, więc jeśli w sesji deployującej (rr-claude wstrzykuje ~36 sekretów z vault) istnieje zmienna `GEMINI_API_KEY`, to `vite define` zamieni `process.env.API_KEY` na **literał klucza w JS** → publicznie czytelny w źródłach strony. Komentarz `ftp_deploy.py:40` twierdzi „klucz Gemini NIE trafia do buildu" — ale to prawda **tylko jeśli** zmiennej akurat nie ma. Zabezpieczeniem jest „licz, że nikt nie ustawił `GEMINI_API_KEY`", nie kod.
- **Scenariusz wycieku:** ktoś (inny tool, CI, przyszła zmiana vaulta na dokładną nazwę `GEMINI_API_KEY`) ustawia tę zmienną → następny `python scripts/ftp_deploy.py` cicho wypala klucz do bundla na `redroad.pl/alina/` → skradziony przez dowolnego odwiedzającego, obciąża konto/limit, potencjalny dostęp do innych projektów tego klucza.
- **Rekomendacja:** usunąć inlining klucza z `vite define` całkowicie (architektura i tak ładuje klucz z `tenant_config` po passphrase — `process.env.API_KEY` to tylko fallback dev). Zamiast dziedziczyć `os.environ`, budować z jawnej allowlisty zmiennych (bez `GEMINI_API_KEY`). Dodać do CI/preflight grep na `AIza` w `dist/` po buildzie.

---

## WYSOKI

### W1. `piiTokenizer` nieszczelny dla treści notatek — maskuje tylko PESEL, przepuszcza telefony/adresy/nazwiska osób trzecich

- **Plik:** `services/piiTokenizer.ts:23` (`PESEL_RE = /\b\d{11}\b/g`), `:111` (`n.content.replace(PESEL_RE, ...)` — jedyna sanityzacja notatki).
- **Luka:** notatka to wolny tekst. Sanityzowany jest wyłącznie 11-cyfrowy PESEL. **Telefony (9 cyfr), adresy, e-maile, imiona/nazwiska osób trzecich** (np. „oddzwonić do żony Anny Nowak, 601-202-303, ul. Kwiatowa 5") lecą do Google **surowo** wewnątrz `context`.
- **Status:** dotyczy `chatService` (jedyny kanał z tokenizacją), który jest **jeszcze niepodłączony** (`AI_ASSISTANT_ARCHITECTURE.md:161`), ale to fundament reklamowany jako „RODO-szczelny".
- **Scenariusz:** po podłączeniu czatu o kliencie — każda notatka z numerem telefonu / danymi osoby trzeciej = wyciek tych danych do Google, mimo że nazwisko głównego klienta jest ładnie stokenizowane. Fałszywe poczucie szczelności.
- **Rekomendacja:** rozszerzyć sanityzację notatek o telefony (PL: `\+?48?\s?\d{3}[\s-]?\d{3}[\s-]?\d{3}`), e-maile, kody pocztowe; albo — bezpieczniej — traktować całą treść notatki jako nietokenizowalny wolny tekst i NIE wysyłać jej surowo, tylko po ręcznej akceptacji/streszczeniu. Nie polegać na jednym regexie PESEL jako „zgodności RODO".

### W2. Aktywne kanały AI wysyłają surowe PII/dane firmowe do Google bez tokenizacji

- **Pliki / przepływy (potwierdzone grepem call-site):**
  - `services/geminiService.ts:47-95` `fetchCompanyData` — wywoływane z `components/ClientFormModal.tsx:247`. Wysyła **NIP, nazwę, KRS** klienta do Gemini **z `googleSearch` grounding** (`:70`) → dane firmowe klienta trafiają dodatkowo do wyszukiwarki Google.
  - `services/geminiService.ts:6-45` `parseNaturalLanguage` — z `components/NLPBar.tsx:20`. Surowa fraza użytkowniczki (`:18` wklejona do promptu) — może zawierać PII.
  - `ai/KaratekaService.ts:25-59` `generateExecutionPlan` — z `components/GlobalAgent/AgentKaratekaWindow.tsx:112`. `userMessage` wklejany surowo (`:54`). Kontekst ograniczony do `{id}` klienta (dobrze — `AgentKaratekaWindow.tsx:105-109`), ale treść polecenia niekontrolowana.
  - `ai/agents/ClientAgent.ts:15-78` `parseClientCommand` — luźny tekst z **pełnym PII** (`:22`), schema odpowiedzi zawiera `pesel` (`:50`). Status: zbudowane, brak call-site (latentne).
- **Kluczowy błąd rozumowania w architekturze:** `AI_ASSISTANT_ARCHITECTURE.md:147` twierdzi, że `ClientAgent` chroni PESEL „system-promptem" (PRIME DIRECTIVE „nie przetwarzaj PESEL"). To **nie działa** — instrukcja dla modelu nie zapobiega **transmisji** PESEL do Google; PII jest już w payloadzie żądania, zanim model cokolwiek „zignoruje". Wyciek następuje przy wysłaniu, nie przy przetwarzaniu.
- **Scenariusz:** dodanie klienta przez „luźny tekst" lub wyszukanie firmy → imię/nazwisko/telefon/NIP klienta w logach Google.
- **Rekomendacja:** dla `fetchCompanyData` — wysyłać wyłącznie NIP (nie nazwę+adres) i rozważyć oficjalne API GUS/CEIDG zamiast Gemini+googleSearch. Dla wprowadzania danych — parsować lokalnie/regexami zamiast wysyłać surowy tekst z PII do chmury. Przestać traktować „system prompt" jako zabezpieczenie transmisji.

### W3. `VITE_SB_SECRET_KEY` (service_role) przekazywany do buildu frontendu z prefiksem `VITE_` — latentny footgun katastroficzny

- **Plik:** `scripts/ftp_deploy.py:49` (`"VITE_SB_SECRET_KEY": sb_sec` w env buildu). Definicja w `.env.alina.prod` / `.env.alina.test` (`<rrv:...>`).
- **Ryzyko:** Vite eksponuje do `import.meta.env` **każdą** zmienną z prefiksem `VITE_`. Obecnie nic w FE się do niej nie odwołuje (grep: `import.meta.env.VITE_SB_SECRET_KEY` nieużywane — dziś bezpieczne). Ale wystarczy jeden `console.log(import.meta.env)` albo pojedyncze użycie tej zmiennej, żeby **klucz service_role trafił do publicznego bundla** = pełny bypass RLS, odczyt/zapis danych wszystkich klientów i tenantów.
- **Dodatkowo:** frontend **w ogóle nie potrzebuje** service_role (używa `VITE_SB_PUBLISHABLE_KEY`). Przekazywanie go do buildu jest zbędne.
- **Scenariusz:** przyszła zmiana (debug, nowy feature, AI-generated kod) odwołuje się do `import.meta.env.VITE_SB_SECRET_KEY` → deploy → service_role publiczny.
- **Rekomendacja:** NIE przekazywać `VITE_SB_SECRET_KEY` do buildu FE (usunąć z `ftp_deploy.py:49`). Jeśli backend/skrypty go potrzebują — nazwać BEZ prefiksu `VITE_` (np. `SB_SECRET_KEY`). Dodać lint/grep blokujący `import.meta.env.VITE_*SECRET*`.

### W4. Powierzchnia XSS: klucz AI + DEK + odszyfrowane PII w pamięci JS, refresh token w localStorage (~rok), brak ochrony przed offline brute-force wrapped_dek

- **Pliki:** `services/apiKeyStore.ts:44` (`_config` klucz w module-level var), `:59` (`get()`); DEK w `services/supabaseStorage.ts:347` (`private dek`); sesja `supabaseStorage.ts:370` (`getSessionExpiry` = +365 dni), `providers/supabase/supabase.ts` (klienci bez `persistSession:false` — `:41-44` komentarz świadomie to utrzymuje). Brak CSP (bundle self-hosted na `redroad.pl/alina/`).
- **Luka:** przy odblokowanej sesji w pamięci JS jednocześnie żyją: klucz Gemini, DEK (odblokowuje całe PII), token Supabase. **Jeden XSS** (np. przez zależność, wstrzyknięty content) = exfiltracja wszystkiego. Refresh token w localStorage jest długożyciowy.
- **Offline brute-force:** blokada `passphrase_lockouts` chroni tylko przepływ UI. Każdy zalogowany user może pobrać **swój** `wrapped_dek` (RLS `tenant_keys_sel_own` na to pozwala — `20260420000003_tenant_keys.sql:50-55`) i łamać hasło **offline** bez żadnego limitu prób. DEK jest wspólny dla tenanta, więc słabe hasło aplikacji = pełne PII. PBKDF2 600k spowalnia, ale nie zatrzymuje słabego hasła.
- **Scenariusz:** kradzież refresh tokenu (XSS/malware) → atakujący pobiera `wrapped_dek` → offline łamie hasło (brak lockoutu offline) → DEK → deszyfruje wszystkich klientów.
- **Rekomendacja:** dodać CSP (`default-src 'self'`, brak inline-script), rozważyć `sessionStorage`/krótszy TTL sesji, wymusić silne hasło aplikacji (min. długość/entropia), podnieść iteracje PBKDF2 dla nowych kluczy, auto-audyt zależności (`npm audit`). Świadomość: server-side lockout ≠ ochrona offline.

---

## ŚREDNI

### S1. Kolizja tokenów PESEL w notatkach → błędne dane / podstawienie cudzego PESELu

- **Plik:** `services/piiTokenizer.ts:111-113`. Wszystkie 11-cyfrowe ciągi w notatkach mapowane na **jeden** token `<PESEL:${cid}>` → `map[<PESEL:cid>] = client.pesel`. `rehydrate` (`:126-133`) podstawia PESEL klienta w każde wystąpienie tokenu.
- **Skutki:** (a) telefon z prefiksem kraju `48601202303` (11 cyfr) zostanie potraktowany jak PESEL i zamaskowany, a przy rehydrate zamieniony na PESEL klienta = błędne dane; (b) jeśli w notatce jest PESEL **innej osoby** (współmałżonek, dziecko), zostanie na wyjściu podmieniony na PESEL głównego klienta = wyciek/przekłamanie danych; (c) gdy `client.pesel` puste — token nie trafia do mapy i zostaje dosłownie `<PESEL:c1>` w odpowiedzi.
- **Rekomendacja:** tokenizować każde znalezione wystąpienie osobnym, indeksowanym tokenem (`<PESEL:cid:0>`, `:1`…) z odrębną wartością w mapie; walidować sumę kontrolną PESEL, żeby nie łapać telefonów/numerów polis.

### S2. Rehydrate → historia → z powrotem do modelu: przeciek prawdziwego PII przy kolejnych turach czatu

- **Plik:** `services/chatService.ts:102-105` (`askAboutClient` przekazuje `history` do modelu), `run()` `:75-79` (wysyła `contents` = historia verbatim).
- **Luka projektowa:** metoda zwraca odpowiedź **po rehydrate** (z prawdziwym PII). Jeśli UI (jeszcze niezbudowane) zapisze tę odpowiedź w `history` i poda ją do następnego `askAboutClient`, to **prawdziwe dane osobowe wrócą do Google** w kolejnym turze. `run` nie re-tokenizuje historii.
- **Rekomendacja:** przechowywać w historii wersję **stokenizowaną** (przed rehydrate) i rehydratować tylko do wyświetlenia; albo re-tokenizować historię przed wysłaniem. Udokumentować to jako twardy wymóg zanim ktoś podłączy `chatService` do UI.

### S3. Tryb testowy: sandbox = pełna kopia realnego PII, RLS schematu `test` niezweryfikowane

- **Pliki:** `providers/supabase/supabase.ts:74` (`switchSchema`), `components/TestModeBanner.tsx:39,53` (przełącznik dostępny dla każdego), komentarz `TestModeBanner.tsx:14-16` („pełną kopię-piaskownicę", ten sam DEK).
- **Luka:** przełączanie schematu = `localStorage` + reload (klient decyduje). Sandbox `test` to **druga kopia realnego PII** deszyfrowana tym samym DEK. Polityki RLS w migracjach tworzone są **wyłącznie na `public`** (`20260418_insurance_extension.sql:205-219`) — nie ma dowodu, że schemat `test` ma równoważne RLS. Jeśli sandbox powstał przez klon bez RLS → dane test mogą być szerzej dostępne.
- **Scenariusz:** podwojona powierzchnia ataku; jeśli RLS na `test` jest słabsze — odczyt PII przez `test`. Dodatkowo bug/atak może przełączyć `public`→`test` (kod ostrzega, ale `switchSchema('public'/'test')` jest wywoływalne wprost).
- **Rekomendacja:** zweryfikować, że tabele schematu `test` mają RLS włączone i polityki identyczne z `public`; rozważyć, czy sandbox musi zawierać realne PII (RODO — minimalizacja; lepiej dane syntetyczne/zmaskowane). Ograniczyć przełącznik trybu do admina.

### S4. Centrum Dokumentów: brak limitu rozmiaru, podgląd PDF w `<iframe>`, SVG przechodzi walidację typu

- **Pliki:** `components/Documents/DocumentCenter.tsx:121-201` (`handleFiles` — brak limitu rozmiaru), `:157` (`file.type.startsWith("image/")` — łapie też `image/svg+xml` mimo że `DropZone.tsx:10` ACCEPT go nie wymienia; drag-drop omija ACCEPT), podgląd PDF `:507-511` (`<iframe src={pdfUrl}>`).
- **Ryzyka:** (a) brak limitu rozmiaru → duży plik zapycha pamięć (object-URL, canvas resize) = DoS karty; (b) PDF renderowany w iframe z blob-URL — w starszych/niestandardowych przeglądarkach PDF z JS/annotacjami może wykonać skrypt (nowoczesny PDFium domyślnie blokuje, ale to zależy od przeglądarki klienta); (c) SVG przechodzi `startsWith("image/")` → jest jednak **rasteryzowany do JPEG** w `imageProcessing.ts` (`<img>`/`createImageBitmap` nie wykonują skryptów SVG) → realny XSS zmitygowany, ale walidacja typu jest nieszczelna z zasady.
- **Uwaga pozytywna:** object-URL-e sprzątane poprawnie przy unmount/remove/rotate (`DocumentCenter.tsx:72-79, 216, 233-239`). Pliki na razie NIE są uploadowane (TODO `:153,192`) — brak ekspozycji at-rest dziś.
- **Rekomendacja:** dodać twardy limit rozmiaru (np. 15-20 MB) i whitelistę MIME po stronie `handleFiles` (nie tylko `startsWith`), jawnie odrzucać `image/svg+xml`. Dla PDF rozważyć `sandbox` na iframe lub render przez pdf.js zamiast natywnego pluginu. Przy przyszłym uploadzie: bucket per-klient + RLS + szyfrowanie.

### S5. Fallback klucza OCR do klucza „main" — mieszanie przeznaczeń i limitów

- **Plik:** `services/apiKeyStore.ts:59-76` (`get('ocr')` gdy brak wpisu `ocr` → „pierwszy dostępny" → potem `process.env.API_KEY`).
- **Skutek:** OCR (skany dowodów) może po cichu użyć klucza `main`, mieszając limity/rozliczenia i wysyłając dokumenty tożsamości kluczem nieprzeznaczonym do tego. Utrudnia rozdział/rotację i audyt „co poszło którym kluczem".
- **Rekomendacja:** dla `purpose='ocr'` nie stosować fallbacku do innego klucza — brak klucza OCR = twardy `null` + komunikat „skonfiguruj klucz OCR".

---

## NISKI

### N1. `.env.development.local` trzyma `VITE_SB_SECRET_KEY` w plaintext na dysku
- **Plik:** `.env.development.local` (wartość `sb_sec...` jawnie, nie `<rrv:>`). Plik jest w `.gitignore:23` (NIE w repo — pozostałe `.env.*` używają `<rrv:...>`), więc to kwestia higieny lokalnej, nie wycieku do gita. **Rekomendacja:** i tu użyć `<rrv:>` + `switch_env.ps1`, nie trzymać service_role plaintext lokalnie.

### N2. Hardcoded project-ref URL w skryptach
- **Pliki:** `scripts/set_ai_key.mjs:23`, `scripts/unlock_passphrase.mjs:14` (`https://xqznrssrlnxqkdvisnck.supabase.co`). To nie sekret (URL publiczny), ale identyfikuje projekt prod. **Rekomendacja:** brać wyłącznie z env, bez fallbacku hardcode.

### N3. `console.warn(" SECURITY ALERT: … Sprawdź konfigurację .env")` w geminiService
- **Plik:** `services/geminiService.ts:8` (i podobnie `ocrService.ts:47`). Szum w konsoli, sugeruje ścieżkę konfiguracji; nie ujawnia sekretu. **Rekomendacja:** ściszyć/usunąć w prod.

### N4. `getSessionExpiry` zwraca sztywne +365 dni
- **Plik:** `services/supabaseStorage.ts:370`. Reliktowe długie „wygaśnięcie" (część problemu W4 z długim tokenem). Auto-lock idle/suspend/bfcache w `EncryptionGate.tsx:19-84` mityguje UI, ale token Supabase i tak długożyciowy. **Rekomendacja:** skrócić realny TTL sesji Supabase.

### N5. `set_ai_key.mjs` — docstring mówi `encrypted_api_key`, kod pisze `encrypted_ai_config`
- **Plik:** `scripts/set_ai_key.mjs:7` (docstring) vs `:180` (body `encrypted_ai_config`). Kod poprawny (zgodny z migracją `20260725000001`), docstring nieaktualny. Skrypt **nie loguje** klucza (dobrze — klucz z env, `:107-109`). **Rekomendacja:** poprawić docstring.

---

## Elementy poprawne (żeby nie psuć tego, co działa)

- Envelope encryption solidny: AES-256-GCM, IV per operacja, PBKDF2-SHA256 600k, per-user wrapped DEK, wspólny DEK tenanta (`crypto.ts`, `tenant_keys` migracja).
- Server-side lockout z **poprawnym RLS**: user nie ma INSERT/UPDATE na `passphrase_lockouts` (`20260723000001:148-155`), zapis tylko przez RPC `SECURITY DEFINER` z `set search_path=''`; eskalacja 3/6/9 poprawna. F5 nie resetuje licznika (przepływ UI).
- RLS helpers `current_tenant_id()`/`is_insurance_admin()` czytają z `public.sales` po `auth.uid()` (`20260418:196-203`) — **nie da się ich sfałszować z klienta**. `tenant_config` szyfrowany DEK, więc szeroki SELECT nie ujawnia klucza bez hasła.
- Auto-lock: idle 30 min + suspend >5 min + bfcache (`EncryptionGate.tsx`), `apiKeyStore.clear()` + `setDEK(null)` na lock/logout/wylogowanie (`:32-36, 100-122`).
- Object-URL cleanup w Documents; `.env.*` (poza local) używają `<rrv:>`; `set_ai_key.mjs` nie loguje sekretów; `sourcemap:false` w prod buildzie.

---

## RANKING TOP RYZYK (do naprawy w tej kolejności)

1. **K1 — notatki + dane life/health plaintext w bazie** (`supabaseStorage.ts:249`): najwrażliwsze dane (uwagi OC/AC, ankiety medyczne) leżą jawnie mimo deklaracji szyfrowania. Największa realna ekspozycja at-rest. Naprawa: szyfrować `content`/`life_details` DEK-iem.
2. **K3 + W3 — footguny buildu (klucz Gemini + service_role przez `VITE_`)** (`vite.config.ts:43`, `ftp_deploy.py:46,49`): jeden nietrafiony `env` albo jedno odwołanie do `import.meta.env.VITE_SB_SECRET_KEY` = publiczny sekret. Naprawa: usunąć inlining klucza, nie przekazywać service_role do FE, allowlista env w deployu, grep `AIza`/secret w `dist/`.
3. **K2 + W2 — surowe PII do Google** (OCR `ocrService.ts:56` + `fetchCompanyData`/`ClientAgent`): pełne skany dowodów i dane firmowe klienta do chmury Google bez anonimizacji/DPA; „system prompt" NIE jest zabezpieczeniem transmisji. Naprawa: OCR lokalny lub DPA+zgoda, ograniczyć payloady, nie ufać instrukcjom modelu jako granicy RODO.

---

*Audyt wykonany read-only. Rekomendacje wymagają decyzji Bartka + realizacji przez `--dev`/`--crm` po `REGULY_ZMIAN.md`. Kod nie był modyfikowany.*
