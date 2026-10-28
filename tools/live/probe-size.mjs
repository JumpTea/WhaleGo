/** Small-phone layout: does the native composer row still fit with the pill? */
import { chromium } from 'playwright-core';

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});

for (const [width, height] of [[360, 800], [320, 700]]) {
  const context = await browser.newContext({
    viewport: { width, height },
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
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.wg-slot', { timeout: 30_000 });
  const before = await page.evaluate(() => {
    const slot = document.querySelector('.wg-slot').getBoundingClientRect();
    const card = document.querySelector('.wg-slot').closest('[class*="card"]').getBoundingClientRect();
    const chevrons = [...document.querySelectorAll('svg')]
      .filter((svg) => String(svg.getAttribute('class') || '').includes('chevron'))
      .map((svg) => {
        const rect = svg.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width),
          hit: `${hit?.tagName}.${String(hit?.getAttribute('class') || '').slice(0, 24)}`,
        };
      })
      .filter((item) => item.y > innerHeight * 0.6);
    return {
      viewport: [innerWidth, innerHeight],
      slot: { x: Math.round(slot.x), w: Math.round(slot.width), right: Math.round(slot.right) },
      card: { x: Math.round(card.x), w: Math.round(card.width), right: Math.round(card.right) },
      overflow: document.documentElement.scrollWidth > innerWidth,
      chevrons,
    };
  });
  await page.screenshot({ path: `shots-v6/size-${width}.png` });
  await page.locator('.wg-slot').click();
  await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'true');
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const space = document.querySelector('.wg-space').getBoundingClientRect();
    const orb = document.querySelector('.wg-orb').getBoundingClientRect();
    const card = document.querySelector('.wg-slot').closest('[class*="card"]').getBoundingClientRect();
    return {
      space: { x: Math.round(space.x), w: Math.round(space.width), bottom: Math.round(space.bottom) },
      orb: { w: Math.round(orb.width), x: Math.round(orb.x), b: Math.round(orb.bottom) },
      cardTop: Math.round(card.top),
      inset: getComputedStyle(document.querySelector('.wg-space')).bottom,
    };
  });
  await page.screenshot({ path: `shots-v6/size-${width}-open.png` });
  console.log(width, JSON.stringify({ before, after }, null, 2));
  await context.close();
}
await browser.close();
