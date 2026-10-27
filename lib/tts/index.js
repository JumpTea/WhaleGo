/** Edge TTS plus a small cache. One short spoken line per request. */
import { join } from 'node:path';
import { dshHome } from '../prefs.js';
import { rateToProsody, spokenOf } from '../prompts.js';
import { WhaleError, isAbortError } from '../util.js';
import { EdgeConnection } from './edge.js';
import { SpeechCache, speechKey } from './cache.js';

export class SpeechService {
  #home;
  #prefs;
  #logger;
  #cache;
  #connection;

  constructor({ home, prefs, logger = console } = {}) {
    this.#home = dshHome(home);
    this.#prefs = prefs;
    this.#logger = logger;
    this.#cache = new SpeechCache({ dir: join(this.#home, 'whalego', 'speech-cache'), logger });
    this.#connection = null;
  }

  get cache() {
    return this.#cache;
  }

  async synthesize(text, options = {}) {
    return this.#speak(text, options);
  }

  /**
   * Synthesise and hand each audio chunk to `onChunk` as it arrives, so a
   * caller can stream it to the native side before the whole line exists.
   * The returned object is the same shape as `synthesize` (buffer included).
   */
  async synthesizeStream(text, { onChunk, onStart, ...options } = {}) {
    return this.#speak(text, { ...options, onAudio: onChunk, onStart });
  }

  async #speak(text, { voice, rate, signal, onAudio, onStart } = {}) {
    const spoken = spokenOf(text, 180);
    if (!spoken) throw new WhaleError('empty-speech', '没有可朗读的文字');
    const selectedVoice = voice || this.#prefs.voice;
    const selectedRate = rate || this.#prefs.rate;
    const key = speechKey({ voice: selectedVoice, rate: selectedRate, text: spoken });

    if (this.#prefs.cacheAudio) {
      const cached = this.#cache.get(key);
      if (cached) {
        onStart?.();
        onAudio?.(cached);
        return { buffer: cached, spoken, contentType: 'audio/mpeg', cached: true, bytes: cached.length };
      }
    }

    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('tts-timeout')), 18_000);
      const combined = combineSignals(signal, controller.signal);
      try {
        const connection = this.#connection?.isOpen ? this.#connection : (this.#connection = new EdgeConnection({ connectTimeoutMs: 8_000, turnTimeoutMs: 20_000 }));
        const result = await connection.speak({
          text: spoken,
          voice: selectedVoice,
          rate: rateToProsody(selectedRate),
          signal: combined,
          onStart,
          onAudio,
        });
        const buffer = result.audio;
        if (!buffer?.length) throw new WhaleError('tts-empty', '语音合成没有返回声音');
        if (this.#prefs.cacheAudio) this.#cache.put(key, buffer);
        return { buffer, spoken, contentType: 'audio/mpeg', cached: false, bytes: buffer.length };
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) throw error;
        lastError = error;
        this.#logger.warn?.(`[whalego] tts failed (attempt ${attempt + 1}): ${String(error?.message ?? error)}`);
        this.#connection?.close?.();
        this.#connection = null;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 700));
      } finally {
        clearTimeout(timer);
      }
    }
    throw new WhaleError('tts-failed', `语音合成失败：${String(lastError?.message ?? lastError ?? 'unknown')}`);
  }

  dispose() {
    this.#connection?.close?.();
    this.#connection = null;
  }
}

function combineSignals(...signals) {
  const active = signals.filter(Boolean);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(active);
  return active[0];
}


