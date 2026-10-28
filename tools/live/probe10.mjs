/**
 * Layout probe: a growing native composer must push the voice sheet up, and
 * the compact orb must stay above the sheet edge instead of being clipped.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe10.mjs <url-with-token>');

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

const geometry = () =>
  page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      inset: getComputedStyle(document.getElementById('whalego-voice-host')).getPropertyValue('--wg-composer').trim(),
      card: rect('.wg-slot')?.y,
      space: rect('.wg-space')?.bottom,
      orb: rect('.wg-orb'),
      compact: document.querySelector('.wg-space')?.dataset.compact,
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
await page.locator('.wg-orb').click({ force: true });
await page.waitForSelector('.wg-space[data-compact="true"]');
await page.waitForTimeout(700);
console.log('COMPACT', await geometry());

const input = page.locator('[contenteditable="true"]').first();
await input.click();
await input.fill('第一行\n第二行\n第三行\n第四行');
await page.waitForTimeout(900);
console.log('TALL-COMPOSER', await geometry());
await page.screenshot({ path: 'shots-v6/tall-composer.png' });
await browser.close();
