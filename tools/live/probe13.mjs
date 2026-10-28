/**
 * Mid-speech network loss: the stream dies while the orb is speaking. The
 * local queue must stop, the turn settle, and the next tap must listen again.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe13.mjs <url-with-token>');

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
const logs = [];
page.on('console', (message) => logs.push(`[${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

await page.addInitScript(() => {
  window.__whalegoDebug = true;
  class FakeRecognition {
    constructor() {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    start() {
      setTimeout(() => this.emit('请写一篇至少八百字的散文，主题是凌晨的城市，分四段。', true), 300);
    }
    emit(text, final) {
      const result = [{ transcript: text }];
      result.isFinal = final;
      this.onresult?.({ resultIndex: 0, results: [result] });
    }
    stop() {
      this.onend?.();
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});

const state = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    return {
      phase: space?.dataset.phase,
      error: document.querySelector('.wg-error')?.innerText || '',
      audio: window.__whalegoAudio?.state,
      sr: document.querySelector('.wg-sr')?.innerText,
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'speaking',
  null,
  { timeout: 30_000 },
);
await page.waitForTimeout(50);
console.log('SPEAKING', await state());
console.log('HOOK', await page.evaluate(() => typeof window.__whalegoDropStream));
await page.evaluate(() => window.__whalegoDropStream?.());
await page.waitForTimeout(800);
console.log('DROPPED', await state());
console.log('TRACE', await page.evaluate(() => window.__phaseTrace));
await page.screenshot({ path: 'shots-v6/stream-error-speaking.png' });
await page.locator('.wg-orb').click({ force: true });
await page.waitForTimeout(500);
console.log('AFTER-CLICK', await state());
console.log('TRACE2', await page.evaluate(() => window.__phaseTrace));
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'listening',
  null,
  { timeout: 6_000 },
);
console.log('RETRY', await state());
console.log('LOGS', logs.filter((line) => !line.includes('Failed to load resource')));
await browser.close();
