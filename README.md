# WhaleGo · 鲸语

> 先听见，再见。

DSH-Go 的双脑语音插件。语音脑负责听和说，文字脑负责把复杂问题写清楚；两条输出进入同一个会话，而不是一层字幕或一排弹幕。

![WhaleGo](assets/brand/social-preview-1280x640.png)

## 宣传片

[![WhaleGo 48 秒产品片](assets/brand/social-preview-1280x640.png)](assets/promo/whalego-promo-48s.mp4)

- [1080p · 48s · 60fps](assets/promo/whalego-promo-48s.mp4)

## 名字

鲸鱼靠声呐辨认方向，靠鲸歌交换消息。听与说，本来就是鲸鱼的事。

`whale` 也是 DeepSeek 的意象，`Go` 指 DSH-Go。中文名「鲸语」取鲸歌与语言的双关：声音先到，文字随后。

## 它解决什么

普通语音助手只有一条通道：要么全说，要么全写。遇到「查一下、整理成文件」这种一句话说不清的请求，说的版本太浅，写的版本又来得太慢。

WhaleGo 把回答拆成两条并行通道：

1. **语音脑**先开口。它拿到问题后立刻给出一句自然的过渡（可设为「我想想。」），然后边说边把转写文字流进会话。
2. **文字脑**同时开始工作。它不跟读语音，也不等语音播完，而是把完整答案直接写在语音转写下方。
3. 语音转写继续增长时，会把文字脑的答案往下推；两条流各自生长，互不截断。

> 当前 DSH-Go v1.2 还没有会话内语音行、原生悬浮球、插件页设置宿主、流式音频、免手语音会话这五项桥。WhaleGo 先以「实录面板 + 朗读」的形态可用；`lib/nativeSeam.js` 已经按最终形态留好接缝，原生补齐后自动切到会话内双脑，插件其他文件不用改。

## 交互原则

- **无字幕。** 不叠加字幕条，不占用悬浮层。语音转写就是会话内容本身。
- **无弹幕。** 语音文字流进入会话窗，不飘在画面上。
- **悬浮球是原生的。** 插件只声明样式、大小和待机动作；像素、动画、位置都由 Flutter 绘制。
- **设置不在球下面。** 所有开关都在插件页的「鲸语设置」里，点开即用。
- **打断即停。** 停止按钮会同时停掉语音、取消文字脑的回合，并保留已经说出的内容。
- **不写回会话历史。** 语音文字是插件维护的独立流，不篡改 DSH 自己的消息记录。

## 功能

- 双脑并行：语音脑流式转写 + 文字脑完整答案。
- 自动判断：简单问题只走语音；复杂问题自动开双脑。
- 四种面板：鲸语实录、鲸语设置、关于鲸语、接缝诊断。
- 六个入口：发送区「鲸语」「停」，消息区「朗读」「鲸语解释」，状态条「鲸语 · 待命」，以及设置页。
- 自定义悬浮球：像素鲸、声呐、极简、关闭；小 / 中 / 大；游动 / 呼吸 / 静止。
- 声音：晓晓、云希、晓伊；慢 / 正常 / 快；思考前填词三档。
- 语音缓存、保留轮数、自动播放、语音文字流显隐。
- Edge TTS，无需密钥；失败时回退到一句短提示，不阻塞文字答案。

## 安装

WhaleGo 是 DSH-Go 宿主插件。插件目录放在 DSH-Go 的插件根下：

```bash
git clone https://github.com/JumpTea/WhaleGo.git "$DSH_HOME/dsh-go/plugins/local-whalego"
```

然后在 DSH-Go 里重载插件（或重启宿主）。插件通过 `package.json` 的 `dshGo` 清单声明自己，App 只读取声明与 JSON 视图，不执行插件代码。

要求：

- DSH-Go 宿主 `>= 0.2.1-rc.2 < 0.3.0-0`
- Node.js `>= 24`
- 可访问 Edge TTS 的网络（只发文本，不发音频）

## 设置

打开「鲸语设置」面板。所有项都只写偏好，不改原生绘制：

| 分组 | 选项 |
| --- | --- |
| 双脑模式 | 自动 / 总是双脑 / 朗读答案 |
| 声音 | 晓晓 · 女声 / 云希 · 男声 / 晓伊 · 女声 |
| 语速 | 慢 / 正常 / 快 |
| 思考前 | 我想想。 / 嗯，我看看。 / 不说 |
| 悬浮球样式 | 像素鲸 / 声呐 / 极简 / 关闭 |
| 悬浮球大小 | 小 / 中 / 大 |
| 待机动作 | 游动 / 呼吸 / 静止 |
| 语音文字流 | 显示 / 隐藏 |
| 语音缓存 | 开 / 关 |
| 保留轮数 | 4 / 6 / 10 |
| 自动播放 | 开 / 关 |

偏好保存在 `$DSH_HOME/whalego/prefs.json`。实录保存在 `$DSH_HOME/whalego/transcript.json`，只保留最近几轮，可一键清空。

## 架构

```text
DSH-Go (Flutter)
   │  dshGo 清单 + JSON 视图 + audio 效果
   ▼
WhaleGo host plugin (Node 24)
   ├─ lib/index.js        挂载、事件、面板 / 按钮 / 路由
   ├─ lib/panels.js       4 个声明式面板 + 设置写回
   ├─ lib/actions.js      按钮 → 效果；media / capability
   ├─ lib/engine.js       双脑编排、状态机、快照
   ├─ lib/voiceBrain.js   语音脑：短句 + 流式转写
   ├─ lib/textBrain.js    文字脑：DSH 会话回合
   ├─ lib/transcript.js   会话内语音行 + 文字答案
   ├─ lib/tts/            Edge TTS + 缓存
   └─ lib/nativeSeam.js   原生接缝特性探测与空实现
```

数据流：

```text
用户点「鲸语」
  → engine.ask()
  → voiceBrain: 过渡句 + 语音转写（流式）
  → textBrain: sessionController.prompt()（完整答案）
  → transcript: 语音行在上，文字答案在下
  → TTS: media('speech') → { type:'audio', op:'play' }
```

文字脑不是把语音转写再总结一遍。它和语音脑拿到的是同一个问题，独立生成；语音脑的转写只负责「说」，文字脑的答案负责「写」。

## 原生接缝

当前 DSH-Go v1.2 的插件契约提供：

- `audio` / `voice` / `micro` / `overlay` 四项能力
- `media`、`micro`、`overlays` 各两个声明位
- `audio` 播放、`voice` 起停、`overlay` 显隐
- 16 个声明式视图组件

还缺五件事：会话内语音行、原生悬浮球、插件页设置宿主、流式音频、免手语音会话。WhaleGo 已经按最终形态写好，`lib/nativeSeam.js` 逐项特性探测；原生补齐后，插件侧只需把对应方法接到桥上。

完整的字段、事件与验收标准见 [docs/native-gaps.md](docs/native-gaps.md)。

## 开发

```bash
cd WhaleGo
node --test
node --check lib/index.js
```

本地契约检查（需要 DSH-Go 的 `kit-lib-check`）：

```bash
node check.mjs . --lang zh
```

品牌图重新生成：

```bash
python tools/brand/make-brand.py
```

## 隐私

- 不上传麦克风音频；语音识别由 DSH-Go 原生侧完成。
- TTS 只把要朗读的文本发给 Edge TTS。
- 不提供实录的 HTTP 路由；实录只存在本机 `$DSH_HOME/whalego/transcript.json`。

## 许可证

MIT。见 [LICENSE](LICENSE)。

「鲸语」「WhaleGo」、像素鲸形象与相关标识是项目品牌资产；MIT 不授予商标使用权。详见 [NOTICE](NOTICE)。

## 链接

- 仓库：<https://github.com/JumpTea/WhaleGo>
- 问题：<https://github.com/JumpTea/WhaleGo/issues>
- 原生接缝：[docs/native-gaps.md](docs/native-gaps.md)
- 工程交接：[docs/handover.md](docs/handover.md)
