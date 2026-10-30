#!/usr/bin/env node
/**
 * Playback-receipt check: a web turn must stay open until the browser says the
 * audio finished, and settle exactly then.
 *
 *   node tools/check-playback.mjs
 *
 * Mounts the real `/whalego` routes on a throwaway HTTP server and runs one web
 * turn against a stub voice brain — no llm key, no TTS, no browser. It walks the
 * live SSE stream to collect the speech segments, proves the turn is still
 * `speaking` before the receipt, then sends the receipt and checks the turn is
 * `done` and a second receipt is refused. Exits non-zero on failure.
 */
import http from 'node:http';
import { WhaleEngine } from '../lib/engine.js';
import { TranscriptStore } from '../lib/transcript.js';
import { DEFAULT_PREFS } from '../lib/prefs.js';
import { registerRoutes } from '../lib/routes.js';

const SESSION = 'check-playback';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
  throw new Error(message);
}

function check(condition, message) {
  if (!condition) fail(message);
  console.log(`PASS ${message}`);
}

const routes = new Map();
const ctx = {
  get(name) {
    if (name === 'llm') {
      return {
        stream: async function* stream() {
          yield { type: 'text-delta', text: '第一句话已经在响了。' };
          await sleep(150);
          yield { type: 'text-delta', text: '第二句话也来了。' };
        },
      };
    }
    if (name === 'sessionController') {
      return {
        async modelCatalog() {
          return { default: { provider: 'check', model: 'voice' } };
        },
        async cancel() {},
      };
    }
    if (name === 'webServer') {
      return {
        register(definition) {
          routes.set(definition.path, definition.handler);
          return () => routes.delete(definition.path);
        },
      };
    }
    return undefined;
  },
};

let engine;
registerRoutes(ctx, () => engine);
engine = new WhaleEngine({
  ctx,
  transcript: new TranscriptStore(),
  prefs: { ...DEFAULT_PREFS },
  webMode: true,
  tts: { synthesize: async () => ({ buffer: Buffer.from('audio') }), dispose() {} },
  logger: { warn() {}, info() {} },
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const handler = routes.get(url.pathname);
  if (!handler) {
    res.writeHead(404).end();
    return;
  }
  handler(req, res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function followSse(url, onEvent, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${url}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`sse ${response.status}`);
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let index = buffer.indexOf('\n\n'); index >= 0; index = buffer.indexOf('\n\n')) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const event = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
        const data = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
        if (event && data) onEvent(event, JSON.parse(data));
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

try {
  const turn = await post('/whalego/voice-turn', { sessionId: SESSION, text: '你好' });
  check(turn.status === 200 && turn.body.ok === true, 'voice-turn starts a web turn');
  const turnId = turn.body.effect?.key;
  check(typeof turnId === 'string' && turnId.length > 0, 'the turn exposes its id to the browser');

  const frames = [];
  let ended = null;
  let receiptPromise = null;
  let openBeforeReceipt = false;
  await followSse(`/whalego/live?turn=${encodeURIComponent(turnId)}&session=${SESSION}`, (event, data) => {
    if (event === 'live') {
      frames.push(data);
      if (data.generationDone === true && data.state === 'speaking' && !receiptPromise) {
        openBeforeReceipt = engine.live(turnId)?.state === 'speaking';
        receiptPromise = post('/whalego/playback', { sessionId: SESSION, turnId, state: 'ended' });
      }
    }
    if (event === 'end') ended = data;
  });
  const receipt = await receiptPromise;

  const speech = [];
  const seen = new Set();
  for (const frame of frames) {
    for (const part of Array.isArray(frame.speech) ? frame.speech : []) {
      if (seen.has(part.id)) continue;
      seen.add(part.id);
      speech.push(part);
    }
  }
  check(speech.length >= 2, `the live stream delivers whole sentences (${speech.length})`);
  check(speech.every((part) => part.text.trim().length > 0), 'every sentence carries text');
  check(frames.some((frame) => frame.generationDone === true), 'the stream announces the end of generation');
  check(frames.some((frame) => frame.state === 'speaking'), 'the turn is handed over to the browser in the speaking state');

  // The point of the receipt: without it the turn is still open.
  check(openBeforeReceipt, 'the turn stays open until the browser reports back');

  check(receipt?.status === 200 && receipt?.body?.completed === true, 'the playback receipt settles the turn');
  check(engine.live(turnId).state === 'done' && ended?.state === 'done', 'the settled turn is done');

  const again = await post('/whalego/playback', { sessionId: SESSION, turnId, state: 'ended' });
  check(again.body.completed === false, 'a repeated receipt is refused instead of resurrecting the turn');

  const foreign = await post('/whalego/playback', { sessionId: 'other', turnId, state: 'ended' });
  check(foreign.body.completed === false, 'a receipt from another session is refused');

  console.log('check-playback: all checks passed');
} catch (error) {
  if (!process.exitCode) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
} finally {
  engine.dispose();
  await new Promise((resolve) => server.close(resolve));
}
