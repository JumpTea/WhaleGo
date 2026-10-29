import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mintSessionCookie } from '../lib/browserBridge.js';

function homeWithSecret(secret) {
  const home = mkdtempSync(join(tmpdir(), 'whalego-bridge-'));
  writeFileSync(
    join(home, '.credentials.yaml'),
    `version: 1\nrecords:\n  client-connection/browser-session:\n    kind: grant\n    payload:\n      version: 1\n      secret: ${secret}\n`,
  );
  return home;
}

test('mints a v1 cookie bound to the web authority', () => {
  const home = homeWithSecret('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  const now = 1_800_000_000_000;
  const cookie = mintSessionCookie({ home, authority: '127.0.0.1:3080', now });
  assert.ok(cookie);
  assert.match(cookie.name, /^dsh-auth-[A-Za-z0-9_-]+$/);
  const parts = cookie.value.split('.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'v1');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(payload.authority, '127.0.0.1:3080');
  assert.equal(payload.issuedAt, now);
  assert.ok(payload.expiresAt > now);
});

test('returns null when the host has no session secret', () => {
  const home = mkdtempSync(join(tmpdir(), 'whalego-bridge-empty-'));
  assert.equal(mintSessionCookie({ home, authority: '127.0.0.1:3080' }), null);
});
