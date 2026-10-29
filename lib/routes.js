/** Optional host-side health endpoint. It exposes no transcript text. */
import { appendFileSync } from 'node:fs';
import { browserBridgeState, startBrowserBridge, stopBrowserBridge } from './browserBridge.js';
import { join } from 'node:path';
import { dshHome, patchPrefs, savePrefs } from './prefs.js';
import { BROWSER_ENTRY, FILLERS, MODES, RATES, THINK_ORBS, VOICES } from './prompts.js';
import { VERSION } from './version.js';
import { listVoices } from './voices.js';

function pickPrefs(prefs) {
  return {
    mode: prefs?.mode ?? 'auto',
    voice: prefs?.voice ?? '',
    rate: prefs?.rate ?? 'normal',
    thinkOrb: prefs?.thinkOrb ?? 'corner',
    browserEntry: prefs?.browserEntry ?? 'on',
    filler: prefs?.filler ?? '',
  };
}

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
            prefs: pickPrefs(engine?.prefs),
            browser: browserBridgeState(),
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
              const heard = typeof body.heard === 'string' ? body.heard : undefined;
              const engine = engineOf();
              if (!engine) {
                json(res, 503, { ok: false, error: 'engine is not mounted' });
                return;
              }
              const cancelled = Boolean(engine.interrupt?.(sessionId, heard));
              json(res, 200, { ok: true, cancelled });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // The browser is the speaker, so only it knows when the answer finished
    // playing. This is the web counterpart of the App's `audio.done` receipt:
    // the turn settles on the client's word, not on the generator's.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/playback',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const sessionId = String(body.sessionId ?? '');
              const turnId = String(body.turnId ?? '');
              const state = String(body.state ?? 'ended');
              const heard = typeof body.heard === 'string' ? body.heard : undefined;
              const engine = engineOf();
              if (!engine || typeof engine.completePlayback !== 'function') {
                json(res, 503, { ok: false, error: 'engine unavailable' });
                return;
              }
              if (!sessionId || !turnId) {
                json(res, 400, { ok: false, error: 'sessionId and turnId are required' });
                return;
              }
              const completed = Boolean(engine.completePlayback({ sessionId, turnId, state, heard }));
              json(res, 200, { ok: true, completed });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // Which conversation should the orb talk into? The web half has no route
    // params, so it asks the host for the most recently touched session.
    // Speech-to-text fallback: the browser records WAV and the host transcribes
    // it with whatever Speech provider the profile installed.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/transcribe',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              // A few minutes of 16 kHz mono PCM exceeds the generic 64 KiB
              // body limit, so this route negotiates its own ceiling.
              const body = await readJson(req, 18 * 1024 * 1024);
              const audio = Buffer.from(String(body.audio ?? ''), 'base64');
              if (!audio.length) {
                json(res, 400, { ok: false, error: 'audio is required' });
                return;
              }
              if (audio.length > 12 * 1024 * 1024) {
                json(res, 413, { ok: false, error: 'audio too large' });
                return;
              }
              const service = typeof ctx?.get === 'function' ? ctx.get('speechToText') : undefined;
              if (!service || typeof service.resolve !== 'function' || typeof service.transcribe !== 'function') {
                json(res, 503, { ok: false, error: 'speechToText service unavailable' });
                return;
              }
              const spec = service.resolve({ audio, language: String(body.language ?? 'zh') });
              const result = await service.transcribe(spec, AbortSignal.timeout(120_000));
              json(res, 200, { ok: true, text: String(result?.text ?? '') });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // Browser-side diagnostics land in a file the plugin author can read from
    // the host; the phone tool refuses to inspect the app's own screen.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/probe',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const line = JSON.stringify({ at: new Date().toISOString(), ...body }).slice(0, 2000);
              appendFileSync(join(dshHome(), 'whalego', 'probe.log'), `${line}\n`);
              json(res, 200, { ok: true });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // The phone app does not render plugin panels yet, so the voice page can
    // still flip the orb dock from its own long-press gesture.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/prefs',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const engine = engineOf();
              if (!engine) {
                json(res, 503, { ok: false, error: 'engine unavailable' });
                return;
              }
              const allowed = {
                mode: MODES,
                voice: VOICES,
                rate: RATES,
                thinkOrb: THINK_ORBS,
                filler: FILLERS,
                browserEntry: BROWSER_ENTRY,
              };
              let changed = 0;
              for (const [key, values] of Object.entries(allowed)) {
                if (!(key in body)) continue;
                const value = String(body[key] ?? '');
                if (!values.includes(value)) {
                  json(res, 400, { ok: false, error: `${key} is not a valid value` });
                  return;
                }
                Object.assign(engine.prefs, patchPrefs(engine.prefs, key, value));
                changed += 1;
              }
              if (!changed) {
                json(res, 400, { ok: false, error: 'nothing to change' });
                return;
              }
              savePrefs(engine.prefs);
              engine.setPrefs(engine.prefs);
              if ('browserEntry' in body) {
                if (engine.prefs.browserEntry === 'off') stopBrowserBridge();
                else startBrowserBridge({ home: dshHome() });
              }
              json(res, 200, { ok: true, prefs: pickPrefs(engine.prefs), browser: browserBridgeState() });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
    // The browser tells us how much of the written answer is on screen.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/seen',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            try {
              const body = await readJson(req);
              const turnId = String(body.turnId ?? '');
              const seen = String(body.seen ?? '');
              const engine = engineOf();
              if (!engine || typeof engine.setSeen !== 'function') {
                json(res, 503, { ok: false, error: 'engine unavailable' });
                return;
              }
              if (!turnId) {
                json(res, 400, { ok: false, error: 'turnId is required' });
                return;
              }
              json(res, 200, { ok: true, seen: Boolean(engine.setSeen(turnId, seen)) });
            } catch (error) {
              json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
            }
          })();
        },
      }),
    );
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
    // Stream one spoken line as mp3 chunks: the web client starts playing
    // before the whole sentence exists (MediaSource), instead of waiting.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/speak',
        handler: (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { ok: false, error: 'POST only' });
            return;
          }
          void (async () => {
            let started = false;
            const onStart = () => {
              if (started) return;
              started = true;
              res.writeHead(200, {
                'content-type': 'audio/mpeg',
                'cache-control': 'no-store',
                'transfer-encoding': 'chunked',
              });
            };
            try {
              const body = await readJson(req);
              const text = String(body.text ?? '').trim();
              const engine = engineOf();
              if (!engine || typeof engine.speakStream !== 'function') {
                json(res, 503, { ok: false, error: 'engine unavailable' });
                return;
              }
              if (!text) {
                json(res, 400, { ok: false, error: 'text is required' });
                return;
              }
              await engine.speakStream(text, {
                onStart,
                onChunk: (buffer) => {
                  onStart();
                  res.write(buffer);
                },
              });
              onStart();
              res.end();
            } catch (error) {
              if (started) {
                res.end();
              } else {
                json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
              }
            }
          })();
        },
      }),
    );
    // Server-sent events for one turn: the voice text grows chunk by chunk,
    // so the full-screen space can render it while audio is still playing.
    disposers.push(
      web.register({
        kind: 'exact',
        path: '/whalego/live',
        handler: (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const turnId = url.searchParams.get('turn') ?? '';
          const sessionId = url.searchParams.get('session') ?? '';
          if (!turnId && !sessionId) {
            // No session yet: follow every composer-typed line so the mirror
            // still works before the app has created a conversation.
            let closedMirror = false;
            res.writeHead(200, {
              'content-type': 'text/event-stream; charset=utf-8',
              'cache-control': 'no-cache, no-transform',
              connection: 'keep-alive',
              'x-accel-buffering': 'no',
            });
            res.write(': connected\n\n');
            let lastMirror = '';
            const sendMirror = (data) => res.write(`event: live\ndata: ${JSON.stringify(data)}\n\n`);
            const timerMirror = setInterval(() => {
              if (closedMirror) return;
              const typed = engineOf()?.latestTyped?.();
              if (!typed) return;
              const signature = JSON.stringify(typed);
              if (signature === lastMirror) return;
              lastMirror = signature;
              sendMirror(typed);
            }, 400);
            const stopMirror = () => {
              if (closedMirror) return;
              closedMirror = true;
              clearInterval(timerMirror);
              try {
                res.end();
              } catch {
                /* gone */
              }
            };
            req.on('close', stopMirror);
            return;
          }
          res.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          });
          res.write(': connected\n\n');
          let closed = false;
          let last = '';
          const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          const stop = () => {
            if (closed) return;
            closed = true;
            clearInterval(timer);
            try {
              unsubscribe?.();
            } catch {
              /* gone */
            }
            try {
              res.end();
            } catch {
              /* gone */
            }
          };
          const push = () => {
            if (closed) return;
            const engine = engineOf();
            const live = turnId ? engine?.live?.(turnId) : engine?.latest?.(sessionId);
            if (!live) return;
            const signature = JSON.stringify(live);
            if (signature !== last) {
              last = signature;
              send('live', live);
            }
            // A voice-only turn ends when its line is complete; 'speaking' is
            // terminal here because the browser owns playback from that point.
            // Session mode keeps the stream open so typed turns keep flowing.
            // Keep the tunnel open while the written track is still arriving;
            // 'speaking' only means A is audible, not that B is finished.
            if (turnId && (live.state === 'done' || live.state === 'interrupted' || live.state === 'error')) {
              send('end', { state: live.state });
              stop();
            }
          };
          const engine = engineOf();
          const unsubscribe = engine?.subscribe?.(sessionId, push) ?? null;
          const timer = setInterval(push, 400);
          req.on('close', stop);
          push();
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
