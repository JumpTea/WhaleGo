/** Handlers registered with the dshGo host. */
import { browserBridgeState } from './browserBridge.js';
export function registerActions(ctx, dshGo, engine) {
  if (!dshGo?.on) return;
  // Tapping the native status strip opens the browser voice page: the strip is
  // the only native surface the phone app renders for third-party plugins.
  dshGo.on('whalego.status', () => {
    if (engine.prefs.browserEntry === 'off') return { toast: '浏览器模式已关闭，可在语音页设置里开启。' };
    const { running, port, error } = browserBridgeState();
    if (!running) return { toast: `浏览器入口没有启动${error ? `（${error}）` : ''}。` };
    return { link: `http://127.0.0.1:${port}/` };
  });
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
