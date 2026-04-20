/**
 * WebCrypto envelope encryption module for ALINA CRM.
 * DEK = AES-256-GCM 32-byte random key
 * KEK = PBKDF2-SHA256 derived from passphrase (600k iterations recommended)
 * All ciphertext format: Base64( IV[12] || ciphertext_with_GCM_tag )
 */

const subtle = window.crypto.subtle;

// ── Internal helpers ──────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function randomIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

// ── DEK ──────────────────────────────────────────────────────────────────────

/** Generate a new 256-bit AES-GCM Data Encryption Key. */
export async function generateDEK(): Promise<CryptoKey> {
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Export a DEK CryptoKey to its raw ArrayBuffer representation. */
export async function exportDEK(dek: CryptoKey): Promise<ArrayBuffer> {
  return subtle.exportKey("raw", dek);
}

/** Import a raw ArrayBuffer as an AES-GCM CryptoKey usable for encrypt/decrypt. */
export async function importDEK(raw: ArrayBuffer): Promise<CryptoKey> {
  return subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ── KEK / Salt ────────────────────────────────────────────────────────────────

/** Generate a 16-byte cryptographically random salt for PBKDF2. */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/** Derive an AES-256-GCM KEK from a passphrase using PBKDF2-SHA256. */
export async function deriveKEK(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

// ── Wrap / Unwrap DEK ─────────────────────────────────────────────────────────

/** Wrap DEK with KEK using AES-GCM. Returns Base64( IV[12] || wrapped_DEK_with_tag ). */
export async function wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<string> {
  const iv = randomIV();
  const wrapped = await subtle.wrapKey("raw", dek, kek, {
    name: "AES-GCM",
    iv,
  });
  const result = new Uint8Array(iv.byteLength + wrapped.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(wrapped), iv.byteLength);
  return bufToBase64(result.buffer);
}

/** Unwrap a Base64 DEK envelope with KEK. Throws "Invalid passphrase" on decryption failure. */
export async function unwrapDEK(
  wrappedBase64: string,
  kek: CryptoKey
): Promise<CryptoKey> {
  const raw = new Uint8Array(base64ToBuf(wrappedBase64));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  try {
    return await subtle.unwrapKey(
      "raw",
      data.buffer,
      kek,
      { name: "AES-GCM", iv },
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
  } catch {
    throw new Error("Invalid passphrase");
  }
}

// ── Field-level encryption ────────────────────────────────────────────────────

/** Encrypt a UTF-8 string with DEK. Returns Base64( IV[12] || ciphertext_with_tag ). */
export async function encryptField(
  plaintext: string,
  dek: CryptoKey
): Promise<string> {
  const iv = randomIV();
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    new TextEncoder().encode(plaintext)
  );
  const result = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.byteLength);
  return bufToBase64(result.buffer);
}

/** Decrypt a Base64 envelope ( IV[12] || ciphertext_with_tag ) with DEK. Returns UTF-8 string. */
export async function decryptField(
  ciphertextBase64: string,
  dek: CryptoKey
): Promise<string> {
  const raw = new Uint8Array(base64ToBuf(ciphertextBase64));
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  const plainBuf = await subtle.decrypt(
    { name: "AES-GCM", iv },
    dek,
    data.buffer
  );
  return new TextDecoder().decode(plainBuf);
}

// ── JSON batch helpers ────────────────────────────────────────────────────────

/** JSON-serialize any value then encrypt with DEK. Useful for arrays of phones/emails. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function encryptJsonField(value: any, dek: CryptoKey): Promise<string> {
  return encryptField(JSON.stringify(value), dek);
}

/** Decrypt a Base64-encoded JSON field with DEK and parse back to the original type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function decryptJsonField(ciphertextBase64: string, dek: CryptoKey): Promise<any> {
  const json = await decryptField(ciphertextBase64, dek);
  return JSON.parse(json);
}

// ── Heuristic ─────────────────────────────────────────────────────────────────

const PL_CHARS_RE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

/**
 * Heuristic: returns true if string looks like an encrypted Base64 blob.
 * Checks: valid Base64 alphabet, length >= 28, no Polish diacritics.
 */
export function looksEncrypted(s: string | null | undefined): boolean {
  if (!s || s.length < 28) return false;
  if (PL_CHARS_RE.test(s)) return false;
  return BASE64_RE.test(s.replace(/\s/g, ""));
}
