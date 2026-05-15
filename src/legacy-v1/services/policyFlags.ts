/**
 * policyFlags.ts — Faza 4 (AUDIT_PLAN.md § Faza 4)
 *
 * Flagi "wymaga uzupełnienia" dla polis i klientów.
 * Używane przez:
 *  - PolicyCardItem (ClientDetails.tsx) — badge per polisa
 *  - ClientsList.tsx — kolumna flag_count + filter "tylko z flagami"
 *  - FlagReminderWidget.tsx — system przypomnień (Faza 5, 2026-05-15)
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

import type { Policy, Client } from "../types";

// ─── FlagResolution — persistence per-flag ───────────────────────────────────

/**
 * Rekord z tabeli test.flag_resolutions.
 * Klucz mapy: `${targetType}:${targetId}:${flagType}`
 */
export interface FlagResolution {
  id: string;
  tenantId: string;
  targetType: "POLICY" | "CLIENT";
  targetId: string;
  flagType: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  dismissedAt: string | null;
  dismissReason: "snooze_today" | "manual_skip" | null;
  dismissedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Klucz do map resolutions: `${targetType}:${targetId}:${flagType}` */
export function resolutionKey(
  targetType: "POLICY" | "CLIENT",
  targetId: string,
  flagType: string,
): string {
  return `${targetType}:${targetId}:${flagType}`;
}

// ─── ActiveFlagItem — rozszerzona flaga z danymi klienta (do widgetu) ────────

export interface ActiveFlagItem {
  flag: PolicyFlag | ClientFlag;
  targetType: "POLICY" | "CLIENT";
  targetId: string;
  /** Nazwa klienta do wyświetlenia w widgecie (np. "Jan Kowalski") */
  clientName: string;
  /** ID klienta — do linku nawigacji */
  clientId: string;
  /** Opis kontekstu np. "Toyota Avensis GD72N6" dla AUTO_NO_REG */
  contextLabel: string;
  /** Data polisy/klienta do sortowania */
  sortDate: string;
}

// ─── selectTodaysFlags — algorytm doboru N flag na dziś ──────────────────────

/**
 * Wybiera N aktywnych flag do uzupełnienia dziś.
 *
 * Algorytm:
 * 1. Odfiltruj flagi z resolved_at IS NOT NULL
 * 2. Odfiltruj dismissed (manual_skip zawsze; snooze_today tylko jeśli
 *    dismissed_at jest dziś — po lokalnej północy snooze wraca)
 * 3. Sortuj: CRITICAL przed WARNING; w ramach priorytetu po sortDate ASC
 * 4. Weź pierwsze `quota` elementów
 *
 * UWAGA snooze_today: używamy `toDateString()` (locale-niezależne, porównuje
 * datę lokalną) zamiast UTC ::date — unika błędu strefy czasowej.
 */
export function selectTodaysFlags(
  allFlags: ActiveFlagItem[],
  resolutions: Map<string, FlagResolution>,
  quota: number,
): ActiveFlagItem[] {
  const todayStr = new Date().toDateString();

  const active = allFlags.filter((item) => {
    const key = resolutionKey(item.targetType, item.targetId, item.flag.code);
    const res = resolutions.get(key);
    if (!res) return true; // brak rekordu = aktywna

    // Rozwiązana → ukryj
    if (res.resolvedAt) return false;

    // Pominięta trwale → ukryj
    if (res.dismissedAt && res.dismissReason === "manual_skip") return false;

    // Snooze na dziś — ukryj tylko jeśli dismissed_at jest dziś lokalnie
    if (res.dismissedAt && res.dismissReason === "snooze_today") {
      const dismissedStr = new Date(res.dismissedAt).toDateString();
      if (dismissedStr === todayStr) return false;
      // snooze wygasł (był wczoraj lub starszy) → pokazuj z powrotem
    }

    return true;
  });

  // Sortuj: CRITICAL=0, WARNING=1; potem po sortDate ASC
  active.sort((a, b) => {
    const sa = a.flag.severity === "CRITICAL" ? 0 : 1;
    const sb = b.flag.severity === "CRITICAL" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return a.sortDate.localeCompare(b.sortDate);
  });

  return active.slice(0, quota);
}

/**
 * Zbiera wszystkie aktywne flagi (policy + client-level) jako ActiveFlagItem[].
 * Wywoływane przez FlagReminderWidget raz przy montowaniu / po zmianie stanu.
 */
export function collectAllFlags(
  clients: Client[],
  policies: Policy[],
): ActiveFlagItem[] {
  const items: ActiveFlagItem[] = [];

  for (const client of clients) {
    const clientPolicies = policies.filter((p) => p.clientId === client.id);
    const clientName = `${client.firstName} ${client.lastName}`.trim();

    // Flagi na polisach
    for (const policy of clientPolicies) {
      const flags = computePolicyFlags(policy, client);
      for (const flag of flags) {
        let contextLabel = "";
        if (flag.code === "AUTO_NO_REG") {
          contextLabel =
            [policy.vehicleBrand, policy.vehicleModel]
              .filter(Boolean)
              .join(" ") || "pojazd bez marki";
        } else if (flag.code === "FIRMA_NO_NIP") {
          contextLabel = "brak NIP w danych klienta";
        } else {
          contextLabel = policy.policyNumber || `polisa ${policy.type}`;
        }
        items.push({
          flag,
          targetType: "POLICY",
          targetId: policy.id,
          clientName,
          clientId: client.id,
          contextLabel,
          sortDate: policy.createdAt || "",
        });
      }
    }

    // Flagi na kliencie
    const clientFlags = computeClientLevelFlags(client);
    for (const flag of clientFlags) {
      items.push({
        flag,
        targetType: "CLIENT",
        targetId: client.id,
        clientName,
        clientId: client.id,
        contextLabel: "dane klienta",
        sortDate: (client as any).createdAt || "",
      });
    }
  }

  return items;
}

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
