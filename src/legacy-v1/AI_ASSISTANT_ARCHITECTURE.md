# AI Asystent „Karateka" v3 — architektura RODO + insighty (CRM-ALINA)

> Audyt dokumentacyjny 2026-07-25 (sesja `--dev` inline). Opisuje **fundament zbudowany 2026-07-24**
> (tokenizer RODO + silnik okazji + chatService) i jak spina się z istniejącą warstwą AI (KaratekaService
> CLI-agent, ClientAgent parser wejścia, ocrService OCR, geminiService NLP-pasek). Nie zmienia kodu.

## 0. Skrót — dwie ODRĘBNE warstwy AI w CRM-Alina

Repo ma **dwa niezależne pokolenia** integracji z Gemini, które współistnieją:

1. **Stare/istniejące (przed 24.07):** `geminiService.ts` (pasek NLP, KRS/CEIDG), `KaratekaService.ts`
   (CLI-agent wykonujący akcje w systemie: nawigacja/CRUD), `ClientAgent.ts` (parser luźnego tekstu →
   struktura klienta), `ocrService.ts` (OCR skanów). **Żadne z nich nie przechodzi przez tokenizer RODO**
   opisany niżej — mają własne, odrębne zabezpieczenia (patrz § 4).
2. **Nowe (24.07, „Karateka v3"):** `piiTokenizer.ts` + `clientInsights.ts` + `chatService.ts` — fundament
   pod **czat o konkretnym kliencie** z pełnym kontekstem PII bezpiecznie tokenizowanym. **Zbudowane, ale
   jeszcze NIEPODPIĘTE do żadnego UI** (patrz § 5 — brak importów `chatService`/`topInsights` poza
   definicją).

Wspólny mianownik: wszystko woła Google Gemini **bezpośrednio z przeglądarki** przez `@google/genai`
(klucz `apiKeyStore`), **NIE** przez LiteLLM router :4000 — to świadomie równoległy setup client-side.
[[project_crm_ai_gemini_client_side]] [[kanon_router_polityka_modeli]]

---

## 1. RODO — `services/piiTokenizer.ts`

**Zasada (Bartek 2026-07-24):** dane osobowe (PII) NIGDY nie trafiają w postaci jawnej do Google Gemini.
Google widzi tokeny, Alina (użytkowniczka) widzi prawdziwe dane — podmiana zawsze po stronie przeglądarki.

### Flow
1. `buildClientContext(client, policies, notes)` → zwraca `{ context, map }`:
   - `context` — tekst opisu klienta (Markdown) z PII zastąpionym tokenami, bezpieczny do wysłania do AI.
   - `map: TokenMap` (`Record<string,string>`) — słownik token→prawdziwa wartość. **Nigdy nie opuszcza
     przeglądarki** (nie jest logowany, nie idzie do Gemini).
2. Do AI idzie `context` + `PII_SYSTEM_INSTRUCTION` (uczy model wstawiać token dosłownie, nie zgadywać).
3. `rehydrate(odpowiedźAI, map)` — **wywoływane PO odpowiedzi modelu, PRZED pokazaniem/wysłaniem** —
   podmienia każdy token na prawdziwą wartość (`text.split(token).join(value)`).

### Format tokenów
`<TYP:id>` lub `<TYP:id:idx>` (idx dla list — telefony/e-maile/firmy/wystąpienia w wolnym tekście):

| Typ | Przykład | Źródło |
|---|---|---|
| `IMIE`, `NAZWISKO` | `<NAZWISKO:c1>` | `client.firstName/lastName`, id = `client.id` |
| `PESEL` | `<PESEL:c1>` | `client.pesel` (pole strukturalne, bez idx) |
| `DUR` | `<DUR:c1>` | `client.birthDate` |
| `TEL` | `<TEL:c1:0>` | `client.phones[]`, indeksowane |
| `EMAIL` | `<EMAIL:c1:0>` | `client.emails[]`, indeksowane |
| `ADRES` | `<ADRES:c1>` | `street, zipCode, city` sklejone |
| `NIP`, `REGON`, `ADRES_FIRMA` | `<NIP:c1:0>` | `client.businesses[]`, indeksowane per firma (bi) |
| `REJ`, `VIN` | `<REJ:p3>` | `policy.vehicleReg/vehicleVin`, id = `policy.id` |
| `ADRES_NIER` | `<ADRES_NIER:p3>` | `policy.propertyAddress` |
| `PESEL`, `TEL`, `EMAIL`, `KOD` (w notatkach) | `<PESEL:c1:0>`, `<TEL:c1:0>` | wykryte regexem w wolnym tekście notatki, indeksowane PER WYSTĄPIENIE (nie per klient) |

**Sanityzacja notatek (zaktualizowana 2026-07-25, naprawa S1/W1):** `sanitizeNoteContent()` przeszukuje wolny
tekst notatki czterema regexami, w kolejności PESEL → TEL → EMAIL → KOD (kolejność ważna — kod pocztowy na
końcu, żeby nie złapać fragmentu telefonu z myślnikami, np. „601-202-303" → false-positive „01-202"):

- **PESEL** — kandydat `\b\d{11}\b`, ale tokenizowany TYLKO gdy przejdzie `isValidPesel()` (suma kontrolna,
  wagi 1,3,7,9,1,3,7,9,1,3). Odsiewa telefony z prefiksem kraju (`48601202303`, 11 cyfr) i inne przypadkowe
  11-cyfrowe ciągi (nr polis), które wcześniej były błędnie łapane jako PESEL.
- **TEL** — `\b(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b`, łapie telefony PL z/bez prefiksu kraju i
  z/bez separatorów (9 cyfr — wcześniej NIEsanityzowane, W1).
- **EMAIL** — standardowy regex `local@domain.tld` (nowe, W1).
- **KOD** — kod pocztowy PL `\b\d{2}-\d{3}\b` (nowe, W1).

Każde OSOBNE wystąpienie (nie tylko per typ) dostaje WŁASNY indeksowany token i WŁASNĄ wartość w `map`
(liczniki `pesel/tel/email/kod` współdzielone przez wszystkie notatki jednego klienta, nie resetowane per
notatka). To naprawia S1: wcześniej WSZYSTKIE 11-cyfrowe ciągi w notatkach klienta mapowały na JEDEN token
`<PESEL:{clientId}>` z wartością `client.pesel` — PESEL osoby trzeciej (współmałżonek) wpisany w notatce
byłby przy rehydrate podmieniony na PESEL głównego klienta (przekłamanie/wyciek). Teraz wartość tokenu to
zawsze dokładnie ten tekst, który faktycznie wystąpił w notatce — nie `client.pesel`.

### Co zostaje JAWNE (nie identyfikuje osoby, AI tego potrzebuje merytorycznie)
Typ polisy, marka/model pojazdu, towarzystwo (`insurerName`), składka (`premium`), daty
`policyStartDate/policyEndDate`, `stage`. Te pola idą do `context` wprost, bez tokenizacji.

### `PII_SYSTEM_INSTRUCTION`
Gotowy blok tekstu doklejany do system-promptu w każdej metodzie `chatService`, który uczy model:
„dane oznaczone tokenami `<TYP:id>` — wstaw dokładnie ten token, nigdy nie zgaduj wartości; dane
merytoryczne (typ polisy, marka, składka, daty) używaj normalnie”.

**Zasięg tokenizera:** działa tylko na strukturach `Client/Policy/ClientNote` przekazanych explicite do
`buildClientContext`. To NIE jest globalny filtr/middleware — każdy nowy konsument AI, który chce wysłać
dane klienta do Gemini, musi **świadomie** przez niego przejść (patrz § 4 — istniejące serwisy tego nie
robią, bo albo nie operują na PII klienta, albo mają inny model ochrony).

---

## 2. Silnik okazji — `services/clientInsights.ts`

Deterministyczny (**bez AI**, czysta logika na danych) — wykrywa okazje/pilne sprawy z danych
merytorycznych. Karmi warstwę AI (zachęty, mail, mini-ocena) oraz przyszłe proaktywne okienko TOP N.

### Cztery rodzaje sygnałów (`InsightKind`)

| Kind | Funkcja | Reguła | Priorytet (baza) |
|---|---|---|---|
| `renewal` | `upcomingRenewals(client, policies, withinDays=30)` | polisa `isSold()` z `policyEndDate` w oknie `[0, withinDays]` dni | `55 + urgency(0-25) + value(0-20)` — urgency rośnie im bliżej terminu, value z `premium/150` |
| `gap` | `coverageGaps(client, policies)` | cross-sell: auto+OC bez AC (50) / auto bez DOM (45) / (auto lub dom) bez ZYCIE (40) / firma w kartotece bez polisy FIRMA (48) | 40-50 stałe |
| `missing` | `missingData(client, policies)` | brak PESEL/telefonu/adresu (30) / sprzedana polisa bez `policyNumber` (35) | 30-35 |
| `followup` | `followUps(client, policies)` | `policy.nextContactDate` ≤ 3 dni; zaległy (`d<0`) = 65, zaplanowany = 55 | 55-65 |

Pomocnicze: `isSold(p)` = `stage ∈ {sprzedaż, sprzedany, sprzedaz}` (3 formy — konwencja legacy localStorage,
patrz `CRM-Atomic/CLAUDE.md § 3` w root repo). `isAuto(p)` = `type ∈ {OC, AC, BOTH}`.

### Priorytet 0-100 wg WARTOŚCI, nie daty
Świadoma decyzja (docstring pliku): proaktywne okienko ma podawać **najcenniejsze**, nie **najbliższe
terminowo** — stąd `renewal` waży składkę, a nie tylko datę.

### Agregacja
- `analyzeClient(client, allPolicies)` — filtruje polisy klienta, łączy wszystkie 4 sygnały, sortuje malejąco
  po `priority`.
- `topInsights(clients, allPolicies, n=20)` — woła `analyzeClient` dla każdego klienta, spłaszcza, sortuje,
  ucina do `n`. To jest funkcja pod **globalne** proaktywne okienko (TOP N w całej bazie klientów).

`Insight.title`/`Insight.detail` zawierają **prawdziwe dane** (np. `vehicleBrand`, `insurerName`) — insighty
same w sobie NIE przechodzą przez tokenizer (liczone lokalnie, nie idą do AI jako tekst z PII poza samym
`chatService.nudgeFromInsights`, gdzie i tak przekazywane są tylko `kind/title/detail` ogólne, bez
identyfikatorów osobowych typu PESEL/telefon).

---

## 3. `services/chatService.ts` — 4 metody asystentki

Spina trzy gotowe fundamenty (konsumuje, nie modyfikuje): `piiTokenizer` (RODO), `clientInsights`
(`Insight[]`), `apiKeyStore` (klucz+model per `purpose="main"`). Każda metoda: `async`, zwraca
`string | null` (rehydrated albo `null` przy braku klucza/błędzie).

Wspólny szkielet: `connect()` → `apiKeyStore.get("main")` + `apiKeyStore.getModel("main")` → `null` jeśli
brak klucza. `run(conn, systemInstruction, contents, map)` → `generateContent()` → `rehydrate(response.text, map)`.

**S2 fix (2026-07-25):** `askAboutClient` re-tokenizuje `history` przez `detokenize(text, map)`
(`piiTokenizer.ts`, odwrotność `rehydrate`) TUŻ PRZED wysłaniem do modelu. Powód: odpowiedzi zwracane przez
`chatService` są już PO `rehydrate` (prawdziwe PII, do wyświetlenia Alinie); gdyby UI zapisało taką
odpowiedź w `history` i podało do kolejnego wywołania, `run()` wysłałby ją verbatim (z prawdziwym PII) do
Google w następnym turze. `detokenize` zamienia prawdziwe wartości z powrotem na tokeny tą samą `map` przed
wysyłką — `rehydrate` zostaje wyłącznie do pokazania odpowiedzi.

| # | Metoda | Sygnatura | Co robi | Tokenizer/rehydrate |
|---|---|---|---|---|
| 1 | `askAboutClient` | `(client, policies, notes, history: ChatTurn[], userMessage)` | Konwersacyjny czat — pełny kontekst klienta + historia rozmowy + nowe pytanie użytkowniczki | `buildClientContext` → `context+map`; `rehydrate` na odpowiedzi |
| 2 | `clientMiniReview` | `(client, policies, notes)` | Mini-ocena z notatek: charakter, preferencje kontaktu, wrażliwości (cena/obsługa), lojalność, czerwone flagi + 1 zdanie „Jak podejść —” | jw. |
| 3 | `draftOfferMail` | `(client, policies, notes, hint?)` | Draft maila ofertowego (Temat + treść), personalizowany wg polis/pojazdów, wskazuje wznowienia i luki (cross-sell); `hint` = dodatkowa intencja Aliny | jw. |
| 4 | `nudgeFromInsights` | `(insights: Insight[])` | Jedno krótkie zachęcające zdanie o **najważniejszym** insighcie (`reduce` po `priority`) | `map={}` — insighty bez PII, rehydrate no-op ale wywoływany dla dyscypliny przepływu |

`ASSISTANT_ROLE` — wspólny nagłówek persony: „Jesteś asystentką agentki ubezpieczeniowej Aliny (…) Dane
osobowe wstawiaj WYŁĄCZNIE jako tokeny `<TYP:id>`”. Doklejany przed `PII_SYSTEM_INSTRUCTION` + `context` w
metodach 1-3.

Każda metoda łapie wyjątek lokalnie (`try/catch` → `console.error` + `return null`) — brak propagacji błędu
do UI (na razie nie ma UI, patrz § 5).

---

## 4. Konsumenci klucza/modelu — `apiKeyStore` i cztery różne „purpose”

`services/apiKeyStore.ts` — config AI (klucze+modele) w pamięci sesji, odszyfrowany DEK z
`tenant_config.encrypted_ai_config` po `PassphraseGate`. `AiKeyEntry.purpose` = dowolny string, w praktyce
dwa realnie używane: `"main"` (czat/Karateka) i `"ocr"` (skany). `get(purpose="main")` — fallback: dokładne
dopasowanie purpose → pierwszy dostępny klucz → `process.env.API_KEY` (dev/localhost). `getModel(purpose)`
— fallback do `DEFAULT_MODEL = "gemini-3.1-flash-lite"`.

**S5 fix (2026-07-25):** fallback „pierwszy dostępny klucz" jest teraz wyłączony dla `purpose="ocr"` —
brak dedykowanego wpisu `"ocr"` zwraca `null` twardo (bez próby `"any"` ani `process.env.API_KEY`), zamiast
po cichu pożyczać klucz `"main"`. Powód: skany dokumentów tożsamości nie powinny mieszać limitów/rozliczeń
z kluczem główny, i musi być da się audytować „co poszło którym kluczem". Fallback „any" zostaje bez zmian
dla wszystkich innych `purpose` (w tym `"main"`). `getModel(purpose)` bez zmian — model ma sensowny
`DEFAULT_MODEL`, klucz nie.

| Konsument | Purpose | Woła tokenizer? | Charakter danych wysyłanych do Google |
|---|---|---|---|
| `chatService.ts` (§3) | `"main"` (explicit) | ✅ TAK | Kontekst klienta **tokenizowany** |
| `geminiService.ts` (`parseNaturalLanguage`, `fetchCompanyData`, `getTravelAdvice`) | domyślny `"main"` (brak arg) | ❌ NIE | Wejście: fraza NLP paska / dane firmy do wyszukania w KRS/CEIDG (nie PII klienta z bazy) |
| `ai/KaratekaService.ts` (`generateExecutionPlan`) | domyślny `"main"` (brak arg) | ❌ NIE | `contextData` (lokalizacja, ID klienta/polisy — **nie** pełne dane osobowe) + polecenie CLI użytkowniczki |
| `ai/agents/ClientAgent.ts` (`parseClientCommand`) | domyślny `"main"` (brak arg) | ❌ NIE (inny mechanizm) | Luźny tekst wpisany przez agentkę (może zawierać imię/telefon/adres — **dane wejściowe, jeszcze nie w bazie**); ochrona PESEL przez system prompt `ai/prompts/CLIENT_MASTER_PROMPT.md` — PRIME DIRECTIVE: „NIE WOLNO przetwarzać/generować PESEL”, model ma go ignorować/zwracać `null` |
| `services/ocrService.ts` (`processDocument`) | `"ocr"` (explicit) | ❌ NIE MOŻE (obraz) | Cały **obraz** skanu (dowód, polisa) leci do Gemini Vision — z natury nie da się tokenizować obrazu; to świadomie osobny, nietokenizowany kanał PII (OCR musi widzieć oryginał żeby go przeczytać) |

**Wniosek:** tokenizacja RODO (§1) chroni tylko ścieżkę „czat o istniejącym kliencie z bazy” (`chatService`).
Pozostałe 4 konsumenty mają **inne, punktowe zabezpieczenia** (brak PII w payloadzie, albo explicit zakaz w
system-prompt, albo — dla OCR — akceptowane ryzyko bo to jedyny sposób odczytać skan). To NIE jest luka do
automatycznego załatania „dorzuceniem tokenizera wszędzie” — `geminiService`/`KaratekaService`/`ClientAgent`
nie operują na strukturach `Client/Policy/ClientNote` z bazy, więc `buildClientContext` się tam nie
podepnie bez przebudowy sygnatur.

---

## 5. Stan integracji — TODO: wizja proaktywna

**Stwierdzone przy audycie (grep repo, 2026-07-25): `chatService` i `topInsights`/`analyzeClient` NIE są
importowane przez żaden komponent UI poza plikiem definicji.** Fundament (§1-3) jest zbudowany i gotowy do
użycia, ale nic go jeszcze nie wywołuje z interfejsu. Istniejący panel czatu w UI —
`components/GlobalAgent/AgentKaratekaWindow.tsx` — używa **starego** `ai/KaratekaService.ts` (CLI-agent:
nawigacja/CRUD po `plan[]`), nie ma połączenia z `chatService`.

**TODO (wizja proaktywna, do zrobienia):**
- [ ] UI wpięcie 4 metod `chatService` (co najmniej `askAboutClient` w panelu klienta — najbardziej
      oczywisty punkt startowy skoro przyjmuje `history: ChatTurn[]`).
- [ ] „Budzenie + okno” — proaktywne powiadomienie na bazie `topInsights(clients, allPolicies, n)`, np.
      przy starcie aplikacji / logowaniu, pokazujące TOP N okazji z `nudgeFromInsights` jako krótki tekst
      zachęty.
- [ ] Miejsce w UI na `clientMiniReview` (np. sidebar w panelu klienta 360°, patrz
      `WYMAGANIA-KLIENT.md`) i `draftOfferMail` (przycisk „Wygeneruj ofertę” przy wznowieniu/luce).
- [ ] Rozstrzygnąć: czy `nudgeFromInsights` woła się per-insight na żądanie, czy jest cache'owany
      (koszt kliknięcia AI za każdym odświeżeniem dashboardu).

---

## Powiązane

- `services/piiTokenizer.ts`, `services/clientInsights.ts`, `services/chatService.ts`, `services/apiKeyStore.ts`
- `services/geminiService.ts`, `ai/KaratekaService.ts`, `ai/agents/ClientAgent.ts`, `services/ocrService.ts`
- `ai/prompts/CLIENT_MASTER_PROMPT.md` — system prompt zakazu PESEL dla `ClientAgent`
- `components/GlobalAgent/AgentKaratekaWindow.tsx` — obecny UI panel (na starym `KaratekaService`, nie na `chatService`)
- MEMO: `[[project_crm_ai_gemini_client_side]]`, `[[kanon_router_polityka_modeli]]`
- `src/legacy-v1/CLAUDE.md` — indeks dokumentacji modułu (ten plik NIE jest tam jeszcze wpięty — scalenie po stronie Bartka)
