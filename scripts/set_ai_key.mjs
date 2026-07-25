#!/usr/bin/env node
/**
 * set_ai_key.mjs — zapis klucza Gemini API zaszyfrowanego DEK (CRM-ALINA).
 *
 * Szyfruje klucz TYM SAMYM mechanizmem co dane klientów (envelope DEK) — hasłem
 * aplikacji, którego Alina używa do odszyfrowania tabel. Zaszyfrowany blob ląduje
 * w public.tenant_config.encrypted_api_key. Klucz NIE jest w bundlu, NIE w rrv.
 * Przy logowaniu PassphraseGate odszyfrowuje go DEK-iem → apiKeyStore (pamięć sesji).
 *
 * URUCHOM W SWOIM TERMINALU (hasło + klucz podajesz interaktywnie — NIE trafiają
 * do rozmowy z AI ani do historii powłoki):
 *     node scripts/set_ai_key.mjs
 *
 * Wymaga env (rr-claude wstrzykuje z vault): CRM_ALINA_SB_SECRET, opcjonalnie CRM_ALINA_SUPABASE_URL.
 */

import { webcrypto } from "node:crypto";
import readline from "node:readline";
import { Writable } from "node:stream";

const subtle = webcrypto.subtle;
const URL_BASE =
  process.env.CRM_ALINA_SUPABASE_URL || "https://xqznrssrlnxqkdvisnck.supabase.co";
const SECRET = process.env.CRM_ALINA_SB_SECRET;
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

if (!SECRET) {
  console.error("Brak CRM_ALINA_SB_SECRET w env. Odpal w sesji rr-claude.");
  process.exit(1);
}
const headers = {
  apikey: SECRET,
  authorization: `Bearer ${SECRET}`,
  "content-type": "application/json",
};

// ── crypto (mirror services/crypto.ts) ──────────────────────────────────────
const b64ToBuf = (b64) => new Uint8Array(Buffer.from(b64, "base64"));
const bufToB64 = (buf) => Buffer.from(buf).toString("base64");

async function deriveKEK(passphrase, salt, iterations) {
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["unwrapKey"],
  );
}
async function unwrapDEK(wrappedB64, kek) {
  const raw = b64ToBuf(wrappedB64);
  const iv = raw.slice(0, 12);
  const data = raw.slice(12);
  return subtle.unwrapKey(
    "raw",
    data,
    kek,
    { name: "AES-GCM", iv },
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );
}
async function encryptField(plaintext, dek) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    new TextEncoder().encode(plaintext),
  );
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return bufToB64(out);
}

// ── interaktywny prompt (hasło/klucz nie echo) ──────────────────────────────
function ask(question, hidden = false) {
  const muted = new Writable({
    write(chunk, enc, cb) {
      if (!hidden) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    process.stdout.write(question);
    rl.question("", (ans) => {
      if (hidden) process.stdout.write("\n");
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  // Email + klucz z env (są w sesji vault). Podajesz TYLKO hasło aplikacji.
  const email = process.env.CRM_AI_KEY_EMAIL || "redroadai@gmail.com";
  const apiKey =
    process.env.CRM_ALINA_GEMINI_KEY ||
    process.env.GEMINI_API_KEY_1 ||
    process.env.GEMINI_API_KEY_2;
  if (!apiKey) {
    console.error(
      "Brak klucza Gemini w env (CRM_ALINA_GEMINI_KEY / GEMINI_API_KEY_1/2). Odpal przez SET_AI_KEY.bat (ładuje vault).",
    );
    process.exit(1);
  }
  console.log(`User do zaszyfrowania: ${email}`);
  const passphrase = await ask(
    "Hasło aplikacji Aliny (jedyne co podajesz): ",
    true,
  );
  if (!passphrase) {
    console.error("Hasło jest wymagane.");
    process.exit(1);
  }

  // user_id z email
  const usersRes = await fetch(
    `${URL_BASE}/auth/v1/admin/users?per_page=1000`,
    { headers },
  );
  if (!usersRes.ok) {
    console.error("auth admin users:", usersRes.status);
    process.exit(1);
  }
  const users = (await usersRes.json()).users || [];
  const user = users.find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    console.error(`Nie znaleziono usera ${email}. Znani: ${users.map((u) => u.email).join(", ")}`);
    process.exit(1);
  }

  // tenant_keys (wrapped_dek, salt, iterations)
  const tkRes = await fetch(
    `${URL_BASE}/rest/v1/tenant_keys?select=wrapped_dek,kdf_salt,kdf_iterations&user_id=eq.${user.id}&order=key_version.desc&limit=1`,
    { headers },
  );
  const tk = await tkRes.json();
  if (!tk.length) {
    console.error("Brak tenant_keys dla tego usera (konto niezainicjalizowane).");
    process.exit(1);
  }
  const { wrapped_dek, kdf_salt, kdf_iterations } = tk[0];
  const salt = b64ToBuf(kdf_salt);

  // DEK z hasła
  const kek = await deriveKEK(passphrase, salt, kdf_iterations || 600000);
  let dek;
  try {
    dek = await unwrapDEK(wrapped_dek, kek);
  } catch {
    console.error("❌ Złe hasło — nie udało się odszyfrować DEK.");
    process.exit(1);
  }

  // Konfiguracja multi-key (spójna z panelem): {keys:[{purpose,label,key,model}]}.
  // CLI-backup zapisuje jeden wpis "main"; panel w Ustawieniach może dodać więcej (np. "ocr").
  const config = {
    keys: [
      { purpose: "main", label: "Główny (CLI)", key: apiKey, model: "gemini-3.1-flash-lite" },
    ],
  };
  const encrypted = await encryptField(JSON.stringify(config), dek);

  // upsert tenant_config (service_role omija RLS)
  const res = await fetch(`${URL_BASE}/rest/v1/tenant_config`, {
    method: "POST",
    headers: { ...headers, prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ tenant_id: TENANT_ID, encrypted_ai_config: encrypted }),
  });
  if (!res.ok) {
    console.error("Upsert tenant_config nieudany:", res.status, await res.text());
    process.exit(1);
  }
  console.log(
    "\n✅ Klucz Gemini zaszyfrowany DEK i zapisany w tenant_config.",
  );
  console.log(
    "   Alina po podaniu hasła aplikacji załaduje go do pamięci sesji (apiKeyStore).",
  );
}

main().catch((e) => {
  console.error("Błąd:", e?.message || e);
  process.exit(1);
});
