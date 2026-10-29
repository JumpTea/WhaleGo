/** Continuous recognition must survive no-speech, but stop on a real denial. */
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node probe19.mjs <url>');
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });

async function tap(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function run(mode) {
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript((mode) => {
    window.__mode = mode;
    window.__starts = 0;
    class FakeRecognition {
      constructor() {
        this.continuous = false;
        this.interimResults = false;
      }
      start() {
        window.__starts += 1;
        setTimeout(() => this.onstart?.({}), 0);
        if (window.__mode === 'nospeech' && window.__starts === 1) {
          setTimeout(() => {
            this.onerror?.({ error: 'no-speech' });
            this.onend?.({});
          }, 180);
        }
        if (window.__mode === 'denied' && window.__starts === 1) {
          setTimeout(() => {
            this.onerror?.({ error: 'not-allowed' });
            this.onend?.({});
          }, 180);
        }
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
  }, mode);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('.wg-slot', { timeout: 60_000 });
  await page.waitForTimeout(400);
  await tap(page, '.wg-slot');
  await page.waitForTimeout(1400);
  const state = await page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    return {
      starts: window.__starts,
      phase: space?.dataset.phase,
      error: document.querySelector('.wg-error')?.textContent || '',
    };
  });
  console.log(mode.toUpperCase(), state);
  await page.close();
}

await run('nospeech');
await run('denied');
await browser.close();
