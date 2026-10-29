import { chromium } from 'playwright-core';

const url = process.argv[2];
const width = Number(process.argv[3] || 430);
const shot = (scheme, view) =>
  `tools/live/shots-v6/duplex-theme-${scheme}-${width === 430 ? '' : `${width}-`}${view}.png`;
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });

async function press(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({
    viewport: { width, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme,
  });
  await page.addInitScript(() => {
    class FakeRecognition {
      constructor() { this.continuous = false; this.interimResults = false; }
      start() { setTimeout(() => this.onstart?.({}), 0); }
      stop() { setTimeout(() => this.onend?.({}), 0); }
      abort() { this.stop(); }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.wg-slot', { timeout: 60000 });
  await page.waitForTimeout(500);
  await press(page, '.wg-slot');
  await page.waitForTimeout(600);
  const full = await page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    const slot = document.querySelector('.wg-slot');
    const top = document.querySelector('.wg-round');
    const atRight = document.elementFromPoint(innerWidth - 8, 300);
    const cs = getComputedStyle(space);
    return {
      phase: space.dataset.phase,
      bg: cs.backgroundColor,
      color: cs.color,
      opacity: cs.opacity,
      transform: cs.transform,
      width: space.getBoundingClientRect().width,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      slotBg: getComputedStyle(slot).backgroundColor,
      slotColor: getComputedStyle(slot).color,
      topBg: getComputedStyle(top).backgroundColor,
      atRight: atRight?.className || atRight?.tagName,
    };
  });
  console.log(scheme, 'FULL', JSON.stringify(full, null, 2));
  await page.screenshot({ path: shot(scheme, 'full') });

  await press(page, '.wg-orb:not(.mini)');
  await page.waitForTimeout(700);
  const compact = await page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    const orb = document.querySelector('.wg-space .wg-orb');
    const cs = getComputedStyle(space);
    const r = orb.getBoundingClientRect();
    return {
      compact: space.dataset.compact,
      bg: cs.backgroundColor,
      orb: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  });
  console.log(scheme, 'COMPACT', JSON.stringify(compact, null, 2));
  await page.screenshot({ path: shot(scheme, 'compact') });
  await page.close();
}
await browser.close();
