/** Persist a spoken line as a durable assistant message in the DSH session. */
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const TURN = 1;
const STEP = 1;

/**
 * Append one assistant message whose first block is a `voice` block.
 *
 * The block is presentation-only: the engine projection drops it before the
 * model request, so the message never re-enters the text history. A voice turn
 * that also has a text answer therefore stays one message per brain.
 *
 * @returns {boolean} whether a session was available and the append succeeded.
 */
export function appendVoiceMessage(ctx, { sessionId, text, audio = null, order = 'before-text', context = false, logger = null, session: liveSession = null } = {}) {
  const spoken = String(text ?? '').trim();
  if (!spoken) return false;
  const session = typeof liveSession?.append === 'function' ? liveSession : sessionOf(ctx, sessionId);
  if (!session || typeof session.append !== 'function') return false;
  const block = { type: 'voice', text: spoken, final: true, order, context };
  if (audio) block.audio = audio;
  try {
    session.append(
      'assistant/message',
      {
        turn: TURN,
        step: STEP,
        message: {
          id: `voice_${randomUUID()}`,
          role: 'assistant',
          content: [block],
          source: { kind: 'model', provider: 'whalego', model: 'whalego-voice' },
        },
        stream: [],
      },
      { surfaceOp: 'append' },
    );
    traceAppend(`ok session=${sessionId}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    traceAppend(`fail session=${sessionId} ${message}`);
    logger?.warn?.(`[whalego] voice line not persisted: ${message}`);
    return false;
  }
}

function traceAppend(line) {
  try {
    appendFileSync('/root/.dsh/whalego/append-trace.log', `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* lab trace only */
  }
}

/**
 * Store one rendered mp3 in the host attachment store so the voice message can
 * be replayed after the fact. Best-effort: hosts without `attachments` (or a
 * failing store) simply keep the transcript-only message.
 *
 * @returns {Promise<{attachmentId: string, contentType: string}|null>}
 */
export async function saveVoiceAudio(ctx, buffer, { name = 'whalego-voice.mp3' } = {}) {
  let store;
  try {
    store = typeof ctx?.get === 'function' ? ctx.get('attachments') : undefined;
  } catch {
    store = undefined;
  }
  if (!store || typeof store.saveFile !== 'function') return null;
  if (!buffer || typeof buffer.length !== 'number' || buffer.length === 0) return null;
  // Inline the bytes for short lines: the App can replay a voice row without a
  // host route, and other clients may not be able to read file attachments.
  const inline = buffer.length <= 384 * 1024 ? buffer.toString('base64') : undefined;
  try {
    const ref = await store.saveFile({ data: new Uint8Array(buffer), name });
    if (!ref?.attachmentId) return null;
    return {
      attachmentId: ref.attachmentId,
      contentType: 'audio/mpeg',
      ...(inline ? { data: inline } : {}),
    };
  } catch {
    return null;
  }
}

function sessionOf(ctx, sessionId) {
  let sessions;
  try {
    sessions = typeof ctx?.get === 'function' ? ctx.get('sessions') : undefined;
  } catch {
    sessions = undefined;
  }
  if (!sessions || typeof sessions.get !== 'function') return undefined;
  const id = String(sessionId ?? '');
  return id ? sessions.get(id) : undefined;
}
