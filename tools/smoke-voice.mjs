#!/usr/bin/env node
/**
 * Real-service smoke test for the voice routes (no mocks).
 *
 *   node tools/smoke-voice.mjs [http://127.0.0.1:3080]
 *
 * Uses the host's own browser-session credential to forge the same cookie the
 * WebView holds, then checks TTS, transcription and health against the live
 * services. Exits non-zero on failure.
 */
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://127.0.0.1:3080').replace(/\/+$/, '');
const home = process.env.DSH_HOME || join(homedir(), '.dsh');
const authority = new URL(base).host;

function cookie() {
  const text = readFileSync(join(home, '.credentials.yaml'), 'utf8');
  const match = /client-connection\/browser-session:[\s\S]*?secret:\s*(\S+)/.exec(text);
  if (!match) throw new Error('no browser-session secret');
  const now = Date.now();
  const body = Buffer.from(
    JSON.stringify({ version: 1, authority, issuedAt: now, expiresAt: now + 3600_000 }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', Buffer.from(match[1], 'base64url')).update(body).digest('base64url');
  return `dsh-auth-${createHash('sha256').update(authority).digest('base64url')}=v1.${body}.${signature}`;
}

function silentWav(ms = 500) {
  const samples = Math.round((16000 * ms) / 1000);
  const pcm = Buffer.alloc(samples * 2);
  const out = Buffer.alloc(44 + pcm.length);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + pcm.length, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16000, 24);
  out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(pcm.length, 40);
  pcm.copy(out, 44);
  return out;
}

const headers = { cookie: cookie(), 'content-type': 'application/json' };
const checks = [];

const health = await fetch(`${base}/whalego/health`, { headers });
checks.push(['health 200', health.status === 200, `status=${health.status}`]);

const speak = await fetch(`${base}/whalego/speak`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ text: '今天天气不错。' }),
});
const audio = Buffer.from(await speak.arrayBuffer());
checks.push(['tts returns mp3', speak.ok && audio.length > 4096, `bytes=${audio.length}`]);

const wav = silentWav();
const stt = await fetch(`${base}/whalego/transcribe`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ audio: wav.toString('base64'), language: 'zh' }),
});
const sttBody = await stt.json().catch(() => ({}));
checks.push(['transcribe accepts canonical wav', stt.ok && sttBody.ok === true, JSON.stringify(sttBody).slice(0, 80)]);

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${detail}`);
  if (!ok) failed += 1;
}
process.exit(failed === 0 ? 0 : 1);
