# 专题：Web 端「语音空间」设计（对标 ChatGPT 语音）

> 目标：点悬浮球 → 直接进入语音对话，全屏、全流式、可打断；视觉按苹果宣传片的完成度做，
> 而不是做一个「面板 + 播放列表」。本文记录调研结论、交互规格与验收方式。

## 1. 调研结论（2026-10-27）

公开资料里 ChatGPT 语音形态分两代：

| 形态 | 交互 | 结论 |
| --- | --- | --- |
| 旧版「语音模式」 | 全屏深色空间，中间一个会呼吸的**光球**；说话时球随音量起伏，字幕在下方逐行出现；点一下即打断 | 用户要的就是这一代：**球就是界面**，没有列表、没有播放按钮 |
| 新版「语音并入聊天」 | 语音变成聊天里的一个按钮，转写在消息流里逐行出现，回答同时有语音与文字 | 我们保留：语音回合结束后，文字答案仍然落在 DSH 会话里 |

要点（来源见文末）：

- 语音界面**不展示历史语音列表**，历史属于聊天；语音空间只服务「这一次对话」。
- 说话时**实时转写**，转写逐行增长；回答时同样有文字跟随语音出现。
- 打断是**单击**，不是找停止按钮；打断后保留已经说出的内容。
- 状态靠**光球的形态与动效**表达（待命 / 聆听 / 思考 / 说话），不靠文字标签。
- 视觉语言：深色空间 + 单一发光体 + 大量留白；没有边框、卡片、进度条。

## 2. 交互规格（本插件）

1. **入口**：右下角悬浮球（可拖动）。单击 → 全屏语音空间（不是面板）。
2. **待命**：光球缓慢呼吸，底部一句「点一下，开始说话」。
3. **聆听**：请求麦克风；用 Web Speech API 做实时转写，转写逐字上屏；球随输入音量轻微起伏。
   - 浏览器不支持 / 未授权时，退化为「打字说一句」，输入框就在同一位置，不弹新窗口。
4. **思考**：转写定格，球收束、亮度降低，出现极细的环形进度。
5. **说话**：文字逐字出现（来自 `/whalego/live` 的流），音频按**句**流式播放：
   SSE 每帧带 `speech[]`（已切好的完整句子，`generationDone` 表示后文不再增长），
   客户端按句子顺序入队、一句播完再播下一句（`/whalego/speak` 用 MediaSource 边下边播），
   所以第一句在生成还没结束时就已经在响。
   - 播放结束由浏览器回报：队列排空且 `generationDone` 为真时 `POST /whalego/playback {state:'ended'}`，
     引擎收到回执才把回合置为 `done`（Web 侧的 `audio.done`）。
6. **打断**：任意位置单击 → `POST /whalego/cancel`；已出现的文字保留，球回到待命。
7. **退出**：左上角「收起」返回聊天；会话内容仍然在聊天里。
8. **无障碍**：所有控件有 aria-label；`prefers-reduced-motion` 时关闭大幅动效。

## 3. 视觉规格（苹果味）

- 背景：`#05070d` → `#0b1220` 的径向渐变，叠两层缓慢漂移的极光色块（`#4D6BFE` / `#36E2C7`），
  模糊 80–120px，透明度 0.25；再叠 4% 噪点，避免「塑料渐变」。
- 光球：直径 `min(46vw, 260px)`；三层结构：
  1. 内核：`radial-gradient` 白→浅蓝→深蓝，边缘 1px 高光；
  2. 流体：两层旋转的 conic-gradient，`filter: blur(18px)`，速度随状态变化；
  3. 光晕：`box-shadow` 大范围扩散 + 轻微脉动。
- 字体：`-apple-system, "SF Pro Display", "PingFang SC"`；标题 17px/600，正文 15px/400，行高 1.6。
- 动效：进入 420ms `cubic-bezier(.22,1,.36,1)` 缩放淡入；状态切换 600ms 缓动；不做弹跳。
- 控件：仅左上「收起」与底部一行提示；不使用卡片、边框、阴影盒子。

## 4. 宿主接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/whalego/session` | 取最近活会话；没有则建空会话 |
| POST | `/whalego/voice-turn` | `{sessionId,text}` 启动语音回合，返回 `{effect:{key}}` |
| GET | `/whalego/live?turn=&sessionId=` | SSE：`state` / `voice`（全量文本）/ `text` / `speech[]`（可播的分句）/ `generationDone` |
| POST | `/whalego/speak` | `{text}` → `audio/mpeg` 分块流（MediaSource 播放） |
| POST | `/whalego/playback` | `{sessionId,turnId,state}`：`ended` 播放完毕（回合落定）/ `stopped` / `error` |
| POST | `/whalego/cancel` | `{sessionId}` 打断 |

## 5. 验收

- `node --test` 全绿。
- 真 key 冒烟（`tools/smoke-web.mjs`）：多轮、工具（读文件）、文件写入、流中取消，四项全过。
- CDP 截图：全屏空间、聆听、思考、说话四个状态各一张；球不遮挡文字。
- 模拟器内 dsh-go WebUI 打开同一页面，面板可用。

## 6. 参考

- PCMag：ChatGPT 把语音移进聊天窗口 <https://www.pcmag.com/news/chatgpt-brings-voice-mode-into-conversations-no-separate-interface>
- Geeknetic：旧版全屏「浮动光球」、逐行转写、可中途打断 <https://www.geeknetic.es/Noticia/36691/La-nueva-integracion-de-voz-de-ChatGPT-unifica-conversacion-texto-y-controles-en-un-mismo-flujo-y-convierte-el-chat-en-una-experiencia-casi-natural.html>
- TechRadar：语音与文字融合的体验评价 <https://www.techradar.com/ai-platforms-assistants/chatgpt/chatgpts-new-voice-integration-feels-like-the-missing-piece-in-ai-chat-ive-tried-it-and-its-almost-perfect>
