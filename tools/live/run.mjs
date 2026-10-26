#!/usr/bin/env node
/** Real-key test runner. Requires DEEPSEEK_API_KEY or ~/.dsh/.env. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runHeadlessSmoke } from './headless.mjs';
import { runVoiceSmoke } from './voice.mjs';
import { runWebCancel } from './web-cancel.mjs';

function keySource() {
  if (process.env.DEEPSEEK_API_KEY) return 'env';
  try {
    const text = readFileSync(join(homedir(), '.dsh', '.env'), 'utf8');
    return /^\s*DEEPSEEK_API_KEY\s*=/m.test(text) ? 'dsh-env' : null;
  } catch {
    return null;
  }
}

const cases = [];
const source = keySource();
if (!source) {
  console.log('SKIPPED: DEEPSEEK_API_KEY not set — real-model path not exercised');
  process.exit(0);
}

async function run(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    cases.push({ ...result, ms: Date.now() - started });
    console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ${name}`);
  } catch (error) {
    cases.push({ name, ok: false, error: String(error?.message ?? error), ms: Date.now() - started });
    console.log(`[FAIL] ${name}: ${error?.message ?? error}`);
  }
}

await run('headless-profile', runHeadlessSmoke);
await run('voice-prompt', runVoiceSmoke);
await run('web-cancel', runWebCancel);

const report = {
  startedAt: new Date().toISOString(),
  keySource: source,
  cases,
  ok: cases.every((c) => c.ok),
};
mkdirSync(join(process.cwd(), 'artifacts'), { recursive: true });
writeFileSync(join(process.cwd(), 'artifacts', 'live-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ok: report.ok, cases: cases.map(({ name, ok, ms, error }) => ({ name, ok, ms, error })) }, null, 2));
process.exit(report.ok ? 0 : 1);
