# 工程交接：WhaleGo / 鲸语

这份文档给接续开发的人：读完能知道项目是什么、代码在哪、契约怎么用、还缺什么、怎么验证。

## 1. 一句话

WhaleGo 是 DSH-Go 的双脑语音插件：语音脑先说，文字脑随后写；两条输出进入同一个会话，而不是字幕或弹幕。

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
- 双脑：语音脑流式生成、文字脑独立回合、TTS、缓存、打断、状态机。
- 设置：11 组偏好，全部写入 `$DSH_HOME/whalego/prefs.json`；4 个声明式面板。
- 原生接缝：`lib/nativeSeam.js` 对 5 个方法做特性探测与空实现。
- 单测：`node --test`，8 项通过。
- 契约检查：用 DSH-Go 的 `kit-lib-check` 跑过 `--lang zh --load`，无错误。
- 品牌：像素鲸 logo、社交预览图、品牌文案。

未完成 / 需要原生配合：

- 会话内语音行（`voiceLine`）——当前只能进「鲸语实录」面板。
- 原生悬浮球（`orb`）——当前只存偏好，没有桥。
- 插件详情页设置（`settings`）——当前用设置面板替代。
- 流式音频（`audioStream`）——当前用 `media` 整段返回。
- 免手语音会话（`voice`）——当前用原生点按 STT。
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

文字脑通过 `ctx.get('sessionController')`：

```js
await service.prompt({
  requestId,
  sessionId,
  mode: 'queue',
  content: [{ type: 'text', text: question }],
});
```

取消用 `service.cancel({ sessionId })`；模型用 `service.modelCatalog()` / `selectModel()`。这些是 DSH 内部形状，已封装在 `lib/textBrain.js`；原生侧最好提供 `native.session` 门面（见 `docs/native-gaps.md` 第 6 节）。

## 5. 双脑流程

```text
ask(scope)
  → 选模式（auto / dual / read）
  → transcript.start
  → 返回 { type:'audio', op:'play', instance:'whalego', src:'media:speech', key:turnId }

media(scope, {key})
  → 等 job.audio（TTS Buffer）
  → 返回 { body, contentType:'audio/mpeg' }

dual:
  voiceBrain.stream() → onDelta → transcript.appendVoice + seam.appendVoiceLine(partial)
                     → 完成 → TTS.synthesize
  textBrain.prompt() → DSH assistant 流 → onAssistantFrame → transcript.setText
                                          → frame end → transcript.setText(final)

audio.ended → finishJob → transcript done → idle
```

关键不变量：

1. 文字答案不来自语音转写，两者独立生成。
2. 插件不写回会话历史；文字答案由 DSH 自己渲染。
3. 语音行最多 180 字，文字答案不截断。
4. `stop` / `interrupt` 同时 abort 语音脑、文字脑、TTS。
5. 没有 `sessionId` 时只 `insert`，不自动发送。

## 6. 原生接缝

`lib/nativeSeam.js` 探测五个方法：

| 方法 | 参数 | 返回 | 当前降级 |
| --- | --- | --- | --- |
| `voiceLine` | `{ sessionId, lineId, role, text, final, order }` | `Promise<void>` | 只写 `transcript`，面板显示 |
| `orb` | `{ visible, style, size, idle, state, sessionId }` | `Promise<void>` | 只存偏好 |
| `settings` | `{ pluginId, title, fields, values }` | `Promise<void>` | 用 `whalego.settings` 面板 |
| `audioStream` | `{ id, contentType, sampleRate, channels }` | `{ write, end, abort }` | 用 `media` 整段 |
| `voice` | `{ mode, language, vad, partial, onPartial, onFinal, … }` | `{ stop }` | 用原生点按 STT |

完整字段、事件、验收标准见 [`native-gaps.md`](native-gaps.md)。原生侧只需在 `dshGo.native` 上挂这五个方法；插件其他文件不用改。

## 7. 运行与验证

```bash
cd WhaleGo
node --test                 # 8 项单测
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
- **不写回会话历史。** 不伪造 assistant 消息，不改 DSH 的事件日志。
- **不接触原始麦克风音频。** 只接收文本与事件。
- **不放密钥。** Edge TTS 无需密钥；不要引入需要 token 的 TTS。
- **不暴露实录。** 不新增读取实录的 HTTP 路由。
- **不出现个人信息。** 仓库、文档、素材、提交者身份都不带真名或私人链接。
- **不引入运行时依赖。** Node 24 内置能力足够；新增依赖要先说明理由。
- **所有视图保持纯函数**，能被 `kit-lib-check` 静态跑。

## 9. 已知问题

- `media` 的完成信号依赖 App 的 `audio.ended`；没有时用 6 KB/s 的保守时长兜底，长音频可能提前标记完成。
- 语音脑是 LLM 生成，不是语音识别；它拿到的是用户文字，不是麦克风音频。免手对话要等 `native.voice`。
- 文字答案与语音行的上下顺序目前由 App 决定；原生 `voiceLine.order` 落地前，面板里只能按记录顺序展示。
- 真机上的 Edge TTS 网络可用性未验证；失败会回退文字，不阻塞。

## 10. 下一步

1. 原生侧实现 `voiceLine` / `orb` / `settings` 三项 P0；插件侧只改 `nativeSeam.js` 的转发。
2. 加 `audioStream`，把长回答的首句延迟压到 2 秒内。
3. 加 `voice` 免手与 barge-in。
4. 真机跑第 7 节验收，记录到 `docs/testing.md`。
5. 宣传片已出片；改版时改 `film/src/Promo.tsx` 与 `film/public/audio/`，重渲染序列、跑 `tools/promo/mix-audio-48.py`、再 mux。
6. 发布 `0.1.0`：打 tag、写 release notes、附社交预览图与 48 秒成片。
