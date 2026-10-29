/** Voice-brain prompt, speech cleanup and complexity rules. */

export const MODES = Object.freeze(['auto', 'dual', 'read', 'voice']);
export const VOICES = Object.freeze(['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-XiaoyiNeural']);
export const RATES = Object.freeze(['slow', 'normal', 'fast']);
export const FILLERS = Object.freeze(['我想想。', '嗯，我看看。', '']);
export const ORB_STYLES = Object.freeze(['pixel-whale', 'sonar', 'minimal', 'off']);
export const ORB_SIZES = Object.freeze(['s', 'm', 'l']);
export const ORB_IDLES = Object.freeze(['swim', 'breathe', 'none']);
export const THINK_ORBS = Object.freeze(['corner', 'center']);
export const HISTORY_TURNS = Object.freeze([4, 6, 10]);

/** Strong "the user wants a written answer" signals (see docs/专题-A-B双段输出.md §1.3). */
const STRONG = /搜索|查一下|查找|整理|对比|比较|排名|榜单|数据|表格|文件|报告|总结|分析|方案|计划|调研|帮我写|帮我改|帮我做|部署|安装|翻译|发一下|删掉|生成|是什么|区别|原理|举例|详细|展开讲|优缺点|选哪个|推荐|值不值|怎么办|报错|代码|函数|接口|bug|异常|日志|为什么|如何|怎么/;

/** Pure social noise: never worth a written answer. */
const CASUAL = /^(你好|您好|在吗|在不在|谢谢|谢了|好的|好|行|嗯+|哈哈+|晚安|早安|早|拜拜|再见)[呀啊哦哈。！!~～ ]*$/;

/** Follow-ups that inherit the previous turn's complexity. */
const FOLLOW_UP = /继续|然后|接着|第二|第三|还有|再说|详细点|展开|再讲/;

/**
 * Decide whether a question deserves the written (B) answer.
 * `previous` is the previous turn's verdict, so a follow-up cannot drop to
 * voice-only just because it is short.
 */
export function complexityOf(question, previous = 'simple') {
  const text = String(question ?? '').trim();
  if (!text) return 'simple';
  if (CASUAL.test(text)) return 'simple';
  if (STRONG.test(text)) return 'complex';
  if (text.length >= 24) return 'complex';
  if (text.length >= 15 && /[?？]/.test(text)) return 'complex';
  if (previous === 'complex' && FOLLOW_UP.test(text)) return 'complex';
  return 'simple';
}

export function stripForSpeech(text) {
  let output = String(text ?? '');
  output = output.replace(/```[\s\S]*?```/g, ' 代码略过。 ');
  output = output.replace(/`([^`]*)`/g, '$1');
  output = output.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  output = output.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  output = output.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  output = output.replace(/^\s{0,3}[-*+]\s+/gm, '');
  output = output.replace(/^\s{0,3}\d+[.)]\s+/gm, '');
  output = output.replace(/^\s*\|.*\|\s*$/gm, '');
  output = output.replace(/^\s*>\s?/gm, '');
  output = output.replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1');
  output = output.replace(/<[^>]+>/g, '');
  output = output.replace(/\[\d+\]/g, '');
  output = output.replace(/\s+/g, ' ').trim();
  return output;
}

export function cutAtBoundary(text, max) {
  const source = String(text ?? '').trim();
  if (source.length <= max) return source;
  const window = source.slice(0, max);
  const candidates = [
    window.lastIndexOf('。'),
    window.lastIndexOf('！'),
    window.lastIndexOf('？'),
    window.lastIndexOf('；'),
    window.lastIndexOf('，'),
    window.lastIndexOf(' '),
    window.lastIndexOf('\n'),
  ];
  const cut = Math.max(...candidates);
  if (cut >= Math.floor(max * 0.5)) return `${window.slice(0, cut + 1).trim()}…`;
  return `${window.trim()}…`;
}

export function spokenOf(text, maxChars = 180) {
  const cleaned = stripForSpeech(text);
  if (!cleaned) return '这个我没把握。';
  return cutAtBoundary(cleaned, maxChars);
}

/** Return complete, TTS-ready clauses as soon as a live answer exposes them. */
export function splitSpeakable(text, offset = 0, { final = false, maxLength = 36 } = {}) {
  const chars = Array.from(String(text ?? ''));
  let cursor = Math.max(0, Math.min(chars.length, Math.trunc(Number(offset) || 0)));
  const segments = [];

  while (cursor < chars.length) {
    let end = cursor;
    for (let index = cursor; index < chars.length; index += 1) {
      const length = index - cursor + 1;
      const char = chars[index];
      if (length >= 4 && /[。！？；!?;\n]/u.test(char)) {
        end = index + 1;
        break;
      }
      if (length >= 18 && /[，,]/u.test(char)) {
        end = index + 1;
        break;
      }
      if (length >= maxLength) {
        end = index + 1;
        break;
      }
    }
    if (end === cursor) break;
    const segment = chars.slice(cursor, end).join('').trim();
    if (segment) segments.push(segment);
    cursor = end;
  }

  if (final) {
    const remainder = chars.slice(cursor).join('').trim();
    if (remainder) segments.push(remainder);
    cursor = chars.length;
  }
  return { segments, cursor };
}

export function rateToProsody(rate) {
  if (rate === 'slow') return '-10%';
  if (rate === 'fast') return '+15%';
  return '+0%';
}

export function buildVoiceSystem(filler) {
  const fillerRule = filler
    ? `- 复杂问题先用一句「${filler}」再答；简单问题直接答。`
    : '- 不要用口头禅，直接答。';
  return [
    '你是鲸语的语音脑。只负责把结论讲给人听。',
    fillerRule,
    '- 1–3 句，最多 180 字；先结论，再一个理由。',
    '- 不念 Markdown、表格、链接、编号；数字照说。',
    '- 遇到读写文件、执行命令、改代码：只说「这个我让文字助手直接做」，不要提「没有工具」这类话，也不要编造执行结果。',
    '- 不确定就说「这个我没把握」。',
  ].join('\n');
}

export function buildVoiceMessages({ question, history = [], filler = '我想想。' }) {
  const recent = history
    .filter(Boolean)
    .slice(-6)
    .map((line) => truncateLine(line, 280))
    .join('\n');
  const context = recent ? `\n\n最近对话（只作参考，不要复述）：\n${recent}` : '';
  return {
    system: buildVoiceSystem(filler),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: `问题：${String(question ?? '').trim()}${context}` }],
      },
    ],
  };
}

function truncateLine(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * The written brain (B). It never re-answers from scratch: it expands the
 * spoken line that was just delivered, so the two can never contradict.
 */
export function buildWrittenMessages({ question, spoken, history = [] }) {
  const recent = history
    .filter(Boolean)
    .slice(-4)
    .map((line) => truncateLine(line, 200))
    .join('\n');
  const context = recent ? `\n\n之前对话（只作参考）：\n${recent}` : '';
  return {
    system: [
      '你是鲸语的文字脑，负责把已经说出口的回答展开成完整书面答案。',
      '- 以「刚才说过的」为准，不要改变结论，也不要重复它的措辞。',
      '- 用 Markdown，结构化，可以给步骤、要点、例子。',
      '- 不要写「我刚才说过」，直接给内容。',
      '- 不要念 Markdown 标记，这是给人看的。',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `问题：${String(question ?? '').trim()}\n\n刚才说过的：${String(spoken ?? '').trim()}${context}`,
          },
        ],
      },
    ],
  };
}
