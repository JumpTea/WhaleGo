/** Handlers registered with the dshGo host. */
export function registerActions(ctx, dshGo, engine) {
  if (!dshGo?.on) return;
  dshGo.on('whalego.ask', (scope) => engine.ask(scope));
  dshGo.on('whalego.stop', (scope) => engine.stop(scope));
  dshGo.on('whalego.read', (scope) => engine.read(scope));
  dshGo.on('whalego.explain', (scope) => engine.explain(scope));

  if (typeof dshGo.media === 'function') {
    dshGo.media('speech', (scope, options) => engine.media(scope, options));
  }
  if (typeof dshGo.onCapability === 'function') {
    dshGo.onCapability((scope, payload) => engine.onCapability(scope, payload));
  }
}
