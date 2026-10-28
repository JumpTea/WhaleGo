# 工程交接：WhaleGo / 鲸语

这份文档给接续开发的人：读完能知道项目是什么、代码在哪、契约怎么用、还缺什么、怎么验证。

## 1. 一句话

WhaleGo 是 DSH-Go 的双脑语音插件：语音脑先说，文字脑只在复杂问题时随后写；两条输出进入同一个会话窗、同一个消息列表，语音行在上、文字答案在下，不是字幕、弹幕或悬浮窗。音频与文字都流式；简单问题只走语音脑，但用户原问题照常进 DSH 会话；两脑共享同一个会话与上下文。

- 仓库：<https://github.com/JumpTea/WhaleGo>
- 版本：`0.1.0`
- 许可证：MIT（名称、像素鲸形象、标识不随 MIT 授予商标权）
- 宿主：DSH-Go `>= 0.2.1-rc.2 < 0.3.0-0`
- 运行时：Node.js `>= 24`
- 包名：`whalego`；插件目录名建议 `local-whalego`

## 2. 现在做到哪了

已完成：

- 插件清单：`package.json` 的 `dshGo` 字段，含 4 个面板、6 个入口、`audio` 能力、`media` 声明。
- 宿主装配：`lib/index.js` 通过 `ctx.inject(['dshGo'])` 挂载；监听 assistant 流与会话事件；注册 health 路由。
- 双脑编排：语音脑流式出字、文字脑独立回合、TTS、缓存、打断、状态机。Web 半侧已按句流式：`/whalego/live` 下发 `speech[]` 分句，浏览器逐句播放，播完用 `POST /whalego/playback` 回报才落定回合；原生 `media` 路径仍是整段合成。
- 设置：11 组偏好，全部写入 `$DSH_HOME/whalego/prefs.json`；4 个声明式面板。
- 原生接缝：`lib/nativeSeam.js` 对 5 个方法做特性探测与空实现。
- 单测：`node --test`，8 项通过。
- 契约检查：用 DSH-Go 的 `kit-lib-check` 跑过 `--lang zh --load`，无错误。
- 品牌：像素鲸 logo、社交预览图、品牌文案。

未完成 / 需要原生配合：

- 会话内语音行（`voiceLine`）——当前只能进「鲸语实录」面板。
- 流式音频（`audioStream`）——当前用 `media` 整段返回，TTS 整段合成。
- 同会话语音回合（`voiceTurn`）——当前语音脑走独立 `llm.stream` + transcript 上下文，不在 DSH 会话上下文；简单问题也仍会跑文字脑。
- 简单问题 voice-only：用户原问题落库、不产生文字答案——当前 `#selectMode` 的简单分支是 `read`，尚未实现。
- 免手语音会话（`voice`）——当前用原生点按 STT。
- 原生悬浮球（`orb`）——当前只存偏好，没有桥；它只是控制入口，不是输出面。
- 设置迁移到 DSH 插件设置 schema——当前用 `whalego.settings` 面板替代。
- 真机验收：需要一台装 DSH-Go 的 Android 设备；本仓库的测试只覆盖宿主逻辑与契约。
- 宣传片：48 秒 / 60fps 成片见 `assets/promo/whalego-promo-48s.mp4`；Remotion 工程在 `film/`，分镜与混音说明在 `docs/brand.md`。

## 3. 代码地图

```text
WhaleGo/
├─ package.json             dshGo 清单、依赖、版本
├─ index.js                 再导出 lib/index.js 的插件入口
├─ cordis.patch.yml         桌面宿主 profile 的插入声明（DSH-Go 不用）
├─ lib/
│  ├─ index.js              挂载、事件、清理
│  ├─ panels.js             4 个面板 + 设置写回 + 状态条
│  ├─ actions.js            4 个按钮 + media + capability
│  ├─ engine.js             双脑状态机
│  ├─ voiceBrain.js         语音脑
│  ├─ textBrain.js          文字脑（DSH 会话）
│  ├─ transcript.js         语音行 / 文字答案记录
│  ├─ nativeSeam.js         5 个原生接缝探测
│  ├─ views.js              纯视图树
│  ├─ prompts.js            提示词、复杂度、口语裁剪
│  ├─ prefs.js              偏好
│  ├─ routes.js             health
│  ├─ brand.js              品牌常量 + logo data URI
│  ├─ version.js            版本
│  └─ tts/                  Edge TTS + 缓存
├─ test/                    单测与假宿主
├─ tools/brand/             像素鲸生成脚本
├─ assets/brand/            logo 与社交预览
└─ docs/                    架构、接缝、测试、品牌、本文件
```

## 4. 宿主契约

### 4.1 清单

`package.json` 的 `dshGo` 是 App 唯一读取的声明：

```json
{
  "v": 1,
  "title": { "zh": "鲸语", "en": "WhaleGo" },
  "icon": "mic",
  "wants": ["draft", "message"],
  "capabilities": ["audio"],
  "contributes": {
    "composer.actions": [{ "id": "whalego.ask", "label": { "zh": "鲸语", "en": "Whale" }, "icon": "mic", "requires": ["audio"] }],
    "message.actions": [{ "id": "whalego.read", "label": { "zh": "朗读", "en": "Read" }, "icon": "play" }],
    "composer.strip": [{ "id": "whalego.status", "text": { "zh": "鲸语 · 待命", "en": "WhaleGo · idle" }, "panel": "whalego.live" }],
    "panels": [{ "id": "whalego.live", "title": { "zh": "鲸语实录", "en": "WhaleGo Live" }, "icon": "chat", "placement": ["session.tab", "features"] }],
    "media": [{ "id": "speech" }]
  }
}
```

实际文件还有 `whalego.stop`、`whalego.explain`、`whalego.settings`、`whalego.about`、`whalego.diag`。插槽上限：`composer.actions` 2、`message.actions` 2、`composer.strip` 1、`panels` 4；全部已用满。

### 4.2 宿主 API

- `ctx.dshGo.panel(id, { view, data, actions })`
- `ctx.dshGo.on(actionId, handler)`（由 `actions.js` 注册）
- `ctx.dshGo.media(id, handler)`
- `ctx.dshGo.onCapability(handler)`
- `ctx.dshGo.strip(id, handler)`

按钮 handler 返回效果对象：`insert` / `toast` / `copy` / `link` / `open` / `command` / `refresh` / `patch` / `audio` / `voice` / `overlay`。一次最多 4 个；3 秒内返回。

### 4.3 会话

文字脑通过 DSH 会话跑正常回合；语音脑必须走同一个会话的语音回合，不能再用独立的 `llm.stream`：

```js
// 目标形状；当前先用 textBrain + 独立 voiceBrain 降级
await service.voiceTurn({
  sessionId,
  turnId,
  question,
  mode: 'voice-only', // 或 'dual'
  signal,
});
```

`voiceTurn` 负责：用户原问题只写一次、语音脑共享会话上下文、语音输出不产生可见 assistant 消息；`dual` 时再并行跑文字脑的正常 `prompt`。取消用 `service.cancel({ sessionId })`；模型用 `service.modelCatalog()` / `selectModel()`。完整契约见 `docs/native-gaps.md` 第 3 节。

## 5. 双脑流程

```text
ask(scope)
  → 选模式（auto / dual / voice-only / read）
  → 有 voiceTurn：交给宿主写用户消息、建语音消息；插件只消费事件
  → 无 voiceTurn：降级为 textBrain.prompt() + 独立 voiceBrain + appendVoiceLine

media(scope, {key})
  → 首块音频即返回；后续块走 audioStream（无 audioStream 时整段 media）

voice-only:
  voiceTurn(mode:'voice-only')
    → 宿主写一条用户消息
    → 语音消息（context:true）流式更新 → onDelta 全量替换
    → 句子边界 → TTS.synthesize(sentence) → audioStream.write
    → onDone → final 冻结，持久化

dual:
  voiceTurn(mode:'dual')
    → 宿主在同一轮跑文字脑，插件不调 session.prompt（否则用户消息双写）
    → 语音消息（context:false）在上
    → 文字答案（正常 assistant 消息）在下
    → 两条都持久化、各自可复制

audio.ended → finishJob → transcript done → idle
```

关键不变量：

1. 文字答案不来自语音转写，两者独立生成；但共享同一个会话与上下文。
2. 用户原问题由宿主正常写入；语音消息与文字答案都由宿主写入并持久化；插件只按 `lineId` 幂等更新，不伪造 assistant 消息。
3. `dual` 是两条独立 assistant 消息：语音在上、文字在下，各自可复制；语音最多 180 字，文字答案不截断。
4. 简单问题只产生用户消息 + 一条语音消息，不产生文字答案；语音消息就是本轮回答，留在历史里。
5. `stop` / `interrupt` 同时 abort 语音脑、音频流、文字脑、TTS。
6. 没有 `sessionId` 时只 `insert`，不自动发送。

## 6. 原生接缝

`lib/nativeSeam.js` 目前探测五个方法：

| 方法 | 参数 | 返回 | 当前降级 |
| --- | --- | --- | --- |
| `voiceLine` | `{ sessionId, lineId, role, text, final, audioRef, context, order }` | `Promise<void>` | 只写 `transcript`，面板显示；持久消息走 `session.append`，不依赖此方法 |
| `audioStream` | `{ id, contentType, sampleRate, channels }` | `{ write, end, abort }` | **已接入**：TTS 分块直接写入；宿主无此能力时回退 `media` 整段 |
| `attachments`（服务，非原生桥） | `saveFile({ data, name })` | `{ attachmentId, name, bytes }` | **已接入**：语音消息先 `saveFile` 再带 `audio.attachmentId` 落库；宿主没有该服务时不挂载插件（`inject: ['dshGo','attachments']`） |
| `voice` | `{ sessionId, mode, language, vad, partial, onPartial, onFinal, … }` | `{ stop }` | 用原生点按 STT |
| `orb` | `{ visible, style, size, idle, state, sessionId }` | `Promise<void>` | 只存偏好 |
| `settings` | 设置 schema | `Promise<void>` | 面板自渲染 |

`voiceTurn` 与 `voiceInput` **还没有接缝**：文档里定了目标形状，`lib/nativeSeam.js` 里没有对应方法；原生桥落地前先补探测，再改 `lib/engine.js`。

完整字段、事件、验收标准见 [`native-gaps.md`](native-gaps.md)。原生侧在 `dshGo.native` 上挂方法；设置迁移是插件侧改动：把 `whalego.settings` 面板换成 DSH 插件设置 schema，不占原生接缝。

## 7. 运行与验证

```bash
cd WhaleGo
node --test                 # 34 项单测
node --check lib/index.js   # 语法
```

契约检查需要 DSH-Go 的 `kit-lib-check`：

```bash
node <DSH-GO-KIT>/bin/check.mjs . --lang zh --load
```

品牌图：

```bash
python tools/brand/make-brand.py
```

真机验收：

1. 把仓库复制到 `$DSH_HOME/dsh-go/plugins/local-whalego/`。
2. 重载宿主；确认「鲸语」按钮出现在发送区。
3. 输入一句简单问题 → 点「鲸语」→ 听到声音，面板有实录。
4. 输入一句复杂问题（含「整理 / 对比 / 表格」）→ 确认语音与文字都出现。
5. 点「停」→ 声音停止，实录保留已说内容。
6. 打开「鲸语设置」→ 改声线 / 语速 / 悬浮球样式 → 立即生效。
7. 打开「接缝诊断」→ 看五项 `native` 是否 `missing`；未补齐属预期。

## 8. 约束

- **不自定义颜色、字体、像素尺寸、动画曲线。** 只传语义枚举；绘制由 Flutter 负责。
- **不伪造会话记录。** 语音消息与文字答案由宿主写入并持久化；插件只按 `lineId` 幂等更新，不改 DSH 的事件日志。
- **不接触原始麦克风音频。** 只接收文本与事件。
- **不放密钥。** Edge TTS 无需密钥；不要引入需要 token 的 TTS。
- **不暴露实录。** 不新增读取实录的 HTTP 路由。
- **不出现个人信息。** 仓库、文档、素材、提交者身份都不带真名或私人链接。
- **不引入运行时依赖。** Node 24 内置能力足够；新增依赖要先说明理由。
- **所有视图保持纯函数**，能被 `kit-lib-check` 静态跑。

## 9. 已知问题

- `media` 的完成信号依赖 App 的 `audio.ended`；没有时用 6 KB/s 的保守时长兜底，长音频可能提前标记完成。
- 语音脑当前是 LLM 生成，不是语音识别；它拿到的是用户文字，不是麦克风音频。免手对话要等 `native.voice`。
- 语音脑当前用独立 `llm.stream` + transcript 最近几轮，不在 DSH 会话上下文；`voiceTurn` 落地前，两脑上下文不一致。
- TTS 有两条路径：宿主没有附件服务时，`synthesizeStream` → `audioStream.write` 边合成边播（首块等 Edge 连接与 `turn.start`，约 250–400 ms）；有附件服务时，先整段 `synthesize`（约 1.2–1.4 s）并 `saveFile`，再带 `audio.attachmentId` 落库并分块写入 `audioStream`，换取可重放。宿主没有 `audioStream` 时回退整段 `media`。
- 简单问题当前仍会跑文字脑（`#selectMode` 走 `read`）；目标 `voice-only` 尚未实现。
- `appendVoiceLine` 当前传增量，契约要求全量；原生 `voiceLine` 落地前，面板/接缝显示可能重复或丢字。
- 语音消息持久化已实现：插件在回合中 `session.append('assistant/message', {content:[{type:'voice'}]})`，真实会话顺序已实测；客户端是否渲染 `voice` 块仍取决于 App 侧支持。
- 实时转写未实现：说话时没有 partial，用户消息在说完后一次性写入；要等 `voiceInput`。
- 两条消息的上下顺序已由 append 时机保证（实测 seq：用户消息 → 语音 → 文字答案）；客户端渲染顺序待 App 支持。
- 真机上的 Edge TTS 网络可用性未验证；失败会回退文字，不阻塞。

## 10. 下一步

1. 原生侧 P0：`voiceLine`（持久化消息）/ `audioStream` / `voiceTurn`（双脑与两条消息）/ `voiceInput`（实时转写）。
2. 插件侧：补 `openVoiceTurn` / `openVoiceInput` 探测；`voiceBrain` 切到 `voiceTurn`；`#selectMode` 的简单分支改 `voice-only`；`appendVoiceLine` 传全量并带 `context`；TTS 按句流式（Web 侧已接通：SSE 分句 + 播放结束回执；原生 `media` 路径仍是整段）。
3. 插件侧：设置迁到 DSH 插件设置 schema；`orb` 作为 P2 控制入口。
4. 原生侧 P1：免手、VAD、barge-in。
5. 真机跑第 7 节验收，记录到 `docs/testing.md`。
6. 宣传片已出片；改版时改 `film/src/Promo.tsx` 与 `film/public/audio/`，重渲染序列、跑 `tools/promo/mix-audio-48.py`、再 mux。
7. 发布 `0.1.0`：打 tag、写 release notes、附社交预览图与 48 秒成片。

## 11. Web UI 半侧（2026-10-29）

这一节替代上面「原生接缝」在 Web 上的部分；原生 App 侧的问题仍以 §9 为准。

### 已落地

- 输入条活动区注入 32px 麦克风圆钮；点开从底部滑出浅色全屏语音页（460ms，只动 transform/opacity），
  顶部仅 38px ☰，原生输入条始终在下方可用；页面底边由每 500ms 复测的 composer card top 决定。
- 云朵球为离线烘焙的 1024×1024 WebP（`ORB_SKY`，约 11.5KB，base64 后约 15KB），`clamp(168px,54vw,300px)`，
  云层只有缩放/平移；无状态文字、无同心环。
- 聆听（Web Speech zh-CN，1.4s 静音自动发）、思考、逐句说话、全屏点球缩成小球露聊天、点空白打断、☰ 收起留 64px 迷你球、
  原生 ✕ 结束，全部实测通过。
- compact：`.wg-stage` 从居中 `translateY(calc(50dvh - composer - 74px))` 下移、球同时 `scale(.5)`，
  460ms 同一曲线；视觉 27vw，原生聊天可点可滚；底部 210px 白色渐隐；点小球回全屏并在说话时 cancel+重听。
- 语音回合走真实会话：`TextBrain.prompt` → 140ms 轮询 `snapshot` → 分句 `#captureSpeech` → SSE；
  浏览器排空队列且 `generationDone` 才回报 `playback ended`。没有 `prompt` 的宿主自动回退独立语音脑。
- 客户端预取：当前句播放时 `prepare(next)`，实测句间 `ended→playing` 8–22ms。
- typed：原生输入框打字 → 自动 compact、朗读 agent 回答、聊天里保留完整文字。
- 验证：`node --test` 34/34；`tools/live/probe2/3/5/6/8/9/10/11.mjs` 覆盖 430/360/320 宽、入场时长、
  打断/收起/重开、说话中结束、Web Speech 实时转写与自动发送、typed、长输入框、麦克风被拒；`tools/check-playback.mjs` 11 项回执链路。
- 推送注意：本机 `credential.helper` 全局先命中 Git Credential Manager，无缓存时会卡住；
  用 `git -c credential.helper= -c credential.helper=store push origin main` 走 `~/.git-credentials`。

### 待办

- 真机（iOS Safari / Android Chrome）确认 Web Speech 授权、连续识别与 Edge TTS 首句延迟。
- 打字回合目前整轮完成后一次朗读，未逐句流式；如需流式，要把 typed 回合也接 `#captureSpeech`。
- 极长回答的最后几行仍可能落在小球后（DSH 虚拟列表不可安全改）；靠滚动阅读。
- 发布版本号从 0.2.0 起（本次 WebUI 定稿），tag 与 release notes 待用户确认。
