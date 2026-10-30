/**
 * dsh-orb companion detection. dsh-orb (npm `dsh-orb`, MIT, github.com/
 * mini-yifan/dsh-orb-cordis) is the floating-ball plugin for the same host:
 * an Electron helper ball with Computer Use tools and a local wake-word /
 * listen / speak stack. WhaleGo does not ship any of its native parts; when
 * the user installs dsh-orb, the same host session gains its GUI tools and
 * permission presets, and WhaleGo reports the companion in diagnostics.
 *
 * Everything here is read-only: WhaleGo never writes dsh-orb's files.
 * Layout (reversed from dsh-orb 0.2.0 `dist/host`):
 *   <profile>/orb-voice.json · ball-enabled.json · orb-permission.json · …
 *   ~/.dsh/dsh-orb/electron-runtime · voice/kws · voice/tts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dshHome } from './prefs.js';

/** Profile-level marker files (installed dsh-orb). */
export const ORB_PROFILE_FILES = Object.freeze(['orb-voice.json', 'ball-enabled.json']);

const VOICE_DEFAULTS = Object.freeze({
  voiceEnabled: false,
  wakeEnabled: true,
  wakeWords: ['你好大肥鱼'],
  wakeThreshold: 0.25,
  wakeCooldownMs: 1500,
  wakeReply: '我在呢',
  interjectKeyword: '大肥鱼',
  dismissPhrases: ['你退下吧', '退下吧', '退一下吧'],
  ttsBackend: 'local',
});

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const phraseList = (value, fallback) => {
  if (!Array.isArray(value)) return fallback;
  const parts = value.map((item) => String(item ?? '').trim()).filter(Boolean);
  return parts.length ? parts.map((part) => part.slice(0, 40)) : fallback;
};
/** Same clamping convention as dsh-orb's `text()`: only non-strings fall back. */
const phrase = (value, fallback, max) => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
};

/** The official profile directory dsh-orb stores its files in. */
export function findOrbProfileDir(home = dshHome()) {
  const root = join(home, 'profiles');
  let dirs = [];
  try {
    dirs = readdirSync(root, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
  } catch {
    dirs = [];
  }
  for (const dir of dirs) {
    if (ORB_PROFILE_FILES.some((name) => existsSync(join(root, dir, name)))) return join(root, dir);
  }
  return '';
}

/** Look for the home-level runtime/model dirs dsh-orb creates on first use. */
export function orbHomeSignals(home = dshHome()) {
  const base = join(home, 'dsh-orb');
  if (!existsSync(base)) return { runtime: false, voice: false };
  return {
    runtime: existsSync(join(base, 'electron-runtime')),
    voice: existsSync(join(base, 'voice')),
  };
}

/** The voice settings file, pulled into dsh-orb's own ranges. Read-only. */
export function readOrbVoice(profileDir) {
  const file = join(profileDir, 'orb-voice.json');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const backend = parsed.ttsBackend === 'qwen' ? 'qwen' : 'local';
  return {
    voiceEnabled: parsed.voiceEnabled === true,
    wakeEnabled: parsed.wakeEnabled !== false,
    wakeWords: phraseList(parsed.wakeWords, VOICE_DEFAULTS.wakeWords),
    wakeThreshold: clampNumber(parsed.wakeThreshold, 0.05, 0.9, VOICE_DEFAULTS.wakeThreshold),
    wakeCooldownMs: clampNumber(parsed.wakeCooldownMs, 500, 5000, VOICE_DEFAULTS.wakeCooldownMs),
    wakeReply: phrase(parsed.wakeReply, VOICE_DEFAULTS.wakeReply, 80),
    interjectKeyword: phrase(parsed.interjectKeyword, VOICE_DEFAULTS.interjectKeyword, 40),
    dismissPhrases: phraseList(parsed.dismissPhrases, VOICE_DEFAULTS.dismissPhrases),
    ttsBackend: backend,
  };
}

/**
 * One probe, no assumptions: every signal is present/absent on disk.
 * `profileDirHint` lets the host pin the exact profile it runs in
 * (`ctx.get('profileContext')?.dir`); without a hint the whole profiles
 * folder is scanned one level for marker files (a flat, cheap walk).
 */
export function orbStatus({ home = dshHome(), profileDirHint = '' } = {}) {
  const profileDir = profileDirHint || findOrbProfileDir(home);
  const markers = profileDir ? ORB_PROFILE_FILES.filter((name) => existsSync(join(profileDir, name))) : [];
  const homeSignals = orbHomeSignals(home);
  const installed =
    markers.length > 0 ||
    homeSignals.runtime ||
    homeSignals.voice;
  const voice = profileDir ? readOrbVoice(profileDir) : undefined;
  let ballEnabled;
  if (markers.includes('ball-enabled.json')) {
    try {
      ballEnabled = JSON.parse(readFileSync(join(profileDir, 'ball-enabled.json'), 'utf8')) !== false;
    } catch {
      ballEnabled = true;
    }
  }
  return { installed, profileDir, markers, homeSignals, ballEnabled, voice, source: installed ? 'dsh-orb' : '' };
}

/** One diagnostic row for the seam panel. */
export function orbDiagnosticRow(status) {
  if (!status?.installed) {
    return ['dsh-orb', '未装（可选伴侣：悬浮球 + 电脑操作）'];
  }
  const parts = [`已安装（${status.markers.join(' / ') || 'runtime'}）`];
  if (status.voice?.voiceEnabled) parts.push(`语音开（唤醒 ${status.voice.wakeWords.join(' / ')}）`);
  else if (status.voice) parts.push('语音关');
  return ['dsh-orb', parts.join(' · ')];
}
