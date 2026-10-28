/**
 * Headless visual probe for the WhaleGo voice space.
 *
 * Usage: node probe.mjs <token-url> [outDir]
 * Opens the real DSH WebUI, enters voice mode, records geometry and screenshots.
 * No WebGL, no audio output: this only exercises the DOM and CSS.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe.mjs <url-with-token> [outDir]');
const outDir = process.argv[3] ?? 'shots';
mkdirSync(outDir, { recursive: true });

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath: edge,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const logs = [];
page.on('console', (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

const shot = async (name) => {
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  console.log(`shot ${name}`);
};

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('.wg-slot', { timeout: 60_000 });
await page.waitForTimeout(1200);
await shot('01-chat');

const before = await page.evaluate(() => {
  const slot = document.querySelector('.wg-slot');
  const host = document.getElementById('whalego-voice-host');
  return {
    hasSlot: Boolean(slot),
    slotText: slot?.textContent,
    slotRect: slot ? slot.getBoundingClientRect().toJSON() : null,
    host: Boolean(host),
    inner: { w: innerWidth, h: innerHeight },
  };
});
console.log('BEFORE', JSON.stringify(before));

await page.locator('.wg-slot').click();
await page.waitForTimeout(1000);
await shot('02-full');

const full = await page.evaluate(() => {
  const box = (selector) => {
    const node = document.querySelector(selector);
    return node ? node.getBoundingClientRect().toJSON() : null;
  };
  const space = document.querySelector('.wg-space');
  const composerInset = Number.parseFloat(getComputedStyle(document.getElementById('whalego-voice-host')).getPropertyValue('--wg-composer')) || 0;
  return {
    space: box('.wg-space'),
    orb: box('.wg-orb'),
    top: box('.wg-top'),
    state: document.querySelector('.wg-state')?.textContent ?? null,
    stateDisplay: document.querySelector('.wg-state') ? getComputedStyle(document.querySelector('.wg-state')).display : null,
    composerInset,
    orbPhase: space?.getAttribute('data-phase'),
    compact: space?.getAttribute('data-compact'),
    text: document.querySelector('.wg-space')?.innerText,
    atRight: document.elementFromPoint(innerWidth - 2, innerHeight / 2)?.className ?? null,
    atCenter: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.className ?? null,
  };
});
console.log('FULL', JSON.stringify(full, null, 2));

// Click the orb: this should shrink it and reveal the chat, without stopping audio.
await page.locator('.wg-orb').click();
await page.waitForTimeout(900);
await shot('03-compact');
const compact = await page.evaluate(() => {
  const box = (selector) => {
    const node = document.querySelector(selector);
    return node ? node.getBoundingClientRect().toJSON() : null;
  };
  const space = document.querySelector('.wg-space');
  return {
    space: box('.wg-space'),
    orb: box('.wg-orb'),
    compact: space?.getAttribute('data-compact'),
    spaceBg: getComputedStyle(space).backgroundColor,
    pointer: getComputedStyle(space).pointerEvents,
    atChat: (() => {
      const node = document.elementFromPoint(innerWidth / 2, 260);
      return { tag: node?.tagName, cls: String(node?.className ?? '').slice(0, 80), text: node?.textContent?.slice(0, 60) };
    })(),
    text: space?.innerText,
  };
});
console.log('COMPACT', JSON.stringify(compact, null, 2));

console.log('LOGS', JSON.stringify(logs.slice(-30), null, 2));
await browser.close();
