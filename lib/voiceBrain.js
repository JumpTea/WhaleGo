/** The speech-first brain: one short spoken answer, streamed. */
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildVoiceMessages, spokenOf } from './prompts.js';
import { isAbortError } from './util.js';

/** Keep the last voice-brain failure where a lab run can read it. */
function traceVoiceError(error) {
  try {
    const home = process.env.DSH_HOME || join(homedir(), '.dsh');
    mkdirSync(join(home, 'whalego'), { recursive: true });
    appendFileSync(join(home, 'whalego', 'voice-error.log'), `${new Date().toISOString()} ${error?.stack ?? String(error)}\n`);
  } catch {
    /* lab trace only */
  }
}

export const VOICE_FALLBACK = '我先看一下，答案在下面。';

/**
 * Ask the current Session model for a short spoken answer.
 *
 * Returns `{ ok, text, source, model?, code? }`. A missing LLM is not fatal: the
 * caller still has the text brain, so the voice channel can say one honest line.
 */
export async function runVoiceBrain({
  ctx,
  question,
  history = [],
  filler = '我想想。',
  maxChars = 180,
  timeoutMs = 12_000,
  signal,
  onDelta,
  logger = console,
}) {
  let llm;
  try {
    llm = typeof ctx?.get === 'function' ? ctx.get('llm') : undefined;
  } catch {
    llm = undefined;
  }
  if (!llm || (typeof llm.stream !== 'function' && typeof llm.prepareCall !== 'function')) {
    return { ok: false, code: 'llm-unavailable', text: VOICE_FALLBACK, source: 'fallback' };
  }

  const target = await resolveTarget(ctx);
  if (!target) {
    return { ok: false, code: 'model-unavailable', text: VOICE_FALLBACK, source: 'fallback' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('voice-timeout')), timeoutMs);
  const combined = combineSignals(signal, controller.signal);
  const prompt = buildVoiceMessages({ question, history, filler });
  let text = '';

  try {
    // `ctx.llm` is a registry: it prepares a call and the prepared call streams.
    // Older hosts exposed `.stream()` directly, so keep that as a fallback.
    let stream;
    if (typeof llm.prepareCall === 'function') {
      const prepared = await llm.prepareCall(
        {
          provider: target.provider,
          model: target.model,
          ...(target.reasoningEffort ? { reasoningEffort: target.reasoningEffort } : {}),
        },
        combined,
      );
      stream = prepared.stream({
        provider: target.provider,
        model: target.model,
        ...(target.reasoningEffort ? { reasoningEffort: target.reasoningEffort } : {}),
        system: prompt.system,
        messages: prompt.messages,
        temperature: 0.6,
        maxTokens: 300,
        signal: combined,
      });
    } else if (typeof llm.stream === 'function') {
      stream = llm.stream({
        provider: target.provider,
        model: target.model,
        ...(target.reasoningEffort ? { reasoningEffort: target.reasoningEffort } : {}),
        system: prompt.system,
        messages: prompt.messages,
        temperature: 0.6,
        maxTokens: 300,
        signal: combined,
      });
    } else {
      return { ok: false, code: 'llm-unavailable', text: VOICE_FALLBACK, source: 'fallback' };
    }
    for await (const chunk of stream) {
      if (chunk?.type === 'text-delta' && typeof chunk.text === 'string' && chunk.text) {
        text += chunk.text;
        onDelta?.(chunk.text);
      }
    }
  } catch (error) {
    if (signal?.aborted) return { ok: false, code: 'aborted', text: spokenOf(text, maxChars), source: 'partial' };
    if (isAbortError(error) || controller.signal.aborted) {
      if (text.trim()) return { ok: true, text: spokenOf(text, maxChars), source: 'partial', model: target.model };
      return { ok: false, code: 'voice-timeout', text: VOICE_FALLBACK, source: 'fallback' };
    }
    logger.warn?.(`[whalego] voice brain failed: ${String(error?.message ?? error)}`);
    traceVoiceError(error);
    if (text.trim()) return { ok: true, text: spokenOf(text, maxChars), source: 'partial', model: target.model };
    return { ok: false, code: 'voice-failed', text: VOICE_FALLBACK, source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }

  const cleaned = spokenOf(text, maxChars);
  if (!cleaned) return { ok: false, code: 'empty', text: VOICE_FALLBACK, source: 'fallback' };
  return { ok: true, text: cleaned, source: 'voice', model: target.model };
}

export async function resolveTarget(ctx) {
  let session;
  try {
    session = typeof ctx?.get === 'function' ? ctx.get('sessionController') : undefined;
  } catch {
    session = undefined;
  }
  try {
    const catalog = await session?.modelCatalog?.();
    const selected = catalog?.default;
    if (selected?.provider && selected?.model) {
      return {
        provider: selected.provider,
        model: selected.model,
        ...(selected.reasoningEffort ? { reasoningEffort: selected.reasoningEffort } : {}),
      };
    }
  } catch {
    /* catalog is optional; fall through */
  }
  return undefined;
}

function combineSignals(...signals) {  const active = signals.filter(Boolean);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(active);
  return active[0];
}
