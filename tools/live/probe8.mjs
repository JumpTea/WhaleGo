/**
 * Web Speech probe: a fake recogniser emits a partial and a final result.
 * The voice space must show the live transcript, auto-send after the silence
 * window, and then stream the answer back into the native session.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe8.mjs <url-with-token>');

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
      setTimeout(() => this.emit('用一句话介', false), 260);
      setTimeout(() => this.emit('用一句话介绍你自己', true), 720);
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
      compact: space?.dataset.compact,
      phase: space?.dataset.phase,
      slot: document.querySelector('.wg-slot')?.innerText,
      heard: document.querySelector('.wg-heard')?.innerText,
      sr: document.querySelector('.wg-sr')?.innerText,
      audio: window.__whalegoAudio?.state,
      chat: (document.querySelector('[class*="scrollBody"]')?.innerText || '').slice(-160),
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'listening');
await page.waitForTimeout(400);
console.log('PARTIAL', await state());
await page.screenshot({ path: 'shots-v6/heard.png' });

await page.waitForFunction(
  () => ['thinking', 'speaking', 'done'].includes(document.querySelector('.wg-space')?.dataset.phase),
  null,
  { timeout: 12_000 },
);
console.log('SENT', await state());
await page.waitForTimeout(1200);
console.log('ANSWER', await state());
await page.screenshot({ path: 'shots-v6/heard-answer.png' });
console.log('LOGS', logs);
await browser.close();
