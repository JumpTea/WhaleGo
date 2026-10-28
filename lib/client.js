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

    // Baked 512px sky (fractal cloud band over a warm blue gradient). One image
    // decode per orb; no live SVG filters, no per-frame gradients.
    const ORB_SKY = "data:image/webp;base64,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";

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
.wg-mini{position:fixed;right:18px;bottom:calc(var(--wg-composer,140px) + 16px);z-index:2147482900;border:0;background:transparent;padding:0;cursor:pointer;
  filter:drop-shadow(0 8px 22px rgba(60,85,180,.28));transition:transform .24s cubic-bezier(.22,1,.36,1)}
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
#whalego-voice-host{position:fixed;inset:0;width:100vw;height:100dvh;z-index:2147483000;pointer-events:none}
#whalego-voice-host .wg-aurora,#whalego-voice-host .wg-noise,#whalego-voice-host .wg-backdrop{display:none}
#whalego-voice-host .wg-space{position:fixed;left:0;top:0;right:0;bottom:var(--wg-composer,140px);width:auto;height:auto;max-height:none;
  border-radius:0;background:#f7f7f5;color:#0a0a0b;transform:translate3d(0,100%,0);opacity:0;pointer-events:none;
  transition:transform .46s cubic-bezier(.22,1,.36,1),opacity .34s ease;will-change:transform,opacity;box-shadow:none;overflow:hidden}
#whalego-voice-host .wg-space[data-open="true"]{transform:translate3d(0,0,0);opacity:1;pointer-events:auto}
#whalego-voice-host .wg-space[data-open="false"]{pointer-events:none!important}
#whalego-voice-host .wg-space[data-open="false"] *{pointer-events:none!important}
#whalego-voice-host .wg-grab,#whalego-voice-host .wg-grabzone{display:none}
#whalego-voice-host .wg-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(16px,env(safe-area-inset-top)) 16px 0;z-index:5;pointer-events:none}
#whalego-voice-host .wg-brand{display:none}
#whalego-voice-host .wg-round{width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;pointer-events:auto;
  background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.1),0 6px 18px -10px rgba(0,0,0,.16);display:flex;
  align-items:center;justify-content:center;font-size:19px;line-height:1;transition:transform .18s ease}
#whalego-voice-host .wg-round:active{transform:scale(.93)}
#whalego-voice-host .wg-stage{position:absolute;left:0;right:0;top:0;bottom:calc(-1 * var(--wg-composer,140px));
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:70px 24px 84px;z-index:2;pointer-events:none;
  transition:transform .46s cubic-bezier(.4,.1,.2,1)}
#whalego-voice-host .wg-orb{width:clamp(168px,54vw,300px);height:clamp(168px,54vw,300px);border-radius:50%;overflow:hidden;
  clip-path:circle(50% at 50% 50%);cursor:pointer;pointer-events:auto;touch-action:manipulation;isolation:isolate;
  background:#5b7cf2;
  box-shadow:inset 0 -22px 44px rgba(255,255,255,.5),0 18px 46px -34px rgba(46,76,190,.42);
  animation:none;transition:transform .46s cubic-bezier(.4,.1,.2,1),filter .44s ease}
#whalego-voice-host .wg-orb .core,#whalego-voice-host .wg-orb .fluid,#whalego-voice-host .wg-orb .fluid2,
#whalego-voice-host .wg-orb .sheen,#whalego-voice-host .wg-orb .halo{display:none}
#whalego-voice-host .wg-orb::before{content:'';position:absolute;inset:-2%;border-radius:50%;pointer-events:none;z-index:1;
  background:#5b7cf2 url("${ORB_SKY}") center/cover no-repeat;
  will-change:transform;animation:wg-sky 9s ease-in-out infinite}
@keyframes wg-sky{0%,100%{transform:scale(1.03) translate3d(-2%,1.2%,0)}
  50%{transform:scale(1.09) translate3d(2%,-1.2%,0)}}
#whalego-voice-host .wg-space[data-phase="listening"] .wg-orb{filter:drop-shadow(0 12px 38px rgba(84,124,246,.3))}
#whalego-voice-host .wg-space[data-phase="listening"] .wg-orb::before{animation-duration:5.6s}
#whalego-voice-host .wg-space[data-phase="speaking"] .wg-orb::before{animation-duration:4.2s}
#whalego-voice-host .wg-space[data-phase="thinking"] .wg-orb::before{animation-duration:7.4s}
#whalego-voice-host .wg-heard{position:absolute;left:50%;top:calc(50dvh + clamp(126px,31vw,176px));transform:translateX(-50%);
  width:min(78vw,420px);text-align:center;font:400 15px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;
  color:#8a9099;z-index:4;pointer-events:none;opacity:0;transition:opacity .2s ease}
#whalego-voice-host .wg-heard[data-show="true"]{opacity:1}
#whalego-voice-host .wg-state,#whalego-voice-host .wg-transcript,#whalego-voice-host .wg-hint,
#whalego-voice-host .wg-controls,#whalego-voice-host .wg-ctl,#whalego-voice-host .wg-close{display:none}
#whalego-voice-host .wg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);
  white-space:nowrap;border:0}
#whalego-voice-host .wg-error{position:absolute;left:50%;transform:translateX(-50%);bottom:26px;z-index:6;max-width:84%;
  font:400 13px/1.5 -apple-system,"PingFang SC",sans-serif;color:#8a3b3b;background:rgba(255,255,255,.94);
  border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:9px 14px;box-shadow:0 8px 24px rgba(0,0,0,.08);text-align:center}
#whalego-voice-host .wg-dock{position:absolute;left:16px;right:16px;bottom:max(18px,env(safe-area-inset-bottom));
  display:flex;align-items:center;justify-content:center;gap:12px;z-index:4}
#whalego-voice-host .wg-dock .wg-round{width:46px;height:46px}
#whalego-voice-host .wg-dock .wg-end{background:#0b0b0c;color:#fff}
html[data-whalego-slot="1"] #whalego-voice-host .wg-dock{display:none}
#whalego-voice-host .wg-space[data-compact="true"]{background:transparent;pointer-events:none}
#whalego-voice-host .wg-space[data-compact="true"]::after{content:'';position:absolute;left:0;right:0;bottom:0;height:210px;
  background:linear-gradient(180deg,rgba(247,247,245,0) 0%,rgba(247,247,245,.9) 68%,#f7f7f5 100%);
  z-index:1;pointer-events:none}
#whalego-voice-host .wg-space[data-compact="true"] .wg-top,
#whalego-voice-host .wg-space[data-compact="true"] .wg-heard,
#whalego-voice-host .wg-space[data-compact="true"] .wg-error{display:none}
#whalego-voice-host .wg-space[data-compact="true"] .wg-stage{transform:translate3d(0,calc(50dvh - var(--wg-composer,140px) - 74px),0)}
#whalego-voice-host .wg-space[data-compact="true"] .wg-orb{transform:scale(.5)!important;transform-origin:50% 50%;animation:none!important;
  box-shadow:inset 0 -22px 44px rgba(255,255,255,.55),0 16px 40px -22px rgba(68,105,235,.42)}
.wg-slot{display:inline-flex;align-items:center;justify-content:center;gap:0;height:32px;width:32px;min-width:32px;flex:0 0 32px;padding:0;
  border-radius:50%;border:1px solid rgba(0,0,0,.08);background:#fff;color:#4a4f57;
  font:500 13px/1 -apple-system,"PingFang SC",sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06);
  transition:background .18s ease,transform .18s ease,color .18s ease}
.wg-slot:hover{background:#f6f7f9}
.wg-slot:active{transform:scale(.95)}
.wg-slot[data-mode="on"]{background:#0b0b0c;border-color:#0b0b0c;color:#fff;padding:0;width:32px;
  box-shadow:0 2px 8px rgba(0,0,0,.22)}
.wg-slot-dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#4d6bfe,#36e2c7);
  box-shadow:0 0 6px rgba(77,107,254,.6)}
.wg-slot-x{font-size:15px;line-height:1;font-weight:400}
html[data-whalego-slot="1"] #whalego-voice-host .wg-trigger{display:none}
html[data-whalego-mode="1"] [class*="composerSeat"]{margin-top:auto!important}
@media (prefers-reduced-motion:reduce){
  #whalego-voice-host .wg-orb,#whalego-voice-host .wg-orb *,#whalego-voice-host .wg-orb::before,
  #whalego-voice-host .wg-orb::after{animation:none!important}
  #whalego-voice-host .wg-space,#whalego-voice-host .wg-stage,#whalego-voice-host .wg-orb{transition-duration:.01ms}
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

    /* The slot is rendered inside the Session-scoped composer, so it hands us
     * the session the user is actually looking at. Prefer it over "most recent
     * live session": voice turns must land in the same conversation. */
    let boundSession = '';

    async function ensureSession() {
      if (boundSession) return boundSession;
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

    /**
     * One audio element at a time. `play` resolves only once the line has
     * actually finished (or failed, or was stopped), which is what lets the
     * caller queue lines sentence by sentence and know the real end of a turn.
     */
    function createPlayer() {
      let audio = null;
      let url = null;
      let aborter = null;
      let watchdog = null;
      let settle = null;
      let finished = true;
      // Sentences are known before their turn in the playback queue arrives.
      // Fetch their audio ahead of time so the gap between lines is decode-only,
      // not another round trip to the TTS service.
      const prepared = new Map();
      // One media element for every line. iOS only unlocks the element that was
      // played inside a user gesture, so creating a fresh Audio() per sentence
      // would leave the second sentence blocked.
      let mediaEl = null;
      let detach = null;
      let unlocked = false;
      // 0.1s of silence. Played on the first pointerdown to unlock HTMLAudio
      // on iOS/Safari; the real sentence reuses this same element afterwards.
      const SILENT =
        'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA==';

      const ensureAudio = () => {
        if (!mediaEl) {
          mediaEl = new Audio();
          mediaEl.autoplay = true;
          mediaEl.preload = 'auto';
        }
        return mediaEl;
      };

      const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        try {
          const el = ensureAudio();
          if (el.src) return;
          el.src = SILENT;
          const started = el.play();
          started?.catch(() => {
            /* first gesture was not enough; the next play will report blocked */
          });
        } catch {
          /* no audio element in this host */
        }
      };

      const note = (state) => {
        const entry = { state, t: audio?.currentTime ?? 0, at: Date.now() };
        window.__whalegoAudio = entry;
        // Small rolling trail for the CDP probes; never rendered.
        const trail = (window.__whalegoTrail ??= []);
        if (trail.at(-1)?.state !== state) trail.push(entry);
        if (trail.length > 120) trail.shift();
      };

      const finish = (state) => {
        if (finished) return;
        finished = true;
        detach?.();
        detach = null;
        if (watchdog) clearInterval(watchdog);
        watchdog = null;
        if (state === 'stopped') {
          try {
            audio?.pause();
          } catch {
            /* gone */
          }
        }
        note(state);
        const done = settle;
        settle = null;
        done?.(state);
      };

      const stop = () => {
        finish('stopped');
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

      const prepare = (text) => {
        const key = String(text);
        if (!key) return Promise.resolve(null);
        if (prepared.has(key)) return prepared.get(key);
        const pending = (async () => {
          try {
            const response = await fetch('/whalego/speak', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text }),
            });
            if (!response.ok) return null;
            return await response.blob();
          } catch {
            return null;
          }
        })();
        prepared.set(key, pending);
        if (prepared.size > 10) prepared.delete(prepared.keys().next().value);
        return pending;
      };

      const play = (text) => {
        stop();
        const controller = new AbortController();
        aborter = controller;
        finished = false;
        let lastTick = Date.now();
        const done = new Promise((resolve) => {
          settle = resolve;
        });
        // A decoder that never starts, or a tab that sleeps mid-line, must not
        // pin the queue forever: a stalled line still ends the turn.
        watchdog = setInterval(() => {
          if (!finished && Date.now() - lastTick > 15000) finish('stalled');
        }, 2500);

        const attach = () => {
          detach?.();
          const el = ensureAudio();
          audio = el;
          // Observable playback state for the smoke scripts and the CDP probes.
          window.__whalegoAudio = { state: 'loading', t: 0, at: Date.now(), text: String(text).slice(0, 40) };
          const tick = () => {
            if (finished) return;
            lastTick = Date.now();
            note('playing');
          };
          const onEnded = () => {
            lastTick = Date.now();
            finish('ended');
          };
          const onError = () => finish('error');
          const onPause = () => {
            if (controller.signal.aborted) finish('stopped');
          };
          el.addEventListener('playing', tick);
          el.addEventListener('timeupdate', tick);
          el.addEventListener('ended', onEnded);
          el.addEventListener('error', onError);
          el.addEventListener('pause', onPause);
          detach = () => {
            el.removeEventListener?.('playing', tick);
            el.removeEventListener?.('timeupdate', tick);
            el.removeEventListener?.('ended', onEnded);
            el.removeEventListener?.('error', onError);
            el.removeEventListener?.('pause', onPause);
            detach = null;
          };
          return el;
        };

        void (async () => {
          try {
            const key = String(text);
            const cached = prepared.get(key);
            if (cached) prepared.delete(key);
            if (cached) {
              const blob = await cached;
              if (controller.signal.aborted) return;
              if (blob) {
                const element = attach();
                url = URL.createObjectURL(blob);
                element.src = url;
                void element.play().catch(() => finish('blocked'));
                return;
              }
            }
            const response = await fetch('/whalego/speak', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text }),
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (!response.ok || !response.body) {
              finish('error');
              return;
            }
            const element = attach();
            const supported =
              typeof window.MediaSource !== 'undefined' && window.MediaSource.isTypeSupported?.('audio/mpeg');
            if (supported) {
              const media = new window.MediaSource();
              url = URL.createObjectURL(media);
              element.src = url;
              const chunks = [];
              let ended = false;
              let buffer = null;
              let started = false;
              // Start on the first decodable chunk, not at end of body: the
              // whole point of the MediaSource path is sentence-level streaming.
              const kick = () => {
                if (started || controller.signal.aborted) return;
                started = true;
                void element.play().catch(() => finish('blocked'));
              };
              const pump = () => {
                if (!buffer || buffer.updating) return;
                if (chunks.length) {
                  try {
                    buffer.appendBuffer(chunks.shift());
                  } catch {
                    /* wait for the next updateend */
                  }
                  return;
                }
                if (buffer.buffered.length) kick();
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
                const { done: eof, value } = await reader.read();
                if (eof) break;
                lastTick = Date.now();
                chunks.push(value);
                pump();
              }
              ended = true;
              pump();
              kick();
              return;
            }
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            url = URL.createObjectURL(blob);
            element.src = url;
            // Autoplay policy blocks scripted playback without a user gesture;
            // that is a skipped line, not a failed turn.
            void element.play().catch(() => finish('blocked'));
          } catch {
            finish(controller.signal.aborted ? 'stopped' : 'error');
          }
        })();
        return done;
      };

      return { play, prepare, stop, unlock };
    }

    /**
     * Sentence queue for one turn. The answer is still being written while the
     * first sentences are already speakable, so segments are accepted as they
     * arrive, played back to back, and the turn is reported to the engine only
     * once the last line has really finished sounding.
     */
    function createSpeaker({ play, prepare, report, phase }) {
      const heard = new Set();
      const queue = [];
      let generationDone = false;
      let playing = false;
      let stale = false;
      let reported = false;
      let started = false;

      const drain = async () => {
        if (playing) return;
        playing = true;
        try {
          while (queue.length) {
            if (stale) return;
            started = true;
            phase('speaking');
            const line = queue.shift();
            // Warm the next line while this one sounds.
            if (queue.length && typeof prepare === 'function') prepare(queue[0]);
            const result = await play(line);
            if (result === 'stopped' || stale) return;
          }
        } finally {
          playing = false;
        }
        if (generationDone && !queue.length && !reported) {
          reported = true;
          phase('done');
          report('ended');
        }
      };

      return {
        /** Merge the speech segments of one live frame into the queue. */
        accept(data) {
          if (stale || reported) return;
          const segments = Array.isArray(data?.speech) ? data.speech : [];
          for (const segment of segments) {
            const id = String(segment?.id ?? '');
            const text = String(segment?.text ?? '').trim();
            if (!text || (id && heard.has(id))) continue;
            if (id) heard.add(id);
            queue.push(text);
          }
          // Engines without a segment feed still get read out, whole line.
          if (!segments.length && !heard.size && data?.state === 'speaking' && data.voice) {
            const line = String(data.voice).trim();
            if (line) {
              heard.add('voice');
              queue.push(line);
            }
          }
          if (data?.generationDone) generationDone = true;
          void drain();
        },
        /** Generation is over: settle as soon as the queue runs dry. */
        finish() {
          generationDone = true;
          void drain();
        },
        /** True once this turn has actually sounded, so the orb keeps saying it. */
        hasStarted: () => started,
        /** Interrupted, superseded or cleaned up: drop whatever is left. */
        stop() {
          stale = true;
          queue.length = 0;
        },
      };
    }

    // Debug seam for the pure-Node test harness and the CDP probes; the web
    // module loader itself only ever calls apply/inject.
    window.__whalegoInternals = { createPlayer, createSpeaker };

    /* ------------------------------------------------------------ component */

    function VoiceSpace() {
      const [open, setOpen] = useState(false);
      const [mode, setMode] = useState(false);
      const [compact, setCompact] = useState(false);
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
      const mirroredRef = useRef('');
      const sseRef = useRef(null);
      const speakerRef = useRef(null);
      const dragRef = useRef(null);
      const sheetDragRef = useRef(null);
      const sessionRef = useRef('');
      const silenceRef = useRef(null);

      if (!playerRef.current) playerRef.current = createPlayer();

      const setPhaseSafe = useCallback((next) => {
        const value = typeof next === 'function' ? next(phaseRef.current) : next;
        phaseRef.current = value;
        setPhase(value);
      }, []);

      const cleanupStreams = useCallback(() => {
        try {
          sseRef.current?.close();
        } catch {
          /* gone */
        }
        sseRef.current = null;
        // Anything still queued belongs to a turn this component no longer owns.
        speakerRef.current?.stop();
        speakerRef.current = null;
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
        playChime('close');
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
        (turnId, sessionId) => {
          try {
            sseRef.current?.close();
          } catch {
            /* gone */
          }
          speakerRef.current?.stop();
          const source = new EventSource(
            `/whalego/live?turn=${encodeURIComponent(turnId)}&session=${encodeURIComponent(sessionId)}`,
          );
          sseRef.current = source;
          // The browser is the speaker: only it knows when the answer finished.
          // The engine settles the turn on this receipt (web twin of audio.done).
          const speaker = createSpeaker({
            play: (line) => playerRef.current?.play(line),
            prepare: (line) => playerRef.current?.prepare(line),
            report: (state) => {
              speakerRef.current = null;
              api('/whalego/playback', {
                method: 'POST',
                body: JSON.stringify({ sessionId, turnId, state }),
              }).catch(() => {});
            },
            phase: setPhaseSafe,
          });
          speakerRef.current = speaker;

          source.addEventListener('live', (event) => {
            let data;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            if (speakerRef.current !== speaker) return;
            if (data.voice) setAnswer(data.voice);
            speaker.accept(data);
            // The engine keeps reporting "thinking" while it writes, but once a
            // sentence is audible the orb must not flicker back to thinking.
            if (data.state === 'thinking') {
              if (!speaker.hasStarted()) setPhaseSafe('thinking');
            } else if (data.state === 'done') setPhaseSafe('done');
            else if (data.state === 'interrupted') setPhaseSafe('idle');
            else if (data.state === 'error') {
              setPhaseSafe('idle');
              setError('这一轮没走完，稍后再试。');
            }
          });
          source.addEventListener('end', (event) => {
            let data = {};
            try {
              data = JSON.parse(event.data);
            } catch {
              /* no payload */
            }
            try {
              source.close();
            } catch {
              /* gone */
            }
            if (speakerRef.current !== speaker) return;
            if (data.state === 'interrupted' || data.state === 'error') {
              speaker.stop();
              speakerRef.current = null;
              playerRef.current?.stop();
              if (data.state === 'error') {
                setPhaseSafe('idle');
                setError('这一轮没走完，稍后再试。');
              } else if (phaseRef.current !== 'idle') setPhaseSafe('idle');
              return;
            }
            // Generation is over; the last segment may still be speaking, so the
            // turn only settles once the queue drains.
            speaker.finish();
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
            window.__whalegoLastTurn = { sessionId, turnId, text, at: Date.now() };
            follow(turnId, sessionId);
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
            setPhaseSafe('idle');
          }
        },
        [follow, setPhaseSafe],
      );

      // Typed messages go through the app itself (so the composer behaves
      // natively); mirror the agent's answer into the voice transcript and
      // read it out loud.
      const stopListening = useCallback(() => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        const recog = recogRef.current;
        recogRef.current = null;
        try {
          recog?.stop();
        } catch {
          /* gone */
        }
        setInterim('');
        if (phaseRef.current === 'listening') setPhaseSafe('idle');
      }, [setPhaseSafe]);

      useEffect(() => {
        if (!mode) return undefined;
        let source = null;
        let cancelled = false;
        const startedAt = Date.now();
        source = new EventSource('/whalego/live');
        {
          source.addEventListener('live', (event) => {
            let data;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            if (!String(data.turnId || '').startsWith('typed-')) return;
            // The session feed replays the newest entry on connect; ignore one
            // that predates this subscription so an old answer is not re-read.
            if (data.at && Number(data.at) < startedAt - 1200) return;
            const text = String(data.voice || data.text || '').trim();
            if (!text) return;
            // Spoken form: markdown punctuation sounds wrong when read aloud.
            const spoken = text
              .replace(/```[\s\S]*?```/g, '')
              .replace(/`([^`]*)`/g, '$1')
              .replace(/\*\*([^*]+)\*\*/g, '$1')
              .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
              .replace(/^#{1,6}\s*/gm, '')
              .replace(/\s*\n+\s*/g, ' ')
              .trim();
            if (!spoken) return;
            // Typing is chat: surface the native conversation and let the answer
            // stream under the orb while it is also read aloud. The microphone
            // must go quiet first, otherwise the answer is echoed back in.
            stopListening();
            setOpen(true);
            setCompact(true);
            if (data.question) setYou(data.question);
            // Text streams in while the agent works; speak only the final line.
            setAnswer(spoken);
            if (data.state !== 'speaking') {
              setPhaseSafe('thinking');
              return;
            }
            if (mirroredRef.current === data.turnId) return;
            mirroredRef.current = data.turnId;
            setPhaseSafe('speaking');
            const played = playerRef.current?.play(spoken);
            if (played?.then) played.then(() => setPhaseSafe('done')).catch(() => setPhaseSafe('done'));
          });
        }
        return () => {
          cancelled = true;
          source?.close();
        };
      }, [mode, stopListening, setPhaseSafe]);

      // Test/speechless hook: lets a caller hand a line to the same turn path
      // that Web Speech feeds, so the panel is verifiable without a microphone.
      useEffect(() => {
        window.__whalegoSay = (text) => send(text);
        return () => {
          delete window.__whalegoSay;
        };
      }, [send]);

      const startListening = useCallback(() => {
        const Recognition = speech();
        if (!Recognition) return false;
        const previous = recogRef.current;
        recogRef.current = null;
        try {
          previous?.stop();
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
          if (recogRef.current === recog) setPhaseSafe('idle');
        };
        recog.onend = () => {
          // A replaced recogniser can still emit `end`; it must not knock the
          // freshly started one out of listening.
          if (recogRef.current === recog && phaseRef.current === 'listening') setPhaseSafe('idle');
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

      const beginListening = useCallback(() => {
        const started = startListening();
        if (!started) {
          setError('这台设备不支持语音输入，请在下面输入框里打字，我会用语音回答。');
          return false;
        }
        setError('');
        return true;
      }, [startListening]);

      const openSpace = useCallback(() => {
        playerRef.current?.unlock();
        playChime('open');
        setOpen(true);
        setCompact(false);
        // Reopening while a turn is still running must not wipe its answer or
        // start a second recogniser over the audio that is already playing.
        if (phaseRef.current === 'speaking' || phaseRef.current === 'thinking') return;
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
          if (phaseRef.current === 'idle') beginListening();
        }, 380);
      }, [beginListening, setPhaseSafe]);

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

      useEffect(() => {
        // Kept for probes/debugging: surfaces the compact state on <html>.
        document.documentElement.dataset.whalegoCompact = open && mode && compact ? '1' : '0';
      }, [open, mode, compact]);

      // Leave the app's own composer visible and interactive underneath: the
      // voice surface stops right above it, like the voice-mode reference.
      useEffect(() => {
        if (!open) return undefined;
        const host = document.getElementById('whalego-voice-host');
        // Re-find on every measure: the composer card is replaced when the
        // first voice turn creates a conversation, so a captured node goes stale.
        const findCard = () =>
          document.querySelector('.wg-slot')?.closest('[class*="card"]') ||
          document.querySelector('[class*="composerStack"] [class*="card"]') ||
          document.querySelector('[class*="composerStack"]') ||
          null;
        let raf = 0;
        const measure = () => {
          const node = findCard();
          const top = node?.getBoundingClientRect?.().top;
          if (!top) return;
          const viewport = window.visualViewport;
          // Fixed elements follow the visual viewport on iOS; its bottom is
          // height + offsetTop once the keyboard scrolls the layout viewport.
          const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
          // Keep a small gap so the rounded card edge never peeks through.
          const inset = Math.max(84, Math.round(bottom - top) + 6);
          host?.style.setProperty('--wg-composer', `${inset}px`);
        };
        // The mode attribute moves the home composer to the bottom in the same
        // frame; measure twice so the first paint is not left covering it.
        const schedule = () => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            measure();
            raf = requestAnimationFrame(measure);
          });
        };
        schedule();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
        try {
          if (ro) ro.observe(document.body);
        } catch {
          /* no observer */
        }
        const vv = window.visualViewport;
        const timer = setTimeout(schedule, 420);
        // Sessions appear/disappear and the composer card is swapped without a
        // resize; a cheap rect read keeps the inset honest.
        const poll = setInterval(measure, 500);
        window.addEventListener('resize', schedule);
        vv?.addEventListener('resize', schedule);
        vv?.addEventListener('scroll', schedule);
        return () => {
          cancelAnimationFrame(raf);
          clearTimeout(timer);
          clearInterval(poll);
          try {
            ro?.disconnect();
          } catch {
            /* gone */
          }
          window.removeEventListener('resize', schedule);
          vv?.removeEventListener('resize', schedule);
          vv?.removeEventListener('scroll', schedule);
        };
      }, [open, mode]);

      // iOS unlocks the exact media element that played during a gesture.
      // Prime it on the first tap anywhere so a later voice turn is not blocked.
      useEffect(() => {
        const prime = () => {
          try {
            playerRef.current?.unlock();
          } catch {
            /* no audio in this host */
          }
          window.removeEventListener('pointerdown', prime, true);
        };
        window.addEventListener('pointerdown', prime, true);
        return () => window.removeEventListener('pointerdown', prime, true);
      }, []);

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
                  playChime('open');
                  setCompact(false);
                  setOpen(true);
                  if (phaseRef.current === 'idle' || phaseRef.current === 'done') beginListening();
                },
              },
              h('div', { className: 'wg-orb mini', key: 'orb' }, orbLayers),
            )
          : null;

      const phaseLabel = {
        idle: '待命',
        listening: '正在听',
        thinking: '正在想',
        speaking: '正在说',
        done: '说完了',
      }[phase];

      return h(
        React.Fragment,
        null,
        trigger,
        miniOrb,
        h(
          'div',
          {
            className: 'wg-space',
            'data-open': open && mode ? 'true' : 'false',
            'data-phase': phase,
            'data-compact': compact ? 'true' : 'false',
            role: 'dialog',
            'aria-modal': 'false',
            'aria-label': 'WhaleGo 语音对话',
            'aria-hidden': open && mode ? 'false' : 'true',
            onClick: (event) => {
              if (compact) return;
              if (event.target?.closest?.('button, .wg-orb')) return;
              const current = phaseRef.current;
              if (current === 'speaking' || current === 'thinking') cancel();
            },
          },
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
          ),
          h(
            'div',
            { className: 'wg-stage' },
            h(
              'div',
              {
                className: compact ? 'wg-orb compact' : 'wg-orb',
                key: 'orb',
                role: 'button',
                tabIndex: 0,
                'aria-label': compact ? '展开语音界面' : '语音输入',
                onClick: (event) => {
                  event.stopPropagation();
                  const current = phaseRef.current;
                  if (compact) {
                    setCompact(false);
                    if (current === 'speaking' || current === 'thinking') {
                      // Tapping the small orb means "my turn": stop the answer,
                      // come back to the big orb, then listen.
                      cancel();
                      setTimeout(() => beginListening(), 260);
                    } else if (current === 'idle' || current === 'done') beginListening();
                    return;
                  }
                  if (current === 'listening' || current === 'speaking' || current === 'thinking') {
                    stopListening();
                    // Collapsing is only useful once there is a line to read.
                    // On the empty home screen the hero sits right where the
                    // mini orb would land, so stay full instead.
                    const hasChat =
                      Boolean(you || answer || typed) || !document.querySelector('[class*="composerHero"]');
                    if (hasChat) setCompact(true);
                    return;
                  }
                  // Idle or finished: with a conversation on screen the first
                  // tap opens the chat view (that is what the recording does);
                  // an empty page just starts listening.
                  const hasChat =
                    Boolean(you || answer || typed) || !document.querySelector('[class*="composerHero"]');
                  if (hasChat) {
                    setCompact(true);
                    return;
                  }
                  beginListening();
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.currentTarget.click();
                  }
                },
              },
              orbLayers,
            ),
          ),
          h('div', { className: 'wg-heard', 'data-show': interim ? 'true' : 'false' }, interim),
          h('div', { className: 'wg-sr', 'aria-live': 'polite' }, phaseLabel),
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
        const SlotTrigger = (props) => {
          const sid = typeof props?.sessionId === 'string' ? props.sessionId : '';
          if (sid && sid !== boundSession) boundSession = sid;
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
            on
              ? h('span', { className: 'wg-slot-x', 'aria-hidden': 'true' }, '✕')
              : h(
                  'svg',
                  {
                    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
                    'aria-hidden': 'true', focusable: 'false',
                  },
                  h('path', {
                    d: 'M12 15.2a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6.2a3 3 0 0 0 3 3Z',
                    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
                  }),
                  h('path', {
                    d: 'M5.5 11.2a6.5 6.5 0 0 0 13 0M12 18v3',
                    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
                  }),
                ),
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
      window.__whalegoSession = () => boundSession;
    }

    return { apply, inject: ['slots'] };
  },
});
