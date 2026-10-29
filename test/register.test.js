import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'whalego-home-'));

const { apply } = await import('../lib/index.js');
const { NativeSeam } = await import('../lib/nativeSeam.js');
const { SpeechCache } = await import('../lib/tts/cache.js');
const { normalizePrefs, patchPrefs, DEFAULT_PREFS } = await import('../lib/prefs.js');

test('normalizePrefs rejects unknown values and patchPrefs clamps turns', () => {
  assert.equal(normalizePrefs({ mode: 'nope' }).mode, 'auto');
  assert.equal(normalizePrefs({ historyTurns: 99 }).historyTurns, 6);
  assert.equal(patchPrefs(DEFAULT_PREFS, 'historyTurns', 9).historyTurns, 6);
  assert.equal(patchPrefs(DEFAULT_PREFS, 'historyTurns', 10).historyTurns, 10);
});

test('native seam stays honest when the host has no seam methods', async () => {
  const seam = new NativeSeam({});
  assert.equal(seam.count, 0);
  assert.equal(await seam.appendVoiceLine({ text: 'x' }), false);
  assert.equal(await seam.setOrb({ style: 'pixel-whale' }), false);
  assert.equal(await seam.registerSettings({}), false);
  assert.equal(seam.openAudioStream({}), null);
  assert.equal(seam.openVoiceSession({}), null);
  assert.equal(Object.keys(seam.diagnostics().native).length, 5);
});

test('speech cache round-trips and prunes files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'whalego-cache-'));
  const cache = new SpeechCache({ dir, maxFiles: 2 });
  cache.put('a', Buffer.from('aaa'));
  cache.put('b', Buffer.from('bbb'));
  assert.equal(cache.get('a').toString(), 'aaa');
  cache.put('c', Buffer.from('ccc'));
  assert.ok(cache.get('c').length > 0);
});

test('apply mounts panels, handlers, strip and the health route', async () => {
  const panels = new Map();
  const strips = new Map();
  const handlers = new Map();
  const media = new Map();
  let capability;
  const routes = [];
  let routeHandler;
  let playbackHandler;
  let prefsHandler;
  const dshGo = {
    panel(id, definition) {
      panels.set(id, definition);
    },
    strip(id, fn) {
      strips.set(id, fn);
    },
    on(id, fn) {
      handlers.set(id, fn);
    },
    media(id, fn) {
      media.set(id, fn);
    },
    onCapability(fn) {
      capability = fn;
    },
  };
  const ctx = {
    dshGo,
    get(name) {
      if (name === 'dshGo') return dshGo;
      return undefined;
    },
    inject(_services, callback) {
      callback(ctx);
    },
    effect(factory) {
      return factory();
    },
    on() {
      return () => {};
    },
    webServer: {
      register(definition) {
        routes.push(definition);
        if (definition.path === '/whalego/health') routeHandler = definition.handler;
        if (definition.path === '/whalego/playback') playbackHandler = definition.handler;
        if (definition.path === '/whalego/prefs') prefsHandler = definition.handler;
        return () => {};
      },
    },
    logger: { info() {}, warn() {} },
  };

  apply(ctx);

  assert.deepEqual([...panels.keys()].sort(), ['whalego.about', 'whalego.diag', 'whalego.live', 'whalego.settings']);
  assert.deepEqual([...handlers.keys()].sort(), ['whalego.ask', 'whalego.explain', 'whalego.read', 'whalego.status', 'whalego.stop']);
  assert.ok(media.has('speech'));
  assert.equal(typeof capability, 'function');
  assert.ok(strips.has('whalego.status'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/health'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/voices'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/voice-turn'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/cancel'));

  const settings = panels.get('whalego.settings').actions;
  const result = settings.mode({}, { value: 'dual' });
  assert.equal(result.toast, '已保存。');
  assert.equal(JSON.parse(readFileSync(join(process.env.DSH_HOME, 'whalego', 'prefs.json'), 'utf8')).mode, 'dual');

  let emitted;
  strips.get('whalego.status')({ sessionId: 's1' }, (value) => { emitted = value; }, { locale: 'zh' });
  assert.match(emitted.text, /^鲸语 · /);

  let body = '';
  routeHandler({}, { setHeader() {}, end(value) { body = value; } });
  assert.equal(JSON.parse(body).ok, true);

  // The playback receipt is the web twin of the App's `audio.done`: it settles
  // a web turn, and stays honest about turns that are no longer running.
  assert.ok(routes.some((registered) => registered.path === '/whalego/playback'));
  assert.equal(typeof playbackHandler, 'function');
  const call = (req) =>
    new Promise((resolve) => {
      const res = {
        statusCode: 0,
        setHeader() {},
        end(value) {
          resolve({ status: res.statusCode, body: value ? JSON.parse(value) : null });
        },
      };
      playbackHandler(req, res);
    });
  const post = (payload) => ({
    method: 'POST',
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(payload));
    },
  });

  const wrongMethod = await call({ method: 'GET' });
  assert.equal(wrongMethod.status, 405);
  const missing = await call(post({ sessionId: 's1' }));
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /turnId/);
  const unknown = await call(post({ sessionId: 's1', turnId: 'gone', state: 'ended' }));
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.completed, false);

  // Saving settings is what every tap in the settings sheet hits. It once used
  // the enum tables without importing them, so every save answered 500 — from
  // the outside that looks exactly like "nothing happened".
  assert.equal(typeof prefsHandler, 'function');
  const save = (payload, method = 'POST') =>
    new Promise((resolve) => {
      const res = {
        statusCode: 0,
        setHeader() {},
        end(value) {
          resolve({ status: res.statusCode, body: value ? JSON.parse(value) : null });
        },
      };
      prefsHandler(
        {
          method,
          async *[Symbol.asyncIterator]() {
            yield Buffer.from(JSON.stringify(payload));
          },
        },
        res,
      );
    });
  const saved = await save({ mode: 'read', thinkOrb: 'center' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.prefs.mode, 'read');
  assert.equal(saved.body.prefs.thinkOrb, 'center');
  assert.equal(JSON.parse(readFileSync(join(process.env.DSH_HOME, 'whalego', 'prefs.json'), 'utf8')).mode, 'read');
  assert.equal((await save({ mode: 'sideways' })).status, 400);
  assert.equal((await save({})).status, 400);
  assert.equal((await save({ mode: 'dual' }, 'GET')).status, 405);
});
