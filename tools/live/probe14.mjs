/**
 * Responsive probe: the cloud orb must fit between the safe top bar and the
 * native composer in both portrait and landscape, without changing its 54vw
 * look when there is room.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe14.mjs <url-with-token>');

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});

for (const viewport of [
  { width: 430, height: 932, name: 'portrait' },
  { width: 932, height: 430, name: 'landscape' },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
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
      start() {}
      stop() {
        this.onend?.();
      }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.wg-slot', { timeout: 30_000 });
  await page.locator('.wg-slot').click();
  await page.waitForTimeout(700);
  const box = await page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        b: Math.round(r.bottom),
      };
    };
    const space = document.querySelector('.wg-space');
    const orb = document.querySelector('.wg-orb');
    const style = getComputedStyle(document.documentElement);
    return {
      phase: space?.dataset.phase,
      orb: rect('.wg-orb'),
      space: rect('.wg-space'),
      card: rect('[class*="composerStack"] [class*="card"]'),
      inset: style.getPropertyValue('--wg-composer').trim(),
      orbCss: orb ? getComputedStyle(orb).width : '',
    };
  });
  const fits = box.orb && box.space ? box.orb.b <= box.space.b && box.orb.y >= 0 : false;
  console.log(viewport.name.toUpperCase(), { ...box, fits });
  await page.screenshot({ path: `shots-v6/${viewport.name}-${viewport.width}x${viewport.height}.png` });
  await context.close();
}

await browser.close();
