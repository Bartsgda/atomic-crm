import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';

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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Podążaj za redirectem żeby uzyskac token
try { await page.goto(actionLink, { waitUntil: 'commit', timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

// Token z localStorage
const accessToken = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.includes('auth-token')) {
      try { const v = JSON.parse(localStorage[k]); return v.access_token || null; } catch {}
    }
  }
  return null;
});
const refreshToken = await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.includes('auth-token')) {
      try { const v = JSON.parse(localStorage[k]); return v.refresh_token || null; } catch {}
    }
  }
  return null;
});

if (!accessToken) { console.error('Brak tokenu'); process.exit(1); }
console.log('Token OK:', accessToken.slice(0, 20) + '...');

// Helper: zaloguj się przez URL hash i oddalaj splash
async function gotoWithAuth(url) {
  const authUrl = url + `#access_token=${accessToken}&refresh_token=${refreshToken}&token_type=bearer&expires_in=3600`;
  await page.goto(authUrl);
  await page.waitForTimeout(2500);
  // Oddalaj splash jeśli widoczny
  const splashBtn = await page.$('button:has-text("Wchodzę do pracy")');
  if (splashBtn) { await splashBtn.click(); await page.waitForTimeout(1500); }
}

const dir = 'C:/BartsGda4/CRM-Atomic/scripts/screenshots';
fs.mkdirSync(dir, { recursive: true });

// Dashboard
await gotoWithAuth('http://localhost:5173/');
await page.screenshot({ path: `${dir}/01_dashboard.png` });
console.log('01 dashboard');

// Teraz SPA navigation — nie przeładuj strony, kliknij sidebar
async function clickNav(text) {
  const found = await page.evaluate((t) => {
    const els = Array.from(document.querySelectorAll('a, button, [role="menuitem"]'));
    const el = els.find(e => e.textContent?.trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
  return found;
}

// Lista widocznych nav elementów
const navItems = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a, [role="menuitem"]'))
    .map(e => e.textContent?.trim())
    .filter(t => t && t.length < 30 && t.length > 2)
    .slice(0, 30);
});
console.log('Nav items:', navItems);

// Pipeline
const hasPipeline = await clickNav('Pipeline');
if (!hasPipeline) await clickNav('Oferty');
await page.waitForTimeout(2000);
// Splash znowu?
const s2 = await page.$('button:has-text("Wchodzę do pracy")');
if (s2) { await s2.click(); await page.waitForTimeout(1000); }
await page.screenshot({ path: `${dir}/02_pipeline.png` });
console.log('02 pipeline, nav found:', hasPipeline);

// Kalendarz
const hasCal = await clickNav('Kalend');
await page.waitForTimeout(2000);
const s3 = await page.$('button:has-text("Wchodzę do pracy")');
if (s3) { await s3.click(); await page.waitForTimeout(1000); }
await page.screenshot({ path: `${dir}/03_calendar.png` });
console.log('03 calendar, nav found:', hasCal);

// Pipeline znowu
await clickNav('Pipeline');
if (!hasPipeline) await clickNav('Oferty');
await page.waitForTimeout(2000);
const s4 = await page.$('button:has-text("Wchodzę do pracy")');
if (s4) { await s4.click(); await page.waitForTimeout(1000); }

// Eye panel (bottom-right button)
const eyeClicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  for (const btn of btns) {
    const r = btn.getBoundingClientRect();
    if (r.width > 0 && r.right > window.innerWidth - 100 && r.bottom > window.innerHeight - 100) {
      btn.click(); return btn.outerHTML.slice(0, 80);
    }
  }
  return null;
});
console.log('Eye button clicked:', eyeClicked);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/04_eye_panel.png` });
console.log('04 eye panel');

// Kliknij "Zgłoś problem"
const zglosClicked = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const b = btns.find(b => /Zgło|problem/i.test(b.textContent || ''));
  if (b) { b.click(); return b.textContent?.trim(); }
  return null;
});
console.log('Zglos clicked:', zglosClicked);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/05_feedback_modal.png` });
console.log('05 feedback modal');

await browser.close();
console.log('Gotowe!');
