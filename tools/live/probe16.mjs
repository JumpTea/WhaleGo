/**
 * Multi-turn probe: two voice questions in the same session must both land in
 * the native chat, use distinct turns, and return the orb to done each time.
 */
import { chromium } from 'playwright-core';

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
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
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('.wg-slot', { timeout: 60_000 });
await page.waitForTimeout(600);
const slot = await page.locator('.wg-slot').boundingBox();
await page.mouse.click(slot.x + slot.width / 2, slot.y + slot.height / 2);
await page.waitForTimeout(900);

const read = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    return {
      phase: space?.getAttribute('data-phase'),
      compact: space?.getAttribute('data-compact'),
      chat: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200),
      last: window.__whalegoLastTurn,
      bound: window.__whalegoSession,
      sr: document.querySelector('.wg-sr')?.textContent,
    };
  });

const waitDone = async (label) => {
  for (let i = 0; i < 45; i += 1) {
    await page.waitForTimeout(1000);
    const now = await read();
    if (now.phase === 'done') {
      console.log(`${label}-DONE`, { last: now.last, bound: now.bound, sr: now.sr });
      return now;
    }
  }
  const now = await read();
  console.log(`${label}-TIMEOUT`, now);
  return now;
};

await page.evaluate(() => window.__whalegoSay('你叫什么名字？'));
const first = await waitDone('TURN1');
await page.evaluate(() => window.__whalegoSay('再说一遍你的名字。'));
const second = await waitDone('TURN2');
console.log('TURNS-DISTINCT', first.last?.turnId !== second.last?.turnId);
console.log('CHAT-HAS-BOTH', /你叫什么名字/.test(second.chat) && /再说一遍你的名字/.test(second.chat));
console.log('ERRORS', errors);
await page.screenshot({ path: 'shots-v6/two-turns.png' });
await browser.close();
