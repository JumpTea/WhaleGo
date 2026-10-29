/**
 * Remember a spoken line for the web half.
 *
 * A plugin cannot forge an `assistant/message`: the session log only accepts
 * assistant messages that belong to an open turn/step, and writing one outside
 * a turn corrupts the stored log (`SessionFormatError`). The voice line is
 * therefore kept in a small host-side registry that the web client renders,
 * and never written into the session journal.
 */
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dshHome } from './prefs.js';
import { recordVoice } from './voices.js';

/** @returns {string|null} registry id, or null when there is nothing to say. */
export function appendVoiceMessage(ctx, { text, audio = null, messageId = null, logger = null } = {}) {
  const spoken = String(text ?? '').trim();
  if (!spoken) return null;
  const id = messageId || `voice_${randomUUID()}`;
  recordVoice(id, { text: spoken, audio });
  traceAppend(`ok id=${id}`);
  logger?.info?.(`[whalego] voice line remembered: ${id}`);
  return id;
}

function traceAppend(line) {
  try {
    if (process.env.NODE_TEST_CONTEXT) return;
    appendFileSync(join(dshHome(), 'whalego', 'append-trace.log'), `${new Date().toISOString()} ${line}\n`);
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
    const saved = await store.saveFile({ data: buffer, name });
    if (!saved || !saved.attachmentId) return null;
    const ref = { attachmentId: saved.attachmentId, contentType: 'audio/mpeg' };
    if (inline) ref.data = inline;
    return ref;
  } catch {
    return null;
  }
}
