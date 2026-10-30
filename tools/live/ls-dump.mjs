import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:3099/';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(4000);
const dump = () =>
  page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      out[k] = String(localStorage.getItem(k)).slice(0, 160);
    }
    return { keys: out, hero: Boolean(document.querySelector('[class*="composerHero"]')), placeholder: document.querySelector('[contenteditable="true"]')?.getAttribute('aria-placeholder') || document.querySelector('[class*="_placeholder"]')?.textContent || '' };
  });
console.log('BEFORE', JSON.stringify(await dump(), null, 2));
const box = await page.locator('[class*="composerHero"]').first().boundingBox().catch(() => null);
console.log('box', box);
await browser.close();
