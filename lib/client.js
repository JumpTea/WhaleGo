window.__ModuleLoader__.load({
  id: 'whalego',
  factory: (require) => {
    const React = require('react');
    const { useCallback, useEffect, useRef, useState } = React;
    const h = React.createElement;

    const BUTTON = {
      position: 'fixed',
      left: '14px',
      bottom: '14px',
      zIndex: 2147483000,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      border: '1px solid rgba(120,130,160,.35)',
      borderRadius: '999px',
      background: 'rgba(28,32,44,.82)',
      color: '#fff',
      fontSize: '13px',
      cursor: 'pointer',
      backdropFilter: 'blur(8px)',
    };
    const PANEL = {
      position: 'fixed',
      left: '14px',
      bottom: '58px',
      zIndex: 2147483000,
      width: 'min(360px, calc(100vw - 28px))',
      maxHeight: '60vh',
      overflow: 'auto',
      padding: '10px',
      border: '1px solid rgba(120,130,160,.35)',
      borderRadius: '14px',
      background: 'rgba(22,26,36,.96)',
      color: '#fff',
      boxShadow: '0 12px 40px rgba(0,0,0,.35)',
      fontSize: '13px',
    };
    const ROW = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      padding: '8px 6px',
      borderBottom: '1px solid rgba(255,255,255,.08)',
    };
    const TEXT = { flex: '1 1 auto', minWidth: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
    const PLAY = {
      flex: '0 0 auto',
      width: '26px',
      height: '26px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,.3)',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      fontSize: '12px',
    };

    function VoicePanel() {
      const [open, setOpen] = useState(false);
      const [voices, setVoices] = useState([]);
      const [playing, setPlaying] = useState('');
      const audio = useRef(null);

      const load = useCallback(() => {
        fetch('/whalego/voices?limit=30')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => setVoices(d && d.voices ? d.voices : []))
          .catch(() => setVoices([]));
      }, []);

      useEffect(() => {
        if (open) load();
      }, [open, load]);

      const play = useCallback(
        (voice) => {
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
          el.play().then(() => setPlaying(voice.messageId)).catch(() => setPlaying(''));
        },
        [],
      );

      const rows = voices.map((voice) =>
        h(
          'div',
          { key: voice.messageId, style: ROW },
          h(
            'button',
            {
              type: 'button',
              style: PLAY,
              title: voice.audio && voice.audio.data ? '播放' : '此条没有音频',
              disabled: !(voice.audio && voice.audio.data),
              onClick: () => play(voice),
            },
            playing === voice.messageId ? '❚❚' : '▶',
          ),
          h('div', { style: TEXT }, voice.text || ''),
        ),
      );

      return h(
        React.Fragment,
        null,
        h(
          'button',
          { type: 'button', style: BUTTON, onClick: () => setOpen((v) => !v), title: 'WhaleGo 语音记录' },
          '🔊',
          '语音',
          voices.length ? ` ${voices.length}` : '',
        ),
        open
          ? h(
              'div',
              { style: PANEL },
              h('div', { style: { opacity: 0.7, padding: '2px 6px 8px' } }, 'WhaleGo · 最近语音'),
              rows.length ? rows : h('div', { style: { opacity: 0.6, padding: '8px 6px' } }, '还没有语音记录'),
            )
          : null,
      );
    }

    function apply(ctx) {
      if (typeof document === 'undefined' || !document.body) return;
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        /* no DOM (tests) */
      }
      const host = document.createElement('div');
      host.id = 'whalego-voice-host';
      document.body.appendChild(host);
      // Mount outside the React app: the panel has to survive route changes and
      // work in the App's web view as well.
      try {
        const { createRoot } = require('react-dom/client');
        createRoot(host).render(h(VoicePanel));
      } catch {
        host.remove();
      }
    }

    return { apply, inject: ['slots'] };
  },
});
