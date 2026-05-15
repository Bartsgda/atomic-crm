/**
 * slotStore.test.ts — Testy walidacji i query-building dla SlotStore.
 *
 * Strategia: NIE importujemy Supabase (browser-mode Vitest nie obsluguje vi.mock
 * z dynamicznym resolvingiem modulow zewnetrznych). Zamiast tego:
 *   1. Testujemy assertValidSlot() bezposrednio — czysta funkcja bez side-effectow.
 *   2. Wstrzykujemy fake klient przez konstruktor SlotStore(fakeClient) — DI pattern.
 *      Fake klient to plain object zwracajacy chain (fluent API) konczacy sie
 *      Promise.resolve(result). Nie wymaga vi.mock.
 *
 * Testy integracyjne (realny DB): oznaczone it.skip z TODO.
 */

import { describe, it, expect } from "vitest";
import { SlotStore, assertValidSlot } from "../legacy-v1/services/slotStore";
import type {
  SlotRow,
  SlotSupabaseClient,
} from "../legacy-v1/services/slotStore";

// ─── Fake Supabase client (chain builder bez importu Supabase) ────────────────

interface FakeChain {
  _calls: Record<string, unknown[][]>;
  _result: { data: unknown; error: unknown };
  then: Promise<{ data: unknown; error: unknown }>["then"];
  from(name: string): FakeChain;
  insert(data: unknown): FakeChain;
  select(cols: string): FakeChain;
  single(): Promise<{ data: unknown; error: unknown }>;
  delete(): FakeChain;
  eq(col: string, val: unknown): FakeChain;
  order(col: string, opts: unknown): FakeChain;
  limit(n: number): FakeChain;
  range(from: number, to: number): Promise<{ data: unknown; error: unknown }>;
  contains(col: string, val: unknown): FakeChain;
}

function makeFakeClient(result: { data: unknown; error: unknown }): {
  client: SlotSupabaseClient;
  chain: FakeChain;
} {
  const calls: Record<string, unknown[][]> = {};

  const track = (method: string, args: unknown[]) => {
    if (!calls[method]) calls[method] = [];
    calls[method].push(args);
  };

  // chain jest thenable — `await chain` rozwiazuje do result.
  // Dzieki temu metody ktore nie konczą sie na single()/range() (np. limit(), contains())
  // tez poprawnie rozwiazuja sie przez `await query` w SlotStore.read().
  const chain: FakeChain = {
    _calls: calls,
    _result: result,
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
    from(name) {
      track("from", [name]);
      return chain;
    },
    insert(data) {
      track("insert", [data]);
      return chain;
    },
    select(cols) {
      track("select", [cols]);
      return chain;
    },
    single() {
      track("single", []);
      return Promise.resolve(result);
    },
    delete() {
      track("delete", []);
      return chain;
    },
    eq(col, val) {
      track("eq", [col, val]);
      return chain;
    },
    order(col, opts) {
      track("order", [col, opts]);
      return chain;
    },
    limit(n) {
      track("limit", [n]);
      return chain;
    },
    range(from, to) {
      track("range", [from, to]);
      return Promise.resolve(result);
    },
    contains(col, val) {
      track("contains", [col, val]);
      return chain;
    },
  };

  return { client: { from: chain.from.bind(chain) }, chain };
}

// ─── Testy assertValidSlot (czysta funkcja) ───────────────────────────────────

describe("assertValidSlot — walidacja nazwy slotu", () => {
  it("rzuca dla slot_00 (poza zakresem)", () => {
    expect(() => assertValidSlot("slot_00")).toThrow(
      "Nieprawidlowa nazwa slotu",
    );
  });

  it("rzuca dla slot_31 (poza zakresem)", () => {
    expect(() => assertValidSlot("slot_31")).toThrow(
      "Nieprawidlowa nazwa slotu",
    );
  });

  it("rzuca dla pustego stringa", () => {
    expect(() => assertValidSlot("")).toThrow("Nieprawidlowa nazwa slotu");
  });

  it("rzuca dla potencjalnego SQL injection", () => {
    expect(() => assertValidSlot("slot_01; DROP TABLE test.tenants")).toThrow(
      "Nieprawidlowa nazwa slotu",
    );
  });

  it("akceptuje slot_01", () => {
    expect(() => assertValidSlot("slot_01")).not.toThrow();
  });

  it("akceptuje slot_15", () => {
    expect(() => assertValidSlot("slot_15")).not.toThrow();
  });

  it("akceptuje slot_30", () => {
    expect(() => assertValidSlot("slot_30")).not.toThrow();
  });

  it("rzuca dla slot_29X (nadmiarowe znaki)", () => {
    expect(() => assertValidSlot("slot_29X")).toThrow(
      "Nieprawidlowa nazwa slotu",
    );
  });
});

// ─── Testy query-building przez wstrzykniety fake klient ─────────────────────

describe("SlotStore.write() — query building", () => {
  it("wywoluje from(slot) -> insert({payload}) -> select('id') -> single()", async () => {
    const { client, chain } = makeFakeClient({
      data: { id: "abc-123" },
      error: null,
    });
    const store = new SlotStore(client);
    const id = await store.write("slot_03", "ocr_job", { jobId: 42 });
    expect(chain._calls["from"][0]).toEqual(["slot_03"]);
    expect(chain._calls["insert"][0]).toEqual([
      { payload: { ocr_job: { jobId: 42 } } },
    ]);
    expect(chain._calls["select"][0]).toEqual(["id"]);
    expect(chain._calls["single"]).toHaveLength(1);
    expect(id).toBe("abc-123");
  });

  it("INSERT-always: dwa write() do tego samego slotu = dwa osobne insert()", async () => {
    const { client, chain } = makeFakeClient({
      data: { id: "x" },
      error: null,
    });
    const store = new SlotStore(client);
    await store.write("slot_05", "k", "v1");
    await store.write("slot_05", "k", "v2");
    expect(chain._calls["insert"]).toHaveLength(2);
    expect(chain._calls["insert"][0]).toEqual([{ payload: { k: "v1" } }]);
    expect(chain._calls["insert"][1]).toEqual([{ payload: { k: "v2" } }]);
  });

  it("rzuca z komunikatem gdy Supabase zwroci error", async () => {
    const { client } = makeFakeClient({
      data: null,
      error: { message: "connection refused" },
    });
    const store = new SlotStore(client);
    await expect(store.write("slot_02", "k", "v")).rejects.toThrow(
      "[slotStore.write] slot_02: connection refused",
    );
  });

  it("rzuca dla niewalidnej nazwy slotu (walidacja przed DB)", async () => {
    const { client, chain } = makeFakeClient({ data: null, error: null });
    const store = new SlotStore(client);
    await expect(store.write("slot_00", "k", "v")).rejects.toThrow(
      "Nieprawidlowa",
    );
    // Upewniamy sie ze from() nie zostalo wywolane (walidacja przed dotkieciem DB)
    expect(chain._calls["from"]).toBeUndefined();
  });
});

describe("SlotStore.delete() — query building", () => {
  it("wywoluje from(slot) -> delete() -> eq('id', id)", async () => {
    const { client, chain } = makeFakeClient({ data: null, error: null });
    const store = new SlotStore(client);
    await store.delete("slot_07", "row-uuid-xyz");
    expect(chain._calls["from"][0]).toEqual(["slot_07"]);
    expect(chain._calls["delete"]).toHaveLength(1);
    expect(chain._calls["eq"][0]).toEqual(["id", "row-uuid-xyz"]);
  });
});

describe("SlotStore.read() — query building", () => {
  const emptyResult = { data: [] as SlotRow[], error: null };

  it("bez filtra: nie wywoluje contains()", async () => {
    const { client, chain } = makeFakeClient(emptyResult);
    const store = new SlotStore(client);
    await store.read("slot_10");
    expect(chain._calls["contains"]).toBeUndefined();
    expect(chain._calls["limit"]).toHaveLength(1);
  });

  it("z filtrem: wywoluje contains(payload, {key: value})", async () => {
    const { client, chain } = makeFakeClient(emptyResult);
    const store = new SlotStore(client);
    await store.read("slot_10", { key: "status", value: "done" });
    expect(chain._calls["contains"][0]).toEqual([
      "payload",
      { status: "done" },
    ]);
  });

  it("rzuca z komunikatem gdy Supabase zwroci error", async () => {
    const { client } = makeFakeClient({
      data: null,
      error: { message: "schema not found" },
    });
    const store = new SlotStore(client);
    await expect(store.read("slot_04")).rejects.toThrow(
      "[slotStore.read] slot_04: schema not found",
    );
  });
});

describe("SlotStore.list() — query building", () => {
  it("wywoluje range(0, limit-1) z domyslnym limitem 100", async () => {
    const { client, chain } = makeFakeClient({ data: [], error: null });
    const store = new SlotStore(client);
    await store.list("slot_20");
    expect(chain._calls["range"][0]).toEqual([0, 99]);
  });

  it("respektuje limit i offset", async () => {
    const { client, chain } = makeFakeClient({ data: [], error: null });
    const store = new SlotStore(client);
    await store.list("slot_20", 10, 20);
    expect(chain._calls["range"][0]).toEqual([20, 29]);
  });

  it("rzuca z komunikatem gdy Supabase zwroci error", async () => {
    const { client } = makeFakeClient({
      data: null,
      error: { message: "rls denied" },
    });
    const store = new SlotStore(client);
    await expect(store.list("slot_01")).rejects.toThrow(
      "[slotStore.list] slot_01: rls denied",
    );
  });
});

// ─── Testy integracyjne (wymagaja zaalokowanego DB) ──────────────────────────

describe("SlotStore — integracja (skip — migracja nie zaaplikowana)", () => {
  it.skip("write() + read() round-trip (wymaga test.slot_01 w Supabase po zaaplikowaniu 20260515_reserved_slots.sql)", async () => {
    // TODO po wklejeniu SQL w Dashboard:
    // const { slotStore } = await import('../legacy-v1/services/slotStore');
    // const id = await slotStore.write('slot_01', 'test_key', { hello: 'world' });
    // const rows = await slotStore.read('slot_01');
    // expect(rows.some(r => r.id === id)).toBe(true);
    // await slotStore.delete('slot_01', id);
  });

  it.skip("list() paginacja — kolejne strony (wymaga >2 wierszy w slocie)", async () => {
    // TODO po wklejeniu SQL w Dashboard:
    // Wstaw 5 wierszy, list(slot, 2, 0) zwraca 2, list(slot, 2, 2) zwraca kolejne 2
  });
});
