import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';
import { WhaleEngine } from '../lib/engine.js';
import { TranscriptStore } from '../lib/transcript.js';
import { DEFAULT_PREFS } from '../lib/prefs.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function harness(t, { stream, synthesize, prompt, llm = true } = {}) {
  const transcript = new TranscriptStore();
  const cancellations = [];
  const prompts = [];
  const session = {
    async modelCatalog() { return { default: { provider: 'test', model: 'voice' } }; },
    async cancel(request) { cancellations.push(request); },
  };
  if (prompt) {
    session.prompt = async (request) => {
      prompts.push(request);
      return prompt(request);
    };
  }
  const ctx = {
    get(name) {
      if (name === 'llm') return llm ? { stream: stream ?? (async function* () { yield { type: 'text-delta', text: '这是语音回答。' }; }) } : undefined;
      if (name === 'sessionController') return session;
    },
  };
  const engine = new WhaleEngine({
    ctx, transcript, prefs: { ...DEFAULT_PREFS }, webMode: true,
    tts: { synthesize: synthesize ?? (async () => ({ buffer: Buffer.from('audio') })), dispose() {} },
    logger: { warn() {}, info() {} },
  });
  t.after(() => engine.dispose());
  return { engine, transcript, cancellations, prompts };
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail('expected asynchronous state did not arrive');
}

test('web voice exposes a complete clause while generation is still pending', async (t) => {
  const tail = deferred();
  const { engine } = harness(t, { stream: async function* () {
    yield { type: 'text-delta', text: '我想想。' };
    await tail.promise;
    yield { type: 'text-delta', text: '这是后续回答' };
  } });
  t.after(() => tail.resolve());
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  await until(() => engine.live(effect.key).voice === '我想想。');
  const early = engine.live(effect.key);
  assert.deepEqual(early.speech.map((part) => part.text), ['我想想。']);
  assert.equal(early.generationDone, false);
  tail.resolve();
  await until(() => engine.live(effect.key).generationDone);
  const final = engine.live(effect.key);
  assert.deepEqual(final.speech.map((part) => part.text), ['我想想。', '这是后续回答']);
  assert.equal(new Set(final.speech.map((part) => part.id)).size, 2);
});

test('web voice asks the real session agent and speaks its stream', async (t) => {
  const { engine, prompts } = harness(t, { prompt: async () => {}, llm: false });
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  await until(() => prompts.length === 1);
  assert.deepEqual(prompts[0].content, [{ type: 'text', text: '你好' }]);
  assert.equal(prompts[0].sessionId, 's1');

  engine.onAssistantFrame('s1', { type: 'start', turn: 't1' });
  engine.onAssistantFrame('s1', {
    type: 'chunk',
    turn: 't1',
    chunk: { type: 'text-delta', text: '第一句。第二句。' },
  });
  // The 140ms poll is what turns the partial Session text into speech early.
  await new Promise((resolve) => setTimeout(resolve, 240));
  const early = engine.live(effect.key);
  assert.deepEqual(early.speech.map((part) => part.text), ['第一句。', '第二句。']);
  assert.equal(early.generationDone, false);

  engine.onAssistantFrame('s1', { type: 'end' });
  await tick();
  // An assistant-message end is not a turn end: a tool step can follow it.
  assert.equal(engine.live(effect.key).generationDone, false);
  engine.onSessionEvent('s1', { type: 'turn/end', reason: 'completed' });
  await new Promise((resolve) => setTimeout(resolve, 80));
  const final = engine.live(effect.key);
  assert.equal(final.generationDone, true);
  assert.equal(final.state, 'speaking');
  assert.equal(engine.completePlayback({ sessionId: 's1', turnId: effect.key, state: 'ended' }), true);
  assert.equal(engine.live(effect.key).state, 'done');
});

test('composer turns keep separate IDs and preserve both transcript entries', (t) => {
  const { engine, transcript } = harness(t);
  const reply = (turn, text) => {
    engine.onAssistantFrame('s1', { type: 'start', turn });
    engine.onAssistantFrame('s1', { type: 'chunk', chunk: { type: 'text-delta', text } });
    engine.onSessionEvent('s1', { type: 'turn/end', reason: 'completed' });
    return engine.latestTyped();
  };
  const first = reply(1, '第一轮回答。');
  const second = reply(2, '第二轮回答。');
  assert.notEqual(first.turnId, second.turnId);
  assert.equal(transcript.get(first.turnId).voice, '第一轮回答。');
  assert.equal(transcript.get(second.turnId).voice, '第二轮回答。');
});

test('cancelled composer turn stays interrupted instead of being announced as speaking', (t) => {
  const { engine } = harness(t);
  engine.onAssistantFrame('s1', { type: 'start', turn: 1 });
  engine.onAssistantFrame('s1', { type: 'chunk', chunk: { type: 'text-delta', text: '尚未说完' } });
  engine.onSessionEvent('s1', { type: 'turn/end', reason: { type: 'aborted' } });
  assert.equal(engine.latestTyped().state, 'interrupted');
});

test('a new voice question aborts the old generator and ignores late deltas', async (t) => {
  const tail = deferred();
  const requests = [];
  const { engine } = harness(t, { stream: async function* (request) {
    requests.push(request);
    yield { type: 'text-delta', text: '先说一句。' };
    await tail.promise;
    yield { type: 'text-delta', text: '不应追加的迟到内容。' };
  } });
  t.after(() => tail.resolve());
  const first = engine.ask({ sessionId: 's1', draft: '第一个问题' });
  await until(() => requests.length === 1 && engine.live(first.key).voice);
  engine.ask({ sessionId: 's1', draft: '第二个问题' });
  assert.equal(requests[0].signal.aborted, true);
  tail.resolve();
  await tick();
  assert.equal(engine.live(first.key).state, 'interrupted');
  assert.equal(engine.live(first.key).voice, '先说一句。');
});

test('stopped media rejects audio even when its synthesizer ignores abort', async (t) => {
  const sound = deferred();
  const { engine } = harness(t, { synthesize: () => sound.promise });
  const effect = engine.read({ sessionId: 's1', message: '需要朗读的内容。' });
  const rejection = assert.rejects(engine.media({}, { key: effect.key }), { name: 'AbortError' });
  engine.stop({ sessionId: 's1' });
  sound.resolve({ buffer: Buffer.from('late audio') });
  await rejection;
  assert.equal(engine.live(effect.key).state, 'interrupted');
});

test('a late playback-ended event cannot finish a newer turn', async (t) => {
  const sound = deferred();
  const { engine } = harness(t, { synthesize: () => sound.promise });
  const first = engine.read({ sessionId: 's1', message: '第一轮。' });
  const second = engine.read({ sessionId: 's1', message: '第二轮。' });
  engine.onCapability({ sessionId: 's1' }, { event: 'audio.ended', key: first.key });
  assert.equal(engine.live(second.key).state, 'thinking');
  assert.equal(engine.status, 'thinking');
  sound.resolve({ buffer: Buffer.from('audio') });
  await tick();
});

test('a web turn settles when the browser reports playback finished', async (t) => {
  const { engine } = harness(t);
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  await until(() => engine.live(effect.key).generationDone);
  // Generation is over but the browser is still speaking: the turn must wait.
  assert.equal(engine.live(effect.key).state, 'speaking');
  assert.equal(engine.completePlayback({ sessionId: 's1', turnId: effect.key, state: 'ended' }), true);
  assert.equal(engine.live(effect.key).state, 'done');
  // A second receipt for the same turn is harmless but no longer completes it.
  assert.equal(engine.completePlayback({ sessionId: 's1', turnId: effect.key, state: 'ended' }), false);
});

test('an ended receipt is refused while the answer is still being written', async (t) => {
  const tail = deferred();
  const { engine } = harness(t, {
    stream: async function* () {
      yield { type: 'text-delta', text: '还在写' };
      await tail.promise;
      yield { type: 'text-delta', text: '，写完了。' };
    },
  });
  t.after(() => tail.resolve());
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  await until(() => engine.live(effect.key).voice === '还在写');
  assert.equal(engine.completePlayback({ sessionId: 's1', turnId: effect.key, state: 'ended' }), false);
  assert.equal(engine.live(effect.key).state, 'thinking');
  tail.resolve();
  await until(() => engine.live(effect.key).generationDone);
  assert.equal(engine.completePlayback({ sessionId: 's1', turnId: effect.key, state: 'ended' }), true);
  assert.equal(engine.live(effect.key).state, 'done');
});

test('web two-track: A speaks while B streams below it', async (t) => {
  const { engine } = harness(t, {
    stream: async function* (options = {}) {
      if (String(options.system ?? '').includes('文字脑')) {
        yield { type: 'text-delta', text: '书面答案。' };
        return;
      }
      yield { type: 'text-delta', text: '语音答案。' };
    },
  });
  const effect = engine.ask({ sessionId: 's1', draft: '帮我分析一下这个方案' });
  await until(() => (engine.live(effect.key)?.voice ?? '').includes('语音答案'));
  await until(() => (engine.live(effect.key)?.text ?? '').includes('书面答案'));
  const live = engine.live(effect.key);
  assert.equal(live.heap, 'b');
  assert.equal(live.mode, 'dual');
});

test('web voice-only: a simple question never writes B', async (t) => {
  const { engine } = harness(t, {
    stream: async function* (options = {}) {
      if (String(options.system ?? '').includes('文字脑')) {
        yield { type: 'text-delta', text: '书面答案。' };
        return;
      }
      yield { type: 'text-delta', text: '语音答案。' };
    },
  });
  const effect = engine.ask({ sessionId: 's1', draft: '你好啊' });
  await until(() => (engine.live(effect.key)?.voice ?? '').includes('语音答案'));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(engine.live(effect.key).text, '');
  assert.equal(engine.live(effect.key).heap, 'a');
});

test('a barge-in freezes what was heard, not the whole line', async (t) => {
  const { engine, transcript } = harness(t);
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  await until(() => (engine.live(effect.key)?.voice ?? '').includes('语音回答'));
  engine.interrupt('s1', '第一句。');
  assert.equal(transcript.get(effect.key).heard, '第一句。');
});

test('seen records how much of the written answer reached the screen', (t) => {
  const { engine, transcript } = harness(t);
  const effect = engine.ask({ sessionId: 's1', draft: '你好' });
  assert.equal(engine.setSeen(effect.key, '第一段'), true);
  assert.equal(transcript.get(effect.key).seen, '第一段');
});
