# 专题：逆向 dsh-orb 与两侧融合（2026-10-30）

> 对象：npm `dsh-orb@0.2.0`（源码包，MIT；上游 GitHub `mini-yifan/dsh-orb-cordis`，291 stars）。
> 方法：解包 npm tarball 全量读源（`dist/host` 727KB bundle 主插件 + `dist/computer-use` + `dist/voice` + `client.js` 设置页 + `cordis.patch.yml` 插入清单）。
> 本文：逆向事实 → 融合方案（吸收/共生/不搬三档）→ 一批已落地的实现 → Credit（MIT）。

## 0. 一句话结论

**dsh-orb 是「悬浮球伴侣插件」：独立 Electron helper 球窗 + Computer Use（13 个 GUI 工具）+ 双轨 agent + 本地语音三件套（唤醒词/听写/播报）。**
它与 WhaleGo 是同一宿主（DeepSeek Harness，同 peerDependencies 集）的不同插件。融合的正确姿势是
「**能力吸收 + 运行时共生**」，不是把 149MB 原生依赖搬进 WhaleGo。

## 1. 逆向事实

### 1.1 插件形态

| 项 | 值 |
| --- | --- |
| cordis 名 | host=`orb-host`；设置页=`ui-settings-orb`（主包 lib/index.js 只有它） |
| 插入方式 | 自带 `cordis.patch.yml`：注入 Computer Use preset（persona+shell+pwsh+web+ask-user+computer-use 工具+code_agent）+ code-agent-registry + orb-host(autoStart) + 设置页 |
| peer 服务 | 与 WhaleGo 同一套 `@deepseek-ai/dsh-*`（session/llm/tools/attachment/user-approval/user-questions/system-prompt/session-projection/agent-default-model…） |
| 兼容范围 | `>=0.1.7-rc.2 <0.3.0-0`；构建基线 0.1.7-rc.2（WhaleGo 现测宿主 rc.5 在范围内） |
| 平台 | 球窗 darwin/win32；Linux 只装不建球（后台 code_agent 仍可用） |
| 本机状态 | **未安装**（`~/.dsh/dsh-orb` 不存在；profile 目录无 `orb-*.json`） |

### 1.2 host（orb-host）

- 注入 6 服务：`webServer, connection, sessionController, workspaceController, sessions, agentDefaultModel`。
- 启动链：`apply → ProfileStore(profile dir) → OrbRuntime → installOrbServices → watchOrbPermissions/Routes/Appearance → runtime.start()`。
- **Electron helper**：按 SHA-256 pin 的官方 Electron 发行包，首次使用下载到 `~/.dsh/dsh-orb/electron-runtime`（断点续传/停滞守卫），独立 `userData` 进程，`ELECTRON_RUN_AS_NODE` 处理、随机 32 字节 token 走环境变量、NDJSON loopback socket；watchdog 断线退一次、宿主最多重建 3 次。
- `installOrbServices` 只提供两个 ctx 服务：`orbCodeAgentModel`（后台轨模型选择）、`orbCoordinateMode`（千分比/像素坐标）。
- 权限三层 `PERMISSION_PRESETS = ["read-only","workspace-write","danger-full-access"]`（默认 full）：`session/created` 时按「computer-use/standard preset + cwd 在球工作区」判断本球会话并 `permissionPresets.set`。

### 1.3 偏好文件（都在官方 profile 目录下 = `profileContext.dir`）

```
ball-enabled.json         球开关（关球后 Computer Use 主窗口仍可用）
orb-avatar.json           头像：内置 6 动图 id 或自定义 GIF/PNG/WebP（4MB 上限）
orb-agent-models.json     两轨各一对 模型+思考强度（overlay=球 / background=code_agent）
orb-permission.json       三层权限
orb-voice.json            语音全部设置（§1.5）
orb-history.json          球会话历史保留规则
millifraction-coordinates.json / observation-frame.json / orb-workspace.json /
orb-update.json / orb-whats-new.json / selection-toolbar.json / blank-sweep.json
```

另有 `~/.dsh/dsh-orb/`：`electron-runtime`（球运行时）、`voice/kws`、`voice/tts`（模型权重）、`floating-session.json`。

### 1.4 web 路由（挂在宿主 webServer，前缀 `/.dsh-orb`）

`GET settings/models/tcc/update`、`avatar`（仅 helper 凭 socket token 可读）、
`ball / jump / history / workspace / runtime / voice`（双向）、
`overlay-model / background-model / millifraction / observation-frame / selection / settings-open / whats-new`。
主窗口浏览器凭登录 cookie 直连；helper 只能凭 socket token 读 avatar。

### 1.5 voice 配置 schema（`orb-voice.json`）

```ts
{
  voiceEnabled: false,          // 总开关
  wakeEnabled: true,            // 球收起时唤醒
  wakeWords: ["你好大肥鱼"],     // 多词 ≤8，每词 ≤40 字
  wakeThreshold: 0.25,          // 唤醒敏感度 0.05–0.9
  wakeScore: 1, wakeChunk: 8,   // KWS 判定粒度
  wakeCooldownMs: 1500,         // 0.5–5s
  wakeReply: "我在呢",           // 唤醒回应 ≤80 字
  commandEnabled: true,
  interjectKeyword: "大肥鱼",    // 说话中插话（打断球正在说的）
  dismissPhrases: ["你退下吧","退下吧","退一下吧"],  // 停 + 收起
  dismissReply: "好的，再见",
  ttsEnabled: true,
  ttsBackend: "local",          // local=Matcha(~197MB HF 权重) | "qwen"=百炼 API key
  qwenApiKey, qwenVoice: "Cherry", qwenSpeed: 1.4,
  questionPrompt: "我有几个问题，你来选一个？",  // 提问卡口头语
  ttsSpeed: 1.5, ttsVolume: 1,  // 音量 0–2
  idleMs: 30000                 // 空闲多久停听
}
```

听写用宿主已管的 SenseVoice；唤醒模型是 npm `dsh-orb-kws`（~9MB，npmmirror→npmjs→GitHub 三级源）；
麦克风数据本地子进程解码，仅 Qwen TTS 出网。

### 1.6 computer-use（`dsh-orb/computer-use`，13 个 GUI 工具）

`click`（单/双/右击+修饰键）`input_text` `scroll` `hotkey` `long_press` `drag` `wait` `long_wait`
`screenshot`（存桌面+复制剪贴板）`open_in_browser` `open_in_finder` `list_apps` `open_app`；
`defineTool`（dsh-tools）实现，FFI 用 koffi（prebuild 打包，首次运行 stage 到 `~/.dsh/dsh-orb/native`）；
截图自动剔除球/面板/观察边框，点击穿透；操作期间前窗加「观察边框」；
`code_agent / code_agent_status / code_agent_stop` 派发后台标准会话（球闲时完成摘要回球）。

### 1.7 双轨判定（无独立分类器）

不变式：**所有消息先进球内 Computer Use agent**——可见 GUI 操作当场执行；快查（天气/新闻）用
web_search/fetch 当场回答；需要翻文件/产文档的「拉力段」派 code_agent 后立刻告知用户，
回合结束等 `code_agent` 完成通知再决定续跑/收尾。会话出现在主窗口侧栏 `dsh_orb` 文件夹。

## 2. 融合方案（吸收 / 共生 / 不搬）

| dsh-orb 能力 | 处置 | WhaleGo 落法 |
| --- | --- | --- |
| 唤醒词/插话/退下 三段交互 | **吸收** | 语音页已永续 `SpeechRecognition`（onend 自启），把这三段变成**短语状态切换**：待命页喊唤醒词→自动开麦并回应；播报/聆听中喊插话词→打断转入听；任何时候喊退下→停播关麦。纯 JS 零依赖，短语/敏感语义/冷却/回应语全套配置进 prefs（默认词用鲸鱼品牌「你好小鲸 / 小鲸 / 退下吧」） |
| TTS 后端选择（local/qwen）、语速音量、提问卡口头语 | **吸收概念** | WhaleGo 已有 Edge TTS 多音色/语速；保留 voice 枚举不变，新增「打断回应」文案与播报音量语义映射到 rate 枚举（不引第二 TTS 后端，qwen 留 roadmap） |
| 双轨 agent（当场回答 vs 后台派发+完成回执） | **共生确认** | WhaleGo hostWrites/dual lane 的 B 段就是宿主 agent 回合=「后台轨」；A 段语音即「完成回执」。装了 dsh-orb 时 session agent 自动持有 13 个 GUI 工具 → **WhaleGo 的语音问话直接可驱动 Computer Use**（同宿主工具注入，零额外代码），诊断面板如实显示该共生 |
| 三层权限 | **共生确认** | 权限面在宿主 session；WhaleGo 不自建。装 dsh-orb 时其 `session/created` pin 自动覆盖到 WhaleGo 会话（同一权限治理） |
| 悬浮球 GUI（Electron helper 球窗） | **共生** | 不搬：体量(koffi/sherpa/Electron runtime)+红线「不引入运行时依赖」。WhaleGo 探测安装态：装了→诊断显示版本与共存提示，鲸笔 thinkOrb 悬浮球设置仍只管 App/页面侧，不重复画球 |
| Computer Use 13 工具 / 观察边框 / 千分比坐标 / 截图排除 | **不搬** | 桌面原生依赖专属；共生路径已把工具带进 WhaleGo 会话 |
| 球上原生 transcript（tool 卡/复制/token pill） | **不搬（等价已有）** | WhaleGo 语音页已是同位渲染：A 逐句揭示、B 流式、字幕顶渐隐、错误 chip；逐字段重做属重复建设 |
| 头像自定义（球 avatar） | **roadmap** | 读侧已逆向清楚（orb-avatar.json + 内置 6 动图 + dshgif 画廊模式）；写侧涉及 helper 的读取协议（token 校验），第二批做「鲸：像素鲸头像投射」 |
| Qwen TTS 后端 | **roadmap** | 需存用户自填 API key（红线允许用户自填，不硬编码）；等 voice 引擎抽 backend 接口时接 |
| 选区工具栏 / 更新器 / whats-new | **不搬** | 官方禁用中的缺陷功能/WhaleGo 走仓库版本 |

「具有双方所有的能力」的如实盘点：**WhaleGo 侧吸收了 dsh-orb 语音交互的完整行为语义（零依赖可实现部分）；
其余桌面原生能力在安装 dsh-orb 的同一宿主上自动共生可用；原生窗口/GUI 工具/本地模型三件套明确不搬**，
原因与代价都在本表。双方保有能力的清单见 §4。

## 3. 本轮已落地（WhaleGo 0.9.1）

1. `lib/orbBridge.js`：dsh-orb 安装探测（profile `orb-voice.json` / `ball-enabled.json` / `~/.dsh/dsh-orb` 目录），
   读侧解析其 voice schema（仅读，不写对方文件），`orbDiagnostics()` 给诊断 rows 兜底。
2. prefs 新增（吸收 dsh-orb 语音语义，鲸语品牌词）：`wakePhrase`（默认「你好小鲸」）、
   `wakeReply`（默认「我在呢。」）、`breakPhrase`（默认「小鲸」，打断当前播报）、
   `stopPhrase`（默认「退下吧」）、`voiceCommands`（总开关，默认 off——和 dsh-orb 一样默认关闭需用户显式开）。
3. 浏览器语音页（client.js）：`voiceCommand()` matcher + `voiceCommandsOff()` 旁路道岔，挂在 onresult 的
   echo 过滤之后。语义：wake **前缀**匹配（正文提到唤醒词不算命令，同 dsh-orb `stripWakePrefix`；且 wake
   判定在 break 之前，默认 breakPhrase「小鲸」是 wake 短语子串，顺序错了会把唤醒词吞成插话）；break/stop
   关键词**全帧**匹配（同 dsh-orb interject/dismiss，空短语不匹配）。命中后：break→打断播报转听+回喊「请讲」；
   stop→停播关麦+收起；wake→裸唤醒只回喊（播报中不废话），**尾问 ≥4 字走分帧 pending 通道（播报中也生效，
   send 自会打断）**；matcher 本身不读开关，`voiceCommands=off` 由 gate 全旁路（零行为变化）。
4. 设置面板加「语音命令」区块（四项短语 + 开关）；接缝诊断加 dsh-orb 行（安装=目录/文件信号，未装=安装提示行）。
5. 测试 `test/orbFusion.test.js` 10 项（matcher 矩阵 / gate / orb 探测与钳制 / prefs 短语）；专题文档（本文）+
   `状态-2026-10-30` 追加；MIT credit 注记（§5）。

## 4. 合并后的能力清单（双方）

WhaleGo 原有：A/B 双段语音、语音行持久化+内联播放、hostWrites 自动出声、浏览器暂存语音页（免提/全双工/
同步字幕/深浅色）、朗读模式、打断、音频缓存、面板四全家、EDGE多音色。
吸收自 dsh-orb：三段语音命令（唤醒/插话/退下+回应语）、安装态探测与共生诊断。
经 dsh-orb 共生获得（装了就有）：悬浮球窗、13 个 GUI 工具（WhaleGo 会话可驱动）、球侧 Codeagent 后台轨语义、
三层权限治理、了解两轨模型各自设置。
WhaleGo 保留而 dsh-orb 没有的：语音行持久化（durable rows+内联播放）、A/B 双段、浏览器全双工语音页、
hostWrites lane、Edge TTS 流式分句朗读、鲸语实录面板。

## 5. Credit

dsh-orb 及其上游衍生代码 MIT（© mini-yifan 与贡献者；上游衍生披露见其 THIRD-PARTY-NOTICES.md）。
WhaleGo 本轮**未复制其代码**：吸收的是交互语义与配置概念（唤醒/插话/退下/权限三层/两轨 agent），
实现均为 WhaleGo 自有代码，短语默认值为鲸鱼品牌自定词。概念的出处按 MIT 惯例在此致意：
https://github.com/mini-yifan/dsh-orb-cordis
