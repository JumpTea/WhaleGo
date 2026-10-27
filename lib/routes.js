/** Optional host-side health endpoint. It exposes no transcript text. */
import { VERSION } from './version.js';

export function registerRoutes(ctx, engine) {
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
  if (!web?.register) return () => {};

  try {
    const dispose = web.register(
      { kind: 'exact', path: '/whalego/health' },
      (req, res) => {
        const body = JSON.stringify({
          ok: true,
          version: VERSION,
          status: engine.status,
          native: engine.diagnostics({}).native,
        });
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.setHeader('cache-control', 'no-store');
        res.end(body);
      },
    );
    return () => dispose?.();
  } catch {
    return () => {};
  }
}
