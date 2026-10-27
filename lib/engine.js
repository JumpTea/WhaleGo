/**
 * WhaleGo's two-brain state machine.
 *
 * One tap starts two independent answers for the same question:
 *   voice brain -> short spoken line -> media:speech
 *   text brain  -> the normal Session answer, rendered by DSH-Go
 * The voice line is mirrored into the transcript panel as it streams. The text
 * answer is observed from the host's assistant stream; WhaleGo never writes it
 * back into the Session.
 */
import { randomUUID } from 'node:crypto';
import { MODE_LABELS, VOICE_LABELS, statusMeta } from './views.js';
import { complexityOf, spokenOf } from './prompts.js';
import { NativeSeam } from './nativeSeam.js';
import { appendVoiceMessage, saveVoiceAudio } from './sessionVoice.js';
import { TextBrain } from './textBrain.js';
import { VOICE_FALLBACK, runVoiceBrain } from './voiceBrain.js';
import { SpeechService } from './tts/index.js';
import { VERSION } from './version.js';
import { WhaleError, errorShape, isAbortError, messageText, truncate } from './util.js';

export class WhaleEngine {
  #ctx;
  #prefs;
  #transcript;
  #seam;
  #text;
  #tts;
  #logger;
  #status = 'idle';
  #jobs = new Map();
  #activeBySession = new Map();
  #listeners = new Set();
  #disposed = false;

  constructor({ ctx, prefs, transcript, seam, tts, logger = console }) {
    this.#ctx = ctx;
    this.#prefs = prefs;
    this.#transcript = transcript;
    this.#seam = seam ?? new NativeSeam(ctx);
    this.#text = new TextBrain({ ctx, logger });
    this.#tts = tts ?? new SpeechService({ prefs, logger });
    this.#logger = logger;
  }

  get prefs() {
    return this.#prefs;
  }

  get status() {
    return this.#status;
  }

  setPrefs(next) {
    Object.assign(this.#prefs, next);
    this.#notify();
  }

  refresh() {
    this.#notify();
  }

  subscribe(sessionId, callback) {
    const listener = { sessionId: String(sessionId ?? ''), callback };
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // ------------------------------------------------------------------ actions

  ask(scope) {
    const question = String(scope?.draft ?? '').trim();
    if (!question) return { toast: '先写一句话。' };
    const sessionId = String(scope?.sessionId ?? '');
    if (!sessionId) return { insert: question, toast: '发送后点消息上的「朗读」。' };
    const mode = this.#selectMode(question);
    const job = this.#newJob({ sessionId, question, mode });
    this.#transcript.start({ turnId: job.turnId, sessionId, question });
    job.stream = this.#openAudioStream(job);
    this.#setStatus('thinking');
    job.audio = this.#runTurn(job);
    job.audio.catch((error) => {
      if (!isAbortError(error)) this.#logger.warn?.(`[whalego] turn failed: ${errorShape(error).message}`);
    });
    this.#notify();
    return { type: 'audio', op: 'play', instance: 'whalego', src: effectSrc(job), key: job.turnId };
  }

  stop(scope) {
    const sessionId = String(scope?.sessionId ?? '');
    const active = this.#activeBySession.get(sessionId);
    if (active) {
      active.controller.abort(Object.assign(new Error('stopped'), { name: 'AbortError' }));
      abortStream(active.stream, 'stopped');
      void this.#text.cancel(sessionId);
      this.#transcript.setState(active.turnId, 'interrupted');
      this.#activeBySession.delete(sessionId);
      this.#setStatus('interrupted');
    }
    return { type: 'audio', op: 'stop', instance: 'whalego' };
  }

  read(scope) {
    const text = messageText(scope?.message).trim();
    if (!text) return { toast: '这条消息没有可朗读的文字。' };
    const sessionId = String(scope?.sessionId ?? '');
    const job = this.#newJob({ sessionId, question: '朗读这条回复', mode: 'read', manual: true });
    this.#transcript.start({ turnId: job.turnId, sessionId, question: '朗读这条回复' });
    job.stream = this.#openAudioStream(job);
    const spoken = spokenOf(text, 180);
    this.#transcript.setVoice(job.turnId, spoken);
    this.#transcript.setText(job.turnId, text);
    this.#transcript.flush();
    job.audio = this.#speak(job, spoken);
    job.audio.catch((error) => {
      if (!isAbortError(error)) this.#logger.warn?.(`[whalego] read failed: ${errorShape(error).message}`);
    });
    this.#setStatus('thinking');
    return { type: 'audio', op: 'play', instance: 'whalego', src: effectSrc(job), key: job.turnId };
  }

  explain(scope) {
    const text = messageText(scope?.message).trim();
    if (!text) return { toast: '这条消息没有可解释的文字。' };
    const sessionId = String(scope?.sessionId ?? '');
    const job = this.#newJob({ sessionId, question: '解释这条回复', mode: 'dual', manual: true });
    this.#transcript.start({ turnId: job.turnId, sessionId, question: '解释这条回复' });
    job.question = `用一两句人话解释这条回复：${text}`;
    job.stream = this.#openAudioStream(job);
    this.#transcript.setText(job.turnId, text);
    this.#setStatus('thinking');
    job.audio = this.#runVoice(job);
    job.audio.catch((error) => {
      if (!isAbortError(error)) this.#logger.warn?.(`[whalego] explain failed: ${errorShape(error).message}`);
    });
    return { type: 'audio', op: 'play', instance: 'whalego', src: effectSrc(job), key: job.turnId };
  }

  // ------------------------------------------------------------------- media

  async media(_scope, { key, signal } = {}) {
    const job = this.#jobs.get(key);
    if (!job) throw new WhaleError('expired', '这段语音已过期，请再点一次。');
    if (signal?.aborted) throw abortError();
    const result = await raceWithSignal(job.audio, signal);
    const buffer = result?.buffer ?? result;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new WhaleError('tts-empty', '这次没有声音，请再点一次。');
    this.#setStatus('speaking');
    if (job.timer) clearTimeout(job.timer);
    const seconds = Math.max(2, buffer.length / 6000);
    job.timer = setTimeout(() => {
      if (this.#status === 'speaking') {
        this.#setStatus('done');
        this.#transcript.setState(job.turnId, 'done');
        this.#transcript.flush();
      }
    }, seconds * 1000 + 1200);
    job.timer.unref?.();
    return { body: buffer, contentType: result?.contentType ?? 'audio/mpeg' };
  }

  // --------------------------------------------------------------- host events

  onAssistantFrame(sessionId, frame) {
    this.#text.onAssistantFrame(sessionId, frame);
    const active = this.#activeBySession.get(String(sessionId ?? ''));
    if (!active) return;
    const state = this.#text.snapshot(sessionId);
    if (frame?.type === 'chunk' && frame.chunk?.type === 'text-delta') {
      this.#transcript.setText(active.turnId, state.text);
      this.#notify();
    }
    if (frame?.type === 'end') {
      this.#transcript.setText(active.turnId, state.text);
      this.#transcript.flush();
      this.#notify();
    }
  }

  onSessionEvent(sessionId, event) {
    this.#text.onSessionEvent(sessionId, event);
    if (event?.type !== 'turn/end') return;
    const reason = event.reason?.type ?? event.reason ?? '';
    if (reason === 'aborted' || reason === 'interrupted') this.interrupt(sessionId);
  }

  onCapability(scope, payload) {
    const event = typeof payload?.event === 'string' ? payload.event : payload?.event?.type ?? payload?.type ?? '';
    const key = payload?.key ?? payload?.event?.key ?? payload?.data?.key ?? payload?.id ?? payload?.data?.id;
    if (event === 'audio.ended') {
      this.#finishJob(key ?? this.#activeBySession.get(String(scope?.sessionId ?? ''))?.turnId);
      return;
    }
    if (event === 'audio.error') {
      const job = this.#jobs.get(key);
      if (job) this.#transcript.setState(job.turnId, 'error');
      this.#setStatus('error');
      return;
    }
    if (event === 'voice.speechStart' || event === 'voice.stopped') {
      this.interrupt(String(scope?.sessionId ?? ''));
    }
  }

  interrupt(sessionId) {
    const active = this.#activeBySession.get(String(sessionId ?? ''));
    if (!active) return false;
    active.controller.abort(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
    abortStream(active.stream, 'interrupted');
    void this.#text.cancel(sessionId);
    this.#transcript.setState(active.turnId, 'interrupted');
    this.#activeBySession.delete(String(sessionId));
    this.#setStatus('interrupted');
    return true;
  }

  // ------------------------------------------------------------------ internal

  #selectMode(question) {
    if (this.#prefs.mode === 'dual') return 'dual';
    if (this.#prefs.mode === 'read') return 'read';
    return complexityOf(question) === 'complex' ? 'dual' : 'read';
  }

  #newJob({ sessionId, question, mode }) {
    const turnId = randomUUID();
    const controller = new AbortController();
    const job = { turnId, sessionId, question, mode, controller, audio: null, stream: null, timer: null, createdAt: Date.now() };
    this.#jobs.set(turnId, job);
    this.#activeBySession.set(String(sessionId), job);
    const cleanup = setTimeout(() => {
      this.#jobs.delete(turnId);
    }, 180_000);
    cleanup.unref?.();
    job.cleanup = cleanup;
    return job;
  }

  async #runTurn(job) {
    try {
      if (job.mode === 'read') return await this.#runRead(job);
      return await this.#runDual(job);
    } catch (error) {
      if (!isAbortError(error)) {
        this.#transcript.setState(job.turnId, 'error');
        this.#setStatus('error');
        this.#notify();
      }
      throw error;
    }
  }

  async #runDual(job) {
    const voice = this.#runVoice(job);
    void this.#text
      .prompt({ sessionId: job.sessionId, text: job.question, signal: job.controller.signal })
      .catch((error) => {
        if (isAbortError(error)) return;
        this.#logger.warn?.(`[whalego] text brain failed: ${errorShape(error).message}`);
        this.#transcript.setState(job.turnId, 'error');
        this.#notify();
      });
    return voice;
  }

  async #runRead(job) {
    let answer = '';
    try {
      await this.#text.prompt({ sessionId: job.sessionId, text: job.question, signal: job.controller.signal });
      answer = await this.#text.waitForEnd(job.sessionId, 22_000);
    } catch (error) {
      if (isAbortError(error) || job.controller.signal.aborted) throw abortError();
      this.#logger.warn?.(`[whalego] read prompt failed: ${errorShape(error).message}`);
    }
    if (job.controller.signal.aborted) throw abortError();
    const spoken = answer ? spokenOf(answer, 180) : '答案还在生成，先看文字。';
    this.#transcript.setVoice(job.turnId, spoken);
    this.#transcript.setText(job.turnId, answer);
    this.#transcript.flush();
    this.#notify();
    return this.#speak(job, spoken);
  }

  async #runVoice(job) {
    const { turnId, sessionId, question, controller } = job;
    const history = this.#transcript.list(sessionId, 6).flatMap((record) => [record.question, record.voice]).filter(Boolean);
    const result = await runVoiceBrain({
      ctx: this.#ctx,
      question,
      history,
      filler: this.#prefs.filler,
      maxChars: 180,
      signal: controller.signal,
      onDelta: (delta) => {
        this.#transcript.appendVoice(turnId, delta);
        void this.#seam.appendVoiceLine({ turnId, sessionId, text: delta, final: false });
        this.#notify();
      },
      logger: this.#logger,
    });
    if (controller.signal.aborted) throw abortError();
    const spoken = result.text || VOICE_FALLBACK;
    this.#transcript.setVoice(turnId, spoken);
    void this.#seam.appendVoiceLine({ turnId, sessionId, text: spoken, final: true });
    const options = { voice: this.#prefs.voice, rate: this.#prefs.rate };
    if (this.#canAttachAudio()) {
      // Attach before the message is appended: surfaceOps have no in-place
      // update, so the replayable audio has to exist when the line lands.
      const audio = await this.#tts.synthesize(spoken, { ...options, signal: controller.signal });
      if (controller.signal.aborted) throw abortError();
      const ref = await saveVoiceAudio(this.#ctx, audio?.buffer);
      appendVoiceMessage(this.#ctx, { sessionId, text: spoken, audio: ref, logger: this.#logger });
      this.#transcript.flush();
      this.#notify();
      return this.#deliver(job, audio);
    }
    appendVoiceMessage(this.#ctx, { sessionId, text: spoken, logger: this.#logger });
    this.#transcript.flush();
    this.#notify();
    return this.#speak(job, spoken, options);
  }

  #canAttachAudio() {
    return typeof this.#ctx?.attachments?.saveFile === 'function';
  }

  /** Play an already-synthesised buffer through the native stream, if any. */
  async #deliver(job, result) {
    const stream = job.stream;
    if (!stream) return result;
    try {
      const buffer = result?.buffer ?? Buffer.alloc(0);
      for (let offset = 0; offset < buffer.length; offset += 16 * 1024) {
        await stream.write(buffer.subarray(offset, offset + 16 * 1024));
      }
      await stream.end();
      return result;
    } catch (error) {
      try {
        await stream.abort?.(errorShape(error).message);
      } catch {
        /* the host may already have dropped the stream */
      }
      throw error;
    }
  }

  #openAudioStream(job) {
    if (!this.#seam.caps.audioStream) return null;
    return this.#seam.openAudioStream({
      id: job.turnId,
      contentType: 'audio/mpeg',
      sampleRate: 24000,
      channels: 1,
    });
  }

  /**
   * Speak one line. When the native side exposes `audioStream`, chunks go out
   * while Edge is still synthesising; otherwise the whole buffer is returned
   * for the v1.2 `media` effect, as before.
   */
  async #speak(job, spoken, options = {}) {
    const signal = job.controller.signal;
    const stream = job.stream;
    if (!stream) return this.#tts.synthesize(spoken, { ...options, signal });

    let chain = Promise.resolve();
    let failure = null;
    const onChunk = (chunk) => {
      if (!chunk?.length) return;
      chain = chain.then(() => stream.write(chunk)).catch((error) => {
        failure = failure ?? error;
      });
    };
    const run = typeof this.#tts.synthesizeStream === 'function'
      ? this.#tts.synthesizeStream(spoken, { ...options, signal, onChunk, onStart: () => this.#setStatus('speaking') })
      : this.#tts.synthesize(spoken, { ...options, signal }).then((result) => {
          onChunk(result?.buffer);
          return result;
        });
    try {
      const result = await run;
      await chain;
      if (failure) throw failure;
      await stream.end();
      return result;
    } catch (error) {
      try {
        await stream.abort?.(errorShape(error).message);
      } catch {
        /* the host may already have dropped the stream */
      }
      throw error;
    }
  }

  #finishJob(turnId) {
    const job = this.#jobs.get(turnId);
    if (job) {
      if (job.timer) clearTimeout(job.timer);
      this.#transcript.setState(job.turnId, 'done');
      this.#transcript.flush();
      this.#activeBySession.delete(job.sessionId);
    }
    this.#setStatus('done');
  }

  #setStatus(status) {
    if (this.#status === status) return;
    this.#status = status;
    void this.#seam.setOrb({
      visible: status !== 'idle',
      status,
      style: this.#prefs.orbStyle,
      size: this.#prefs.orbSize,
      idle: this.#prefs.orbIdle,
    });
    this.#notify();
  }

  #notify() {
    for (const listener of this.#listeners) {
      try {
        listener.callback(this.snapshot(listener.sessionId));
      } catch (error) {
        this.#logger.warn?.(`[whalego] listener failed: ${String(error)}`);
      }
    }
  }

  snapshot(sessionId = '') {
    const meta = statusMeta(this.#status);
    const records = this.#transcript.list(sessionId, this.#prefs.historyTurns);
    const lines = [];
    for (const record of records) {
      const at = formatTime(record.at);
      lines.push({ title: `你 · ${at}`, subtitle: truncate(record.question, 100) });
      lines.push({ title: `鲸语 · ${at}`, subtitle: truncate(record.voice || '（在想）', 100) });
      if (record.text) lines.push({ title: `文字脑 · ${at}`, subtitle: truncate(record.text, 100) });
    }
    if (lines.length === 0) lines.push({ title: '还没有记录', subtitle: '点输入框旁的「鲸语」开始。' });
    return {
      status: this.#status,
      statusText: meta.text,
      statusTone: meta.tone,
      modeLabel: MODE_LABELS[this.#prefs.mode] ?? this.#prefs.mode,
      voiceLabel: VOICE_LABELS[this.#prefs.voice] ?? this.#prefs.voice,
      nativeLabel: this.#seam.count > 0 ? `已接入 ${this.#seam.count}/5` : '未接入（P0）',
      lines,
    };
  }

  diagnostics(caps = {}) {
    const seam = this.#seam.diagnostics();
    const labels = {
      voiceLine: '会话内语音行',
      orb: '原生悬浮球',
      settings: '原生设置页',
      audioStream: '流式音频',
      voiceSession: '免手语音',
    };
    const rows = Object.entries(labels).map(([key, label]) => [label, seam.native[key] ? '已接入' : '未接入']);
    return {
      rows,
      summary: seam.count === 0 ? '五个原生接缝都还没开；当前走声明式面板与 media 音频。' : `已接入 ${seam.count}/5，其余走回退。`,
      tone: seam.count === 0 ? 'warn' : 'info',
      protocol: caps.protocol ?? 'unknown',
      app: caps.app ?? 'DSH-Go',
      tts: 'Edge（免费）',
      version: VERSION,
      native: seam.native,
    };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const job of this.#jobs.values()) {
      job.controller.abort(Object.assign(new Error('disposed'), { name: 'AbortError' }));
      abortStream(job.stream, 'disposed');
      if (job.timer) clearTimeout(job.timer);
      if (job.cleanup) clearTimeout(job.cleanup);
    }
    this.#jobs.clear();
    this.#activeBySession.clear();
    this.#listeners.clear();
    this.#text.dispose();
    this.#tts.dispose?.();
    this.#transcript.dispose();
  }
}

function effectSrc(job) {
  return job.stream ? 'stream:speech' : 'media:speech';
}

function abortStream(stream, reason) {
  try {
    void stream?.abort?.(reason);
  } catch {
    /* the stream may already be closed by the host */
  }
}

function raceWithSignal(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

function abortError() {
  return Object.assign(new Error('aborted'), { name: 'AbortError' });
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
