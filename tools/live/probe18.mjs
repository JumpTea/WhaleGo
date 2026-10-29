import { chromium } from 'playwright-core';

const url = process.argv[2];
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({ executablePath: edge, headless: true });
const page = await browser.newPage({
  viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const requests = [];
page.on('request', (r) => {
  if (r.url().includes('/whalego/')) requests.push(`${r.method()} ${r.url().replace(url.split('?')[0], '')}`);
});
await page.addInitScript(() => {
  window.__whalegoDebug = true;
  window.__recogStarts = 0;
  window.__recogLog = [];
  class FakeRecognition {
    constructor() { this.continuous = false; this.interimResults = false; this.running = false; this.lang = ''; }
    start() {
      this.running = true;
      window.__recogStarts += 1;
      window.__recog = this;
      window.__recogLog.push('start');
      setTimeout(() => this.onstart?.({}), 0);
    }
    stop() {
      this.running = false;
      const frame = String(new Error().stack || '').split('\n').slice(1, 4).join(' | ');
      window.__recogLog.push(`stop ${frame}`);
      setTimeout(() => this.onend?.({}), 0);
    }
    abort() { this.stop(); }
    emit(transcript, isFinal = true) {
      const result = [{ transcript }];
      result.isFinal = isFinal;
      this.onresult?.({ resultIndex: 0, results: [result] });
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.wg-slot', { timeout: 60000 });
await page.waitForTimeout(400);
const slot = await page.locator('.wg-slot').boundingBox();
await page.mouse.click(slot.x + slot.width / 2, slot.y + slot.height / 2);
await page.waitForTimeout(500);
console.log('OPEN', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  starts: window.__recogStarts,
  running: window.__recog?.running,
})));

const emit = (text, final = true) => page.evaluate(([t, f]) => window.__recog?.emit(t, f), [text, final]);
await emit('用一句话介绍你自己');
await page.waitForTimeout(1500);
console.log('SENT1', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  turn: window.__whalegoLastTurn?.text,
  starts: window.__recogStarts,
  running: window.__recog?.running,
})));
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'speaking', { timeout: 60000 });
console.log('SPEAKING1', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  audio: window.__whalegoAudio?.state,
  starts: window.__recogStarts,
  running: window.__recog?.running,
})));

const answerState = await page.evaluate(() => window.__whalegoState());
console.log('ANSWER', String(answerState.answer || '').slice(0, 50));
await emit(String(answerState.answer || '').slice(0, 18));
await page.waitForTimeout(1300);
console.log('ECHO', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  turn: window.__whalegoLastTurn?.text,
  mic: window.__whalegoState().mic,
})));

// Barge in while the answer is audible: the mic must stay open and a second
// turn must cancel the first.
await emit('停一下，说说你今天的心情');
await page.waitForTimeout(250);
console.log('BARGE', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  audio: window.__whalegoAudio?.state,
  interim: document.querySelector('.wg-heard')?.textContent,
  starts: window.__recogStarts,
  running: window.__recog?.running,
})));
await page.waitForFunction(
  () => window.__whalegoLastTurn?.text === '停一下，说说你今天的心情',
  { timeout: 15000 },
);
console.log('SENT2', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  turn: window.__whalegoLastTurn?.text,
  starts: window.__recogStarts,
  running: window.__recog?.running,
  trace: window.__phaseTrace,
})));

// Let the second answer start, then verify the native chat has two user turns
// and one answer each, not a duplicated/merged bubble.
await page.waitForFunction(
  () => document.querySelector('.wg-space')?.dataset.phase === 'speaking',
  { timeout: 30000 },
);
await page.waitForTimeout(1200);
console.log('TWO-TURNS', await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    q1: (text.match(/用一句话介绍你自己/g) || []).length,
    q2: (text.match(/停一下，说说你今天的心情/g) || []).length,
    frames: document.querySelectorAll('[class*="EvIC1a_frame"]').length,
    caption: document.querySelector('.wg-caption')?.textContent ?? '',
    phase: document.querySelector('.wg-space')?.dataset.phase,
  };
}));
await page.screenshot({ path: 'tools/live/shots-v6/duplex-two-turns.png' });

const orbBox = await page.locator('.wg-orb:not(.mini)').boundingBox();
await page.mouse.click(orbBox.x + orbBox.width / 2, orbBox.y + orbBox.height / 2);
await page.waitForTimeout(700);
console.log('COMPACT', await page.evaluate(() => {
  const space = document.querySelector('.wg-space');
  const orb = document.querySelector('.wg-orb:not(.mini)')?.getBoundingClientRect();
  return {
    compact: space?.dataset.compact,
    veil: space?.dataset.veil,
    orb: orb && { x: Math.round(orb.x), y: Math.round(orb.y), w: Math.round(orb.width) },
    caption: document.querySelector('.wg-caption')?.textContent ?? '',
  };
}));
await page.screenshot({ path: 'tools/live/shots-v6/duplex-compact.png' });
console.log('REQUESTS', requests.slice(-8));

// Full duplex: the browser ends continuous recognition; it must come back.
await page.evaluate(() => window.__recog?.stop());
await page.waitForTimeout(900);
console.log('RESTART', await page.evaluate(() => ({
  phase: document.querySelector('.wg-space')?.dataset.phase,
  starts: window.__recogStarts,
  running: window.__recog?.running,
  log: window.__recogLog,
})));
await page.screenshot({ path: 'tools/live/shots-v6/duplex-barge.png' });
await browser.close();
