# 架构

WhaleGo 是 DSH-Go 的宿主插件：代码跑在手机 rootfs 的 Node 24 里，界面由 DSH-Go 的 Flutter 按声明绘制。插件不注入 CSS，不画像素，也不持有麦克风。

## 1. 运行时边界

```text
┌────────────────────────────────────────────┐
│ DSH-Go App (Flutter)                       │
│  ├─ 读 package.json 的 dshGo 清单           │
│  ├─ 画 16 种声明式组件                      │
│  ├─ 播放 audio 效果 / 管理麦克风与前台        │
│  └─ 原生接缝（voiceLine / orb / settings…）  │
└───────────────▲────────────────────────────┘
                │ JSON 视图、效果、media 请求
┌───────────────┴────────────────────────────┐
│ WhaleGo host plugin (Node 24)              │
│  ├─ 面板 / 按钮 / 状态条 / health 路由       │
│  ├─ 双脑编排                                │
│  ├─ Edge TTS + 缓存                         │
│  └─ 偏好与实录（$DSH_HOME/whalego）          │
└────────────────────────────────────────────┘
```

App 只执行声明，不执行插件代码；插件只返回 JSON 与音频字节。两边的契约是 `package.json` 的 `dshGo` 字段、视图 schema、效果 schema 与 `ctx.dshGo` 方法。会话消息（用户原问题、语音消息、文字答案）由 DSH 原生持有并持久化；语音消息是会话列表里的正式记录，刷新与重进都在，和文字答案同列，不走 overlay。`dual` 时它是本轮第一条 assistant 消息，文字答案紧随其下。

## 2. 模块

| 文件 | 职责 |
| --- | --- |
| `lib/index.js` | 插件入口：`ctx.inject(['dshGo'])` 后挂载；注册面板、按钮、路由、事件；卸载时清理 |
| `lib/panels.js` | 4 个面板的 `view` / `data` / `actions`；设置写回；状态条订阅 |
| `lib/actions.js` | 注册 4 个按钮、`media('speech')`、`onCapability` |
| `lib/engine.js` | 双脑状态机：`ask` / `stop` / `read` / `explain` / `media` / 事件 / 快照 |
| `lib/voiceBrain.js` | 语音脑：短句、过渡词、流式增量 |
| `lib/textBrain.js` | 文字脑：调用 DSH 会话，观察 assistant 流与 turn/end |
| `lib/transcript.js` | 会话内语音行与文字答案的记录、节流落盘、按会话取最近 N 轮 |
| `lib/tts/index.js` | TTS 服务：缓存、并发、取消、错误映射 |
| `lib/tts/edge.js` | Edge read-aloud WebSocket，输出 mp3 |
| `lib/tts/cache.js` | 按文本 + 声线 + 语速做内容哈希缓存 |
| `lib/nativeSeam.js` | 原生接缝特性探测；五个可选方法的空实现 |
| `lib/views.js` | 纯视图树与文案；不依赖宿主，能被检查器直接跑 |
| `lib/prompts.js` | 提示词、复杂度判断、口语裁剪、语速映射 |
| `lib/prefs.js` | 偏好默认值、归一化、原子写 |
| `lib/routes.js` | 只读 health；不暴露实录 |
| `lib/brand.js` | 品牌常量、仓库地址、内嵌 logo data URI |

## 3. 双脑时序

```text
用户点「鲸语」
  │
  ├─ engine.ask(scope)
  │    ├─ 取 scope.draft 与 scope.sessionId
  │    ├─ 选模式（auto / dual / voice-only / read）
  │    ├─ 把用户原问题写入 DSH 会话（voiceTurn / appendUser）
  │    ├─ transcript.start(turnId, sessionId, question)
  │    └─ 返回 { type:'audio', op:'play', src:'media:speech', key:turnId }
  │
  ├─ App 调 media('speech') → engine.media(scope, {key})
  │
  ├─ engine.#runTurn
  │    ├─ voice-only / dual 都先跑 #runVoice
  │    │   ├─ 同一会话上下文 → voiceBrain.stream()
  │    │   │    ├─ onDelta → transcript.appendVoice + seam.appendVoiceLine(full text)
  │    │   │    └─ 句子边界 → TTS.synthesize(sentence) → audioStream.write(chunk)
  │    │   └─ 首块音频就开播，不等整段生成
  │    └─ 仅 dual 才 textBrain.prompt() 并行
  │         └─ 同一会话产生 assistant 流
  │              ├─ onAssistantFrame(text-delta) → transcript.setText
  │              └─ frame end → transcript.setText(final)
  │
  ├─ media 返回首块音频；后续块由 audioStream 追加
  │
  └─ App 播放；结束后发 onCapability('audio.ended')
       └─ #finishJob → transcript done → 状态回 idle
```

关键点：

- **语音行和文字答案在同一消息列表。** 语音消息是会话里的持久记录，排在当前轮文字答案上方；不用 `overlay`、字幕条、弹幕或第二条悬浮窗。
- **两脑同会话、同上下文。** 语音脑不再用独立的 `llm.stream` + 最近几轮 transcript，而是走会话内的 voice turn，能看到和文字脑相同的历史、工具与环境；简单问题只跑语音脑，但用户原问题照常落进会话。
- **文字脑不经过语音脑。** 两者拿到同一个问题，独立生成；语音脑的口语上限不影响文字答案。
- **全流式。** 语音文字按 delta 更新 `voiceLine`；TTS 按句合成，首块音频立即写进 `audioStream`，不整段等待。
- **音频播完才收尾。** App 的 `audio.ended` 是主信号；没有事件时用「字节数 / 6000 + 1.2s」的保守计时兜底。

## 4. 状态机

```text
idle ──ask──▶ thinking ──首块音频──▶ speaking ──audio.ended──▶ done ──▶ idle
  │                │                     │
  │                ├──error──────────────▶ error ──▶ idle
  │                └──stop───────────────▶ interrupted ──▶ idle
  └──read/explain──▶ thinking …
```

- `thinking` 覆盖语音脑生成与 TTS 合成。
- `speaking` 只在 `media` 返回字节后设置；`audio.ended` 或兜底计时回 `done`。
- `stop` 会 abort 当前 `AbortController`、取消文字脑回合、把记录标记为 `interrupted`，并返回 `audio.stop`。
- `interrupt` 也由 `voice.speechStart` / `voice.stopped` 触发，用于 barge-in。

## 5. 模式选择

```text
prefs.mode === 'dual'  → dual
prefs.mode === 'read'  → read（只朗读已有答案，不开语音脑）
prefs.mode === 'auto'  → complexityOf(question, previous)
                         ├─ 命中强词 → dual
                         ├─ ≥24 字，或 ≥15 字带问号 → dual
                         ├─ 上一轮是复杂、且这句是追问 → dual
                         └─ 其余（含寒暄）→ voice-only
```

`complexityOf` 是启发式，不是模型判断；voice-only 只省掉文字脑，不省用户消息。判断错时用户仍能看到语音行，并可手动切 dual。

强词表在 `lib/prompts.js` 的 `STRONG`：动作（帮我写 / 部署 / 翻译）、解释（区别 / 原理 / 举例）、
决策（选哪个 / 推荐）、代码（报错 / 接口 / bug）、原有查询类。寒暄走 `CASUAL` 否定表，永远只跑语音。

## 6. 数据与隐私

| 数据 | 位置 | 生命周期 |
| --- | --- | --- |
| 偏好 | `$DSH_HOME/whalego/prefs.json` | 持久；原子写；损坏时回默认 |
| 实录 | `$DSH_HOME/whalego/transcript.json` | 持久；只留最近 N 轮；可清空 |
| TTS 缓存 | `$DSH_HOME/whalego/cache/*.mp3` | 持久；按内容哈希；可关 |
| 音频字节 | 内存 | 请求结束即释放；不落盘为临时文件 |
| 健康路由 | `/whalego/health` | 只返回 `{ ok, version, uptime }`，不含会话内容 |

不发麦克风音频，不把实录暴露成 HTTP，不在日志里写用户问题全文。TTS 只把要朗读的文本发给 Edge。

## 7. 原生接缝与降级

`nativeSeam.js` 在构造时做一次特性探测：

```js
voiceLine:   typeof bridge.voiceLine === 'function'
audioStream: typeof bridge.audioStream === 'function'
voiceTurn:   typeof bridge.voiceTurn === 'function'
voiceSession: typeof bridge.voice === 'function'
orb:         typeof bridge.orb === 'function'
```

每个方法失败都返回 `false` / `null`，不抛异常；引擎据此走面板、设置页、整段 `media`、点按 STT 的降级路径。接缝诊断面板把 `declared` 与 `native` 并列，避免「声明了但没实现」被误判为成功。

## 8. 失败模式

| 失败 | 处理 |
| --- | --- |
| 没有 `sessionId` | 返回 `insert` + toast，提示发送后点消息上的「朗读」 |
| 空输入 | `{ toast: '先写一句话。' }`，不创建任务 |
| 没有 `voiceTurn` | 退回 `session.prompt`；用户消息仍进会话，语音脑只能用 transcript 上下文（降级） |
| 没有 `audioStream` | 用 `media` 整段播放；首声延迟变大，句间可能有空档 |
| 没有 `voiceLine` | 用「鲸语实录」面板；不伪造 assistant 消息 |
| 语音脑超时 / 空 | 用 `VOICE_FALLBACK`（「我先看一下，答案在下面。」） |
| 文字脑报错 | 记录 `error`，语音仍可播；诊断面板可见 |
| TTS 失败 | `media` / `audioStream` 抛 `WhaleError`；App 显示人话错误；文字答案不受影响 |
| 音频 key 过期 | 3 分钟后清理任务；提示「这段语音已过期，请再点一次。」 |
| App 不发 `audio.ended` | 兜底计时标记完成 |
| 用户打断 | abort 信号贯穿语音脑、文字脑、TTS；迟到结果丢弃 |
| 会话切换 | `transcript` 按 `sessionId` 隔离；旧任务 abort |

## 9. 扩展点

- **加一种声音**：`prompts.js` 的 `VOICES` + `views.js` 的 `VOICE_LABELS`；Edge 声线名直接透传。
- **加一种悬浮球样式**：`views.js` 的 `ORB_STYLE_LABELS` + `prefs.js` 默认值；原生侧枚举同步。
- **加一种模式**：`engine.#selectMode` + `prompts.MODES`；不要改视图 schema。
- **接原生新方法**：只在 `nativeSeam.js` 加一个 `typeof` 探测与一个转发方法；引擎不改。
- **加语言**：`stripText` 与视图文案走 `locale`，音频仍按声线选择。

## 10. 约束

- 不引入第三方运行时依赖；Node 24 内置 WebSocket、fetch、crypto。
- 不伪造 `assistant` 消息；用户原问题由宿主正常写入，语音消息由宿主持久化，插件只按 `lineId` 幂等更新。
- 语音行和文字答案必须在同一个会话消息列表里，不用 overlay / 字幕 / 弹幕 / 浮窗替代。
- 不自定义颜色、字体、像素尺寸、动画曲线；只传语义枚举。
- 所有视图节点可被 `kit-lib-check` 静态检查；`views.js` 保持纯函数。
