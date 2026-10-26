/** Small on-disk LRU for synthesized speech, so repeated lines cost nothing. */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function speechKey({ voice, rate, text }) {
  return createHash('sha256').update(`${voice}|${rate}|${text}`).digest('hex').slice(0, 40);
}

export class SpeechCache {
  #dir;
  #maxFiles;
  #maxBytes;
  #logger;

  constructor({ dir, maxFiles = 64, maxBytes = 48 * 1024 * 1024, logger = console } = {}) {
    this.#dir = dir || '';
    this.#maxFiles = maxFiles;
    this.#maxBytes = maxBytes;
    this.#logger = logger;
  }

  get enabled() {
    return Boolean(this.#dir);
  }

  get(key) {
    if (!this.enabled) return null;
    try {
      const file = join(this.#dir, `${key}.mp3`);
      const buffer = readFileSync(file);
      const now = new Date();
      utimesSync(file, now, now);
      return buffer;
    } catch {
      return null;
    }
  }

  put(key, buffer) {
    if (!this.enabled || !buffer?.length) return;
    try {
      mkdirSync(this.#dir, { recursive: true });
      writeFileSync(join(this.#dir, `${key}.mp3`), buffer);
      this.prune();
    } catch (error) {
      this.#logger.warn?.(`[whalego] speech cache write failed: ${String(error)}`);
    }
  }

  prune() {
    if (!this.enabled) return;
    let files;
    try {
      files = readdirSync(this.#dir)
        .filter((name) => name.endsWith('.mp3'))
        .map((name) => {
          const path = join(this.#dir, name);
          const stat = statSync(path);
          return { path, size: stat.size, at: stat.mtimeMs };
        })
        .sort((a, b) => a.at - b.at);
    } catch {
      return;
    }
    let bytes = files.reduce((sum, file) => sum + file.size, 0);
    while (files.length > this.#maxFiles || bytes > this.#maxBytes) {
      const oldest = files.shift();
      if (!oldest) break;
      try {
        unlinkSync(oldest.path);
        bytes -= oldest.size;
      } catch {
        /* another process may have removed it */
      }
    }
  }
}
