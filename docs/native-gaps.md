# 原生侧补齐清单

面向 DSH-Go 原生（Flutter）与宿主（Node）的接缝需求。目标不是「在面板里加一个朗读按钮」，而是让 WhaleGo 成为会话里的双脑：

- 语音脑先说，文字脑只在复杂问题出现；两条输出在**同一个会话窗、同一个消息列表、同一层**。
- 语音行是消息列表里的一条记录，不是字幕、弹幕或悬浮窗。
- 音频与文字都流式：首句先播，文字增量进会话。
- 简单问题只走语音脑，但**用户的原问题照常进入 DSH 会话**。
- 两脑共享同一个会话、同一份上下文、同一套工具与环境。

当前基线：DSH-Go `0.2.1-rc.2`，插件契约 v1.2（`audio` / `voice` / `micro` / `overlay`）。

## 0. 优先级

| 优先级 | 能力 | 现在的问题 | 补齐后的效果 |
| --- | --- | --- | --- |
| P0 | `native.voiceLine` | 语音文字只能进插件面板，进不了会话 | 语音行出现在消息列表里，文字答案紧随其下 |
| P0 | `native.audioStream` | `media` 只能整段返回，长回答要等整段合成 | 首句先播，后续边合成边播 |
| P0 | `native.voiceTurn` | 语音脑用独立 `llm.stream`，不在 DSH 会话上下文；`session/prompt` 又一定会跑文字模型 | 同一会话内跑语音回合；用户问题落库；简单问题不产生文字答案 |
| P1 | `native.voice` | 原生 STT 只把文字填进输入框，没有免手与 partial | 开口即说、可打断、可连续对话 |
| P2 | `native.orb` | 插件无法控制原生悬浮球 | 悬浮球作为控制入口，状态与语音同步 |

P0 三项不补齐，WhaleGo 只能以「插件面板 + 朗读」的降级形态工作；「同会话双脑」不成立。

**不是原生缺口：`native.settings`。** DSH-Go 已有插件设置 schema，插件页可以原生渲染表单；WhaleGo 应把自己的设置迁到该 schema，而不是再要一个 `native.settings` 方法。设置入口仍然只在插件页，不挂在悬浮球下面。

## 1. `native.voiceLine`：会话内语音行

### 现状

- 插件能把语音文字存进自己的 `transcript.json`，并在「鲸语实录」面板里显示。
- `insert` 效果只写输入框，`overlay` 是字幕层；两者都不是「会话消息列表里的一条记录」。
- DSH 的会话历史由原生渲染；插件没有追加临时语音行的公开入口。

### 建议契约

```ts
type VoiceLine = {
  sessionId: string;
  lineId: string;          // 插件生成，幂等键
  role: 'assistant' | 'user';
  text: string;            // 当前完整文本，不是增量
  final: boolean;
  order?: 'before-text' | 'after-text';
};

native.voiceLine(line: VoiceLine): Promise<void>;
```

语义：

- `lineId` 相同则更新同一条；`text` 是**全量**，App 负责 diff 与滚动。
- `final: true` 后该行不再变化；插件会再发一条新的 `lineId` 表示下一段。
- 语音行是**会话消息列表里的临时行**，不是 `overlay`、字幕条、弹幕或第二条悬浮窗。
- 语音行不写入 `session` 的事件日志，不参与模型上下文；刷新后由插件用最近几轮重建，或由 App 丢弃。
- `order: 'before-text'` 表示这条语音行排在当前轮文字答案的上方；文字脑的答案仍由 DSH 正常渲染，不经过插件。
- 简单问题没有文字答案时，语音行就排在用户消息下方，独占本轮 assistant 区域。
- 单个 `lineId` 上限 4 KiB；超过时插件自行切段。
- 会话切换、删除会话、App 退到后台时，App 可以只保留 UI，不要求插件持久化。

事件：

```ts
type VoiceLineEvent =
  | { event: 'voiceLine.started'; lineId: string }
  | { event: 'voiceLine.updated'; lineId: string }
  | { event: 'voiceLine.ended'; lineId: string }
  | { event: 'voiceLine.closed'; lineId: string };
```

通过现有 `onCapability` 回传；插件返回值不执行。

### 验收

1. 语音行出现在会话消息列表里，位置在当前轮文字答案上方；简单问题时在用户消息下方。
2. 语音行增长时，下方文字答案被推开，不重叠、不截断。
3. 不出现字幕条、不出现弹幕、不出现第二条悬浮层；滚动、点击、无障碍都按列表行工作。
4. 20 次/秒的更新不丢字、不闪烁；App 可自行降频，但最终文本必须一致。
5. 停止语音后，语音行保留已说出的内容，标记 `final`；文字答案不受影响。
6. 会话切换后，旧语音行不串到新会话。

### 降级

没有 `voiceLine` 时，WhaleGo 使用「鲸语实录」面板；`insert` 不自动发送，避免污染输入框。

## 2. `native.audioStream`：流式音频

### 现状

- `media(id, handler)` 返回整段音频：单段 ≤30 秒、≤16 MiB，App 等整段可用后播放。
- 长回答必须切成多段；每段都要等合成完，句间会有空档。
- `audio` 效果只有 `play` / `pause` / `resume` / `stop`，没有「先播首句」。

### 建议契约

```ts
type AudioStream = {
  write(chunk: Uint8Array): Promise<void>; // 背压：App 播完再 resolve
  end(): Promise<void>;
  abort(reason?: string): void;
};

native.audioStream({
  id: string;
  contentType: 'audio/mpeg' | 'audio/wav' | 'audio/ogg' | 'audio/mp4' | 'audio/aac';
  sampleRate?: number;
  channels?: number;
}): Promise<AudioStream>;
```

语义：

- 首块到达即可开播；后续块无缝追加。App 负责解码缓冲与抖动缓冲。
- 同时最多 2 条流；每条流总时长上限 10 分钟；单块 ≤64 KiB。
- `abort()` 立即停播并释放解码器；插件收到 `audio.stopped` / `audio.error`。
- 流不落盘；缓存由插件自己做（`cacheAudio`），App 不暴露文件路径。

### 验收

1. 首块到首声 ≤ 2 秒（网络正常）。
2. 连续 60 秒播放无爆音、无大于 80 ms 的空档。
3. 停止按钮 200 ms 内静音；重新开始不复用旧流。
4. 网络中断触发 `audio.error`，插件回退到文字答案，不阻塞会话。
5. 两条流同时存在时不串音；第三条被拒绝并有可读错误。

### 降级

没有 `audioStream` 时，继续用 `media` 整段播放；长回答按句切段，接受句间空档。

## 3. `native.voiceTurn`：同一会话里的语音回合

这是「两脑同环境同会话同上下文」的关键，也是当前最大的缺口。

### 现状

- 语音脑走 `ctx.get('llm').stream`，带一个自定义提示词和本地 transcript 的最近几轮；它看不到 DSH 会话里的完整历史、工具和当前环境。
- 文字脑走 `sessionController.prompt`，是正常的 DSH 会话回合。
- 两者拿到的不是同一份上下文，只是同一个用户问题。
- `session/prompt` 每次都会启动主模型并产生 assistant 回合；没有「只写用户消息、不跑模型」的入口。
- `session/fork` 会新建会话，不是同会话 side-call。

### 建议契约

可以是一个方法，也可以拆成两个；只要语义成立：

```ts
type VoiceTurn = {
  sessionId: string;
  turnId: string;                 // 幂等键
  question: string;               // 用户原问题
  mode: 'voice-only' | 'dual';
  signal?: AbortSignal;
};

type VoiceTurnHandle = {
  onDelta(cb: (fullText: string) => void): () => void;
  onSentence(cb: (sentence: string) => void): () => void;
  onDone(cb: () => void): () => void;
  onError(cb: (err: { code: string; message: string }) => void): () => void;
  cancel(): void;
};

native.voiceTurn(turn: VoiceTurn): Promise<VoiceTurnHandle>;
```

拆开写也接受：

```ts
native.appendUser(sessionId, text, { requestId }): Promise<void>;
native.voice(sessionId, { turnId, question, signal }): Promise<VoiceTurnHandle>;
```

语义：

- **用户消息只写一次。** 原问题作为用户消息进入 DSH 会话，可见、可编辑、可重新生成；`turnId` 幂等，重试不产生第二条。
- **语音脑在同一个会话上下文里跑。** 它看到的系统提示、历史消息、工具、模型选择与环境，和文字脑一致；不是另起一个 session，也不是只喂最近几轮 transcript。
- **语音回合不产生可见的 assistant 消息。** 它的文字只走 `voiceLine`；不写 session 事件日志，不进入后续模型上下文。
- **`voice-only` 不启动文字脑。** 本轮只有用户消息 + 语音行，没有文字答案；历史里仍然保留用户消息，下一轮能接上。
- **`dual` 启动文字脑。** 文字脑是同一会话里的正常 `session.prompt`，看到的是同一条用户消息和同一份历史；它的答案由 DSH 原生流式渲染。
- **取消是原子的。** `cancel()` 同时停语音脑、音频流和文字脑；迟到的 delta 丢弃。
- **不复制会话。** 不允许用 fork / 临时 session 冒充同会话；sessionId 必须保持不变。

### 验收

1. 简单问题：用户消息在会话里出现一次；语音行出现；**没有** assistant 文字答案；刷新后用户消息仍在。
2. 复杂问题：用户消息出现一次；语音行 + 文字答案同时在列表里；文字答案看到的历史与语音脑一致。
3. 追问：第二轮能看到上一轮的用户消息与文字答案，但看不到上一轮的临时语音行。
4. `sessionId` 全程不变；没有新建会话、没有 fork。
5. 停止按钮 200 ms 内停音频；文字脑回合取消；已说出的语音行保留。
6. 同一 `turnId` 重试不重复写用户消息。
7. 语音脑和文字脑使用同一个模型/环境配置；切换模型对两者同时生效。

### 降级

没有 `voiceTurn` 时，退回当前实现：`session.prompt` 写用户消息并跑文字脑，语音脑用独立 `llm.stream` + transcript 上下文。用户消息仍然进会话，但两脑上下文不一致，且简单问题也会产生文字答案；诊断面板标记 `voiceTurn: missing`。

## 4. `native.voice`：免手语音会话（P1）

### 现状

- 原生语音输入是「点麦克风 → 说话 → 文字填进输入框 → 用户再点发送」。
- `micro` 是插件向 App 推送数据的通道，不是 App 把麦克风音频给插件；`overlay.channel` 只能绑定插件的 `micro`。
- 没有 VAD、没有 partial、没有 barge-in。

### 建议契约

```ts
type VoiceSession = {
  stop(): Promise<void>;
};

native.voice({
  mode: 'hands-free' | 'push-to-talk';
  language: 'zh-CN';
  vad: boolean;
  partial: boolean;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onSpeechStart(): void;
  onSpeechEnd(): void;
  onError(error: { code: string; message: string }): void;
}): Promise<VoiceSession>;
```

语义：

- 麦克风权限、前台限制、音频焦点、打断 TTS 由 App 负责；插件不接触原始音频。
- `onSpeechStart` 时 App 先停掉正在播放的 TTS，再通知插件；这就是 barge-in。
- `partial` 是当前识别片段的全量文本；`final` 是稳定结果。
- 端点检测 600–900 ms 可调；连续对话时，`final` 后自动重新开麦，直到 `stop()`。
- 只在前台运行；退后台自动 `stop()` 并通知插件。

### 验收

1. 开口 300 ms 内出现 partial；说完 900 ms 内出 final。
2. 说话时正在播放的 TTS 在 200 ms 内停止，不重叠。
3. 连续说三轮不需要再点麦克风。
4. 退后台、来电、耳机拔出时自动停止，不残留录音。
5. 插件拿不到原始音频，只能拿到文本与事件。

### 降级

没有 `voice` 时，使用原生点按 STT；WhaleGo 的「鲸语」按钮仍可把当前输入框内容交给双脑。这条不影响「打字提问 + 语音回答」的主路径。

## 5. `native.orb`：原生悬浮球（P2）

### 现状

- 插件没有悬浮球 API；`ui.json` 没有 orb 配置；App 的「手机操控悬浮条」是 App 功能，不是插件控制项。
- 插件设置里已有 `orbStyle` / `orbSize` / `orbIdle`，但只能存偏好，无法驱动原生绘制。

### 建议契约

```ts
type OrbState = {
  visible: boolean;
  style: 'pixel-whale' | 'sonar' | 'minimal' | 'off';
  size: 's' | 'm' | 'l';
  idle: 'swim' | 'breathe' | 'none';
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  sessionId?: string;
};

native.orb(state: OrbState): Promise<void>;
```

语义：

- **悬浮球只是控制入口，不是文字输出面。** 语音行永远在会话列表里，不画在球上。
- 插件只声明枚举，不传颜色、字体、尺寸像素、动画曲线；具体绘制、贴边、避让、安全区由 Flutter 决定。
- `style: 'off'` 等价于隐藏；`visible: false` 保留用户的选择，下次打开恢复。
- `state` 驱动原生动效；插件在 `thinking` / `speaking` / `error` 时更新，App 不得自行猜测。
- 悬浮球点击 = 开始 / 停止一轮语音；长按不挂设置菜单，设置只在插件页。若原生要支持拖动，位置由 App 持久化，插件不存坐标。
- 设置入口只在插件页；悬浮球下方不再挂设置菜单。

事件：

```ts
type OrbEvent =
  | { event: 'orb.tap' }
  | { event: 'orb.longPress' }
  | { event: 'orb.hidden' };
```

### 验收

1. 三套样式在深色 / 浅色主题下都可读，不出现插件自定义色值。
2. 语音开始、思考、说话、出错四种状态切换无跳变；停止后回到待命。
3. 悬浮球不遮挡输入框、发送键、状态栏；横竖屏旋转后仍在安全区。
4. 关闭悬浮球后，插件页仍可重新打开；设置不丢。
5. 悬浮球动画只在前台运行；退后台暂停，回前台恢复。
6. 球上不出现语音文字；语音行只在会话列表里。

### 降级

没有 `orb` 时，设置项仍可保存；「接缝诊断」显示 `orb: missing`，不假装成功。

## 6. 不是原生缺口：插件设置

- DSH-Go 已有插件设置 schema：插件页可以按字段类型原生渲染表单，值由宿主持久化。
- WhaleGo 当前用 `whalego.settings` 面板；应迁到插件设置 schema，保留现有的 11 组偏好。
- 不新增 `native.settings`；设置入口仍然只在插件页，不放在悬浮球下方。
- 如果宿主希望提供稳定门面，也应作为插件侧适配，而不是再开一条原生桥。

## 7. 版本与兼容

- 建议把上述能力纳入 `dshGo.protocol` v1.3，逐项 feature flag；不要一次性要求全有。
- `native.capabilities()` 返回可用方法名数组；插件据此显示「接缝诊断」。
- 旧版 App 遇到未知字段应忽略，不报错；新版插件遇到缺失方法走降级，不抛异常。
- 每个能力都要有「无此能力」的验收用例，避免插件把缺失当成成功。

## 8. 最小适配路径

WhaleGo 把核心接缝收在 `lib/nativeSeam.js`：

| 方法 | 当前行为 | 原生补齐后 |
| --- | --- | --- |
| `appendVoiceLine(payload)` | 返回 `false`，面板显示 | 调 `bridge.voiceLine(payload)` |
| `openAudioStream(options)` | 返回 `null`，用 `media` 整段 | 调 `bridge.audioStream(options)` |
| `openVoiceTurn(turn)` | 返回 `null`，用 `session.prompt` + 独立 `llm.stream` | 调 `bridge.voiceTurn(turn)` |
| `openVoiceSession(options)` | 返回 `null`，用点按 STT | 调 `bridge.voice(options)` |
| `setOrb(payload)` | 返回 `false`，只存偏好 | 调 `bridge.orb(payload)` |

设置迁移是插件侧改动：把 `whalego.settings` 面板的字段声明换成插件设置 schema，不占原生接缝。

## 9. 联调用例

1. 假桥：实现四个方法并记录调用，跑 `node --test`；插件应逐项走新路径。
2. 半桥：只实现 `voiceLine`，其余缺失；插件应显示 `voiceLine: ok`、`audioStream: missing`、`voiceTurn: missing`，不崩。
3. 简单问题：`voice-only`；用户消息出现一次，语音行出现，没有文字答案；刷新后用户消息仍在。
4. 复杂问题：`dual`；用户消息一次，语音行 + 文字答案；语音行增长时文字答案下移。
5. 流式：120 秒语音；首块 2 秒内开播；语音行按 delta 更新不丢字。
6. 打断：语音播放中按停止；音频 200 ms 内静音，文字脑取消，语音行保留。
7. 切会话：语音行不串台；旧流被 abort；`sessionId` 不变。
8. 后台：退后台 5 秒；麦克风停、TTS 停、悬浮球暂停；回前台恢复待命。
