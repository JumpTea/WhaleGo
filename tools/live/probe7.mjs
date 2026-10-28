/** Motion probe: the orb must travel down continuously, not snap. */
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = process.argv[2];
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
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'listening');
await page.waitForTimeout(600);

const samples = await page.evaluate(async () => {
  const out = [];
  const t0 = performance.now();
  const orb = document.querySelector('.wg-orb');
  const stage = document.querySelector('.wg-stage');
  const start = orb.getBoundingClientRect();
  const startStage = stage.getBoundingClientRect();
  const loop = () => {
    const r = orb.getBoundingClientRect();
    out.push({ t: performance.now() - t0, top: r.top, h: r.height, center: r.top + r.height / 2 });
    if (performance.now() - t0 < 850) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  document.querySelector('[class*="composerHero"]')?.remove();
  orb.click();
  await new Promise((resolve) => setTimeout(resolve, 950));
  const end = orb.getBoundingClientRect();
  return {
    start: { top: start.top, h: start.height, center: start.top + start.height / 2 },
    end: { top: end.top, h: end.height, center: end.top + end.height / 2 },
    stage: { top: startStage.top, h: startStage.height },
    samples: out,
  };
});

let maxStep = 0;
let big = null;
for (let i = 1; i < samples.samples.length; i += 1) {
  const a = samples.samples[i - 1];
  const b = samples.samples[i];
  const step = Math.abs(b.center - a.center);
  if (step > maxStep) {
    maxStep = step;
    big = { from: a, to: b, step };
  }
}
console.log(JSON.stringify({
  start: samples.start,
  end: samples.end,
  frames: samples.samples.length,
  maxCenterStep: Math.round(maxStep * 10) / 10,
  big,
  head: samples.samples.slice(0, 16).map((s) => ({
    t: Math.round(s.t),
    top: Math.round(s.top),
    h: Math.round(s.h),
    c: Math.round(s.center),
  })),
  last: samples.samples.at(-1),
}, null, 2));

await page.screenshot({ path: 'shots-v6/compact-motion.png' });
await mkdir('shots-v6', { recursive: true }).catch(() => {});
await browser.close();
