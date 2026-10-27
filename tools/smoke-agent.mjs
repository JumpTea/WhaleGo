#!/usr/bin/env node
/**
 * Agent-profile smoke: a delivered dsh profile must really use tools.
 *
 *   node tools/smoke-agent.mjs "<dsh bin.js>" <profile> [workdir]
 *
 * Prompts the agent to write a file and count `.mjs` files with the shell, then
 * checks the file on disk and the printed number. Exits non-zero on failure.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , bin, profile, workdir = 'D:\\dsh-go-lab'] = process.argv;
if (!bin || !profile) {
  console.error('usage: node tools/smoke-agent.mjs <dsh bin.js> <profile> [workdir]');
  process.exit(2);
}
const MARK = String(Date.now()).slice(-5);
const note = join(workdir, 'agent-note.txt');
const mjsCount = readdirSync(workdir).filter((name) => name.endsWith('.mjs')).length;

function run(prompt, timeoutMs = 240000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, profile, prompt], { cwd: workdir, env: process.env });
    let out = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

const prompt = [
  `请把这一行原样写进 ${note}，文件里只保留这一行：smoke-agent-${MARK}。`,
  `然后用 shell 统计 ${workdir} 目录下 .mjs 文件的数量（不递归）。`,
  '最后只输出一个数字。',
].join('\n');

const { code, out } = await run(prompt);
const written = existsSync(note) ? readFileSync(note, 'utf8') : '';
const tail = out.trim().split('\n').slice(-3).join(' ');

const checks = [
  ['agent exits cleanly', code === 0, `exit=${code}`],
  ['writes the file through tools', written.includes(`smoke-agent-${MARK}`), `file=${JSON.stringify(written.slice(0, 40))}`],
  ['counts with the shell', new RegExp(`(^|\\D)${mjsCount}(\\D|$)`).test(out), `expected=${mjsCount} tail=${JSON.stringify(tail.slice(-60))}`],
];

let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} · ${detail}`);
  if (!ok) failed += 1;
}
writeFileSync(
  join(workdir, 'smoke-agent-report.json'),
  JSON.stringify({ profile, mark: MARK, checks: checks.map(([name, ok, detail]) => ({ name, ok, detail })), tail, at: new Date().toISOString() }, null, 2),
);
process.exit(failed ? 1 : 0);
