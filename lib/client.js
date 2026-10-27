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
.wg-trigger{position:fixed;right:18px;bottom:92px;z-index:2147482800;display:inline-flex;align-items:center;gap:8px;
  height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.16);
  background:rgba(18,22,34,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  color:#eef2ff;font:600 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif;
  letter-spacing:.02em;box-shadow:0 8px 30px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12);
  cursor:pointer;transition:transform .24s cubic-bezier(.22,1,.36,1),background .24s ease}
.wg-trigger:hover{transform:translateY(-1px);background:rgba(24,30,46,.86)}
.wg-trigger:active{transform:scale(.96)}
.wg-trigger-dot{width:10px;height:10px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#bfe4ff,#4D6BFE 60%,#36E2C7);
  box-shadow:0 0 10px rgba(77,107,254,.9),0 0 22px rgba(54,226,199,.5)}
.wg-trigger[data-mode="on"]{background:rgba(10,13,22,.86);border-color:rgba(255,255,255,.2)}
.wg-trigger-x{font-size:15px;line-height:1;opacity:.92}
.wg-mini{position:fixed;right:20px;bottom:24px;z-index:2147482900;border:0;background:transparent;padding:0;cursor:pointer;
  filter:drop-shadow(0 10px 26px rgba(24,40,120,.55));transition:transform .24s cubic-bezier(.22,1,.36,1)}
.wg-mini:hover{transform:scale(1.05)}
.wg-orb.mini{width:64px;height:64px}
@keyframes wg-breathe{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:.95;transform:scale(1.08)}}

.wg-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(3,5,10,.52);backdrop-filter:blur(16px);
  opacity:0;pointer-events:none;transition:opacity .32s ease-out}
.wg-backdrop[data-open="true"]{opacity:1;pointer-events:auto}
.wg-space{position:fixed;left:50%;bottom:0;z-index:2147483001;width:min(560px,100%);height:88vh;height:88dvh;max-height:960px;
  transform:translate3d(-50%,108%,0);transition:transform .5s cubic-bezier(.16,1,.3,1);
  border-radius:30px 30px 0 0;overflow:hidden;color:rgba(255,255,255,.94);
  background:radial-gradient(120% 90% at 50% 8%,#0e1730 0%,#070b16 42%,#04060c 100%);
  box-shadow:0 -40px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);
  will-change:transform;backface-visibility:hidden;touch-action:none}
.wg-space[data-open="true"]{transform:translate3d(-50%,0,0)}
.wg-space[data-open="false"]{pointer-events:none}
.wg-grab{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:38px;height:5px;border-radius:3px;
  background:rgba(255,255,255,.24);z-index:6;pointer-events:none}
.wg-grabzone{position:absolute;top:0;left:0;right:0;height:64px;z-index:5;touch-action:none;cursor:grab}
.wg-grabzone:active{cursor:grabbing}
.wg-aurora{position:absolute;filter:blur(90px);opacity:.5;border-radius:50%;pointer-events:none;mix-blend-mode:screen}
.wg-aurora.a{width:68vmax;height:68vmax;left:-18vmax;top:-12vmax;background:radial-gradient(circle,#4d6bfe,transparent 62%);animation:wg-drift 18s ease-in-out infinite alternate}
.wg-aurora.b{width:52vmax;height:52vmax;right:-14vmax;bottom:-10vmax;background:radial-gradient(circle,#36e2c7,transparent 60%);animation:wg-drift 22s ease-in-out infinite alternate-reverse}
.wg-noise{position:absolute;inset:0;pointer-events:none;opacity:.05;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='.55'/></svg>")}
@keyframes wg-drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(4vmax,3vmax,0) scale(1.12)}}

.wg-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(18px,env(safe-area-inset-top)) 20px 0;z-index:3}
.wg-close{width:38px;height:38px;border-radius:50%;clip-path:circle(50% at 50% 50%);border:1px solid rgba(255,255,255,.14);
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
.wg-orb .fluid{position:absolute;inset:0;border-radius:50%;opacity:.58;mix-blend-mode:screen;
  background:conic-gradient(from 0deg,#4d6bfe,#36e2c7,#7f8bff,#4d6bfe);
  -webkit-mask:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 58%,transparent 72%);
  mask:radial-gradient(circle at 50% 50%,#000 34%,rgba(0,0,0,.55) 58%,transparent 72%);
  animation:wg-spin 9s linear infinite}
.wg-orb .fluid2{position:absolute;inset:-8%;border-radius:50%;opacity:.34;mix-blend-mode:screen;filter:blur(20px);
  background:conic-gradient(from 120deg,#36e2c7,#4d6bfe,#a9b8ff,#36e2c7);
  animation:wg-spin-rev 15s linear infinite}
.wg-orb .sheen{position:absolute;inset:0;border-radius:50%;mix-blend-mode:screen;opacity:.5;
  background:linear-gradient(140deg,rgba(255,255,255,.6) 0%,rgba(255,255,255,.16) 26%,rgba(255,255,255,0) 46%);
  animation:wg-sheen 7s ease-in-out infinite}
.wg-orb .halo{display:block;position:absolute;inset:-26%;border-radius:50%;pointer-events:none;opacity:.55;
  background:radial-gradient(circle,rgba(77,107,254,.42) 0%,rgba(54,226,199,.18) 42%,transparent 68%);
  animation:wg-halo 6s ease-in-out infinite}
@keyframes wg-spin{to{transform:rotate(360deg)}}
@keyframes wg-spin-rev{to{transform:rotate(-360deg)}}
@keyframes wg-sheen{0%,100%{transform:translate3d(-6%,-4%,0) rotate(0deg);opacity:.38}50%{transform:translate3d(6%,4%,0) rotate(12deg);opacity:.62}}
@keyframes wg-halo{0%,100%{transform:scale(.96);opacity:.42}50%{transform:scale(1.06);opacity:.66}}
.wg-space[data-phase="idle"] .wg-orb{animation:wg-float 9s ease-in-out infinite}
@keyframes wg-float{0%,100%{translate:0 0}50%{translate:0 -10px}}
.wg-space[data-phase="listening"] .wg-orb{transform:scale(1.04)}
.wg-space[data-phase="listening"] .wg-orb .core{animation:wg-listen 1.6s ease-in-out infinite}
.wg-space[data-phase="listening"] .wg-orb .halo{animation:wg-halo 1.8s ease-in-out infinite}
.wg-space[data-phase="thinking"] .wg-orb{transform:scale(.92)}
.wg-space[data-phase="thinking"] .wg-orb .fluid{animation-duration:2.4s;opacity:.5}
.wg-space[data-phase="speaking"] .wg-orb{transform:scale(1.02)}
.wg-space[data-phase="speaking"] .wg-orb .core{animation:wg-speak 1.1s ease-in-out infinite}
.wg-space[data-phase="speaking"] .wg-orb .fluid{animation-duration:2.2s}
.wg-space[data-phase="speaking"] .wg-orb .fluid2{animation-duration:4.5s}
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
.wg-controls{position:absolute;left:50%;transform:translateX(-50%);bottom:max(78px,calc(env(safe-area-inset-bottom) + 70px));
  display:flex;align-items:center;gap:18px;z-index:4}
.wg-ctl{width:52px;height:52px;border-radius:50%;clip-path:circle(50% at 50% 50%);border:1px solid rgba(255,255,255,.16);cursor:pointer;
  background:rgba(255,255,255,.08);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
  color:rgba(255,255,255,.92);font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;
  box-shadow:0 8px 26px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.14);
  transition:transform .22s cubic-bezier(.22,1,.36,1),background .22s ease}
.wg-ctl:hover{transform:translateY(-1px);background:rgba(255,255,255,.14)}
.wg-ctl:active{transform:scale(.94)}
.wg-ctl[data-on="true"]{background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3)}
.wg-ctl.danger{background:rgba(255,69,58,.18);border-color:rgba(255,99,88,.45);color:#ff9c94;font-size:24px}
.wg-ctl.danger:hover{background:rgba(255,69,58,.3)}
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
/* ---- light full-screen voice page, modelled on ChatGPT voice mode ---- */
#whalego-voice-host .wg-aurora,#whalego-voice-host .wg-noise{display:none}
#whalego-voice-host .wg-backdrop{background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;transition:opacity .2s ease}
#whalego-voice-host .wg-space{position:fixed;left:0;top:0;right:0;bottom:0;width:100%;height:100dvh;max-height:none;
  border-radius:0;background:#f7f7f5;color:#0a0a0b;transform:translate3d(0,26px,0);opacity:0;
  transition:transform .46s cubic-bezier(.22,1,.36,1),opacity .3s ease;will-change:transform,opacity;
  box-shadow:none;overflow:hidden}
#whalego-voice-host .wg-space[data-open="true"]{transform:translate3d(0,0,0);opacity:1}
#whalego-voice-host .wg-grab,#whalego-voice-host .wg-grabzone{display:none}
#whalego-voice-host .wg-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(14px,env(safe-area-inset-top)) 16px 0;z-index:5}
#whalego-voice-host .wg-brand{font:500 13px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif;
  letter-spacing:.34em;text-transform:uppercase;color:#111}
#whalego-voice-host .wg-round{width:44px;height:44px;border-radius:50%;clip-path:circle(50% at 50% 50%);border:0;cursor:pointer;
  background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;
  font-size:19px;line-height:1;transition:transform .18s ease,box-shadow .18s ease}
#whalego-voice-host .wg-round:active{transform:scale(.93)}
#whalego-voice-host .wg-stage{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:clamp(24px,4vh,44px);padding:64px 24px 200px;z-index:2}
#whalego-voice-host .wg-orb{width:min(74vw,470px);height:min(74vw,470px);border-radius:50%;
  clip-path:circle(50% at 50% 50%);background:#dfe7fb;
  box-shadow:inset 0 -30px 60px rgba(120,160,255,.25),0 30px 90px -34px rgba(80,120,255,.38);
  animation:wg-breathe 6s ease-in-out infinite}
@keyframes wg-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012)}}
#whalego-voice-host .wg-orb .core{box-shadow:none;background:
  radial-gradient(92% 78% at 50% 22%,#4f7bff 0%,#6f95fb 30%,#a9c1fa 56%,#e6edfb 80%,#ffffff 100%)}
#whalego-voice-host .wg-orb .fluid{inset:0;opacity:.72;mix-blend-mode:normal;filter:blur(18px);
  background:
    radial-gradient(38% 26% at 62% 34%,rgba(255,255,255,.95),transparent 70%),
    radial-gradient(30% 20% at 34% 52%,rgba(255,255,255,.85),transparent 72%),
    radial-gradient(46% 32% at 56% 74%,rgba(255,255,255,.98),transparent 74%);
  -webkit-mask:none;mask:none}
#whalego-voice-host .wg-orb .fluid2{inset:12%;opacity:.55;mix-blend-mode:normal;filter:blur(14px);
  background:radial-gradient(52% 40% at 44% 28%,rgba(255,255,255,.92),transparent 70%)}
#whalego-voice-host .wg-orb .sheen{opacity:.5}
#whalego-voice-host .wg-orb::after{content:'';position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:radial-gradient(62% 38% at 50% 88%,rgba(255,255,255,.9),transparent 72%);
  filter:blur(12px)}
#whalego-voice-host .wg-state{font:400 15px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#7a7f87}
#whalego-voice-host .wg-transcript{position:absolute;left:24px;right:24px;bottom:calc(112px + env(safe-area-inset-bottom));
  max-height:26vh;overflow:auto;text-align:center;z-index:3}
#whalego-voice-host .wg-line.you{font:400 15px/1.5 -apple-system,"PingFang SC",sans-serif;color:#9aa0a8;margin-bottom:12px}
#whalego-voice-host .wg-line.answer{font:400 18px/1.55 -apple-system,"PingFang SC",sans-serif;color:#0b0b0c;
  letter-spacing:.002em}
#whalego-voice-host .wg-caret{display:inline-block;width:2px;height:1em;margin-left:2px;background:#0b0b0c;
  vertical-align:-.12em;animation:wg-caret 1s steps(2,end) infinite}
#whalego-voice-host .wg-error{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(170px + env(safe-area-inset-bottom));
  color:#8a3b3b;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.06);box-shadow:0 6px 20px rgba(0,0,0,.08)}
#whalego-voice-host .wg-dock{position:absolute;left:16px;right:16px;bottom:max(20px,env(safe-area-inset-bottom));
  display:flex;align-items:center;justify-content:center;gap:14px;z-index:4}
#whalego-voice-host .wg-pill{flex:1;height:52px;border-radius:26px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.1);
  display:flex;align-items:center;padding:0 22px;color:#a2a7ae;font:400 16px/1 -apple-system,"PingFang SC",sans-serif}
#whalego-voice-host .wg-dock .wg-round{width:52px;height:52px;font-size:20px}
#whalego-voice-host .wg-dock .wg-end{background:#0b0b0c;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}
#whalego-voice-host .wg-ctl,#whalego-voice-host .wg-controls,#whalego-voice-host .wg-hint,
#whalego-voice-host .wg-close{display:none}
.wg-slot{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;
  border:1px solid rgba(0,0,0,.08);background:#fff;color:#4a4f57;font:500 13px/1 -apple-system,"PingFang SC",sans-serif;
  cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06);transition:background .18s ease,transform .18s ease}
.wg-slot:hover{background:#f6f7f9}
.wg-slot:active{transform:scale(.96)}
.wg-slot-dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#4d6bfe,#36e2c7);
  box-shadow:0 0 6px rgba(77,107,254,.6)}
.wg-slot[data-mode="on"] .wg-slot-dot{background:#111;box-shadow:none}
html[data-whalego-slot="1"] #whalego-voice-host .wg-trigger{display:none}
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

    /* A soft two-note wake chime, synthesised so the plugin ships no assets. */
    let chimeCtx = null;
    function playChime(kind = 'open') {
      try {
        window.__whalegoChime = { kind, at: Date.now() };
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        if (!chimeCtx) chimeCtx = new Ctor();
        const ctx = chimeCtx;
        if (ctx.state === 'suspended') ctx.resume?.();
        const now = ctx.currentTime;
        const notes = kind === 'open' ? [659.25, 987.77] : [987.77, 659.25];
        notes.forEach((frequency, index) => {
          const start = now + index * 0.09;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.075, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.46);
        });
      } catch {
        /* audio is a nicety, never a blocker */
      }
    }

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
        // Observable playback state for the smoke scripts and the CDP probes.
        window.__whalegoAudio = { state: 'loading', t: 0, at: Date.now(), text: text.slice(0, 40) };
        audio.addEventListener('playing', () => {
          window.__whalegoAudio = { state: 'playing', t: audio?.currentTime ?? 0, at: Date.now() };
        });
        audio.addEventListener('timeupdate', () => {
          window.__whalegoAudio = { state: 'playing', t: audio?.currentTime ?? 0, at: Date.now() };
        });
        audio.addEventListener('error', () => {
          window.__whalegoAudio = { state: 'error', t: 0, at: Date.now() };
        });
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
        void audio.play().catch((error) => {
          // Autoplay policy blocks scripted playback without a user gesture.
          window.__whalegoAudio = { state: 'blocked', t: 0, at: Date.now(), error: String(error?.message ?? error) };
        });
      };
      return { play, stop };
    }

    /* ------------------------------------------------------------ component */

    function VoiceSpace() {
      const [open, setOpen] = useState(false);
      const [mode, setMode] = useState(false);
      const [dragY, setDragY] = useState(0);
      const [phase, setPhase] = useState('idle');
      const [muted, setMuted] = useState(false);
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
      const sheetDragRef = useRef(null);
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

      // Collapsing the sheet keeps the voice mode alive: the minimised orb
      // stays on screen and can start the next turn. Ending the session is a
      // separate action (the X in the native trigger).
      const collapse = useCallback(() => {
        try {
          recogRef.current?.stop();
        } catch {
          /* gone */
        }
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        setInterim('');
        setOpen(false);
        setPhaseSafe((current) => (current === 'listening' ? 'idle' : current));
      }, [setPhaseSafe]);

      const endSession = useCallback(() => {
        playChime('close');
        cleanupStreams();
        setMode(false);
        setOpen(false);
        setPhaseSafe('idle');
        setInterim('');
        setAnswer('');
        setYou('');
        setError('');
        setTyped('');
        try {
          const sessionId = sessionRef.current;
          if (sessionId) {
            api('/whalego/cancel', { method: 'POST', body: JSON.stringify({ sessionId }) }).catch(() => {});
          }
        } catch {
          /* gone */
        }
      }, [cleanupStreams, setPhaseSafe]);

      // Mute only stops the microphone; the conversation stays open and the
      // orb can start the next turn with a tap.
      const toggleMute = useCallback(() => {
        setMuted((previous) => {
          const next = !previous;
          if (next) {
            try {
              recogRef.current?.stop();
            } catch {
              /* gone */
            }
            if (silenceRef.current) clearTimeout(silenceRef.current);
            silenceRef.current = null;
            setInterim('');
            setPhaseSafe('idle');
          }
          return next;
        });
      }, [setPhaseSafe]);

      // Bottom sheet drag: follow the pointer, then settle on a velocity or
      // distance threshold. Only transform/opacity animate, so it stays 60fps.
      const sheetDown = useCallback((event) => {
        if (event.button !== undefined && event.button > 0) return;
        sheetDragRef.current = { y: event.clientY, at: Date.now() };
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          /* older webviews */
        }
      }, []);
      const sheetMove = useCallback((event) => {
        const state = sheetDragRef.current;
        if (!state) return;
        setDragY(Math.max(0, event.clientY - state.y));
      }, []);
      const sheetUp = useCallback(
        (event) => {
          const state = sheetDragRef.current;
          sheetDragRef.current = null;
          if (!state) return;
          const dy = Math.max(0, (event.clientY ?? state.y) - state.y);
          const velocity = dy / Math.max(1, Date.now() - state.at);
          setDragY(0);
          if (dy > 140 || velocity > 0.7) collapse();
        },
        [collapse],
      );

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
        playChime('open');
        setOpen(true);
        setAnswer('');
        setYou('');
        setInterim('');
        setError('');
        setTyped('');
        setPhaseSafe('idle');
        sessionRef.current = '';
        setMode(true);
        void ensureSession().then((sessionId) => {
          sessionRef.current = sessionId;
        });
        setTimeout(() => {
          if (phaseRef.current === 'idle') startListening();
        }, 380);
      }, [setPhaseSafe, startListening]);

      // The native composer trigger dispatches these instead of owning our state.
      useEffect(() => {
        const openHandler = () => openSpace();
        const endHandler = () => endSession();
        window.addEventListener('whalego:open', openHandler);
        window.addEventListener('whalego:end', endHandler);
        return () => {
          window.removeEventListener('whalego:open', openHandler);
          window.removeEventListener('whalego:end', endHandler);
        };
      }, [openSpace, endSession]);

      useEffect(() => {
        document.documentElement.dataset.whalegoMode = mode ? '1' : '0';
        window.dispatchEvent(new CustomEvent('whalego:mode', { detail: { mode } }));
      }, [mode]);

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

      const orbLayers = [
        h('div', { className: 'halo', key: 'halo' }),
        h('div', { className: 'core', key: 'core' }),
        h('div', { className: 'fluid', key: 'fluid' }),
        h('div', { className: 'fluid2', key: 'fluid2' }),
        h('div', { className: 'sheen', key: 'sheen' }),
      ];

      // The entry point sits on the same layer as the host's own chrome: a
      // quiet pill above the composer. Once the session is open it becomes the
      // X that ends voice mode for good.
      const trigger = h(
        'button',
        {
          className: 'wg-trigger',
          type: 'button',
          'data-mode': mode ? 'on' : 'off',
          'aria-label': mode ? '结束语音对话' : '开始语音对话',
          onClick: () => {
            if (mode) {
              endSession();
              return;
            }
            openSpace();
          },
        },
        mode
          ? h('span', { className: 'wg-trigger-x', 'aria-hidden': 'true' }, '✕')
          : h('span', { className: 'wg-trigger-dot', 'aria-hidden': 'true' }),
        mode ? null : h('span', { className: 'wg-trigger-label' }, '语音'),
      );

      // Collapsed but still alive: the minimised orb stays above the composer.
      const miniOrb =
        mode && !open
          ? h(
              'button',
              {
                className: 'wg-mini',
                type: 'button',
                'aria-label': '打开语音对话',
                onClick: () => {
                  setOpen(true);
                  if (phaseRef.current === 'idle') startListening();
                },
              },
              h('div', { className: 'wg-orb mini', key: 'orb' }, orbLayers),
            )
          : null;

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
      }

      const phaseLabel = {
        idle: '点一下开始说话',
        listening: '在听',
        thinking: '在想',
        speaking: '在说',
        done: '说完了，点一下继续',
      }[phase];

      return h(
        React.Fragment,
        null,
        trigger,
        miniOrb,
        h('div', {
          className: 'wg-backdrop',
          'data-open': open && mode ? 'true' : 'false',
          'aria-hidden': open && mode ? 'false' : 'true',
          onClick: collapse,
        }),
        h(
          'div',
          {
            className: 'wg-space',
            'data-open': open && mode ? 'true' : 'false',
            'data-phase': phase,
            role: 'dialog',
            'aria-modal': 'false',
            'aria-label': 'WhaleGo 语音对话',
            onDoubleClick: cancel,
            style: open && dragY > 0
              ? { transform: `translate3d(-50%, ${dragY}px, 0)`, transition: 'none' }
              : undefined,
          },
          h('div', { className: 'wg-aurora a' }),
          h('div', { className: 'wg-aurora b' }),
          h('div', { className: 'wg-noise' }),
          h(
            'div',
            { className: 'wg-top' },
            h(
              'button',
              { className: 'wg-round', type: 'button', 'aria-label': '收起语音对话', onClick: collapse },
              h(
                'svg',
                { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
                h('path', {
                  d: 'M4 7h16M4 12h16M4 17h16',
                  stroke: 'currentColor',
                  strokeWidth: 1.8,
                  strokeLinecap: 'round',
                }),
              ),
            ),
            h('div', { className: 'wg-brand', 'aria-hidden': 'true' }),
          ),
          h(
            'div',
            { className: 'wg-stage' },
            h(
              'div',
              {
                className: 'wg-orb',
                key: 'orb',
                onClick: () => {
                  const current = phaseRef.current;
                  if (current === 'speaking' || current === 'thinking') cancel();
                  else if (current === 'idle' || current === 'done') startListening();
                },
              },
              orbLayers,
            ),
            h('div', { className: 'wg-state' }, phaseLabel),
          ),
          h('div', { className: 'wg-transcript' }, transcript),
          error ? h('div', { className: 'wg-error' }, error) : null,
          h(
            'div',
            { className: 'wg-dock' },
            h(
              'button',
              { className: 'wg-round wg-mic', type: 'button', 'aria-label': muted ? '打开麦克风' : '静音', onClick: toggleMute },
              h(
                'svg',
                { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
                h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3, stroke: 'currentColor', strokeWidth: 1.8 }),
                h('path', {
                  d: 'M5 11a7 7 0 0 0 14 0M12 18v3',
                  stroke: 'currentColor',
                  strokeWidth: 1.8,
                  strokeLinecap: 'round',
                }),
                muted
                  ? h('path', { d: 'M4 4l16 16', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' })
                  : null,
              ),
            ),
            h('button', { className: 'wg-round wg-end', type: 'button', 'aria-label': '结束语音对话', onClick: endSession }, '✕'),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ api */

    /**
     * Ask the host to place a small trigger inside the native composer layer.
     * Falls back to the floating pill when the build exposes no such slot.
     */
    function mountNativeTrigger(ctx) {
      try {
        const slots = ctx?.slots;
        if (!slots || typeof slots.register !== 'function') return false;
        const SlotTrigger = () => {
          const [on, setOn] = useState(() => document.documentElement.dataset.whalegoMode === '1');
          useEffect(() => {
            const handler = (event) =>
              setOn(event?.detail?.mode === true || document.documentElement.dataset.whalegoMode === '1');
            window.addEventListener('whalego:mode', handler);
            return () => window.removeEventListener('whalego:mode', handler);
          }, []);
          return h(
            'button',
            {
              className: 'wg-slot',
              type: 'button',
              'data-mode': on ? 'on' : 'off',
              'aria-label': on ? '结束语音对话' : '开始语音对话',
              onClick: () => window.dispatchEvent(new CustomEvent(on ? 'whalego:end' : 'whalego:open')),
            },
            h('span', { className: 'wg-slot-dot', 'aria-hidden': 'true' }),
            h('span', null, on ? '结束' : '语音'),
          );
        };
        const register = () => slots.register({ name: 'conversation.input.activity', locale: 'zh-CN' }, SlotTrigger);
        if (typeof slots.inject === 'function') slots.inject('conversation.input.activity', () => register());
        else register();
        return true;
      } catch {
        return false;
      }
    }

    function apply(ctx) {
      if (typeof document === 'undefined' || !document.body) return;
      ensureStyle();
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        /* ignore */
      }
      try {
        document.documentElement.dataset.whalegoSlot = mountNativeTrigger(ctx) ? '1' : '0';
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

    return { apply, inject: ['slots'] };
  },
});
