# Third-party notices

This project is an unofficial plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and includes code and assets derived from third-party sources. Their licenses are reproduced below as required. This project itself is licensed under [MIT](LICENSE).

## DeepSeek Harness (deepseek-ai/deepseek-harness)

- Website: https://github.com/deepseek-ai/deepseek-harness
- License: MIT, Copyright (c) 2026 DeepSeek

Portions of this repository are derived from, ported from, or vendored from the DeepSeek Harness repository and its published npm packages (`@deepseek-ai/*`), including but not limited to:

- `packages/helper/assets/chat.css`, `theme.css`, `observation-frame.css` — the chat UI token sheets and component styles ported from the official client packages (`packages/client/ui-chat`, `ui-tool`, `ui-primitives`).
- `packages/computer-use` — vendored from the official `packages/experimental/tool-computer-use` package, then renamed and modified.
- `packages/helper/assets/deepseek-avatar-square.gif` — the default floating-ball avatar, shipped unchanged from the official repository (`apps/desktop/renderer/deepseek-avatar-square.gif`).
- Floating-window / overlay-guard semantics and timing constants ported from the official desktop app.

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

DeepSeek, the DeepSeek logo, and the DeepSeek avatar artwork are trademarks or copyrighted works of DeepSeek AI. This unofficial project claims no affiliation with or endorsement by DeepSeek AI.

## Shiki

- Website: https://shiki.style
- License: MIT

Syntax-highlighting grammars and runtime under `packages/helper/assets/vendor/` are built from Shiki.

```
MIT License

Copyright (c) 2017 Pine Wu
Copyright (c) 2022 Anthony Fu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## WebRTC Audio Processing (webrtc-audio-processing)

- Website: https://gitlab.freedesktop.org/pulseaudio/webrtc-audio-processing
- License: BSD-3-Clause (Google's WebRTC audio processing, packaged by the PulseAudio project)

`packages/voice/prebuilds/win32-x64/libwebrtc-audio-processing-1-3.dll` is the unmodified MSYS2 UCRT64 build of that library, redistributed with the Windows capture helper.

```
BSD 3-Clause License

Copyright (c) 2011, Google Inc.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software without
   specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Abseil (abseil-cpp)

- Website: https://abseil.io
- License: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0)

Abseil is linked into `libwebrtc-audio-processing-1-3.dll`; no Abseil source or headers are redistributed here.

## MSYS2 mingw-w64 runtime

`packages/voice/prebuilds/win32-x64/` also ships the MinGW-w64 runtime the helper links against:

- `libstdc++-6.dll`, `libgcc_s_seh-1.dll` — GPL-3.0-or-later WITH the GCC Runtime Library Exception 3.1 (https://www.gnu.org/licenses/gcc-exception-3.1.html). They are redistributed as runtime libraries next to the executable, which the exception permits.
- `libwinpthread-1.dll` — MIT / BSD-style terms from the mingw-w64 project (https://mingw-w64.org).

## sherpa-onnx KWS zipformer zh-en 3M (wake-word model)

- Upstream: https://github.com/k2-fsa/sherpa-onnx
- Release: `kws-models` — `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2`
- License: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0)

`models/kws` redistributes eight files from that release — `tokens.txt`, `en.phone`, and the chunk-8 / chunk-16 int8 encoder, fp32 decoder and int8 joiner the spotter opens — byte-for-byte and unmodified, as the npm package `dsh-orb-kws`. The fp32 encoders, the fp32 joiners and `test_wavs/` are not redistributed because the plugin never loads them. Attribution and a copy of the license ship inside that package (`models/kws/NOTICE.md`, `models/kws/LICENSE`).

## Other dependencies

Runtime and development dependencies declared in the workspace packages (for example `koffi`, `zod`, `tsdown`, `typescript`, `vitest`) keep their own licenses as published on npm; this repository does not vendor or redistribute their source.
