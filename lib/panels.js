/** Declarative panels. The host draws every pixel; this file only describes. */
import { BRAND, logoDataUri } from './brand.js';
import { DEFAULT_PREFS, patchPrefs, savePrefs } from './prefs.js';
import { VERSION } from './version.js';
import { aboutView, diagView, liveView, settingsData, settingsView } from './views.js';

const PANEL_IDS = Object.freeze({
  live: 'whalego.live',
  settings: 'whalego.settings',
  about: 'whalego.about',
  diag: 'whalego.diag',
});

export function registerPanels(ctx, dshGo, engine, prefs, transcript, { logger = console } = {}) {
  if (!dshGo?.panel) return;
  const actions = makeActions(engine, prefs, transcript, logger);

  dshGo.panel(PANEL_IDS.live, {
    view: liveView(),
    data: (scope, emit) => liveData(engine, scope, emit),
    actions,
  });

  dshGo.panel(PANEL_IDS.settings, {
    view: settingsView(),
    data: (_scope, emit) => {
      emit(settingsData(prefs));
      return () => {};
    },
    actions,
  });

  dshGo.panel(PANEL_IDS.about, {
    view: aboutView(),
    data: (_scope, emit, caps) => {
      emit({ logo: logoDataUri(), version: VERSION, protocol: caps?.protocol ?? 'unknown' });
      return () => {};
    },
    actions,
  });

  dshGo.panel(PANEL_IDS.diag, {
    view: diagView(),
    data: (_scope, emit, caps) => {
      emit(engine.diagnostics(caps));
      return () => {};
    },
    actions,
  });
}

function makeActions(engine, prefs, transcript, logger) {
  const save = (key) => (scope, event) => {
    const raw = event?.value?.value ?? event?.value ?? event?.selected;
    const value = coerce(key, raw);
    const next = patchPrefs(prefs, key, value);
    Object.assign(prefs, savePrefs(next));
    engine.setPrefs(prefs);
    return { patch: settingsData(prefs), toast: '已保存。' };
  };

  const clear = (scope) => {
    transcript.clear();
    engine.refresh();
    return { refresh: true, toast: '实录已清空。' };
  };

  const reset = () => {
    Object.assign(prefs, DEFAULT_PREFS);
    Object.assign(prefs, savePrefs(prefs));
    engine.setPrefs(prefs);
    return { refresh: true, toast: '已恢复默认。' };
  };

  return {
    openSettings: () => ({ open: 'panel:whalego.settings' }),
    openAbout: () => ({ open: 'panel:whalego.about' }),
    openDiag: () => ({ open: 'panel:whalego.diag' }),
    repo: () => ({ link: BRAND.repo }),
    copyTranscript: (scope) => {
      const records = transcript.list(scope?.sessionId, prefs.historyTurns);
      if (records.length === 0) return { toast: '实录还是空的。' };
      const text = records
        .map((record) =>
          [`你：${record.question}`, `鲸语：${record.voice}`, record.text ? `文字脑：${record.text}` : '']
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n\n');
      return { copy: text.slice(0, 8000), toast: '已复制实录。' };
    },
    clearTranscript: (scope, event) => (confirmed(event) ? clear(scope) : { toast: '已取消。' }),
    resetAll: (_scope, event) => (confirmed(event) ? reset() : { toast: '已取消。' }),
    mode: save('mode'),
    voice: save('voice'),
    rate: save('rate'),
    filler: save('filler'),
    orbStyle: save('orbStyle'),
    orbSize: save('orbSize'),
    orbIdle: save('orbIdle'),
    thinkOrb: save('thinkOrb'),
    inlineTranscript: save('inlineTranscript'),
    cacheAudio: save('cacheAudio'),
    historyTurns: save('historyTurns'),
    autoPlay: save('autoPlay'),
  };
}

function liveData(engine, scope, emit) {
  const push = throttle((snapshot) => emit(snapshot), 240);
  push(engine.snapshot(scope?.sessionId));
  const stop = engine.subscribe(scope?.sessionId, push);
  return () => {
    stop();
    push.stop();
  };
}

function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  let pending;
  const flush = () => {
    timer = null;
    last = Date.now();
    fn(pending);
  };
  const push = (value) => {
    pending = value;
    const now = Date.now();
    if (now - last >= ms) flush();
    else if (!timer) {
      timer = setTimeout(flush, ms - (now - last));
      timer.unref?.();
    }
  };
  push.stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return push;
}

function coerce(key, raw) {
  if (key === 'historyTurns') return Number(raw);
  if (key === 'inlineTranscript' || key === 'cacheAudio' || key === 'autoPlay') {
    return raw === true || raw === 'on';
  }
  return raw == null ? '' : String(raw);
}

function confirmed(event) {
  const value = event?.value;
  return event?.confirmed === true || value?.confirmed === true || value === true || value === 'confirmed';
}
