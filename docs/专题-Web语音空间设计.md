# 专题：Web 端「语音空间」设计（对标 ChatGPT 语音）

> 目标：在 DSH Web UI 里点一次麦克风 → 从底部滑出全屏语音空间；一颗云朵球就是界面，
> 说话有实时转写、回答有流式文字与逐句语音；点球缩小下移，露出原生聊天；原生输入框始终可用。
>
> **不改 App / dsh-go 源码。** 纯 WebUI 插件，装到官方 DSH 上即可用。

## 1. 最终形态（2026-10-29 定稿）

参考用户提供的 ChatGPT 手机录屏（720×1559，36s）逐帧实现，浅色、全屏、只有一颗球：

| 元素 | 规格 |
| --- | --- |
| 背景 | 纯 `#f7f7f5`，无渐变、无噪点、无边框 |
| 球 | `clamp(120px, min(54vw,54vh,calc(100dvh - 2*var(--wg-composer) - 24px)), 300px)`，全屏居中略偏下（中心约视口 49%）；430 宽 232，320 宽 173，横屏收小避免压输入条 |
| 球面 | 天蓝天空 + 白色絮状云带，云层很慢地漂移/呼吸；无同心环、无发光底盘 |
| 顶部 | 仅左上 38px 白色圆钮 ☰（收起），无标题、无设置、无状态文字 |
| 底部 | **DSH 原生输入条原样保留**；同一排注入 32px 麦克风圆钮，语音模式中变成黑色 ✕ |
| 状态 | 不显示「正在听 / 正在想 / 正在说」等文字；只用球的呼吸速度、缩放和播放/停止表达 |
| 临时转写 | 聆听时在球下方显示一行灰字，发送后消失 |
| 收起 | 仅左上 ☰ → 底部滑下；**有对话时**右下角留 64px 迷你球，仍可语音问答；空会话收起即结束并恢复首页 |
| 打断 | 说话/思考时点球或点页面空白 → `cancel`，已出现的文字保留 |
| 结束 | 点输入条上的黑色 ✕ → 退出语音模式、停止朗读、迷你球消失 |

### 1.1 录屏测量值

- 全尺寸球约 **392/720 = 54.4vw**，中心在屏幕 49% 处。
- 点球后：球缩到 **196/720 = 27vw**，落到输入条上方；聊天文字（用户右侧浅蓝气泡、答案左对齐）
  从顶部一直排到球上方。
- 输入条始终是「+ / Ask ChatGPT / 麦克风 / 黑色 ✕」，语音页只覆盖它上方，不遮住它。

## 2. 交互规格

1. **入口**：DSH 输入条的活动区注入 32px 麦克风圆钮（slot `conversation.input.activity`）。
   点一次 → 语音页从底部上滑（`translateY(100%) → 0`，460ms `cubic-bezier(.22,1,.36,1)`）。
   没有 slots 的老宿主退回右下角悬浮球。
2. **聆听**：点击手势内直接启动 Web Speech `zh-CN` 实时转写（不放进 setTimeout，iOS 才不会拒绝麦克风）；静音 1.4 秒自动发送，发送前先摘掉 `onresult`，停止识别时不会把同一句再发一次。麦克风被拒、没有设备或识别服务断网时，球下给出可操作的中文提示，仍可直接打字。
   浏览器不支持 / 未授权时，球下方给一句错误提示，原生输入框仍可用。
3. **思考**：球轻微收束，云层变慢；不出现转圈、进度条或文字。
4. **说话**：
   - 用户问题通过 `TextBrain.prompt` **真正写入 DSH 会话**，因此原生聊天里能看到这一轮；
   - 引擎把 agent 的流式回答每 140ms 取一次，按句切分，通过 SSE `speech[]` 下发；
   - 浏览器逐句入队，当前句播放时预取下一句（`/whalego/speak`），句间几乎无空档；
   - 队列排空且 `generationDone` 后，浏览器 `POST /whalego/playback {state:'ended'}`，
     引擎收到回执才把回合落定为 `done`。
5. **点球**：
   - 全屏说话/思考中 → 停止聆听并缩成 27vw 小球，落到输入条上方，露出原生聊天；
   - 小球点一下 → 回到全屏；若正在说话则先 `cancel`（打断），260ms 后重新开始聆听；
   - 全屏待命/说完 → 已有聊天时缩成小球，否则直接开始聆听。
6. **打字**：原生输入框打字照常走 DSH；插件把这一轮的回答镜像进语音页并朗读，
   同时自动缩成小球，让用户看着原生聊天里的文字流。
7. **打断**：全屏待命以外，点球即打断；点页面空白只在说话/思考时打断（聆听时点空白不误杀）。
8. **收起 / 结束**：有对话时 ☰ 收起留迷你球；空会话收起直接结束并恢复首页；点原生 ✕ 结束语音模式。
9. **无障碍 / 动效**：控件有 `aria-label`，状态经隐藏的 `aria-live` 播报；
   `prefers-reduced-motion` 下过渡缩短到 1e-5s，云层停止漂移。

## 3. 视觉实现

- 球面不是运行时 SVG 滤镜，而是**离线烘焙的 1024×1024 WebP**（约 11.5KB，base64 内联进
  `lib/client.js` 的 `ORB_SKY`），保证低端机也不掉帧。
  - 生成：`tools/live/orb.html` + `orbgen.mjs`（Edge headless canvas → `toDataURL('image/webp',0.92)`）；
  - 回填：`tools/live/embed-orb.mjs` 用正则替换 `const ORB_SKY = "…";`，可重复跑。
- 球只用 `transform` / `opacity` 动画：`::before` 是云层，`@keyframes wg-sky` 做 1.03→1.09 缩放
  与 ±2% 平移，9s 一轮；聆听/说话/思考分别 5.6s / 4.2s / 7.4s。
- 小球不是换一套布局，而是**同一颗球的连续位移**：`.wg-stage` 从居中
  `translate3d(0, calc(50dvh - var(--wg-composer,140px) - 74px), 0)` 下移，`.wg-orb` 同时 `scale(.5)`，两者共用
  460ms `cubic-bezier(.4,.1,.2,1)`。视觉直径 27vw，中心从 49% 落到 76%，
  不改变布局盒，也不触发重排。
- 语音页底部 `bottom: var(--wg-composer)`；`--wg-composer` 由插件每 500ms 重新测量
  DSH composer 卡片的 `top` 得出（`innerHeight - top + 6px`），会话切换、键盘弹起、
  输入框长高都能跟上，永远不会盖住原生输入条。
- 小球下方有一层 210px 的白色渐隐，让聊天文字自然淡出到球后；不修改 DSH 消息 DOM。

## 4. 宿主接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/whalego/health` | 插件与语音引擎探活 |
| GET | `/whalego/voices` | 可用音色 |
| GET | `/whalego/session` | 取最近活会话；没有则建空会话 |
| POST | `/whalego/voice-turn` | `{sessionId,text}` 启动语音回合，返回 `{effect:{key}}` |
| GET | `/whalego/live?turn=&sessionId=` | SSE：`state` / `voice` / `text` / `speech[]` / `generationDone` |
| POST | `/whalego/speak` | `{text}` → `audio/mpeg` 分块流 |
| POST | `/whalego/playback` | `{sessionId,turnId,state}`：`ended` 落定 / `stopped` / `error` |
| POST | `/whalego/cancel` | `{sessionId}` 打断 |

## 5. 实现要点（为什么这样做）

- **语音回合必须走真实会话**：`#runWebVoice` 先 `TextBrain.prompt`，再轮询
  `#text.snapshot(sessionId).text` 增量切句；这样原生聊天才有内容，compact 露出的不是空页。
  宿主没有 `sessionController.prompt` 时回退到独立语音脑（`#runWebVoiceBrain`），保证老宿主与单测可跑。
- **同会话**：slot 的 `sessionId` 标准属性被记为 `boundSession`，语音回合优先用它，
  不再用「最近一个活会话」去猜；用户切会话时 slot 重新渲染即更新。
- **流式起播**：`createPlayer` 在 MediaSource 第一个 `updateend` 后就 `element.play()`，
  不等整个 response body，首句不会等到全文结束。
- **预取**：`prepare(text)` 先取完整 Blob 缓存（上限 10 句），当前句播放时预热下一句；
  实测句间 `ended→playing` 只有 8–22ms。
- **指针事件**：host 根节点 `pointer-events:none`，只有球、顶部按钮、slot 可点；
  关闭态整棵子树 `pointer-events:none`，不会挡住原生输入条和会话列表。
- **按钮形态**：slot 从 65px 胶囊改成 32px 圆钮；360/320 宽下模型名会截断，
  但麦克风 / ✕ 仍可点，不横向溢出。

## 6. 验收

- `node --test`：**35/35**（含 player 预取、speaker 预热/停滞判定、iOS 解锁、真实会话语音回合、回执落定）。
- `node tools/check-playback.mjs`：8 条路由 + 11 项回执链路，真 HTTP + 桩语音脑。
- 浏览器探针（`tools/live/probe2.mjs` / `probe3.mjs` / `probe5.mjs` / `probe6.mjs` / `probe8.mjs` / `probe9.mjs` / `probe10.mjs` / `probe11.mjs` / `probe12.mjs` / `probe13.mjs` / `probe14.mjs` / `probe15.mjs`）：
  - 430×932：全屏球 232（聆听 241）、composerInset 146、compact 球 116、原生输入框可见；
  - 360×800 / 320×700：无横向溢出，slot 可点，composer 不被盖住；
  - 交互状态机：说话 → compact（继续播）→ 点球打断并聆听 → ☰ 收起 → 迷你球重开聆听 → 待命时点球 compact；
    说话中收起再重开，回合与音频都保留，不会起第二个识别器；说话中点原生 ✕，音频停止、迷你球消失；
  - 入场 458–483ms / 收起 433–451ms，帧间隔最大 80–90ms；键盘态 600px 高时 space 底 454、card 顶 460（6px 缝）；
  - Web Speech：假识别器给出 partial 时球下显示实时转写；final 后 1.4s 静音自动发，原生聊天出现问题与回答；
  - typed：全屏时在原生输入框打字 → 自动 compact、聊天出现完整回答、朗读该回答。
  - `probe10`：原生输入框被多行文字撑高时，语音页底部跟着上移，球始终在输入条上方约 23px。
  - `probe11`：模拟麦克风 `not-allowed`，球下给出中文提示、phase 回 idle，✕ 仍在，可直接打字。
  - `probe12`：掐断 `/whalego/live`，球下提示「语音流断了，请再点一次球重试。」、phase 回 idle，
    同时取消后端回合；点球重试回到聆听、提示消失。
  - `probe13`：说话中丢弃流，本地音频立即 stopped、提示出现；点球重试回 listening。
    另有 12s 无新帧且队列排空时的停滞判定，防止球永远停在「正在说」。
  - `probe14`：430×932 与 932×430 两种视口，球都完整落在语音页内；竖屏仍是 232/241，横屏收小到 125，不压输入条。
  - `probe15`：空首页开/关语音模式，卡片从 487 推到底 792，收起后回到 487 且 `data-whalego-mode=0`，不再把首页标题压在底部。
- 真机仍需用户确认：iOS Safari 的 Web Speech 授权与连续识别、真实网络下 Edge TTS 首句延迟。

### 6.1 手机验收清单（交给用户）

1. 点输入框右侧的麦克风圆钮：整页上滑成全屏云球，第一次会弹麦克风授权；不允许时应看到球下的中文提示，仍可打字。
2. 说一句短问题，停 1.4 秒：球下应出现自己的实时转写；随后球进入聆听→思考→说话，第一句应尽早出声。
3. 点全屏球：球应在约 0.46 秒内缩到 27vw 并落到底部输入条上方，原生聊天露出，答案逐字出现。
4. 在原生输入框打字并发送：页面应自动进入 compact，聊天出现答案，同时用语音朗读。
5. 再点小球：应回到全屏并重新聆听；说话中点小球应停止朗读并立刻开始听；**有对话的页面**点 ☰ 收起后，右下角 64px 迷你球仍可继续问；空首页收起应直接结束并恢复居中首页。
6. 点输入框里的黑色 ✕：应结束语音模式，slot 回到麦克风图标，迷你球消失。

## 7. 已知限制

- 原生聊天是 DSH 自己的虚拟列表。插件**不修改**它的 DOM；极长回答的最后几行可能落在球后，
  向上滚动即可读到（球的缩放锚定底部后，常见 2–4 行答案已经能完整露出）。
- 打字回合的朗读在 agent 完成整轮后开始（一次读完），不是逐句流式；语音回合是逐句流式。
- Web Speech 依赖浏览器与网络；不可用时退回原生输入框打字，语音页仍可打开。

## 8. 参考

- 用户录屏：`Screenrecorder-2026-10-28-07-39-03-220.mp4`（720×1559，ChatGPT 语音模式）。
- PCMag：ChatGPT 把语音移进聊天窗口 <https://www.pcmag.com/news/chatgpt-brings-voice-mode-into-conversations-no-separate-interface>
- Geeknetic：旧版全屏「浮动光球」、逐行转写、可中途打断 <https://www.geeknetic.es/Noticia/36691/La-nueva-integracion-de-voz-de-ChatGPT-unifica-conversacion-texto-y-controles-en-un-mismo-flujo-y-convierte-el-chat-en-una-experiencia-casi-natural.html>
- TechRadar：语音与文字融合的体验评价 <https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpts-new-voice-integration-feels-like-the-missing-piece-in-ai-chat-ive-tried-it-and-its-almost-perfect>
