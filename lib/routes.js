/** Optional host-side health endpoint. It exposes no transcript text. */
import { VERSION } from './version.js';

export function registerRoutes(ctx, engine) {
  const web = ctx?.webServer ?? ctx?.get?.('webServer');
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
