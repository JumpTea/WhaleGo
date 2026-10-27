/**
 * Voice lines kept for the web half.
 *
 * `assistant-actions` only receives a messageId, so the web client asks this
 * registry what the message said and which audio belongs to it. The registry
 * is deliberately small (the last few hundred lines) and best-effort: losing
 * it only costs the replay button, never the conversation itself.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LIMIT = 200;
const entries = new Map();

function storePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'whalego', 'voices.json');
}

function load() {
  try {
    const file = storePath();
    if (!existsSync(file)) return;
    const rows = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(-LIMIT)) {
      if (row?.messageId) entries.set(row.messageId, row);
    }
  } catch {
    /* a broken cache only loses replay metadata */
  }
}

let loaded = false;

function flush() {
  try {
    const file = storePath();
    mkdirSync(join(file, '..'), { recursive: true });
    const rows = [...entries.values()].slice(-LIMIT);
    writeFileSync(file, JSON.stringify(rows));
  } catch {
    /* best-effort */
  }
}

/** Remember one durable voice line so the web half can render it. */
export function recordVoice(messageId, { text, audio } = {}) {
  if (!messageId) return;
  if (!loaded) {
    loaded = true;
    load();
  }
  entries.set(String(messageId), {
    messageId: String(messageId),
    text: typeof text === 'string' ? text : '',
    audio: audio ?? null,
    at: Date.now(),
  });
  while (entries.size > LIMIT) entries.delete(entries.keys().next().value);
  flush();
}

export function listVoices({ messageId, sessionId, limit = 50 } = {}) {
  if (!loaded) {
    loaded = true;
    load();
  }
  let rows = [...entries.values()];
  if (messageId) rows = rows.filter((row) => row.messageId === String(messageId));
  const cap = Math.max(1, Math.min(200, Number(limit) || 50));
  return rows.slice(-cap);
}
