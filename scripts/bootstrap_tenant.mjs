#!/usr/bin/env node
// Bootstrap: generuje DEK, zawija go hasłem PASSPHRASE dla każdego usera
// w tenancie Alina, wrzuca do tenant_keys, szyfruje wrażliwe pola seed-data
// i wrzuca do insurance_clients/policies/policy_notes.
//
// Użycie: node scripts/bootstrap_tenant.mjs

import fs from "node:fs";
import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;

// ── Config ──────────────────────────────────────────────────────────────────
const PASSPHRASE = "Test123!";
const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const PBKDF2_ITER = 600000;
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF = "xqznrssrlnxqkdvisnck";
const SUPABASE_URL = "https://xqznrssrlnxqkdvisnck.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Crypto helpers (mirror services/crypto.ts) ──────────────────────────────
function randomBytes(n) {
  const b = new Uint8Array(n);
  webcrypto.getRandomValues(b);
  return b;
}

function bufToBase64(buf) {
  return Buffer.from(buf).toString("base64");
}

async function generateDEK() {
  return subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function deriveKEK(passphrase, salt, iterations) {
  const baseKey = await subtle.importKey(
    "raw", new TextEncoder().encode(passphrase),
    "PBKDF2", false, ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, ["wrapKey", "unwrapKey"]
  );
}

async function wrapDEK(dek, kek) {
  const iv = randomBytes(12);
  const wrapped = await subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv });
  const out = new Uint8Array(iv.length + wrapped.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(wrapped), iv.length);
  return bufToBase64(out);
}

async function encryptField(plaintext, dek) {
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, dek, new TextEncoder().encode(plaintext));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return bufToBase64(out);
}

async function encryptJsonField(value, dek) {
  return encryptField(JSON.stringify(value), dek);
}

// ── Management API (SQL) ────────────────────────────────────────────────────
async function mgmtSql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${MGMT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── REST API (service_role) ─────────────────────────────────────────────────
async function rest(path, body, method = "POST") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    throw new Error(`REST ${method} ${path} ${r.status}: ${await r.text()}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("→ 1. Pobieram userów tenantu", TENANT_ID);
  const users = await mgmtSql(
    `select user_id, email from public.sales where tenant_id = '${TENANT_ID}' order by email`
  );
  console.log(`  Znaleziono ${users.length} userów:`, users.map(u => u.email).join(", "));

  console.log("→ 2. Generuję wspólny DEK dla tenantu");
  const dek = await generateDEK();

  console.log("→ 3. Wrap DEK dla każdego usera (hasło:", PASSPHRASE + ")");
  // Czyszczenie starych wpisów (re-seed)
  await mgmtSql(`delete from public.tenant_keys where tenant_id = '${TENANT_ID}'`);

  const keyRows = [];
  for (const u of users) {
    const salt = randomBytes(16);
    const kek = await deriveKEK(PASSPHRASE, salt, PBKDF2_ITER);
    const wrapped = await wrapDEK(dek, kek);
    keyRows.push({
      tenant_id: TENANT_ID,
      user_id: u.user_id,
      wrapped_dek: wrapped,
      kdf_salt: bufToBase64(salt),
      kdf_iterations: PBKDF2_ITER,
      kdf_algorithm: "PBKDF2-SHA256",
      key_version: 1,
      is_recovery: false,
    });
  }
  await rest("/tenant_keys", keyRows);
  console.log(`  ✓ Wpisano ${keyRows.length} kluczy`);

  console.log("→ 4. Czyszczenie starych danych testowych");
  await mgmtSql(`
    delete from public.policy_notes where tenant_id = '${TENANT_ID}';
    delete from public.policies where tenant_id = '${TENANT_ID}';
    delete from public.insurance_clients where tenant_id = '${TENANT_ID}';
    delete from public.insurance_trash where tenant_id = '${TENANT_ID}';
  `);

  console.log("→ 5. Wczytuję seed data");
  const seed = JSON.parse(fs.readFileSync("./test-data/fake_alina_seed.json", "utf-8"));

  console.log("→ 6. Szyfruję wrażliwe pola klientów");
  const clientRows = [];
  for (const c of seed.clients) {
    clientRows.push({
      id: c.id,
      tenant_id: TENANT_ID,
      first_name: c.firstName ?? null,
      last_name: c.lastName ?? null,
      pesel_encrypted: c.pesel ? await encryptField(c.pesel, dek) : null,
      birth_date: c.birthDate ?? null,
      gender: c.gender ?? null,
      phones: await encryptJsonField(c.phones ?? [], dek),
      emails: await encryptJsonField(c.emails ?? [], dek),
      businesses: c.businesses ?? [],
      street: c.street ? await encryptField(c.street, dek) : null,
      city: c.city ? await encryptField(c.city, dek) : null,
      zip_code: c.zipCode ? await encryptField(c.zipCode, dek) : null,
      source: "manual",
      is_fake: true,
    });
  }
  await rest("/insurance_clients", clientRows);
  console.log(`  ✓ Wpisano ${clientRows.length} klientów`);

  console.log("→ 7. Szyfruję wrażliwe pola polis");
  const stageMap = {
    "sprzedaż": "sprzedaz", "sprzedany": "sprzedaz",
    "of_do zrobienia": "of_do_zrobienia", "przeł kontakt": "przel_kontakt",
    "czekam na dane/dokum": "czekam_na_dane", "of_przedst": "oferta_wyslana",
    "oferta_wysłana": "oferta_wyslana", "ucięty kontakt": "uciety_kontakt",
    "rez po ofercie_kont za rok": "rez_po_ofercie",
  };
  const policyRows = [];
  for (const p of seed.policies) {
    policyRows.push({
      id: p.id,
      tenant_id: TENANT_ID,
      client_id: p.clientId,
      type: p.type === "INNE" ? "OTHER" : p.type,
      stage: stageMap[p.stage] ?? "of_do_zrobienia",
      insurer_name: p.insurerName ?? null,
      policy_number: p.policyNumber ? await encryptField(p.policyNumber, dek) : null,
      premium: p.premium ?? null,
      commission: p.commission ?? null,
      commission_rate: p.commissionRate ?? null,
      payment_status: p.paymentStatus ?? "UNPAID",
      policy_start_date: p.policyStartDate || null,
      policy_end_date: p.policyEndDate || null,
      vehicle_brand: p.vehicleBrand ?? null,
      vehicle_model: p.vehicleModel ?? null,
      vehicle_reg: p.vehicleReg ? await encryptField(p.vehicleReg, dek) : null,
      auto_details: p.autoDetails ?? null,
      home_details: p.homeDetails ? await encryptJsonField(p.homeDetails, dek) : null,
      life_details: p.lifeDetails ?? null,
      travel_details: p.travelDetails ?? null,
      original_product_string: p.originalProductString ?? null,
      checklist: p.checklist ?? {},
      calculations: p.calculations ?? [],
      source: "manual",
      is_fake: true,
    });
  }
  await rest("/policies", policyRows);
  console.log(`  ✓ Wpisano ${policyRows.length} polis`);

  console.log("→ 8. Notatki (plaintext)");
  const noteRows = (seed.notes ?? []).map(n => ({
    id: n.id,
    tenant_id: TENANT_ID,
    client_id: n.clientId,
    content: n.content ?? null,
    tag: n.tag ?? null,
    reminder_date: n.reminderDate ? new Date(n.reminderDate).toISOString() : null,
    reminder_status: n.reminderDate ? (n.isCompleted ? "UKONCZONE" : "PRZYPOMNIENIE") : null,
    linked_policy_ids: n.linkedPolicyIds ?? [],
    history: [],
  }));
  if (noteRows.length) {
    await rest("/policy_notes", noteRows);
    console.log(`  ✓ Wpisano ${noteRows.length} notatek`);
  }

  console.log("\n✅ GOTOWE. Hasło aplikacji:", PASSPHRASE);
  console.log("   Każdy z", users.length, "userów może się zalogować i użyć tego samego hasła.");
}

main().catch(e => { console.error("❌ BŁĄD:", e.message); process.exit(1); });
