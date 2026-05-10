import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';

const SB_URL = 'https://xqznrssrlnxqkdvisnck.supabase.co';
const SB_SECRET = execSync('powershell -Command "rrv get CRM_ALINA_SB_SECRET"', {encoding:'utf8'}).trim();

const admin = createClient(SB_URL, SB_SECRET, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: linkData } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: 'redroadai@gmail.com',
  options: { redirectTo: 'http://localhost:5173' }
});

const actionLink = linkData?.properties?.action_link;
if (!actionLink) { console.error('Brak action_link'); process.exit(1); }

const browser = await chromium.launch({ headless: false, slowMo: 100 });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

try { await page.goto(actionLink, { waitUntil: 'commit', timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

const accessToken = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.includes('auth-token')) {
      try { return JSON.parse(localStorage[k]).access_token || null; } catch {}
    }
  }
  return null;
});
const refreshToken = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.includes('auth-token')) {
      try { return JSON.parse(localStorage[k]).refresh_token || null; } catch {}
    }
  }
  return null;
});

if (!accessToken) { console.error('Brak tokenu'); process.exit(1); }

const authUrl = `http://localhost:5173/#access_token=${accessToken}&refresh_token=${refreshToken}&token_type=bearer&expires_in=3600`;
await page.goto(authUrl);

console.log('Przeglądarka otwarta. Wpisz hasło RODO i się zaloguj.');
console.log('Naciśnij ENTER tutaj żeby zrobić screenshoty po zalogowaniu.');

// Czekaj na input od użytkownika
process.stdin.resume();
process.stdin.setEncoding('utf8');
await new Promise(resolve => process.stdin.once('data', resolve));

console.log('Robię screenshoty...');
const dir = 'C:/BartsGda4/CRM-Atomic/scripts/screenshots';

// Splash?
const splash = await page.$('button:has-text("Wchodzę do pracy")');
if (splash) { await splash.click(); await page.waitForTimeout(1000); }

await page.screenshot({ path: `${dir}/logged_dashboard.png` });
console.log('Dashboard OK');

// Pipeline
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('a, button, [role="menuitem"]'));
  const el = all.find(e => /Pipeline|Oferty/i.test(e.textContent || ''));
  if (el) el.click();
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${dir}/logged_pipeline.png` });
console.log('Pipeline OK');

// Calendar
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('a, button, [role="menuitem"]'));
  const el = all.find(e => /Kalend/i.test(e.textContent || ''));
  if (el) el.click();
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${dir}/logged_calendar.png` });
console.log('Calendar OK');

await browser.close();
console.log('Gotowe! Screenshoty w:', dir);
process.exit(0);
