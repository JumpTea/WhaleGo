/** WhaleGo host plugin: two brains, one voice. */
import Schema from '@deepseek-ai/schemastery';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { startBrowserBridge, stopBrowserBridge, resolveWebOrigin } from './browserBridge.js';
import { join } from 'node:path';
import { registerActions } from './actions.js';
import { WhaleEngine } from './engine.js';
import { registerPanels } from './panels.js';
import { dshHome, loadPrefs } from './prefs.js';
import { registerRoutes } from './routes.js';
import { TranscriptStore } from './transcript.js';

export const name = 'whalego';

/**
 * Plugin config rendered natively by the dsh-go plugin page (Cordis schema).
 * Values only override a preference when they differ from the schema default,
 * so the in-page sheet and the native form can coexist.
 */
export const Config = Schema.object({
  mode: Schema.union(['auto', 'dual', 'voice', 'read']).default('auto').description('双脑模式'),
  voice: Schema.union(['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-XiaoyiNeural'])
    .default('zh-CN-XiaoxiaoNeural')
    .description('音色'),
  rate: Schema.union(['slow', 'normal', 'fast']).default('normal').description('语速'),
  thinkOrb: Schema.union(['corner', 'center']).default('corner').description('思考时悬浮球的位置'),
  filler: Schema.union(['我想想。', '嗯，我看看。', '']).default('我想想。').description('思考前的过渡语'),
});

const CONFIG_DEFAULTS = Object.freeze({
  mode: 'auto',
  voice: 'zh-CN-XiaoxiaoNeural',
  rate: 'normal',
  thinkOrb: 'corner',
  filler: '我想想。',
});

/** Apply only values the user actually changed in the native form. */
function applyConfig(prefs, config) {
  if (!config || typeof config !== 'object') return;
  for (const [key, fallback] of Object.entries(CONFIG_DEFAULTS)) {
    const value = config[key];
    if (value === undefined || value === fallback) continue;
    prefs[key] = value;
  }
}

export function apply(ctx, config = {}) {
  const logger = makeLogger(ctx);

  const mount = (scoped) => {
    try {
      writeFileSync(join(dshHome(), 'whalego', 'mount.log'), `${new Date().toISOString()}\n`, 'utf8');
    } catch {
      /* lab trace only */
    }
    let dshGo;
    try {
      dshGo = typeof scoped?.get === 'function' ? scoped.get('dshGo') : scoped?.dshGo;
    } catch {
      dshGo = undefined;
    }
    // The web half must run even on a plain DSH web profile where the native
    // bridge is absent; only the voice-turn endpoint needs the engine.
    let engine = null;
    const startRoutes = (webCtx) => {
      console.log('[whalego] mounting web routes');
      return effect(scoped, () => registerRoutes(webCtx ?? scoped, () => engine), 'whalego: web routes');
    };
    if (typeof scoped.inject === 'function') scoped.inject(['webServer'], startRoutes);
    else startRoutes(scoped);
    const trace = (step) => {
      try {
        appendFileSync(join(dshHome(), 'whalego', 'mount-trace.log'), `${new Date().toISOString()} ${step}\n`, 'utf8');
      } catch {
        /* lab trace only */
      }
    };
    trace('dshGo');

    const prefs = loadPrefs({ logger });
    applyConfig(prefs, config);
    trace('prefs');
    const transcript = new TranscriptStore({
      file: join(dshHome(), 'whalego', 'transcript.json'),
      logger,
    });
    trace('transcript');
    // A plain web profile may still expose a stub `dshGo`; only a real native
    // bridge (voiceLine/audioStream/…) makes the App-side seams usable.
    let nativeBridge = null;
    try {
      nativeBridge = dshGo ? (dshGo.native ?? dshGo) : null;
    } catch {
      nativeBridge = null;
    }
    const hasNative = Boolean(nativeBridge) && typeof nativeBridge.voiceLine === 'function';
    engine = new WhaleEngine({
      ctx: scoped,
      prefs,
      transcript,
      logger,
      seam: hasNative ? undefined : nullSeam(),
      webMode: !hasNative,
    });
    trace('engine');
    if (dshGo) {
      registerPanels(scoped, dshGo, engine, prefs, transcript, { logger });
      trace('panels');
      registerActions(scoped, dshGo, engine);
      trace('actions');
    } else {
      logger.warn?.('[whalego] dshGo service is missing; running the web half without native panels.');
    }
    // The browser entry needs the live web origin, so it starts once the web
    // server exists (the same injection the routes wait for).
    const startBridge = async (webCtx) => {
      if (prefs.browserEntry === 'off') return;
      try {
        const origin = await resolveWebOrigin(webCtx ?? scoped);
        startBrowserBridge({ home: dshHome(), webOrigin: origin });
        trace(`browser:${origin}`);
      } catch (error) {
        logger.warn?.(`[whalego] browser entry failed: ${String(error)}`);
      }
    };
    if (typeof scoped.inject === 'function') scoped.inject(['webServer'], (webCtx) => void startBridge(webCtx));
    else void startBridge(scoped);
    effect(scoped, () => () => stopBrowserBridge(), 'whalego: browser bridge');

    effect(
      scoped,
      () =>
        on(scoped, 'agent/assistant-stream', (payload) => {
          engine.onAssistantFrame(payload?.agent?.id, payload?.frame);
        }),
      'whalego: assistant stream',
    );
    effect(
      scoped,
      () =>
        on(scoped, 'session/event', (session, event) => {
          engine.onSessionEvent(session?.id ?? session?.sessionId, event);
        }),
      'whalego: session events',
    );
    effect(scoped, () => () => engine.dispose(), 'whalego: engine');

    const demoOn = existsSync(join(dshHome(), 'whalego', 'demo-on'));
    const demoSwitch = prefs.demoTrigger || demoOn;
    try {
      writeFileSync(
        join(dshHome(), 'whalego', 'demo-decision.log'),
        `home=${dshHome()} prefs=${prefs.demoTrigger} file=${demoOn} switch=${demoSwitch}\n`,
        'utf8',
      );
    } catch {
      /* lab trace only */
    }
    if (demoSwitch) {
      // No microphone on the emulator: a typed "语音演示：<问题>" runs the same
      // voice turn a spoken question would, so the whole line can be observed.
      try {
        const dir = join(dshHome(), 'whalego');
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'demo-armed'), `${Date.now()}\n`, 'utf8');
      } catch {
        /* lab marker only */
      }
      effect(
        scoped,
        () =>
          on(scoped, 'session/event', (session, event) => {
            if (event?.type !== 'user/message') return;
            const data = event.data ?? {};
            const message = data.message ?? {};
            const source = data.source ?? message.source ?? {};
            if (source.kind !== 'user') return;
            const content = Array.isArray(message.content)
              ? message.content
              : Array.isArray(data.content)
                ? data.content
                : [];
            const text = content
              .filter((block) => block?.type === 'text')
              .map((block) => block.text ?? '')
              .join('\n')
              .trim();
            const prefix = 'voice-demo:';
            if (!text.startsWith(prefix)) return;
            const question = text.slice(prefix.length).trim();
            const sessionId = session?.id ?? session?.sessionId;
            if (!question || !sessionId) return;
            logger.info?.(`[whalego] demo trigger: ${question}`);
            try {
              appendFileSync(
                join(dshHome(), 'whalego', 'demo-fired.log'),
                `${new Date().toISOString()} ${sessionId} ${question}\n`,
                'utf8',
              );
            } catch {
              /* lab trace only */
            }
            void engine.ask({ draft: question, sessionId, session });
          }),
        'whalego: demo trigger',
      );
    }

    logger.info?.('[whalego] mounted: transcript line, two brains, Edge TTS.');
  };

  // dsh-go always ships these core services; sessions + llm are what the two
  // brains read, and attachments lets a finished line carry its mp3.
  // Mount unconditionally: the web half (routes + client) has no native host,
  // and every optional service is looked up through ctx.get at use time.
  mount(ctx);
}

function effect(ctx, factory, label) {
  if (typeof ctx.effect === 'function') {
    try {
      return ctx.effect(factory, label);
    } catch {
      return factory();
    }
  }
  return factory();
}

function on(ctx, event, handler) {
  if (typeof ctx.on !== 'function') return () => {};
  try {
    return ctx.on(event, handler);
  } catch {
    return () => {};
  }
}

/** Seam used when the native bridge is absent (plain DSH web). */
function nullSeam() {
  return {
    caps: { voiceLine: false, orb: false, settings: false, audioStream: false, voiceSession: false },
    available: false,
    count: 0,
    declared: [],
    appendVoiceLine: async () => false,
    setOrb: async () => {},
    openAudioStream: () => null,
    openVoiceSession: () => null,
    diagnostics: () => ({ native: {} }),
  };
}

function makeLogger(ctx) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('whalego') : ctx.logger;
    if (logger && typeof logger.info === 'function') return logger;
  } catch {
    /* fall through */
  }
  return console;
}
