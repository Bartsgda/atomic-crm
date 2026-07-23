#!/usr/bin/env node
// Odblokowanie PassphraseGate (ALINA CRM) — zeruje licznik nieudanych prób,
// zdejmuje blokadę czasową i hard lock w public.passphrase_lockouts.
//
// Użycie:
//   node scripts/unlock_passphrase.mjs                 # lista blokad (kto/ile/stan)
//   node scripts/unlock_passphrase.mjs <email>         # odblokuj usera
//
// Wymaga env (rr-claude wstrzykuje z vault; poza sesją: rrv export-env):
//   CRM_ALINA_SB_SECRET      — service role key (sb_secret_*)
//   CRM_ALINA_SUPABASE_URL   — opcjonalnie (default: projekt xqzn…)

const URL_BASE =
  process.env.CRM_ALINA_SUPABASE_URL || "https://xqznrssrlnxqkdvisnck.supabase.co";
const KEY = process.env.CRM_ALINA_SB_SECRET;

if (!KEY) {
  console.error(
    "BRAK CRM_ALINA_SB_SECRET w env. Odpal w sesji rr-claude albo:\n" +
      '  rrv export-env --format ps | Invoke-Expression  (w osobnym PS po rrv-unlock)',
  );
  process.exit(1);
}

const headers = {
  apikey: KEY,
  authorization: `Bearer ${KEY}`,
  "content-type": "application/json",
};

async function listUsers() {
  // GoTrue Admin API — u Aliny jest 2-3 userów, per_page=1000 wystarczy
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, {
    headers,
  });
  if (!res.ok) throw new Error(`auth admin users: HTTP ${res.status}`);
  const body = await res.json();
  return body.users ?? [];
}

async function listLockouts() {
  const res = await fetch(
    `${URL_BASE}/rest/v1/passphrase_lockouts?select=*`,
    { headers },
  );
  if (!res.ok) throw new Error(`passphrase_lockouts: HTTP ${res.status}`);
  return res.json();
}

function describe(row, email) {
  const now = Date.now();
  const until = row.locked_until ? Date.parse(row.locked_until) : null;
  const state = row.hard_locked
    ? "🔴 HARD LOCK (tylko admin)"
    : until && until > now
      ? `🟠 blokada do ${new Date(until).toLocaleTimeString("pl-PL")}`
      : "🟢 brak blokady";
  return `${email ?? row.user_id}  prób: ${row.failed_attempts}  ${state}`;
}

const emailArg = process.argv[2];

const users = await listUsers();
const byId = new Map(users.map((u) => [u.id, u.email]));

if (!emailArg) {
  const rows = await listLockouts();
  if (!rows.length) {
    console.log("Brak wpisów w passphrase_lockouts (nikt nie pomylił hasła).");
  } else {
    for (const row of rows) console.log(describe(row, byId.get(row.user_id)));
  }
  process.exit(0);
}

const user = users.find(
  (u) => (u.email ?? "").toLowerCase() === emailArg.toLowerCase(),
);
if (!user) {
  console.error(`Nie znaleziono usera o emailu: ${emailArg}`);
  console.error(`Znani userzy: ${users.map((u) => u.email).join(", ")}`);
  process.exit(1);
}

// Upsert: zeruje licznik + zdejmuje obie blokady
const res = await fetch(`${URL_BASE}/rest/v1/passphrase_lockouts`, {
  method: "POST",
  headers: {
    ...headers,
    prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({
    user_id: user.id,
    failed_attempts: 0,
    locked_until: null,
    hard_locked: false,
  }),
});
if (!res.ok) {
  console.error(`Upsert nieudany: HTTP ${res.status} — ${await res.text()}`);
  process.exit(1);
}
const [row] = await res.json();
console.log("✅ Odblokowano:", describe(row, user.email));
