import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WhaleEngine } from '../lib/engine.js';
import { DEFAULT_PREFS } from '../lib/prefs.js';
import { TranscriptStore } from '../lib/transcript.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeHarness() {
  let engine;
  const dir = mkdtempSync(join(tmpdir(), 'whalego-engine-'));
  const transcript = new TranscriptStore({ file: join(dir, 'transcript.json') });
  const spoken = [];
  const prompts = [];
  const frames = [];
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
      }, 5);
      return { requestId: request.requestId };
    },
    cancel() {
      frames.push('cancel');
    },
  };
  const llm = {
    async *stream() {
      yield { type: 'text-delta', text: '我想想。' };
      await sleep(2);
      yield { type: 'text-delta', text: '语音答案。' };
    },
  };
  const ctx = {
    get(name) {
      if (name === 'llm') return llm;
      if (name === 'sessionController') return session;
      return undefined;
    },
    logger: { warn() {}, info() {} },
  };
  const tts = {
    async synthesize(text) {
      spoken.push(text);
      return { buffer: Buffer.from('fake-mp3-data'), contentType: 'audio/mpeg' };
    },
    dispose() {},
  };
  const prefs = { ...DEFAULT_PREFS };
  engine = new WhaleEngine({ ctx, prefs, transcript, tts, logger: ctx.logger });
  return { engine, transcript, spoken, prompts, frames, prefs };
}

test('dual brain: voice line and text answer land in the transcript', async () => {
  const { engine, transcript, spoken } = makeHarness();
  const effect = engine.ask({ draft: '帮我调查一下 2026 年 LLM 排行榜，并整理成表格', sessionId: 's1' });
  assert.equal(effect.type, 'audio');
  assert.equal(effect.src, 'media:speech');
  await sleep(60);
  const record = transcript.list('s1')[0];
  assert.match(record.voice, /语音答案/);
  assert.match(record.text, /文字答案/);
  assert.ok(spoken.some((line) => line.includes('语音答案')));
  const media = await engine.media({}, { key: effect.key });
  assert.equal(media.body.toString(), 'fake-mp3-data');
  assert.equal(engine.status, 'speaking');
  engine.onCapability({ sessionId: 's1' }, { event: 'audio.ended', key: effect.key });
  assert.equal(engine.status, 'done');
});

test('read mode: speaks the text answer instead of a separate voice brain', async () => {
  const { engine, transcript, spoken, prefs } = makeHarness();
  prefs.mode = 'read';
  const effect = engine.ask({ draft: '今天天气怎么样', sessionId: 's1' });
  await sleep(60);
  const record = transcript.list('s1')[0];
  assert.match(record.text, /文字答案/);
  assert.match(record.voice, /文字答案/);
  assert.ok(spoken.some((line) => line.includes('文字答案')));
  await engine.media({}, { key: effect.key });
});

test('stop aborts the active turn and marks the transcript', async () => {
  const { engine, transcript, prefs } = makeHarness();
  prefs.mode = 'dual';
  engine.ask({ draft: '一个需要复杂推理的问题', sessionId: 's1' });
  const effect = engine.stop({ sessionId: 's1' });
  assert.equal(effect.op, 'stop');
  assert.equal(engine.status, 'interrupted');
  assert.equal(transcript.list('s1')[0].state, 'interrupted');
});

test('snapshot exposes the native seam as missing', () => {
  const { engine } = makeHarness();
  const snapshot = engine.snapshot('s1');
  assert.equal(snapshot.nativeLabel, '未接入（P0）');
  assert.equal(snapshot.lines[0].title, '还没有记录');
  assert.equal(engine.diagnostics({}).rows.length, 5);
});
