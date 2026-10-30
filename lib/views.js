/** Pure view trees. Keeping them pure lets the checker run without a host. */

export const MODE_LABELS = Object.freeze({ auto: '自动', dual: '双脑', read: '朗读', voice: '只语音' });
export const VOICE_LABELS = Object.freeze({
  'zh-CN-XiaoxiaoNeural': '晓晓 · 女声',
  'zh-CN-YunxiNeural': '云希 · 男声',
  'zh-CN-XiaoyiNeural': '晓伊 · 女声',
});
export const RATE_LABELS = Object.freeze({ slow: '慢', normal: '正常', fast: '快' });
export const FILLER_LABELS = Object.freeze({ '我想想。': '我想想。', '嗯，我看看。': '嗯，我看看。', '': '不说' });
export const ORB_STYLE_LABELS = Object.freeze({
  'pixel-whale': '像素鲸',
  sonar: '声呐',
  minimal: '极简',
  off: '关闭',
});
export const ORB_SIZE_LABELS = Object.freeze({ s: '小', m: '中', l: '大' });
export const ORB_IDLE_LABELS = Object.freeze({ swim: '游动', breathe: '呼吸', none: '静止' });

const STATUS = Object.freeze({
  idle: { text: '待命', tone: 'info' },
  thinking: { text: '在想', tone: 'info' },
  speaking: { text: '在说', tone: 'good' },
  done: { text: '完成', tone: 'good' },
  error: { text: '出错', tone: 'bad' },
  interrupted: { text: '已停', tone: 'warn' },
});

export function statusMeta(status) {
  return STATUS[status] ?? STATUS.idle;
}

export function stripText(status, locale = 'zh') {
  const meta = statusMeta(status);
  return locale === 'en' ? `WhaleGo · ${meta.text === '待命' ? 'idle' : meta.text}` : `鲸语 · ${meta.text}`;
}

export function liveView() {
  return {
    type: 'stack',
    title: '鲸语实录',
    children: [
      { type: 'callout', text: { $: 'data.statusText' }, tone: { $: 'data.statusTone' } },
      {
        type: 'keyValue',
        items: [
          ['模式', { $: 'data.modeLabel' }],
          ['声音', { $: 'data.voiceLabel' }],
          ['原生行', { $: 'data.nativeLabel' }],
        ],
      },
      { type: 'list', items: { $: 'data.lines' } },
      {
        type: 'actions',
        items: [
          { label: '设置', action: 'openSettings', style: 'primary' },
          { label: '复制全文', action: 'copyTranscript' },
          { label: '浏览器入口', action: 'copyEntry' },
          { label: '诊断', action: 'openDiag' },
        ],
      },
      { type: 'text', text: '免提语音与自动播放在浏览器入口最完整；点上面的按钮即可复制地址。', tone: 'muted' },
      { type: 'confirm', id: 'clearTranscript', confirmLabel: '清空', cancelLabel: '取消' },
    ],
  };
}

export function settingsView() {
  return {
    type: 'stack',
    title: '鲸语设置',
    children: [
      { type: 'callout', text: '设置只存偏好，界面由 DSH-Go 原生绘制。', tone: 'info' },
      { type: 'text', text: '双脑模式' },
      {
        type: 'options',
        id: 'mode',
        options: [
          { label: '自动', value: 'auto' },
          { label: '总是双脑', value: 'dual' },
          { label: '只语音（不写答案）', value: 'voice' },
          { label: '朗读答案', value: 'read' },
        ],
        selected: { $: 'data.mode' },
      },
      { type: 'text', text: '声音' },
      {
        type: 'options',
        id: 'voice',
        options: [
          { label: '晓晓 · 女声', value: 'zh-CN-XiaoxiaoNeural' },
          { label: '云希 · 男声', value: 'zh-CN-YunxiNeural' },
          { label: '晓伊 · 女声', value: 'zh-CN-XiaoyiNeural' },
        ],
        selected: { $: 'data.voice' },
      },
      { type: 'text', text: '语速' },
      {
        type: 'options',
        id: 'rate',
        options: [
          { label: '慢', value: 'slow' },
          { label: '正常', value: 'normal' },
          { label: '快', value: 'fast' },
        ],
        selected: { $: 'data.rate' },
      },
      { type: 'text', text: '思考前' },
      {
        type: 'options',
        id: 'filler',
        options: [
          { label: '我想想。', value: '我想想。' },
          { label: '嗯，我看看。', value: '嗯，我看看。' },
          { label: '不说', value: '' },
        ],
        selected: { $: 'data.filler' },
      },
      { type: 'text', text: '悬浮球样式' },
      {
        type: 'options',
        id: 'orbStyle',
        options: [
          { label: '像素鲸', value: 'pixel-whale' },
          { label: '声呐', value: 'sonar' },
          { label: '极简', value: 'minimal' },
          { label: '关闭', value: 'off' },
        ],
        selected: { $: 'data.orbStyle' },
      },
      { type: 'text', text: '思考时球的位置' },
      {
        type: 'options',
        id: 'thinkOrb',
        options: [
          { label: '右下角', value: 'corner' },
          { label: '底部中央', value: 'center' },
        ],
        selected: { $: 'data.thinkOrb' },
      },
      { type: 'text', text: '浏览器模式' },
      {
        type: 'options',
        id: 'browserEntry',
        options: [
          { label: '开启', value: 'on' },
          { label: '隐藏', value: 'off' },
        ],
        selected: { $: 'data.browserEntry' },
      },
      { type: 'text', text: '原生自动有声问答' },
      {
        type: 'options',
        id: 'nativeAuto',
        options: [
          { label: '开：在 App 里说话也答一遍', value: 'on' },
          { label: '关：只用浏览器入口', value: 'off' },
        ],
        selected: { $: 'data.nativeAuto' },
      },
      { type: 'text', text: '悬浮球大小' },
      {
        type: 'options',
        id: 'orbSize',
        options: [
          { label: '小', value: 's' },
          { label: '中', value: 'm' },
          { label: '大', value: 'l' },
        ],
        selected: { $: 'data.orbSize' },
      },
      { type: 'text', text: '待机动作' },
      {
        type: 'options',
        id: 'orbIdle',
        options: [
          { label: '游动', value: 'swim' },
          { label: '呼吸', value: 'breathe' },
          { label: '静止', value: 'none' },
        ],
        selected: { $: 'data.orbIdle' },
      },
      { type: 'text', text: '语音文字流' },
      {
        type: 'options',
        id: 'inlineTranscript',
        options: [
          { label: '显示', value: 'on' },
          { label: '隐藏', value: 'off' },
        ],
        selected: { $: 'data.inlineTranscript' },
      },
      { type: 'text', text: '语音缓存' },
      {
        type: 'options',
        id: 'cacheAudio',
        options: [
          { label: '开', value: 'on' },
          { label: '关', value: 'off' },
        ],
        selected: { $: 'data.cacheAudio' },
      },
      { type: 'text', text: '保留轮数' },
      {
        type: 'options',
        id: 'historyTurns',
        options: [
          { label: '4 轮', value: '4' },
          { label: '6 轮', value: '6' },
          { label: '10 轮', value: '10' },
        ],
        selected: { $: 'data.historyTurns' },
      },
      { type: 'text', text: '自动播放' },
      {
        type: 'options',
        id: 'autoPlay',
        options: [
          { label: '开', value: 'on' },
          { label: '关', value: 'off' },
        ],
        selected: { $: 'data.autoPlay' },
      },
      { type: 'text', text: '语音命令' },
      {
        type: 'options',
        id: 'voiceCommands',
        options: [
          { label: '开：可用口语唤醒/打断/停', value: 'on' },
          { label: '关（默认）', value: 'off' },
        ],
        selected: { $: 'data.voiceCommands' },
      },
      { type: 'text', text: '唤醒词（开着听时说出来不算提问）' },
      {
        type: 'options',
        id: 'wakePhrase',
        options: [
          { label: '你好小鲸', value: '你好小鲸' },
          { label: '小鲸小鲸', value: '小鲸小鲸' },
          { label: '鲸鱼鲸鱼', value: '鲸鱼鲸鱼' },
        ],
        selected: { $: 'data.wakePhrase' },
      },
      { type: 'text', text: '打断词（在说的时候插话）' },
      {
        type: 'options',
        id: 'breakPhrase',
        options: [
          { label: '小鲸', value: '小鲸' },
          { label: '哎小鲸', value: '哎小鲸' },
          { label: '停一下', value: '停一下' },
        ],
        selected: { $: 'data.breakPhrase' },
      },
      { type: 'text', text: '退下词（停播并收起）' },
      {
        type: 'options',
        id: 'stopPhrase',
        options: [
          { label: '退下吧', value: '退下吧' },
          { label: '安静', value: '安静' },
          { label: '先去吧', value: '先去吧' },
        ],
        selected: { $: 'data.stopPhrase' },
      },
      { type: 'text', text: '清空实录' },
      { type: 'confirm', id: 'clearTranscript', confirmLabel: '清空', cancelLabel: '取消' },
      { type: 'text', text: '恢复默认' },
      { type: 'confirm', id: 'resetAll', confirmLabel: '恢复', cancelLabel: '取消' },
      {
        type: 'actions',
        items: [
          { label: '关于鲸语', action: 'openAbout' },
          { label: '接缝诊断', action: 'openDiag' },
          { label: '打开仓库', action: 'repo' },
        ],
      },
    ],
  };
}

export function aboutView() {
  return {
    type: 'stack',
    title: '关于鲸语',
    children: [
      { type: 'image', src: { $: 'data.logo' }, alt: '像素鲸', aspect: 1 },
      { type: 'text', text: '鲸鱼用声呐辨认方向，用鲸歌交换消息。' },
      { type: 'text', text: 'Whale 是 DeepSeek 的意象，Go 指 DSH-Go。' },
      { type: 'text', text: '先听见，再看见。', tone: 'muted' },
      {
        type: 'keyValue',
        items: [
          ['版本', { $: 'data.version' }],
          ['协议', { $: 'data.protocol' }],
          ['许可证', 'MIT'],
        ],
      },
      {
        type: 'actions',
        items: [
          { label: '打开仓库', action: 'repo', style: 'primary' },
          { label: '接缝诊断', action: 'openDiag' },
        ],
      },
    ],
  };
}

export function diagView() {
  return {
    type: 'stack',
    title: '接缝诊断',
    children: [
      { type: 'callout', text: { $: 'data.summary' }, tone: { $: 'data.tone' } },
      { type: 'table', columns: ['能力', '状态'], rows: { $: 'data.rows' } },
      { type: 'text', text: '语音命令开着时，口语短语可唤醒/打断/停播；短语在设置页换。装了 dsh-orb 的宿主上，本会话也持有它的悬浮球与 GUI 工具。', tone: 'muted' },
      {
        type: 'keyValue',
        items: [
          ['协议', { $: 'data.protocol' }],
          ['App', { $: 'data.app' }],
          ['TTS', { $: 'data.tts' }],
          ['版本', { $: 'data.version' }],
        ],
      },
      { type: 'text', text: '缺的能力会在原生接缝补齐后自动启用；插件已做特性探测。', tone: 'muted' },
    ],
  };
}

export function settingsData(prefs) {
  return {
    mode: prefs.mode,
    voice: prefs.voice,
    rate: prefs.rate,
    filler: prefs.filler,
    orbStyle: prefs.orbStyle,
    orbSize: prefs.orbSize,
    orbIdle: prefs.orbIdle,
    thinkOrb: prefs.thinkOrb,
    browserEntry: prefs.browserEntry,
    nativeAuto: prefs.nativeAuto,
    voiceCommands: prefs.voiceCommands,
    wakePhrase: prefs.wakePhrase,
    breakPhrase: prefs.breakPhrase,
    stopPhrase: prefs.stopPhrase,
    inlineTranscript: prefs.inlineTranscript ? 'on' : 'off',
    cacheAudio: prefs.cacheAudio ? 'on' : 'off',
    historyTurns: String(prefs.historyTurns),
    autoPlay: prefs.autoPlay ? 'on' : 'off',
  };
}
