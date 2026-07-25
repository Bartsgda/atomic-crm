/**
 * clientInsights — silnik analizy klienta (CRM-ALINA).
 *
 * Deterministyczny (bez AI): wykrywa OKAZJE i PILNE rzeczy z danych merytorycznych.
 * Karmi potem warstwę AI (zachęty, mail, mini-ocena) oraz proaktywne okienko (TOP N).
 *
 * Cztery rodzaje sygnałów:
 *   - renewal  — wznowienie (sprzedana polisa kończąca się ≤ N dni)
 *   - gap      — luka w ochronie = cross-sell (prowizja): ma OC bez AC, auto bez domu, brak życia…
 *   - missing  — braki danych (PESEL/tel/adres/nr polisy) — blokują sprzedaż/wystawienie
 *   - followup — obiecany kontakt (nextContactDate) / oferta bez decyzji
 *
 * Priorytet ~0-100 wg WARTOŚCI (składka + pilność), nie wg daty — żeby proaktywne
 * okienko podawało to, co najcenniejsze, a nie po prostu najbliższe.
 */

import { Client, Policy } from "../types";

const SOLD = ["sprzedaż", "sprzedany", "sprzedaz"];
export const isSold = (p: Policy): boolean => SOLD.includes(String(p.stage));

// isRenewable — polisa SPRZEDANA i NADAL AKTUALNA (jest co wznawiać).
// 'sprzedany' = agent dzwonił o wznowienie i dowiedział się, że klient sprzedał auto —
// przychód/prowizja z tamtej sprzedaży ZOSTAJE (patrz isSold — to się NIE zmienia), ale
// nie ma sensu dzwonić o wznowienie nieistniejącego już pojazdu. Używaj tego helpera
// wszędzie, gdzie chodzi o WZNOWIENIE/kontakt telefoniczny (nie o finanse/prowizje —
// tam nadal isSold).
export const isRenewable = (p: Policy): boolean =>
  isSold(p) && p.stage !== "sprzedany";

const AUTO_TYPES = ["OC", "AC", "BOTH"];
const isAuto = (p: Policy): boolean => AUTO_TYPES.includes(String(p.type));

const daysUntil = (iso?: string): number | null => {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
};

export type InsightKind = "renewal" | "gap" | "missing" | "followup";

export interface Insight {
  kind: InsightKind;
  priority: number; // 0-100 (wyżej = ważniejsze wg wartości/pilności)
  title: string; // krótki nagłówek dla Aliny (z prawdziwymi danymi — po stronie UI)
  detail: string; // uzasadnienie / kontekst
  clientId: string;
  policyId?: string;
  premium?: number;
}

// ── Wznowienia ──────────────────────────────────────────────────────────────
export function upcomingRenewals(
  client: Client,
  policies: Policy[],
  withinDays = 30,
): Insight[] {
  const out: Insight[] = [];
  for (const p of policies) {
    if (!isRenewable(p)) continue;
    const d = daysUntil(p.policyEndDate);
    if (d == null || d < 0 || d > withinDays) continue;
    // priorytet: baza 55 + pilność (im bliżej, tym wyżej) + składka
    const urgency = Math.round(((withinDays - d) / withinDays) * 25); // 0-25
    const value = Math.min(20, Math.round((p.premium || 0) / 150)); // 0-20
    out.push({
      kind: "renewal",
      priority: 55 + urgency + value,
      title: `Wznowienie: ${p.vehicleBrand || p.type} (za ${d} dni)`,
      detail: `Polisa ${p.type} w ${p.insurerName || "towarzystwie"}, składka ${p.premium || 0} zł, koniec za ${d} dni. Przygotować wznowienie i kontakt.`,
      clientId: client.id,
      policyId: p.id,
      premium: p.premium,
    });
  }
  return out;
}

// ── Luki w ochronie (cross-sell) ────────────────────────────────────────────
export function coverageGaps(client: Client, policies: Policy[]): Insight[] {
  const sold = policies.filter(isSold);
  const has = (t: string) => sold.some((p) => String(p.type) === t);
  const out: Insight[] = [];

  const hasAuto = sold.some(isAuto);
  const hasAC = has("AC") || has("BOTH");
  const hasDom = has("DOM");
  const hasZycie = has("ZYCIE");
  const hasFirma = has("FIRMA");

  // Auto z samym OC → brak AC (dosprzedaż AC)
  if (hasAuto && has("OC") && !hasAC) {
    out.push({
      kind: "gap",
      priority: 50,
      title: "Luka: auto bez AC",
      detail:
        "Klient ma OC, ale brak AC. Rozważ dosprzedaż Autocasco (szczególnie nowsze/wartościowe auto).",
      clientId: client.id,
    });
  }
  // Ma auto, ale nie ubezpiecza domu/mieszkania
  if (hasAuto && !hasDom) {
    out.push({
      kind: "gap",
      priority: 45,
      title: "Luka: brak ubezpieczenia domu",
      detail:
        "Klient ubezpiecza pojazd, ale nie ma polisy majątkowej (dom/mieszkanie). Naturalny cross-sell.",
      clientId: client.id,
    });
  }
  // Ma majątek (auto/dom), ale brak polisy na życie
  if ((hasAuto || hasDom) && !hasZycie) {
    out.push({
      kind: "gap",
      priority: 40,
      title: "Luka: brak ubezpieczenia na życie",
      detail:
        "Klient chroni majątek, ale nie siebie/rodzinę. Warto zaproponować życie/NNW.",
      clientId: client.id,
    });
  }
  // Ma firmę w kartotece, ale brak polisy firmowej
  if ((client.businesses || []).length > 0 && !hasFirma) {
    out.push({
      kind: "gap",
      priority: 48,
      title: "Luka: firma bez ubezpieczenia",
      detail:
        "Klient ma działalność w kartotece, ale brak polisy FIRMA. Potencjał OC działalności/majątek firmy.",
      clientId: client.id,
    });
  }
  return out;
}

// ── Braki danych ────────────────────────────────────────────────────────────
export function missingData(client: Client, policies: Policy[]): Insight[] {
  const out: Insight[] = [];
  const braki: string[] = [];
  if (!client.pesel) braki.push("PESEL");
  if (!(client.phones || []).some(Boolean)) braki.push("telefon");
  if (!client.street && !client.city) braki.push("adres");

  if (braki.length) {
    out.push({
      kind: "missing",
      priority: 30,
      title: `Braki w kartotece: ${braki.join(", ")}`,
      detail: `Uzupełnij ${braki.join(", ")} — potrzebne do wystawienia polisy i kontaktu.`,
      clientId: client.id,
    });
  }
  // Sprzedana polisa bez numeru
  for (const p of policies) {
    if (isSold(p) && !p.policyNumber) {
      out.push({
        kind: "missing",
        priority: 35,
        title: `Sprzedana polisa bez numeru: ${p.vehicleBrand || p.type}`,
        detail:
          "Polisa oznaczona jako sprzedana, ale brak numeru polisy. Uzupełnij.",
        clientId: client.id,
        policyId: p.id,
      });
    }
  }
  return out;
}

// ── Follow-up (obiecany kontakt / oferta bez decyzji) ───────────────────────
export function followUps(client: Client, policies: Policy[]): Insight[] {
  const out: Insight[] = [];
  for (const p of policies) {
    const d = daysUntil(p.nextContactDate);
    if (d != null && d <= 3) {
      out.push({
        kind: "followup",
        priority: d < 0 ? 65 : 55, // zaległy kontakt = wyżej
        title:
          d < 0
            ? `Zaległy kontakt: ${p.vehicleBrand || p.type} (${Math.abs(d)} dni po terminie)`
            : `Kontakt zaplanowany: ${p.vehicleBrand || p.type} (za ${d} dni)`,
        detail: `Umówiony kontakt w sprawie ${p.type}. Nie przegap — obietnica wobec klienta.`,
        clientId: client.id,
        policyId: p.id,
      });
    }
  }
  return out;
}

// ── Agregacja per klient ────────────────────────────────────────────────────
export function analyzeClient(
  client: Client,
  allPolicies: Policy[],
): Insight[] {
  const policies = allPolicies.filter((p) => p.clientId === client.id);
  return [
    ...upcomingRenewals(client, policies),
    ...coverageGaps(client, policies),
    ...missingData(client, policies),
    ...followUps(client, policies),
  ].sort((a, b) => b.priority - a.priority);
}

// ── TOP N globalnie (dla proaktywnego okienka / listy) ──────────────────────
export function topInsights(
  clients: Client[],
  allPolicies: Policy[],
  n = 20,
): Insight[] {
  const all: Insight[] = [];
  for (const c of clients) all.push(...analyzeClient(c, allPolicies));
  return all.sort((a, b) => b.priority - a.priority).slice(0, n);
}
