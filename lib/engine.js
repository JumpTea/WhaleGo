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
import { appendFileSync } from 'node:fs';
import { MODE_LABELS, VOICE_LABELS, statusMeta } from './views.js';
import { complexityOf, spokenOf, splitSpeakable, stripForSpeech } from './prompts.js';
import { NativeSeam } from './nativeSeam.js';
import { appendVoiceMessage, saveVoiceAudio } from './sessionVoice.js';
import { updateVoice } from './voices.js';
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
  #webMode = false;
  #typed = new Map();
  #typedFeed = null;
  #speech = new Map();

  constructor({ ctx, prefs, transcript, seam, tts, logger = console, webMode = false }) {
    this.#ctx = ctx;
    this.#prefs = prefs;
    this.#transcript = transcript;
    this.#seam = seam ?? new NativeSeam(ctx);
    this.#webMode = Boolean(webMode);
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
    const job = this.#newJob({ sessionId, question, mode, session: scope?.session });
    this.#transcript.start({ turnId: job.turnId, sessionId, question });
    job.stream = this.#canAttachAudio() ? null : this.#openAudioStream(job);
    this.#setStatus('thinking');
    job.audio = this.#runTurn(job);
    job.audio.catch((error) => {
      if (!isAbortError(error)) this.#logger.warn?.(`[whalego] turn failed: ${errorShape(error).message}`);
    });
    this.#notify();
    return { type: 'audio', op: 'play', instance: 'whalego', src: effectSrc(job), key: job.turnId };
  }

  stop(scope) {
    this.interrupt(String(scope?.sessionId ?? ''));
    return { type: 'audio', op: 'stop', instance: 'whalego' };
  }

  read(scope) {
    const text = messageText(scope?.message).trim();
    if (!text) return { toast: '这条消息没有可朗读的文字。' };
    const sessionId = String(scope?.sessionId ?? '');
    const job = this.#newJob({ sessionId, question: '朗读这条回复', mode: 'read', manual: true });
    this.#transcript.start({ turnId: job.turnId, sessionId, question: '朗读这条回复' });
    job.stream = this.#canAttachAudio() ? null : this.#openAudioStream(job);
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
    job.stream = this.#canAttachAudio() ? null : this.#openAudioStream(job);
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
    const combined = AbortSignal.any([job.controller.signal, signal].filter(Boolean));
    const result = await raceWithSignal(job.audio, combined);
    if (combined.aborted) throw abortError();
    const buffer = result?.buffer ?? result;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new WhaleError('tts-empty', '这次没有声音，请再点一次。');
    this.#setStatus('speaking');
    if (job.timer) clearTimeout(job.timer);
    const seconds = Math.max(2, buffer.length / 6000);
    job.timer = setTimeout(() => {
      if (this.#activeBySession.get(job.sessionId) === job && !job.controller.signal.aborted) this.#finishJob(job.turnId);
    }, seconds * 1000 + 1200);
    job.timer.unref?.();
    return { body: buffer, contentType: result?.contentType ?? 'audio/mpeg' };
  }

  // --------------------------------------------------------------- host events

  onAssistantFrame(sessionId, frame) {
    this.#text.onAssistantFrame(sessionId, frame);
    const active = this.#activeBySession.get(String(sessionId ?? ''));
    if (!active && this.#webMode) {
      if (frame?.type === 'start') this.#typed.delete('typed-live-' + sessionId);
      const typed = this.#text.snapshot(sessionId)?.text;
      if (typed) this.#publishTyped(sessionId, typed, 'thinking');
    }
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
    const interrupted = reason === 'aborted' || reason === 'interrupted';
    const active = this.#activeBySession.get(String(sessionId ?? ''));
    if (interrupted && active) {
      this.#cancelJob(active, 'interrupted');
      return;
    }
    // A message typed into the native composer is handled by the agent itself;
    // mirror its answer into the voice transcript so the page can read it out.
    if (this.#webMode && !this.#activeBySession.get(String(sessionId ?? ''))) {
      const answer = String(this.#text.snapshot(sessionId)?.text ?? '').trim();
      if (answer) {
        this.#publishTyped(sessionId, answer, interrupted ? 'interrupted' : 'speaking');
        this.#typed.delete(`typed-live-${sessionId}`);
        this.#setStatus(interrupted ? 'interrupted' : 'speaking');
      }
    }
  }

  /** Prior turns of this session, excluding the turn that is starting now. */
  #historyFor(sessionId, turnId) {
    return this.#transcript
      .list(sessionId, 6)
      .filter((record) => record.turnId !== turnId)
      .flatMap((record) => [record.question, record.voice])
      .filter(Boolean);
  }

  /** Publish/refresh the transcript entry of a composer-typed turn. */
  #publishTyped(sessionId, text, state = 'thinking') {
    const key = `typed-live-${sessionId}`;
    let turnId = this.#typed.get(key) ?? null;
    if (!turnId) {
      turnId = key + '-' + randomUUID();
      this.#typed.set(key, turnId);
      this.#transcript.start({ turnId, sessionId, question: '', at: Date.now() });
    }
    this.#transcript.setVoice(turnId, text);
    this.#transcript.setText(turnId, text);
    this.#transcript.setState(turnId, state);
    this.#transcript.flush();
    this.#captureSpeech(turnId, stripForSpeech(text), state === 'speaking');
    this.#typedFeed = {
      turnId,
      sessionId: String(sessionId ?? ''),
      state,
      question: '',
      voice: text,
      text,
      ...this.#speechState(turnId),
      at: Date.now(),
    };
    this.#notify();
  }

  /** Newest composer-typed line, regardless of session (mirror feed). */
  latestTyped(sessionId) {
    if (sessionId && this.#typedFeed?.sessionId !== String(sessionId)) return null;
    return this.#typedFeed;
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
    this.#cancelJob(active, 'interrupted');
    return true;
  }

  #cancelJob(active, reason) {
    if (active.controller.signal.aborted) return Promise.resolve();
    active.controller.abort(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
    abortStream(active.stream, reason);
    if (active.timer) clearTimeout(active.timer);
    this.#transcript.setState(active.turnId, 'interrupted');
    this.#transcript.flush();
    if (this.#activeBySession.get(active.sessionId) === active) this.#activeBySession.delete(active.sessionId);
    this.#setStatus('interrupted');
    this.#notify();
    return active.ownsText ? this.#text.cancel(active.sessionId) : Promise.resolve();
  }

  completePlayback({ sessionId, turnId, state } = {}) {
    const job = this.#jobs.get(turnId);
    if (!job || job.sessionId !== String(sessionId ?? '') || this.#activeBySession.get(job.sessionId) !== job || job.controller.signal.aborted) return false;
    if (state === 'ended') {
      if (!this.#speech.get(turnId)?.generationDone) return false;
      this.#finishJob(turnId);
    } else if (state === 'stopped' || state === 'error') {
      this.#cancelJob(job, state);
      if (state === 'error') {
        this.#transcript.setState(turnId, 'error');
        this.#transcript.flush();
        this.#setStatus('error');
      }
    } else return false;
    return true;
  }

  #captureSpeech(turnId, text, final = false) {
    let speech = this.#speech.get(turnId);
    if (!speech) {
      speech = { cursor: 0, speech: [], generationDone: false };
      this.#speech.set(turnId, speech);
      if (this.#speech.size > 100) this.#speech.delete(this.#speech.keys().next().value);
    }
    if (speech.generationDone) return;
    const result = splitSpeakable(text, speech.cursor, { final });
    for (const segment of result.segments) speech.speech.push({ id: turnId + ':' + speech.speech.length, text: segment });
    speech.cursor = result.cursor;
    speech.generationDone = final;
  }

  #speechState(turnId) {
    const speech = this.#speech.get(turnId);
    return { speech: (speech?.speech ?? []).map((part) => ({ ...part })), generationDone: speech?.generationDone ?? false };
  }

  // ------------------------------------------------------------------ internal

  #selectMode(question) {
    if (this.#prefs.mode === 'dual') return 'dual';
    if (this.#prefs.mode === 'read') return 'read';
    return complexityOf(question) === 'complex' ? 'dual' : 'read';
  }

  #newJob({ sessionId, question, mode, session = null }) {
    if (this.#disposed) throw new WhaleError('disposed', '语音插件已关闭，请重载插件。');
    const previous = this.#activeBySession.get(String(sessionId));
    const previousCancellation = previous ? this.#cancelJob(previous, 'superseded') : Promise.resolve();
    const turnId = randomUUID();
    const controller = new AbortController();
    const job = { turnId, sessionId, question, mode, session, controller, audio: null, stream: null, timer: null, ownsText: false, previousCancellation, createdAt: Date.now() };
    this.#jobs.set(turnId, job);
    this.#activeBySession.set(String(sessionId), job);
    const cleanup = setTimeout(() => {
      if (this.#activeBySession.get(sessionId) === job) this.#cancelJob(job, 'expired');
      this.#jobs.delete(turnId);
      this.#speech.delete(turnId);
    }, 180_000);
    cleanup.unref?.();
    job.cleanup = cleanup;
    return job;
  }

  async #runTurn(job) {
    try {
      await job.previousCancellation;
      if (job.controller.signal.aborted) throw abortError();
      // Plain web profile: no native host, and the session agent would stall on
      // tool approvals. The voice brain answers, the browser streams its audio.
      if (this.#webMode) return await this.#runWebVoice(job);
      if (job.mode === 'read') return await this.#runRead(job);
      return await this.#runDual(job);
    } catch (error) {
      try {
        appendFileSync(
          '/root/.dsh/whalego/turn-error.log',
          `${new Date().toISOString()} mode=${job.mode} ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
        );
      } catch {
        /* lab trace only */
      }
      if (!isAbortError(error)) {
        this.#transcript.setState(job.turnId, 'error');
        this.#setStatus('error');
        this.#notify();
      }
      throw error;
    }
  }

  async #runDual(job) {
    job.ownsText = true;
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
    job.ownsText = true;
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
    // Voice-only turns still land in the conversation; the audio attachment is
    // best-effort so a TTS outage never hides the spoken line.
    const voiceId = appendVoiceMessage(this.#ctx, {
      sessionId: job.sessionId,
      session: job.session,
      text: spoken,
      logger: this.#logger,
    });
    try {
      const result = await this.#speak(job, spoken);
      if (voiceId) {
        const audio = await saveVoiceAudio(this.#ctx, result?.buffer);
        if (audio) updateVoice(voiceId, { audio });
      }
      return result;
    } catch (error) {
      if (isAbortError(error)) throw error;
      // The line is already registered; a TTS outage should not blank the turn.
      this.#logger.warn?.(`[whalego] speech failed: ${errorShape(error).message}`);
      return { buffer: Buffer.alloc(0), spoken };
    }
  }

  async #runWebVoice(job) {
    const { turnId, sessionId, question, controller } = job;
    const history = this.#historyFor(sessionId, job.turnId);
    const result = await runVoiceBrain({
      ctx: this.#ctx,
      question,
      history,
      filler: this.#prefs.filler,
      maxChars: 220,
      signal: controller.signal,
      onDelta: (delta) => {
        if (controller.signal.aborted || this.#disposed) return;
        this.#transcript.appendVoice(turnId, delta);
        this.#captureSpeech(turnId, spokenOf(this.#transcript.get(turnId)?.voice, 220));
        this.#notify();
      },
      logger: this.#logger,
    });
    if (controller.signal.aborted) throw abortError();
    const spoken = result.text || VOICE_FALLBACK;
    this.#transcript.setVoice(turnId, spoken);
    this.#transcript.setState(turnId, 'speaking');
    this.#captureSpeech(turnId, spoken, true);
    this.#transcript.flush();
    this.#setStatus('speaking');
    this.#notify();
    return { buffer: Buffer.alloc(0), spoken };
  }

  async #runVoice(job) {
    const { turnId, sessionId, question, controller } = job;
    const history = this.#historyFor(sessionId, job.turnId);
    const result = await runVoiceBrain({
      ctx: this.#ctx,
      question,
      history,
      filler: this.#prefs.filler,
      maxChars: 180,
      signal: controller.signal,
      onDelta: (delta) => {
        if (controller.signal.aborted || this.#disposed) return;
        this.#transcript.appendVoice(turnId, delta);
        void this.#seam.appendVoiceLine({ lineId: turnId, turnId, sessionId, role: 'assistant', text: this.#transcript.get(turnId)?.voice ?? '', final: false }).catch(() => {});
        this.#notify();
      },
      logger: this.#logger,
    });
    if (controller.signal.aborted) throw abortError();
    const spoken = result.text || VOICE_FALLBACK;
    this.#transcript.setVoice(turnId, spoken);
    void this.#seam.appendVoiceLine({ lineId: turnId, turnId, sessionId, role: 'assistant', text: spoken, final: true }).catch(() => {});
    const options = { voice: this.#prefs.voice, rate: this.#prefs.rate };
    const trace = (step) => {
      for (const file of ['/root/.dsh/whalego/voice-trace.log', '/data/local/tmp/whalego-voice-trace.log']) {
        try {
          appendFileSync(file, `${new Date().toISOString()} ${step}\n`);
          return;
        } catch {
          /* try the next writable path */
        }
      }
    };
    trace(`attach=${this.#canAttachAudio()} stream=${Boolean(job.stream)}`);
    if (this.#canAttachAudio()) {
      // Attach before the message is appended: surfaceOps have no in-place
      // update, so the replayable audio has to exist when the line lands.
      trace('synth:start');
      const audio = await this.#tts.synthesize(spoken, { ...options, signal: controller.signal });
      trace(`synth:done ${audio?.buffer?.length ?? 0}`);
      if (controller.signal.aborted) throw abortError();
      const ref = await saveVoiceAudio(this.#ctx, audio?.buffer);
      trace(`saved ${ref?.attachmentId ?? 'null'}`);
      const appended = appendVoiceMessage(this.#ctx, { sessionId, session: job.session, text: spoken, audio: ref, logger: this.#logger });
      trace(`appended ${appended}`);
      this.#transcript.setState(job.turnId, 'speaking');
      this.#transcript.flush();
      this.#notify();
      trace('deliver:start');
      const delivered = await this.#deliver(job, audio);
      trace('deliver:done');
      return delivered;
    }
    const voiceId = appendVoiceMessage(this.#ctx, {
      sessionId,
      session: job.session,
      text: spoken,
      logger: this.#logger,
    });
    this.#transcript.flush();
    this.#notify();
    const speech = await this.#speak(job, spoken, options);
    if (voiceId) {
      const audio = await saveVoiceAudio(this.#ctx, speech?.buffer);
      if (audio) updateVoice(voiceId, { audio });
    }
    return speech;
  }

  #canAttachAudio() {
    try {
      const store = typeof this.#ctx?.get === 'function' ? this.#ctx.get('attachments') : undefined;
      return typeof store?.saveFile === 'function';
    } catch {
      return false;
    }
  }

  /** Play an already-synthesised buffer through the native stream, if any. */
  async #deliver(job, result) {
    const stream = job.stream;
    if (!stream) return result;
    this.#setStatus('speaking');
    this.#transcript.setState(job.turnId, 'speaking');
    this.#transcript.flush();
    this.#notify();
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
    if (!stream) {
      const result = await this.#tts.synthesize(spoken, { ...options, signal });
      if (signal.aborted || this.#disposed) throw abortError();
      this.#setStatus('speaking');
      this.#transcript.setState(job.turnId, 'speaking');
      this.#transcript.flush();
      this.#notify();
      return result;
    }

    let chain = Promise.resolve();
    let failure = null;
    const onChunk = (chunk) => {
      if (!chunk?.length || signal.aborted) return;
      chain = chain.then(() => { if (signal.aborted) throw abortError(); return stream.write(chunk); }).catch((error) => {
        failure = failure ?? error;
      });
    };
    const run = typeof this.#tts.synthesizeStream === 'function'
      ? this.#tts.synthesizeStream(spoken, { ...options, signal, onChunk, onStart: () => {
          if (signal.aborted || this.#disposed) return;
          this.#setStatus('speaking');
          this.#transcript.setState(job.turnId, 'speaking');
          this.#transcript.flush();
          this.#notify();
        } })
      : this.#tts.synthesize(spoken, { ...options, signal }).then((result) => {
          onChunk(result?.buffer);
          return result;
        });
    try {
      const result = await run;
      await chain;
      if (signal.aborted || this.#disposed) throw abortError();
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
    if (!job || job.controller.signal.aborted || this.#activeBySession.get(job.sessionId) !== job) return;
    if (job) {
      if (job.timer) clearTimeout(job.timer);
      this.#transcript.setState(job.turnId, 'done');
      this.#transcript.flush();
      this.#activeBySession.delete(job.sessionId);
    }
    this.#setStatus('done');
    this.#notify();
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

  /** Current streaming state of one turn, for the web SSE channel. */
  live(turnId) {
    const record = this.#transcript.get(turnId);
    if (!record) return null;
    return {
      turnId: record.turnId,
      sessionId: record.sessionId,
      state: record.state,
      question: record.question,
      voice: record.voice,
      text: record.text,
      ...this.#speechState(turnId),
    };
  }

  /** Newest transcript entry of a session (used by the composer-typed path). */
  latest(sessionId) {
    const [record] = this.#transcript.list(String(sessionId ?? ''), 1);
    if (!record) return null;
    return {
      turnId: record.turnId,
      sessionId: record.sessionId,
      state: record.state,
      question: record.question,
      voice: record.voice,
      text: record.text,
      at: record.at,
    };
  }

  /** Stream one spoken line to a caller that plays chunks as they arrive. */
  speakStream(text, options = {}) {
    return this.#tts.synthesizeStream(text, options);
  }

  diagnostics(caps = {}) {    const seam = this.#seam.diagnostics();
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
    this.#speech.clear();
    this.#typed.clear();
    this.#typedFeed = null;
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
