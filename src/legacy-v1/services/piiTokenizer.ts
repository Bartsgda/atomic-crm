/**
 * piiTokenizer — warstwa zgodności RODO dla czatu AI (CRM-ALINA).
 *
 * ZASADA (Bartek 2026-07-24): dane osobowe (PII) NIGDY nie trafiają do AI (Google Gemini).
 *
 * Flow:
 *   1. buildClientContext() → snapshot klienta gdzie PII zastąpione TOKENAMI (<PESEL:id>, <TEL:id:0>…).
 *      Zwraca też mapę token→prawdziwa wartość (zostaje w przeglądarce).
 *   2. Do AI idzie tekst z tokenami + system prompt uczący AI, że tokeny wstawia tam gdzie chce dane.
 *   3. rehydrate(odpowiedź AI, mapa) → podmienia tokeny na PRAWDZIWE dane PRZED pokazaniem Alinie.
 *
 * Efekt: Google widzi „Szanowny Panie <NAZWISKO:c1>", Alina widzi „Szanowny Panie Kowalski".
 *
 * Dane MERYTORYCZNE (typ polisy, marka/model, składka, daty, zakres, towarzystwo) zostają jawne —
 * nie identyfikują osoby, a AI ich potrzebuje do sensownej oferty.
 */

import { Client, Policy, ClientNote } from "../types";

export type TokenMap = Record<string, string>;

/** Kandydat na PESEL (11 cyfr) w wolnym tekście — filtrowany dalej sumą kontrolną (isValidPesel). */
const PESEL_CANDIDATE_RE = /\b\d{11}\b/g;

/**
 * Telefon PL w wolnym tekście: opcjonalny prefiks +48/48, 9 cyfr w grupach 3-3-3
 * (spacja/myślnik opcjonalne, dowolna kombinacja). Łapie zarówno „601 202 303",
 * „601-202-303", „601202303" jak i „+48 601 202 303"/„48601202303".
 */
const PHONE_RE = /\b(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g;

/** E-mail w wolnym tekście. */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Kod pocztowy PL: NN-NNN. */
const POSTAL_RE = /\b\d{2}-\d{3}\b/g;

/**
 * Walidacja sumy kontrolnej PESEL (wagi 1,3,7,9,1,3,7,9,1,3 dla pierwszych 10 cyfr;
 * 11. cyfra = (10 - suma mod 10) mod 10). Odsiewa telefony z prefiksem kraju
 * (11 cyfr, np. `48601202303`) i inne przypadkowe 11-cyfrowe ciągi (nr polis)
 * od prawdziwych numerów PESEL — patrz audyt S1/W1.
 */
function isValidPesel(pesel: string): boolean {
  if (!/^\d{11}$/.test(pesel)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += weights[i] * Number(pesel[i]);
  }
  const control = (10 - (sum % 10)) % 10;
  return control === Number(pesel[10]);
}

/** Liczniki indeksów tokenów — współdzielone przez wszystkie notatki jednego klienta,
 * żeby każde osobne wystąpienie dostało WŁASNY token (nie zlewać różnych PESEL-i/telefonów
 * w jeden token — patrz audyt S1). */
interface NoteTokenCounters {
  pesel: number;
  tel: number;
  email: number;
  kod: number;
}

/**
 * Sanityzuje treść notatki: zamienia każde wykryte wystąpienie PESEL (poprawna suma
 * kontrolna), telefonu, e-maila lub kodu pocztowego na osobny indeksowany token
 * (`<PESEL:cid:0>`, `<TEL:cid:0>`, `<EMAIL:cid:0>`, `<KOD:cid:0>` …), z odrębną
 * wartością w `map` do rehydratacji. Kolejność ma znaczenie: PESEL i telefon
 * najpierw (odsiewają digit-only ciągi), kod pocztowy na końcu (żeby nie złapać
 * fragmentu telefonu zapisanego z myślnikami, np. „601-202-303" → „01-202").
 */
function sanitizeNoteContent(
  content: string,
  cid: string,
  map: TokenMap,
  counters: NoteTokenCounters,
): string {
  let out = content;

  out = out.replace(PESEL_CANDIDATE_RE, (match) => {
    if (!isValidPesel(match)) return match;
    const token = `<PESEL:${cid}:${counters.pesel}>`;
    map[token] = match;
    counters.pesel += 1;
    return token;
  });

  out = out.replace(PHONE_RE, (match) => {
    const token = `<TEL:${cid}:${counters.tel}>`;
    map[token] = match;
    counters.tel += 1;
    return token;
  });

  out = out.replace(EMAIL_RE, (match) => {
    const token = `<EMAIL:${cid}:${counters.email}>`;
    map[token] = match;
    counters.email += 1;
    return token;
  });

  out = out.replace(POSTAL_RE, (match) => {
    const token = `<KOD:${cid}:${counters.kod}>`;
    map[token] = match;
    counters.kod += 1;
    return token;
  });

  return out;
}

export interface ClientContext {
  /** Tekst kontekstu z tokenami zamiast PII — bezpieczny do wysłania do AI. */
  context: string;
  /** Mapa token→prawdziwa wartość. NIGDY nie opuszcza przeglądarki. */
  map: TokenMap;
}

/**
 * Buduje snapshot klienta (dane osobowe → tokeny, dane merytoryczne jawne).
 * @param client   klient
 * @param policies wszystkie polisy klienta
 * @param notes    notatki klienta (treść sanityzowana z PESEL-i)
 */
export function buildClientContext(
  client: Client,
  policies: Policy[],
  notes: ClientNote[] = [],
): ClientContext {
  const map: TokenMap = {};
  const cid = client.id;

  const tok = (
    type: string,
    id: string,
    value: string | undefined | null,
    idx?: number,
  ): string => {
    if (!value) return "";
    const token = idx != null ? `<${type}:${id}:${idx}>` : `<${type}:${id}>`;
    map[token] = value;
    return token;
  };

  const L: string[] = [];

  // ── KLIENT (dane osobowe → tokeny) ──
  L.push(`## KLIENT (id: ${cid})`);
  L.push(`Imię: ${tok("IMIE", cid, client.firstName)}`);
  L.push(`Nazwisko: ${tok("NAZWISKO", cid, client.lastName)}`);
  if (client.pesel) L.push(`PESEL: ${tok("PESEL", cid, client.pesel)}`);
  if (client.birthDate)
    L.push(`Data ur.: ${tok("DUR", cid, client.birthDate)}`);
  (client.phones || []).forEach((p, i) => {
    if (p) L.push(`Telefon: ${tok("TEL", cid, p, i)}`);
  });
  (client.emails || []).forEach((e, i) => {
    if (e) L.push(`E-mail: ${tok("EMAIL", cid, e, i)}`);
  });
  const adres = [client.street, client.zipCode, client.city]
    .filter(Boolean)
    .join(", ");
  if (adres) L.push(`Adres: ${tok("ADRES", cid, adres)}`);

  // ── FIRMY klienta ──
  (client.businesses || []).forEach((b: any, bi: number) => {
    L.push(`\n### Firma ${bi + 1}${b?.name ? ` — ${b.name}` : ""}`);
    if (b?.nip) L.push(`NIP: ${tok("NIP", cid, b.nip, bi)}`);
    if (b?.regon) L.push(`REGON: ${tok("REGON", cid, b.regon, bi)}`);
    const badr = [b?.street, b?.zipCode, b?.city].filter(Boolean).join(", ");
    if (badr) L.push(`Adres firmy: ${tok("ADRES_FIRMA", cid, badr, bi)}`);
  });

  // ── POLISY / PRODUKTY (merytoryka jawna, identyfikatory → tokeny) ──
  L.push(`\n## POLISY / PRODUKTY (${policies.length})`);
  policies.forEach((p) => {
    const nazwa = [p.vehicleBrand, (p as any).vehicleModel]
      .filter(Boolean)
      .join(" ");
    L.push(`\n### ${p.type}${nazwa ? ` — ${nazwa}` : ""} (id: ${p.id})`);
    if (p.vehicleReg) L.push(`Nr rej.: ${tok("REJ", p.id, p.vehicleReg)}`);
    if (p.vehicleVin) L.push(`VIN: ${tok("VIN", p.id, p.vehicleVin)}`);
    if (p.propertyAddress)
      L.push(
        `Adres nieruchomości: ${tok("ADRES_NIER", p.id, p.propertyAddress)}`,
      );
    // Merytoryka — jawna (AI tego potrzebuje do oferty):
    if (p.insurerName) L.push(`Towarzystwo: ${p.insurerName}`);
    if (p.premium != null) L.push(`Składka: ${p.premium} zł`);
    if (p.policyStartDate || p.policyEndDate)
      L.push(
        `Okres: ${(p.policyStartDate || "?").slice(0, 10)} → ${(p.policyEndDate || "?").slice(0, 10)}`,
      );
    if (p.stage) L.push(`Etap: ${p.stage}`);
  });

  // ── NOTATKI (treść sanityzowana: PESEL/telefon/e-mail/kod pocztowy → tokeny;
  //    reszta, np. merytoryka rozmów, zostaje jawna) ──
  if (notes.length) {
    L.push(`\n## HISTORIA ROZMÓW / NOTATKI (${notes.length})`);
    const noteCounters: NoteTokenCounters = {
      pesel: 0,
      tel: 0,
      email: 0,
      kod: 0,
    };
    notes.forEach((n) => {
      const safe = sanitizeNoteContent(n.content || "", cid, map, noteCounters);
      const date = (n.createdAt || "").slice(0, 10);
      L.push(`- [${date}] ${safe}`);
    });
  }

  return { context: L.join("\n"), map };
}

/**
 * Podmienia tokeny <TYP:id[:idx]> na prawdziwe wartości.
 * Wywoływane PO odpowiedzi AI, PRZED pokazaniem/wysłaniem (Alina widzi prawdziwe dane).
 */
export function rehydrate(text: string, map: TokenMap): string {
  if (!text) return text;
  let out = text;
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(value);
  }
  return out;
}

/**
 * Odwrotność rehydrate(): podmienia PRAWDZIWE wartości PII z powrotem na tokeny,
 * używając tej samej mapy `map`.
 *
 * ZASTOSOWANIE (S2, Bartek 2026-07-25): metody `chatService` zwracają odpowiedź
 * PO rehydrate (z prawdziwym PII, do wyświetlenia Alinie). Jeśli UI zapisze taką
 * odpowiedź w historii czatu i przekaże ją do kolejnego zapytania, prawdziwe dane
 * osobowe wróciłyby do Google w następnym turze — `history` MUSI więc przejść
 * przez detokenize() (re-tokenizacja) tuż przed wysłaniem do modelu. rehydrate()
 * zostaje wyłącznie do pokazania odpowiedzi użytkowniczce.
 *
 * Wartości sortowane malejąco wg długości przed podmianą — zapobiega częściowej
 * podmianie, gdy jedna wartość jest podciągiem innej (np. adres zawierający
 * fragment, który osobno też jest tokenizowany).
 */
export function detokenize(text: string, map: TokenMap): string {
  if (!text) return text;
  let out = text;
  const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  for (const [token, value] of entries) {
    if (!value) continue;
    out = out.split(value).join(token);
  }
  return out;
}

/**
 * Instrukcja dla AI (do system-promptu) — uczy model, że tokeny wstawia dosłownie
 * tam, gdzie chce użyć danych osobowych. Program podmieni je na prawdziwe.
 */
export const PII_SYSTEM_INSTRUCTION = `
DANE OSOBOWE — ZASADA BEZWZGLĘDNA:
Dane klienta oznaczone są tokenami w formacie <TYP:id> lub <TYP:id:index> (np. <NAZWISKO:c1>, <TEL:c1:0>).
Gdy w treści (np. w mailu) chcesz użyć imienia, nazwiska, PESEL, telefonu, adresu, e-maila, NIP lub numeru
rejestracyjnego — WSTAW DOKŁADNIE TEN TOKEN, nigdy nie zgaduj ani nie wymyślaj wartości.
Przykład: "Szanowny Panie <NAZWISKO:c1>, w sprawie pojazdu <REJ:p3> ...".
System podmieni tokeny na prawdziwe dane po Twojej stronie — Ty NIGDY nie widzisz i nie potrzebujesz
prawdziwych wartości. Danych merytorycznych (typ polisy, marka/model, składka, daty) używaj normalnie.
`.trim();
