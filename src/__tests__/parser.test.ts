/**
 * parser.test.ts — Testy specyfikacyjne parserów legacy (Faza 2, AUDIT_PLAN.md)
 *
 * UWAGA: Testy bazują na SPECS, nie na aktualnym kodzie.
 * Mogą failować dopóki agenci #2/#3 nie naprawią bugów w:
 *   - services/dataMapper.ts (parseNotes, parseAddress — do dodania/naprawienia)
 *   - modules/utils/secondaryParsers.ts (parseCoOwnerColumn — BUG #3 + wzorzec #18)
 *   - modules/utils/legacyParser.ts (parseAutoString — BUG #5 PL plate regex)
 *
 * Importy: parseNotes i parseAddress są planowane jako named exports z dataMapper.ts.
 * parseCoOwnerColumn — obecne API zwraca { coOwners[], ownershipType?, assignment? }.
 *   Po bugfixie BUG #3: wykrycie "pesel kl …" ma zwrócić specjalny obiekt z type='CLIENT_PESEL'.
 *   Po naprawie wzorca #18: wykrycie "Ubezpieczony <Imię> PESEL <11>" → type='INSURED_PERSON'.
 * parseAutoString — obecne API zwraca { vehicleReg, vehicleBrand, autoDetails }.
 *   Testy weryfikują docelowe pola po refaktorze (reg, vehicleType).
 */

import { describe, it, expect } from "vitest";

// parseNotes i parseAddress będą dodane jako named exports z dataMapper.ts przez agenta #2.
// @ts-expect-error — tymczasowe dopóki agenci nie dodadzą tych eksportów
import { parseNotes, parseAddress } from "@/legacy-v1/services/dataMapper";

import { parseCoOwnerColumn } from "@/legacy-v1/modules/utils/secondaryParsers";
import { parseAutoString } from "@/legacy-v1/modules/utils/legacyParser";

// ── BUG #1 — Splitter notatek z datą inline ──────────────────────────────────

describe("parseNotes — BUG #1 splitter inline date", () => {
  it('splits "a_b 11.06.2025 c" into 2 or more notes', () => {
    // Obecny parser rozdziela tylko po "_".
    // Docelowo: split po "_" LUB po dacie inline (regex w AUDIT_PLAN.md § Faza 2 bug 1).
    // Wynik: ≥2 notatki; jedna powinna zawierać "11.06" lub "c" (fragment po dacie).
    const notes = parseNotes("a_b 11.06.2025 c", new Date("2025-01-01"));
    expect(notes.length).toBeGreaterThanOrEqual(2);
    const withDate = notes.find(
      (n: { content: string }) =>
        n.content.includes("11.06") || n.content.includes("c"),
    );
    expect(withDate).toBeDefined();
  });
});

// ── BUG #2 — Adres bez prefiksu "ul." (Pomorze zip-lookup) ───────────────────

describe("parseAddress — BUG #2 Pomorze zip-lookup", () => {
  it('parses "80-442 Lelewela 36/140B" with city=Gdansk', () => {
    // Kody 80-xxx → Gdańsk (zip-lookup tabela dla Pomorza).
    // Docelowo: city='Gdańsk', zip='80-442', street zawiera 'Lelewela'.
    const r = parseAddress("80-442 Lelewela 36/140B");
    expect(r.zip).toBe("80-442");
    expect(r.city).toBe("Gdańsk");
    expect(r.street).toContain("Lelewela");
  });

  it("parses Gdynia 81-xxx ZIP", () => {
    // Kody 81-xxx → Gdynia.
    const r = parseAddress("81-001 Witomińska 5");
    expect(r.city).toBe("Gdynia");
  });
});

// ── BUG #3 + wzorzec #18 — parseCoOwnerColumn CLIENT_PESEL / INSURED_PERSON ──

describe("parseCoOwnerColumn — BUG #3 + wzorzec #18", () => {
  it('detects CLIENT_PESEL from "pesel kl 86080119155" (BUG #3)', () => {
    // Obecne zachowanie (BUG): parser tworzy fake coOwner z phone=peseldigits.
    // Docelowe zachowanie po bugfixie agenta #3:
    //   → zwraca obiekt z type='CLIENT_PESEL' i pesel='86080119155'.
    //   → caller (dataMapper) zapisuje to do client.pesel_encrypted (nie do coOwners[]).
    // Interfejs może być rozszerzony albo parseCoOwnerColumn może zwracać union type.
    const r = parseCoOwnerColumn("pesel kl 86080119155") as any;
    // Po bugfixie: pole type (na poziomie zwróconego obiektu lub w coOwners[0])
    const type = r?.type ?? r?.coOwners?.[0]?.type;
    expect(type).toBe("CLIENT_PESEL");
    const pesel = r?.pesel ?? r?.coOwners?.[0]?.pesel;
    expect(pesel).toBe("86080119155");
  });

  it('detects INSURED_PERSON from "Ubezpieczony Gabriel Zaklicki PESEL 18221803056" (row_110, wzorzec #18)', () => {
    // Wzorzec #18 z AUDIT_ROWS_91_110 § row_110:
    //   ZYCIE/NNW szkolne — ubezpieczony ≠ ubezpieczający.
    //   col[18] = "Ubezpieczony <imię> PESEL <11cyfr>"
    //   → docelowo: type='INSURED_PERSON', firstName, lastName, pesel.
    //   → caller zapisuje do life_details.insured_name + insured_pesel_encrypted (nie do coOwners[]).
    const r = parseCoOwnerColumn(
      "Ubezpieczony Gabriel Zaklicki PESEL 18221803056",
    ) as any;
    const type = r?.type ?? r?.coOwners?.[0]?.type;
    expect(type).toBe("INSURED_PERSON");
    const firstName = r?.firstName ?? r?.coOwners?.[0]?.firstName;
    const lastName = r?.lastName ?? r?.coOwners?.[0]?.lastName;
    const pesel = r?.pesel ?? r?.coOwners?.[0]?.pesel;
    expect(firstName).toBe("Gabriel");
    expect(lastName).toBe("Zaklicki");
    expect(pesel).toBe("18221803056");
  });
});

// ── BUG #5 — PL plate regex + blacklist ──────────────────────────────────────

describe("parseAutoString — BUG #5 PL plate regex", () => {
  it('extracts GD72N6 from "Stark Outlander_GD72N6_QUAD"', () => {
    // Docelowy regex: wymusza ≥1 cyfrę w sufiksie tablicy.
    // vehicleReg powinno być "GD72N6".
    const r = parseAutoString("Stark Outlander_GD72N6_QUAD") as any;
    const reg = r?.reg ?? r?.vehicleReg;
    expect(reg).toBe("GD72N6");
  });

  it('returns null/empty reg for blacklisted words "NNW ASS"', () => {
    // Blacklist: NNW, ASS, TDI, LPG, PZU, RAV4, CX5, VIII, OC, AC.
    // Ciągi z samych słów blacklistowanych → reg powinno być null/pusty string.
    const r = parseAutoString("NNW ASS") as any;
    const reg = r?.reg ?? r?.vehicleReg;
    expect(reg == null || reg === "").toBe(true);
  });

  it('extracts valid plate GD12345 from "Toyota RAV4 GD12345" (RAV4 is blacklisted)', () => {
    // RAV4 pasuje do wzorca tablicy, ale jest w blackliście → nie może być reg.
    // Prawdziwa tablica "GD12345" powinna być wyciągnięta.
    const r = parseAutoString("Toyota RAV4 GD12345") as any;
    const reg = r?.reg ?? r?.vehicleReg;
    expect(reg).toBe("GD12345");
  });
});
