# 专题：A/B 双段语音输出（对标 GPT Live）

> 状态：**引擎与 Web 前端已实现**（PR #1 之后），探针与真机验收待补。
> 适用范围：DSH Web UI 的鲸语语音空间（`lib/client.js` + `lib/engine.js`）。

## 0. 一句话目标

一次提问产出两段文字：**A 段是「说出来的话」**，逐句生成、逐句播、按播放进度逐句显示；
**B 段是「写下来的答案」**，在 A 的语境里展开，可选、同源、独立流式。

## 1. 目标效果（用户视角）

### 1.1 时间线

```
0.0s  A 开始生成
0.9s  第一句生成完 → 立即合成 → 开口
1.0s  屏幕显示第一句（跟着声音走）
1.4s  A 全文生成完（B 的上下文就绪）
1.5s  B 请求发出（带 A 全文）
2.5s  B 首字出现，A 还在念第二句
3.5s  A 念完第二句，屏幕露出第二句
7.0s  A 念完、A 段全文显示完；B 已在下方长了一屏
```

关键：**A 的显示由播放进度决定，不由生成进度决定。** 1.4s 时 A 全文已经在内存里，
但屏幕只露出第一句；之后念一句露一句。

### 1.2 两段的规则

| | A 段 | B 段 |
| --- | --- | --- |
| 内容 | 口语化，1–3 句 | 书面，完整 |
| 必有 | 是 | 否（按需） |
| 来源 | 语音脑 | 见 §3.3 |
| 节奏 | 生成一句 → 播一句 → 显示一句 | 独立流式，A 下方 |
| 中断时 | 保留已显示部分 | 保留已生成部分 |
| 回看 | 全文可查 | 全文可查 |

### 1.3 触发规则

不再靠一张 20 个词的正则，改成三层判定 + 继承：

| 层级 | 规则 | 结果 |
| --- | --- | --- |
| 强触发 | 命中任一强词 | 跑 B |
| 弱触发 | 长度 ≥ 24 字；或 ≥ 15 字且带问号 | 跑 B |
| 只跑 A | 寒暄、单字确认、≤ 8 字且无疑问词 | 不跑 B |

**强词表**（在现有基础上扩充）

- 原有：搜索、查一下、查找、整理、对比、比较、排名、榜单、数据、表格、文件、报告、总结、分析、方案、计划、调研
- 动作：帮我写、帮我改、帮我做、部署、安装、翻译、发一下、删掉、生成
- 解释：是什么、区别、原理、举例、详细说说、展开讲讲、优缺点
- 决策：选哪个、推荐、值不值、怎么办
- 代码：报错、代码、函数、接口、bug、异常、日志
- 追问：为什么、如何、怎么

**继承规则**：上一轮判为复杂，这一轮哪怕是「那第二点呢」「继续」也按复杂处理，
避免追问突然掉成单段。取 `history` 里最近一轮的判定结果。

**只跑 A 的否定表**：你好、在吗、谢谢、好的、行、嗯、哈哈、在不在、晚安，
以及 ≤ 8 字且不含问号和强词。

沿用现有 `complexityOf()`（`lib/prompts.js`），但语义要反过来：
现在 `auto` 是「简单→读文本（只有 B），复杂→dual」；目标是「简单→只有 A，复杂→A+B」。

## 2. 现状与差距（代码事实）

| 能力 | 现状 | 证据 |
| --- | --- | --- |
| A 段独立生成 | Web 模式不跑语音脑，A = B 的前 220 字截断 | `engine.js:432` `#runWebVoice` |
| A 段跟读显示 | 文字按生成速度增长，不等播放 | `client.js:1083` `setAnswer(spoken)` |
| A 段逐句播 | 已有：`speech[]` 分句 + 逐句 `/whalego/speak` | `engine.js:802`、`client.js:624` |
| B 段独立显示 | 前端不渲染 `text`，`answer` 是死状态 | `client.js:710`、`:1063` |
| 简单问题只跑 A | 反向：简单问题走 `read`，只跑文本脑 | `engine.js:321` `#selectMode` |
| 打断后上下文截断 | 不截断，全文当历史 | `engine.js:204` `#historyFor`、`:270` `#cancelJob` |

结论：**分句播放已经做好，缺的是「独立 A」「跟读显示」「B 渲染」「heard 截断」「模式反转」。**

## 3. 技术方案

### 3.1 数据流

```
麦克风 → Web Speech → POST /whalego/voice-turn
        ↓
   engine.ask(mode)
        ├─ A: runVoiceBrain(ctx.llm) 逐 token
        │     └─ splitSpeakable → speech[] 分句 → 通知客户端
        │           └─ 客户端逐句 POST /whalego/speak → MediaSource 播放
        │                 └─ 播放回调 → 上报 playedIndex
        ├─ B: A 完成后启动（见 §3.3）
        │     └─ 流式写入 transcript.text → /whalego/live 的 text 字段
        └─ /whalego/live (SSE) 每 400ms 推 {voice, text, speech[], heard, state}
              ↓
        客户端：A 段按 playedIndex 揭示；B 段直接渲染 text
```

### 3.2 引擎改动（`lib/engine.js`）

1. **`#runWebVoice` 重写**：不再用 `spokenOf(text)` 伪造 A；改为
   - `runVoiceBrain({question, history})` 生成 A
   - `onDelta` 里跑 `splitSpeakable(text, cursor)`，新句子立刻 `#captureSpeech` 并 `#notify`
   - A 结束后 `setState('speaking')`，再触发 B
2. **`#selectMode`**：`auto` 改为 `complex ? 'dual' : 'voice'`，新增 `voice` 分支只跑 A。
3. **`#historyFor`**：改用 `record.heard ?? record.voice`。
4. **`#cancelJob`**：把 `heard` 定稿（见 §3.4），`voice` 保持全文。
5. **降级**：宿主没有 `llm` 服务时，退回当前 `#runWebVoice`（读文本脑），并在界面标注"单段模式"。

### 3.3 B 的来源（关键决策，二选一）

**方案 B1（推荐，先做）——直调 LLM，A 作上下文**

- 用 `ctx.llm.prepareCall`，`provider/model` 取自 `sessionController.modelCatalog()`
- 消息里带「问题 + A 全文 + 要求：写完整书面答案，不要复述口语」
- 优点：与 A 同源，绝不会自相矛盾；不污染会话
- 缺点：不进聊天记录、不能用工具、和"文本模式"的答案不完全等价

**方案 B2——走 Session agent**

- 复用今天的 `#text.prompt(question)`，答案进聊天、能用工具
- 但 **Session prompt 无法携带隐藏上下文**（已核对 `dsh-api-session-controller`，
  `prompt()` 只有 `content`，没有 hidden/ephemeral 字段），要让它看见 A 只能再发一条
  用户消息，会污染聊天记录
- 因此 B2 实际上是"A 与 B 各自答一遍"，一致性无解，除非宿主补 `voiceTurn`

**决策规则**：先 B1，等宿主 `native.voiceTurn` 落地后再切 B2。

### 3.4 打断：两个进度，不是一

模型不会自动知道用户听到哪、看到哪——abort 只是切断流，服务端不保留播放状态。
所以必须由引擎显式记录两条进度，并在下一轮注入：

| 字段 | 含义 | 来源 | 用途 |
| --- | --- | --- | --- |
| `heard` | A 段已**播完**的句子 | 客户端 `playedId` 上报 | 语音脑 history |
| `seen` | B 段已**渲染**的范围 | 客户端滚动可见上报 | 文本脑上下文 |

规则：

- `speech[]` 每个 segment 带 `id`，客户端**播完**一句上报 `playedId`
- 打断时（`cancel` / `interrupted` / 流断）把已播 segment 拼成 `heard` 定稿
- **半句丢弃**：正在播但没播完的那句不计入（用户确实没听完）
- `seen` 单独记 B 的进度：用户在下面扫到过的部分，下一轮不能装作没给过
- 界面上 `voice` 仍是全文，只有 history 用 `heard`
- 文本脑的日志改不了，只能在下一轮 prompt 前加一句
  「上一轮你被打断，用户只听到：……，看到：……」让模型对齐

### 3.5 前端（`lib/client.js`）

- 新增 `revealed` 状态：`accept()` 播放某 segment 前把 `revealedIndex` 推一格
- A 段渲染 `speech.slice(0, revealedIndex+1)`；尚未播出的部分不显示
- B 段渲染 `data.text`，独立 `<div class="wg-line text">`，在 A 下方
- 两段都保留"全文可展开"（点击展开显示未播部分 + B 全文）
- 样式沿用 `.wg-line`，A 用大字，B 用正文字号 + 更淡的颜色
- B 段滚动时按可见行位置节流上报 `seen`（IntersectionObserver 即可）

### 3.6 SSE 协议（`/whalego/live`）

现有：`{turnId, sessionId, state, question, voice, text, speech[], generationDone}`

新增：

```json
{
  "reveal": 2,          // 已开播到第几句（-1 表示还没开口）
  "heard": "…",         // 打断后定稿，只读；未打断时为空
  "seen": "…",          // B 段已可见范围，只读
  "heap": "a|b|none",   // 当前是否有 B
  "mode": "voice|dual"
}
```

### 3.7 思考前的过渡语（filler）

**不交给模型说，由引擎本地播。** 现在 `filler` 写在 system prompt 里
（`prompts.js:108`），模型可能不遵守，而且它占了 A 的第一句，反而推迟正文。

做法：

- 启动时预合成 2–3 句 filler（Edge TTS），写入 `speech-cache`，常驻内存
- A 请求发出后 **400ms 内首句没到**，先播 filler（命中缓存，几乎零延迟）
- 首句一到，等 filler 播完立即接上；打断时立刻停
- 按复杂度分档：简单「嗯」/「好，我看看」；复杂「我想想啊，这个得捋一下」
- 提示词里删掉 filler 规则，避免和模型自己说的「我想想」重复；
  若 A 首句仍以 filler 开头，丢弃本地 filler

效果：把 LLM + TTS 的 0.8–2s 空白填掉，听感最接近 GPT Live 的"嗯……"。

## 4. 技术栈

| 层 | 用什么 | 备注 |
| --- | --- | --- |
| 插件宿主 | DSH 插件（Cordis），Node 24 ESM | `lib/index.js` |
| Web UI | React（宿主注入），`h()` 手写，无构建 | `lib/client.js` |
| 传输 | SSE（`text/event-stream`）+ POST JSON | `lib/routes.js` |
| 语音识别 | Web Speech API（`continuous` + `interimResults`） | 浏览器侧 |
| 语音合成 | Edge TTS WebSocket（`api.msedgeservices.com`），长连接 | `lib/tts/edge.js` |
| 音频播放 | MediaSource + `audio/mpeg` 分片 | `client.js:544` |
| 存储 | 插件自有 `transcript.json` + 内存 | 不写会话日志 |
| 测试 | `node --test` + CDP 探针（`tools/live/probe*.mjs`） | 无新依赖 |

## 5. 验收标准

1. 复杂问题：A 第一句开口 ≤ 1.5s；屏幕第一句在开口后 200ms 内出现
2. A 的文字始终不领先语音超过一句
3. B 在 A 生成结束后 ≤ 1s 内开始出字，且首段与 A 不矛盾
4. 简单问题：不产生 B，SSE 里 `heap=none`
5. 打断在第 2 句时：下一轮 history 里只有前 1 句（`heard` 截断）
6. B 段滚动过的部分，下一轮 `seen` 里能看到
7. 首句 400ms 没到就出声：filler 命中缓存，延迟 ≤ 120ms
8. 强词表命中任一 → 一定跑 B；寒暄（你好/在吗）→ 一定只跑 A
9. 全部改动 `node --test` 通过，新增探针通过

## 6. 测试计划

- `test/engine.test.js`：选择模式、A 逐句事件、heard 截断
- 新探针 `probe17`：假识别器发问 → 断言 A 只显示已播部分 → 点球打断 → 断言 `heard` 只有一句
- 新探针 `probe18`：复杂问题出现 B 段，且 B 的首句与 A 语义一致（关键词命中）

## 7. 实施顺序与工作量

| 阶段 | 内容 | 预估 |
| --- | --- | --- |
| P1 | 引擎：`voice` 模式、A 逐句事件、heard/seen 字段 | 0.5 天 |
| P2 | 前端：跟读揭示 + B 段渲染 + `seen` 上报 | 0.5 天 |
| P3 | B1：A→B 同源调用与降级 | 0.5 天 |
| P4 | filler 预合成与 400ms 兜底播放 | 0.25 天 |
| P5 | 测试与探针 | 0.5 天 |
| P6 | （可选）宿主 voiceTurn 落地后切 B2 | 待宿主 |

## 8. 风险与非目标

**风险**

- 首句延迟受 Edge TTS 建连影响（实测冷启 2.0s、复用 0.8s）；需要预连接
- A 与 B 都调模型，成本约翻倍（简单问题可避免）
- 跟读揭示依赖客户端播放回调，页面切后台时可能不同步

**非目标**

- 不做全双工（边说边听、随时插话）——依赖流式 ASR 与回声消除
- 不改 DSH 会话日志格式，不伪造 assistant 消息
- 不做本地 TTS
