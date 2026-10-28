/**
 * End-session probe: pressing the native X mid-answer must cancel the turn,
 * stop playback, close the sheet, and remove the mini orb.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe9.mjs <url-with-token>');

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
    start() {
      setTimeout(() => this.onend?.(), 80);
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
      mini: Boolean(document.querySelector('.wg-mini')),
      audio: window.__whalegoAudio?.state,
      chat: (document.querySelector('[class*="scrollBody"]')?.innerText || '').slice(-80),
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForSelector('.wg-space[data-open="true"]');
await page.evaluate(() => window.__whalegoSay?.('请用三句话介绍你在本机都能做什么。'));
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'speaking', null, {
  timeout: 30_000,
});
await page.waitForTimeout(900);
console.log('SPEAKING', await state());

await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'false');
await page.waitForTimeout(500);
console.log('X-ENDED', await state());
console.log('LOGS', logs);
await browser.close();
