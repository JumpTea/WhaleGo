/** Brand constants and the pixel-whale mark, embedded as a data URI. */
import { readFileSync } from 'node:fs';

export const BRAND = Object.freeze({
  name: '鲸语',
  english: 'WhaleGo',
  tagline: '先听见，再看见。',
  line: 'Hear it first. Read it after.',
  story: '鲸鱼靠声呐和鲸歌交流；whale 也是 DeepSeek 的意象。鲸语把这两件事放进 DSH-Go：语音脑先说，文字脑再写。',
  repo: 'https://github.com/JumpTea/WhaleGo',
});

const FALLBACK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
let cached;

export function logoDataUri() {
  if (cached) return cached;
  try {
    const bytes = readFileSync(new URL('../assets/brand/pixel-whale-128.png', import.meta.url));
    cached = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch {
    cached = FALLBACK;
  }
  return cached;
}
