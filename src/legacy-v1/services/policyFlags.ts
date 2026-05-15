/**
 * policyFlags.ts — Faza 4 (AUDIT_PLAN.md § Faza 4)
 *
 * Flagi "wymaga uzupełnienia" dla polis i klientów.
 * Używane przez:
 *  - PolicyCardItem (ClientDetails.tsx) — badge per polisa
 *  - ClientsList.tsx — kolumna flag_count + filter "tylko z flagami"
 *
 * UWAGA NIP/FIRMA:
 *   `firmaDetails` nie istnieje w typach frontendu — NIP firmy żyje na
 *   client.businesses[].nip, nie na samej polisie. Flaga FIRMA_NO_NIP
 *   sprawdza: polisa type=FIRMA AND klient nie ma żadnej firmy z NIP.
 *
 * UWAGA vehicleReg:
 *   dataMapper.ts inicjalizuje vehicleReg = "" (pusty string), nie null.
 *   Sprawdzamy !vehicleReg (łapie "" i undefined/null).
 *
 * UWAGA sub_agent:
 *   Col[13] z XLSX nie jest dostępny w stanie frontendu po imporcie.
 *   Flaga sub-agenta POMINIĘTA — nie ma danych do weryfikacji.
 *   Gdy aiNote zawiera 'SUB_AGENT', flagujemy jako WARNING (heurystyka).
 */

import { Policy, Client } from "../types";

export type FlagSeverity = "CRITICAL" | "WARNING";

export interface PolicyFlag {
  code: string;
  label: string;
  emoji: string;
  tooltip: string;
  severity: FlagSeverity;
  /** ID polisy, której dotyczy flaga */
  policyId: string;
}

/**
 * Oblicza flagi dla jednej polisy + jej klienta.
 * Czysta funkcja — nie mutuje danych, nie wywoływuje efektów ubocznych.
 */
export function computePolicyFlags(
  policy: Policy,
  client: Client,
): PolicyFlag[] {
  const flags: PolicyFlag[] = [];
  const pid = policy.id;

  // ── FLAGA 1: brak numeru rejestracyjnego dla pojazdów ─────────────────────
  if (["OC", "AC", "BOTH"].includes(policy.type)) {
    const hasReg = !!(policy.vehicleReg && policy.vehicleReg.trim());
    // Also check new-schema vehicle.reg
    const hasVehicleReg = !!(policy.vehicle?.reg && policy.vehicle.reg.trim());
    if (!hasReg && !hasVehicleReg) {
      flags.push({
        code: "AUTO_NO_REG",
        label: "Brak rej.",
        emoji: "🚗",
        tooltip:
          "Brak numeru rejestracyjnego pojazdu — uzupełnij w edycji polisy",
        severity: "CRITICAL",
        policyId: pid,
      });
    }
  }

  // ── FLAGA 2: brak NIP firmy (polisa FIRMA, klient bez żadnej firmy z NIP) ─
  if (policy.type === "FIRMA") {
    const hasNip = client.businesses?.some((b) => !!(b.nip && b.nip.trim()));
    if (!hasNip) {
      flags.push({
        code: "FIRMA_NO_NIP",
        label: "Brak NIP",
        emoji: "🏢",
        tooltip:
          "Polisa firmowa, ale klient nie ma żadnej firmy z uzupełnionym NIP — edytuj dane klienta",
        severity: "CRITICAL",
        policyId: pid,
      });
    }
  }

  // ── FLAGA 3: brak typu polisy ─────────────────────────────────────────────
  if (!policy.type) {
    flags.push({
      code: "NO_TYPE",
      label: "Brak typu",
      emoji: "❓",
      tooltip: "Typ polisy nie został określony — wymaga ręcznej klasyfikacji",
      severity: "CRITICAL",
      policyId: pid,
    });
  }

  // ── FLAGA 4: aiNote zawiera "BRAK DANYCH" ────────────────────────────────
  if (policy.aiNote?.includes("BRAK DANYCH")) {
    flags.push({
      code: "AI_BRAK_DANYCH",
      label: "Brak danych",
      emoji: "❓",
      tooltip: `AI nie rozpoznało danych: ${policy.aiNote}`,
      severity: "WARNING",
      policyId: pid,
    });
  }

  // ── FLAGA 5: podejrzanie długa PODROZ (>60 dni) ──────────────────────────
  if (
    policy.type === "PODROZ" &&
    policy.policyStartDate &&
    policy.policyEndDate
  ) {
    const start = new Date(policy.policyStartDate);
    const end = new Date(policy.policyEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffDays = Math.round(
        (end.getTime() - start.getTime()) / 86_400_000,
      );
      if (diffDays > 60) {
        flags.push({
          code: "PODROZ_LONG",
          label: `Długa (${diffDays}d)`,
          emoji: "📅",
          tooltip: `Polisa PODROZ trwa ${diffDays} dni — sprawdź czy daty są poprawne`,
          severity: "WARNING",
          policyId: pid,
        });
      }
    }
  }

  // ── FLAGA 6: aiNote zawiera "PODROZ_END_DATE_MISSING" ────────────────────
  if (policy.aiNote?.includes("PODROZ_END_DATE_MISSING")) {
    flags.push({
      code: "PODROZ_NO_END",
      label: "Brak daty końca",
      emoji: "📅",
      tooltip: "Brak daty końca polisy PODROZ — uzupełnij w edycji",
      severity: "CRITICAL",
      policyId: pid,
    });
  }

  // ── FLAGA 7: heurystyka sub-agenta przez aiNote ───────────────────────────
  // Col[13] z XLSX nie jest dostępny po stronie frontendu — pomijamy pełną weryfikację.
  // Gdy AI zapisało SUB_AGENT w notatce, flagujemy jako WARNING.
  if (policy.aiNote?.includes("SUB_AGENT")) {
    flags.push({
      code: "SUB_AGENT_HINT",
      label: "Sub-agent?",
      emoji: "🤝",
      tooltip:
        "AI wykryło możliwy udział pośrednika — sprawdź linki sub-agenta",
      severity: "WARNING",
      policyId: pid,
    });
  }

  return flags;
}

/**
 * Oblicza liczbę unikalnych flag dla klienta (wszystkie polisy łącznie).
 * Używane przez ClientsList do sortowania i filtru "tylko z flagami".
 */
export function computeClientFlagCount(
  client: Client,
  policies: Policy[],
): number {
  const clientPolicies = policies.filter((p) => p.clientId === client.id);
  let total = 0;
  for (const policy of clientPolicies) {
    total += computePolicyFlags(policy, client).length;
  }
  // Flaga na kliencie (nie per polisa): PESEL niezaszyfrowany
  if (client.pesel_encrypted_pending) {
    total += 1;
  }
  return total;
}

/**
 * Flagi na poziomie klienta (niezwiązane z konkretną polisą).
 */
export interface ClientFlag {
  code: string;
  label: string;
  emoji: string;
  tooltip: string;
  severity: FlagSeverity;
}

export function computeClientLevelFlags(client: Client): ClientFlag[] {
  const flags: ClientFlag[] = [];
  if (client.pesel_encrypted_pending) {
    flags.push({
      code: "PESEL_PENDING",
      label: "PESEL niezaszyfrowany",
      emoji: "⚠️",
      tooltip:
        "PESEL klienta oczekuje na migrację DEK — nie udostępniaj danych!",
      severity: "CRITICAL",
    });
  }
  return flags;
}
