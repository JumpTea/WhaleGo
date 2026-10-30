/**
 * The dsh-orb companion work: installed-state probing (read-only), and the
 * spoken commands whose semantics were adopted from dsh-orb's voice design
 * (wake / break / dismiss). Both halves are pure and host-free.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DEFAULT_PREFS, normalizePrefs, patchPrefs } from '../lib/prefs.js';
import { findOrbProfileDir, orbDiagnosticRow, orbStatus, readOrbVoice } from '../lib/orbBridge.js';

const clientSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Evaluate the browser module against a minimal module loader stub. */
function loadClient() {
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
  const require = (name) => {
    if (name === 'react') return React;
    if (name === 'react-dom/client') return { createRoot: () => ({ render: () => {} }) };
    throw new Error(`unexpected require: ${name}`);
  };
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', clientSource)(window, undefined);
  factory(require);
  return { window };
}

const prefsWith = (over = {}) => normalizePrefs({ ...DEFAULT_PREFS, ...over });
const on = () => prefsWith({ voiceCommands: 'on' });

test('the spoken-command matcher and gate are reachable at module scope', () => {
  const { window } = loadClient();
  assert.equal(typeof window.__whalegoVoiceCommands?.match, 'function');
  assert.equal(typeof window.__whalegoVoiceCommands?.gate, 'function');
});

test('the voiceCommands switch gates everything, default off', () => {
  const { window } = loadClient();
  const { gate } = window.__whalegoVoiceCommands;
  assert.equal(DEFAULT_PREFS.voiceCommands, 'off');
  // The gate is the all-or-nothing bypass: off, default or missing prefs keep
  // the recogniser callback byte-for-byte identical to before this feature.
  assert.equal(gate(prefsWith({ voiceCommands: 'off' })), true);
  assert.equal(gate(prefsWith({ voiceCommands: 'on' })), false);
  assert.equal(gate(null), true);
  assert.equal(gate({}), true);
});

test('wake prefix wins first, even over the break keyword inside it', () => {
  const { window } = loadClient();
  const { match } = window.__whalegoVoiceCommands;
  const prefs = on(); // wakePhrase 你好小鲸, breakPhrase 小鲸, stopPhrase 退下吧
  assert.deepEqual(match('你好小鲸今天天气怎么样', prefs), { kind: 'wake', tail: '今天天气怎么样' });
  assert.deepEqual(match('你好小鲸', prefs), { kind: 'wake', tail: '' });
  // Regression: the default break phrase 小鲸 is a substring of the wake
  // phrase; a wake utterance must never read as a break.
  assert.equal(match('你好小鲸', prefs).kind, 'wake');
});

test('wake is prefix-only; a mid-question mention stays a question', () => {
  const { window } = loadClient();
  const { match } = window.__whalegoVoiceCommands;
  // A break word that does not collide with 小鲸 isolates the wake semantics.
  const prefs = prefsWith({ voiceCommands: 'on', breakPhrase: '停一下' });
  assert.deepEqual(match('其实我想问下问题', prefs), null);
  assert.deepEqual(match('给我讲一下小红帽', prefs), null);
  // But the shipped default break word is 小鲸, and the keyword-anywhere
  // interject semantic (dsh-orb's) does swallow a 小鲸 mention mid-frame:
  // that is the adopted tradeoff, written down here on purpose.
  assert.deepEqual(match('给我讲讲小鲸的习性', on()), { kind: 'break' });
});

test('break and stop are keywords anywhere in the frame, stop beats nothing but wake', () => {
  const { window } = loadClient();
  const { match } = window.__whalegoVoiceCommands;
  const prefs = on();
  assert.deepEqual(match('小鲸，我想接着问', prefs), { kind: 'break' });
  assert.deepEqual(match('哎，小鲸，停一停', prefs), { kind: 'break' });
  assert.deepEqual(match('退下吧', prefs), { kind: 'stop' });
  assert.deepEqual(match('好了你退下吧', prefs), { kind: 'stop' });
  // Same breath with a stop phrase but no wake prefix: stop wins over the rest.
  assert.deepEqual(match('退下吧保持安静', prefs), { kind: 'stop' });
});

test('empty phrases never match', () => {
  const { window } = loadClient();
  const { match } = window.__whalegoVoiceCommands;
  const prefs = { ...on(), breakPhrase: '', stopPhrase: '' };
  assert.deepEqual(match('小鲸小鲸', prefs), null);
  assert.deepEqual(match('退下吧', prefs), null);
});

test('orb probing stays quiet on a host without dsh-orb', () => {
  const home = mkdtempSync(join(tmpdir(), 'whalego-orb-empty-'));
  const status = orbStatus({ home });
  assert.equal(status.installed, false);
  assert.equal(status.profileDir, '');
  assert.deepEqual(status.markers, []);
  assert.deepEqual(status.homeSignals, { runtime: false, voice: false });
  assert.deepEqual(orbDiagnosticRow(status), ['dsh-orb', '未装（可选伴侣：悬浮球 + 电脑操作）']);
});

test('an installed companion is read from its profile files, read-only', () => {
  const home = mkdtempSync(join(tmpdir(), 'whalego-orb-prof-'));
  const profile = join(home, 'profiles', 'desktop');
  mkdirSync(profile, { recursive: true });
  writeFileSync(
    join(profile, 'orb-voice.json'),
    JSON.stringify({
      voiceEnabled: true,
      wakeWords: ['自己叫'],
      wakeThreshold: 3,
      wakeCooldownMs: 9,
      interjectKeyword: 123,
      dismissPhrases: ['好好好'],
      ttsBackend: 'qwen',
    }),
    'utf8',
  );
  writeFileSync(join(profile, 'ball-enabled.json'), 'true', 'utf8');

  assert.equal(findOrbProfileDir(home), profile);
  const status = orbStatus({ home });
  assert.equal(status.installed, true);
  assert.deepEqual(status.markers.sort(), ['ball-enabled.json', 'orb-voice.json']);
  assert.equal(status.ballEnabled, true);
  assert.deepEqual(status.homeSignals, { runtime: false, voice: false });

  const voice = readOrbVoice(profile);
  assert.equal(voice.voiceEnabled, true);
  assert.deepEqual(voice.wakeWords, ['自己叫']);
  // dsh-orb's own ranges pull out-of-range values back in.
  assert.equal(voice.wakeThreshold, 0.9);
  assert.equal(voice.wakeCooldownMs, 500);
  // Same clamping convention as dsh-orb's text(): a non-string falls back to
  // the upstream default keyword; an empty string stays empty.
  assert.equal(voice.interjectKeyword, '大肥鱼');
  assert.deepEqual(voice.dismissPhrases, ['好好好']);
  assert.equal(voice.ttsBackend, 'qwen');

  const row = orbDiagnosticRow(status);
  assert.equal(row[0], 'dsh-orb');
  assert.match(row[1], /已安装/);
  assert.match(row[1], /语音开/);
});

test('a corrupt companion file degrades to defaults, not a crash', () => {
  const home = mkdtempSync(join(tmpdir(), 'whalego-orb-bad-'));
  const profile = join(home, 'profiles', 'desktop');
  mkdirSync(profile, { recursive: true });
  writeFileSync(join(profile, 'orb-voice.json'), '{not json', 'utf8');
  const status = orbStatus({ home });
  assert.equal(status.installed, true, 'the marker file still proves installation');
  assert.deepEqual(status.voice, undefined);
  const row = orbDiagnosticRow(status);
  assert.match(row[1], /已安装/);
});

test('phrase prefs survive normalize and patch with caps, never empty', () => {
  const long = '这句唤醒词绕舌头'.padEnd(60, '呀');
  const normalized = normalizePrefs({ wakePhrase: '  ', breakPhrase: long.slice(0, 50), wakeReply: '回'.repeat(90) });
  // An empty phrase keeps the default instead of becoming empty.
  assert.equal(normalized.wakePhrase, DEFAULT_PREFS.wakePhrase);
  assert.equal(normalized.breakPhrase.length, 40);
  assert.equal(normalized.breakPhrase, long.slice(0, 40));
  assert.equal(normalized.wakeReply.length, 80);
  // A short reply passes through untouched.
  assert.equal(normalizePrefs({ wakeReply: '好的。' }).wakeReply, '好的。');

  const patched = patchPrefs(DEFAULT_PREFS, 'stopPhrase', '  先停一停吧  ');
  assert.equal(patched.stopPhrase, '先停一停吧');
  // Blank patches are ignored: a command you cannot hear has no use.
  assert.equal(patchPrefs(DEFAULT_PREFS, 'breakPhrase', '  ').breakPhrase, DEFAULT_PREFS.breakPhrase);
});
