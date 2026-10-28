/**
 * Permission probe: a fake recogniser reports `not-allowed` asynchronously.
 * The space must leave `listening`, stay open and explain what to do.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe11.mjs <url-with-token>');

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.addInitScript(() => {
  class Denied {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    start() {
      setTimeout(() => this.onerror?.({ error: 'not-allowed' }), 40);
    }
    stop() {
      this.onend?.();
    }
  }
  window.SpeechRecognition = Denied;
  window.webkitSpeechRecognition = Denied;
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30000 });
await page.locator('.wg-slot').click();
await page.waitForTimeout(500);
const state = await page.evaluate(() => ({
  open: document.querySelector('.wg-space')?.getAttribute('data-open'),
  phase: document.querySelector('.wg-space')?.getAttribute('data-phase'),
  error: document.querySelector('.wg-error')?.textContent?.trim() || '',
  heard: document.querySelector('.wg-heard')?.textContent?.trim() || '',
  slot: document.querySelector('.wg-slot')?.textContent?.trim() || '',
}));
console.log('DENIED', state);
await page.screenshot({ path: 'shots-v6/mic-denied.png' });
await browser.close();
