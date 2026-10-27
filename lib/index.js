/** WhaleGo host plugin: two brains, one voice. */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerActions } from './actions.js';
import { WhaleEngine } from './engine.js';
import { registerPanels } from './panels.js';
import { dshHome, loadPrefs } from './prefs.js';
import { registerRoutes } from './routes.js';
import { TranscriptStore } from './transcript.js';

export const name = 'whalego';

export function apply(ctx, _config = {}) {
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
