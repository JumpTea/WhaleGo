import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Evaluate the browser module against a minimal module loader stub. */
function loadClient({ document } = {}) {
  let factory;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => [value, () => {}],
    useEffect: () => {},
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    Fragment: 'fragment',
  };
  const window = {
    __ModuleLoader__: {
      load: ({ factory: fn }) => {
        factory = fn;
      },
    },
  };
  const mounted = [];
  const require = (name) => {
    if (name === 'react') return React;
    if (name === 'react-dom/client') {
      return { createRoot: (host) => ({ render: (node) => mounted.push({ host, node }) }) };
    }
    throw new Error(`unexpected require: ${name}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', source)(window, document);
  return { mod: factory(require), mounted, window };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeDocument() {
  const appended = [];
  return {
    appended,
    documentElement: { dataset: {} },
    head: { appendChild: () => {} },
    body: { appendChild: (node) => appended.push(node) },
    getElementById: () => null,
    createElement: (tag) => ({ tag, id: '', textContent: '', remove() {} }),
  };
}

test('client half exports apply and asks for the slots service', () => {
  const { mod } = loadClient();
  assert.equal(typeof mod.apply, 'function');
  assert.deepEqual(mod.inject, ['slots']);
});

test('apply is inert without a DOM (server side import)', () => {
  const { mod, mounted } = loadClient();
  assert.doesNotThrow(() => mod.apply({}));
  assert.equal(mounted.length, 0);
});

test('apply mounts the floating voice panel into the page', () => {
  const document = fakeDocument();
  const { mod, mounted } = loadClient({ document });
  mod.apply({});
  assert.equal(document.documentElement.dataset.whalegoClient, '1');
  assert.equal(document.appended.length, 1);
  assert.equal(document.appended[0].id, 'whalego-voice-host');
  assert.equal(mounted.length, 1);
});

test('speaker queues segments in order and settles only after the last line', async () => {
  const { window } = loadClient();
  const lines = [];
  const gates = [];
  const phases = [];
  const reports = [];
  const speaker = window.__whalegoInternals.createSpeaker({
    play: (line) => {
      lines.push(line);
      return new Promise((resolve) => gates.push(resolve));
    },
    report: (state) => reports.push(state),
    phase: (state) => phases.push(state),
  });

  speaker.accept({ speech: [{ id: 't:0', text: '第一句。' }], generationDone: false });
  await tick();
  assert.deepEqual(lines, ['第一句。']);
  // A repeat of the same segment id must not be spoken twice.
  speaker.accept({
    speech: [
      { id: 't:0', text: '第一句。' },
      { id: 't:1', text: '第二句。' },
    ],
  });
  await tick();
  assert.deepEqual(lines, ['第一句。']);

  gates.shift()('ended');
  await tick();
  assert.deepEqual(lines, ['第一句。', '第二句。']);
  assert.deepEqual(reports, []);

  // Generation ends while the last line is still sounding: no receipt yet.
  speaker.finish();
  await tick();
  assert.deepEqual(reports, []);

  gates.shift()('ended');
  await tick();
  assert.deepEqual(reports, ['ended']);
  assert.equal(phases.at(-1), 'done');

  // Late frames after the receipt cannot restart the turn.
  speaker.accept({ speech: [{ id: 't:2', text: '第三句。' }], generationDone: true });
  await tick();
  assert.deepEqual(lines, ['第一句。', '第二句。']);
  assert.deepEqual(reports, ['ended']);
});

test('speaker reports nothing when the turn is stopped mid-sentence', async () => {
  const { window } = loadClient();
  const lines = [];
  const gates = [];
  const reports = [];
  const speaker = window.__whalegoInternals.createSpeaker({
    play: (line) => {
      lines.push(line);
      return new Promise((resolve) => gates.push(resolve));
    },
    report: (state) => reports.push(state),
    phase: () => {},
  });
  speaker.accept({ speech: [{ id: 't:0', text: '第一句。' }] });
  await tick();
  speaker.finish();
  speaker.stop();
  gates.shift()('ended');
  await tick();
  assert.deepEqual(reports, []);
  assert.deepEqual(lines, ['第一句。']);
});

test('player resolves only once the audio really ends', async () => {
  const { window } = loadClient();
  const made = [];
  class FakeAudio {
    constructor() {
      this.handlers = {};
      this.currentTime = 0;
      made.push(this);
    }
    addEventListener(name, fn) {
      (this.handlers[name] ??= []).push(fn);
    }
    play() {
      return Promise.resolve();
    }
    pause() {}
    emit(name) {
      for (const fn of this.handlers[name] ?? []) fn();
    }
  }
  const real = {
    Audio: globalThis.Audio,
    fetch: globalThis.fetch,
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };
  globalThis.Audio = FakeAudio;
  globalThis.fetch = async () => ({ ok: true, body: {}, blob: async () => new Uint8Array([1, 2, 3]) });
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};
  try {
    const player = window.__whalegoInternals.createPlayer();
    let state = null;
    const pending = player.play('你好。').then((value) => {
      state = value;
      return value;
    });
    await tick();
    assert.equal(state, null);
    assert.equal(made.length, 1);
    made[0].emit('ended');
    assert.equal(await pending, 'ended');

    const stopped = player.play('再说一句。');
    await tick();
    player.stop();
    assert.equal(await stopped, 'stopped');
  } finally {
    globalThis.Audio = real.Audio;
    globalThis.fetch = real.fetch;
    URL.createObjectURL = real.createObjectURL;
    URL.revokeObjectURL = real.revokeObjectURL;
  }
});
