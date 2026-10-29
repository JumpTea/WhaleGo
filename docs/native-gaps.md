# 原生侧补齐清单

面向 DSH-Go 原生（Flutter）与宿主（Node）的接缝需求。目标不是「在面板里加一个朗读按钮」，而是让 WhaleGo 成为会话里的双脑：

- 语音脑先说，文字脑只在复杂问题出现；两条输出在**同一个会话窗、同一个消息列表、同一层**。
- 语音消息是消息列表里的一条**持久化记录**：刷新、重进、切回会话都还在，可回看、可分别复制；不是字幕、弹幕或悬浮窗，也不是关掉就消失的临时行。
- 用户说话时实时转写：partial 以「草稿用户消息」进会话，定稿后才提交。
- 音频与文字都流式：首句先播，文字增量进会话。
- 简单问题只走语音脑，但**用户的原问题照常进入 DSH 会话**，语音消息留在历史里。
- 两脑共享同一个会话、同一份上下文；工具由文字脑执行，语音脑只负责说。

当前基线：DSH-Go `0.2.1-rc.2`，插件契约 v1.2（`audio` / `voice` / `micro` / `overlay`）。

## 0. 优先级

| 优先级 | 能力 | 现在的问题 | 补齐后的效果 |
| --- | --- | --- | --- |
| P0 | `native.voiceLine` | 语音文字只能进插件面板，进不了会话 | 语音消息成为消息列表里的持久化记录，刷新可回看；`dual` 时与文字答案各为一条独立消息 |
| P0 | `native.audioStream` | `media` 只能整段返回，长回答要等整段合成 | 首句先播，后续边合成边播 |
| P0 | `native.voiceTurn` | 语音脑用独立 `llm.stream`，不在 DSH 会话上下文；`session/prompt` 又一定会跑文字模型 | 同一会话内跑语音回合；用户问题只落一次；`dual` 时宿主在同一轮跑文字脑，产出两条可分别复制的 assistant 消息 |
| P0 | `native.voiceInput` | 原生 STT 只把文字填进输入框，没有实时 partial | 说话时逐字转写进会话（草稿用户消息），定稿后提交 |
| P1 | `native.voice` | 没有免手、VAD、barge-in | 开口即说、可打断、可连续对话 |
| P2 | `native.orb` | 插件无法控制原生悬浮球 | 悬浮球作为控制入口，状态与语音同步 |

P0 四项不补齐，WhaleGo 只能以「插件面板 + 朗读」的降级形态工作；「同会话双脑」不成立。

**不是原生缺口：`native.settings`。** DSH-Go 已有插件设置 schema，插件页可以原生渲染表单；WhaleGo 应把自己的设置迁到该 schema，而不是再要一个 `native.settings` 方法。设置入口仍然只在插件页，不挂在悬浮球下面。

## 1. `native.voiceLine`：会话里持久化的语音消息

### 现状

- 插件能把语音文字存进自己的 `transcript.json`，并在「鲸语实录」面板里显示。
- `insert` 效果只写输入框，`overlay` 是字幕层；两者都不是「会话消息列表里的一条记录」。
- DSH 的会话历史由原生持有；插件没有追加、更新一条语音消息的公开入口，宿主也没有「可流式更新的消息」这种类型。

### 建议契约

```ts
type VoiceLine = {
  sessionId: string;
  lineId: string;          // 插件生成，幂等键，同时是这条消息的 id
  role: 'assistant';       // 语音消息固定 assistant；用户侧实时转写见第 4 节
  text: string;            // 当前完整文本，不是增量
  final: boolean;
  audioRef?: string;       // 可选：TTS 缓存键，用于回看重放
  context?: boolean;       // 默认 true；dual 时传 false，避免同一答案进两次上下文
  order?: 'before-text';   // 作为本轮第一条 assistant 消息，文字答案排在它后面
};

native.voiceLine(line: VoiceLine): Promise<void>;
```

语义：

- `lineId` 相同则更新同一条；`text` 是**全量**，App 负责 diff 与滚动。
- `final: true` 后该消息冻结；下一段语音用新的 `lineId`，不覆盖上一条。
- 语音消息是**持久化的会话消息**：写入会话存储，刷新、重进、切回会话都还在；可滚动回看、单独复制。**不是临时行，不是关掉就消失的 UI。**
- `dual` 时它与文字答案是**两条独立消息**：语音在上、文字在下，各自可复制，互不影响。
- `voice-only` 时它是本轮唯一的 assistant 消息；`context: true`，下一轮模型能接上。
- `dual` 时它只负责「说」，内容由文字答案承载；`context: false`，否则同一份回答以两种措辞进两次上下文。
- 音频：`audioRef` 指向插件 TTS 缓存。缓存关闭或已清理时，消息与文本保留，重放不可用并在 UI 标注。
- 语音消息不走 `overlay`，也不是字幕条 / 弹幕 / 第二浮窗。
- 单个 `lineId` 上限 4 KiB；超过时插件自行切段。
- 会话删除时随会话删除；持久化由宿主负责，插件不重建、不补写。

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

1. 语音消息出现在会话消息列表里，位置在当前轮文字答案上方；`voice-only` 时在用户消息下方。
2. 语音消息增长时，下方文字答案被推开，不重叠、不截断。
3. 不出现字幕条、不出现弹幕、不出现第二条悬浮层；滚动、点击、无障碍都按列表行工作。
4. 20 次/秒的更新不丢字、不闪烁；App 可自行降频，但最终文本必须一致。
5. 停止语音后，消息保留已说出的内容，标记 `final`；文字答案不受影响。
6. 会话切换后，旧语音消息不串到新会话。
7. **持久化**：杀进程重开、切走再切回、下拉刷新后，语音消息与用户原话仍在，顺序不变，不重复。
8. **可复制**：复制语音消息只得到语音文本；`dual` 时复制文字消息只得到文字答案。
9. 音频：缓存可用时可重放；缓存被清理后消息仍在，只是重放置灰。

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

可以是一个方法；`voice-only` 与 `dual` 都由它驱动，避免插件再拼一次 `session.prompt`：

```ts
type VoiceTurn = {
  sessionId: string;
  turnId: string;                 // 幂等键
  question: string;               // 用户原问题
  userMessageId?: string;         // 实时转写已定稿时传入，宿主不再写第二条
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

语义：

- **用户消息只写一次。** 原问题作为用户消息进入 DSH 会话，可见、可编辑、可重新生成；`turnId` 幂等；`userMessageId` 已存在时宿主跳过写入。
- **语音脑在同一个会话上下文里跑。** 它看到的系统提示、历史消息、工具、模型选择与环境，和文字脑一致；不是另起一个 session，也不是只喂最近几轮 transcript。
- **`dual` 由宿主在同一轮里跑文字脑。** 产出两条独立 assistant 消息：语音消息在上、文字答案在下；插件不调 `session.prompt`，否则用户消息会写两遍。
- **`voice-only` 只产出语音消息。** 它是本轮唯一的 assistant 消息，`context: true`。
- **两条消息都持久化。** 刷新、重进、切回会话都在；可分别复制。
- **取消是原子的。** `cancel()` 同时停语音脑、音频流和文字脑；迟到的 delta 丢弃；已写用户消息与已说出的语音保留，不留半条文字答案。
- **不复制会话。** 不允许用 fork / 临时 session 冒充同会话；sessionId 必须保持不变。
- 宿主内部可以用第 1 节的 `voiceLine` 落地语音消息；对插件只暴露这一个入口，避免两条写路径。

### 验收

1. 简单问题：用户消息出现一次；只有一条语音消息；**没有**文字答案；刷新后两者都在。
2. 复杂问题：用户消息出现一次；**两条** assistant 消息，语音在上、文字在下；两条都流式、互不截断；各自可复制。
3. 追问：下一轮能看到上一轮的用户消息与文字答案；`voice-only` 的语音消息进上下文，`dual` 的不进（只作展示）。
4. `sessionId` 全程不变；没有新建会话、没有 fork。
5. 停止按钮 200 ms 内停音频；文字脑回合取消；已说出的语音保留。
6. 同一 `turnId` 重试：只写一条用户消息、一条语音消息。
7. 语音脑和文字脑使用同一个模型/环境配置；切换模型对两者同时生效。
8. 杀进程重开：两条消息都在，顺序不变，不重复。

### 降级

没有 `voiceTurn` 时，退回当前实现：`session.prompt` 写用户消息并跑文字脑，语音脑用独立 `llm.stream` + transcript 上下文。用户消息仍然进会话，但两脑上下文不一致，且简单问题也会产生文字答案；诊断面板标记 `voiceTurn: missing`。

## 4. `native.voice`：免手语音与实时转写（P0 子集 / P1 完整）

### 现状

- 原生语音输入是「点麦克风 → 说话 → 文字填进输入框 → 用户再点发送」。
- `micro` 是插件向 App 推送数据的通道，不是 App 把麦克风音频给插件；`overlay.channel` 只能绑定插件的 `micro`。
- 没有 VAD、没有 partial、没有 barge-in；说话过程在会话里不可见。

### 建议契约

```ts
type VoiceSession = {
  stop(): Promise<void>;
};

native.voice({
  sessionId: string;
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
- **实时转写进会话。** partial 作为「草稿用户消息」出现在会话列表里，同一行反复替换；不是输入框里的临时文字，也不是悬浮字幕。
- **partial 是修订，不是增量。** 识别结果允许整句重写，调用方按全量替换，不要拼接。
- **final 定稿。** 定稿后才算提交；之后 `voiceTurn` 用 `userMessageId` 接上，不再写第二条用户消息。
- **取消即丢弃。** 用户取消、退后台、来电时，草稿不落库，会话里不留半句。
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
6. 首字在 300 ms 内出现在会话的草稿用户消息里；改词时整句替换，不出现重复片段。
7. 说完 900 ms 内定稿；刷新后只有一条用户消息，没有草稿残留。
8. 取消后草稿消失，不落库。

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
- 语音消息与用户草稿是**新的消息类型**（`kind: 'voice'`、`draft: true`），消息 schema 需要版本化；旧客户端不认识时至少退化成普通文本行，不丢内容。
- `context` 决定这条消息是否进模型上下文：默认 `true`；`dual` 的语音消息显式 `false`。
- 旧版 App 遇到未知字段应忽略，不报错；新版插件遇到缺失方法走降级，不抛异常。
- 每个能力都要有「无此能力」的验收用例，避免插件把缺失当成成功。

## 8. 最小适配路径

WhaleGo 把核心接缝收在 `lib/nativeSeam.js`：

| 方法 | 当前行为 | 原生补齐后 |
| --- | --- | --- |
| `appendVoiceLine(payload)` | 返回 `false`，面板显示 | 调 `bridge.voiceLine(payload)` |
| `openAudioStream(options)` | 返回 `null`，用 `media` 整段 | 调 `bridge.audioStream(options)` |
| `openVoiceTurn(turn)` | **尚未实现**：`lib/nativeSeam.js` 目前没有这个方法 | 调 `bridge.voiceTurn(turn)` |
| `openVoiceInput(options)` | **尚未实现**：实时转写没有入口 | 调 `bridge.voice(options)` |
| `openVoiceSession(options)` | 返回 `null`，用点按 STT | 调 `bridge.voice(options)` |
| `setOrb(payload)` | 返回 `false`，只存偏好 | 调 `bridge.orb(payload)` |
| `registerSettings(schema)` | 返回 `false` | 调 `bridge.settings(schema)`（非原生缺口） |

注意：`openVoiceTurn` 与 `openVoiceInput` 现在只存在于文档，代码里没有；原生桥落地前要先补探测，再在 `lib/engine.js` 里切换，不能只改文档。

设置迁移是插件侧改动：把 `whalego.settings` 面板的字段声明换成插件设置 schema，不占原生接缝。

## 9. 联调用例

1. 假桥：实现全部方法并记录调用，跑 `node --test`；插件应逐项走新路径。
2. 半桥：只实现 `voiceLine`，其余缺失；插件应显示 `voiceLine: ok`、`audioStream: missing`、`voiceTurn: missing`，不崩。
3. 简单问题：`voice-only`；用户消息出现一次，只有一条语音消息，没有文字答案；刷新后两者都在。
4. 复杂问题：`dual`；用户消息一次，两条 assistant 消息（语音上、文字下），各自可复制；语音增长时文字下移。
5. 流式：120 秒语音；首块 2 秒内开播；语音消息按全量更新不丢字。
6. 打断：语音播放中按停止；音频 200 ms 内静音，文字脑取消，语音保留。
7. 切会话：语音消息不串台；旧流被 abort；`sessionId` 不变。
8. 后台：退后台 5 秒；麦克风停、TTS 停、悬浮球暂停；回前台恢复待命。
9. 实时转写：partial 整句替换不重复；定稿后只留一条用户消息；取消不落库。
10. 双写回归：`dual` 跑完，用户消息恰好一条、assistant 恰好两条；同一 `turnId` 重试不增加。
