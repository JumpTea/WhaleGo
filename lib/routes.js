/** Optional host-side health endpoint. It exposes no transcript text. */
import { VERSION } from './version.js';
import { listVoices } from './voices.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function registerRoutes(ctx, engineOrGetter) {
  // The web half must work even when the native host is absent (plain DSH web),
  // so the engine is resolved lazily and its absence only disables voice-turn.
  const engineOf = typeof engineOrGetter === 'function' ? engineOrGetter : () => engineOrGetter;
  // cordis throws on a direct property access for a service that was not
  // injected, so ask the container instead of reading ctx.webServer.
  let web;
  try {
    web = typeof ctx?.get === 'function' ? ctx.get('webServer') : undefined;
  } catch {
    web = undefined;
  }
  if (!web) {
    try {
      web = ctx?.webServer;
    } catch {
      web = undefined;
    }
  }
  if (!web?.register) {
    console.error('[whalego] webServer unavailable for routes');
    return () => {};
  }

  try {
    const disposers = [];
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/health',
        handler: (req, res) => {
          const engine = engineOf();
          json(res, 200, {
            ok: true,
            version: VERSION,
            status: engine?.status ?? 'idle',
            native: engine?.diagnostics?.({})?.native ?? {},
          });
        },
      }),
    );
    // The web half renders a voice card under each assistant message; it only
    // knows the messageId, so this is how it learns the spoken text and audio.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/voices',
        handler: (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const messageId = url.searchParams.get('messageId') ?? undefined;
          json(res, 200, { voices: listVoices({ messageId }) });
        },
      }),
    );
    // Text in, spoken line out: lets the web panel start a real voice turn
    // without a microphone (and is the fallback where recording is blocked).
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/voice-turn',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const sessionId = String(body.sessionId ?? '');
              const text = String(body.text ?? '').trim();
              if (!sessionId || !text) {
                json(res, 400, { ok: false, error: 'sessionId and text are required' });
                return;
              }
              const effect = engineOf()?.ask({ draft: text, sessionId });
              json(res, 200, { ok: true, effect });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // Abort the in-flight turn for one session (mirrors the panel's Stop).
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/cancel',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const sessionId = String(body.sessionId ?? '');
              const engine = engineOf();
              if (!engine) {
                json(res, 503, { ok: false, error: 'engine is not mounted' });
                return;
              }
              const cancelled = Boolean(engine.interrupt?.(sessionId));
              json(res, 200, { ok: true, cancelled });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // Which conversation should the orb talk into? The web half has no route
    // params, so it asks the host for the most recently touched session.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/session',
        handler: (req, res) => {
          void (async () => {
            try {
              let sessions = [];
              let controller;
              try {
                controller = typeof ctx?.get === 'function' ? ctx.get('sessionController') : undefined;
              } catch {
                controller = undefined;
              }
              if (controller && typeof controller.list === 'function') {
                const listed = await controller.list({}, AbortSignal.timeout(4000));
                sessions = Array.isArray(listed) ? listed : listed?.items ?? listed?.sessions ?? [];
              }
              const live = sessions.filter((item) => item && item.agentAvailable && (item.id || item.sessionId));
              const pool = live.length ? live : sessions.filter((item) => item && (item.id || item.sessionId));
              let latest = [...pool].sort(
                (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
              )[0];
              // No live conversation yet: open a blank one so the orb has a place
              // to speak into instead of queueing into a detached stored session.
              if (!latest && controller && typeof controller.create === 'function') {
                const created = await controller.create({ cwd: process.cwd() });
                if (created && created.sessionId) latest = { sessionId: created.sessionId, title: '' };
              }
              json(res, 200, {
                ok: true,
                sessionId: latest ? String(latest.id ?? latest.sessionId) : '',
                title: latest?.title ?? '',
              });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    console.log('[whalego] web routes registered:', disposers.length);
    return () => {
      for (const dispose of disposers) {
        try {
          dispose?.();
        } catch {
          /* already gone */
        }
      }
    };
  } catch (error) {
    console.error('[whalego] web routes not registered:', error instanceof Error ? error.message : String(error));
    return () => {};
  }
}
