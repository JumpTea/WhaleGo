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

test('apply mounts panels, handlers, strip and the health route', () => {
  const panels = new Map();
  const strips = new Map();
  const handlers = new Map();
  const media = new Map();
  let capability;
  const routes = [];
  let routeHandler;
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
        return () => {};
      },
    },
    logger: { info() {}, warn() {} },
  };

  apply(ctx);

  assert.deepEqual([...panels.keys()].sort(), ['whalego.about', 'whalego.diag', 'whalego.live', 'whalego.settings']);
  assert.deepEqual([...handlers.keys()].sort(), ['whalego.ask', 'whalego.explain', 'whalego.read', 'whalego.stop']);
  assert.ok(media.has('speech'));
  assert.equal(typeof capability, 'function');
  assert.ok(strips.has('whalego.status'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/health'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/voices'));
  assert.ok(routes.some((registered) => registered.path === '/whalego/voice-turn'));

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
});
