/** The text brain: the normal Session answer, observed as it streams. */
import { randomUUID } from 'node:crypto';
import { WhaleError } from './util.js';

export class TextBrain {
  #ctx;
  #logger;
  #state = new Map();

  constructor({ ctx, logger = console } = {}) {
    this.#ctx = ctx;
    this.#logger = logger;
  }

  #ensure(sessionId) {
    const key = String(sessionId ?? '');
    let state = this.#state.get(key);
    if (!state) {
      state = { text: '', turn: 0, active: false, waiting: false, waiters: [] };
      this.#state.set(key, state);
    }
    return state;
  }

  prepare(sessionId) {
    const state = this.#ensure(sessionId);
    state.text = '';
    state.turn = 0;
    state.active = true;
    state.waiting = true;
    return state;
  }

  onAssistantFrame(sessionId, frame) {
    if (!frame || !sessionId) return;
    const state = this.#ensure(sessionId);
    if (frame.type === 'start') {
      state.text = '';
      state.turn = Number(frame.turn ?? 0);
      state.active = true;
      state.waiting = true;
      return;
    }
    if (frame.type === 'chunk') {
      if (frame.chunk?.type === 'text-delta' && typeof frame.chunk.text === 'string') state.text += frame.chunk.text;
      return;
    }
    if (frame.type === 'end') this.finish(sessionId);
  }

  onSessionEvent(sessionId, event) {
    if (event?.type !== 'turn/end') return;
    this.finish(sessionId);
  }

  async prompt({ sessionId, text, signal }) {
    const content = String(text ?? '').trim();
    if (!content) throw new WhaleError('empty-prompt', '没有要发送的问题');
    const service = this.#ctx?.get?.('sessionController') ?? this.#ctx?.sessionController;
    if (!service || typeof service.prompt !== 'function') {
      throw new WhaleError('session-unavailable', '当前没有可用的会话');
    }
    const requestId = randomUUID();
    this.prepare(sessionId);
    try {
      await service.prompt(
        {
          requestId,
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: content }],
        },
        signal ?? new AbortController().signal,
      );
      return { requestId, sessionId };
    } catch (error) {
      this.finish(sessionId);
      throw new WhaleError('prompt-failed', error instanceof Error ? error.message : String(error));
    }
  }

  waitForEnd(sessionId, timeoutMs = 22_000) {
    const state = this.#ensure(sessionId);
    if (!state.active && state.text) return Promise.resolve(state.text);
    if (!state.active && !state.waiting) return Promise.resolve('');
    return new Promise((resolve) => {
      const done = (text) => {
        clearTimeout(timer);
        const index = state.waiters.indexOf(done);
        if (index >= 0) state.waiters.splice(index, 1);
        resolve(text);
      };
      const timer = setTimeout(() => {
        const index = state.waiters.indexOf(done);
        if (index >= 0) state.waiters.splice(index, 1);
        resolve(state.text);
      }, timeoutMs);
      timer.unref?.();
      state.waiters.push(done);
    });
  }

  finish(sessionId) {
    const state = this.#ensure(sessionId);
    state.active = false;
    state.waiting = false;
    const waiters = state.waiters.splice(0);
    for (const resolve of waiters) resolve(state.text);
  }

  async cancel(sessionId) {
    const service = this.#ctx?.get?.('sessionController') ?? this.#ctx?.sessionController;
    try {
      service?.cancel?.({ sessionId });
      return true;
    } catch (error) {
      this.#logger.warn?.(`[whalego] cancel failed: ${String(error)}`);
      return false;
    } finally {
      this.finish(sessionId);
    }
  }

  snapshot(sessionId) {
    const state = this.#ensure(sessionId);
    return { text: state.text, turn: state.turn, active: state.active };
  }

  dispose() {
    for (const state of this.#state.values()) {
      state.active = false;
      state.waiting = false;
      const waiters = state.waiters.splice(0);
      for (const resolve of waiters) resolve(state.text);
    }
    this.#state.clear();
  }
}
