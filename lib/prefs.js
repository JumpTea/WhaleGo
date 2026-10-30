/** Preference file for WhaleGo. Only enums and bounded numbers are stored. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { clamp } from './util.js';
import { BROWSER_ENTRY, FILLERS, HISTORY_TURNS, MODES, ORB_IDLES, ORB_SIZES, ORB_STYLES, RATES, THINK_ORBS, VOICES } from './prompts.js';

export const PREFS_VERSION = 1;

export const DEFAULT_PREFS = Object.freeze({
  version: PREFS_VERSION,
  mode: 'auto',
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: 'normal',
  filler: '我想想。',
  orbStyle: 'pixel-whale',
  orbSize: 'm',
  orbIdle: 'swim',
  thinkOrb: 'corner',
  browserEntry: 'on',
  // Native auto lane: a question the user sends in the App (typed or spoken
  // through the phone's own STT) is answered out loud with durable voice rows
  // next to the session agent's written answer.
  nativeAuto: 'on',
  // Last time the "full experience needs the browser entry" reminder fired.
  hintAt: 0,
  // Spoken commands on the voice page, semantics adopted from dsh-orb's wake/
  // interject/dismiss design (see docs/专题-逆向dsh-orb与融合.md §1.5). Off by
  // default: the page must keep listening after it would otherwise stop.
  voiceCommands: 'off',
  wakePhrase: '你好小鲸', // said while listening but idle: acts like a tap, not sent
  wakeReply: '我在呢。',
  breakPhrase: '小鲸', // said while the answer plays: interrupt and listen
  stopPhrase: '退下吧', // stop the answer, mute and collapse
  inlineTranscript: true,
  cacheAudio: true,
  historyTurns: 6,
  autoPlay: false,
  // Lab-only: let a typed "语音演示：…" message run the real voice turn on a
  // machine with no microphone (the Android emulator). Off by default.
  demoTrigger: false,
});

export function dshHome(home) {
  return home || process.env.DSH_HOME || join(homedir(), '.dsh');
}

export function prefsPath(home) {
  return join(dshHome(home), 'whalego', 'prefs.json');
}

export function normalizePrefs(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const pick = (key, allowed, fallback) => (allowed.includes(value[key]) ? value[key] : fallback);
  const bool = (key, fallback) => (typeof value[key] === 'boolean' ? value[key] : fallback);
  /** A spoken command phrase: trimmed text, capped in characters, never empty. */
  const phrase = (raw, fallback, max = 40) => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return fallback;
    return trimmed.slice(0, max);
  };
  return {
    version: PREFS_VERSION,
    mode: pick('mode', MODES, DEFAULT_PREFS.mode),
    voice: pick('voice', VOICES, DEFAULT_PREFS.voice),
    rate: pick('rate', RATES, DEFAULT_PREFS.rate),
    filler: pick('filler', FILLERS, DEFAULT_PREFS.filler),
    orbStyle: pick('orbStyle', ORB_STYLES, DEFAULT_PREFS.orbStyle),
    orbSize: pick('orbSize', ORB_SIZES, DEFAULT_PREFS.orbSize),
    orbIdle: pick('orbIdle', ORB_IDLES, DEFAULT_PREFS.orbIdle),
    thinkOrb: pick('thinkOrb', THINK_ORBS, DEFAULT_PREFS.thinkOrb),
    browserEntry: pick('browserEntry', BROWSER_ENTRY, DEFAULT_PREFS.browserEntry),
    nativeAuto: pick('nativeAuto', BROWSER_ENTRY, DEFAULT_PREFS.nativeAuto),
    hintAt: Number.isFinite(Number(value.hintAt)) ? Math.max(0, Number(value.hintAt)) : DEFAULT_PREFS.hintAt,
    voiceCommands: pick('voiceCommands', BROWSER_ENTRY, DEFAULT_PREFS.voiceCommands),
    wakePhrase: phrase(value.wakePhrase, DEFAULT_PREFS.wakePhrase),
    wakeReply: phrase(value.wakeReply, DEFAULT_PREFS.wakeReply, 80),
    breakPhrase: phrase(value.breakPhrase, DEFAULT_PREFS.breakPhrase),
    stopPhrase: phrase(value.stopPhrase, DEFAULT_PREFS.stopPhrase),
    inlineTranscript: bool('inlineTranscript', DEFAULT_PREFS.inlineTranscript),
    cacheAudio: bool('cacheAudio', DEFAULT_PREFS.cacheAudio),
    historyTurns: HISTORY_TURNS.includes(Number(value.historyTurns)) ? Number(value.historyTurns) : DEFAULT_PREFS.historyTurns,
    autoPlay: bool('autoPlay', DEFAULT_PREFS.autoPlay),
    demoTrigger: bool('demoTrigger', DEFAULT_PREFS.demoTrigger),
  };
}

export function loadPrefs({ home, logger = console } = {}) {
  const file = prefsPath(home);
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return normalizePrefs(parsed);
  } catch (error) {
    if (error?.code !== 'ENOENT') logger.warn?.(`[whalego] prefs unreadable, using defaults: ${String(error)}`);
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs, { home } = {}) {
  const normalized = normalizePrefs(prefs);
  const file = prefsPath(home);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
  return normalized;
}

export function patchPrefs(prefs, key, value) {
  const next = { ...normalizePrefs(prefs) };
  if (key === 'historyTurns') next.historyTurns = clamp(Number(value), 4, 10);
  else if (key === 'hintAt') next.hintAt = Math.max(0, Number(value) || 0);
  else if (key === 'wakePhrase' || key === 'wakeReply' || key === 'breakPhrase' || key === 'stopPhrase') {
    const trimmed = String(value ?? '').trim();
    if (trimmed) next[key] = trimmed.slice(0, key === 'wakeReply' ? 80 : 40);
  } else if (typeof next[key] === 'boolean') next[key] = Boolean(value);
  else if (typeof next[key] === 'string') next[key] = String(value);
  return normalizePrefs(next);
}

export function publicPrefs(prefs) {
  const value = normalizePrefs(prefs);
  return { ...value };
}
