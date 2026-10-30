/** Handlers registered with the dshGo host. */
import { entryUrl } from './browserBridge.js';
import { patchPrefs, savePrefs } from './prefs.js';

/** How long the "full experience needs the browser entry" reminder stays quiet. */
const HINT_MS = 12 * 60 * 60 * 1000;
// Protocol §4.7: a toast is at most 40 characters.
const HINT_TOAST = '完整语音体验（免提/流式）请用浏览器入口，地址已复制';

/**
 * Once per HINT_MS, the 鲸语 button also suggests the browser entry and copies
 * its URL: hands-free capture and auto-play live on the web side, the App's
 * WebView cannot take a microphone. Fires beside the action's own result.
 */
export function entryHint(prefs, hintMs = HINT_MS) {
  return (result) => {
    if (Date.now() - Number(prefs?.hintAt ?? 0) < hintMs) return result;
    Object.assign(prefs ?? {}, savePrefs(patchPrefs(prefs ?? {}, 'hintAt', Date.now())));
    return { toast: HINT_TOAST, copy: entryUrl(), ...result };
  };
}

export function registerActions(ctx, dshGo, engine, prefs) {
  if (!dshGo?.on) return;
  const hint = prefs ? entryHint(prefs) : (result) => result;
  dshGo.on('whalego.ask', (scope) => hint(engine.ask(scope)));
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
