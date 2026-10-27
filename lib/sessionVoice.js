/** Persist a spoken line as a durable assistant message in the DSH session. */
import { randomUUID } from 'node:crypto';

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
export function appendVoiceMessage(ctx, { sessionId, text, audio = null, order = 'before-text', context = false, logger = null } = {}) {
  const spoken = String(text ?? '').trim();
  if (!spoken) return false;
  const session = sessionOf(ctx, sessionId);
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
    return true;
  } catch (error) {
    logger?.warn?.(`[whalego] voice line not persisted: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

function sessionOf(ctx, sessionId) {
  const sessions = ctx?.get?.('sessions') ?? ctx?.sessions;
  if (!sessions || typeof sessions.get !== 'function') return undefined;
  const id = String(sessionId ?? '');
  return id ? sessions.get(id) : undefined;
}
