/** Real-key voice-brain prompt smoke: same system prompt, real model. */
import { buildVoiceMessages } from '../../lib/prompts.js';
import { runDsh } from './headless.mjs';

export async function runVoiceSmoke() {
  const question = '用一句话说明鲸鱼靠什么交流。';
  const { system } = buildVoiceMessages({ question, filler: '我想想。' });
  const prompt = [
    '下面是一段系统要求。请严格照它回答用户的问题，只输出答案，不要解释。',
    '',
    system,
    '',
    `问题：${question}`,
  ].join('\n');
  const started = Date.now();
  const result = await runDsh(prompt, null, 120000);
  const final = result.events.findLast?.((e) => e.type === 'final')?.text ?? '';
  const clean = final.trim();
  const chinese = /[\u4e00-\u9fff]/.test(clean);
  return {
    name: 'voice-prompt',
    ok: result.code === 0 && chinese && clean.length > 0 && clean.length <= 220,
    chars: clean.length,
    ms: Date.now() - started,
    chinese,
    preview: clean.slice(0, 120),
  };
}
