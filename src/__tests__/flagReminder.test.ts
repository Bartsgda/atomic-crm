/**
 * flagReminder.test.ts — Testy algorytmu selectTodaysFlags + collectAllFlags
 * (AUDIT_PLAN.md Faza 5 — system przypomnień uzupełnień)
 *
 * Testuje: selectTodaysFlags z różnymi stanami resolutions.
 * NIE testuje: Supabase calls (mock-free, czyste funkcje).
 */

import { describe, it, expect } from "vitest";
import type {
  ActiveFlagItem,
  FlagResolution,
} from "../legacy-v1/services/policyFlags";
import {
  selectTodaysFlags,
  resolutionKey,
} from "../legacy-v1/services/policyFlags";

// ─── Pomocnicze factory ───────────────────────────────────────────────────────

function makeFlag(
  code: string,
  severity: "CRITICAL" | "WARNING",
  sortDate = "2025-01-01",
  targetType: "POLICY" | "CLIENT" = "POLICY",
  targetId = `id-${code}`,
): ActiveFlagItem {
  return {
    flag: {
      code,
      label: code,
      emoji: "🚗",
      tooltip: code,
      severity,
      ...(targetType === "POLICY" ? { policyId: targetId } : {}),
    } as any,
    targetType,
    targetId,
    clientName: "Test Klient",
    clientId: "client-1",
    contextLabel: code,
    sortDate,
  };
}

function makeResolution(
  targetType: "POLICY" | "CLIENT",
  targetId: string,
  flagType: string,
  opts: Partial<FlagResolution> = {},
): [string, FlagResolution] {
  const key = resolutionKey(targetType, targetId, flagType);
  const res: FlagResolution = {
    id: "res-1",
    tenantId: "11111111-1111-1111-1111-111111111111",
    targetType,
    targetId,
    flagType,
    resolvedAt: null,
    resolvedByUserId: null,
    dismissedAt: null,
    dismissReason: null,
    dismissedByUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...opts,
  };
  return [key, res];
}

// ─── Test 1: Pusta lista flag — wynik pusty ───────────────────────────────────

describe("selectTodaysFlags", () => {
  it("returns empty array when no flags exist", () => {
    const result = selectTodaysFlags([], new Map(), 5);
    expect(result).toHaveLength(0);
  });

  // ─── Test 2: Wszystkie flagi resolved — wynik pusty ────────────────────────

  it("filters out all resolved flags", () => {
    const flags = [
      makeFlag("AUTO_NO_REG", "CRITICAL", "2025-01-01", "POLICY", "p1"),
      makeFlag("NO_TYPE", "WARNING", "2025-01-02", "POLICY", "p2"),
    ];
    const resolutions = new Map([
      makeResolution("POLICY", "p1", "AUTO_NO_REG", {
        resolvedAt: new Date().toISOString(),
      }),
      makeResolution("POLICY", "p2", "NO_TYPE", {
        resolvedAt: new Date().toISOString(),
      }),
    ]);
    const result = selectTodaysFlags(flags, resolutions, 5);
    expect(result).toHaveLength(0);
  });

  // ─── Test 3: Mix CRITICAL + WARNING — CRITICAL pierwsze ────────────────────

  it("sorts CRITICAL before WARNING within same quota", () => {
    const flags = [
      makeFlag("WARNING_FIRST", "WARNING", "2025-01-01", "POLICY", "p1"),
      makeFlag("CRITICAL_LAST", "CRITICAL", "2025-01-02", "POLICY", "p2"),
      makeFlag("WARNING_SECOND", "WARNING", "2025-01-01", "POLICY", "p3"),
      makeFlag("CRITICAL_FIRST", "CRITICAL", "2025-01-01", "POLICY", "p4"),
    ];
    const result = selectTodaysFlags(flags, new Map(), 4);
    expect(result[0].flag.severity).toBe("CRITICAL");
    expect(result[1].flag.severity).toBe("CRITICAL");
    expect(result[2].flag.severity).toBe("WARNING");
    expect(result[3].flag.severity).toBe("WARNING");
  });

  // ─── Test 4: snooze_today — reset po północy ───────────────────────────────

  it("snooze_today is hidden today but visible if dismissed yesterday", () => {
    const flag = makeFlag(
      "AUTO_NO_REG",
      "CRITICAL",
      "2025-01-01",
      "POLICY",
      "p1",
    );

    // Dziś — snooze aktywny
    const todayDismissed = new Date().toISOString();
    const resTodayMap = new Map([
      makeResolution("POLICY", "p1", "AUTO_NO_REG", {
        dismissedAt: todayDismissed,
        dismissReason: "snooze_today",
      }),
    ]);
    const hiddenToday = selectTodaysFlags([flag], resTodayMap, 5);
    expect(hiddenToday).toHaveLength(0); // snooze aktywny — ukryta

    // Wczoraj — snooze wygasł
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const resYesterdayMap = new Map([
      makeResolution("POLICY", "p1", "AUTO_NO_REG", {
        dismissedAt: yesterday.toISOString(),
        dismissReason: "snooze_today",
      }),
    ]);
    const visibleAfterSnooze = selectTodaysFlags([flag], resYesterdayMap, 5);
    expect(visibleAfterSnooze).toHaveLength(1); // snooze wygasł — widoczna
  });

  // ─── Test 5: manual_skip — permanent ──────────────────────────────────────

  it("manual_skip hides flag permanently (regardless of date)", () => {
    const flag = makeFlag(
      "FIRMA_NO_NIP",
      "CRITICAL",
      "2025-01-01",
      "POLICY",
      "p1",
    );
    const longAgo = new Date("2024-01-01").toISOString();
    const resolutions = new Map([
      makeResolution("POLICY", "p1", "FIRMA_NO_NIP", {
        dismissedAt: longAgo,
        dismissReason: "manual_skip",
      }),
    ]);
    const result = selectTodaysFlags([flag], resolutions, 5);
    expect(result).toHaveLength(0); // trwale pominięta
  });

  // ─── Test 6: quota limit ──────────────────────────────────────────────────

  it("respects quota limit", () => {
    const flags = Array.from({ length: 10 }, (_, i) =>
      makeFlag(
        `FLAG_${i}`,
        "CRITICAL",
        `2025-01-${String(i + 1).padStart(2, "0")}`,
        "POLICY",
        `p${i}`,
      ),
    );
    const result = selectTodaysFlags(flags, new Map(), 3);
    expect(result).toHaveLength(3);
  });

  // ─── Test 7: brak resolution record — flaga aktywna ──────────────────────

  it("treats missing resolution record as active flag", () => {
    const flag = makeFlag(
      "AUTO_NO_REG",
      "CRITICAL",
      "2025-01-01",
      "POLICY",
      "p1",
    );
    const result = selectTodaysFlags([flag], new Map(), 5);
    expect(result).toHaveLength(1);
  });

  // ─── Test 8: CLIENT target type działa ────────────────────────────────────

  it("handles CLIENT target type correctly", () => {
    const flag = makeFlag(
      "PESEL_PENDING",
      "CRITICAL",
      "2025-01-01",
      "CLIENT",
      "c1",
    );
    const resolutions = new Map([
      makeResolution("CLIENT", "c1", "PESEL_PENDING", {
        resolvedAt: new Date().toISOString(),
      }),
    ]);
    const result = selectTodaysFlags([flag], resolutions, 5);
    expect(result).toHaveLength(0); // resolved CLIENT flag hidden
  });
});
