/**
 * The native auto lane: a question the user sends through the App's own UI is
 * answered out loud next to the session agent's turn (hostWrites), the
 * browser-entry reminder fires once in a while, and the plugin never answers
 * its own prompt twice.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { entryUrl } from '../lib/browserBridge.js';
import { entryHint, registerActions } from '../lib/actions.js';
import { WhaleEngine } from '../lib/engine.js';
import { DEFAULT_PREFS } from '../lib/prefs.js';
import { TranscriptStore } from '../lib/transcript.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Keep the voice registry and prefs file out of the real ~/.dsh during tests.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'whalego-native-home-'));

function userMessageEvent(text) {
  return {
    type: 'user/message',
    data: { message: { content: [{ type: 'text', text }], source: { kind: 'user' } } },
  };
}

function makeHarness() {
  let engine;
  const dir = mkdtempSync(join(tmpdir(), 'whalego-native-'));
  const transcript = new TranscriptStore({ file: join(dir, 'transcript.json') });
  const prompts = [];
  const session = {
    async modelCatalog() {
      return { default: { provider: 'deepseek', model: 'chat' } };
    },
    async prompt(request, signal) {
      prompts.push(request);
      setTimeout(() => {
        if (signal?.aborted) return;
        engine.onAssistantFrame('s1', { type: 'start', turn: 1 });
        engine.onAssistantFrame('s1', { type: 'chunk', chunk: { type: 'text-delta', text: '文字答案。' } });
        engine.onAssistantFrame('s1', { type: 'end' });
        engine.onSessionEvent('s1', { type: 'turn/end', reason: 'completed' });
      }, 5);
      return { requestId: request.requestId };
    },
    cancel() {},
  };
  const llm = {
    async *stream(options = {}) {
      if (String(options.system ?? '').includes('文字脑')) {
        yield { type: 'text-delta', text: '书面答案。' };
        return;
      }
      yield { type: 'text-delta', text: '我想想。' };
      yield { type: 'text-delta', text: '语音答案。' };
    },
  };
  const ctx = {
    get(name) {
      if (name === 'llm') return llm;
      if (name === 'sessionController') return session;
      if (name === 'sessions') return { get: (id) => (id === 's1' ? { id: 's1' } : undefined) };
      return undefined;
    },
    logger: { warn() {}, info() {} },
  };
  const tts = {
    async synthesize(text) {
      return { buffer: Buffer.from('fake-mp3-data'), contentType: 'audio/mpeg' };
    },
    dispose() {},
  };
  const prefs = { ...DEFAULT_PREFS };
  engine = new WhaleEngine({ ctx, prefs, transcript, tts, logger: ctx.logger });
  return { engine, transcript, prompts, prefs, session };
}

test('host message: the spoken lane adds durable voice rows without prompting the session agent', async () => {
  const { engine, transcript, prompts } = makeHarness();
  engine.onSessionMessage({ sessionId: 's1', question: '今天天气怎么样' });
  assert.equal(engine.status, 'thinking');
  await sleep(80);
  const records = transcript.list('s1');
  assert.equal(records.length, 1);
  assert.match(records[0].voice, /语音答案/);
  // The session agent owns the written answer; the plugin must not send its
  // own prompt and race against it.
  assert.equal(prompts.length, 0);
  assert.equal(engine.status, 'done');
});

test('host lane noise is ignored: off switch, commands, demo lane, active session', async () => {
  const { engine, transcript, prefs } = makeHarness();
  engine.onSessionMessage({ sessionId: 's1', question: '/imagen 天空' });
  engine.onSessionMessage({ sessionId: 's1', question: 'voice-demo:天空' });
  engine.onSessionMessage({ sessionId: '', question: '空白' });
  engine.onSessionMessage({ sessionId: 's1', question: '' });
  assert.equal(transcript.list('s1').length, 0);

  prefs.nativeAuto = 'off';
  engine.onSessionMessage({ sessionId: 's1', question: '今天天气怎么样' });
  assert.equal(engine.status, 'idle');
  assert.equal(transcript.list('s1').length, 0);

  prefs.nativeAuto = 'on';
  engine.onSessionMessage({ sessionId: 's1', question: '第一个问题' });
  // One turn per session: a second message while it runs changes nothing.
  engine.onSessionMessage({ sessionId: 's1', question: '第二个问题' });
  await sleep(80);
  assert.equal(transcript.list('s1').length, 1);
  assert.match(transcript.list('s1')[0].voice, /语音答案/);
});

test('host events: a user message starts the spoken lane; own prompts do not', async () => {
  const { engine, transcript, prompts } = makeHarness();
  // The ask button pushes the question into the session via #ownPrompt and
  // stamps it; the same text coming back on session/event must be ignored.
  // The ask button pushes the question into the session via #ownPrompt and
  // stamps it; the same text coming back on session/event must be ignored.
  const effect = engine.ask({ draft: '帮我调查一下 2026 年 LLM 排行榜', sessionId: 's1' });
  await sleep(120);
  assert.equal(prompts.length, 1);
  const prompted = String(
    prompts[0].content.filter((block) => block?.type === 'text').map((block) => block?.text ?? '').join('\n'),
  ).trim();
  assert.ok(prompted.includes('帮我调查一下'));
  engine.onUserMessage({ id: 's1' }, userMessageEvent(prompted));
  engine.onUserMessage({ id: 's1' }, userMessageEvent('  '));
  assert.equal(transcript.list('s1').length, 1);
  assert.equal(prompts.length, 1);

  engine.onCapability({ sessionId: 's1' }, { event: 'audio.ended', key: effect.key });
  // An untouched user question starts the native lane right away.
  engine.onUserMessage({ id: 's1' }, userMessageEvent('今天天气怎么样'));
  await sleep(80);
  assert.equal(transcript.list('s1').length, 2);
  assert.match(transcript.list('s1')[1].voice, /语音答案/);
  assert.equal(prompts.length, 1);
});

test('events in other shapes or senders are inert', () => {
  const { engine, transcript } = makeHarness();
  engine.onUserMessage({ id: 's1' }, { type: 'session/renamed' });
  engine.onUserMessage({ id: 's1' }, { type: 'user/message', data: { message: { content: [{ type: 'text', text: '…' }], source: { kind: 'agent' } } } });
  engine.onUserMessage({ id: 's1' }, { type: 'user/message', data: { message: { content: [{ type: 'image', url: 'x' }], source: { kind: 'user' } } } });
  assert.equal(transcript.list('s1').length, 0);
});

test('browser-entry reminder: once per window, action results keep their own fields', () => {
  const prefs = { hintAt: 0 };
  const hint = entryHint(prefs);
  const first = hint({ type: 'audio', key: 'k1' });
  assert.equal(first.toast, '完整语音体验（免提/流式）请用浏览器入口，地址已复制');
  assert.match(first.copy, /^http:\/\/127\.0\.0\.1:\d+\/\?voice=1$/);
  assert.ok(prefs.hintAt > 0);

  const second = hint({ type: 'audio', key: 'k2' });
  assert.equal(second.toast, undefined);
  assert.equal(second.copy, undefined);

  // The action's own toast answers first; the hint never overrides it.
  prefs.hintAt = 0;
  const own = hint({ toast: '先写一句话。' });
  assert.equal(own.toast, '先写一句话。');
  assert.ok(own.copy);
});

test('browser-entry reminder: the stored timestamp silences the next window', () => {
  const prefs = { hintAt: Date.now() - 60_000 };
  const justHinted = entryHint(prefs, 12 * 60 * 60 * 1000);
  assert.equal(justHinted({}).toast, undefined);
  prefs.hintAt = Date.now() - 13 * 60 * 60 * 1000;
  assert.equal(entryHint(prefs, 12 * 60 * 60 * 1000)({}).toast, '完整语音体验（免提/流式）请用浏览器入口，地址已复制');
});

test('registered actions wrap the ask button with the reminder', () => {
  const handlers = new Map();
  const dshGo = {
    on: (id, handler) => handlers.set(id, handler),
  };
  const saved = [];
  let prefs = { hintAt: 0 };
  registerActions(undefined, dshGo, { ask: () => ({ toast: '先写一句话。' }) }, prefs);
  const result = handlers.get('whalego.ask')({ draft: '' });
  assert.equal(result.toast, '先写一句话。');
  assert.ok(result.copy);
  assert.ok(result.hintAt === undefined);
  saved.push(prefs.hintAt > 0);

  prefs = { hintAt: Date.now() };
  registerActions(undefined, dshGo, { ask: () => ({ type: 'audio' }) }, prefs);
  const muted = handlers.get('whalego.ask')({ draft: '问题' });
  assert.equal(muted.toast, undefined);
  assert.equal(muted.copy, undefined);
  assert.deepEqual(saved, [true]);
});

test('entryUrl matches the bridge page the browser needs', () => {
  assert.equal(entryUrl(3099), 'http://127.0.0.1:3099/?voice=1');
  assert.equal(entryUrl(3001), 'http://127.0.0.1:3001/?voice=1');
});
