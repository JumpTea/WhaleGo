/** In-memory plus on-disk record of the two brains. Text only; never audio. */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class TranscriptStore {
  #file;
  #limit;
  #records = [];
  #timer = null;
  #logger;

  constructor({ file, limit = 50, logger = console } = {}) {
    this.#file = file || '';
    this.#limit = limit;
    this.#logger = logger;
    this.#load();
  }

  #load() {
    if (!this.#file) return;
    try {
      const parsed = JSON.parse(readFileSync(this.#file, 'utf8'));
      if (!Array.isArray(parsed)) return;
      this.#records = parsed.filter(isRecord).slice(-this.#limit);
    } catch (error) {
      if (error?.code !== 'ENOENT') this.#logger.warn?.(`[whalego] transcript unreadable: ${String(error)}`);
    }
  }

  start({ turnId, sessionId, question, at = Date.now() }) {
    if (!turnId) throw new Error('transcript.start needs turnId');
    if (this.#records.some((record) => record.turnId === turnId)) return this.get(turnId);
    const record = {
      turnId,
      sessionId: String(sessionId ?? ''),
      question: String(question ?? ''),
      voice: '',
      text: '',
      heard: '',
      seen: '',
      state: 'thinking',
      at,
      updatedAt: at,
    };
    this.#records.push(record);
    this.#trim();
    this.#schedule();
    return { ...record };
  }

  appendVoice(turnId, delta) {
    const record = this.#find(turnId);
    if (!record || !delta) return;
    record.voice += String(delta);
    record.updatedAt = Date.now();
    this.#schedule();
  }

  setVoice(turnId, voice) {
    const record = this.#find(turnId);
    if (!record) return;
    record.voice = String(voice ?? '');
    record.updatedAt = Date.now();
    this.#schedule();
  }

  setText(turnId, text) {
    const record = this.#find(turnId);
    if (!record) return;
    record.text = String(text ?? '');
    record.updatedAt = Date.now();
    this.#schedule();
  }

  /** How much of the spoken line the user actually heard (playback-driven). */
  setHeard(turnId, heard) {
    const record = this.#find(turnId);
    if (!record) return;
    record.heard = String(heard ?? '');
    record.updatedAt = Date.now();
    this.#schedule();
  }

  /** How much of the written answer the user actually saw on screen. */
  setSeen(turnId, seen) {
    const record = this.#find(turnId);
    if (!record) return;
    record.seen = String(seen ?? '');
    record.updatedAt = Date.now();
    this.#schedule();
  }

  setState(turnId, state) {
    const record = this.#find(turnId);
    if (!record) return;
    record.state = String(state);
    record.updatedAt = Date.now();
    this.#schedule();
  }

  get(turnId) {
    const record = this.#find(turnId);
    return record ? { ...record } : undefined;
  }

  list(sessionId, limit = 12) {
    const filtered = sessionId ? this.#records.filter((record) => record.sessionId === sessionId) : this.#records;
    return filtered.slice(-limit).map((record) => ({ ...record }));
  }

  clear() {
    this.#records = [];
    this.flush();
  }

  flush() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (!this.#file) return;
    try {
      mkdirSync(dirname(this.#file), { recursive: true });
      const tmp = `${this.#file}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(this.#records.slice(-this.#limit), null, 2)}\n`, 'utf8');
      renameSync(tmp, this.#file);
    } catch (error) {
      this.#logger.warn?.(`[whalego] transcript write failed: ${String(error)}`);
    }
  }

  dispose() {
    this.flush();
    this.#records = [];
  }

  #find(turnId) {
    return this.#records.find((record) => record.turnId === turnId);
  }

  #trim() {
    if (this.#records.length > this.#limit) this.#records = this.#records.slice(-this.#limit);
  }

  #schedule() {
    if (this.#timer || !this.#file) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flush();
    }, 350);
    this.#timer.unref?.();
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.turnId === 'string';
}
