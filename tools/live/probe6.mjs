/** Slide-up / slide-down timing with no extra browser motion. */
import { chromium } from 'playwright-core';

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});

async function openPage(reducedMotion = 'no-preference') {
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion,
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
  return { context, page };
}

const { context, page } = await openPage();
await page.evaluate(() => {
  window.__samples = [];
  const started = performance.now();
  const tick = () => {
    const space = document.querySelector('.wg-space');
    if (space) {
      const rect = space.getBoundingClientRect();
      window.__samples.push({ t: Math.round(performance.now() - started), top: Math.round(rect.top), o: Number(getComputedStyle(space).opacity) });
    }
    if (performance.now() - started < 1200) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.locator('.wg-slot').click();
await page.waitForTimeout(1300);
const opened = await page.evaluate(() => window.__samples);
const openMove = opened.filter((s) => s.top < 930).filter((s, i, all) => i === 0 || s.top !== all[i - 1].top);
const openDuration = openMove.at(-1).t - openMove[0].t;
const gaps = openMove.slice(1).map((s, i) => s.t - openMove[i].t);
console.log('OPEN', {
  frames: opened.length,
  from: { top: openMove[0].top, t: openMove[0].t },
  to: { top: openMove.at(-1).top, t: openMove.at(-1).t },
  durationMs: openDuration,
  maxGapMs: Math.max(...gaps),
  opacityAtEnd: openMove.at(-1).o,
});

// Keyboard-sized viewport: the voice page must shrink with the composer, not
// cover the card. This is the mobile keyboard case (visualViewport shrinks).
await page.setViewportSize({ width: 430, height: 600 });
await page.waitForTimeout(800);
console.log(
  'KEYBOARD',
  await page.evaluate(() => {
    const space = document.querySelector('.wg-space')?.getBoundingClientRect();
    const card = document.querySelector('[class*="composerStack"] [class*="card"]')?.getBoundingClientRect();
    return {
      viewport: window.visualViewport?.height,
      spaceBottom: Math.round(space?.bottom || 0),
      cardTop: Math.round(card?.top || 0),
      gap: Math.round((card?.top || 0) - (space?.bottom || 0)),
    };
  }),
);
await page.setViewportSize({ width: 430, height: 932 });
await page.waitForTimeout(600);

await page.evaluate(() => {
  window.__samples = [];
  const started = performance.now();
  const tick = () => {
    const space = document.querySelector('.wg-space');
    if (space) {
      const rect = space.getBoundingClientRect();
      window.__samples.push({ t: Math.round(performance.now() - started), top: Math.round(rect.top), o: Number(getComputedStyle(space).opacity) });
    }
    if (performance.now() - started < 1000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
await page.locator('.wg-top button').first().click();
await page.waitForTimeout(700);
const closed = await page.evaluate(() => window.__samples);
const closeMove = closed.filter((s, i, all) => i === 0 || s.top !== all[i - 1].top);
console.log('CLOSE', {
  from: closeMove[0].top,
  to: closeMove.at(-1).top,
  durationMs: closeMove.at(-1).t - closeMove[0].t,
  maxGapMs: Math.max(...closeMove.slice(1).map((s, i) => s.t - closeMove[i].t)),
});
await context.close();

const reduced = await openPage('reduce');
console.log(
  'REDUCED',
  await reduced.page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('.wg-space'));
    return { duration: style.transitionDuration, property: style.transitionProperty };
  }),
);
await reduced.context.close();
await browser.close();
