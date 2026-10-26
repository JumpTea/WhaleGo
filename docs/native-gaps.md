# 原生侧补齐清单

面向 DSH-Go 原生（Flutter）与宿主（Node）的接缝需求。目标是让 WhaleGo 从「面板里的语音」变成「会话里的双脑」：语音行进入会话、悬浮球由原生绘制、设置进入插件页、音频可以边合成边播、麦克风可以免手对话。

当前基线：DSH-Go `0.2.1-rc.2`，插件契约 v1.2（`audio` / `voice` / `micro` / `overlay`）。

## 0. 优先级

| 优先级 | 能力 | 现在的问题 | 补齐后的效果 |
| --- | --- | --- | --- |
| P0 | `native.voiceLine` | 语音转写只能进插件面板，进不了会话 | 语音行直接出现在会话里，文字答案紧随其下 |
| P0 | `native.orb` | 插件无法控制原生悬浮球，样式只能停在设置项 | 像素鲸 / 声呐 / 极简三套原生球，状态与语音同步 |
| P0 | `native.settings` | 插件设置只能做成面板，进不了插件详情页 | 设置出现在「插件 → 鲸语 → 设置」，原生表单渲染 |
| P1 | `native.audioStream` | `media` 只能整段返回，长回答要等整段合成 | 首句先播，后续边合成边播 |
| P1 | `native.voice` | 原生 STT 只把文字填进输入框，没有免手与 partial | 开口即说、可打断、可连续对话 |
| P2 | `native.session` | 插件直接摸 `sessionController` 的内部形状 | 稳定的会话门面，升级不碎 |

P0 三项不补齐，WhaleGo 只能以「插件面板 + 朗读按钮」的降级形态工作；双脑的会话体验不成立。

## 1. `native.voiceLine`：会话内语音行

### 现状

- 插件能把语音转写存进自己的 `transcript.json`，并在「鲸语实录」面板里显示。
- `insert` 效果只写输入框，`overlay` 是字幕层；两者都不是「会话里的一条助手消息」。
- DSH 的会话历史由原生渲染；插件没有追加非 `plugin:` 记录的公开入口。

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
- 语音行不写入 `session` 的事件日志，不参与模型上下文；刷新后由插件用最近几轮重建，或由 App 丢弃。
- `order: 'before-text'` 表示这条语音行排在当前轮文字答案的上方；文字脑的答案仍由 DSH 正常渲染，不经过插件。
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

1. 语音行出现在会话中，位置在当前轮文字答案上方。
2. 语音行增长时，下方文字答案被推开，不重叠、不截断。
3. 不出现字幕条、不出现弹幕、不出现第二条悬浮层。
4. 20 次/秒的更新不丢字、不闪烁；App 可自行降频，但最终文本必须一致。
5. 停止语音后，语音行保留已说出的内容，标记 `final`；文字答案不受影响。
6. 会话切换后，旧语音行不串到新会话。

### 降级

没有 `voiceLine` 时，WhaleGo 使用「鲸语实录」面板；`insert` 不自动发送，避免污染输入框。

## 2. `native.orb`：原生悬浮球

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

### 降级

没有 `orb` 时，设置项仍可保存；「接缝诊断」显示 `orb: missing`，不假装成功。

## 3. `native.settings`：插件页设置

### 现状

- 插件清单没有 `settings` 字段；`contributes` 只有 `composer.actions` / `message.actions` / `composer.strip` / `panels`。
- 当前设置做成 `whalego.settings` 面板，能从状态条和面板进入，但不在「插件详情页」。
- 用户明确要求：设置放在 App 设置页 / 插件页，不放在悬浮球下方。

### 建议契约

```ts
type SettingField =
  | { id: string; type: 'enum'; label: string; values: { label: string; value: string }[]; default: string }
  | { id: string; type: 'boolean'; label: string; default: boolean }
  | { id: string; type: 'integer'; label: string; min: number; max: number; step?: number; default: number }
  | { id: string; type: 'string'; label: string; maxLength: number; default: string };

native.settings({
  pluginId: string;
  title: string;
  fields: SettingField[];
  values: Record<string, unknown>;
}): Promise<void>;

native.onSettingsChange((pluginId: string, values: Record<string, unknown>) => void): () => void;
```

语义：

- App 在「插件 → 鲸语 → 设置」渲染原生表单，不执行插件代码；插件只提供 schema 与当前值。
- 字段上限 24 个；枚举选项上限 12 个；标签不超过 16 个全角字。
- 校验失败时 App 原地提示，不写回；插件收到的是已校验的值。
- 值由 App 持久化；插件启动时通过 `native.settings` 读回，或由 App 注入 `scope.settings`。
- 不支持颜色、字体、任意 CSS、任意像素尺寸。

### 验收

1. 设置出现在插件详情页，不出现第二个设置入口。
2. 修改后立即生效，不需要重启宿主。
3. 越界 / 非法值被拒绝，UI 有可读的中文提示。
4. 「恢复默认」由 App 提供；插件不需要自己画按钮。
5. 插件卸载后设置清空；重装回到默认值。

### 降级

没有 `settings` 时，保留 `whalego.settings` 面板；所有值仍写入 `prefs.json`。

## 4. `native.audioStream`：流式音频

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

## 5. `native.voice`：免手语音会话

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

没有 `voice` 时，使用原生点按 STT；WhaleGo 的「鲸语」按钮仍可把当前输入框内容交给双脑。

## 6. `native.session`：稳定的会话门面（P2）

### 现状

- 插件通过 `ctx.get('sessionController')` 调 `prompt` / `cancel` / `modelCatalog` / `selectModel`，并监听 `agent/assistant-stream` 与 `session/event`。
- 这些是 DSH 内部形状，升级可能变；WhaleGo 已把它们包在 `lib/textBrain.js` / `lib/engine.js`，但仍是内部依赖。

### 建议契约

```ts
type SessionFacade = {
  prompt(sessionId: string, text: string, opts?: { mode?: 'queue' | 'steer'; signal?: AbortSignal }): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  onAssistant(sessionId: string, cb: (frame: AssistantFrame) => void): () => void;
  onTurnEnd(sessionId: string, cb: () => void): () => void;
  models(): Promise<ModelInfo[]>;
};
```

语义：

- `prompt` 不自动发送、不改写用户消息；插件只提交本轮问题。
- `onAssistant` 的 frame 形状固定为 `start` / `chunk(text-delta)` / `end`；不再暴露内部事件名。
- `cancel` 幂等；取消后仍会收到 `turn/end`。
- 会话 ID 由 `scope.sessionId` 提供，插件不自己拼。

### 验收

1. 插件只依赖 `native.session`，不 import 任何 `@deepseek-ai/dsh-*` 内部包。
2. 宿主升级到下一个 rc 时，门面保持兼容；破坏性变更走版本号。
3. 取消、超时、错误三种路径都有明确事件。

## 7. 版本与兼容

- 建议把上述能力纳入 `dshGo.protocol` v1.3，逐项 feature flag；不要一次性要求全有。
- `native.capabilities()` 返回可用方法名数组；插件据此显示「接缝诊断」。
- 旧版 App 遇到未知字段应忽略，不报错；新版插件遇到缺失方法走降级，不抛异常。
- 每个能力都要有「无此能力」的验收用例，避免插件把缺失当成成功。

## 8. 最小适配路径

WhaleGo 已经把五件事收在 `lib/nativeSeam.js`：

| 方法 | 当前行为 | 原生补齐后 |
| --- | --- | --- |
| `appendVoiceLine(payload)` | 返回 `false`，面板显示 | 调 `bridge.voiceLine(payload)` |
| `setOrb(payload)` | 返回 `false`，只存偏好 | 调 `bridge.orb(payload)` |
| `registerSettings(schema)` | 返回 `false`，用设置面板 | 调 `bridge.settings(schema)` |
| `openAudioStream(options)` | 返回 `null`，用 `media` 整段 | 调 `bridge.audioStream(options)` |
| `openVoiceSession(options)` | 返回 `null`，用点按 STT | 调 `bridge.voice(options)` |

原生侧只需要在 `dshGo.native` 上挂这五个方法；插件其他文件不改。

## 9. 联调用例

1. 假桥：实现五个方法并记录调用，跑 `node --test`；插件应逐项走新路径。
2. 半桥：只实现 `voiceLine`，其余缺失；插件应显示 `voiceLine: ok`、`orb: missing`，不崩。
3. 断网：TTS 失败；文字答案仍完整，语音行标记 `error`，可重试。
4. 长回答：120 秒语音；`audioStream` 首块 2 秒内开播，停止 200 ms 内静音。
5. 打断：语音播放中开口；TTS 200 ms 内停，新 partial 出现。
6. 切会话：语音行不串台；旧流被 abort。
7. 后台：退后台 5 秒；麦克风停、TTS 停、悬浮球暂停；回前台恢复待命。
