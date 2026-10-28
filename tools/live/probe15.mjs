/**
 * Home-layout probe: opening and closing voice mode on an empty session must
 * leave the centered hero where it was, and must not leave the composer at
 * the bottom.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-first-run', '--disable-extensions'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.addInitScript(() => {
  class FakeRecognition {
    constructor() { this.continuous = false; this.interimResults = false; }
    start() { setTimeout(() => this.onstart?.({}), 0); }
    stop() { setTimeout(() => this.onend?.({}), 0); }
    abort() { this.stop(); }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('.wg-slot', { timeout: 60_000 });
await page.waitForTimeout(800);

const measure = () =>
  page.evaluate(() => {
    const slot = document.querySelector('.wg-slot');
    const card = slot?.closest('[class*="card"]');
    const hero = document.querySelector('[class*="composerHero"]');
    const r = (node) => {
      if (!node) return null;
      const b = node.getBoundingClientRect();
      return { y: Math.round(b.y), h: Math.round(b.height), b: Math.round(b.bottom) };
    };
    return {
      mode: document.documentElement.getAttribute('data-whalego-mode'),
      open: document.querySelector('.wg-space')?.getAttribute('data-open'),
      card: r(card),
      slot: r(slot),
      hero: Boolean(hero),
    };
  });

console.log('HOME-CLOSED', await measure());
await page.locator('.wg-slot').click();
await page.waitForTimeout(900);
console.log('HOME-OPEN', await measure());
await page.screenshot({ path: 'shots-v6/home-open.png' });
await page.locator('[aria-label="收起语音对话"]').click();
await page.waitForTimeout(900);
console.log('HOME-CLOSED-AGAIN', await measure());
await page.screenshot({ path: 'shots-v6/home-closed.png' });
await browser.close();
