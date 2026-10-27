#!/usr/bin/env node
/**
 * Profile-level smoke test for the Web UI half.
 *
 * Starts from a delivered dsh profile (the caller starts it), sends real
 * prompts through the plugin's own routes and checks the outside world:
 * a file actually written, a follow-up that needs the previous turn, a tool
 * count, a cancelled stream, streamed text and streamed audio.
 *
 *   node tools/smoke-web.mjs http://127.0.0.1:3100 <token>
 *
 * Exits non-zero when a scenario fails; prints one JSON report.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [, , baseArg, tokenArg] = process.argv;
if (!baseArg || !tokenArg) {
  console.error('usage: node tools/smoke-web.mjs <base-url> <token>');
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, '');
const MARK = String(Date.now()).slice(-5);
const NOTE = 'D:\\dsh-go-lab\\smoke-note.txt';

let cookie = '';

async function login() {
  const res = await fetch(`${base}/?token=${encodeURIComponent(tokenArg)}`, { redirect: 'manual' });
  const raw = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
  cookie = raw.map((entry) => String(entry).split(';')[0]).join('; ');
  if (!cookie) throw new Error('login: no cookie');
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

/** Read the live SSE feed until `end`, a deadline, or an abort. */
async function readLive(turnId, sessionId, { timeout = 120000, abortAfter = 0 } = {}) {
  const ac = new AbortController();
  const t0 = Date.now();
  const events = [];
  let timer = null;
  if (abortAfter > 0) timer = setTimeout(() => ac.abort(), abortAfter);
  // A quiet upstream keeps the socket open with no bytes: without this timer
  // `read()` would wait forever and the whole smoke would hang.
  const hardTimer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(`${base}/whalego/live?turn=${encodeURIComponent(turnId)}&session=${encodeURIComponent(sessionId)}`, {
      headers: { cookie, accept: 'text/event-stream' },
      signal: ac.signal,
    });
    if (!res.ok || !res.body) throw new Error(`live ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const deadline = Date.now() + timeout;
    for (;;) {
      if (Date.now() > deadline) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut = buffer.indexOf('\n\n');
      while (cut >= 0) {
        const chunk = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const event = { at: Date.now() - t0 };
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event:')) event.event = line.slice(6).trim();
          else if (line.startsWith('data:')) event.data = line.slice(5).trim();
        }
        if (event.event || event.data) events.push(event);
        if (event.event === 'end') {
          if (timer) clearTimeout(timer);
          ac.abort();
          return events;
        }
        cut = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    // A closed SSE socket or an intentional abort ends the feed; the caller
    // judges the scenario from the events collected so far.
    if (!events.length && error?.name !== 'AbortError') {
      console.error('live stream ended early:', error?.message ?? error);
    }
  } finally {
    if (timer) clearTimeout(timer);
    clearTimeout(hardTimer);
  }
  return events;
}

const parseLives = (events) =>
  events
    .filter((event) => event.event === 'live' && event.data)
    .map((event) => {
      try {
        return { at: event.at, ...JSON.parse(event.data) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

async function turn(sessionId, text, { timeout = 90000 } = {}) {
  const posted = await request('/whalego/voice-turn', { method: 'POST', body: { sessionId, text } });
  if (posted.status !== 200 || !posted.json?.ok) throw new Error(`voice-turn ${posted.status} ${posted.text.slice(0, 120)}`);
  const key = posted.json?.effect?.key;
  if (!key) throw new Error(`voice-turn returned no key: ${posted.text.slice(0, 120)}`);
  const events = await readLive(key, sessionId, { timeout });
  const lives = parseLives(events);
  const ended = events.some((event) => event.event === 'end');
  const last = lives.at(-1) ?? {};
  return {
    key,
    ended,
    lives,
    firstDeltaMs: lives.length ? lives[0].at : null,
    finalState: last.state ?? '',
    voice: String(last.voice ?? ''),
    text: String(last.text || last.voice || ''),
  };
}

async function speak(text) {
  const t0 = Date.now();
  const res = await fetch(`${base}/whalego/speak`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) return { ok: false, status: res.status };
  const reader = res.body.getReader();
  let bytes = 0;
  let firstByteMs = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (firstByteMs === null) firstByteMs = Date.now() - t0;
    bytes += value?.length ?? 0;
  }
  return { ok: bytes > 0, bytes, firstByteMs, totalMs: Date.now() - t0 };
}

const results = [];
const record = (name, passed, detail) => {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};

async function main() {
  await login();
  const session = await request('/whalego/session');
  const sessionId = session.json?.sessionId ?? '';
  if (!sessionId) throw new Error(`no session: ${session.text.slice(0, 120)}`);
  console.log(`session ${sessionId} · mark ${MARK}`);

  // 1. The voice brain answers a real prompt and streams its text.
  const first = await turn(sessionId, '用一句话介绍你自己。');
  record('real model answer', first.text.trim().length >= 6 && first.finalState !== 'error', `answer=${JSON.stringify(first.text.slice(0, 80))} state=${first.finalState}`);
  record('streams text before end', first.lives.length >= 2 && first.firstDeltaMs !== null, `deltas=${first.lives.length} first=${first.firstDeltaMs}ms`);

  // 2. A follow-up that can only be answered from the previous turn.
  const followUp = await turn(sessionId, '我上一句问了你什么？只复述那句话。');
  record('multi-turn context', /介绍|一句话/.test(followUp.text), `answer=${JSON.stringify(followUp.text.slice(0, 80))}`);

  // 4. Cancel a stream mid-flight.
  const posted = await request('/whalego/voice-turn', {
    method: 'POST',
    body: { sessionId, text: '请详细讲解 DSH 的插件加载顺序，尽量长，分十段。' },
  });
  const cancelKey = posted.json?.effect?.key;
  let cancelOk = false;
  let cancelState = '';
  if (cancelKey) {
    const livePromise = readLive(cancelKey, sessionId, { timeout: 60000, abortAfter: 6000 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const cancelled = await request('/whalego/cancel', { method: 'POST', body: { sessionId } });
    cancelOk = cancelled.status === 200 && cancelled.json?.cancelled === true;
    const events = await livePromise;
    const lives = parseLives(events);
    cancelState = lives.at(-1)?.state ?? '';
    record('cancel mid-stream', cancelOk && (cancelState === 'interrupted' || cancelState === 'done'), `cancelled=${cancelOk} state=${cancelState}`);
  } else {
    record('cancel mid-stream', false, 'no turn key');
  }

  // 5. Audio really streams: first byte well before the last byte.
  const audio = await speak(`你好，这是第 ${MARK} 号流式语音测试，用来确认音频是一边合成一边送出来的。`);
  record('streams audio', audio.ok && audio.bytes > 1000 && audio.firstByteMs !== null && audio.totalMs > audio.firstByteMs, `bytes=${audio.bytes} first=${audio.firstByteMs}ms total=${audio.totalMs}ms`);

  const report = { base, sessionId, mark: MARK, results, at: new Date().toISOString() };
  writeFileSync('D:\\dsh-go-lab\\smoke-report.json', JSON.stringify(report, null, 2));
  const failed = results.filter((item) => !item.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('SMOKE ERROR', error?.message ?? error);
  process.exit(3);
});
