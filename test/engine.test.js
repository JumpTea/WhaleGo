import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { WhaleEngine } from '../lib/engine.js';
import { DEFAULT_PREFS } from '../lib/prefs.js';
import { TranscriptStore } from '../lib/transcript.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Keep the voice registry out of the real ~/.dsh during tests.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'whalego-engine-home-'));

function makeHarness({ dshGo, attachments } = {}) {
  let engine;
  const dir = mkdtempSync(join(tmpdir(), 'whalego-engine-'));
  const transcript = new TranscriptStore({ file: join(dir, 'transcript.json') });
  const spoken = [];
  const prompts = [];
  const frames = [];
  const appends = [];
  const liveSession = {
    id: 's1',
    append(type, data, opts) {
      appends.push({ type, data, opts });
      return { seq: appends.length - 1 };
    },
  };
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
      if (name === 'sessions') return { get: (id) => (id === 's1' ? liveSession : undefined) };
      if (name === 'attachments') return attachments;
      return undefined;
    },
    logger: { warn() {}, info() {} },
    dshGo,
    ...(attachments ? { attachments } : {}),
  };
  const tts = {
    async synthesize(text) {
      spoken.push(text);
      return { buffer: Buffer.from('fake-mp3-data'), contentType: 'audio/mpeg' };
    },
    async synthesizeStream(text, { onChunk, onStart } = {}) {
      spoken.push(text);
      onStart?.();
      onChunk?.(Buffer.from('p1'));
      onChunk?.(Buffer.from('p2'));
      return { buffer: Buffer.from('fake-mp3-data'), contentType: 'audio/mpeg' };
    },
    dispose() {},
  };
  const prefs = { ...DEFAULT_PREFS };
  engine = new WhaleEngine({ ctx, prefs, transcript, tts, logger: ctx.logger });
  return { engine, transcript, spoken, prompts, frames, appends, prefs };
}

test('dual brain: voice line and text answer land in the transcript', async () => {
  const { engine, transcript, spoken, appends } = makeHarness();
  const effect = engine.ask({ draft: '帮我调查一下 2026 年 LLM 排行榜，并整理成表格', sessionId: 's1' });
  assert.equal(effect.type, 'audio');
  assert.equal(effect.src, 'media:speech');
  await sleep(60);
  const record = transcript.list('s1')[0];
  assert.match(record.voice, /语音答案/);
  assert.match(record.text, /文字答案/);
  assert.ok(spoken.some((line) => line.includes('语音答案')));
  const voiceMessage = appends.find((entry) => entry.type === 'assistant/message');
  assert.ok(voiceMessage, 'voice message was persisted');
  assert.equal(voiceMessage.data.message.content.length, 1);
  assert.equal(voiceMessage.data.message.content[0].type, 'voice');
  assert.match(voiceMessage.data.message.content[0].text, /语音答案/);
  assert.equal(voiceMessage.data.message.content[0].order, 'before-text');
  assert.equal(voiceMessage.data.message.content[0].context, false);
  assert.equal(voiceMessage.data.message.content[0].final, true);
  assert.deepEqual(voiceMessage.opts, { surfaceOp: 'append' });
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

test('streaming: audioStream receives Edge chunks while the line is still being spoken', async () => {
  const streams = [];
  const dshGo = {
    audioStream(init) {
      const stream = {
        init,
        chunks: [],
        ended: false,
        aborted: false,
        async write(chunk) {
          stream.chunks.push(Buffer.from(chunk));
        },
        async end() {
          stream.ended = true;
        },
        async abort() {
          stream.aborted = true;
        },
      };
      streams.push(stream);
      return stream;
    },
  };
  const { engine, prefs } = makeHarness({ dshGo });
  prefs.mode = 'dual';
  const effect = engine.ask({ draft: '帮我调查一下 2026 年 LLM 排行榜', sessionId: 's1' });
  assert.equal(effect.src, 'stream:speech');
  await sleep(60);
  assert.equal(streams.length, 1);
  assert.equal(streams[0].init.contentType, 'audio/mpeg');
  assert.equal(streams[0].init.sampleRate, 24000);
  assert.deepEqual(streams[0].chunks.map(String), ['p1', 'p2']);
  assert.equal(streams[0].ended, true);
  assert.equal(engine.diagnostics({}).native.audioStream, true);
});

test('replay: the finished line carries its mp3 attachment', async () => {
  const streams = [];
  const saved = [];
  const dshGo = {
    audioStream(init) {
      const stream = {
        init,
        chunks: [],
        ended: false,
        async write(chunk) {
          stream.chunks.push(Buffer.from(chunk));
        },
        async end() {
          stream.ended = true;
        },
        async abort() {},
      };
      streams.push(stream);
      return stream;
    },
  };
  const attachments = {
    async saveFile({ data, name }) {
      saved.push({ data: Buffer.from(data), name });
      return { attachmentId: 'sha256:voice', name, bytes: data.length };
    },
  };
  const { engine, prefs, appends } = makeHarness({ dshGo, attachments });
  prefs.mode = 'dual';
  const effect = engine.ask({ draft: '帮我调查一下 2026 年 LLM 排行榜', sessionId: 's1' });
  await sleep(60);
  const voiceMessage = appends.find((entry) => entry.type === 'assistant/message');
  assert.equal(voiceMessage.data.message.content[0].audio.attachmentId, 'sha256:voice');
  assert.equal(voiceMessage.data.message.content[0].audio.contentType, 'audio/mpeg');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, 'whalego-voice.mp3');
  assert.match(saved[0].data.toString(), /fake-mp3-data/);
  // The App shell has no audioStream player yet, so the persisted line falls
  // back to the v1.2 media effect instead of opening a stream.
  assert.equal(streams.length, 0);
  assert.equal(effect.src, 'media:speech');
});

test('snapshot exposes the native seam as missing', () => {
  const { engine } = makeHarness();
  const snapshot = engine.snapshot('s1');
  assert.equal(snapshot.nativeLabel, '未接入（P0）');
  assert.equal(snapshot.lines[0].title, '还没有记录');
  assert.equal(engine.diagnostics({}).rows.length, 5);
});
