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
| 自动模式 | 简单问题走 `read`，复杂问题走 `dual` |
| 双脑启动 | `ask` 同时启动语音脑与文字脑，返回 `audio` 效果 |
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
| 双脑启动 | 单测检查两个脑都启动 | 语音与文字都出现 | 必须 |
| 语音行进会话 | 只能验 `transcript` 记录 | 需要 `native.voiceLine` | 原生补齐后 |
| 文字答案在语音下方 | 只能验记录顺序 | 需要 `native.voiceLine.order` | 原生补齐后 |
| 悬浮球 | 只能验偏好保存 | 需要 `native.orb` | 原生补齐后 |
| 插件页设置 | 只能验面板 | 需要 `native.settings` | 原生补齐后 |
| 流式音频 | 只能验整段 `media` | 需要 `native.audioStream` | 原生补齐后 |
| 免手语音 | 只能验点按路径 | 需要 `native.voice` | 原生补齐后 |
| 打断 | 单测 abort | 说话时 TTS 200 ms 内停 | 必须 |
| 后台 | 无 | 麦克风 / TTS / 球暂停 | 必须 |
| 无网络 | 单测 fake TTS 失败 | 文字答案仍完整 | 必须 |

## 5. 真机步骤

1. 安装 DSH-Go `0.2.1-rc.2` 或更新。
2. 把仓库复制到 `$DSH_HOME/dsh-go/plugins/local-whalego/`。
3. 重载宿主；确认发送区出现「鲸语」，消息区出现「朗读」「鲸语解释」。
4. 输入「你好」→ 点「鲸语」→ 听声音，看「鲸语实录」。
5. 输入「帮我查一下 2026 年 LLM 排行榜，整理成表格」→ 点「鲸语」→ 看语音与文字是否同时出现。
6. 点「停」→ 声音停止，实录保留已说内容。
7. 打开「鲸语设置」→ 改声线、语速、悬浮球样式 → 立即生效。
8. 打开「接缝诊断」→ 记录五项 `native` 状态。
9. 退后台 5 秒再回来 → 声音 / 录音 / 球都恢复待命。

## 6. 失败注入

- 把 `prefs.json` 写成非法 JSON → 启动应回默认，不崩。
- 断网后点「鲸语」→ `media` 报「这次没有声音，请再点一次。」；文字答案仍出现。
- 在 `media` 返回前点「停」→ 不应播放迟到音频。
- 连续点两次「鲸语」→ 旧任务 abort，新任务不串台。
- 会话 ID 为空 → 只写输入框，不创建任务。

## 7. 未验证 / 限制

- **真机未跑**：本机没有 Android 设备与 DSH-Go 宿主，所有真机项标记为待验。
- **原生五项未实现**：`voiceLine` / `orb` / `settings` / `audioStream` / `voice` 是空接口，验收要看原生桥。
- **Edge TTS 网络**：本机实测通过，但手机网络、代理、区域限制未验证。
- **长音频**：`media` 整段 ≤30 秒；超过要切段，句间会有空档。
- **多语言**：目前只做了中文文案与三档中文声线；英文界面只有部分文案。
