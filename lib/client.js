window.__ModuleLoader__.load({
  id: 'whalego',
  factory: (require) => {
    const React = require('react');
    const { useCallback, useEffect, useRef, useState } = React;
    const h = React.createElement;

    const CARD = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      margin: '6px 0 2px',
      padding: '8px 10px',
      border: '1px solid var(--dsh-border, rgba(120,130,160,.28))',
      borderRadius: '12px',
      background: 'var(--dsh-surface-2, rgba(120,130,160,.08))',
      maxWidth: '100%',
    };
    const ICON = { fontSize: '15px', lineHeight: 1, flex: '0 0 auto', opacity: 0.85 };
    const TEXT = {
      flex: '1 1 auto',
      minWidth: 0,
      fontSize: '13px',
      lineHeight: '1.45',
      color: 'var(--dsh-text-2, inherit)',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    };
    const BUTTON = {
      flex: '0 0 auto',
      border: '1px solid var(--dsh-border, rgba(120,130,160,.35))',
      background: 'transparent',
      color: 'inherit',
      borderRadius: '999px',
      width: '26px',
      height: '26px',
      cursor: 'pointer',
      fontSize: '12px',
      lineHeight: 1,
    };

    /** One compact replay card under an assistant message that has a voice line. */
    function VoiceCard({ messageId }) {
      const [voice, setVoice] = useState(null);
      const [playing, setPlaying] = useState(false);
      const audioRef = useRef(null);

      useEffect(() => {
        if (!messageId) return undefined;
        let alive = true;
        fetch(`/whalego/voices?messageId=${encodeURIComponent(messageId)}`)
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (alive) setVoice(data && data.voices ? data.voices[0] : null);
          })
          .catch(() => {});
        return () => {
          alive = false;
          try {
            audioRef.current?.pause();
          } catch {
            /* the element may be gone */
          }
        };
      }, [messageId]);

      const toggle = useCallback(() => {
        const data = voice && voice.audio && voice.audio.data;
        if (!data) return;
        if (!audioRef.current) {
          const audio = new Audio(`data:${(voice.audio && voice.audio.contentType) || 'audio/mpeg'};base64,${data}`);
          audio.onended = () => setPlaying(false);
          audio.onerror = () => setPlaying(false);
          audioRef.current = audio;
        }
        if (playing) {
          audioRef.current.pause();
          setPlaying(false);
        } else {
          audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
      }, [voice, playing]);

      if (!voice) return null;
      const playable = Boolean(voice.audio && voice.audio.data);
      return h(
        'div',
        { style: CARD },
        h('span', { style: ICON, 'aria-hidden': 'true' }, '🔊'),
        h('span', { style: TEXT }, voice.text || ''),
        playable
          ? h('button', { type: 'button', style: BUTTON, onClick: toggle, title: playing ? '暂停' : '播放' }, playing ? '❚❚' : '▶')
          : null,
      );
    }

    function apply(ctx) {
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        /* no DOM (tests) */
      }
      ctx.slots.inject('conversation.chat.assistant-actions', () =>
        ctx.slots.register({ name: 'conversation.chat.assistant-actions' }, VoiceCard),
      );
    }

    return { apply, inject: ['slots'] };
  },
});
