# DOCUMENTS_SPEC.md — Centrum Dokumentów

> Audyt dokumentacyjny 2026-07-25 (sesja `--dev` inline, read-only — kod nietknięty).
> Moduł: `src/legacy-v1/components/Documents/`.

## 1. Cel

Centrum Dokumentów porządkuje dokumenty klienta (zdjęcia + PDF) w jednym miejscu,
opcjonalnie przypięte do konkretnej polisy/pojazdu/domu. **Faza obecna = wyłącznie
front-end, in-memory** (nic nie trafia do Supabase Storage ani na dysk poza sesją
przeglądarki). To świadomy fundament pod **przyszły storage + OCR** (VIN, nr polisy)
— pola i komentarze `TODO` już zaznaczają gdzie te warstwy się wepną (§5).

## 2. Wpięcie w aplikację

- **Routing:** `App.tsx` — `currentPage === "documents"` renderuje `<DocumentCenter>`
  z propsami `clients={state.clients}`, `policies={state.policies}`,
  `initialClientId={currentData?.client?.id}` (linie ~704-710).
- **Nawigacja:** `components/Navigation/Sidebar.tsx` — kafelek `{ id: "documents",
  label: "Dokumenty", Icon: FolderOpen, ... onClick: () => onNavigate("documents") }`
  (linia ~597), aktywny stan liczony przez `isActiveTile` (linia ~602).
- Moduł nie ma własnego route'a poza tym — to jedna strona w istniejącym SPA state
  machine (`currentPage`), bez React Router.

## 3. Przepływ użytkownika

1. **Wybór klienta** — ekran startowy to wyszukiwarka (`query` → filtr po
   `firstName+lastName` / `lastName+firstName` / PESEL, max 40 wyników, limit
   twardy w `useMemo`). Po kliknięciu klienta (`selectClient`) stan przechodzi do
   widoku dokumentów tego klienta; `contextPolicyId` i `query` są resetowane.
2. **Kontekst (opcjonalny)** — jeśli klient ma polisy (`clientPolicies`), pod belką
   klienta pokazują się chipy "Przypnij do": `Bez kontekstu` + jedna per polisa,
   etykieta z `policyLabel()` (dla DOM/FIRMA = adres nieruchomości, dla
   pojazdów = marka+model+rejestracja, fallback `type + policyNumber`). Wybrany
   `contextPolicyId` jest doklejany do KAŻDEGO pliku wrzuconego w danej chwili jako
   `policyId` + `contextLabel` (czytelna etykieta wyświetlana na miniaturze/PDF).
3. **Drag&drop / wybór pliku** — `DropZone` (natywny HTML5 DnD, `accept="image/jpeg,
   image/png,image/webp,application/pdf"`, `multiple`). Klik na strefę też otwiera
   systemowy `<input type="file">` (ref).
4. **Przetwarzanie:**
   - **PDF** → od razu `status: "ready"`, `pdfUrl = URL.createObjectURL(file)`,
     oryginalny `File` trzymany w `pdfFile` (pod przyszły upload). Zero resize.
   - **Obraz** → najpierw placeholder `status: "processing"` w liście (optymistyczny
     UI), potem async `processImageFile()` (patrz §4). Sukces → `status: "ready"` +
     `displayUrl`/`width`/`height`/`sizeBytes`. Błąd → `status: "error"` (log
     `console.error`, UI pokazuje ikonę `AlertTriangle`).
   - Pliki spoza `image/*` i nie-PDF są cicho pomijane (`continue`).
5. **Lista** — dwie sekcje: `Zdjęcia (N)` jako siatka `ImageThumb` (2-5 kolumn
   responsywnie) i `Dokumenty PDF (N)` jako lista wierszy z ikoną, nazwą, rozmiarem,
   `contextLabel`, przyciskami podgląd/usuń.
6. **Obrót** (`ImageThumb` → `onRotate`) — `handleRotate()` bierze `doc.originalFile`
   (NIE przetworzony blob — zawsze re-processing z oryginału, żeby uniknąć utraty
   jakości przy wielokrotnym obrocie), dodaje 90° do `rotation`, woła ponownie
   `processImageFile(originalFile, { extraRotation: nextRot })`, stary
   `displayUrl` jest `revokeObjectURL`-owany przed podmianą.
7. **Usuń** (`handleRemove`) — filtruje z `docs`, revoke obu ewentualnych object-URL
   (`displayUrl`, `pdfUrl`), zamyka podgląd jeśli usuwany dokument był otwarty.
8. **Lightbox/podgląd** (`preview` state) — pełnoekranowe modal (`fixed inset-0`),
   dla PDF `<iframe src={pdfUrl}>`, dla obrazu `<img src={displayUrl}>`, plus link
   "Otwórz w nowej karcie".

## 4. Przetwarzanie obrazu — `imageProcessing.ts`

Zero zewnętrznych bibliotek, czysty Canvas API.

- **`decodeOriented(file)`** — dekoduje plik do bitmapy z JUŻ naprawioną orientacją
  EXIF. Ścieżka preferowana: `createImageBitmap(file, { imageOrientation:
  "from-image" })`. Fallback (gdy `createImageBitmap` niedostępny lub rzuci): zwykły
  `<img>` + `URL.createObjectURL` — nowoczesne przeglądarki mają domyślnie
  `image-orientation: from-image`, więc `drawImage` i tak honoruje EXIF.
- **`processImageFile(file, opts)`** — główna funkcja:
  1. Skaluje tak, by **dłuższy bok ≤ `maxEdge`** (domyślnie **1800px**), nigdy nie
     powiększa (`scale = longer > maxEdge ? maxEdge/longer : 1`).
  2. Nakłada opcjonalny ręczny obrót (`extraRotation`: 0/90/180/270°) na canvas
     (`ctx.translate` do środka + `ctx.rotate` + `drawImage` wyśrodkowany); przy
     90/270° szerokość/wysokość canvasu są zamieniane miejscami (`swap`).
  3. Eksport do **JPEG, quality domyślnie 0.85** (`canvas.toBlob`).
  4. Zwraca `{ blob, url (object URL), width, height, sizeBytes }`.
  5. `finally { decoded.close() }` — zawsze zwalnia bitmapę/URL źródła.
- **`formatBytes(bytes)`** — czytelny rozmiar (B/KB/MB, 0/1 miejsce po przecinku).
- **Sprzątanie object-URL** — odpowiedzialność WYWOŁUJĄCEGO (`ProcessedImage.url`
  komentarz wprost to mówi). `DocumentCenter` to respektuje: revoke przy podmianie
  w `handleRotate`, przy `handleRemove`, oraz w `useEffect` cleanup na odmontowanie
  komponentu (przechodzi po `docsRef.current`, żeby uniknąć stale closure).

## 5. Model danych — `types.ts`

```ts
type DocKind = "image" | "pdf";
type DocStatus = "processing" | "ready" | "error";

interface ClientDocument {
  id: string; clientId: string; kind: DocKind; name: string;
  status: DocStatus; createdAt: string;
  policyId?: string; contextLabel?: string;        // kontekst pojazd/dom/polisa
  originalFile?: File; displayUrl?: string;          // obraz
  width?: number; height?: number; rotation?: number;
  pdfUrl?: string; pdfFile?: File;                   // pdf
  sizeBytes?: number;
}
```

Komentarz w pliku wprost deklaruje fazę: **dokumenty żyją wyłącznie w pamięci
(React `state` w `DocumentCenter`)** — nie ma jeszcze żadnej persystencji. `id`
generowany lokalnie (`crypto.randomUUID()` z fallbackiem na `doc_<ts>_<rand>`).

## 6. Struktura komponentów

| Plik | Rola |
|---|---|
| `DocumentCenter.tsx` | Kontener stanu: wybór klienta, kontekst polisy, `docs[]`, `preview`, cały handling (`handleFiles`/`handleRotate`/`handleRemove`), layout stron (wybór klienta / lista dokumentów / lightbox). |
| `DropZone.tsx` | Prezentacyjny, bezstanowy poza `dragging`; natywny DnD + `<input type="file">`; przyjmuje `onFiles(files: File[])`, `disabled`. |
| `ImageThumb.tsx` | Kafelek zdjęcia: podgląd, spinner przy `processing`, błąd przy `error`, przyciski obrót/usuń, metadane (wymiary, rozmiar, `contextLabel`). |
| `imageProcessing.ts` | Czysta logika (bez JSX) — resize/rotate/EXIF/eksport JPEG + `formatBytes`. |
| `types.ts` | Model `ClientDocument` + `DocKind`/`DocStatus`. |

Zależności zewnętrzne modułu: `Client`/`Policy` z `../../types` (globalny model
CRM), `lucide-react` na ikony. Zero nowych bibliotek do obsługi obrazów/PDF — PDF
jest tylko linkowany przez `object URL` do natywnego `<iframe>`/przeglądarki (brak
renderowania stron PDF, brak `pdf.js`).

## 7. FAZY PRZYSZŁE (zaznaczone `TODO` w kodzie)

### 7.1 Storage

- **`imageProcessing.ts`** komentarz na górze pliku i **`types.ts`** komentarz
  wprost wskazują: docelowo `ClientDocument` zyska pola typu `remotePath`/`bucket`
  — **Supabase Storage bucket per klient** (alternatywa: Cloudflare).
- **`DocumentCenter.tsx` → `handleFiles()`** ma dwa konkretne markery:
  - `// TODO storage: upload oryginału PDF do Supabase Storage (bucket per klient) / Cloudflare.` (po dodaniu PDF do listy)
  - `// TODO storage: upload przetworzonego blob (p.blob) do Supabase Storage / Cloudflare.` (po sukcesie `processImageFile`)
- Naturalne miejsce wpięcia: zamiast/obok `setDocs`/`updateDoc` z lokalnym
  `object URL`, dodać async upload `p.blob` (obraz) lub `file` (PDF) do bucketa,
  zapisać zwrócony `remotePath` na `ClientDocument`, i dopiero wtedy (albo
  równolegle, optymistycznie) pokazywać jako `ready`. `sizeBytes`/`width`/`height`
  już są liczone lokalnie — mogą iść jako metadane rekordu w bazie zamiast tylko
  UI.
- Trzeba też rozstrzygnąć trwałość — dziś `docs` state ginie przy odświeżeniu
  strony (brak `useEffect` ładującego z API); storage-first oznacza dociągnięcie
  listy dokumentów klienta przy wejściu na `DocumentCenter` (`initialClientId`) z
  bazy zamiast pustego stanu startowego.

### 7.2 OCR

- **`DocumentCenter.tsx` → `handleFiles()`**, tuż po komentarzu storage dla obrazu:
  `// TODO ocr: tu wpłynie rozpoznanie VIN / nr polisy (Flash/Gemma) na p.blob → metadane dokumentu.`
- **`types.ts`** komentarz: metadane OCR jak `ocrVin`, `ocrPolicyNumber`
  wyciągane przez **Flash/Gemma**.
- Zgodnie z `[[project_crm_ai_gemini_client_side]]` (MEMO) — AI w tym repo działa
  **client-side, bezpośrednio z przeglądarki** przez `@google/genai`
  (`gemini-3.1-flash-lite`, klucz `CRM_ALINA_GEMINI_KEY`), **NIE** przez LiteLLM
  router `:4000` (server-side/localhost, niedostępny dla przeglądarki Aliny). OCR
  dokumentów prawdopodobnie pójdzie tą samą, już istniejącą ścieżką (patrz
  `geminiService.ts` — `parseNaturalLanguage`, `fetchCompanyData`, `KaratekaService`,
  `ClientAgent`) zamiast nowego setupu.
- Docelowy przepływ: po przetworzeniu obrazu (`p.blob`) → wywołanie Gemini
  (rozpoznanie VIN/nr polisy z załączonego zdjęcia dokumentu) → zapis wyniku jako
  pola na `ClientDocument` (`ocrVin`, `ocrPolicyNumber` — jeszcze nie istnieją w
  `types.ts`) → **dokarmienie Karateki** (AI agent klienta, patrz
  `ai/prompts/CLIENT_MASTER_PROMPT.md` w indeksie `legacy-v1/CLAUDE.md`) tak, by
  rozpoznane dane mogły od razu zasilić formularz polisy/klienta zamiast ręcznego
  przepisywania.
- Warstwa OCR logicznie zależy od warstwy storage (żeby mieć trwały `remotePath`
  do przechowania razem z wynikiem rozpoznania, nie tylko efemeryczny object URL).

## 8. Co NIE jest jeszcze zrobione (stan na audyt)

- Brak trwałości między odświeżeniami strony (czysty `React.useState`).
- Brak uploadu do jakiegokolwiek backendu — `originalFile`/`pdfFile` siedzą w
  pamięci przeglądarki tylko na czas sesji.
- Brak limitu liczby plików naraz (limit *rozmiaru* pojedynczego pliku jest —
  patrz §9).
- Brak testów jednostkowych dla `imageProcessing.ts` (kandydat, bo logika jest
  czysta/bez JSX — łatwa do przetestowania w Vitest).

## 9. Zabezpieczenia dodane (naprawa finding S4, 2026-07-25)

Audyt `SECURITY_AUDIT_2026-07-25.md` § S4 wskazał trzy luki w `handleFiles`
(`DocumentCenter.tsx`) i podglądzie PDF — naprawione tą samą sesją:

- **Twardy limit rozmiaru pliku** — `MAX_FILE_BYTES = 20 * 1024 * 1024` (20 MB)
  w `DocumentCenter.tsx`. Plik większy jest odrzucany (nie trafia do `docs`),
  z czytelnym komunikatem w toaście (`fileWarning` state, `showFileWarning()`,
  auto-znika po 5 s) zamiast cichego pominięcia.
- **Whitelist MIME zamiast `startsWith("image/")`** — `ALLOWED_IMAGE_MIME_TYPES`
  (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`).
  `image/svg+xml` jest jawnie odrzucany z dedykowanym komunikatem (SVG może
  nieść skrypty) zamiast przechodzić przez `startsWith("image/")`, które go
  łapało. `DropZone.tsx` ACCEPT rozszerzony do tej samej listy (to tylko hint
  dla natywnego file pickera — drag&drop i tak omija ACCEPT, realna walidacja
  jest wyłącznie w `handleFiles`).
- **`sandbox="allow-same-origin"` na `<iframe>` podglądu PDF** — blokuje
  wykonanie JS osadzonego w PDF (brak `allow-scripts`). Świadomie NIE
  `sandbox=""` (pusty) — blob: URL jest związany z origin strony, a w pełni
  sandboxowany iframe (bez `allow-same-origin`) dostaje opaque origin `"null"`
  i traci dostęp do blob: URL, więc podgląd by nie działał. Kombinacja
  `allow-same-origin` + `allow-scripts` razem byłaby niebezpieczna (embedded
  doc mógłby zdjąć sandbox) — tu `allow-scripts` nie jest ustawione, więc to
  bezpieczne.

Bez zmian: sprzątanie object-URL (poprawne od początku), brak uploadu
(TODO storage/OCR nietknięte).
