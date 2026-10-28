import { chromium } from 'playwright-core';

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.wg-slot', { timeout: 60000 });
await page.locator('.wg-slot').click();
await page.waitForTimeout(1000);
const tree = await page.evaluate(() => {
  const seat = document.querySelector('[class*="composerSeat"]');
  const out = [];
  const walk = (node, depth) => {
    if (!node || depth > 5) return;
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    out.push({
      d: depth,
      tag: node.tagName,
      cls: String(node.className ?? '').slice(0, 90),
      y: Math.round(r.y),
      h: Math.round(r.height),
      text: (node.childElementCount ? '' : node.textContent || '').trim().slice(0, 40),
      display: cs.display,
      pos: cs.position,
    });
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(seat, 0);
  return out;
});
console.log(JSON.stringify(tree, null, 2));
await browser.close();
