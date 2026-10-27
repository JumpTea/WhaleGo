/** WhaleGo host plugin: two brains, one voice. */
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
    const dshGo = scoped?.dshGo ?? scoped?.get?.('dshGo');
    if (!dshGo) {
      logger.warn?.('[whalego] dshGo service is missing; nothing mounted.');
      return;
    }

    const prefs = loadPrefs({ logger });
    const transcript = new TranscriptStore({
      file: join(dshHome(), 'whalego', 'transcript.json'),
      logger,
    });
    const engine = new WhaleEngine({ ctx: scoped, prefs, transcript, logger });

    registerPanels(scoped, dshGo, engine, prefs, transcript, { logger });
    registerActions(scoped, dshGo, engine);
    const routes = registerRoutes(scoped, engine);

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

    logger.info?.('[whalego] mounted: transcript line, two brains, Edge TTS.');
  };

  // dsh-go always ships the attachment store; requiring it lets a finished
  // voice line carry its mp3 so the chat row can replay it later.
  if (typeof ctx.inject === 'function') ctx.inject(['dshGo', 'attachments'], mount);
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
