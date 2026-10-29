/**
 * Interaction probe: fake Web Speech so the orb can enter listening without a
 * microphone, then verify full/compact/close, the voice turn, and typed mirror.
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
const logs = [];
page.on('console', (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
page.on('pageerror', (error) => logs.push(`[pageerror] ${error.message}`));

// Playwright's locator.click() can stall on the native composer button while
// the composer is being pushed down; tapping the box directly matches a user.
const press = async (selector) => {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

await page.addInitScript(() => {
  class FakeRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = '';
    }
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

const state = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    const orb = document.querySelector('.wg-orb');
    const slot = document.querySelector('.wg-slot');
    const card = slot?.closest('[class*="card"]') || document.querySelector('[class*="composerStack"] [class*="card"]');
    const r = (node) => {
      if (!node) return null;
      const b = node.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) };
    };
    const input = document.querySelector('[contenteditable="true"]');
    return {
      open: space?.getAttribute('data-open'),
      compact: space?.getAttribute('data-compact'),
      veil: space?.getAttribute('data-veil'),
      phase: space?.getAttribute('data-phase'),
      spaceBg: space ? getComputedStyle(space).backgroundColor : null,
      pointer: space ? getComputedStyle(space).pointerEvents : null,
      orb: r(orb),
      orbTransform: orb ? getComputedStyle(orb).transform : null,
      card: r(card),
      composerInset: getComputedStyle(document.getElementById('whalego-voice-host')).getPropertyValue('--wg-composer'),
      slot: slot?.textContent,
      sr: document.querySelector('.wg-sr')?.textContent,
      heard: document.querySelector('.wg-heard')?.textContent,
      inputVisible: Boolean(input && input.getBoundingClientRect().bottom <= innerHeight && input.getBoundingClientRect().top >= 0),
      inputBottom: input ? Math.round(input.getBoundingClientRect().bottom) : null,
      chatText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
      center: (() => {
        const node = document.elementFromPoint(innerWidth / 2, 260);
        return { tag: node?.tagName, cls: String(node?.className ?? '').slice(0, 60) };
      })(),
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('.wg-slot', { timeout: 60_000 });
await page.waitForTimeout(800);
console.log('CLOSED', JSON.stringify(await state(), null, 2));

await press('.wg-slot');
await page.waitForTimeout(1200);
console.log('FULL', JSON.stringify(await state(), null, 2));
await page.screenshot({ path: 'shots-v5/01-full.png' });

// First voice turn: writes into the real session and streams a spoken answer.
await page.evaluate(() => window.__whalegoSay('用一句话介绍你自己'));
let sawSpeaking = false;
for (let i = 0; i < 25; i += 1) {
  await page.waitForTimeout(1000);
  const now = await state();
  console.log(`TURN+${i + 1}s`, now.phase, now.sr, now.chatText.slice(0, 100));
  if (now.phase === 'speaking') {
    sawSpeaking = true;
    break;
  }
}
console.log('SPEAKING?', sawSpeaking);
await page.screenshot({ path: 'shots-v5/02-speaking.png' });

// Tap the orb while it talks: shrink it, keep the audio running.
await press('.wg-orb');
await page.waitForTimeout(700);
console.log('COMPACT', JSON.stringify(await state(), null, 2));
await page.screenshot({ path: 'shots-v5/03-compact.png' });

// Let it finish; the compact orb + native chat should stay put.
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(1000);
  const now = await state();
  if (now.phase === 'done') {
    console.log('DONE', JSON.stringify(now, null, 2));
    break;
  }
}
await page.screenshot({ path: 'shots-v5/04-compact-done.png' });

// Expand and end through the native crossing button.
await press('.wg-orb');
await page.waitForTimeout(600);
await press('.wg-slot');
await page.waitForTimeout(800);
console.log('ENDED', JSON.stringify(await state(), null, 2));

console.log('LOGS', JSON.stringify(logs.slice(-40), null, 2));
await browser.close();
