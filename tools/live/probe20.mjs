/**
 * Live smoke for the real WebUI voice path with the host's own agent:
 *   1. a voice turn asks the agent to write a file through a tool;
 *   2. a second turn reads it back in the same session;
 *   3. a third turn is interrupted while speaking.
 *
 * The fake recogniser keeps the host's real microphone/TTS out of the test:
 * headless Chromium has no echo cancellation and would barge in on our TTS.
 * Everything else is the real DSH agent + provider.
 *
 * Usage: node tools/live/probe20.mjs <url>
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const url = process.argv[2];
if (!url) throw new Error('usage: node tools/live/probe20.mjs <url>');
// The host server runs from the workspace root; this probe runs from WhaleGo.
const file = resolve(process.cwd(), '..', '.whalego-live-smoke.txt');
const fileHere = resolve(process.cwd(), '.whalego-live-smoke.txt');
rmSync(file, { force: true });
rmSync(fileHere, { force: true });

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  permissions: ['microphone'],
  locale: 'zh-CN',
});
const page = await context.newPage();

await page.addInitScript(() => {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      console.log('CLICK', target?.className || '', target?.getAttribute?.('aria-label') || '');
    },
    true,
  );
  class FakeRecognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.running = false;
      this.lang = '';
    }
    start() {
      this.running = true;
      window.__recog = this;
      setTimeout(() => this.onstart?.({}), 0);
    }
    stop() {
      this.running = false;
      setTimeout(() => this.onend?.({}), 0);
    }
    abort() {
      this.stop();
    }
    emit(transcript, isFinal = true) {
      const result = [{ transcript }];
      result.isFinal = isFinal;
      this.onresult?.({ resultIndex: 0, results: [result] });
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
});

const requests = [];
const logs = [];
page.on('request', (request) => {
  const parsed = new URL(request.url());
  if (parsed.pathname.includes('/whalego/')) requests.push(`${request.method()} ${parsed.pathname}`);
});
page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => logs.push(String(error)));

async function press(selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

const state = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    const input = document.querySelector('textarea');
    return {
      phase: space?.dataset.phase,
      open: space?.dataset.open,
      compact: space?.dataset.compact,
      veil: space?.dataset.veil,
      answer: window.__whalegoState?.().answer ?? '',
      error: document.querySelector('.wg-error')?.textContent ?? '',
      inputVisible: Boolean(input && input.getBoundingClientRect().bottom <= innerHeight),
      chat: document.body.innerText.replace(/\s+/g, ' ').slice(-1600),
    };
  });

const say = (text) => page.evaluate((value) => window.__whalegoSay(value), text);

async function waitForDone(label, maxSeconds = 120) {
  let now = await state();
  for (let i = 0; i < maxSeconds; i += 1) {
    await page.waitForTimeout(1000);
    now = await state();
    if (i % 5 === 0) console.log(`${label} T+${i + 1}s`, now.phase, now.answer.slice(0, 120), now.error);
    if (now.open !== 'true') {
      console.log('OPEN-FLIP', JSON.stringify(now, null, 2));
      break;
    }
    if (now.phase === 'done' && now.answer) break;
    if (now.phase === 'idle' && !now.answer && i > 15) break;
  }
  return now;
}

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('.wg-slot', { timeout: 60_000 });
await page.waitForTimeout(700);
await press('.wg-slot');
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'true', null, {
  timeout: 10_000,
});

// 1) Tool call: the real agent must write the file.
await say('请用文件工具在当前工作区的 .whalego-live-smoke.txt 写入 whalego-live-ok，然后只回复“已写入”。');
const first = await waitForDone('T1');
console.log('T1', JSON.stringify(first, null, 2));
const written = existsSync(file) ? file : existsSync(fileHere) ? fileHere : '';
console.log('FILE', written, written ? readFileSync(written, 'utf8') : '');
assert.equal(first.phase, 'done');
// A is the spoken track and has no tools; B (the written agent) does the work.
// The file is the strongest evidence that the tool turn actually ran.
assert.ok(written);
assert.equal(readFileSync(written, 'utf8'), 'whalego-live-ok');

// 2) Second turn in the same session: read the file back through a tool.
await say('读回 .whalego-live-smoke.txt 的内容，原样告诉我。');
const second = await waitForDone('T2');
console.log('T2', JSON.stringify(second, null, 2));
assert.equal(second.phase, 'done');
// The spoken answer elides fenced code; the native chat is the full answer.
assert.match(second.chat, /whalego-live-ok/);

// 3) Third turn: interrupt while speaking; the turn is cancelled and a new
// voice turn starts without closing the microphone.
await say('请用三句话介绍你自己，慢慢说。');
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'speaking', null, {
  timeout: 90_000,
});
const cancelBase = requests.filter((line) => line.endsWith('whalego/cancel')).length;
const turnBefore = await page.evaluate(() => window.__whalegoLastTurn?.turnId || '');
await page.evaluate(() => window.__recog?.emit('停一下，换个话题'));
let barge;
for (let i = 0; i < 40; i += 1) {
  await page.waitForTimeout(50);
  barge = await state();
  if (requests.filter((line) => line.endsWith('whalego/cancel')).length > cancelBase) break;
}
const cancels = requests.filter((line) => line.endsWith('whalego/cancel')).length;
console.log('BARGE', JSON.stringify(barge, null, 2));
console.log('COUNTS', { cancelBase, cancels, turnBefore });
console.log('LOGS-NOW', JSON.stringify(logs.slice(-12), null, 2));
console.log('REQUESTS', JSON.stringify(requests.slice(-12), null, 2));
assert.ok(cancels > cancelBase);
let newTurn = null;
let after = barge;
for (let i = 0; i < 75; i += 1) {
  await page.waitForTimeout(200);
  after = await state();
  const last = await page.evaluate(() => window.__whalegoLastTurn || null);
  if (last?.turnId && last.turnId !== turnBefore) {
    newTurn = last;
    if (after.phase === 'speaking' || after.phase === 'done') break;
  }
}
console.log('AFTER-BARGE', JSON.stringify(after, null, 2));
console.log('NEWTURN', JSON.stringify(newTurn, null, 2));
assert.ok(newTurn && String(newTurn.text || '').includes('停一下'));
assert.ok(after.phase === 'speaking' || after.phase === 'done' || after.phase === 'thinking');
console.log('LOGS', JSON.stringify(logs.slice(-8), null, 2));

await browser.close();
