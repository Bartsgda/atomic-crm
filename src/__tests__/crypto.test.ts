/**
 * crypto.test.ts — Testy envelope encryption dla PESEL DEK (task 2026-05-15).
 *
 * Pokrywa:
 *   - encryptPesel/decryptPesel round-trip
 *   - wrong DEK → throw
 *   - replay attack: same plaintext + same DEK → różne ciphertext (random IV)
 *   - looksEncrypted / looksLikePlaintextPesel heurystyki
 *   - deriveDek alias = deriveKEK (sanity)
 *   - wrapDEK + unwrapDEK round-trip via passphrase
 */
import { describe, it, expect } from "vitest";
import {
  generateDEK,
  generateSalt,
  deriveDek,
  deriveKEK,
  encryptPesel,
  decryptPesel,
  encryptField,
  decryptField,
  wrapDEK,
  unwrapDEK,
  looksEncrypted,
  looksLikePlaintextPesel,
} from "../legacy-v1/services/crypto";

const GABRIEL_PESEL = "18221803056"; // PESEL z row_110 — używamy jako stała testowa, NIE prawdziwy

describe("crypto.ts — PESEL DEK envelope", () => {
  it("encryptPesel/decryptPesel round-trip preserves plaintext", async () => {
    const dek = await generateDEK();
    const ct = await encryptPesel(GABRIEL_PESEL, dek);
    expect(ct).not.toContain(GABRIEL_PESEL); // raw PESEL nie wycieka do ct
    expect(ct.length).toBeGreaterThan(28); // envelope = IV(12)+ct(11)+tag(16) → Base64 ~52
    const pt = await decryptPesel(ct, dek);
    expect(pt).toBe(GABRIEL_PESEL);
  });

  it("decryptPesel with wrong DEK throws", async () => {
    const dek1 = await generateDEK();
    const dek2 = await generateDEK();
    const ct = await encryptPesel(GABRIEL_PESEL, dek1);
    await expect(decryptPesel(ct, dek2)).rejects.toThrow();
  });

  it("encryptPesel produces different ciphertext for same plaintext (random IV)", async () => {
    const dek = await generateDEK();
    const ct1 = await encryptPesel(GABRIEL_PESEL, dek);
    const ct2 = await encryptPesel(GABRIEL_PESEL, dek);
    expect(ct1).not.toBe(ct2); // replay-attack resistance
    expect(await decryptPesel(ct1, dek)).toBe(GABRIEL_PESEL);
    expect(await decryptPesel(ct2, dek)).toBe(GABRIEL_PESEL);
  });

  it("encryptPesel rejects empty plaintext", async () => {
    const dek = await generateDEK();
    await expect(encryptPesel("", dek)).rejects.toThrow();
  });

  it("encryptField/decryptField round-trip dla wartości innych niż PESEL", async () => {
    const dek = await generateDEK();
    const samples = [
      "jan.kowalski@example.com",
      "+48 600 700 800",
      "ul. Słoneczna 5/3 Gdańsk",
      "POL-2024-AC-0001234",
      "GD12345", // tablica rejestracyjna
    ];
    for (const s of samples) {
      const ct = await encryptField(s, dek);
      expect(ct).not.toContain(s);
      expect(await decryptField(ct, dek)).toBe(s);
    }
  });
});

describe("crypto.ts — heurystyki", () => {
  it("looksLikePlaintextPesel rozpoznaje 11 cyfr", () => {
    expect(looksLikePlaintextPesel("18221803056")).toBe(true);
    expect(looksLikePlaintextPesel("  18221803056  ")).toBe(true); // trim
    expect(looksLikePlaintextPesel(null)).toBe(false);
    expect(looksLikePlaintextPesel(undefined)).toBe(false);
    expect(looksLikePlaintextPesel("")).toBe(false);
    expect(looksLikePlaintextPesel("1234567890")).toBe(false); // 10 cyfr
    expect(looksLikePlaintextPesel("182218030567")).toBe(false); // 12 cyfr
    expect(looksLikePlaintextPesel("ABCD1234567")).toBe(false);
  });

  it("looksEncrypted odrzuca raw 11-cyfrowy PESEL (heurystyka długości)", () => {
    expect(looksEncrypted("18221803056")).toBe(false); // 11 znaków < 28
  });

  it("looksEncrypted akceptuje rzeczywisty ciphertext", async () => {
    const dek = await generateDEK();
    const ct = await encryptPesel(GABRIEL_PESEL, dek);
    expect(looksEncrypted(ct)).toBe(true);
    expect(looksLikePlaintextPesel(ct)).toBe(false); // wzajemnie wykluczające
  });

  it("looksEncrypted odrzuca tekst z polskimi znakami", () => {
    expect(
      looksEncrypted("ul. Słoneczna Gdańsk Bartek długa-długa wartość"),
    ).toBe(false);
  });
});

describe("crypto.ts — KEK / wrap DEK (passphrase flow)", () => {
  it("deriveDek alias zwraca CryptoKey identyczny semantycznie z deriveKEK", async () => {
    const salt = generateSalt();
    const kek1 = await deriveKEK("hasło-aliny-1234", salt, 100_000);
    const kek2 = await deriveDek("hasło-aliny-1234", salt, 100_000);
    // CryptoKey nie da się porównać po referencji — sprawdzamy że oba unwrapują ten sam ciphertext
    const dek = await generateDEK();
    const wrapped = await wrapDEK(dek, kek1);
    const dek2 = await unwrapDEK(wrapped, kek2);
    // jeśli kek1==kek2 semantycznie, unwrap zadziała
    const ct = await encryptPesel(GABRIEL_PESEL, dek);
    expect(await decryptPesel(ct, dek2)).toBe(GABRIEL_PESEL);
  });

  it("unwrapDEK z błędnym hasłem rzuca 'Invalid passphrase'", async () => {
    const salt = generateSalt();
    const kekGood = await deriveKEK("hasło-OK", salt, 100_000);
    const kekBad = await deriveKEK("hasło-ZŁE", salt, 100_000);
    const dek = await generateDEK();
    const wrapped = await wrapDEK(dek, kekGood);
    await expect(unwrapDEK(wrapped, kekBad)).rejects.toThrow(
      /Invalid passphrase/,
    );
  });
});
