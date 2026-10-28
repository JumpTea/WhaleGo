/**
 * Typed-input probe: with voice mode on, typing in the native composer must
 * open the compact voice layer, mirror the answer, and speak it.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe3.mjs <url-with-token>');

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const logs = [];
page.on('console', (message) => logs.push(`[${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

const state = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    return {
      open: space?.dataset.open,
      compact: space?.dataset.compact,
      phase: space?.dataset.phase,
      slot: document.querySelector('.wg-slot')?.innerText,
      href: location.href,
      bound: window.__whalegoSession?.(),
      turn: window.__whalegoLastTurn,
      mini: Boolean(document.querySelector('.wg-mini')),
      audio: window.__whalegoAudio,
      space: document.querySelector('.wg-space')?.getBoundingClientRect().toJSON(),
      stage: document.querySelector('.wg-stage')?.getBoundingClientRect().toJSON(),
      orbRect: document.querySelector('.wg-orb')?.getBoundingClientRect().toJSON(),
      chat: (document.querySelector('[class*="scrollBody"]')?.innerText || '').slice(-300),
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'true', null, {
  timeout: 10_000,
});

// Collapse to the mini orb, leaving the native composer free.
// An empty home now exits voice mode instead of leaving a mini orb, so put a
// turn in the chat first: that is the state where the mini orb is expected.
await page.evaluate(() => window.__whalegoSay('用一句话介绍你自己'));
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'done', null, {
  timeout: 60_000,
});
await page.locator('.wg-top button').first().click();
await page.waitForFunction(
  () =>
    document.querySelector('.wg-space')?.dataset.open === 'false' &&
    Boolean(document.querySelector('.wg-mini')),
  null,
  { timeout: 5_000 },
);
console.log('COLLAPSED', await state());

const input = page.locator('[contenteditable="true"]').first();
await input.click();
await input.type('用一句话介绍你自己', { delay: 12 });
await input.press('Enter');

await page.waitForFunction(
  () =>
    document.querySelector('.wg-space')?.dataset.open === 'true' &&
    document.querySelector('.wg-space')?.dataset.compact === 'true',
  null,
  { timeout: 20_000 },
);
console.log('TYPED-OPEN', await state());
await page.screenshot({ path: 'shots-v6/typed-open.png' });

await page
  .waitForFunction(
    () => {
      const phase = document.querySelector('.wg-space')?.dataset.phase;
      return phase === 'speaking' || phase === 'done';
    },
    null,
    { timeout: 30_000 },
  )
  .catch(() => {});
console.log('TYPED-SPEAKING', await state());
await page.screenshot({ path: 'shots-v6/typed-speaking.png' });

// The big orb returns to the full page; the composer underneath stays usable.
await page.locator('.wg-orb').click({ force: true });
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.compact === 'false', null, {
  timeout: 5_000,
});
const input2 = page.locator('[contenteditable="true"]').first();
await input2.click();
await input2.type('再说一句', { delay: 12 });
await input2.press('Enter');
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.compact === 'true', null, {
  timeout: 20_000,
});
console.log('TYPED-FROM-FULL', await state());
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots-v6/typed-from-full.png' });

await browser.close();
console.log('LOGS', logs.slice(-12));
