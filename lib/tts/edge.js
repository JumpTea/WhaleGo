/**
 * WhaleGo — Edge read-aloud TTS transport.
 *
 * Adapted from Voice-Nebula (MIT); see NOTICE.
 * The Microsoft Edge "read aloud" endpoint is a free, no-key neural TTS service.
 * Transport facts (verified 2026-10-23 on this machine, Node v24.20.0):
 *   - endpoint  wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1
 *   - auth       ?Ocp-Apim-Subscription-Key=<trusted client token>
 *   - anti-abuse ?Sec-MS-GEC=<sha256(winTicks + token)> + Sec-MS-GEC-Version
 *   - headers    a Chrome/Edge user agent and the Edge extension origin
 *   - Node's built-in WebSocket accepts a `{ headers }` extension object, so this
 *     transport needs zero third-party dependencies.
 *   - one connection can synthesise many turns; afterwards the first audio packet
 *     lands in ~250-400 ms (measured). Connection setup costs ~500 ms, so the
 *     session keeps the socket warm.
 *   - only compressed output formats are accepted (`riff-*` is rejected with
 *     "Unsupported Edge output format"), so audio is mp3 and the browser decodes
 *     it with `AudioContext.decodeAudioData`.
 *
 * @module whalego/edge
 */
import { createHash, randomUUID } from 'node:crypto';

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WS_URL = 'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const GEC_VERSION = '1-143.0.3650.96';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold';
const DELIM = '\r\n\r\n';

/** Default streaming format: 24 kHz mono mp3 at 48 kbps (≈6 kB/s). */
export const EDGE_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

/**
 * Available Chinese voices on the free endpoint (verified against the voice list).
 * `dialect` drives the UI picker; `gender` and `tone` are display hints only.
 */
export const EDGE_VOICES = Object.freeze([
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 普通话 · 女声', lang: 'zh-CN', dialect: 'mandarin', gender: 'female', tone: '温暖' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊 · 普通话 · 女声', lang: 'zh-CN', dialect: 'mandarin', gender: 'female', tone: '清亮' },
  { id: 'zh-CN-YunxiNeural', label: '云希 · 普通话 · 男声', lang: 'zh-CN', dialect: 'mandarin', gender: 'male', tone: '年轻' },
  { id: 'zh-CN-YunjianNeural', label: '云健 · 普通话 · 男声', lang: 'zh-CN', dialect: 'mandarin', gender: 'male', tone: '浑厚' },
  { id: 'zh-CN-YunyangNeural', label: '云扬 · 普通话 · 男声', lang: 'zh-CN', dialect: 'mandarin', gender: 'male', tone: '播音' },
  { id: 'zh-CN-YunxiaNeural', label: '云夏 · 普通话 · 少年', lang: 'zh-CN', dialect: 'mandarin', gender: 'male', tone: '少年' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北 · 东北话 · 女声', lang: 'zh-CN', dialect: 'liaoning', gender: 'female', tone: '爽利' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', label: '晓妮 · 陕西话 · 女声', lang: 'zh-CN', dialect: 'shaanxi', gender: 'female', tone: '泼辣' },
  { id: 'zh-HK-HiuMaanNeural', label: '曉曼 · 粤语 · 女声', lang: 'zh-HK', dialect: 'cantonese', gender: 'female', tone: '柔和' },
  { id: 'zh-HK-WanLungNeural', label: '雲龍 · 粤语 · 男声', lang: 'zh-HK', dialect: 'cantonese', gender: 'male', tone: '稳重' },
  { id: 'zh-TW-HsiaoChenNeural', label: '曉臻 · 台湾国语 · 女声', lang: 'zh-TW', dialect: 'taiwan', gender: 'female', tone: '甜' },
  { id: 'zh-TW-YunJheNeural', label: '雲哲 · 台湾国语 · 男声', lang: 'zh-TW', dialect: 'taiwan', gender: 'male', tone: '沉稳' },
]);

/** Dialects the free endpoint can pronounce (everything else falls back to Mandarin). */
export const EDGE_DIALECTS = Object.freeze({
  mandarin: { label: '普通话', voice: 'zh-CN-XiaoxiaoNeural', available: true },
  liaoning: { label: '东北话', voice: 'zh-CN-liaoning-XiaobeiNeural', available: true },
  shaanxi: { label: '陕西话', voice: 'zh-CN-shaanxi-XiaoniNeural', available: true },
  cantonese: { label: '粤语', voice: 'zh-HK-HiuMaanNeural', available: true },
  taiwan: { label: '台湾国语', voice: 'zh-TW-HsiaoChenNeural', available: true },
  sichuan: { label: '四川话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  henan: { label: '河南话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  shandong: { label: '山东话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  guangxi: { label: '广西口音', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  shanghai: { label: '上海话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  minnan: { label: '闽南语', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  beijing: { label: '北京话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
  tianjin: { label: '天津话', voice: 'zh-CN-XiaoxiaoNeural', available: false },
});

/**
 * Emotion presets expressed through prosody, because the free endpoint rejects
 * `mstts:express-as`. Paid engines map the same emotion ids onto real styles.
 */
export const EDGE_EMOTIONS = Object.freeze({
  neutral: { label: '自然', rate: '+0%', pitch: '+0Hz', volume: '+0%' },
  cheerful: { label: '愉快', rate: '+8%', pitch: '+2Hz', volume: '+0%' },
  gentle: { label: '温柔', rate: '-4%', pitch: '-1Hz', volume: '-4%' },
  serious: { label: '严肃', rate: '-6%', pitch: '-2Hz', volume: '+0%' },
  sad: { label: '低落', rate: '-12%', pitch: '-3Hz', volume: '-8%' },
  excited: { label: '兴奋', rate: '+14%', pitch: '+3Hz', volume: '+4%' },
  assistant: { label: '助理', rate: '+2%', pitch: '+1Hz', volume: '+0%' },
});

/** Windows FILETIME ticks for `nowMs`, floored to the 5-minute GEC bucket. */
export function secMsGec(nowMs = Date.now(), offsetMs = 0) {
  const seconds = Math.floor((nowMs + offsetMs) / 1000) + 11644473600;
  const rounded = seconds - (seconds % 300);
  const ticks = rounded * 10000000;
  return createHash('sha256').update(`${ticks}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase();
}

/** Build the authenticated websocket URL. */
export function buildWsUrl({ nowMs = Date.now(), offsetMs = 0, connectionId = randomUUID() } = {}) {
  const gec = secMsGec(nowMs, offsetMs);
  return (
    `${WS_URL}?Ocp-Apim-Subscription-Key=${encodeURIComponent(TRUSTED_CLIENT_TOKEN)}` +
    `&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${connectionId}`
  );
}

/** Escape text for SSML content. */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build the SSML document for one turn. */
export function buildSsml({ text, voice = 'zh-CN-XiaoxiaoNeural', lang = 'zh-CN', rate = '+0%', pitch = '+0Hz', volume = '+0%' }) {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${escapeXml(lang)}">` +
    `<voice name="${escapeXml(voice)}">` +
    `<prosody pitch="${escapeXml(pitch)}" rate="${escapeXml(rate)}" volume="${escapeXml(volume)}">${escapeXml(text)}</prosody>` +
    `</voice></speak>`
  );
}

/**
 * Resolve the voice to use.
 *
 * Precedence: explicit `voiceId` → the dialect's own voice (so switching the
 * dialect actually changes the sound, req. e) → configured default voice →
 * Mandarin default.
 */
export function resolveVoice({ dialect = 'mandarin', voiceId, voice } = {}) {
  const find = (id) => EDGE_VOICES.find((entry) => entry.id === id);
  if (voiceId) {
    const explicit = find(voiceId);
    if (explicit) return explicit;
  }
  const preset = EDGE_DIALECTS[dialect];
  if (dialect && dialect !== 'mandarin' && preset?.available && preset.voice) {
    const dialectVoice = find(preset.voice);
    if (dialectVoice) return dialectVoice;
  }
  if (voice) {
    const configured = find(voice);
    if (configured) return configured;
  }
  return find(preset?.voice) ?? EDGE_VOICES[0];
}

/** Merge an emotion id with explicit prosody overrides. */
export function resolveProsody({ emotion = 'neutral', rate, pitch, volume } = {}) {
  const base = EDGE_EMOTIONS[emotion] ?? EDGE_EMOTIONS.neutral;
  // Empty strings mean "use the emotion preset"; Edge rejects empty prosody
  // attribute values with `1007 SSML is invalid`.
  const pick = (value, fallback) => (typeof value === 'string' && value.trim() ? value : fallback);
  return {
    rate: pick(rate, base.rate),
    pitch: pick(pitch, base.pitch),
    volume: pick(volume, base.volume),
  };
}

/** Read one JSON metadata frame into `{ words }`. */
export function parseMetadataFrame(buffer) {
  const start = buffer.indexOf(DELIM);
  if (start < 0) return { words: [] };
  let payload;
  try {
    payload = JSON.parse(buffer.subarray(start + DELIM.length).toString('utf8'));
  } catch {
    return { words: [] };
  }
  const words = [];
  for (const item of payload.Metadata ?? []) {
    if (item?.Type !== 'WordBoundary') continue;
    const data = item.Data ?? {};
    words.push({
      text: data.text?.Text ?? '',
      offsetMs: Math.round((data.Offset ?? 0) / 10000),
      durationMs: Math.round((data.Duration ?? 0) / 10000),
    });
  }
  return { words };
}

/**
 * One warm Edge websocket connection that can synthesise turn after turn.
 */
export class EdgeConnection {
  #ws = null;
  #connecting = null;
  #clockOffsetMs = 0;
  #connectTimeoutMs;
  #turnTimeoutMs;
  #closed = false;

  constructor({ connectTimeoutMs = 8000, turnTimeoutMs = 20000 } = {}) {
    this.#connectTimeoutMs = connectTimeoutMs;
    this.#turnTimeoutMs = turnTimeoutMs;
  }

  get isOpen() {
    return this.#ws !== null && this.#ws.readyState === 1;
  }

  /** Open (or reuse) the websocket. */
  async connect() {
    if (this.isOpen) return this;
    if (this.#connecting) return this.#connecting;
    this.#connecting = this.#open().finally(() => {
      this.#connecting = null;
    });
    return this.#connecting;
  }

  async #open() {
    if (typeof globalThis.WebSocket !== 'function') {
      throw new Error('WhaleGo needs Node ≥ 22 for the built-in WebSocket');
    }
    const ws = new globalThis.WebSocket(buildWsUrl({ offsetMs: this.#clockOffsetMs }), {
      headers: { 'User-Agent': USER_AGENT, Origin: ORIGIN },
    });
    ws.binaryType = 'arraybuffer';
    this.#ws = ws;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Edge TTS connect timed out')), this.#connectTimeoutMs);
      const done = (fn, value) => {
        clearTimeout(timer);
        fn(value);
      };
      ws.addEventListener('open', () => done(resolve, undefined), { once: true });
      ws.addEventListener(
        'error',
        (event) => {
          // Node's WebSocket reports handshake failures through `error`; the
          // status code lives on `event.error` / `event.message` depending on runtime.
          const message = event?.message ?? event?.error?.message ?? 'Edge TTS connection failed';
          done(reject, new Error(message));
        },
        { once: true },
      );
      ws.addEventListener(
        'close',
        (event) => {
          if (ws.readyState !== 1) done(reject, new Error(`Edge TTS closed (${event.code} ${event.reason})`));
        },
        { once: true },
      );
    });
    return this;
  }

  /**
   * Synthesise one turn.
   *
   * @param {object} options
   * @param {string} options.text
   * @param {string} [options.voice]
   * @param {string} [options.lang]
   * @param {string} [options.rate]
   * @param {string} [options.pitch]
   * @param {string} [options.volume]
   * @param {string} [options.format]
   * @param {AbortSignal} [options.signal]
   * @param {(chunk: Buffer) => void} [options.onAudio]
   * @param {(word: { text: string, offsetMs: number, durationMs: number }) => void} [options.onWord]
   * @param {() => void} [options.onStart]
   */
  async speak({
    text,
    voice = 'zh-CN-XiaoxiaoNeural',
    lang = 'zh-CN',
    rate = '+0%',
    pitch = '+0Hz',
    volume = '+0%',
    format = EDGE_FORMAT,
    signal,
    onAudio,
    onWord,
    onStart,
  }) {
    if (!text || !text.trim()) throw new Error('Edge TTS needs non-empty text');
    await this.connect();
    const ws = this.#ws;
    if (!ws || ws.readyState !== 1) throw new Error('Edge TTS socket is not open');
    if (this.#clockOffsetMs && ws.__voiceNebulaClockAge !== true) ws.__voiceNebulaClockAge = true;

    const requestId = randomUUID().replace(/-/g, '');
    const started = Date.now();
    let firstChunkMs = 0;
    let bytes = 0;
    let wordCount = 0;
    const chunks = [];

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(turnTimer);
        cleanup();
        fn(value);
      };
      const fail = (error) => finish(reject, error);

      const turnTimer = setTimeout(
        () => fail(new Error(`Edge TTS turn timed out after ${this.#turnTimeoutMs} ms`)),
        this.#turnTimeoutMs,
      );
      const onAbort = () => {
        // Closing the socket is the only reliable way to stop audio generation.
        this.close();
        fail(Object.assign(new Error('Edge TTS aborted'), { name: 'AbortError' }));
      };
      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        ws.removeEventListener('message', onMessage);
        ws.removeEventListener('close', onClose);
      };
      const onClose = (event) => {
        fail(new Error(`Edge TTS socket closed mid-turn (${event.code} ${event.reason})`));
      };
      const onMessage = (event) => {
        const buffer = Buffer.isBuffer(event.data) ? event.data : Buffer.from(event.data);
        const head = buffer.toString('utf8', 0, Math.min(buffer.length, 512));
        if (head.includes('Path:turn.start')) {
          onStart?.();
          return;
        }
        if (head.includes('Path:turn.end')) {
          const audio = Buffer.concat(chunks);
          finish(resolve, { bytes, wordCount, firstChunkMs, totalMs: Date.now() - started, format, audio });
          return;
        }
        if (head.includes('Path:error')) {
          let detail = head;
          try {
            const body = JSON.parse(buffer.subarray(buffer.indexOf(DELIM) + DELIM.length).toString('utf8'));
            detail = body.error?.message ?? body.error?.code ?? JSON.stringify(body);
          } catch {
            /* keep raw head */
          }
          fail(new Error(`Edge TTS error: ${detail}`));
          return;
        }
        if (head.includes('Path:audio.metadata')) {
          const { words } = parseMetadataFrame(buffer);
          for (const word of words) {
            wordCount += 1;
            onWord?.(word);
          }
          return;
        }
        if (head.includes('Path:audio')) {
          const index = buffer.indexOf('Path:audio\r\n');
          if (index < 0) return;
          const chunk = buffer.subarray(index + 'Path:audio\r\n'.length);
          if (chunk.length === 0) return;
          chunks.push(chunk);
          bytes += chunk.length;
          if (!firstChunkMs) firstChunkMs = Date.now() - started;
          onAudio?.(chunk);
        }
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', onClose);

      try {
        ws.send(
          'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
            JSON.stringify({
              context: {
                synthesis: {
                  audio: {
                    metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'true' },
                    outputFormat: format,
                  },
                },
              },
            }),
        );
        ws.send(
          `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml${DELIM}` +
            buildSsml({ text, voice, lang, rate, pitch, volume }),
        );
      } catch (error) {
        fail(error);
      }
    });
  }

  /** Close the socket (idempotent). */
  close() {
    this.#closed = true;
    const ws = this.#ws;
    this.#ws = null;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }
  }
}

/** Convenience one-shot synthesis (opens and closes its own connection). */
export async function synthesize(options) {
  const connection = new EdgeConnection();
  try {
    return await connection.speak(options);
  } finally {
    connection.close();
  }
}

export const edgeEngine = Object.freeze({
  id: 'edge',
  label: 'Edge 朗读（免费，无需 Key）',
  voices: EDGE_VOICES,
  dialects: EDGE_DIALECTS,
  emotions: EDGE_EMOTIONS,
  format: EDGE_FORMAT,
  resolveVoice,
  resolveProsody,
  createConnection: (options) => new EdgeConnection(options),
  synthesize,
});
