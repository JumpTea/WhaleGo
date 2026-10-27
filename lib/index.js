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
    const dshGo = scoped?.dshGo ?? scoped?.get?.('dshGo');
    if (!dshGo) {
      logger.warn?.('[whalego] dshGo service is missing; nothing mounted.');
      return;
    }
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
    const engine = new WhaleEngine({ ctx: scoped, prefs, transcript, logger });
    trace('engine');

    registerPanels(scoped, dshGo, engine, prefs, transcript, { logger });
    trace('panels');
    registerActions(scoped, dshGo, engine);
    trace('actions');
    const routes = registerRoutes(scoped, engine);
    trace('routes');

    effect(scoped, () => routes, 'whalego: health route');
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
            void engine.ask({ draft: question, sessionId });
          }),
        'whalego: demo trigger',
      );
    }

    logger.info?.('[whalego] mounted: transcript line, two brains, Edge TTS.');
  };

  // dsh-go always ships these core services; sessions + llm are what the two
  // brains read, and attachments lets a finished line carry its mp3.
  if (typeof ctx.inject === 'function') ctx.inject(['dshGo', 'attachments', 'sessions', 'llm'], mount);
  else if (ctx.dshGo) mount(ctx);
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

function makeLogger(ctx) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('whalego') : ctx.logger;
    if (logger && typeof logger.info === 'function') return logger;
  } catch {
    /* fall through */
  }
  return console;
}
