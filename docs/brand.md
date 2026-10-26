# 品牌与宣传片

## 1. 名字

**鲸语 · WhaleGo**

- 鲸鱼靠声呐辨认方向，靠鲸歌交换消息。听与说，本来就是鲸鱼的事。
- `whale` 是 DeepSeek 的意象；`Go` 指 DSH-Go。
- 中文名取「鲸歌」与「语言」的双关：声音先到，文字随后。

一句话：**先听见，再见。**

英文：**Hear it first. Read it after.**

对外露出时，**WhaleGo 作主标题，鲸语作小号副标题**；仓库名、包名、视频字标都按这个顺序。中文语境可以反过来读，但视觉层级不反过来。

## 2. 像素鲸

`assets/brand/`：

| 文件 | 用途 |
| --- | --- |
| `pixel-whale-1024.png` | 主图，深色圆角底 |
| `pixel-whale-512.png` | 应用图标、头像 |
| `pixel-whale-256.png` | 列表、面板 |
| `pixel-whale-128.png` | favicon、小尺寸 |
| `pixel-whale-mark-1024.png` | 透明底，叠在任意深色背景 |
| `social-preview-1280x640.png` | GitHub social preview、宣传图 |
| `sprite-whale.png` | 12 帧动画雪碧图（游泳 / 眨眼 / 说话） |
| `sprite-preview.png` | 6 帧预览条，文档与快速审阅用 |

生成脚本：`tools/brand/make-brand.py`。128×128 网格，最近邻放大，边缘保持硬像素。

造型要点：

- 敦实的侧身幼鲸：圆头、短身、浅蓝腹，尾鳍收在身体右侧，不抢轮廓。
- 深海军蓝描边 + 亮蓝主体 + 粉色腮红 + 竖缝眼：借参考 GIF 的体块、比例与配色气质。
- 青色声呐耳件：本项目的识别点，也是「听 / 说」的产品隐喻；不画大耳机、不挡脸。
- 头顶不画喷泉、不做长条鱼、不做通用鲸鱼贴纸；尾巴必须小，避免读成剪刀。
- 参考图是已注册的第三方形象，本项目只借鉴「敦实侧身鲸」的通用比例与像素技法，不复制其具体轮廓、表情、构图与整体配色组合。

## 3. 色板

| 名称 | Hex | 用途 |
| --- | --- | --- |
| Ink | `#071626` | 主背景 |
| Ink 2 | `#0A1F36` | 次级背景 |
| Border | `#1B3F62` | 分隔线、卡片边 |
| Body | `#4D6BFE` | 鲸鱼主体、主色 |
| Body Dark | `#2B45C8` | 阴影、鳍 |
| Belly | `#D6E4FF` | 腹部、次强调 |
| Hilite | `#F0F7FF` | 高光 |
| Sonar | `#36E2C7` | 声呐、强调、链接 |
| White | `#F5F8FF` | 主文字 |
| Dark | `#0B1020` | 描边 |

使用规则：

- 深色底为主；浅色底只在文档里用，且保持同一组色。
- 青色只做强调，不大面积铺底。
- 不用紫色渐变、不用玻璃拟态、不用无意义的发光。

## 4. 标识使用

- 最小尺寸：24 px；小于 24 px 只用透明底鲸鱼，不加圆角底。
- 留白：标识四周至少留 1/4 个标识宽度的空白。
- 不拉伸、不旋转、不改色、不加投影、不重绘像素。
- 不把鲸鱼和文字拆开单独授权；组合标识以 `social-preview` 为准。
- 可以在「关于」「宣传片」「README」里使用；不得用于暗示 DSH-Go 官方背书。

## 5. 商标

「鲸语」「WhaleGo」、像素鲸形象与相关标识是项目品牌资产。MIT 只授权代码，不授权商标；详见 `NOTICE`。

## 6. 宣传片

### 6.1 规格

- 时长：48 秒
- 画幅：1920×1080，60 fps
- 编码：H.264 High，yuv420p / bt709，AAC 192 kbps
- 响度：约 -15 LUFS，峰值 -1.4 dBFS（实测）
- 语言：英文主标题 + 中文副标题；旁白中文，演示声中文
- 素材：Remotion 组件化 UI、像素鲸、ACE-Step 配乐、Edge TTS 旁白与演示声
- 工程：`film/`，渲染入口 `film/src/index.ts`

### 6.2 分镜

| 时间 | 画面 | 旁白 | 屏幕文字 |
| --- | --- | --- | --- |
| 0–2s | 声呐环与极光球，WhaleGo 字标从下方推入 | WhaleGo，双脑语音，为 DSH-Go。 | WhaleGo / 鲸语 |
| 2–5s | 三块问题卡：只说、只写、错过 | 有些问题，一句话说不清。 | 一句话，装不下一个答案。 |
| 5–8s | 语音脑/文字脑两条光路汇入同一线程 | 一个先说，一个后写。 | TWO BRAINS. ONE THREAD. |
| 8–11s | ChatGPT Voice 式手机：开口、转写直接进会话 | 开口就行，转写直接进会话。 | SPEAK. STAY. |
| 11–15s | 语音行 2 秒、文字行 8 秒，文字答案不抢跑 | 语音先出声，文字把答案写全。 | TWO SPEEDS. ONE THREAD. |
| 15–18s | 复杂问题：语音垫话 + 文字答案 + 表格 | 语音在会话里生长，文字答案紧随其下。 | 语音行 ↑ 文字答案 ↓ |
| 18–22s | 用户打断，红线切过，声呐球熄灭 | 打断就停。不用等它说完。 | YOU SPEAK. IT STOPS. |
| 22–26s | 设置页：模式、声音、语速；设置不在球下面 | 设置住在 App 设置里。不在球下面。 | NATIVE BY DESIGN. |
| 26–30s | 四种悬浮球：极光、声呐、像素鲸、极简 | 悬浮球、声音、设置，都交给原生。 | FOUR ORBS. YOUR PICK. |
| 30–34s | 左边字幕覆盖视频，右边转写成为会话消息 | 不是字幕，是消息。 | NOT SUBTITLES. MESSAGES. |
| 34–38s | 手机与桌面同一条线程，滚动同步 | 手机、桌面，同一条会话。 | ONE THREAD. EVERY SCREEN. |
| 38–43s | 鲸鱼在声呐环中游动，WhaleGo 字标压阵 | 鲸鱼用声呐辨认方向，用鲸歌交换消息。 | Whale / DeepSeek · Go / DSH-Go |
| 43–48s | 品牌结尾：透明像素鲸 + WhaleGo + 鲸语 + 仓库 | WhaleGo。先听见，再见。MIT 开源。 | github.com/JumpTea/WhaleGo |

### 6.3 旁白

用 Edge TTS `zh-CN-XiaoxiaoNeural`，rate `-4%` 至 `-8%`，逐句生成；演示声用 `zh-CN-YunxiNeural`。旁白不是朗读说明书，语气要像在讲一个发现。实际文件在 `film/public/audio/`，排期见 `film/src/Promo.tsx` 的 `VOICE_CUES`。

```text
WhaleGo，双脑语音，为 DSH-Go。
有些问题，一句话说不清。
一个先说，一个后写。
开口就行，转写直接进会话，不是字幕。
语音先出声，文字把答案写全。
语音在会话里生长，文字答案紧随其下。
打断就停。不用等它说完。
设置住在 App 设置里。不在球下面。
悬浮球、声音、设置，都交给原生。
不是字幕，是消息。
手机、桌面，同一条会话。
鲸鱼用声呐辨认方向，用鲸歌交换消息。
WhaleGo。先听见，再见。MIT 开源。
```

### 6.4 配乐

ACE-Step，英文 caption：

```text
ambient sonar, soft synth pulse, warm pad, minimal, 72 bpm, no vocals, instrumental
```

生成 52 秒，取前 48 秒；旁白下自动 duck，结尾 3 秒淡出。混音脚本：`tools/promo/mix-audio-48.py`。

### 6.5 视觉

- 背景：深墨蓝网格 + 程序化同心声呐环 + 极光球；不用 Wan 生成背景，避免素材风格与像素鲸打架。
- UI：Remotion 组件画手机/桌面框、会话、设置与表格；严格使用第 3 节色板；表格数据标「示意数据」。
- 动效：每 2–4 秒一个镜头；用推近、遮罩、跟随、硬切，不用长叠化，不用无意义漂浮粒子。
- 像素：鲸鱼按 128×128 设计网格绘制，最近邻放大，不糊边。
- 标题：英文特粗无衬线作主标题，中文小号作副标题；**WhaleGo 永远比鲸语大**。

### 6.6 合成

1. Remotion 渲染 2880 帧 JPEG 序列（60 fps，1920×1080）：`npx remotion render src/index.ts WhaleGoPromo out/frames --sequence --image-format=jpeg --jpeg-quality=95 --concurrency=4`。
2. 系统 ffmpeg 编码：`-framerate 60 -i out/frames/element-%04d.jpeg -vf scale=in_range=full:out_range=tv:format=yuv420p -c:v libx264 -preset medium -crf 17 -r 60 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv`。
3. 音频：`python tools/promo/mix-audio-48.py` 生成 48 秒 WAV；VO 按 `VOICE_CUES` 排期，BGM duck，`loudnorm=I=-14:TP=-1.5`。
4. mux：`-c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart`。
5. 输出 `assets/promo/whalego-promo-48s.mp4`；抽 8 帧检查标题、双脑、语音 UI、复杂演示、打断、设置、悬浮球、结尾。

### 6.7 隐私门禁

- 不出现真名、手机号、邮箱、社交账号、真实头像、真实聊天记录。
- 不出现手机状态栏的真实运营商、通知、电量以外的个人信息；演示 UI 用合成状态栏。
- 不出现跳转到个人信息页面的二维码或链接；只放仓库地址。
- 素材文件名、EXIF、字幕文件都不带作者信息。
- 发布前跑一次仓库级 `grep` 与视频抽帧目检。

## 7. 文案资产

短描述：

> 鲸语 WhaleGo：DSH-Go 的双脑语音插件。语音先说，文字后写；无字幕，无弹幕，悬浮球与设置都交给原生。

长描述：

> 有些问题一句话说不清。鲸语把回答拆成两条通道：语音脑先开口，把转写流进会话；文字脑同时工作，把完整答案写在下面。语音继续增长时，文字答案被自然往下推。悬浮球、声音、设置全部由 DSH-Go 原生绘制，插件只声明。MIT 开源。

关键词：DSH-Go、双脑、语音、TTS、插件、DeepSeek、鲸鱼、开源。
