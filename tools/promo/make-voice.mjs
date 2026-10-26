#!/usr/bin/env node
/** Generate the narration and demo lines for the promo. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { synthesize } from '../../lib/tts/edge.js';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'promo', 'voice');
const NARRATOR = 'zh-CN-XiaoxiaoNeural';
const WHALE = 'zh-CN-YunxiNeural';

const lines = [
  ['01-problem', '有些问题，一句话说不清。', NARRATOR, '-4%'],
  ['02-tradeoff', '说得快，往往说得浅；写得好，又来得太慢。', NARRATOR, '-4%'],
  ['03-dual', '鲸语让两个脑子同时工作。一个先说，一个后写。', NARRATOR, '-4%'],
  ['04-stream', '语音在会话里生长，文字答案紧随其下。', NARRATOR, '-4%'],
  ['05-interrupt', '它不等你听完，也不打断你说话。', NARRATOR, '-4%'],
  ['06-native', '悬浮球、声音、设置，都交给原生。', NARRATOR, '-4%'],
  ['07-whale', '鲸鱼用声呐辨认方向，用鲸歌交换消息。', NARRATOR, '-6%'],
  ['08-deepseek', 'Whale 是 DeepSeek 的意象，Go 是 DSH-Go。', NARRATOR, '-6%'],
  ['09-tagline', '先听见，再见。', NARRATOR, '-8%'],
  ['10-end', '鲸语 WhaleGo，MIT 开源。', NARRATOR, '-4%'],
  ['d1-think', '我想想。', WHALE, '+0%'],
  ['d2-check', '行，我来查查。', WHALE, '+0%'],
  ['d3-simple', '今天适合做一点轻的事，先把最重要的一件完成。', WHALE, '+0%'],
];

await mkdir(OUT, { recursive: true });
for (const [id, text, voice, rate] of lines) {
  let result = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      result = await synthesize({ text, voice, rate });
      break;
    } catch (error) {
      lastError = error;
      console.warn(`${id}: attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  if (!result) throw lastError;
  await writeFile(join(OUT, `${id}.mp3`), result.audio);
  console.log(`${id}\t${result.audio.length}\t${result.totalMs}ms\t${text}`);
  await new Promise((resolve) => setTimeout(resolve, 700));
}
