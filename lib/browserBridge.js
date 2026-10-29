/**
 * Browser entry: a localhost-only page that mints the DSH web session cookie
 * for a normal browser.
 *
 * The app's WebView denies `getUserMedia`, so voice input only works in a
 * real browser. The page hands the browser the same signed cookie the WebView
 * already has, then redirects to the DSH web UI. Nothing leaves the device.
 */
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { dshHome } from './prefs.js';

const DEFAULT_PORT = 3099;
const DAY_MS = 24 * 60 * 60 * 1000;

let server = null;
let state = { running: false, port: DEFAULT_PORT, webOrigin: 'http://127.0.0.1:3080', error: '' };

function secretOf(home) {
  try {
    const text = readFileSync(join(home, '.credentials.yaml'), 'utf8');
    const match = /client-connection\/browser-session:[\s\S]*?secret:\s*(\S+)/.exec(text);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/** Same shape the host writes: v1.<base64url payload>.<hmac>. */
export function mintSessionCookie({ home, authority, days = 7, now = Date.now() }) {
  const secret = secretOf(home);
  if (!secret) return null;
  const body = Buffer.from(
    JSON.stringify({ version: 1, authority, issuedAt: now, expiresAt: now + days * DAY_MS }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', Buffer.from(secret, 'base64url')).update(body).digest('base64url');
  const name = `dsh-auth-${createHash('sha256').update(authority).digest('base64url')}`;
  return { name, value: `v1.${body}.${signature}`, days };
}

function page({ ok, message, target }) {
  const refresh = ok ? `<meta http-equiv="refresh" content="0;url=${target}">` : '';
  const link = ok ? `<p><a href="${target}">进入 DSH</a></p>` : '';
  return `<!doctype html><meta charset=utf-8>${refresh}<title>鲸语 · 浏览器模式</title>
<body style="font:16px/1.6 -apple-system,system-ui,sans-serif;margin:0;padding:48px 24px;background:#f7f7f5;color:#111">
<h1 style="font-size:20px;margin:0 0 12px">浏览器模式</h1>
<p>${message}</p>${link}
<p style="color:#888;font-size:13px;margin-top:28px">这个页面只在本机运行，用于把语音会话交给浏览器。</p>
</body>`;
}

function handle(home, webOrigin) {
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const authority = new URL(webOrigin).host;
    const cookie = mintSessionCookie({ home, authority });
    if (!cookie) {
      res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(page({ ok: false, message: '找不到 DSH 的会话密钥，请先在 App 里打开过一次。' }));
      return;
    }
    // `?voice=1` is the short form the native header uses: land straight in
    // the voice space instead of the plain WebUI.
    const voice = url.searchParams.has('voice');
    const path = voice ? '/?whale=1' : url.searchParams.get('path') || '/';
    const target = `${webOrigin}${path.startsWith('/') ? path : `/${path}`}`;
    res.writeHead(302, {
      location: target,
      'set-cookie': `${cookie.name}=${cookie.value}; Max-Age=${cookie.days * 24 * 3600}; Path=/; HttpOnly; SameSite=Lax`,
      'cache-control': 'no-store',
      'content-type': 'text/html; charset=utf-8',
    });
    res.end(page({ ok: true, message: '已登录，正在进入 DSH…', target }));
  };
}

/** Start the helper; safe to call twice. */
export function startBrowserBridge({ home = dshHome(), port = DEFAULT_PORT, webOrigin = 'http://127.0.0.1:3080' } = {}) {
  if (server) return { ...state };
  state = { running: false, port, webOrigin, error: '' };
  try {
    server = http.createServer(handle(home, webOrigin));
    server.on('error', (error) => {
      state.error = error?.code === 'EADDRINUSE' ? `port ${port} in use` : String(error?.message ?? error);
      state.running = false;
      server = null;
    });
    server.listen(port, '127.0.0.1', () => {
      state.running = true;
    });
  } catch (error) {
    state.error = String(error?.message ?? error);
    server = null;
  }
  return { ...state };
}

export function stopBrowserBridge() {
  try {
    server?.close();
  } catch {
    /* already gone */
  }
  server = null;
  state = { ...state, running: false };
  return { ...state };
}

export function browserBridgeState() {
  return { ...state };
}
