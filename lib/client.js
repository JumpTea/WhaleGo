window.__ModuleLoader__.load({
  id: 'whalego',
  factory: (require) => {
    const React = require('react');
    const { useCallback, useEffect, useRef, useState } = React;
    const h = React.createElement;

    const STYLE_KEY = 'whalego.orb.style';
    const POS_KEY = 'whalego.orb.pos';
    const STYLES = ['aurora', 'sonar', 'pixel', 'minimal'];
    const STYLE_LABELS = { aurora: '极光', sonar: '声呐', pixel: '像素鲸', minimal: '极简' };

    const CSS = `
.whalego-orb{position:fixed;z-index:2147483000;width:64px;height:64px;border-radius:50%;
  cursor:grab;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;
  transition:transform .18s ease, box-shadow .3s ease;box-shadow:0 10px 30px rgba(20,30,60,.35)}
.whalego-orb:active{cursor:grabbing;transform:scale(.96)}
.whalego-orb .core{width:100%;height:100%;border-radius:50%;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:22px}
.whalego-orb[data-style="aurora"] .core{background:conic-gradient(from 0deg,#6ee7ff,#7c5cff,#ff7ad9,#ffd166,#6ee7ff);filter:saturate(1.15)}
.whalego-orb[data-style="aurora"] .core::after{content:"";position:absolute;inset:7px;border-radius:50%;background:rgba(10,14,24,.82);backdrop-filter:blur(2px)}
.whalego-orb[data-style="aurora"] .glyph{position:relative;z-index:1;font-size:20px;filter:drop-shadow(0 0 6px rgba(120,220,255,.7))}
.whalego-orb[data-style="sonar"] .core{background:radial-gradient(circle at 50% 45%,#0d2230,#050a12 70%);border:1px solid rgba(110,231,255,.55)}
.whalego-orb[data-style="sonar"] .ring{position:absolute;inset:0;border-radius:50%;border:1px solid rgba(110,231,255,.55);animation:whalego-sonar 2.6s ease-out infinite}
.whalego-orb[data-style="sonar"] .ring:nth-child(2){animation-delay:1.3s}
.whalego-orb[data-style="pixel"] .core{background:linear-gradient(180deg,#12233d,#0a1220);border:2px solid #6ee7ff;border-radius:14px}
.whalego-orb[data-style="pixel"] .glyph{font-size:24px;image-rendering:pixelated;filter:none}
.whalego-orb[data-style="minimal"] .core{background:rgba(16,20,30,.9);border:1.5px solid rgba(255,255,255,.75)}
.whalego-orb[data-style="minimal"] .glyph{font-size:20px;color:#fff}
.whalego-orb .glyph{position:relative;z-index:2}
.whalego-orb .ring{position:absolute;pointer-events:none}
.whalego-orb[data-state="thinking"]{animation:whalego-spin 1.4s linear infinite}
.whalego-orb[data-state="speaking"]{animation:whalego-beat .7s ease-in-out infinite}
.whalego-orb[data-state="listening"]{animation:whalego-ring 1.2s ease-out infinite}
@keyframes whalego-sonar{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.5);opacity:0}}
@keyframes whalego-spin{to{transform:rotate(360deg)}}
@keyframes whalego-beat{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes whalego-ring{0%{box-shadow:0 0 0 0 rgba(110,231,255,.45)}100%{box-shadow:0 0 0 26px rgba(110,231,255,0)}}
.whalego-sheet{position:fixed;z-index:2147482999;width:min(340px,calc(100vw - 112px));max-height:min(56vh,520px);
  display:flex;flex-direction:column;border-radius:18px;overflow:hidden;color:#eef4ff;
  background:linear-gradient(180deg,rgba(18,24,38,.97),rgba(12,16,26,.97));
  border:1px solid rgba(120,150,220,.28);box-shadow:0 18px 50px rgba(0,0,0,.45);backdrop-filter:blur(14px);
  font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.whalego-sheet header{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;font-weight:600}
.whalego-sheet header .dot{width:8px;height:8px;border-radius:50%;background:#6ee7ff;box-shadow:0 0 8px #6ee7ff}
.whalego-close{margin-left:auto;width:24px;height:24px;border-radius:50%;border:0;background:rgba(255,255,255,.08);
  color:#cfe0ff;font-size:15px;line-height:1;cursor:pointer}
.whalego-sheet .list{overflow:auto;padding:4px 10px 10px}
.whalego-row{display:flex;gap:8px;align-items:flex-start;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.07)}
.whalego-row .txt{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}
.whalego-play{flex:0 0 auto;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.28);
  background:rgba(255,255,255,.06);color:#eef4ff;cursor:pointer;font-size:12px}
.whalego-play[disabled]{opacity:.35;cursor:default}
.whalego-compose{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
.whalego-compose input{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);
  border-radius:12px;padding:9px 12px;color:#eef4ff;font:inherit;outline:none}
.whalego-compose input::placeholder{color:rgba(238,244,255,.45)}
.whalego-send{width:36px;height:36px;border-radius:50%;border:0;background:linear-gradient(135deg,#6ee7ff,#7c5cff);
  color:#06101f;font-size:16px;cursor:pointer}
.whalego-send[disabled],.whalego-stop[disabled]{opacity:.4;cursor:default}
.whalego-stop{margin:0 10px 10px;padding:8px;border-radius:12px;border:1px solid rgba(255,120,150,.4);
  background:rgba(255,90,130,.12);color:#ffd5de;font:inherit;cursor:pointer}
.whalego-styles{display:flex;gap:8px;padding:0 12px 12px}
.whalego-style{width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.3);cursor:pointer}
.whalego-style[data-on="1"]{box-shadow:0 0 0 2px #6ee7ff}
.whalego-hint{padding:2px 14px 10px;color:rgba(238,244,255,.55);font-size:12px}
`;

    function ensureCss() {
      if (document.getElementById('whalego-css')) return;
      const tag = document.createElement('style');
      tag.id = 'whalego-css';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    function useLocal(key, fallback) {
      const [value, setValue] = useState(() => {
        try {
          return localStorage.getItem(key) ?? fallback;
        } catch {
          return fallback;
        }
      });
      const save = useCallback(
        (next) => {
          setValue(next);
          try {
            localStorage.setItem(key, next);
          } catch {
            /* private mode */
          }
        },
        [key],
      );
      return [value, save];
    }

    function Orb() {
      const [open, setOpen] = useState(false);
      const [style, setStyle] = useLocal(STYLE_KEY, 'aurora');
      const [pos, setPos] = useState(() => {
        try {
          const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
          if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
        } catch {
          /* ignore */
        }
        return { x: 18, y: Math.max(120, window.innerHeight - 180) };
      });
      const [status, setStatus] = useState('idle');
      const [voices, setVoices] = useState([]);
      const [sessionId, setSessionId] = useState('');
      const [draft, setDraft] = useState('');
      const [busy, setBusy] = useState(false);
      const [playing, setPlaying] = useState('');
      const [notice, setNotice] = useState('');
      const audio = useRef(null);
      const drag = useRef(null);

      const refresh = useCallback(() => {
        fetch('/whalego/health')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && setStatus(d.status || 'idle'))
          .catch(() => {});
        fetch('/whalego/voices?limit=20')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setVoices(d && d.voices ? d.voices : []))
          .catch(() => {});
      }, []);

      useEffect(() => {
        refresh();
        fetch('/whalego/session')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => d && d.sessionId && setSessionId(d.sessionId))
          .catch(() => {});
        const timer = setInterval(refresh, open ? 2000 : 6000);
        return () => clearInterval(timer);
      }, [open, refresh]);

      const send = useCallback(async () => {
        const text = draft.trim();
        if (!text || busy) return;
        setBusy(true);
        setNotice('');
        try {
          let sid = sessionId;
          if (!sid) {
            const res = await fetch('/whalego/session');
            const data = res.ok ? await res.json() : null;
            sid = data && data.sessionId ? data.sessionId : '';
            if (sid) setSessionId(sid);
          }
          if (!sid) {
            setNotice('还没有可用的会话，先在 Web UI 里新建一个。');
            return;
          }
          const res = await fetch('/whalego/voice-turn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId: sid, text }),
          });
          if (!res.ok) {
            const body = await res.text();
            setNotice(`发送失败：${res.status} ${body.slice(0, 120)}`);
            return;
          }
          setDraft('');
          refresh();
        } catch (error) {
          setNotice(`发送失败：${error instanceof Error ? error.message : String(error)}`);
        } finally {
          setBusy(false);
        }
      }, [draft, busy, sessionId, refresh]);

      const stop = useCallback(async () => {
        if (!sessionId) return;
        try {
          await fetch('/whalego/cancel', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          refresh();
        } catch {
          /* the turn may already be over */
        }
      }, [sessionId, refresh]);

      const play = useCallback((voice) => {
        const data = voice && voice.audio && voice.audio.data;
        if (!data) return;
        if (audio.current) {
          try {
            audio.current.pause();
          } catch {
            /* ignore */
          }
        }
        const el = new Audio(`data:${(voice.audio && voice.audio.contentType) || 'audio/mpeg'};base64,${data}`);
        el.onended = () => setPlaying('');
        el.onerror = () => setPlaying('');
        audio.current = el;
        el.play()
          .then(() => {
            setPlaying(voice.messageId);
            window.__whalegoLastPlay = { id: voice.messageId, at: Date.now() };
          })
          .catch(() => setPlaying(''));
      }, []);

      const onPointerDown = (event) => {
        drag.current = { dx: event.clientX - pos.x, dy: event.clientY - pos.y, moved: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      };
      const onPointerMove = (event) => {
        const state = drag.current;
        if (!state) return;
        const x = Math.max(6, Math.min(window.innerWidth - 70, event.clientX - state.dx));
        const y = Math.max(6, Math.min(window.innerHeight - 70, event.clientY - state.dy));
        if (Math.abs(x - pos.x) > 3 || Math.abs(y - pos.y) > 3) state.moved = true;
        setPos({ x, y });
      };
      const onPointerUp = () => {
        const state = drag.current;
        drag.current = null;
        if (state && state.moved) {
          try {
            localStorage.setItem(POS_KEY, JSON.stringify(pos));
          } catch {
            /* ignore */
          }
          return;
        }
        setOpen((value) => !value);
      };

      // Dock the sheet to the opposite corner so it never covers the orb.
      const sheetStyle = { right: '16px', bottom: '24px' };

      const label = status === 'thinking' ? '在想' : status === 'speaking' ? '在说' : '待命';
      const rows = [...voices].reverse().map((voice) =>
        h(
          'div',
          { key: voice.messageId, className: 'whalego-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'whalego-play',
              disabled: !(voice.audio && voice.audio.data),
              onClick: () => play(voice),
              title: voice.audio && voice.audio.data ? '播放' : '没有音频',
            },
            playing === voice.messageId ? '❚❚' : '▶',
          ),
          h('div', { className: 'txt' }, voice.text || ''),
        ),
      );

      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            className: 'whalego-orb',
            'data-style': style,
            'data-state': playing ? 'speaking' : status,
            style: { left: `${pos.x}px`, top: `${pos.y}px` },
            onPointerDown,
            onPointerMove,
            onPointerUp,
            title: `WhaleGo · ${label}`,
          },
          style === 'sonar' ? h('span', { className: 'ring' }) : null,
          style === 'sonar' ? h('span', { className: 'ring' }) : null,
          h('span', { className: 'core' }, h('span', { className: 'glyph' }, '🐋')),
        ),
        open
          ? h(
              'div',
              { className: 'whalego-sheet', style: sheetStyle },
              h(
                'header',
                null,
                h('span', { className: 'dot' }),
                `WhaleGo · ${label}`,
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'whalego-close',
                    onClick: () => setOpen(false),
                    title: '收起',
                  },
                  '×',
                ),
              ),
              sessionId ? null : h('div', { className: 'whalego-hint' }, '还没有会话：先新建一个再说话。'),
              h(
                'div',
                { className: 'list' },
                rows.length ? rows : h('div', { className: 'whalego-hint' }, '还没有语音，发一句试试。'),
              ),
              h(
                'div',
                { className: 'whalego-compose' },
                h('input', {
                  value: draft,
                  placeholder: '说点什么，或打字…',
                  onChange: (event) => setDraft(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') void send();
                  },
                }),
                h(
                  'button',
                  { type: 'button', className: 'whalego-send', disabled: busy || !draft.trim(), onClick: () => void send() },
                  busy ? '…' : '↑',
                ),
              ),
              h('button', { type: 'button', className: 'whalego-stop', onClick: () => void stop() }, '⏹ 打断'),
              h(
                'div',
                { className: 'whalego-styles' },
                STYLES.map((name) =>
                  h('button', {
                    key: name,
                    type: 'button',
                    className: 'whalego-style',
                    'data-on': name === style ? '1' : '0',
                    title: STYLE_LABELS[name],
                    style: {
                      background:
                        name === 'aurora'
                          ? 'conic-gradient(from 0deg,#6ee7ff,#7c5cff,#ff7ad9,#ffd166)'
                          : name === 'sonar'
                            ? 'radial-gradient(circle,#0d2230,#050a12)'
                            : name === 'pixel'
                              ? '#12233d'
                              : '#10141e',
                    },
                    onClick: () => setStyle(name),
                  }),
                ),
              ),
              notice ? h('div', { className: 'whalego-hint' }, notice) : null,
            )
          : null,
      );
    }

    function apply() {
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        return;
      }
      if (!document.body || document.getElementById('whalego-voice-host')) return;
      ensureCss();
      const host = document.createElement('div');
      host.id = 'whalego-voice-host';
      document.body.appendChild(host);
      require('react-dom/client').createRoot(host).render(h(Orb));
    }

    return { apply, inject: [] };
  },
});
