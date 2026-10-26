/** Voice-brain prompt, speech cleanup and complexity rules. */

export const MODES = Object.freeze(['auto', 'dual', 'read']);
export const VOICES = Object.freeze(['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural', 'zh-CN-XiaoyiNeural']);
export const RATES = Object.freeze(['slow', 'normal', 'fast']);
export const FILLERS = Object.freeze(['我想想。', '嗯，我看看。', '']);
export const ORB_STYLES = Object.freeze(['pixel-whale', 'sonar', 'minimal', 'off']);
export const ORB_SIZES = Object.freeze(['s', 'm', 'l']);
export const ORB_IDLES = Object.freeze(['swim', 'breathe', 'none']);
export const HISTORY_TURNS = Object.freeze([4, 6, 10]);

const COMPLEX = /搜索|查一下|查找|整理|对比|比较|排名|榜单|数据|表格|文件|报告|总结|分析|为什么|如何|怎么做|方案|计划|调研/;

export function complexityOf(question) {
  const text = String(question ?? '').trim();
  if (!text) return 'simple';
  if (text.length >= 40) return 'complex';
  return COMPLEX.test(text) ? 'complex' : 'simple';
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
    '你是鲸语的语音脑。把答案讲给人听，不写文档。',
    fillerRule,
    '- 1–3 句，最多 180 字；先结论，再一个理由。',
    '- 不念 Markdown、表格、链接、编号；数字照说。',
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
