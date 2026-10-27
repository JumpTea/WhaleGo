# 测试与验收

## 1. 本地测试

```bash
cd WhaleGo
node --test
```

当前 8 项：

| 用例 | 覆盖 |
| --- | --- |
| 清单可解析、字段合法 | `package.json` 的 `dshGo`、插槽数量、id 唯一 |
| 视图预算 | 4 个面板的节点数、深度、标题长度 |
| 设置读写 | 11 组偏好归一化、保存、恢复默认 |
| 自动模式 | 简单问题当前走 `read`，复杂问题走 `dual`；`voice-only` 是目标，尚未实现 |
| 双脑启动 | `ask` 当前同时启动语音脑与文字脑；目标只有 `dual` 双脑，`voice-only` 只跑语音 |
| 停止 | `stop` abort 两个脑，记录标记 `interrupted` |
| 媒体过期 | 不存在的 key 抛人话错误 |
| 无会话 ID | 返回 `insert`，不创建任务 |

## 2. 契约检查

DSH-Go 的 `kit-lib-check` 不在本仓库，需要从设备或 APK 的 `assets/flutter_assets/assets/skills/dsh-go-plugin/` 取：

```bash
node <kit>/bin/check.mjs . --lang zh --load
```

通过标准：退出码 0，无 `error`；`warning` 只允许「文案长度接近上限」这类非阻断项。

最近一次结果：4 个面板、16 个视图组件、`media` 声明均通过；`--load` 能在假宿主里挂载，`dshGo.service is missing` 的降级路径不崩。

## 3. TTS 实测

Edge TTS 无需密钥。实测（2026-10-26，本机网络）：

```text
voice  zh-CN-XiaoxiaoNeural
text   这是一段鲸语语音测试。
format audio-24khz-48kbitrate-mono-mp3
bytes  26208
seconds 4.37
```

用 ffmpeg 解码确认是 24 kHz 单声道 mp3。该测试需要网络，不放进 `node --test`；发布前手动跑一次：

```bash
node -e "import('./lib/tts/edge.js').then(async m => { const b = await m.synthesizeEdge('这是一段鲸语语音测试。', { voice: 'zh-CN-XiaoxiaoNeural' }); console.log(b.length); })"
```

## 4. 验收矩阵

| 项 | 本地（Node） | 真机（DSH-Go） | 判定 |
| --- | --- | --- | --- |
| 插件挂载 | 假宿主 `--load` | 重启后按钮出现 | 必须 |
| 双脑按需 | 当前单测覆盖 `dual` / `read`；`voice-only` 待补 | 简单问题只有一条语音消息，复杂问题两条消息 | 必须 |
| 语音消息进会话并持久化 | 单测覆盖 `session.append`；真实 headless 已验证顺序与持久化 | 需要引擎投影补丁（否则下一轮适配器报 `unsupported`）；刷新后渲染待 App | 必须 |
| 两条消息各自可复制 | 单测覆盖语音块 `context:false` 与独立消息 | 需要 App 渲染两条独立消息 | 必须 |
| 实时转写 | 无 | 说话时草稿用户消息逐字更新，定稿一条 | 原生补齐后 |
| 简单问题用户消息落库 | 只能验记录 | 需要 `native.voiceTurn` | 原生补齐后 |
| 两脑同会话同上下文 | 只能验调用形状 | 需要 `native.voiceTurn` | 原生补齐后 |
| 悬浮球（仅控制） | 只能验偏好保存 | 需要 `native.orb` | 原生补齐后 |
| 插件设置 | 只能验面板 | 迁到 DSH 插件设置 schema（插件侧） | 必须 |
| 流式音频 | 假宿主单测：Edge 每块写入 `audioStream`、写完 `end`、abort 生效 | 需要 v1.3 桥接 + App 播放器 | 原生补齐后 |
| 免手语音 | 只能验点按路径 | 需要 `native.voice` | 原生补齐后 |
| 打断 | 单测 abort | 说话时 TTS 200 ms 内停 | 必须 |
| 后台 | 无 | 麦克风 / TTS / 球暂停 | 必须 |
| 无网络 | 单测 fake TTS 失败 | 文字答案仍完整 | 必须 |

## 5. 真机步骤

1. 安装 DSH-Go `0.2.1-rc.2` 或更新。
2. 把仓库复制到 `$DSH_HOME/dsh-go/plugins/local-whalego/`。
3. 重载宿主；确认发送区出现「鲸语」，消息区出现「朗读」「鲸语解释」。
4. 输入「你好」→ 点「鲸语」→ 听声音；确认会话里只有用户消息 + 语音行，没有文字答案。
5. 输入「帮我查一下 2026 年 LLM 排行榜，整理成表格」→ 点「鲸语」→ 看语音行与文字答案是否同时出现、语音行是否在上。
6. 点「停」→ 声音停止，语音行保留已说内容。
7. 打开「鲸语设置」→ 改声线、语速、悬浮球样式 → 立即生效。
8. 打开「接缝诊断」→ 记录五项 `native` 状态（`voiceLine` / `audioStream` / `voiceTurn` / `voice` / `orb`）。
9. 退后台 5 秒再回来 → 声音 / 录音 / 球都恢复待命。

## 6. 失败注入

- 把 `prefs.json` 写成非法 JSON → 启动应回默认，不崩。
- 断网后点「鲸语」→ `media` 报「这次没有声音，请再点一次。」；文字答案仍出现。
- 在 `media` 返回前点「停」→ 不应播放迟到音频。
- 连续点两次「鲸语」→ 旧任务 abort，新任务不串台。
- 会话 ID 为空 → 只写输入框，不创建任务。

## 7. 未验证 / 限制

- **真机未跑**：本机没有 Android 设备与 DSH-Go 宿主，所有真机项标记为待验。
- **原生核心三项未实现**：`voiceLine` / `audioStream` / `voiceTurn` 是空接口或降级路径，验收要看原生桥；`voice` / `orb` 是外围，`settings` 走插件设置 schema。
- **语音脑上下文**：当前语音脑用独立 `llm.stream` + transcript 最近几轮，不在 DSH 会话上下文；`voiceTurn` 落地前，两脑上下文不一致。
- **简单问题仍跑文字脑**：`#selectMode` 当前走 `read`；`voice-only` 是目标，尚未实现。
- **TTS 非流式**：当前整段合成；`audioStream` 落地前首声延迟大。
- **Edge TTS 网络**：本机实测通过，但手机网络、代理、区域限制未验证。
- **长音频**：`media` 整段 ≤30 秒；超过要切段，句间会有空档。
- **多语言**：目前只做了中文文案与三档中文声线；英文界面只有部分文案。
