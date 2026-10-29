/**
 * The seam between WhaleGo and the native Flutter app.
 *
 * The v1.2 bridge exposes audio / voice / micro / overlay. A conversation voice
 * line, a native orb, a settings host and a streaming audio channel are not in
 * that contract yet, so every optional method is feature-detected here. When the
 * native side lands one, this file calls it; nothing else in the plugin changes.
 */
function readDshGo(ctx) {
  try {
    const value = ctx?.dshGo;
    if (value) return value;
  } catch {
    /* not injected into this context */
  }
  try {
    return ctx?.get?.('dshGo');
  } catch {
    return undefined;
  }
}

export class NativeSeam {
  #bridge;
  #caps;
  #declared;

  constructor(ctx) {
    // Cordis throws on an undeclared service property, so resolve dshGo both ways.
    const dshGo = readDshGo(ctx);
    this.#bridge = dshGo?.native ?? dshGo;
    this.#declared = Array.isArray(dshGo?.capabilities) ? [...dshGo.capabilities] : [];
    this.#caps = {
      voiceLine: typeof this.#bridge?.voiceLine === 'function',
      orb: typeof this.#bridge?.orb === 'function',
      settings: typeof this.#bridge?.settings === 'function',
      audioStream: typeof this.#bridge?.audioStream === 'function',
      voiceSession: typeof this.#bridge?.voice === 'function',
    };
  }

  get caps() {
    return { ...this.#caps };
  }

  get available() {
    return Object.values(this.#caps).some(Boolean);
  }

  get count() {
    return Object.values(this.#caps).filter(Boolean).length;
  }

  get declared() {
    return [...this.#declared];
  }

  get bridge() {
    return this.#bridge;
  }

  /** Ask the host to append or update one streamed voice line. */
  async appendVoiceLine(payload) {
    if (!this.#caps.voiceLine) return false;
    try {
      await this.#bridge.voiceLine(payload);
      return true;
    } catch {
      return false;
    }
  }

  /** Show, hide or restyle the native floating orb. */
  async setOrb(payload) {
    if (!this.#caps.orb) return false;
    try {
      await this.#bridge.orb(payload);
      return true;
    } catch {
      return false;
    }
  }

  /** Hand the native settings page a schema. */
  async registerSettings(schema) {
    if (!this.#caps.settings) return false;
    try {
      await this.#bridge.settings(schema);
      return true;
    } catch {
      return false;
    }
  }

  /** Open a chunked audio channel for a long spoken answer. */
  openAudioStream(options) {
    if (!this.#caps.audioStream) return null;
    try {
      return this.#bridge.audioStream(options);
    } catch {
      return null;
    }
  }

  /** Open a hands-free voice session. */
  openVoiceSession(options) {
    if (!this.#caps.voiceSession) return null;
    try {
      return this.#bridge.voice(options);
    } catch {
      return null;
    }
  }

  diagnostics() {
    return {
      declared: this.declared,
      native: this.caps,
      count: this.count,
      available: this.available,
    };
  }
}
