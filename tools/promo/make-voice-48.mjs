#!/usr/bin/env node
/** Generate the 48-second promo voice track, including the demo dialogue. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { synthesize } from '../../lib/tts/edge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'film', 'public', 'audio');
const NARRATOR = 'zh-CN-XiaoxiaoNeural';
const WHALE = 'zh-CN-YunxiNeural';

const lines = [
  ['v00-brand', 'WhaleGo。', NARRATOR, '-2%'],
  ['v01-problem', '一句话，说不清。', NARRATOR, '-4%'],
  ['v02-dual', '那就让两个脑子一起答。', NARRATOR, '-4%'],
  ['v03-voice', '语音先说，文字后写。', NARRATOR, '-4%'],
  ['v04-both', '答案还在写，语音已经在说。', NARRATOR, '-4%'],
  ['v05-stop', '打断就停。', NARRATOR, '-4%'],
  ['v06-native', '悬浮球、声音、设置，都交给原生。', NARRATOR, '-4%'],
  ['v07-orb', '四种悬浮球，随你挑。', NARRATOR, '-4%'],
  ['v08-thread', '转写不是字幕，是会话里的消息。', NARRATOR, '-4%'],
  ['v09-device', '手机、桌面，同一条会话。', NARRATOR, '-4%'],
  ['v10-tagline', 'WhaleGo。先听见，再见。', NARRATOR, '-6%'],
  ['v11-end', 'MIT 开源。在 GitHub 搜 WhaleGo。', NARRATOR, '-4%'],
  ['u01-ask', '帮我查一下 2026 年大模型排行。', WHALE, '+2%'],
  ['d01-check', '行，我来查查。', WHALE, '+2%'],
  ['u02-turn', '等等，换个方向。', WHALE, '+2%'],
];

await mkdir(OUT, { recursive: true });
for (const [id, text, voice, rate] of lines) {
  let result = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      result = await synthesize({ text, voice, rate });
      break;
    } catch (error) {
      lastError = error;
      console.warn(`${id}: attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (!result) throw lastError;
  await writeFile(join(OUT, `${id}.mp3`), result.audio);
  console.log(`${id}\t${result.audio.length}\t${result.totalMs}ms\t${text}`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}
