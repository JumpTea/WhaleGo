/**
 * WhaleGo web half — a full-screen voice space.
 *
 * One glowing orb is the whole interface: tap it, speak, watch the answer
 * arrive as text while the audio streams, tap again to interrupt. No history
 * list, no play buttons, no nested panels.
 *
 * Loaded by DSH's web module loader; runs in the page, never on the server.
 */
window.__ModuleLoader__.load({
  id: 'whalego',
  factory: (require) => {
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    const { useState, useEffect, useRef, useCallback } = React;
    const h = React.createElement;

    const STYLE_ID = 'whalego-style';
    const HOST_ID = 'whalego-voice-host';
    const POS_KEY = 'whalego:orb';
    const PHASES = ['idle', 'listening', 'thinking', 'speaking', 'done'];

    const CSS = `
.wg-host{position:fixed;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Helvetica Neue",sans-serif}
.wg-bubble{position:fixed;width:58px;height:58px;border-radius:50%;border:0;padding:0;cursor:pointer;
  background:radial-gradient(circle at 32% 28%,#ffffff 0%,#cfe0ff 18%,#6f8dff 45%,#2a3ea8 78%,#131a44 100%);
  box-shadow:0 0 0 1px rgba(255,255,255,.22) inset,0 8px 28px rgba(77,107,254,.45),0 2px 8px rgba(0,0,0,.35);
  transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease;touch-action:none}
.wg-bubble::after{content:"";position:absolute;inset:-8px;border-radius:50%;
  background:radial-gradient(circle,rgba(77,107,254,.45),transparent 65%);filter:blur(10px);z-index:-1;
  animation:wg-breathe 3.6s ease-in-out infinite}
.wg-bubble:hover{transform:scale(1.06)}
.wg-bubble:active{transform:scale(.96)}
@keyframes wg-breathe{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:.95;transform:scale(1.08)}}

.wg-space{position:fixed;inset:0;z-index:2147483001;overflow:hidden;color:rgba(255,255,255,.94);
  background:radial-gradient(120% 90% at 50% 18%,#0e1730 0%,#070b16 42%,#04060c 100%);
  animation:wg-in .42s cubic-bezier(.22,1,.36,1) both}
@keyframes wg-in{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:scale(1)}}
.wg-aurora{position:absolute;filter:blur(90px);opacity:.5;border-radius:50%;pointer-events:none;mix-blend-mode:screen}
.wg-aurora.a{width:68vmax;height:68vmax;left:-18vmax;top:-12vmax;background:radial-gradient(circle,#4d6bfe,transparent 62%);animation:wg-drift 18s ease-in-out infinite alternate}
.wg-aurora.b{width:52vmax;height:52vmax;right:-14vmax;bottom:-10vmax;background:radial-gradient(circle,#36e2c7,transparent 60%);animation:wg-drift 22s ease-in-out infinite alternate-reverse}
.wg-noise{position:absolute;inset:0;pointer-events:none;opacity:.05;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='.55'/></svg>")}
@keyframes wg-drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(4vmax,3vmax,0) scale(1.12)}}

.wg-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(18px,env(safe-area-inset-top)) 20px 0;z-index:3}
.wg-close{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);font-size:16px;line-height:1;cursor:pointer;
  backdrop-filter:blur(12px)}
.wg-brand{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.42)}

.wg-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2}
.wg-orb{position:relative;width:clamp(180px,46vw,260px);height:clamp(180px,46vw,260px);border-radius:50%;overflow:hidden;
  clip-path:circle(50% at 50% 50%);
  box-shadow:0 0 70px rgba(77,107,254,.5),0 0 170px rgba(54,226,199,.22),inset 0 0 40px rgba(255,255,255,.28);
  transition:transform .8s cubic-bezier(.22,1,.36,1),filter .8s ease}
.wg-orb .core{position:absolute;inset:0;border-radius:50%;clip-path:circle(50% at 50% 50%);
  background:radial-gradient(circle at 34% 28%,#ffffff 0%,#eef4ff 9%,#b7caff 24%,#5d7bff 52%,#24327f 82%,#0c1234 100%);
  box-shadow:0 0 60px rgba(77,107,254,.55),0 0 160px rgba(54,226,199,.22),inset 0 0 40px rgba(255,255,255,.4),inset 0 -28px 60px rgba(8,12,40,.55)}
.wg-orb .fluid{position:absolute;inset:0;border-radius:50%;opacity:.42;
  background:conic-gradient(from 0deg,#4d6bfe,#36e2c7,#7f8bff,#4d6bfe);
  -webkit-mask:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 58%,transparent 72%);
  mask:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 58%,transparent 72%);
  animation:wg-spin 9s linear infinite}
.wg-orb .halo{display:none}
@keyframes wg-spin{to{transform:rotate(360deg)}}
.wg-space[data-phase="listening"] .wg-orb{transform:scale(1.04)}
.wg-space[data-phase="listening"] .wg-orb .core{animation:wg-listen 1.6s ease-in-out infinite}
.wg-space[data-phase="thinking"] .wg-orb{transform:scale(.92)}
.wg-space[data-phase="thinking"] .wg-orb .fluid{animation-duration:2.4s;opacity:.5}
.wg-space[data-phase="speaking"] .wg-orb{transform:scale(1.02)}
.wg-space[data-phase="speaking"] .wg-orb .core{animation:wg-speak 1.1s ease-in-out infinite}
@keyframes wg-listen{0%,100%{box-shadow:0 0 60px rgba(77,107,254,.55),0 0 160px rgba(54,226,199,.22)}50%{box-shadow:0 0 90px rgba(77,107,254,.8),0 0 200px rgba(54,226,199,.35)}}
@keyframes wg-speak{0%,100%{transform:scale(1)}35%{transform:scale(1.035)}70%{transform:scale(.99)}}

.wg-state{margin-top:44px;font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.42)}
.wg-transcript{position:absolute;left:50%;transform:translateX(-50%);bottom:max(168px,calc(env(safe-area-inset-bottom) + 158px));
  width:min(760px,86vw);max-height:30vh;overflow-y:auto;text-align:center;z-index:3;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(to bottom,transparent,#000 18%,#000 82%,transparent)}
.wg-transcript::-webkit-scrollbar{display:none}
.wg-line{font-size:17px;line-height:1.7;color:rgba(255,255,255,.9);margin:10px 0;white-space:pre-wrap}
.wg-line.you{color:rgba(255,255,255,.5);font-size:15px}
.wg-line.answer{font-size:clamp(17px,2.2vw,22px);letter-spacing:.01em}
.wg-caret{display:inline-block;width:2px;height:1em;vertical-align:-2px;margin-left:3px;background:#8fa6ff;animation:wg-caret 1s steps(1) infinite}
@keyframes wg-caret{50%{opacity:0}}
.wg-hint{position:absolute;bottom:max(34px,calc(env(safe-area-inset-bottom) + 26px));left:50%;transform:translateX(-50%);
  font-size:12.5px;color:rgba(255,255,255,.32);letter-spacing:.08em;z-index:3;white-space:nowrap}
.wg-input{position:absolute;left:50%;transform:translateX(-50%);bottom:max(96px,calc(env(safe-area-inset-bottom) + 88px));
  width:min(560px,84vw);display:flex;gap:10px;z-index:4}
.wg-input input{flex:1;height:46px;border-radius:23px;border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);color:#fff;padding:0 18px;font-size:15px;outline:none;backdrop-filter:blur(14px)}
.wg-input input::placeholder{color:rgba(255,255,255,.34)}
.wg-input button{width:46px;height:46px;border-radius:50%;border:0;cursor:pointer;color:#fff;font-size:18px;
  background:linear-gradient(140deg,#5b78ff,#36e2c7);box-shadow:0 8px 24px rgba(77,107,254,.4)}
.wg-error{position:absolute;left:50%;transform:translateX(-50%);bottom:max(150px,calc(env(safe-area-inset-bottom) + 140px));
  font-size:13px;color:#ffb4b4;background:rgba(120,20,30,.35);border:1px solid rgba(255,120,120,.25);
  padding:8px 14px;border-radius:12px;z-index:4;max-width:82vw;text-align:center}
@media (prefers-reduced-motion:reduce){
  .wg-aurora,.wg-orb .fluid,.wg-orb .halo,.wg-bubble::after,.wg-orb .core{animation:none!important}
  .wg-space{animation:none}
}
`;

    /* ---------------------------------------------------------------- utils */

    function ensureStyle() {
      if (typeof document === 'undefined') return;
      try {
        if (document.getElementById(STYLE_ID)) return;
        const tag = document.createElement('style');
        tag.id = STYLE_ID;
        tag.textContent = CSS;
        document.head.appendChild(tag);
      } catch {
        /* headless */
      }
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        credentials: 'same-origin',
        headers: options.body ? { 'content-type': 'application/json' } : undefined,
        ...options,
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    }

    async function ensureSession() {
      try {
        const found = await api('/whalego/session');
        if (found?.sessionId) return found.sessionId;
      } catch {
        /* fall through to create */
      }
      const created = await api('/whalego/session', { method: 'POST' });
      return created?.sessionId ?? '';
    }

    function speech() {
      if (typeof window === 'undefined') return null;
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    /* --------------------------------------------------------------- player */

    function createPlayer() {
      let audio = null;
      let url = null;
      let aborter = null;
      const stop = () => {
        try {
          aborter?.abort();
        } catch {
          /* gone */
        }
        try {
          audio?.pause();
        } catch {
          /* gone */
        }
        try {
          if (url) URL.revokeObjectURL(url);
        } catch {
          /* gone */
        }
        audio = null;
        url = null;
        aborter = null;
      };
      const play = async (text) => {
        stop();
        aborter = new AbortController();
        const response = await fetch('/whalego/speak', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: aborter.signal,
        });
        if (!response.ok || !response.body) throw new Error('speech failed');
        audio = new Audio();
        audio.autoplay = true;
        const supported =
          typeof window.MediaSource !== 'undefined' && window.MediaSource.isTypeSupported?.('audio/mpeg');
        if (supported) {
          const media = new window.MediaSource();
          url = URL.createObjectURL(media);
          audio.src = url;
          const queue = [];
          let ended = false;
          let buffer = null;
          const pump = () => {
            if (!buffer || buffer.updating) return;
            if (queue.length) {
              try {
                buffer.appendBuffer(queue.shift());
              } catch {
                /* wait for the next updateend */
              }
              return;
            }
            if (ended && media.readyState === 'open') {
              try {
                media.endOfStream();
              } catch {
                /* already closed */
              }
            }
          };
          media.addEventListener('sourceopen', () => {
            try {
              buffer = media.addSourceBuffer('audio/mpeg');
              buffer.addEventListener('updateend', pump);
            } catch {
              /* fall back to buffered playback */
            }
            pump();
          });
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            queue.push(value);
            pump();
          }
          ended = true;
          pump();
          void audio.play().catch(() => {});
          return;
        }
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        audio.src = url;
        void audio.play().catch(() => {});
      };
      return { play, stop };
    }

    /* ------------------------------------------------------------ component */

    function VoiceSpace() {
      const [open, setOpen] = useState(false);
      const [phase, setPhase] = useState('idle');
      const [you, setYou] = useState('');
      const [answer, setAnswer] = useState('');
      const [interim, setInterim] = useState('');
      const [error, setError] = useState('');
      const [typed, setTyped] = useState('');
      const [pos, setPos] = useState(() => {
        try {
          return JSON.parse(window.localStorage.getItem(POS_KEY) || 'null');
        } catch {
          return null;
        }
      });
      const phaseRef = useRef('idle');
      const recogRef = useRef(null);
      const playerRef = useRef(null);
      const sseRef = useRef(null);
      const dragRef = useRef(null);
      const sessionRef = useRef('');
      const silenceRef = useRef(null);

      if (!playerRef.current) playerRef.current = createPlayer();

      const setPhaseSafe = useCallback((next) => {
        phaseRef.current = next;
        setPhase(next);
      }, []);

      const cleanupStreams = useCallback(() => {
        try {
          sseRef.current?.close();
        } catch {
          /* gone */
        }
        sseRef.current = null;
        playerRef.current?.stop();
        try {
          recogRef.current?.stop();
        } catch {
          /* gone */
        }
        recogRef.current = null;
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
      }, []);

      const close = useCallback(() => {
        cleanupStreams();
        setOpen(false);
        setPhaseSafe('idle');
        setInterim('');
        setAnswer('');
        setYou('');
        setError('');
        setTyped('');
        try {
          api('/whalego/cancel', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
        } catch {
          /* gone */
        }
      }, [cleanupStreams, setPhaseSafe]);

      const cancel = useCallback(() => {
        cleanupStreams();
        setPhaseSafe('idle');
        setInterim('');
        setError('');
        try {
          const sessionId = sessionRef.current;
          if (sessionId) {
            api('/whalego/cancel', { method: 'POST', body: JSON.stringify({ sessionId }) }).catch(() => {});
          }
        } catch {
          /* gone */
        }
      }, [cleanupStreams, setPhaseSafe]);

      const follow = useCallback(
        (turnId, sessionId, spokenText) => {
          try {
            sseRef.current?.close();
          } catch {
            /* gone */
          }
          const source = new EventSource(
            `/whalego/live?turn=${encodeURIComponent(turnId)}&session=${encodeURIComponent(sessionId)}`,
          );
          sseRef.current = source;
          let audioStarted = false;
          source.addEventListener('live', (event) => {
            let data;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            if (data.voice) setAnswer(data.voice);
            if (data.state === 'speaking') {
              setPhaseSafe('speaking');
              if (!audioStarted) {
                audioStarted = true;
                const line = (data.voice || spokenText || '').trim();
                if (line) playerRef.current.play(line).catch(() => {});
              }
            } else if (data.state === 'thinking') {
              setPhaseSafe('thinking');
            } else if (data.state === 'done') {
              setPhaseSafe('done');
            } else if (data.state === 'interrupted') {
              setPhaseSafe('idle');
            } else if (data.state === 'error') {
              setPhaseSafe('idle');
              setError('这一轮没走完，稍后再试。');
            }
          });
          source.addEventListener('end', () => {
            try {
              source.close();
            } catch {
              /* gone */
            }
            if (phaseRef.current !== 'idle') setPhaseSafe('done');
          });
          source.addEventListener('error', () => {
            try {
              source.close();
            } catch {
              /* gone */
            }
          });
        },
        [setPhaseSafe],
      );

      const send = useCallback(
        async (raw) => {
          const text = String(raw || '').trim();
          if (!text) return;
          setError('');
          setYou(text);
          setAnswer('');
          setInterim('');
          setPhaseSafe('thinking');
          try {
            sessionRef.current = sessionRef.current || (await ensureSession());
            const sessionId = sessionRef.current;
            if (!sessionId) throw new Error('no session');
            const result = await api('/whalego/voice-turn', {
              method: 'POST',
              body: JSON.stringify({ sessionId, text }),
            });
            const turnId = result?.effect?.key;
            if (!turnId) throw new Error('no turn');
            follow(turnId, sessionId, text);
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
            setPhaseSafe('idle');
          }
        },
        [follow, setPhaseSafe],
      );

      const startListening = useCallback(() => {
        const Recognition = speech();
        if (!Recognition) return false;
        try {
          recogRef.current?.stop();
        } catch {
          /* gone */
        }
        const recog = new Recognition();
        recog.lang = 'zh-CN';
        recog.continuous = true;
        recog.interimResults = true;
        let finalText = '';
        recog.onresult = (event) => {
          let partial = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = result[0]?.transcript ?? '';
            if (result.isFinal) finalText += transcript;
            else partial += transcript;
          }
          setInterim(`${finalText}${partial}`);
          if (silenceRef.current) clearTimeout(silenceRef.current);
          silenceRef.current = setTimeout(() => {
            const said = `${finalText}${partial}`.trim();
            try {
              recog.stop();
            } catch {
              /* gone */
            }
            if (said) void send(said);
          }, 1400);
        };
        recog.onerror = () => {
          setPhaseSafe('idle');
        };
        recog.onend = () => {
          if (phaseRef.current === 'listening') setPhaseSafe('idle');
        };
        recogRef.current = recog;
        try {
          recog.start();
          setPhaseSafe('listening');
          return true;
        } catch {
          return false;
        }
      }, [send, setPhaseSafe]);

      const openSpace = useCallback(() => {
        setOpen(true);
        setAnswer('');
        setYou('');
        setInterim('');
        setError('');
        setTyped('');
        setPhaseSafe('idle');
        sessionRef.current = '';
        void ensureSession().then((sessionId) => {
          sessionRef.current = sessionId;
        });
        setTimeout(() => {
          if (phaseRef.current === 'idle') startListening();
        }, 380);
      }, [setPhaseSafe, startListening]);

      useEffect(() => () => cleanupStreams(), [cleanupStreams]);

      const onPointerDown = (event) => {
        const target = event.currentTarget;
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          left: target.offsetLeft,
          top: target.offsetTop,
          moved: false,
        };
        try {
          target.setPointerCapture?.(event.pointerId);
        } catch {
          /* synthetic pointer events have no capture */
        }
      };
      const onPointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        if (!drag.moved) return;
        setPos({ left: drag.left + dx, top: drag.top + dy });
      };
      const onPointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        if (!drag.moved) {
          openSpace();
          return;
        }
        setPos((current) => {
          const next = current ?? { left: window.innerWidth - 82, top: window.innerHeight - 96 };
          try {
            window.localStorage.setItem(POS_KEY, JSON.stringify(next));
          } catch {
            /* private mode */
          }
          return next;
        });
      };

      const bubbleStyle = {
        right: pos ? 'auto' : 20,
        bottom: pos ? 'auto' : 24,
        left: pos ? `${pos.left}px` : 'auto',
        top: pos ? `${pos.top}px` : 'auto',
      };

      const bubble = h('button', {
        className: 'wg-bubble',
        type: 'button',
        'aria-label': '打开 WhaleGo 语音空间',
        style: bubbleStyle,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
      });

      if (!open) return bubble;

      const transcript = [];
      if (you || interim) transcript.push(h('div', { className: 'wg-line you', key: 'you' }, you || interim));
      if (answer) {
        transcript.push(
          h(
            'div',
            { className: 'wg-line answer', key: 'answer' },
            answer,
            phase === 'speaking' ? h('span', { className: 'wg-caret' }) : null,
          ),
        );
      } else if (typed) {
        transcript.push(h('div', { className: 'wg-line answer', key: 'typed' }, typed));
      }

      const phaseLabel = {
        idle: '点一下开始说话',
        listening: '在听',
        thinking: '在想',
        speaking: '在说',
        done: '说完了，点一下继续',
      }[phase];

      const typedInput = h(
        'form',
        {
          className: 'wg-input',
          onSubmit: (event) => {
            event.preventDefault();
            const value = typed.trim();
            if (!value) return;
            setTyped('');
            void send(value);
          },
        },
        h('input', {
          value: typed,
          placeholder: speech() ? '也可以打字说一句' : '打字说一句',
          'aria-label': '输入一句话',
          onChange: (event) => setTyped(event.target.value),
        }),
        h('button', { type: 'submit', 'aria-label': '发送' }, '↑'),
      );

      return h(
        React.Fragment,
        null,
        bubble,
        h(
          'div',
          {
            className: 'wg-space',
            'data-phase': phase,
            role: 'dialog',
            'aria-label': 'WhaleGo 语音空间',
            onDoubleClick: cancel,
          },
          h('div', { className: 'wg-aurora a' }),
          h('div', { className: 'wg-aurora b' }),
          h('div', { className: 'wg-noise' }),
          h(
            'div',
            { className: 'wg-top' },
            h('button', { className: 'wg-close', type: 'button', 'aria-label': '收起', onClick: close }, '✕'),
            h('div', { className: 'wg-brand' }, 'WhaleGo'),
            h('span', { style: { width: 38 } }),
          ),
          h(
            'div',
            { className: 'wg-stage' },
            h(
              'div',
              { className: 'wg-orb', key: 'orb' },
              h('div', { className: 'halo' }),
              h('div', { className: 'fluid' }),
              h('div', { className: 'core' }),
            ),
            h('div', { className: 'wg-state' }, phaseLabel),
          ),
          h('div', { className: 'wg-transcript' }, transcript),
          error ? h('div', { className: 'wg-error' }, error) : null,
          typedInput,
          h(
            'div',
            { className: 'wg-hint' },
            phase === 'speaking' || phase === 'thinking' ? '双击任意处打断' : '说完停顿一下，我会接话',
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ api */

    function apply() {
      if (typeof document === 'undefined' || !document.body) return;
      ensureStyle();
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        /* ignore */
      }
      let host = document.getElementById(HOST_ID);
      if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.className = 'wg-host';
        document.body.appendChild(host);
      }
      createRoot(host).render(h(VoiceSpace));
    }

    return { apply, inject: [] };
  },
});
