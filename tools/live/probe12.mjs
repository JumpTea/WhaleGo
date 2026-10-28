/**
 * Stream-failure probe: the live SSE connection dies while a turn is running.
 * The orb must stop thinking, surface a retry hint, and settle the turn.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe12.mjs <url-with-token>');

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
await page.route('**/whalego/live**', (route) => route.abort());

await page.addInitScript(() => {
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
      setTimeout(() => this.emit('用一句话介绍你自己', true), 300);
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
      open: space?.dataset.open,
      phase: space?.dataset.phase,
      error: document.querySelector('.wg-error')?.innerText || '',
      slot: document.querySelector('.wg-slot')?.innerText,
      sr: document.querySelector('.wg-sr')?.innerText,
      audio: window.__whalegoAudio?.state,
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'thinking',
  null,
  { timeout: 15_000 },
);
await page.waitForTimeout(2500);
console.log('AFTER-DROP', await state());
await page.screenshot({ path: 'shots-v6/stream-error.png' });
await page.locator('.wg-orb').click({ force: true });
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'listening',
  null,
  { timeout: 5_000 },
);
console.log('RETRY', await state());
console.log('LOGS', logs);
await browser.close();
