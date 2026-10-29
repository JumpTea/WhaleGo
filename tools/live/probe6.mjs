/** Direct-render fade timing + compact/keyboard geometry. */
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

async function tap(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
await tap(page, '.wg-slot');
await page.waitForTimeout(1300);
const opened = await page.evaluate(() => window.__samples);
const visible = opened.filter((s) => s.o > 0.02);
const full = opened.find((s) => s.o > 0.98);
const openDuration = full.t - visible[0].t;
const gaps = opened.slice(1).map((s, i) => s.t - opened[i].t);
console.log('OPEN', {
  frames: opened.length,
  firstVisible: visible[0],
  firstFull: full,
  durationMs: openDuration,
  maxGapMs: Math.max(...gaps),
  opacityAtEnd: opened.at(-1).o,
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
const closing = closed.filter((s) => s.o < 0.98);
const gone = closed.find((s) => s.o < 0.02);
console.log('CLOSE', {
  firstFade: closing[0],
  firstGone: gone,
  durationMs: gone.t - closing[0].t,
  maxGapMs: Math.max(...closed.slice(1).map((s, i) => s.t - closed[i].t)),
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
