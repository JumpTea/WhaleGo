/** Real-key web UI smoke: send a prompt, wait for streaming, press stop. */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const DSH = join(process.env.APPDATA ?? '', 'npm', 'dsh.cmd');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startServer() {
  const child = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'dsh --profile web --no-open --port 0'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  const waitUrl = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('web profile URL timeout')), 45000);
    const onData = (d) => {
      buf += d.toString();
      const match = buf.match(/dsh web:\s*(http:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
  return { child, waitUrl };
}

function killTree(pid) {
  if (!pid) return;
  spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }).on('error', () => {});
}

export async function runWebCancel() {
  const { child, waitUrl } = startServer();
  let browser;
  try {
    const url = await waitUrl;
    const executablePath = process.env.WHALEGO_BROWSER || EDGE;
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    const box = page.locator('[role="textbox"]').first();
    await box.waitFor({ timeout: 30000 });
    await box.fill('请用中文写一段 1200 字的产品介绍，分段输出，不要使用任何工具。');
    const send = page.getByRole('button', { name: '发送消息' });
    await page.waitForFunction(() => {
      const button = document.querySelector('button[aria-label="发送消息"]');
      return button && !button.disabled;
    }, null, { timeout: 30000 });
    await send.click();

    const stop = page.locator('button[aria-label*="停止"]').first();
    await stop.waitFor({ timeout: 30000 });
    await stop.click();
    await page.waitForTimeout(1200);

    const stopLeft = await page.locator('button[aria-label*="停止"]').count();
    const sendBack = await page.getByRole('button', { name: '发送消息' }).count();
    return {
      name: 'web-cancel',
      ok: stopLeft === 0 && sendBack === 1,
      url,
      stopLeft,
      sendBack,
      stderrTail: '',
    };
  } finally {
    try { await browser?.close(); } catch {}
    killTree(child.pid);
  }
}
