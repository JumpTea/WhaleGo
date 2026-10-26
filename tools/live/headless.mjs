/** Real-key headless profile smoke: tool write + multi-turn. */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DSH = join(process.env.APPDATA ?? '', 'npm', 'dsh.cmd');

export function dshAvailable() {
  try {
    readFileSync(DSH);
    return true;
  } catch {
    return false;
  }
}

export function runDsh(prompt, sessionId, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const args = ['/d', '/s', '/c', `dsh --profile headless --json${sessionId ? ` --session-id ${sessionId}` : ''} -`];
    const child = spawn(process.env.ComSpec ?? 'cmd.exe', args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`headless timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const events = out.split(/\r?\n/).filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      });
      resolve({ code, events, out, err });
    });
    child.stdin.end(prompt, 'utf8');
  });
}

export async function runHeadlessSmoke() {
  const dir = mkdtempSync(join(tmpdir(), 'whalego-live-'));
  const token = `live-${Math.random().toString(16).slice(2, 12)}`;
  const file = join(dir, 'tool.txt');
  const firstPrompt = `把文本 ${token} 写入文件 ${file}（只写这一行），然后只回复 done。不要读取其他文件。`;
  const first = await runDsh(firstPrompt);
  const firstFinal = first.events.findLast?.((e) => e.type === 'final')?.text ?? '';
  const sessionId = first.events.find((e) => e.type === 'session')?.sessionId;
  let fileText = '';
  try { fileText = readFileSync(file, 'utf8').trim(); } catch {}
  const toolWrite = first.code === 0 && fileText === token && /done/i.test(firstFinal);

  let multiTurn = false;
  let secondFinal = '';
  if (sessionId) {
    const second = await runDsh(`读 ${file}，只回复文件内容。`, sessionId);
    secondFinal = second.events.findLast?.((e) => e.type === 'final')?.text ?? '';
    multiTurn = second.code === 0 && secondFinal.includes(token);
  }

  const report = {
    name: 'headless-profile',
    ok: toolWrite && multiTurn,
    sessionId: sessionId ?? null,
    toolWrite,
    multiTurn,
    token,
    file,
    firstFinal,
    secondFinal: secondFinal.slice(0, 200),
    stderrTail: first.err.slice(-500),
  };
  // Keep the temp dir for evidence, but never put the absolute path in git.
  writeFileSync(join(dir, 'result.json'), JSON.stringify({ token, toolWrite, multiTurn, sessionId }, null, 2));
  return report;
}

export function cleanupTemp(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
