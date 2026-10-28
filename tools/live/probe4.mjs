/** Multi-sentence playback probe: measures the gap between spoken lines. */
import { chromium } from 'playwright-core';

const url = process.argv[2];
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
await page.addInitScript(() => {
  class FakeRecognition {
    start() {
      setTimeout(() => this.onstart?.({}), 0);
    }
    stop() {
      setTimeout(() => this.onend?.({}), 0);
    }
    abort() {
      this.stop();
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'true');
await page.evaluate(() => window.__whalegoSay?.('请分三句话介绍你在本机都能做什么。'));
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'done',
  null,
  { timeout: 120_000 },
);
await page.waitForTimeout(1200);
const result = await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  trail: window.__whalegoTrail || [],
  text: (document.querySelector('[class*="scrollBody"]')?.innerText || '').slice(0, 500),
}));
console.log(JSON.stringify(result, null, 2));
await browser.close();
