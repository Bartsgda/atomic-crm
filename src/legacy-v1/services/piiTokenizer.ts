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

/** PESEL (11 cyfr) w wolnym tekście notatki → maskujemy przed wysłaniem do AI. */
const PESEL_RE = /\b\d{11}\b/g;

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
  if (client.birthDate) L.push(`Data ur.: ${tok("DUR", cid, client.birthDate)}`);
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
      L.push(`Adres nieruchomości: ${tok("ADRES_NIER", p.id, p.propertyAddress)}`);
    // Merytoryka — jawna (AI tego potrzebuje do oferty):
    if (p.insurerName) L.push(`Towarzystwo: ${p.insurerName}`);
    if (p.premium != null) L.push(`Składka: ${p.premium} zł`);
    if (p.policyStartDate || p.policyEndDate)
      L.push(
        `Okres: ${(p.policyStartDate || "?").slice(0, 10)} → ${(p.policyEndDate || "?").slice(0, 10)}`,
      );
    if (p.stage) L.push(`Etap: ${p.stage}`);
  });

  // ── NOTATKI (treść sanityzowana z PESEL-i; reszta = merytoryka rozmów) ──
  if (notes.length) {
    L.push(`\n## HISTORIA ROZMÓW / NOTATKI (${notes.length})`);
    notes.forEach((n) => {
      const safe = (n.content || "").replace(PESEL_RE, `<PESEL:${cid}>`);
      // token PESEL w notatce mapuje na PESEL klienta (jeśli znany)
      if (client.pesel) map[`<PESEL:${cid}>`] = client.pesel;
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
