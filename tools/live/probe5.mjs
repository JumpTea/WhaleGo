/** Interaction probe: compact, interrupt-from-compact, collapse, reopen. */
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

const state = () =>
  page.evaluate(() => {
    const space = document.querySelector('.wg-space');
    return {
      open: space?.dataset.open,
      compact: space?.dataset.compact,
      phase: space?.dataset.phase,
      mini: Boolean(document.querySelector('.wg-mini')),
      audio: window.__whalegoAudio?.state,
      bound: window.__whalegoSession?.(),
      turn: window.__whalegoLastTurn,
    };
  });

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.wg-slot', { timeout: 30_000 });
await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'listening');
await page.evaluate(() => window.__whalegoSay?.('请分三句话介绍你在本机都能做什么。'));
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.phase === 'speaking', null, {
  timeout: 30_000,
});
await page.waitForTimeout(700);
console.log('SPEAKING', await state());

// Collapse mid-answer, then reopen from the mini orb: the turn must survive.
await page.locator('.wg-top button').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'false');
await page.waitForTimeout(250);
console.log('COLLAPSED-SPEAKING', await state());
await page.screenshot({ path: 'shots-v6/collapsed-mini.png' });
await page.locator('.wg-mini').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'true');
await page.waitForTimeout(450);
console.log('REOPENED-SPEAKING', await state());

// Full orb while speaking: shrink to the chat, keep the voice going.
await page.locator('.wg-orb').click({ force: true });
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.compact === 'true');
await page.waitForTimeout(400);
console.log('COMPACT', await state());

// Small orb: interrupt, return to full, listen.
await page.locator('.wg-orb').click({ force: true });
try {
  await page.waitForFunction(
    () =>
      document.querySelector('.wg-space')?.dataset.compact === 'false' &&
      document.querySelector('.wg-space')?.dataset.phase === 'listening',
    null,
    { timeout: 5_000 },
  );
} catch (error) {
  console.log('RETURN-TIMEOUT', await state());
  throw error;
}
console.log('INTERRUPTED-LISTEN', await state());

await page.evaluate(() => {
  const Base = window.SpeechRecognition;
  window.__starts = 0;
  window.__ends = 0;
  class Counted extends Base {
    start() {
      window.__starts += 1;
      return super.start();
    }
    stop() {
      window.__ends += 1;
      return super.stop();
    }
  }
  window.SpeechRecognition = Counted;
  window.webkitSpeechRecognition = Counted;
});

// Collapse with the hamburger: mode stays on, mini orb appears.
await page.locator('.wg-top button').first().click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'false');
await page.waitForTimeout(300);
console.log('COLLAPSED', await state());

// Mini orb reopens the full space and listens again.
await page.locator('.wg-mini').click({ force: true });
await page.waitForFunction(
  () =>
    document.querySelector('.wg-space')?.dataset.open === 'true' &&
    document.querySelector('.wg-space')?.dataset.compact === 'false',
  null,
  { timeout: 5_000 },
);
await page.waitForTimeout(400);
console.log('REOPENED', await state());
await page.screenshot({ path: 'shots-v6/reopened.png' });

// With a conversation on screen, the big orb opens the chat view instead of
// silently re-arming the microphone.
await page.locator('.wg-orb').click({ force: true });
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.compact === 'true');
await page.waitForTimeout(250);
console.log('IDLE-COMPACT', await state());

// The small orb is the way back to a spoken turn.
await page.locator('.wg-orb').click({ force: true });
await page.waitForFunction(
  () =>
    document.querySelector('.wg-space')?.dataset.compact === 'false' &&
    document.querySelector('.wg-space')?.dataset.phase === 'listening',
  null,
  { timeout: 5_000 },
);
console.log('COMPACT-AGAIN-LISTEN', await state());

await page.screenshot({ path: 'shots-v6/final-listening.png' });

// The native X is the only way to end voice mode.
await page.locator('.wg-slot').click();
await page.waitForFunction(() => document.querySelector('.wg-space')?.dataset.open === 'false');
await page.waitForTimeout(300);
console.log('ENDED', await state());

await browser.close();
