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
    // Bumped whenever the web bundle must be re-read by the host WebView.
    const CLIENT_BUILD = '0.10.0';
    // One physical tap can arrive twice (touch + synthetic click) in the app
    // WebView; a second toggle would close the page we just opened.
    let lastToggleAt = 0;
    const claimToggle = () => {
      const now = Date.now();
      if (now - lastToggleAt < 700) return false;
      lastToggleAt = now;
      return true;
    };

    // Baked 1024px sky (fractal cloud band over a warm blue gradient). One image
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
.wg-mini{position:fixed;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(var(--wg-composer,140px) + 16px);z-index:2147482900;border:0;background:transparent;padding:0;cursor:pointer;
  filter:drop-shadow(0 8px 22px rgba(60,85,180,.28));transition:transform .24s cubic-bezier(.22,1,.36,1)}
.wg-mini:hover{transform:scale(1.05)}
.wg-mini[data-dock="center"]{right:auto;left:50%;transform:translateX(-50%)}
.wg-mini[data-dock="center"]:hover{transform:translateX(-50%) scale(1.05)}
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
#whalego-voice-host{--wg-bg:#f7f7f5;--wg-ink:#0a0a0b;--wg-muted:#8a9099;--wg-surface:#fff;--wg-line:rgba(0,0,0,.06);
  --wg-error-bg:rgba(255,255,255,.94);--wg-error-ink:#8a3b3b;--wg-shadow:0 1px 3px rgba(0,0,0,.1),0 6px 18px -10px rgba(0,0,0,.16);
  --wg-fade-0:rgba(247,247,245,0);--wg-fade-9:rgba(247,247,245,.9);
  position:fixed;inset:0;width:100%;height:100vh;height:100dvh;z-index:2147483000;pointer-events:none}
/* The page follows the app's native theme instead of pinning a white surface:
   DSH toggles html.dsh-dark for both the system and the in-app theme switch. */
html.dsh-dark #whalego-voice-host{--wg-bg:#151517;--wg-ink:#f2f2f3;--wg-muted:#9b9ba3;--wg-surface:#242427;--wg-line:rgba(255,255,255,.1);
  --wg-error-bg:rgba(46,46,49,.96);--wg-error-ink:#ffb0b0;
  --wg-shadow:0 1px 3px rgba(0,0,0,.45),0 8px 20px -12px rgba(0,0,0,.7);
  --wg-fade-0:rgba(21,21,23,0);--wg-fade-9:rgba(21,21,23,.9)}
#whalego-voice-host .wg-aurora,#whalego-voice-host .wg-noise,#whalego-voice-host .wg-backdrop{display:none}
/* Direct render: the voice surface fades in where it is, like a native mode
   switch. It is not a sheet sliding up from the composer. */
#whalego-voice-host .wg-space{position:fixed;left:0;top:0;right:0;bottom:var(--wg-composer,140px);width:auto;height:auto;max-height:none;
  border-radius:0;background:var(--wg-bg);color:var(--wg-ink);opacity:0;pointer-events:none;transform:none!important;
  transition:opacity .18s ease;will-change:opacity;box-shadow:none;overflow:hidden}
/* A quiet ambience: tinted corners above and below, so the flat page has
   depth without one extra element on screen. */
#whalego-voice-host .wg-space::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(130% 46% at 50% -4%,rgba(88,120,246,.085),transparent 60%),
    radial-gradient(90% 34% at 50% 104%,rgba(80,140,255,.05),transparent 64%)}
html.dsh-dark #whalego-voice-host .wg-space::before{
  background:radial-gradient(130% 46% at 50% -4%,rgba(84,124,246,.16),transparent 60%),
    radial-gradient(90% 34% at 50% 104%,rgba(70,120,235,.08),transparent 64%)}
#whalego-voice-host .wg-space[data-compact="true"]::before{content:none}
#whalego-voice-host .wg-space[data-open="true"]{opacity:1;pointer-events:auto;transform:none!important}
/* While the answer is being spoken in the small view, hold the native chat
   behind a soft page-coloured veil. The caption is then the only text on
   screen, so the words cannot run minutes ahead of the voice. */
#whalego-voice-host .wg-veil{position:absolute;inset:0;z-index:1;background:var(--wg-bg);opacity:0;
  pointer-events:none;transition:opacity .24s ease;will-change:opacity}
#whalego-voice-host .wg-space[data-compact="true"][data-veil="true"] .wg-veil{opacity:1;transition-duration:0s}
html[data-whalego-mode="1"]{scrollbar-width:none;background:#f7f7f5!important;overflow:hidden!important;width:100vw}
html[data-whalego-mode="1"] body{position:fixed;inset:0;width:100%;height:100%;overflow:hidden!important}
html[data-whalego-mode="1"] body{background:#f7f7f5!important}
html.dsh-dark[data-whalego-mode="1"],html.dsh-dark[data-whalego-mode="1"] body{background:#151517!important}
html[data-whalego-mode="1"] *::-webkit-scrollbar{width:0!important;height:0!important;background:transparent}
#whalego-voice-host .wg-space[data-open="false"]{pointer-events:none!important}
#whalego-voice-host .wg-space[data-open="false"] *{pointer-events:none!important}
#whalego-voice-host .wg-grab,#whalego-voice-host .wg-grabzone{display:none}
#whalego-voice-host .wg-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:max(16px,env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right,0px)) 0 calc(16px + env(safe-area-inset-left,0px));z-index:5;pointer-events:none}
#whalego-voice-host .wg-brand{display:none}
#whalego-voice-host .wg-round{width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;pointer-events:auto;
  background:var(--wg-surface);color:var(--wg-ink);box-shadow:var(--wg-shadow);display:flex;
  align-items:center;justify-content:center;font-size:19px;line-height:1;transition:transform .18s ease}
#whalego-voice-host .wg-round:active{transform:scale(.93)}
#whalego-voice-host .wg-round:focus-visible,
#whalego-voice-host .wg-orb:focus-visible{outline:2px solid #3a66e8;outline-offset:3px}
#whalego-voice-host .wg-stage{position:absolute;left:0;right:0;top:0;bottom:calc(-1 * var(--wg-composer,140px));
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:70px 24px 84px;z-index:2;pointer-events:none;
  transition:transform .46s cubic-bezier(.4,.1,.2,1)}
#whalego-voice-host .wg-orb{width:clamp(120px,54vw,300px);height:clamp(120px,54vw,300px);
  width:clamp(120px,min(54vw,54vh,calc(100dvh - 2*var(--wg-composer,140px) - 24px)),300px);
  height:clamp(120px,min(54vw,54vh,calc(100dvh - 2*var(--wg-composer,140px) - 24px)),300px);border-radius:50%;overflow:hidden;
  clip-path:circle(50% at 50% 50%);cursor:pointer;pointer-events:auto;touch-action:manipulation;isolation:isolate;
  background:#5b7cf2;
  box-shadow:inset 0 -22px 44px rgba(255,255,255,.5),0 18px 46px -34px rgba(46,76,190,.42);
  animation:none;transition:transform .46s cubic-bezier(.4,.1,.2,1),filter .44s ease}
#whalego-voice-host .wg-mini .wg-orb{width:64px;height:64px;min-width:0;min-height:0;
  box-shadow:inset 0 -8px 16px rgba(255,255,255,.5),0 8px 22px -14px rgba(46,76,190,.5)}
#whalego-voice-host .wg-orb .core,#whalego-voice-host .wg-orb .fluid,#whalego-voice-host .wg-orb .fluid2,
#whalego-voice-host .wg-orb .sheen,#whalego-voice-host .wg-orb .halo{display:none}
#whalego-voice-host .wg-orb::before{content:'';position:absolute;inset:-2%;border-radius:50%;pointer-events:none;z-index:1;
  background:#5b7cf2 url("${ORB_SKY}") center/cover no-repeat;
  will-change:transform;animation:wg-sky 9s ease-in-out infinite}
@keyframes wg-sky{0%,100%{transform:scale(1.03) translate3d(-2%,1.2%,0)}
  50%{transform:scale(1.09) translate3d(2%,-1.2%,0)}}
html.dsh-dark #whalego-voice-host .wg-orb{box-shadow:inset 0 -22px 44px rgba(255,255,255,.22),0 18px 46px -34px rgba(0,0,0,.9)}
html.dsh-dark #whalego-voice-host .wg-space[data-phase="listening"] .wg-orb{filter:drop-shadow(0 12px 38px rgba(84,124,246,.22))}
#whalego-voice-host .wg-space[data-open="true"] .wg-orb:not(.mini){animation:wg-orb-in .34s cubic-bezier(.2,.8,.2,1)}
@keyframes wg-orb-in{from{opacity:.35;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
#whalego-voice-host .wg-space[data-compact="true"] .wg-orb{animation:none!important}
#whalego-voice-host .wg-space[data-phase="listening"] .wg-orb{animation:wg-halo-pulse 2s ease-in-out infinite}
@keyframes wg-halo-pulse{0%,100%{filter:drop-shadow(0 10px 30px rgba(84,124,246,.28))}50%{filter:drop-shadow(0 14px 52px rgba(84,124,246,.52))}}
#whalego-voice-host .wg-space[data-phase="listening"] .wg-orb::before{animation-duration:5.6s}
#whalego-voice-host .wg-space[data-phase="speaking"] .wg-orb::before{animation-duration:4.2s}
#whalego-voice-host .wg-space[data-phase="thinking"] .wg-orb::before{animation-duration:7.4s}
#whalego-voice-host .wg-heard{position:absolute;left:50%;top:calc(50dvh + clamp(126px,31vw,176px));transform:translateX(-50%);
  width:min(78vw,420px);text-align:center;font:400 15px/1.55 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;
  color:var(--wg-muted);z-index:4;pointer-events:none;opacity:0;transition:opacity .2s ease}
#whalego-voice-host .wg-heard[data-show="true"]{opacity:1}
#whalego-voice-host .wg-ab{position:absolute;left:50%;transform:translateX(-50%);
  top:calc(50dvh + clamp(114px,28vw,156px));bottom:16px;width:min(560px,88vw);
  display:flex;flex-direction:column;align-items:center;gap:10px;z-index:3;pointer-events:none}
#whalego-voice-host .wg-space[data-ab="true"]:not([data-compact="true"]) .wg-ab{
  top:calc(50dvh + clamp(76px,20vw,116px))}
#whalego-voice-host .wg-caption{position:relative;left:auto;top:auto;transform:none;flex:0 0 auto;
  width:min(84vw,500px);max-height:7.2em;overflow-y:auto;overscroll-behavior:contain;text-align:center;
  font:500 16px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:var(--wg-ink);
  z-index:3;pointer-events:auto;letter-spacing:.01em;scrollbar-width:none;opacity:0;transition:opacity .18s ease;
  padding:14px 8px 8px;-webkit-mask-image:linear-gradient(to top,#000 calc(100% - 22px),transparent 100%);
  mask-image:linear-gradient(to top,#000 calc(100% - 22px),transparent 100%)}
#whalego-voice-host .wg-caption::-webkit-scrollbar{display:none}
#whalego-voice-host .wg-caption[data-show="true"]{opacity:1}
/* Revealed spoken lines drop in one at a time as the voice reaches them. */
#whalego-voice-host .wg-caption p{margin:0 0 .42em;text-wrap:pretty;
  animation:wg-line-in .52s cubic-bezier(.22,.72,.24,1) both}
#whalego-voice-host .wg-caption p:last-child{margin-bottom:0}
@keyframes wg-line-in{from{opacity:0;transform:translateY(8px) scale(.988)}to{opacity:1;transform:none}}
#whalego-voice-host .wg-written{position:relative;left:auto;top:auto;transform:none;flex:1 1 auto;min-height:0;
  width:100%;max-height:none;overflow:hidden;padding:11px 15px 12px;border-radius:18px;display:flex;flex-direction:column;
  background:linear-gradient(180deg,rgba(127,133,150,.10),rgba(127,133,150,.055));
  border:1px solid rgba(127,133,150,.17);box-sizing:border-box;
  z-index:3;text-align:left;color:var(--wg-ink);
  scrollbar-width:none;pointer-events:auto;
  box-shadow:0 14px 34px -26px rgba(28,50,120,.38);
  animation:wg-card-in .45s cubic-bezier(.22,.72,.24,1)}
@keyframes wg-card-in{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
html.dsh-dark #whalego-voice-host .wg-written{background:linear-gradient(180deg,rgba(46,50,62,.55),rgba(30,32,40,.55));
  border-color:rgba(255,255,255,.09);box-shadow:0 14px 34px -20px rgba(0,0,0,.6)}
#whalego-voice-host .wg-written-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  font-size:14.5px;line-height:1.66;white-space:pre-wrap;scrollbar-width:none;padding-bottom:4px}
#whalego-voice-host .wg-written-body::-webkit-scrollbar{display:none}
/* The written answer is still streaming: a soft caret marks the edge. */
#whalego-voice-host .wg-written-body::after{content:'';display:inline-block;width:2px;height:1.02em;
  margin-left:2px;vertical-align:-.14em;border-radius:1px;background:rgba(90,124,242,.9);opacity:0;
  transition:opacity .3s ease}
#whalego-voice-host .wg-space[data-phase="speaking"] .wg-written-body::after,
#whalego-voice-host .wg-space[data-phase="thinking"] .wg-written-body::after{opacity:1;
  animation:wg-caret 1.05s steps(1,end) infinite}
@keyframes wg-caret{0%,100%{opacity:1}50%{opacity:0}}
#whalego-voice-host .wg-written-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;
  font:600 11px/1 -apple-system,"PingFang SC",sans-serif;letter-spacing:.08em;color:var(--wg-muted)}
#whalego-voice-host .wg-written-dot{width:6px;height:6px;border-radius:50%;background:#7b8394;opacity:.7}
#whalego-voice-host .wg-space[data-phase="speaking"] .wg-written-dot,
#whalego-voice-host .wg-space[data-phase="thinking"] .wg-written-dot{background:#4d6bfe;opacity:1;
  animation:wg-pulse 1.25s ease-in-out infinite}
@keyframes wg-pulse{0%,100%{transform:scale(.78);opacity:.45}50%{transform:scale(1.06);opacity:1}}
#whalego-voice-host .wg-lines-written{margin-top:8px;padding:9px 12px;border-radius:12px;
  background:rgba(127,133,150,.10);border:1px solid rgba(127,133,150,.16);text-align:left;
  font-size:13.5px;line-height:1.55;max-height:14dvh;overflow-y:auto;white-space:pre-wrap}
/* Waiting states get a small glass pill so the user always knows the mode. */
#whalego-voice-host .wg-phasechip{position:absolute;left:50%;transform:translateX(-50%);
  top:calc(50dvh + clamp(126px,31vw,176px));z-index:4;display:inline-flex;align-items:center;gap:7px;
  padding:8px 14px;border-radius:999px;background:var(--wg-surface);color:var(--wg-muted);
  font:500 12.5px/1 -apple-system,"PingFang SC",sans-serif;box-shadow:var(--wg-shadow);
  pointer-events:none;animation:wg-chip-in .32s ease both}
@keyframes wg-chip-in{from{opacity:0;transform:translateX(-50%) translateY(7px)}to{opacity:1;transform:translateX(-50%)}}
#whalego-voice-host .wg-phasechip-dot{width:7px;height:7px;border-radius:50%;background:#4d6bfe;
  animation:wg-pulse 1.4s ease-in-out infinite}
#whalego-voice-host .wg-hint-note{position:absolute;left:50%;transform:translateX(-50%);
  bottom:calc(var(--wg-composer,140px) + 96px);z-index:4;font-size:12.5px;color:var(--wg-muted);
  padding:8px 14px;border-radius:999px;background:var(--wg-surface);box-shadow:var(--wg-shadow);
  animation:wg-chip-in .32s ease both}
#whalego-voice-host .wg-sheet{position:absolute;left:0;right:0;bottom:calc(var(--wg-composer,140px) + 8px);z-index:8;
  padding:16px 18px 20px;border-radius:22px;background:var(--wg-surface);color:var(--wg-ink);
  box-shadow:0 -12px 40px rgba(0,0,0,.18);max-height:60vh;overflow-y:auto}
#whalego-voice-host .wg-sheet-head{display:flex;align-items:center;justify-content:space-between;
  font-size:15px;font-weight:600;margin-bottom:10px}
#whalego-voice-host .wg-sheet-head .wg-round{width:30px;height:30px;font-size:15px}
#whalego-voice-host .wg-group{margin-top:12px}
#whalego-voice-host .wg-group-label{font-size:12px;color:var(--wg-muted);margin-bottom:7px}
#whalego-voice-host .wg-chips{display:flex;flex-wrap:wrap;gap:8px}
#whalego-voice-host .wg-chip{padding:7px 13px;border-radius:999px;border:1px solid var(--wg-line);
  background:transparent;color:var(--wg-ink);font-size:13px}
#whalego-voice-host .wg-chip[data-on="true"]{background:var(--wg-ink);color:var(--wg-bg);border-color:transparent}
#whalego-voice-host .wg-toast{position:absolute;left:50%;transform:translateX(-50%);
  bottom:calc(var(--wg-composer,140px) + 96px);z-index:6;padding:8px 14px;border-radius:999px;
  background:var(--wg-surface);color:var(--wg-ink);font-size:13px;box-shadow:var(--wg-shadow);white-space:nowrap}
/* In compact the veil owns the readable text; the full view keeps one caption. */
#whalego-voice-host .wg-lines{position:absolute;left:50%;bottom:calc(var(--wg-composer,140px) + 64px);
  transform:translateX(-50%);width:min(88vw,540px);max-height:min(36dvh,280px);overflow:hidden;display:none;
  flex-direction:column;justify-content:flex-end;text-align:center;font:400 clamp(16px,4vw,19px)/1.58
  -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:var(--wg-ink);z-index:3;pointer-events:none;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 18%);mask-image:linear-gradient(to bottom,transparent 0,#000 18%)}
#whalego-voice-host .wg-lines p{margin:0 0 .32em}
#whalego-voice-host .wg-lines p:last-child{margin-bottom:0}
#whalego-voice-host .wg-space[data-compact="true"][data-veil="true"] .wg-lines{display:flex}
@media (max-height:520px){
  #whalego-voice-host .wg-caption{top:auto;bottom:8px;font-size:13px;max-height:3.2em}
}
#whalego-voice-host .wg-state,#whalego-voice-host .wg-transcript,#whalego-voice-host .wg-hint,
#whalego-voice-host .wg-controls,#whalego-voice-host .wg-ctl,#whalego-voice-host .wg-close{display:none}
#whalego-voice-host .wg-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);
  white-space:nowrap;border:0}
#whalego-voice-host .wg-error{position:absolute;left:50%;transform:translateX(-50%);bottom:26px;z-index:6;max-width:84%;
  font:400 13px/1.5 -apple-system,"PingFang SC",sans-serif;color:var(--wg-error-ink);background:var(--wg-error-bg);
  border:1px solid var(--wg-line);border-radius:14px;padding:9px 14px;box-shadow:0 8px 24px rgba(0,0,0,.08);text-align:center}
#whalego-voice-host .wg-error-action{position:absolute;left:50%;transform:translateX(-50%);bottom:82px;z-index:7;
  cursor:pointer;background:var(--wg-surface);box-shadow:var(--wg-shadow);color:var(--wg-ink);
  padding:9px 17px;font-weight:500;animation:wg-chip-in .32s ease both}
#whalego-voice-host .wg-dock{position:absolute;left:16px;right:16px;bottom:max(18px,env(safe-area-inset-bottom));
  display:flex;align-items:center;justify-content:center;gap:12px;z-index:4}
#whalego-voice-host .wg-dock .wg-round{width:46px;height:46px}
#whalego-voice-host .wg-dock .wg-end{background:#0b0b0c;color:#fff}
html[data-whalego-slot="1"] #whalego-voice-host .wg-dock{display:none}
#whalego-voice-host .wg-space[data-compact="true"]{background:transparent;pointer-events:none}
#whalego-voice-host .wg-space[data-compact="true"]::after{content:'';position:absolute;left:0;right:0;bottom:0;height:210px;
  background:linear-gradient(180deg,var(--wg-fade-0) 0%,var(--wg-fade-9) 68%,var(--wg-bg) 100%);
  z-index:1;pointer-events:none}
#whalego-voice-host .wg-space[data-compact="true"] .wg-top,
#whalego-voice-host .wg-space[data-compact="true"] .wg-heard,
#whalego-voice-host .wg-space[data-compact="true"] .wg-error{display:none}
#whalego-voice-host .wg-space[data-compact="true"] .wg-stage{transform:translate3d(0,calc(50dvh - var(--wg-composer,140px) - 74px),0)}
#whalego-voice-host .wg-space[data-compact="true"] .wg-orb{transform:scale(.5)!important;transform-origin:50% 50%;animation:none!important;
  box-shadow:inset 0 -22px 44px rgba(255,255,255,.55),0 16px 40px -22px rgba(68,105,235,.42)}
html.dsh-dark #whalego-voice-host .wg-space[data-compact="true"] .wg-orb{box-shadow:inset 0 -22px 44px rgba(255,255,255,.25),0 16px 40px -22px rgba(0,0,0,.85)}
.wg-slot{display:inline-flex;align-items:center;justify-content:center;gap:0;height:32px;width:32px;min-width:32px;flex:0 0 32px;padding:0;
  border-radius:50%;border:1px solid rgba(0,0,0,.08);background:#fff;color:#4a4f57;
  font:500 13px/1 -apple-system,"PingFang SC",sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06);
  transition:background .18s ease,transform .18s ease,color .18s ease}
.wg-slot:hover{background:#f6f7f9}
.wg-slot:active{transform:scale(.95)}
.wg-head-actions{display:inline-flex;align-items:center;gap:6px}
.wg-head-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;
  border:0;background:transparent;color:inherit;cursor:pointer}
.wg-head-btn:active{transform:scale(.94)}
.wg-slot-browser{display:inline-flex;align-items:center;justify-content:center;height:32px;width:32px;min-width:32px;flex:0 0 32px;
  padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.08);color:#4a4f57;background:#f6f7f9;
  margin-right:22px;position:relative;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06)}
html.dsh-dark .wg-slot-browser{background:#242427;border-color:rgba(255,255,255,.12);color:#d8d8de}
.wg-slot-browser::after{content:'';position:absolute;right:-11px;top:7px;bottom:7px;width:1px;background:rgba(0,0,0,.10)}
.wg-slot:focus-visible{outline:2px solid #3a66e8;outline-offset:2px}
.wg-slot[data-mode="on"]{background:#0b0b0c;border-color:#0b0b0c;color:#fff;padding:0;width:32px;
  box-shadow:0 2px 8px rgba(0,0,0,.22)}
html.dsh-dark .wg-slot{background:#242427;border-color:rgba(255,255,255,.12);color:#d8d8de;box-shadow:0 1px 2px rgba(0,0,0,.4)}
html.dsh-dark .wg-slot:hover{background:#2d2d31}
html.dsh-dark .wg-slot[data-mode="on"]{background:#f2f2f3;border-color:#f2f2f3;color:#151517}
.wg-slot-dot{width:7px;height:7px;border-radius:50%;background:linear-gradient(135deg,#4d6bfe,#36e2c7);
  box-shadow:0 0 6px rgba(77,107,254,.6)}
.wg-slot-x{font-size:15px;line-height:1;font-weight:400}
html[data-whalego-slot="1"] #whalego-voice-host .wg-trigger{display:none}
html[data-whalego-mode="1"] [class*="composerSeat"]{margin-top:auto!important}
@media (prefers-reduced-motion:reduce){
  #whalego-voice-host .wg-orb,#whalego-voice-host .wg-orb *,#whalego-voice-host .wg-orb::before,
  #whalego-voice-host .wg-orb::after{animation:none!important}
  #whalego-voice-host .wg-caption p,#whalego-voice-host .wg-written,#whalego-voice-host .wg-written::after,
  #whalego-voice-host .wg-phasechip,#whalego-voice-host .wg-hint-note,#whalego-voice-host .wg-error-action,
  #whalego-voice-host .wg-phasechip-dot,#whalego-voice-host .wg-written-dot{animation:none!important}
  #whalego-voice-host .wg-space,#whalego-voice-host .wg-stage,#whalego-voice-host .wg-orb,
  #whalego-voice-host .wg-veil,#whalego-voice-host .wg-caption{transition-duration:.01ms}
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

    function browserEntryUrl(port = 3099) {
      const origin = typeof location === 'undefined' ? '' : location.origin;
      const query = origin ? `?voice=1&origin=${encodeURIComponent(origin)}` : '?voice=1';
      return `http://127.0.0.1:${port || 3099}/${query}`;
    }

    const flat = (text) => String(text ?? '').replace(/\s+/g, '');

    /**
     * Spoken commands, semantics adopted from dsh-orb (see docs/
     * 专题-逆向dsh-orb与融合.md §1.5). The wake phrase is a prefix: a question
     * that merely mentions the wake word mid-sentence stays a question, exactly
     * like dsh-orb's `stripWakePrefix`. Break and stop are keywords anywhere in
     * the frame, matching dsh-orb's interject/dismiss keyword behaviour; the
     * wake check runs first so saying the wake phrase never reads as a break.
     * Empty phrases never match.
     */
    function voiceCommand(heard, prefs) {
      const text = String(heard ?? '').trim();
      if (!prefs || text.length < 2) return null;
      const wake = String(prefs.wakePhrase ?? '').trim();
      if (wake && text.startsWith(wake)) return { kind: 'wake', tail: text.slice(wake.length).trim() };
      const breakPhrase = flat(prefs.breakPhrase);
      if (breakPhrase && flat(text).includes(breakPhrase)) return { kind: 'break' };
      const stopPhrase = flat(prefs.stopPhrase);
      if (stopPhrase && flat(text).includes(stopPhrase)) return { kind: 'stop' };
      return null;
    }

    function voiceCommandsOff(prefs) {
      return (prefs?.voiceCommands ?? 'off') !== 'on';
    }

    // Test seam: the spoken-command matcher and its off-gate at module scope,
    // so a harness can reach them without running any hook or component.
    if (typeof window !== 'undefined') {
      window.__whalegoVoiceCommands = { match: voiceCommand, gate: voiceCommandsOff };
    }

    function openBrowserEntry(port = 3099) {
      const url = browserEntryUrl(port);
      try {
        const inAppWebView =
          typeof window !== 'undefined' &&
          (Boolean(window.DshAppOpen) ||
            document.documentElement?.hasAttribute?.('data-dsh-app-layout') ||
            /;\s*wv\)/i.test(navigator.userAgent || ''));
        if (inAppWebView) {
          window.location.assign(url);
          return;
        }
        const win = window.open(url, '_blank', 'noopener');
        if (!win) window.location.assign(url);
      } catch {
        try {
          window.location.assign(url);
        } catch {
          /* ignore */
        }
      }
    }

    /* Full duplex means the microphone also hears the speaker. Ignore the
     * recogniser's copy of our own answer, but keep a genuine interruption. */
    function looksLikeEcho(heard, answer) {
      const squash = (value) => String(value || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
      const h = squash(heard);
      const a = squash(answer);
      if (h.length < 2 || a.length < 2) return false;
      if (a.includes(h)) return true;
      if (h.length < 6) return false;
      const tail = a.slice(-Math.max(60, h.length * 2));
      let hit = 0;
      for (const ch of new Set(h)) if (tail.includes(ch)) hit += 1;
      return hit / new Set(h).size > 0.82;
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
    function encodeWav(samples, rate) {
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);
      const str = (o, t) => { for (let i = 0; i < t.length; i += 1) view.setUint8(o + i, t.charCodeAt(i)); };
      str(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      str(36, 'data'); view.setUint32(40, samples.length * 2, true);
      let o = 44;
      for (let i = 0; i < samples.length; i += 1) {
        const v = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        o += 2;
      }
      return new Uint8Array(buffer);
    }

    function toBase64(bytes) {
      let text = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(text);
    }

    function createSpeaker({ play, prepare, report, phase, onLine, onHeard, onSettled }) {
      const heard = new Set();
      const queue = [];
      let generationDone = false;
      let writtenDone = true;
      let playing = false;
      let stale = false;
      let reported = false;
      let settled = false;
      let started = false;

      const trySettle = () => {
        if (settled || stale || !reported || !writtenDone || playing || queue.length) return;
        settled = true;
        phase('done');
        onSettled?.();
      };

      const drain = async () => {
        if (playing) return;
        playing = true;
        try {
          while (queue.length) {
            if (stale) return;
            started = true;
            phase('speaking');
            const line = queue.shift();
            // The captions use the line that is actually sounding, not the
            // whole answer, so the visible sentence cannot run ahead of the ear.
            if (typeof onLine === 'function') onLine(line);
            // Warm the next line while this one sounds.
            if (queue.length && typeof prepare === 'function') prepare(queue[0]);
            const result = await play(line);
            if (result === 'stopped' || stale) return;
            if (typeof onHeard === 'function') onHeard(line);
          }
        } finally {
          playing = false;
        }
        if (generationDone && !queue.length && !reported) {
          reported = true;
          report('ended');
        }
        trySettle();
      };

      return {
        /** Merge the speech segments of one live frame into the queue. */
        accept(data) {
          if (stale) return;
          if (typeof data?.writtenDone === 'boolean') writtenDone = data.writtenDone;
          if (data?.state === 'done') writtenDone = true;
          if (reported) {
            trySettle();
            return;
          }
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
          writtenDone = true;
          trySettle();
          void drain();
        },
        /** True once this turn has actually sounded, so the orb keeps saying it. */
        hasStarted: () => started,
        /** The queue ran dry but generation never finished: the stream died. */
        stalled: () => started && !playing && !queue.length && !generationDone,
        /** Interrupted, superseded or cleaned up: drop whatever is left. */
        stop() {
          stale = true;
          queue.length = 0;
        },
      };
    }

    // Debug seam for the pure-Node test harness and the CDP probes; the web
    // module loader itself only ever calls apply/inject.
    window.__whalegoInternals = { createPlayer, createSpeaker, looksLikeEcho };

    /* ------------------------------------------------------------ component */

    function VoiceSpace() {
      const [open, setOpen] = useState(false);
      const [mode, setMode] = useState(false);
      const [compact, setCompact] = useState(false);
      const [phase, setPhase] = useState('idle');
      const [muted, setMuted] = useState(false);
      const [you, setYou] = useState('');
      const [answer, setAnswer] = useState('');
      const [spoken, setSpoken] = useState('');
      const [written, setWritten] = useState('');
      const [thinkOrb, setThinkOrb] = useState('corner');
      const [prefs, setPrefs] = useState({
        mode: 'auto',
        voice: 'zh-CN-XiaoxiaoNeural',
        rate: 'normal',
        filler: '我想想。',
        browserEntry: 'on',
        voiceCommands: 'off',
        wakePhrase: '你好小鲸',
        wakeReply: '我在呢。',
        breakPhrase: '小鲸',
        stopPhrase: '退下吧',
      });
      // Spoken commands read prefs inside the recogniser callback; the ref
      // keeps that callback free of dependency resets that would restart the mic.
      const prefsRef = useRef(null);
      const [settingsOpen, setSettingsOpen] = useState(false);
      const [recordFallback, setRecordFallback] = useState(false);
      const [pluginVersion, setPluginVersion] = useState('');
      const [browserMode, setBrowserMode] = useState({ running: false, port: 3099 });
      const [toast, setToast] = useState('');
      const [spokenLines, setSpokenLines] = useState([]);
      const [interim, setInterim] = useState('');
      const [error, setError] = useState('');
      const [typed, setTyped] = useState('');
      const phaseRef = useRef('idle');
      const orbRef = useRef(null);
      const recogRef = useRef(null);
      const playerRef = useRef(null);
      const mirroredRef = useRef('');
      const sseRef = useRef(null);
      const speakerRef = useRef(null);
      const sessionRef = useRef('');
      const silenceRef = useRef(null);
      const bargeRef = useRef(0);
      const pendingRef = useRef('');
      const answerRef = useRef('');
      const openRef = useRef(false);
      const compactRef = useRef(false);
      const modeRef = useRef(false);
      const mutedRef = useRef(false);
      const micBlockedRef = useRef(false);
      const bargedRef = useRef(false);
      const sentAtRef = useRef(0);
      const seenTimerRef = useRef(null);
      const openedAtRef = useRef(0);
      const heardRef = useRef('');
      const micErrorRef = useRef('');
      const micGrantedRef = useRef(false);
      const micPendingRef = useRef(null);
      const spokenLinesRef = useRef([]);
      const writtenRef = useRef('');
      const recorderRef = useRef(null);
      const firstLineRef = useRef(false);
      const fillerRef = useRef('');
      const fillerElRef = useRef(null);
      const fillerTimerRef = useRef(null);
      const captionRef = useRef(null);
      const writtenNodeRef = useRef(null);

      if (!playerRef.current) playerRef.current = createPlayer();

      useEffect(() => {
        prefsRef.current = prefs;
      }, [prefs]);

      const flashToast = useCallback((text) => {
        if (!text) return;
        setToast(String(text));
        window.setTimeout(() => {
          setToast((current) => (current === text ? '' : current));
        }, 1600);
      }, []);

      const clearFiller = useCallback(() => {
        if (fillerTimerRef.current) {
          clearTimeout(fillerTimerRef.current);
          fillerTimerRef.current = null;
        }
        const el = fillerElRef.current;
        fillerElRef.current = null;
        if (el) {
          try {
            el.pause();
            el.currentTime = 0;
          } catch {
            /* gone */
          }
        }
      }, []);

      // A pre-synthesised "let me think" line fills the gap before the first
      // sentence is audible. Synthesising on demand would be too slow.
      const startFiller = useCallback(() => {
        clearFiller();
        firstLineRef.current = false;
        fillerTimerRef.current = setTimeout(() => {
          fillerTimerRef.current = null;
          if (firstLineRef.current || phaseRef.current !== 'thinking') return;
          if (speakerRef.current?.hasStarted?.()) return;
          const url = fillerRef.current;
          if (!url) return;
          const el = new Audio(url);
          fillerElRef.current = el;
          void el.play().catch(() => {});
        }, 400);
      }, [clearFiller]);

      useEffect(() => {
        let cancelled = false;
        void (async () => {
          try {
            const res = await fetch('/whalego/speak', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: '我想想啊。' }),
            });
            if (!res.ok) return;
            const blob = await res.blob();
            if (cancelled || !blob.size) return;
            fillerRef.current = URL.createObjectURL(blob);
          } catch {
            /* offline: the filler is optional */
          }
        })();
        return () => {
          cancelled = true;
          if (fillerRef.current) URL.revokeObjectURL(fillerRef.current);
        };
      }, []);

      useEffect(() => {
        answerRef.current = answer;
      }, [answer]);
      useEffect(() => {
        spokenLinesRef.current = spokenLines;
      }, [spokenLines]);
      useEffect(() => {
        writtenRef.current = written;
      }, [written]);
      useEffect(() => {
        openRef.current = open;
      }, [open]);
      useEffect(() => {
        compactRef.current = compact;
      }, [compact]);
      useEffect(() => {
        modeRef.current = mode;
      }, [mode]);
      useEffect(() => {
        mutedRef.current = muted;
      }, [muted]);

      useEffect(() => {
        let cancelled = false;
        probe('boot');
        void (async () => {
          try {
            const res = await fetch('/whalego/health', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            if (!cancelled && data?.version) setPluginVersion(String(data.version));
            try {
              if (data?.version && data.version !== CLIENT_BUILD) {
                if (!sessionStorage.getItem('whalego-reload')) {
                  sessionStorage.setItem('whalego-reload', '1');
                  location.reload();
                }
              } else {
                sessionStorage.removeItem('whalego-reload');
              }
            } catch {
              /* storage may be blocked */
            }
            if (!cancelled && data?.browser) setBrowserMode(data.browser);
            if (cancelled || !data?.prefs) return;
            setPrefs((prev) => ({ ...prev, ...data.prefs }));
            if (data.prefs.thinkOrb) setThinkOrb(data.prefs.thinkOrb);
          } catch {
            /* keep the default corner dock */
          }
        })();
        return () => {
          cancelled = true;
        };
      }, []);

      // The phone app does not draw plugin panels yet, so the dock position is
      // a gesture: long-press the orb to move it between the corner and the
      // centre, and the choice is stored on the host.
      const toggleThinkOrb = useCallback(() => {
        const next = thinkOrb === 'center' ? 'corner' : 'center';
        setThinkOrb(next);
        setPrefs((prev) => ({ ...prev, thinkOrb: next }));
        setToast(next === 'center' ? '思考时球在底部中央' : '思考时球在右下角');
        window.setTimeout(() => setToast(''), 1600);
        api('/whalego/prefs', { method: 'POST', body: JSON.stringify({ thinkOrb: next }) }).catch(() => {});
      }, [thinkOrb]);

      const savePref = useCallback((key, value) => {
        setPrefs((prev) => ({ ...prev, [key]: value }));
        if (key === 'thinkOrb') {
          setThinkOrb(value);
          setToast(value === 'center' ? '思考时球在底部中央' : '思考时球在右下角');
          window.setTimeout(() => setToast(''), 1600);
        }
        api('/whalego/prefs', { method: 'POST', body: JSON.stringify({ [key]: value }) }).catch(() => {});
      }, []);

      const setPhaseSafe = useCallback((next) => {
        const value = typeof next === 'function' ? next(phaseRef.current) : next;
        phaseRef.current = value;
        try {
          if (window.__whalegoDebug) window.__phaseTrace = [...(window.__phaseTrace || []), value].slice(-40);
        } catch {
          /* debug only */
        }
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
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        if (bargeRef.current) bargeRef.current = 0;
        pendingRef.current = '';
        const rec = recorderRef.current;
        recorderRef.current = null;
        try {
          if (rec) {
            rec.processor?.disconnect?.();
            rec.source?.disconnect?.();
            rec.stream?.getTracks?.().forEach((track) => track.stop());
            rec.audio?.close?.().catch?.(() => {});
          }
        } catch {
          /* gone */
        }
        const recog = recogRef.current;
        recogRef.current = null;
        try {
          if (recog) {
            recog.onresult = null;
            recog.onerror = null;
            recog.onend = null;
            recog.stop();
          }
        } catch {
          /* gone */
        }
        recogRef.current = null;
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
      }, []);

      const focusSlot = useCallback(() => {
        requestAnimationFrame(() => {
          const slot = document.querySelector('.wg-slot');
          if (slot instanceof HTMLElement) slot.focus({ preventScroll: true });
        });
      }, []);

      const endSession = useCallback(() => {
        probe('end');
        playChime('close');
        cleanupStreams();
        clearFiller();
        // Ending the voice mode must also close the ear; otherwise a late
        // recognition result can send a new turn after the native ✕.
        const recog = recogRef.current;
        recogRef.current = null;
        if (recog) {
          recog.onresult = null;
          recog.onerror = null;
          recog.onend = null;
          try {
            recog.stop();
          } catch {
            /* gone */
          }
        }
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        setMode(false);
        setOpen(false);
        setPhaseSafe('idle');
        setInterim('');
        setAnswer('');
        setWritten('');
        setSpoken('');
        setSpokenLines([]);
        setYou('');
        setError('');
        setTyped('');
        try {
          const sessionId = sessionRef.current;
          if (sessionId) {
            api('/whalego/cancel', { method: 'POST', body: JSON.stringify({ sessionId, heard: heardRef.current }) }).catch(() => {});
          }
        } catch {
          /* gone */
        }
        focusSlot();
      }, [cleanupStreams, clearFiller, focusSlot, setPhaseSafe]);

      // Collapsing keeps the voice mode alive when there is a conversation:
      // the minimised orb stays on screen and can start the next turn. On an
      // empty home there is nothing to keep, and leaving the hero pinned to
      // the bottom under a mini orb looks broken, so collapse simply ends the
      // session there.
      const collapse = useCallback(() => {
        probe('collapse');
        const hasChat =
          Boolean(you || answer || typed) ||
          (typeof document !== 'undefined' && !document.querySelector('[class*="composerHero"]'));
        if (!hasChat) {
          endSession();
          return;
        }
        playChime('close');
        const recog = recogRef.current;
        recogRef.current = null;
        if (recog) {
          recog.onresult = null;
          recog.onerror = null;
          recog.onend = null;
          try {
            recog.stop();
          } catch {
            /* gone */
          }
        }
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        setInterim('');
        setOpen(false);
        setPhaseSafe((current) => (current === 'listening' ? 'idle' : current));
        focusSlot();
      }, [answer, endSession, focusSlot, setPhaseSafe, typed, you]);

      // Mute only stops the microphone; the conversation stays open and the
      // orb can start the next turn with a tap.
      const toggleMute = useCallback(() => {
        const next = !mutedRef.current;
        mutedRef.current = next;
        setMuted(next);
        if (!next) return;
        const recog = recogRef.current;
        recogRef.current = null;
        try {
          if (recog) {
            recog.onresult = null;
            recog.onerror = null;
            recog.onend = null;
            recog.stop();
          }
        } catch {
          /* gone */
        }
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        if (bargeRef.current) bargeRef.current = 0;
        pendingRef.current = '';
        setInterim('');
        setPhaseSafe('idle');
      }, [setPhaseSafe]);

      const cancel = useCallback(() => {
        cleanupStreams();
        setPhaseSafe('idle');
        setSpoken('');
        setSpokenLines([]);
        setInterim('');
        setError('');
        try {
          const sessionId = sessionRef.current;
          if (sessionId) {
            api('/whalego/cancel', { method: 'POST', body: JSON.stringify({ sessionId, heard: heardRef.current }) }).catch(() => {});
          }
        } catch {
          /* gone */
        }
      }, [cleanupStreams, setPhaseSafe]);

      /* Barge-in: stop the answer and its audio, but keep the recogniser alive.
       * The user's next pause sends the new question. */
      const interruptTurn = useCallback(() => {
        try {
          sseRef.current?.close();
        } catch {
          /* gone */
        }
        sseRef.current = null;
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        speakerRef.current?.stop();
        speakerRef.current = null;
        playerRef.current?.stop();
        bargedRef.current = true;
        setSpoken('');
        setSpokenLines([]);
        setPhaseSafe('listening');
        setError('');
        try {
          const sessionId = sessionRef.current;
          if (sessionId) {
            api('/whalego/cancel', { method: 'POST', body: JSON.stringify({ sessionId, heard: heardRef.current }) }).catch(() => {});
          }
        } catch {
          /* gone */
        }
      }, [setPhaseSafe]);

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
          let ended = false;
          let lastEventAt = Date.now();
          let watch = 0;
          // The browser is the speaker: only it knows when the answer finished.
          // The engine settles the turn on this receipt (web twin of audio.done).
          const speaker = createSpeaker({
            play: (line) => playerRef.current?.play(line),
            prepare: (line) => playerRef.current?.prepare(line),
            onLine: (line) => {
              firstLineRef.current = true;
              clearFiller();
              setSpoken(line);
              setSpokenLines((lines) => (lines[lines.length - 1] === line ? lines : [...lines, line]));
            },
            onHeard: (line) => {
              heardRef.current = `${heardRef.current}${line}`;
            },
            report: (state) => {
              api('/whalego/playback', {
                method: 'POST',
                body: JSON.stringify({ sessionId, turnId, state, heard: heardRef.current }),
              }).catch(() => {});
            },
            onSettled: () => {
              if (watch) clearInterval(watch);
              if (speakerRef.current === speaker) speakerRef.current = null;
            },
            phase: setPhaseSafe,
          });
          speakerRef.current = speaker;

          const failStream = () => {
            if (ended) return;
            ended = true;
            if (watch) clearInterval(watch);
            try {
              source.close();
            } catch {
              /* gone */
            }
            if (sseRef.current === source) sseRef.current = null;
            if (speakerRef.current !== speaker) return;
            // A dead stream leaves the orb thinking/speaking forever; stop the
            // local queue and settle the turn so the next question starts clean.
            speaker.stop();
            speakerRef.current = null;
            playerRef.current?.stop();
            setError('语音流断了，请再点一次球重试。');
            setPhaseSafe('idle');
            try {
              api('/whalego/cancel', {
                method: 'POST',
                body: JSON.stringify({ sessionId, heard: heardRef.current }),
              }).catch(() => {});
            } catch {
              /* gone */
            }
          };

          // Debug seam for the live probes: simulate the stream dying mid-turn.
          window.__whalegoDropStream = failStream;

          source.addEventListener('live', (event) => {
            lastEventAt = Date.now();
            let data;
            try {
              data = JSON.parse(event.data);
            } catch {
              return;
            }
            if (speakerRef.current !== speaker) return;
            if (data.voice) setAnswer(data.voice);
            // B: the written answer, rendered below A while it streams.
            if (typeof data.text === 'string') {
              setWritten(data.text);
              if (seenTimerRef.current) clearTimeout(seenTimerRef.current);
              if (data.text) {
                seenTimerRef.current = setTimeout(() => {
                  seenTimerRef.current = null;
                  api('/whalego/seen', {
                    method: 'POST',
                    body: JSON.stringify({ turnId, seen: data.text }),
                  }).catch(() => {});
                }, 700);
              }
            }
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
            ended = true;
            if (watch) clearInterval(watch);
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
          source.addEventListener('error', failStream);
          watch = setInterval(() => {
            if (speakerRef.current !== speaker) {
              clearInterval(watch);
              return;
            }
            if (ended || Date.now() - lastEventAt < 12000) return;
            const silentStart = !speaker.hasStarted() && Date.now() - lastEventAt > 20000;
            if (!speaker.stalled() && !silentStart) return;
            failStream();
          }, 3000);
        },
        [setPhaseSafe],
      );

      const send = useCallback(
        async (raw) => {
          const text = String(raw || '').trim();
          if (!text) return;
          bargeRef.current = 0;
          pendingRef.current = '';
          // The question is in: whatever the microphone was holding is that
          // question, not a new one.
          discardRecordingRef.current?.();
          // A typed/test line can arrive while the previous answer is still
          // playing; stop that turn first so two voices never overlap.
          if (phaseRef.current === 'speaking' || phaseRef.current === 'thinking') interruptTurn();
          bargedRef.current = false;
          sentAtRef.current = Date.now();
          setError('');
          setYou(text);
          heardRef.current = '';
          setAnswer('');
          setWritten('');
          setSpoken('');
          setSpokenLines([]);
          setTyped('');
          setInterim('');
          setPhaseSafe('thinking');
          startFiller();
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
        [follow, interruptTurn, setPhaseSafe, startFiller],
      );

      // A barge-in question is held here instead of a one-shot timeout: closing
      // or muting can clear the recognition timer, but the user's words must
      // still turn into the next turn once they pause.
      useEffect(() => {
        if (!mode) return undefined;
        const timer = setInterval(() => {
          if (!bargeRef.current || Date.now() < bargeRef.current) return;
          const said = pendingRef.current.trim();
          bargeRef.current = 0;
          pendingRef.current = '';
          if (!said) return;
          setInterim('');
          void send(said);
        }, 150);
        return () => clearInterval(timer);
      }, [mode, send]);

      // Typed messages go through the app itself (so the composer behaves
      // natively); mirror the agent's answer into the voice transcript and
      // read it out loud.
      const stopListening = useCallback(() => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = null;
        if (bargeRef.current) bargeRef.current = 0;
        pendingRef.current = '';
        const rec = recorderRef.current;
        recorderRef.current = null;
        try {
          if (rec) {
            rec.processor?.disconnect?.();
            rec.source?.disconnect?.();
            rec.stream?.getTracks?.().forEach((track) => track.stop());
            rec.audio?.close?.().catch?.(() => {});
          }
        } catch {
          /* gone */
        }
        const recog = recogRef.current;
        recogRef.current = null;
        try {
          if (recog) {
            recog.onresult = null;
            recog.onerror = null;
            recog.onend = null;
            recog.stop();
          }
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
            // While a spoken turn is active, its written track (B) also arrives
            // on this feed with `voice` filled in. Do not mistake B for the user
            // typing: the voice SSE owns the turn and the mic must stay open.
            // A typed turn starts from idle/done, so it still takes this path.
            const voiceActive = phaseRef.current === 'speaking' || phaseRef.current === 'thinking';
            if (String(data.voice || '').trim() && voiceActive) return;
            if (bargedRef.current) return;
            // The session feed replays the newest entry on connect. Show it (so
            // reopening the page still has both tracks) but never read an old
            // answer out loud again.
            const stale = Boolean(data.at) && Number(data.at) < startedAt - 1200;
            const written = String(data.text || '').trim();
            const text = String(data.voice || written || '').trim();
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
            // A typed message is chat: collapse to the mini orb so the native
            // conversation comes back into view.
            setCompact(true);
            if (data.question) setYou(data.question);
            // Text streams in while the agent works; speak only the final line.
            setTyped(data.turnId);
            setSpokenLines([]);
            setAnswer(spoken);
            // A replayed entry is history: opening the page must not paint an
            // old answer that was never spoken in this session.
            if (stale) return;
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
        window.__whalegoState = () => ({
          phase: phaseRef.current,
          answer: answerRef.current,
          spoken: spokenLinesRef.current.join(' ') || answerRef.current,
          spokenLines: [...spokenLinesRef.current],
          written: writtenRef.current,
          mic: Boolean(recogRef.current || recorderRef.current),
          micGranted: micGrantedRef.current,
          muted: mutedRef.current,
          turn: window.__whalegoLastTurn?.turnId ?? '',
        });
        return () => {
          delete window.__whalegoSay;
          delete window.__whalegoState;
        };
      }, [send]);

      const startListening = useCallback((quiet = false, force = false) => {
        if (micBlockedRef.current && !force) return false;
        const Recognition = speech();
        if (!Recognition) return false;
        const previous = recogRef.current;
        recogRef.current = null;
        try {
          if (previous) {
            previous.onresult = null;
            previous.onerror = null;
            previous.onend = null;
            previous.stop();
          }
        } catch {
          /* gone */
        }
        const recog = new Recognition();
        recog.lang = 'zh-CN';
        recog.continuous = true;
        recog.interimResults = true;
        let finalText = '';
        let partialText = '';
        const answering = () =>
          phaseRef.current === 'speaking' ||
          phaseRef.current === 'thinking' ||
          Boolean(speakerRef.current?.hasStarted?.());
        recog.onresult = (event) => {
          // Engines can flush the same final result a beat after `send`; do not
          // let that echo start a second turn over the answer we just asked for.
          if (Date.now() - sentAtRef.current < 400) return;
          partialText = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const transcript = result[0]?.transcript ?? '';
            if (result.isFinal) finalText += transcript;
            else partialText += transcript;
          }
          const heard = `${finalText}${partialText}`.trim();
          // The microphone hears the speaker. Drop our own answer instead of
          // treating it as a new question; a genuine interruption still passes.
          if (answering() && looksLikeEcho(heard, answerRef.current)) {
            finalText = '';
            partialText = '';
            if (silenceRef.current) clearTimeout(silenceRef.current);
            silenceRef.current = null;
            setInterim('');
            return;
          }
          // Spoken commands (semantics from dsh-orb; see lib/client.js voiceCommand).
          // They run after the echo filter, so the TTS voice itself can never
          // trigger them; only when voiceCommands is on.
          if (!voiceCommandsOff(prefsRef.current)) {
            const command = voiceCommand(heard, prefsRef.current);
            if (command?.kind === 'break') {
              interruptTurn();
              finalText = '';
              partialText = '';
              if (silenceRef.current) clearTimeout(silenceRef.current);
              silenceRef.current = null;
              pendingRef.current = '';
              setInterim('');
              flashToast(`${prefsRef.current.wakeReply || '我在呢'}，请讲。`);
              return;
            }
            if (command?.kind === 'stop') {
              interruptTurn();
              finalText = '';
              partialText = '';
              if (silenceRef.current) clearTimeout(silenceRef.current);
              silenceRef.current = null;
              pendingRef.current = '';
              setInterim('');
              stopListening();
              setCompact(true);
              flashToast('先退下了。');
              return;
            }
            if (command?.kind === 'wake') {
              finalText = '';
              partialText = '';
              setInterim('');
              const tail = command.tail || '';
              if (tail.replace(/\s/g, '').length >= 4) {
                // A real question followed the wake word: queue it on the
                // barge channel; `send` interrupts a playing answer itself.
                pendingRef.current = tail;
                bargeRef.current = Date.now() + 900;
                return;
              }
              // A bare wake word while the answer plays: the mic is already
              // open, so only the greeting is new information.
              if (!answering()) flashToast(prefsRef.current.wakeReply || '我在呢');
              return;
            }
          }
          // While the answer is running, a couple of syllables are noise or the
          // tail of our own TTS - not an interruption. Require a real phrase so
          // a cough cannot cancel the turn.
          if (answering() && !bargedRef.current && heard.replace(/\s/g, '').length < 4) {
            finalText = '';
            partialText = '';
            return;
          }
          // The first real syllables stop the answer immediately; the new
          // question is sent after the user pauses, so the mics stays open.
          const wasAnswering = answering();
          if (wasAnswering && !bargedRef.current) interruptTurn();
          setInterim(heard);
          if (wasAnswering || bargedRef.current) {
            // A timer scheduled inside the recognizer callback was being
            // cleared when a cancelled turn's late `typed-live` frame ran
            // through stopListening. Keep only a deadline here; a watchdog
            // effect below owns the actual send.
            pendingRef.current = heard;
            bargeRef.current = Date.now() + 900;
            return;
          }
          if (silenceRef.current) clearTimeout(silenceRef.current);
          silenceRef.current = setTimeout(() => {
            const said = `${finalText}${partialText}`.trim();
            finalText = '';
            partialText = '';
            silenceRef.current = null;
            setInterim('');
            if (!said) return;
            if (answering() && looksLikeEcho(said, answerRef.current)) return;
            if (answering()) interruptTurn();
            void send(said);
          }, 1400);
        };
        recog.onerror = (event) => {
          if (recogRef.current !== recog) return;
          const reason = String(event?.error || '');
          probe('recog:error', { reason });
          // When getUserMedia already succeeded (the browser granted mic access)
          // and only Web Speech's cloud service failed or was refused by the
          // container, switch seamlessly to local WAV + SenseVoice recording.
          if (
            micGrantedRef.current &&
            (reason === 'network' || reason === 'service-not-allowed' || reason === 'not-allowed')
          ) {
            recogRef.current = null;
            setRecordFallback(true);
            setError('');
            void startRecordingRef.current?.();
            return;
          }
          // `no-speech` is normal in continuous mode; it must not stop the ear.
          // Only failures the user has to fix should block the restart loop.
          const fatal =
            reason === 'not-allowed' ||
            reason === 'service-not-allowed' ||
            reason === 'audio-capture' ||
            reason === 'network';
          micBlockedRef.current = fatal;
          if (!fatal) return;
          if (reason === 'not-allowed' || reason === 'service-not-allowed') {
            setError('没有拿到麦克风权限。允许麦克风后点球重试，或直接在下面输入框打字。');
            // Tell the two failures apart: a denied OS permission versus a host
            // WebView that never forwards the request.
            try {
              navigator.permissions
                ?.query({ name: 'microphone' })
                .then((status) => {
                  if (recogRef.current !== recog) return;
                  setError(`没有拿到麦克风权限（系统状态：${status.state}）。允许后点球重试，或直接在下面输入框打字。`);
                })
                .catch(() => {});
            } catch {
              /* permissions API missing */
            }
          } else if (reason === 'audio-capture') {
            setError('没找到可用的麦克风，直接在下面输入框打字也可以。');
          } else if (reason === 'network') {
            setError('语音识别连不上网络。点球改用本机识别，或直接在下面输入框打字。');
            setRecordFallback(true);
          }
          if (reason === 'service-not-allowed') setRecordFallback(true);
          setPhaseSafe('idle');
        };
        recog.onend = () => {
          // A replaced recogniser can still emit `end`; it must not knock the
          // freshly started one out of listening or schedule a second loop.
          if (recogRef.current !== recog) return;
          recogRef.current = null;
          const shouldListen =
            modeRef.current && openRef.current && !mutedRef.current && !micBlockedRef.current;
          if (!shouldListen) {
            if (phaseRef.current === 'listening') setPhaseSafe('idle');
            return;
          }
          // Chrome ends continuous recognition every minute or so, and some
          // engines stop while TTS is playing. Full duplex keeps the ear open.
          setTimeout(() => {
            if (recogRef.current || !modeRef.current || !openRef.current || mutedRef.current) return;
            if (!startListening(true)) setError('麦克风断开了，点一下球继续，或直接在下面输入框打字。');
          }, 320);
        };
        recogRef.current = recog;
        try {
          recog.start();
          micBlockedRef.current = false;
          if (!quiet) setPhaseSafe('listening');
          return true;
        } catch {
          if (recogRef.current === recog) recogRef.current = null;
          return false;
        }
      }, [interruptTurn, flashToast, send, setCompact, setPhaseSafe, stopListening]);

      // Web Speech alone does not always surface the Android permission dialog.
      // Asking for a throwaway stream inside the tap makes the prompt appear.
      // Diagnostics go to the host log; the phone-side screen cannot be read by
      // the automation, so the browser has to report on its own behalf.
      const probe = useCallback((event, extra = {}) => {
        try {
          const base = {
            event,
            origin: typeof location === 'undefined' ? '' : location.origin,
            secure: typeof window === 'undefined' ? null : window.isSecureContext,
            media: Boolean(navigator.mediaDevices?.getUserMedia),
            speech: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
            w: window.innerWidth,
            doc: document.documentElement.clientWidth,
            path: typeof location === 'undefined' ? '' : location.pathname,
            framed: typeof window === 'undefined' ? null : window.top !== window,
            micPolicy:
              typeof document === 'undefined'
                ? null
                : (document.permissionsPolicy?.allowsFeature?.('microphone') ??
                   document.featurePolicy?.allowsFeature?.('microphone') ??
                   null),
            hasToken: typeof location === 'undefined' ? false : /[?&]token=/.test(location.search),
            ...extra,
          };
          const body = { ...base };
          // A launch token in the URL is the only way into the same session from
          // another browser; keep it out of the shared line.
          if (base.hasToken && typeof location !== 'undefined') {
            const match = /[?&]token=([^&]+)/.exec(location.search);
            if (match) body.launchToken = decodeURIComponent(match[1]).slice(0, 200);
          }
          api('/whalego/probe', { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
        } catch {
          /* diagnostics only */
        }
      }, []);

      // Record every open/compact/mode transition so a sub-second collapse can
      // be reconstructed from the host log. This must sit after `probe`: an
      // earlier placement put it in the temporal dead zone and crashed render.
      useEffect(() => {
        probe('state', { open, compact, mode, phase });
      }, [open, compact, mode, phase, probe]);

      const startRecordingRef = useRef(null);
      const stopRecordingRef = useRef(null);
      const discardRecordingRef = useRef(null);

      const primeMic = useCallback(async () => {
        if (micGrantedRef.current) return true;
        if (micPendingRef.current) return micPendingRef.current;
        const run = (async () => {
          try {
            const media = navigator.mediaDevices;
            if (!media?.getUserMedia) {
              micErrorRef.current = 'mediaDevices-missing';
              return false;
            }
            probe('mic:start');
            const started = Date.now();
            const stream = await media.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            micGrantedRef.current = true;
            micErrorRef.current = '';
            micBlockedRef.current = false;
            probe('mic:ok', { ms: Date.now() - started });
            return true;
          } catch (error) {
            micGrantedRef.current = false;
            micErrorRef.current = (error && error.name) || 'microphone-failed';
            probe('mic:error', {
              name: micErrorRef.current,
              message: String(error && error.message).slice(0, 120),
            });
            return false;
          } finally {
            micPendingRef.current = null;
          }
        })();
        micPendingRef.current = run;
        return run;
      }, [probe]);

      // MediaRecorder-free capture: raw PCM through WebAudio, encoded as WAV so
      // the host's SenseVoice provider can transcribe it. Used when Web Speech
      // refuses to run (no Google service, or a denied WebView).
      const startRecording = useCallback(async () => {
        if (recorderRef.current) return true;
        try {
          const media = navigator.mediaDevices;
          if (!media?.getUserMedia) throw new Error('media-devices-missing');
          const stream = await media.getUserMedia({ audio: true });
          micGrantedRef.current = true;
          const Ctor = window.AudioContext || window.webkitAudioContext;
          const audio = new Ctor({ sampleRate: 16000 });
          if (audio.state === 'suspended') await audio.resume?.().catch(() => {});
          // A page opened by a navigation (the browser entry) has no user
          // gesture yet, and Chrome keeps the context suspended: capture would
          // silently record nothing. Ask for the tap the orb already offers.
          if (audio.state !== 'running') {
            await audio.close?.().catch?.(() => {});
            stream.getTracks().forEach((track) => track.stop());
            setRecordFallback(true);
            setPhaseSafe('idle');
            setError('点一下球开始说话（浏览器要求一次点击才允许录音）。');
            probe('rec:suspended');
            return false;
          }
          const source = audio.createMediaStreamSource(stream);
          const processor = audio.createScriptProcessor(4096, 1, 1);
          const chunks = [];
          const startedAt = Date.now();
          let heardVoice = false;
          let lastVoiceAt = 0;
          processor.onaudioprocess = (event) => {
            const input = event.inputBuffer.getChannelData(0);
            chunks.push(new Float32Array(input));
            const now = Date.now();
            if (now - startedAt < 250) return;
            let sum = 0;
            for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
            const rms = Math.sqrt(sum / Math.max(1, input.length));
            if (rms > 0.015) {
              heardVoice = true;
              lastVoiceAt = now;
            } else if (heardVoice && now - lastVoiceAt > 1400) {
              heardVoice = false;
              if (phaseRef.current === 'listening') void stopRecordingRef.current?.();
            } else if (now - startedAt > 60000) {
              if (phaseRef.current === 'listening') void stopRecordingRef.current?.();
            }
          };
          source.connect(processor);
          processor.connect(audio.destination);
          recorderRef.current = { stream, audio, source, processor, chunks };
          micBlockedRef.current = false;
          setRecordFallback(true);
          setError('');
          setPhaseSafe('listening');
          probe('rec:start');
          return true;
        } catch (error) {
          setError(`录音失败（${(error && error.name) || 'error'}），可以直接打字。`);
          probe('rec:error', { name: (error && error.name) || 'error' });
          return false;
        }
      }, [probe, setPhaseSafe]);

      const discardRecording = useCallback(() => {
        const rec = recorderRef.current;
        if (!rec) return;
        recorderRef.current = null;
        try {
          rec.processor?.disconnect?.();
          rec.source?.disconnect?.();
          rec.stream?.getTracks?.().forEach((track) => track.stop());
          rec.audio?.close?.().catch?.(() => {});
        } catch {
          /* already gone */
        }
      }, []);

      const stopRecording = useCallback(async () => {
        const rec = recorderRef.current;
        if (!rec) return;
        recorderRef.current = null;
        try {
          rec.processor.disconnect();
          rec.source.disconnect();
          rec.stream.getTracks().forEach((track) => track.stop());
        } catch {
          /* already gone */
        }
        setPhaseSafe('thinking');
        try {
          const total = rec.chunks.reduce((sum, part) => sum + part.length, 0);
          const pcm = new Float32Array(total);
          let offset = 0;
          for (const part of rec.chunks) {
            pcm.set(part, offset);
            offset += part.length;
          }
          const wav = encodeWav(pcm, rec.audio.sampleRate || 16000);
          await rec.audio.close().catch(() => {});
          probe('rec:upload', { bytes: wav.length });
          const result = await api('/whalego/transcribe', {
            method: 'POST',
            body: JSON.stringify({ audio: toBase64(wav), language: 'zh' }),
          });
          const text = String(result?.text ?? '').trim();
          if (!text) {
            setError('没听清，再点球说一次，或直接打字。');
            setPhaseSafe('idle');
            return;
          }
          setRecordFallback(true);
          void send(text);
        } catch (error) {
          setError(`转写失败（${(error && error.name) || 'error'}），可以直接打字。`);
          setPhaseSafe('idle');
          probe('rec:error', { name: (error && error.name) || 'error' });
        }
      }, [probe, send, setPhaseSafe]);

      startRecordingRef.current = startRecording;
      stopRecordingRef.current = stopRecording;
      discardRecordingRef.current = discardRecording;

      const beginListening = useCallback((quiet = false, force = false) => {
        if (micBlockedRef.current && !force) {
          setError('麦克风权限还没打开。允许后点球重试，或直接在下面输入框打字。');
          return false;
        }
        if (force) micBlockedRef.current = false;
        const started = startListening(quiet, force);
        if (!started) {
          if (micGrantedRef.current) {
            setError('');
            void startRecording();
            return true;
          }
          setError(speech()
            ? '麦克风没能启动。请允许麦克风权限后点球重试，或直接在下面输入框打字。'
            : '这台浏览器不支持语音输入，请在下面输入框打字，我会用语音回答。');
          return false;
        }
        setError('');
        return true;
      }, [startListening, startRecording]);

      // Unmuting (or reopening a running turn) re-arms the ear without changing
      // a speaking/thinking orb; when idle, enter listening visibly.
      useEffect(() => {
        if (muted || !mode || !open) return;
        const busy = phaseRef.current === 'speaking' || phaseRef.current === 'thinking';
        if (!recogRef.current && !recorderRef.current && !micBlockedRef.current) beginListening(busy);
      }, [beginListening, mode, muted, open]);

      const openSpace = useCallback(() => {
        openedAtRef.current = Date.now();
        probe('open');
        playerRef.current?.unlock();
        playChime('open');
        setOpen(true);
        setCompact(false);
        requestAnimationFrame(() => orbRef.current?.focus?.({ preventScroll: true }));
        // Reopening while a turn is still running must not wipe its answer or
        // replace a recogniser that is already running; but if the mic was
        // stopped on collapse, silently reopen the ear so barge-in still works.
        if (phaseRef.current === 'speaking' || phaseRef.current === 'thinking') {
          if (!recogRef.current && !recorderRef.current && !mutedRef.current && !micBlockedRef.current) {
            void primeMic().then(() => beginListening(true, true));
          }
          return;
        }
        setAnswer('');
        setWritten('');
        setSpoken('');
        setSpokenLines([]);
        setYou('');
        setInterim('');
        setError('');
        setTyped('');
        setPhaseSafe('idle');
        sessionRef.current = '';
        mutedRef.current = false;
        setMuted(false);
        setMode(true);
        void ensureSession().then((sessionId) => {
          sessionRef.current = sessionId;
        });
        // Start recognition synchronously when available so iOS/Web Speech keeps
        // the user gesture, while primeMic() triggers the system permission
        // dialog and enables the SenseVoice recording fallback once granted.
        let settled = false;
        const promptTimer = setTimeout(() => {
          if (settled || recogRef.current || recorderRef.current) return;
          if (!beginListening(false, true)) {
            setError('请在浏览器弹窗中点击「允许」麦克风权限，或直接在下面输入框打字。');
          }
        }, 1200);
        void primeMic().then((ok) => {
          settled = true;
          clearTimeout(promptTimer);
          if (ok) {
            setError('');
            if (!recogRef.current && !recorderRef.current) {
              beginListening(false, true);
            } else if (phaseRef.current === 'idle') {
              setPhaseSafe('listening');
            }
            return;
          }
          if (!recogRef.current && !recorderRef.current) {
            if (!beginListening(false, true) && micErrorRef.current && micErrorRef.current !== 'mediaDevices-missing') {
              setError(`麦克风请求失败（${micErrorRef.current}），点球可重试，或直接在下面输入框打字。`);
            }
          } else if (phaseRef.current === 'idle' && !micBlockedRef.current) {
            setPhaseSafe('listening');
          }
        });
      }, [beginListening, primeMic, setPhaseSafe]);

      // The native composer trigger dispatches these instead of owning our state.
      useEffect(() => {
        const openHandler = () => openSpace();
        const endHandler = () => endSession();
        const toggleHandler = () => {
          // Only a visible page counts as "open": a stuck mode flag used to
          // swallow the tap and look like a dead button.
          if (openRef.current) endSession();
          else openSpace();
        };
        window.addEventListener('whalego:open', openHandler);
        window.addEventListener('whalego:end', endHandler);
        window.addEventListener('whalego:toggle', toggleHandler);
        return () => {
          window.removeEventListener('whalego:open', openHandler);
          window.removeEventListener('whalego:end', endHandler);
          window.removeEventListener('whalego:toggle', toggleHandler);
        };
      }, [openSpace, endSession]);

      // A browser-bridge redirect lands here as `/?whale=1`: open the voice
      // space automatically, then strip the query parameter so refresh stays clean.
      useEffect(() => {
        if (typeof location === 'undefined' || !/[?&]whale=1/.test(location.search)) return;
        // A fresh browser profile has not chosen a workspace yet, so DSH shows
        // its inert "choose a workspace" composer and there is nothing to talk
        // into. Ask the host for this project's session, remember it the same
        // way the WebUI does, and come back once the page can send.
        try {
          const raw = localStorage.getItem('dsh.sessions.current');
          let chosen = false;
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            chosen = Boolean(parsed && (parsed.sessionId || parsed.id));
          } catch {
            chosen = Boolean(raw && raw !== '{}');
          }
          if (!chosen && !sessionStorage.getItem('whalego-landed')) {
            sessionStorage.setItem('whalego-landed', '1');
            void (async () => {
              try {
                const found = await api('/whalego/session');
                if (found?.sessionId) {
                  localStorage.setItem('dsh.sessions.current', JSON.stringify({ sessionId: found.sessionId }));
                  location.reload();
                  return;
                }
              } catch {
                /* fall through to the plain voice space */
              }
              openSpace();
            })();
            return;
          }
        } catch {
          /* storage blocked: open the space as-is */
        }
        try {
          const url = new URL(location.href);
          url.searchParams.delete('whale');
          history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } catch {
          /* ignore */
        }
        openSpace();
      }, [openSpace]);

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
      // Measure even while collapsed: the mini orb also sits above the
      // composer and must follow it when the keyboard changes its height.
      useEffect(() => {
        if (!mode) return undefined;
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
          let inset = Math.max(84, Math.round(bottom - top) + 6);
          const applyInset = (px) => {
            const value = `${px}px`;
            if (host && host.style.getPropertyValue('--wg-composer') !== value) {
              host.style.setProperty('--wg-composer', value);
            }
          };
          applyInset(inset);
          // Browsers disagree about which viewport `position:fixed` uses when
          // the keyboard opens. Compare the two rendered rects and correct once
          // if the page still overlaps or leaves too large a gap.
          const space = host?.querySelector?.('.wg-space');
          if (space?.getAttribute('data-open') === 'true') {
            const gap = node.getBoundingClientRect().top - space.getBoundingClientRect().bottom;
            if (gap < 2 || gap > 16) {
              inset = Math.max(84, Math.round(inset + 6 - gap));
              applyInset(inset);
            }
          }
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
      }, [mode]);

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
            if (!claimToggle()) return;
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
                'data-dock': thinkOrb,
                type: 'button',
                'aria-label': '打开语音对话',
                onContextMenu: (event) => {
                  event.preventDefault();
                  toggleThinkOrb();
                },
                onClick: openSpace,
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
      // Both tracks grow from the bottom: the revealed spoken lines and the
      // streaming written answer must keep their newest words in view.
      useEffect(() => {
        const caption = captionRef.current;
        if (caption) caption.scrollTop = caption.scrollHeight;
      }, [spokenLines]);
      useEffect(() => {
        const box = writtenNodeRef.current;
        if (box) box.scrollTop = box.scrollHeight;
      }, [written]);
      const optionGroup = (label, options, value, key) =>
        h(
          'div',
          { className: 'wg-group' },
          h('div', { className: 'wg-group-label' }, label),
          h(
            'div',
            { className: 'wg-chips' },
            options.map(([id, text]) =>
              h(
                'button',
                {
                  key: id,
                  type: 'button',
                  className: 'wg-chip',
                  'data-on': value === id ? 'true' : 'false',
                  onClick: () => savePref(key, id),
                },
                text,
              ),
            ),
          ),
        );

      const veiled = compact && (phase === 'speaking' || phase === 'thinking') && !typed;
      const spokenTrack = spokenLines.length ? spokenLines.join(' ') : spoken;
      const hasBothTracks = Boolean(spokenTrack && written);

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
            'data-veil': veiled ? 'true' : 'false',
            'data-ab': hasBothTracks ? 'true' : 'false',
            role: 'dialog',
            'aria-modal': 'false',
            'aria-label': 'WhaleGo 语音对话',
            'aria-hidden': open && mode ? 'false' : 'true',
            onClick: (event) => {
              if (compact) return;
              // The tap that opened the page can land on the freshly mounted
              // surface; never treat it as "leave".
              if (Date.now() - openedAtRef.current < 600) return;
              if (
                event.target?.closest?.(
                  'button, [role="button"], .wg-orb, .wg-ab, .wg-caption, .wg-written, .wg-sheet, .wg-error',
                )
              ) {
                return;
              }
              // Tapping empty space leaves the full view; the turn keeps going
              // behind the mini orb.
              collapse();
            },
          },
          settingsOpen && !compact
            ? h(
                'div',
                { className: 'wg-sheet' },
                h(
                  'div',
                  { className: 'wg-sheet-head' },
                  h('span', null, '鲸语设置'),
                  h(
                    'button',
                    {
                      className: 'wg-round',
                      type: 'button',
                      'aria-label': '关闭设置',
                      onClick: () => setSettingsOpen(false),
                    },
                    '✕',
                  ),
                ),
                optionGroup('模式', [['auto', '自动'], ['dual', '双脑'], ['voice', '只语音'], ['read', '朗读']], prefs.mode, 'mode'),
                optionGroup('音色', [['zh-CN-XiaoxiaoNeural', '晓晓'], ['zh-CN-YunxiNeural', '云希'], ['zh-CN-XiaoyiNeural', '晓伊']], prefs.voice, 'voice'),
                optionGroup('语速', [['slow', '慢'], ['normal', '正常'], ['fast', '快']], prefs.rate, 'rate'),
                optionGroup('思考时球', [['corner', '右下角'], ['center', '底部中央']], prefs.thinkOrb ?? thinkOrb, 'thinkOrb'),
                optionGroup('浏览器模式', [['on', '开启'], ['off', '隐藏']], prefs.browserEntry ?? 'on', 'browserEntry'),
                (prefs.browserEntry ?? 'on') !== 'off'
                  ? h(
                      'div',
                      { className: 'wg-group' },
                      h(
                        'div',
                        { className: 'wg-group-label' },
                        `入口 127.0.0.1:${browserMode.port || 3099}${browserMode.running === false ? '（未启动）' : ''}`,
                      ),
                      h(
                        'div',
                        { className: 'wg-chips' },
                        h(
                          'button',
                          {
                            className: 'wg-chip',
                            type: 'button',
                            onClick: () => {
                              const url = browserEntryUrl(browserMode.port || 3099);
                              navigator.clipboard?.writeText(url).then(
                                () => setToast('地址已复制'),
                                () => setToast(url),
                              );
                              window.setTimeout(() => setToast(''), 1800);
                            },
                          },
                          '复制地址',
                        ),
                        h(
                          'button',
                          {
                            className: 'wg-chip',
                            type: 'button',
                            onClick: () => openBrowserEntry(browserMode.port || 3099),
                          },
                          '在浏览器打开',
                        ),
                      ),
                    )
                  : null,
                h(
                  'div',
                  { className: 'wg-group-label', style: { marginTop: '14px', opacity: 0.7 } },
                  `视口 ${typeof window === 'undefined' ? 0 : window.innerWidth} / 文档 ${typeof document === 'undefined' ? 0 : document.documentElement.clientWidth} · v${pluginVersion || '?'} · client ${CLIENT_BUILD}`,
                ),
              )
            : null,
          h('div', { className: 'wg-veil', key: 'veil', 'aria-hidden': 'true' }),
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
            h(
              'div',
              {
                className: 'wg-round wg-settings-btn',
                role: 'button',
                tabIndex: 0,
                'aria-label': '鲸语设置',
                onClick: () => setSettingsOpen((value) => !value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSettingsOpen((value) => !value);
                  }
                },
              },
              h(
                'svg',
                { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
                h('circle', { cx: 12, cy: 12, r: 3.2, stroke: 'currentColor', strokeWidth: 1.8 }),
                h('path', {
                  d: 'M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6',
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
                ref: orbRef,
                role: 'button',
                tabIndex: 0,
                'aria-label': compact ? '展开语音界面' : '语音输入',
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleThinkOrb();
                },
                onClick: (event) => {
                  event.stopPropagation();
                  playerRef.current?.unlock();
                  // The tap that opened the page can land on the orb that just
                  // appeared under the finger; ignore it.
                  if (Date.now() - openedAtRef.current < 320) return;
                  if (recordFallback) {
                    if (recorderRef.current) {
                      void stopRecording();
                      return;
                    }
                    if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
                      void startRecording();
                      return;
                    }
                  }
                  if (!compact && error) {
                    // The orb is the retry button after a failed mic or stream.
                    setError('');
                    micBlockedRef.current = false;
                    void primeMic().then((ok) => {
                      if (!beginListening(false, true) && ok) void startRecording();
                    });
                    beginListening(false, true);
                    return;
                  }
                  const current = phaseRef.current;
                  if (compact) {
                    setCompact(false);
                    if (current === 'speaking' || current === 'thinking') {
                      // Tapping the small orb means "my turn": stop the answer,
                      // come back to the big orb, then listen. Start the mic in
                      // the same tap — iOS rejects a start deferred by a timer.
                      cancel();
                      beginListening(false, true);
                    } else if (current === 'idle' || current === 'done') beginListening(false, true);
                    return;
                  }
                  if (current === 'listening' || current === 'speaking' || current === 'thinking') {
                    // Collapsing is only useful once there is a line to read.
                    // On the empty home screen the hero sits right where the
                    // mini orb would land, so stop listening and stay full.
                    // With a conversation the mic stays open — shrinking the
                    // orb must not turn full duplex back into half duplex.
                    const hasChat =
                      Boolean(you || answer || typed) || !document.querySelector('[class*="composerHero"]');
                    if (hasChat) setCompact(true);
                    else stopListening();
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
                  void primeMic();
                  beginListening(false, true);
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
          veiled && (spokenLines.length || written)
            ? h(
                'div',
                { className: 'wg-lines', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'false' },
                spokenLines.map((line, index) => h('p', { key: `${index}-${line}` }, line)),
                written ? h('div', { className: 'wg-lines-written', key: 'written' }, written) : null,
              )
            : null,
          !compact && !veiled && ((spokenTrack && !interim) || written)
            ? h(
                'div',
                { className: 'wg-ab' },
                spokenTrack && !interim
                  ? h(
                      'div',
                      {
                        className: 'wg-caption',
                        'data-show': 'true',
                        'aria-live': 'polite',
                        'aria-atomic': 'true',
                        ref: captionRef,
                      },
                      spokenLines.length
                        ? spokenLines.map((line, index) => h('p', { key: `${index}-${line}` }, line))
                        : spokenTrack,
                    )
                  : null,
                written
                  ? h(
                      'div',
                      { className: 'wg-written', 'data-show': 'true', 'aria-live': 'polite' },
                      h(
                        'div',
                        { className: 'wg-written-head' },
                        h('span', { className: 'wg-written-dot', 'aria-hidden': 'true' }),
                        h('span', null, '文字脑'),
                      ),
                      h('div', { className: 'wg-written-body', ref: writtenNodeRef }, written),
                    )
                  : null,
              )
            : null,
          h('div', { className: 'wg-heard', 'data-show': interim ? 'true' : 'false' }, interim),
          (phase === 'listening' || phase === 'thinking') && !interim && !spokenTrack && !written
            ? h(
                'div',
                { className: 'wg-phasechip', key: 'phasechip', role: 'status' },
                h('span', { className: 'wg-phasechip-dot', 'aria-hidden': 'true' }),
                phaseLabel,
              )
            : null,
          h('div', { className: 'wg-sr', 'aria-live': 'polite' }, phaseLabel),
          recordFallback && phase === 'idle' && !compact
            ? h('div', { className: 'wg-hint-note' }, '点球开始录音，再点一次结束')
            : null,
          toast ? h('div', { className: 'wg-toast', role: 'status' }, toast) : null,
          error && /麦克风/.test(error) && (prefs.browserEntry ?? 'on') !== 'off' && !compact
            ? h(
                'button',
                {
                  className: 'wg-chip wg-error-action',
                  type: 'button',
                  onClick: (event) => {
                    event.stopPropagation();
                    openBrowserEntry(browserMode.port || 3099);
                  },
                },
                '在浏览器打开语音',
              )
            : null,
          error ? h('div', { className: 'wg-error', role: 'alert' }, error) : null,
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
    let headerMounted = false;

    /** Two header entries: open the in-app voice page, or the browser one. */
    function mountHeaderActions(ctx) {
      try {
        const slots = ctx?.slots;
        if (!slots || typeof slots.register !== 'function') return false;
        const HeaderActions = () => {
          const [port, setPort] = useState(0);
          useEffect(() => {
            let cancelled = false;
            void (async () => {
              try {
                const res = await fetch('/whalego/health', { credentials: 'same-origin' });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled || data?.prefs?.browserEntry === 'off') return;
                setPort(Number(data?.browser?.port) || 3099);
              } catch {
                /* no browser entry */
              }
            })();
            return () => {
              cancelled = true;
            };
          }, []);
          const webui = h(
            'button',
            {
              className: 'wg-head-btn',
              type: 'button',
              'aria-label': '打开鲸语语音页',
              title: '鲸语语音页',
              onClick: () => window.dispatchEvent(new CustomEvent('whalego:open')),
            },
            h(
              'svg',
              { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
              h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 3, stroke: 'currentColor', strokeWidth: 1.7 }),
              h('path', { d: 'M8 10h8M8 14h5', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
            ),
          );
          const browser = port
            ? h(
                'button',
                {
                  className: 'wg-head-btn',
                  type: 'button',
                  'aria-label': '在浏览器里使用语音',
                  title: '在浏览器里用语音',
                  onClick: () => openBrowserEntry(port),
                },
                h(
                  'svg',
                  { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
                  h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', strokeWidth: 1.7 }),
                  h('path', {
                    d: 'M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18',
                    stroke: 'currentColor',
                    strokeWidth: 1.5,
                  }),
                ),
              )
            : null;
          return h('div', { className: 'wg-head-actions' }, webui, browser);
        };
        const register = () => {
          try {
            const dispose = slots.register(
              { name: 'conversation.session.header.actions', locale: 'zh-CN' },
              HeaderActions,
            );
            headerMounted = true;
            return dispose;
          } catch {
            headerMounted = false;
            return () => {};
          }
        };
        if (typeof slots.inject === 'function') {
          slots.inject('conversation.session.header.actions', () => register());
        } else {
          register();
        }
        return headerMounted;
      } catch {
        return false;
      }
    }

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
          const [browserPort, setBrowserPort] = useState(0);
          useEffect(() => {
            let cancelled = false;
            void (async () => {
              try {
                const res = await fetch('/whalego/health', { credentials: 'same-origin' });
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled || data?.prefs?.browserEntry === 'off') return;
                setBrowserPort(Number(data?.browser?.port) || 3099);
              } catch {
                /* no browser entry */
              }
            })();
            return () => {
              cancelled = true;
            };
          }, []);
          return h(
            React.Fragment,
            null,
            browserPort && !headerMounted
              ? h(
                  'button',
                  {
                    className: 'wg-slot-browser',
                    type: 'button',
                    'aria-label': '在浏览器里使用语音',
                    title: '在浏览器里用语音（麦克风只在浏览器可用）',
                    onClick: () => openBrowserEntry(browserPort),
                  },
                  h(
                    'svg',
                    { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
                    h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', strokeWidth: 1.7 }),
                    h('path', {
                      d: 'M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18',
                      stroke: 'currentColor',
                      strokeWidth: 1.5,
                    }),
                  ),
                )
              : null,
            h(
            'button',
            {
              className: 'wg-slot',
              type: 'button',
              'data-mode': on ? 'on' : 'off',
              'aria-label': on ? '结束语音对话' : '开始语音对话',
              onClick: () => {
                if (!claimToggle()) return;
                // Let the page decide from its own state: the slot's props and
                // even the dataset can lag behind a failed open.
                window.dispatchEvent(new CustomEvent('whalego:toggle'));
              },
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
            ),
          );
        };
        const register = () => {
          try {
            return slots.register({ name: 'conversation.input.activity', locale: 'zh-CN' }, SlotTrigger);
          } catch {
            // The host keeps one registration per slot; a second mount (page
            // restore, hot reload) must not take the whole client down.
            return () => {};
          }
        };
        if (typeof slots.inject === 'function') {
          slots.inject('conversation.input.activity', () => register());
        } else {
          register();
        }
        return true;
      } catch {
        return false;
      }
    }

    function report(event, extra = {}) {
      try {
        fetch('/whalego/probe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event, ...extra }),
        }).catch(() => {});
      } catch {
        /* diagnostics only */
      }
    }

    // ===== BEGIN vendored dsh-orb client (MIT) =====
    // Source: dsh-orb@0.2.0 client.js (github.com/mini-yifan/dsh-orb-cordis).
    // Embedded instead of registered as a second browser module: DSH serves
    // one module per package, and an embedded factory cannot collide with a
    // hot reload re-registering the same id. See vendor/dsh-orb/LICENSE.
    const __orbUi = (() => {

    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const zh = {
      nav: '悬浮球',
      intro: '更改写入当前配置。',
      linux: '悬浮球在 Linux 上不可用。',
      error: '无法加载悬浮球设置。',
      saveError: '无法保存。',
      helperFailedTitle: '悬浮球没能启动',
      helperFailed: '悬浮球多次退出，已经停止重试。点「重试」立刻再拉起一次。',
      runtimeFailedTitle: '悬浮球运行时下载失败',
      runtimeFailed: '下载没有完成，所以球没有出现。点「重新下载」立即接着下——已经下好的部分不会重来，也不用重启应用。',
      permissionFallback: '权限设置无法读取，已改为工作区内修改。',
      retry: '重试',
      redownload: '重新下载',
      ball: '启用悬浮球',
      ballDescription: '关闭后插件仍在，Computer Use 仍可在主窗口使用。',
      avatarTitle: '悬浮球头像',
      avatarDescription: '点一张内置动图，或选择自己的图片。上传支持 GIF、PNG、WebP，{limit} MB 以内。',
      avatarAlt: '悬浮球头像预览',
      avatarBuiltin: '内置动图',
      avatarMore: '更多动图',
      avatarMoreHint: '在图库 dshgif.hicp.fun 里浏览并下载更多动图',
      avatarPresetNames: {
        point: '指点',
        rice: '干饭',
        heart: '比心',
        cheer: '欢呼',
        cheeks: '托腮',
        smile: '微笑',
      },
      chooseImage: '选择图片',
      restoreDefault: '恢复默认',
      tooLarge: '图片超过 {limit} MB。',
      tooLargeSize: '图片 {size} MB，超过 {limit} MB 上限。',
      unreadable: '读不到这个文件，请重新选择一次。',
      invalidType: '请选择 GIF、PNG 或 WebP 图片。',
      overlayTitle: '悬浮球 Agent',
      overlayDescription: '悬浮球 Computer Use 会话使用的模型与思考强度。',
      backgroundTitle: '后台 Agent',
      backgroundDescription: '新建后台 code_agent 会话使用的模型与思考强度。',
      emptyCatalog: '暂无可用模型。',
      modelLabel: '模型',
      reasoningLabel: '思考强度',
      millifractionTitle: '千分比坐标',
      millifractionDescription: '新建对话使用截图的 0–1000 比例。关闭后使用已附加图片的像素。更改此项会新建对话。',
      millifractionToggle: '使用千分比坐标',
      millifractionConfirm: '新编码只在新对话中生效。当前对话不变，仍可从历史记录打开。取消不写入、不新建。',
      frameTitle: '观察框彩带',
      frameDescription: 'Computer Use 操作某个窗口时，窗口周围显示这条彩带。关闭后不再显示。',
      frameToggle: '显示观察框彩带',
      runtimePreparingTitle: '正在下载悬浮球运行时',
      runtimePreparing: '首次使用需要下载约 124–150 MB 的运行时，完成后悬浮球会自动出现。下载被中断或长时间不动时，点「重新下载」立即接着下。',
      whatsNew: {
        id: '0.2.0',
        title: '悬浮球 0.2.0 更新',
        lead: '这次更新带来语音能力，并修复 Windows 首次安装运行时下载失败的问题。语音默认关闭，可在本页开启。',
        items: [
          'Windows 首次安装修复：全新安装不再卡在「运行时下载完成却解压失败」；升级后重启即可，已经下载的部分不会重下。',
          '语音唤醒与输入：喊「你好大肥鱼」唤醒，球回「我在呢」；固定且空闲时直接说话下指令。',
          '语音播报与插话：回复可用本地音色或千问播报；播报中说「大肥鱼」可插话，说「退下吧」停止。',
          '语音模型下载：唤醒模型约 9 MB（npm / npmmirror），本地播报模型约 197 MB（Hugging Face 镜像）；设置页可看进度。',
        ],
        dismiss: '知道了',
        close: '关闭更新公告',
      },
      tccTitle: 'Mac 权限',
      tccDescription: 'Computer Use 需要屏幕录制与辅助功能。点按钮打开系统设置对应页。',
      tccAppHint: '在列表里打开 {name}。',
      tccScreenName: '屏幕录制',
      tccScreenReason: '让 agent 看见当前窗口。',
      tccScreenPath: '系统设置 → 隐私与安全性 → 屏幕录制',
      tccScreenOpen: '打开「屏幕录制」设置',
      tccAccessibilityName: '辅助功能',
      tccAccessibilityReason: '让 agent 点击和输入。',
      tccAccessibilityPath: '系统设置 → 隐私与安全性 → 辅助功能',
      tccAccessibilityOpen: '打开「辅助功能」设置',
      tccMissing: '未开启',
      tccGranted: '已开启',
      tccRelaunch: '已开启，请退出后重开',
      tccFooter: '打开开关后必须完全退出 {name} 再打开。只关主窗口无效。',
      updateTitle: '插件更新',
      updateCurrent: '当前版本 {version}。',
      updateAvailable: '新版本 {version} 可用。',
      updateNow: '更新',
      updating: '正在更新到 {version}…',
      updateDone: '已更新到 {version}，重启 {name} 后生效。',
      updateDeferred: '{version} 将在退出 {name} 后自动安装，请完全退出后稍等片刻再重新打开。',
      updateInstalling: '更新正在安装中，安装完成前请不要退出 {name}。',
      updateFailed: '更新失败：',
      updateOffline: '无法连接镜像或 npm，请检查网络后重试。',
      updateBuildBlocked: '新版本依赖的安装脚本未获授权，安装已停止。',
      updateAlreadyInstalled: '当前 Harness 不允许覆盖已安装的插件，请在插件页移除后再安装新版本。',
      updateAllowBuilds: '允许安装脚本并重试',
      updateCheck: '检查更新',
      updateChecking: '正在检查…',
      updateAuto: '自动检查更新',
      updateAutoDescription: '每天一次向 npmmirror（失败回退 npm）查询新版本，不发送任何标识信息。',
      updateManual: '当前 Harness 没有提供插件管理服务，请在插件页手动更新。',
      workspaceTitle: 'Agent 工作区',
      workspaceDescription: '悬浮球 Agent 的新会话会创建在这里。切换后旧目录内容保持不变，也可以随时恢复默认工作区。',
      workspaceCurrent: '当前工作区：',
      workspaceDefault: '默认',
      workspaceCustom: '自定义',
      workspacePick: '选择…',
      workspacePicking: '选择中…',
      workspacePickFailed: '无法打开系统目录选择器。',
      workspacePickerUnavailable: '当前环境不支持系统目录选择。',
      workspaceUseDefault: '恢复默认工作区',
      workspaceChanged: '工作区已切换。',
      workspaceInvalidPath: '请输入绝对路径。',
      workspaceNotFound: '目录不存在。',
      workspaceNotDirectory: '这个路径不是目录。',
      workspaceNotEmpty: '目录不是空的，请选择一个空目录。',
      workspaceNotReadable: '无法读取这个目录，请检查权限。',
      workspaceRunning: '悬浮球当前会话正在运行，请等它结束后再修改。',
      workspaceCreateFailed: '切换工作区失败，请重试。',
      workspaceUnavailable: '当前 Harness 不支持修改工作区。',
      workspaceChanging: '正在切换…',
      workspaceDialogTitle: '切换 Agent 工作区',
      workspaceDialogBody: '工作区将从 {old} 改为 {new}。',
      workspaceDialogKeep: '旧工作区中的会话和文件会保持不变，不会被移动或删除。',
      workspaceDialogCancel: '取消',
      workspaceDialogConfirm: '确定',
      historyTitle: '旧会话清理',
      historyDescription: '超过保留期限的会话会自动清理到系统回收站，只处理悬浮球工作区。',
      historyRetention: '保留期限',
      historyForever: '永久保留',
      historyDaysOption: '{days} 天',
      historyWorkspace: '工作区：{path}',
      historyRestoreHint: '在系统废纸篓/回收站放回会话文件夹即可恢复；恢复后的会话不会再被自动清理。',
      historyWarning: '有 {count} 个悬浮球会话无法读取，本次只清理了会话目录，截图暂时保留。',
      historyDialogTitle: '修改保留期限',
      historyDialogScanning: '正在扫描超过 {days} 天的会话…',
      historyDialogRetry: '重试',
      historyDialogDelete: '确认后，将把 {count} 个会话清理到系统回收站。',
      historyDialogNoDelete: '当前没有超过 {days} 天的会话需要立即清理。',
      historyDialogKeep: '以后只保留最近 {days} 天的会话。',
      historyDialogForever: '确认后改为永久保留，不再自动清理会话，也不会删除任何内容。',
      historyDialogMore: '还有 {count} 个会话…',
      historyDialogUnnamed: '未命名会话',
      historyDialogCancel: '取消',
      historyDialogConfirm: '确定',
      historyPreviewFailed: '无法计算要清理的会话，请重试。',
      historyLast: '上次清理：{sessions} 个会话。',
      historyCleaning: '正在清理…',
      historyRestoring: '正在从系统回收站还原…',
      historyUnavailable: '当前 Harness 或系统回收站不支持清理会话。',
      historyFailed: '清理失败：',
      voiceTitle: '语音',
      voiceIntro: '唤醒、语音输入和播报可以单独关掉。模型还没准备好时，对应的一项不会发生。',
      voiceOffIntro: '打开总开关后，可以设置唤醒、语音输入和播报。',
      voiceMasterToggle: '启用语音',
      voiceMicBody: '没有拿到麦克风，唤醒和语音输入都不会发生。球的其他功能照常。',
      voiceMicOpen: '打开「麦克风」设置',
      voiceOn: '已开启',
      voiceOff: '已关闭',
      unitSeconds: '{value} 秒',
      unitMinutes: '{value} 分钟',
      unitMinuteSeconds: '{minutes} 分 {seconds} 秒',
      wakeTitle: '语音唤醒',
      wakeToggle: '语音唤醒',
      wakeDesc: '说一句唤醒词，悬浮球就会醒过来。',
      wakeThreshold: '灵敏度',
      wakeThresholdHint: '越低越容易被唤醒；环境吵时调高，可以减少误触发。',
      wakeScore: '增强分',
      wakeScoreHint: '给唤醒词加权的程度，环境吵时可适当调高。',
      wakeChunk: '判定粒度',
      wakeChunk8: '160 毫秒',
      wakeChunk16: '320 毫秒',
      wakeChunkHint: '每次判定的音频长度，越长越省电，反应稍慢。',
      wakeCooldown: '冷却（秒）',
      wakeCooldownHint: '一次唤醒后，这段时间内不再响应新的唤醒词。',
      wakeWords: '唤醒词',
      wakeWordsHint: '一行一条，留空表示不启用唤醒。',
      wakeReply: '唤醒后的回复语',
      downloadWake: '下载语音唤醒模型',
      commandTitle: '语音输入',
      commandToggle: '语音输入',
      commandDesc: '把说的话识别成文字交给悬浮球，也可以中途插话或让它退下。',
      interjectKeyword: '插话关键词',
      interjectHint: '按拼音匹配，同音字自动生效，不需要另填别名。',
      dismissPhrases: '退下口令',
      dismissHint: '两个字以上的口令按拼音匹配，同音字自动生效。',
      dismissReply: '退下后的回复语',
      downloadAsr: '启动 ASR 语音模型',
      ttsTitle: 'TTS',
      ttsToggle: 'TTS',
      ttsDesc: '回复时用语音念出来，可选本地模型或千问。',
      ttsBackend: '播报方式',
      ttsBackendLocal: '本地模型',
      ttsBackendQwen: '千问',
      qwenApiKey: '阿里云百炼 API Key',
      qwenApiKeyNote: '云端 TTS 使用阿里云百炼的千问语音合成，不是 DeepSeek API。',
      qwenApiKeyLink: '去百炼控制台获取 API Key',
      qwenApiKeyHint: '留空时不播报。',
      qwenVoice: '音色',
      qwenVoiceStandard: '普通话与多语种',
      qwenVoiceDialect: '方言',
      qwenSpeed: '语速',
      qwenSpeedHint: '0.5 最慢，2.0 最快。',
      questionPrompt: '提问提示语',
      questionPromptHint: '打开提问卡片时念这句话，留空则不播报。',
      ttsSpeed: '语速',
      ttsSpeedHint: '1.0 为原速，数值越大语速越快。',
      ttsVolume: '音量',
      ttsVolumeHint: '100% 为模型原始音量，最高可放大到 200%。',
      downloadTts: '下载 TTS 语音播报模型',
      idleTitle: '空闲后取消固定',
      idleDesc: '悬浮球被固定后，闲置一段时间会自动取消固定。',
      idleSeconds: '空闲时长（秒）',
      idleHint: '从最后一次操作悬浮球开始计算。',
      voiceWakeModel: '唤醒模型',
      voiceAsrModel: '识别模型',
      voiceTtsModel: '播报模型',
      voiceModelReady: '已就绪',
      voiceModelMissing: '未下载 · {size}',
      voiceModelDownloading: '正在下载…',
      voiceRedownload: '重新下载',
      modelMissingWake: '要下载语音唤醒模型。',
      modelMissingTts: '要下载 TTS 模型。',
      modelMissingAsr: '要启动 ASR 语音模型。',
      asrService: '当前 DeepSeek Harness 没有官方语音识别服务，插件不会自己另下一份。',
      modelPresent: '模型已经存在，不需要重新下载',
      voiceDownload: '下载',
      voiceCancel: '取消',
      voiceClose: '确定',
      voiceSource: '来源',
      voiceSize: '约 {size} MB',
      voiceProgress: '已下载 {percent}%',
    }
    const en = {
      nav: 'Floating ball',
      intro: 'Changes are saved in the current profile.',
      linux: 'The floating ball is not available on Linux.',
      error: 'Could not load floating-ball settings.',
      saveError: 'Could not save.',
      helperFailedTitle: 'The floating ball could not start',
      helperFailed: 'The floating ball exited too many times and stopped retrying. Retry starts it again right away.',
      runtimeFailedTitle: 'The floating-ball runtime download failed',
      runtimeFailed: 'The download did not finish, so no ball appeared. Download again picks up where it stopped — the bytes already here are kept, and no app restart is needed.',
      permissionFallback: 'The permission file could not be read. Access is now Workspace Write.',
      retry: 'Retry',
      redownload: 'Download again',
      ball: 'Enable the floating ball',
      ballDescription: 'Turning this off keeps the plugin loaded. Computer Use stays available in the main window.',
      avatarTitle: 'Ball image',
      avatarDescription: 'Pick a built-in animation, or choose your own image. Uploads accept GIF, PNG, and WebP up to {limit} MB.',
      avatarAlt: 'Floating-ball image preview',
      avatarBuiltin: 'Built-in animations',
      avatarMore: 'More animations',
      avatarMoreHint: 'Browse and download more animations from the dshgif.hicp.fun gallery',
      avatarPresetNames: {
        point: 'Point',
        rice: 'Rice',
        heart: 'Heart',
        cheer: 'Cheer',
        cheeks: 'Cheeks',
        smile: 'Smile',
      },
      chooseImage: 'Choose image',
      restoreDefault: 'Restore default',
      tooLarge: 'The image is larger than {limit} MB.',
      tooLargeSize: 'The image is {size} MB — over the {limit} MB limit.',
      unreadable: 'That file could not be read. Choose it again.',
      invalidType: 'Choose a GIF, PNG, or WebP image.',
      overlayTitle: 'Floating-ball Agent',
      overlayDescription: 'Model and reasoning effort for the ball\'s Computer Use session.',
      backgroundTitle: 'Background Agent',
      backgroundDescription: 'Model and reasoning effort for new background code_agent sessions.',
      emptyCatalog: 'No models available.',
      modelLabel: 'Model',
      reasoningLabel: 'Reasoning effort',
      millifractionTitle: 'Millifraction coordinates',
      millifractionDescription: 'New chats use 0–1000 fractions of the screenshot. Turn off to use pixels of the attached image. Changing this creates a new conversation.',
      millifractionToggle: 'Use millifraction coordinates',
      millifractionConfirm: 'The new encoding takes effect in a new conversation. The current conversation stays unchanged and remains in History. Cancel leaves the default and this chat as they are.',
      frameTitle: 'Observation ribbon',
      frameDescription: 'Draws the coloured ribbon around the window Computer Use is working on. Turn it off to hide it.',
      frameToggle: 'Show the observation ribbon',
      runtimePreparingTitle: 'Downloading the floating-ball runtime',
      runtimePreparing: 'The first launch downloads a ~124–150 MB runtime, then the ball appears on its own. If the download was interrupted or looks stuck, Download again picks it up from where it stopped.',
      whatsNew: {
        id: '0.2.0',
        title: 'Floating ball 0.2.0 update',
        lead: 'This release adds voice and fixes the Windows first-install runtime download failure. Voice is off by default; turn it on on this page.',
        items: [
          'Windows first-install fix: a fresh install no longer gets stuck after the runtime download; restart after upgrading — bytes already downloaded are kept.',
          'Wake and talk: say “你好大肥鱼” to wake the ball (it replies “我在呢”); when pinned and idle, speak a command directly.',
          'Spoken replies and interjection: hear replies through the local voice or Qwen; say “大肥鱼” to interject, “退下吧” to stop.',
          'Voice model downloads: the ~9 MB wake model comes from npm/npmmirror; the ~197 MB local voice model comes from the Hugging Face mirror; progress is shown here.',
        ],
        dismiss: 'Got it',
        close: 'Close update note',
      },
      tccTitle: 'Mac permissions',
      tccDescription: 'Computer Use needs Screen Recording and Accessibility. Each button opens that System Settings pane.',
      tccAppHint: 'In the list, turn on {name}.',
      tccScreenName: 'Screen Recording',
      tccScreenReason: 'Lets the agent see the current window.',
      tccScreenPath: 'System Settings → Privacy & Security → Screen Recording',
      tccScreenOpen: 'Open Screen Recording settings',
      tccAccessibilityName: 'Accessibility',
      tccAccessibilityReason: 'Lets the agent click and type.',
      tccAccessibilityPath: 'System Settings → Privacy & Security → Accessibility',
      tccAccessibilityOpen: 'Open Accessibility settings',
      tccMissing: 'Off',
      tccGranted: 'On',
      tccRelaunch: 'On — quit and reopen',
      tccFooter: 'After you turn the switches on, quit {name} fully, then open it again. Closing the main window does not quit.',
      updateTitle: 'Plugin update',
      updateCurrent: 'Version {version}.',
      updateAvailable: 'Version {version} is available.',
      updateNow: 'Update',
      updating: 'Updating to {version}…',
      updateDone: 'Updated to {version}. Restart {name} to apply it.',
      updateDeferred: '{version} installs once {name} quits. Quit it fully, wait a moment, then reopen it.',
      updateInstalling: 'The update is installing now. Do not quit {name} until it finishes.',
      updateFailed: 'Update failed: ',
      updateOffline: 'no registry could be reached. Check the network and try again.',
      updateBuildBlocked: 'A dependency of the new version needs install-script approval, so the install stopped.',
      updateAlreadyInstalled: 'This Harness build refuses to install over a plugin that is already installed. Remove it on the Plugins page, then install the new version.',
      updateAllowBuilds: 'Allow these scripts and retry',
      updateCheck: 'Check for updates',
      updateChecking: 'Checking…',
      updateAuto: 'Check for updates automatically',
      updateAutoDescription: 'Asks npmmirror once a day (falling back to npm) for the newest version. Nothing identifying is sent.',
      updateManual: 'This Harness build ships no plugin manager — update from the Plugins page instead.',
      workspaceTitle: 'Agent workspace',
      workspaceDescription: 'New floating-ball Agent conversations are created here. The old directory is left untouched, and you can restore the default workspace at any time.',
      workspaceCurrent: 'Current workspace: ',
      workspaceDefault: 'default',
      workspaceCustom: 'custom',
      workspacePick: 'Choose…',
      workspacePicking: 'Choosing…',
      workspacePickFailed: 'Could not open the system directory picker.',
      workspacePickerUnavailable: 'This environment cannot open a system directory picker.',
      workspaceUseDefault: 'Restore default workspace',
      workspaceChanged: 'Workspace changed.',
      workspaceInvalidPath: 'Enter an absolute path.',
      workspaceNotFound: 'The directory does not exist.',
      workspaceNotDirectory: 'That path is not a directory.',
      workspaceNotEmpty: 'The directory is not empty. Choose an empty directory.',
      workspaceNotReadable: 'The directory cannot be read. Check its permissions.',
      workspaceRunning: 'The floating-ball conversation is running. Wait for it to finish before changing the workspace.',
      workspaceCreateFailed: 'Could not change the workspace. Try again.',
      workspaceUnavailable: 'This Harness build cannot change the workspace.',
      workspaceChanging: 'Switching…',
      workspaceDialogTitle: 'Change Agent workspace',
      workspaceDialogBody: 'The workspace will change from {old} to {new}.',
      workspaceDialogKeep: 'Conversations and files in the old workspace stay unchanged; nothing is moved or deleted.',
      workspaceDialogCancel: 'Cancel',
      workspaceDialogConfirm: 'Confirm',
      historyTitle: 'Old conversations',
      historyDescription: 'Conversations past the retention period are moved to the system trash. Only the floating-ball workspace is cleaned.',
      historyRetention: 'Keep for',
      historyForever: 'Keep forever',
      historyDaysOption: '{days} days',
      historyWorkspace: 'Workspace: {path}',
      historyRestoreHint: 'Put a conversation folder back from the system trash to restore it; a restored conversation will not be cleaned automatically again.',
      historyWarning: '{count} floating-ball conversations could not be read. Their session folders were cleaned, but screenshots were kept for now.',
      historyDialogTitle: 'Change retention',
      historyDialogScanning: 'Scanning conversations older than {days} days…',
      historyDialogRetry: 'Retry',
      historyDialogDelete: 'This will move {count} conversations to the system trash.',
      historyDialogNoDelete: 'No conversations are older than {days} days right now.',
      historyDialogKeep: 'Afterwards only conversations from the last {days} days are kept.',
      historyDialogForever: 'Afterwards conversations are kept forever and will not be cleaned automatically. Nothing is deleted.',
      historyDialogMore: 'and {count} more conversations…',
      historyDialogUnnamed: 'Untitled conversation',
      historyDialogCancel: 'Cancel',
      historyDialogConfirm: 'Confirm',
      historyPreviewFailed: 'Could not calculate what to clean. Try again.',
      historyLast: 'Last cleanup: {sessions} conversations.',
      historyCleaning: 'Cleaning…',
      historyRestoring: 'Restoring from the system trash…',
      historyUnavailable: 'This Harness build or the system trash cannot clean up conversations.',
      historyFailed: 'Cleanup failed: ',
      voiceTitle: 'Voice',
      voiceIntro: 'Wake word, voice input, and speech can each be turned off. A column whose model is not ready does not run.',
      voiceOffIntro: 'Turn the master switch on to set up the wake word, voice input, and speech.',
      voiceMasterToggle: 'Enable voice',
      voiceMicBody: 'The microphone is not available, so wake word and voice input do not run. The rest of the ball still works.',
      voiceMicOpen: 'Open Microphone settings',
      voiceOn: 'On',
      voiceOff: 'Off',
      unitSeconds: '{value} s',
      unitMinutes: '{value} min',
      unitMinuteSeconds: '{minutes} min {seconds} s',
      wakeTitle: 'Wake word',
      wakeToggle: 'Wake word',
      wakeDesc: 'Say a wake word and the floating ball wakes up.',
      wakeThreshold: 'Sensitivity',
      wakeThresholdHint: 'Lower wakes more easily. Raise it in noisy rooms to cut false wakes.',
      wakeScore: 'Boost',
      wakeScoreHint: 'How strongly a wake word is boosted. Raise it in noisy rooms.',
      wakeChunk: 'Chunk',
      wakeChunk8: '160 ms',
      wakeChunk16: '320 ms',
      wakeChunkHint: 'Audio window per decision. Longer saves power and reacts a little slower.',
      wakeCooldown: 'Cooldown (seconds)',
      wakeCooldownHint: 'After one wake, new wake words are ignored for this long.',
      wakeWords: 'Wake words',
      wakeWordsHint: 'One per line. Empty means no wake word.',
      wakeReply: 'Reply after wake',
      downloadWake: 'Download wake-word model',
      commandTitle: 'Voice input',
      commandToggle: 'Voice input',
      commandDesc: 'Speech becomes text for the ball; you can also interject or dismiss it.',
      interjectKeyword: 'Interjection keyword',
      interjectHint: 'Matched by pinyin; homophones work automatically, no aliases needed.',
      dismissPhrases: 'Dismiss phrases',
      dismissHint: 'Phrases of two or more syllables match by pinyin; homophones work automatically.',
      dismissReply: 'Reply after dismiss',
      downloadAsr: 'Start ASR speech model',
      ttsTitle: 'TTS',
      ttsToggle: 'TTS',
      ttsDesc: 'Read replies aloud with the local model or Qwen.',
      ttsBackend: 'Speech backend',
      ttsBackendLocal: 'Local model',
      ttsBackendQwen: 'Qwen',
      qwenApiKey: 'Alibaba Cloud Bailian API Key',
      qwenApiKeyNote: 'Cloud TTS uses Qwen on Alibaba Cloud Bailian, not the DeepSeek API.',
      qwenApiKeyLink: 'Get an API key in Bailian',
      qwenApiKeyHint: 'Nothing is spoken while this is empty.',
      qwenVoice: 'Voice',
      qwenVoiceStandard: 'Mandarin and multilingual',
      qwenVoiceDialect: 'Dialects',
      qwenSpeed: 'Speed',
      qwenSpeedHint: '0.5 is slowest, 2.0 is fastest.',
      questionPrompt: 'Question prompt',
      questionPromptHint: 'Spoken when the question card opens. Empty means silence.',
      ttsSpeed: 'Speed',
      ttsSpeedHint: '1.0 is normal speed; higher speaks faster.',
      ttsVolume: 'Volume',
      ttsVolumeHint: '100% is the model\'s own level; up to 200% boosts it.',
      downloadTts: 'Download TTS speech model',
      idleTitle: 'Unpin after idle',
      idleDesc: 'While pinned, the ball unpins itself after this much idle time.',
      idleSeconds: 'Idle time (seconds)',
      idleHint: 'Counted from the last interaction with the ball.',
      voiceWakeModel: 'Wake model',
      voiceAsrModel: 'Recognition model',
      voiceTtsModel: 'Speech model',
      voiceModelReady: 'Ready',
      voiceModelMissing: 'Not downloaded · {size}',
      voiceModelDownloading: 'Downloading…',
      voiceRedownload: 'Download again',
      modelMissingWake: 'Download the wake-word model.',
      modelMissingTts: 'Download the TTS model.',
      modelMissingAsr: 'Start the ASR speech model.',
      asrService: 'This DeepSeek Harness has no official speech service, so the plugin will not download another copy.',
      modelPresent: 'The model is already present; there is no need to download it again.',
      voiceDownload: 'Download',
      voiceCancel: 'Cancel',
      voiceClose: 'OK',
      voiceSource: 'Source',
      voiceSize: 'about {size} MB',
      voiceProgress: '{percent}% downloaded',
    }

    // The community GIF gallery behind the "more animations" tile. It is a plain
    // outbound link: the desktop shell hands http(s) window opens to the system
    // browser, and a page served in a browser just opens a tab.
    const AVATAR_GALLERY_URL = 'https://dshgif.hicp.fun/'
    /** Alibaba Cloud Bailian (DashScope) API-key page; the cloud TTS is Qwen, not DeepSeek. */
    const BAILIAN_API_KEY_URL = 'https://bailian.console.aliyun.com/?apiKey=1#/api-key'

    /**
     * Upload cap, mirroring the host's MAX_AVATAR_BYTES. The check here is for the
     * message, not for safety: it turns a rejected upload into a sentence with the file's
     * own size in it, instead of a 413 the page can only report as "too large".
     */
    const AVATAR_MAX_BYTES = 4 * 1024 * 1024
    const AVATAR_MAX_MB = String(AVATAR_MAX_BYTES / (1024 * 1024))

    /** One decimal below 10 MB, whole numbers above: 3.4 MB, 12 MB. */
    function megabytes(bytes) {
      const value = bytes / (1024 * 1024)
      return value >= 10 ? value.toFixed(0) : value.toFixed(1)
    }

    // The main window's resolved locale rides <html lang> (dsh-client-locale);
    // a page without it falls back to the browser languages.
    function copy() {
      const lang = `${document.documentElement?.lang || ''}${navigator.language || ''}`
      return lang.toLowerCase().startsWith('zh') ? zh : en
    }

    function h(tag, props, ...children) {
      return React.createElement(tag, props, ...children)
    }

    async function request(path, options) {
      const response = await fetch(path, {
        cache: 'no-store',
        ...options,
        headers: {
          accept: 'application/json',
          ...(options && options.headers ? options.headers : {}),
        },
      })
      const text = await response.text()
      let body = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = { error: text.slice(0, 200) }
        }
      }
      if (!response.ok) {
        const error = new Error(body && body.error ? body.error : 'request failed')
        error.status = response.status
        throw error
      }
      return body
    }

    function findModel(catalog, selection) {
      const groups = catalog && catalog.groups ? catalog.groups : []
      for (const group of groups) {
        if (!selection || group.id !== selection.provider) continue
        for (const model of group.models || []) {
          if (model.id === selection.model) return model
        }
      }
      return undefined
    }

    function Toggle(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        className: `dsh-orb-set-switch${props.checked ? ' is-on' : ''}${props.locked ? ' is-locked' : ''}`,
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-disabled': props.locked ? 'true' : undefined,
        'aria-label': props.label,
        disabled: props.disabled,
        onClick: () => {
          if (props.disabled) return
          if (props.locked) {
            props.onLocked()
            return
          }
          props.onChange(!props.checked)
        },
      })
    }

    /**
     * Model and reasoning effort as two labelled fields. The page uses the same field
     * vocabulary as the voice panels, so a picker reads as one value among settings
     * rather than as a bare dropdown pinned to the card's edge.
     */
    function ModelPicker(props) {
      const text = copy()
      const groups = props.catalog && props.catalog.groups ? props.catalog.groups : []
      const current = props.current || { provider: '', model: '' }
      const value = `${current.provider}\u001f${current.model}`
      const known = findModel(props.catalog, current)
      const options = []
      if (!known && current.provider && current.model) {
        options.push(h('option', { key: value, value }, `${current.provider} / ${current.model}`))
      }
      for (const group of groups) {
        options.push(h('optgroup', { key: group.id, label: group.name },
          ...(group.models || []).map((model) => h('option', {
            key: `${group.id}\u001f${model.id}`,
            value: `${group.id}\u001f${model.id}`,
          }, model.name))))
      }
      const efforts = known && known.reasoning ? known.reasoning.efforts || [] : []
      return h('div', { className: 'dsh-orb-set-model-fields' },
        h('label', { className: 'dsh-orb-set-field' },
          h('span', { className: 'dsh-orb-set-field-label' }, text.modelLabel),
          h('span', { className: 'dsh-orb-set-select-wrap' },
            h('select', {
              className: 'dsh-orb-set-input',
              'aria-label': props.label,
              disabled: props.disabled || (options.length === 0),
              value: options.length === 0 ? '' : value,
              onChange: (event) => {
                const [provider, model] = String(event.target.value).split('\u001f')
                if (!provider || !model) return
                const next = findModel(props.catalog, { provider, model })
                const effort = next && next.reasoning ? next.reasoning.defaultEffort : undefined
                props.onSelect(effort ? { provider, model, reasoningEffort: effort } : { provider, model })
              },
            }, options.length === 0 ? h('option', { value: '' }, text.emptyCatalog) : options))),
        efforts.length === 0 ? null : h('label', { className: 'dsh-orb-set-field' },
          h('span', { className: 'dsh-orb-set-field-label' }, text.reasoningLabel),
          h('span', { className: 'dsh-orb-set-select-wrap' },
            h('select', {
              className: 'dsh-orb-set-input',
              'aria-label': text.reasoningLabel,
              disabled: props.disabled,
              value: current.reasoningEffort || known.reasoning.defaultEffort || efforts[0].id,
              onChange: (event) => {
                props.onSelect({ provider: current.provider, model: current.model, reasoningEffort: event.target.value })
              },
            }, efforts.map((effort) => h('option', { key: effort.id, value: effort.id }, effort.name || effort.id))))))
    }

    function statusText(text, state) {
      if (state === 'granted') return text.tccGranted
      if (state === 'needsRelaunch') return text.tccRelaunch
      return text.tccMissing
    }

    function OrbSettingsSection() {
      const text = copy()
      // Re-render when the app's locale changes (<html lang>), so every copy()
      // call in this section re-evaluates against the new language.
      const [, bumpLocale] = React.useState(0)
      React.useEffect(() => {
        if (typeof MutationObserver !== 'function' || !document.documentElement) return undefined
        const observer = new MutationObserver(() => { bumpLocale((count) => count + 1) })
        observer.observe(document.documentElement, { attributeFilter: ['lang'] })
        return () => { observer.disconnect() }
      }, [])
      const [state, setState] = React.useState({
        status: 'loading',
        error: '',
        snapshot: null,
        catalog: { groups: [] },
        busy: false,
        avatarError: '',
        /** Size of the file that failed the check, 0 when only the host knows it. */
        avatarSize: 0,
      })

      // Responses overtake each other: a focus-triggered load, a poll, and a save can all be
      // in flight. Every request takes a ticket, and a GET only lands while it is still the
      // newest request in line and no save has settled since it was sent — a stale GET can
      // neither undo a save nor be trusted for state the host changed after answering it.
      // Refs, not locals: the component body re-runs on every render, so a `let` here would
      // give the mount/poll closures and the click handlers different counters.
      const requestSeq = React.useRef(0)
      const saveSeq = React.useRef(0)
      const settledSaves = React.useRef(0)
      const openSaves = React.useRef(0)

      /** Place in line for one request, plus the save count it was sent with. */
      function takeTicket(isSave) {
        const ticket = { seq: ++requestSeq.current, saves: settledSaves.current, save: 0 }
        if (isSave) {
          openSaves.current += 1
          ticket.save = ++saveSeq.current
        }
        return ticket
      }

      /** Apply a GET response, unless a newer request started or a save settled after it. */
      function applyGet(ticket, next) {
        if (ticket.seq !== requestSeq.current || ticket.saves !== settledSaves.current) return
        setState(next)
      }

      /**
       * Settle a save: only the newest save that started writes its snapshot, and the
       * fieldset is re-enabled once no save is left in flight — even when this response
       * lost the race and was dropped.
       */
      function settleSave(ticket, next) {
        settledSaves.current += 1
        openSaves.current -= 1
        if (ticket.save === saveSeq.current) setState(next)
        if (openSaves.current <= 0) {
          openSaves.current = 0
          setState((prev) => (prev.busy ? { ...prev, busy: false } : prev))
        }
      }

      async function load() {
        const ticket = takeTicket(false)
        setState((prev) => ({ ...prev, status: prev.snapshot ? prev.status : 'loading', error: '', avatarError: '', avatarSize: 0 }))
        try {
          const [snapshot, catalog] = await Promise.all([
            request('/.dsh-orb/settings'),
            request('/.dsh-orb/models'),
          ])
          applyGet(ticket, { status: 'ready', error: '', snapshot, catalog: catalog || { groups: [] }, busy: false, avatarError: '', avatarSize: 0 })
        } catch (error) {
          applyGet(ticket, (prev) => ({
            ...prev,
            status: 'error',
            busy: false,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      }

      React.useEffect(() => {
        void load()
        const onFocus = () => { void load() }
        window.addEventListener?.('focus', onFocus)
        return () => { window.removeEventListener?.('focus', onFocus) }
      }, [])

      // An install runs for minutes inside the host; the page polls it instead of holding a request open.
      // `installing` is polled too: the host clears it when the waited install finishes, and a
      // page that only polled `updating` would keep telling the user not to quit.
      const installing = state.snapshot?.update?.updating === true || state.snapshot?.update?.installing === true
      React.useEffect(() => {
        if (!installing) return undefined
        const timer = setInterval(() => { void refreshUpdate() }, 2000)
        return () => { clearInterval(timer) }
      }, [installing])

      // The first launch prepares the helper runtime inside the host; poll until
      // the ball lands or the failure surfaces, so the waiting line tracks it.
      const preparing = typeof state.snapshot?.helperPhase === 'string' && state.snapshot.helperPhase !== ''
      React.useEffect(() => {
        if (!preparing) return undefined
        const timer = setInterval(() => { void refreshSettings() }, 2000)
        return () => { clearInterval(timer) }
      }, [preparing])

      const voiceModels = state.snapshot && state.snapshot.voiceModels
      const voiceDownloading = Boolean(voiceModels && ['wake', 'tts', 'asr'].some((kind) => voiceModels[kind] && voiceModels[kind].downloading))
      React.useEffect(() => {
        if (!voiceDownloading) return undefined
        const timer = setInterval(() => { void refreshSettings() }, 1000)
        return () => { clearInterval(timer) }
      }, [voiceDownloading])

      async function refreshSettings() {
        const ticket = takeTicket(false)
        try {
          const snapshot = await request('/.dsh-orb/settings')
          applyGet(ticket, (prev) => prev.snapshot ? { ...prev, snapshot } : prev)
        } catch {
          // Keep the last known state; the next poll or a page reload tries again.
        }
      }

      async function refreshUpdate() {
        const ticket = takeTicket(false)
        try {
          const update = await request('/.dsh-orb/update')
          applyGet(ticket, (prev) => prev.snapshot ? { ...prev, snapshot: { ...prev.snapshot, update } } : prev)
        } catch {
          // Keep the last known state; the next poll or a page reload tries again.
        }
      }

      async function refreshHistory() {
        const ticket = takeTicket(false)
        try {
          const history = await request('/.dsh-orb/history')
          applyGet(ticket, (prev) => prev.snapshot ? { ...prev, snapshot: { ...prev.snapshot, history } } : prev)
        } catch {
          // Keep the last known state; the next poll or a page reload tries again.
        }
      }

      async function mutate(path, body, avatarError) {
        // This save outranks every GET already in flight (the confirm-dialog focus load, a
        // poll), and every GET sent before it settles.
        const ticket = takeTicket(true)
        setState((prev) => ({ ...prev, busy: true, avatarError: avatarError || '' }))
        try {
          const snapshot = await request(path, {
            method: 'POST',
            headers: body instanceof ArrayBuffer
              ? { 'content-type': 'application/octet-stream' }
              : { 'content-type': 'application/json' },
            body: body instanceof ArrayBuffer ? body : JSON.stringify(body),
          })
          settleSave(ticket, (prev) => ({ ...prev, status: 'ready', snapshot, busy: false, avatarError: '', avatarSize: 0 }))
          return snapshot
        } catch (error) {
          const code = error instanceof Error ? error.message : ''
          settleSave(ticket, (prev) => ({
            ...prev,
            busy: false,
            avatarError: code === 'too-large' || code === 'invalid-type' ? code : prev.avatarError,
            error: code === 'too-large' || code === 'invalid-type' ? '' : code,
            status: code === 'too-large' || code === 'invalid-type' ? prev.status : 'error',
          }))
          return undefined
        }
      }

      if (state.status === 'error' && !state.snapshot) {
        return h('div', { className: 'dsh-orb-set' },
          h('p', { className: 'dsh-orb-set-error', role: 'alert' }, `${text.error} ${state.error}`),
          h('button', { type: 'button', className: 'dsh-orb-set-button', onClick: () => { void load() } }, text.retry))
      }
      if (!state.snapshot) return h('div', { className: 'dsh-orb-set' }, h('p', null, text.nav))

      const snap = state.snapshot
      const disabled = !snap.supported || state.busy
      // A local check knows the file's size, so say it: "2.6 MB, over the 4 MB limit" is a
      // sentence; "too large" is a puzzle. Only a host-side 413 arrives without a size.
      const avatarMessage = state.avatarError === 'too-large'
        ? (state.avatarSize > 0 ? text.tooLargeSize : text.tooLarge)
          .replaceAll('{size}', megabytes(state.avatarSize))
          .replaceAll('{limit}', AVATAR_MAX_MB)
        : state.avatarError === 'invalid-type'
          ? text.invalidType
          : state.avatarError === 'unreadable'
            ? text.unreadable
            : ''
      return h('div', { className: 'dsh-orb-set' },
        h('header', { className: 'dsh-orb-set-hero' },
          h('span', { className: 'dsh-orb-set-hero-icon', 'aria-hidden': 'true' }, orbIcon('orb')),
          h('div', { className: 'dsh-orb-set-hero-text' },
            h('h2', { className: 'dsh-orb-set-title' }, text.nav),
            h('p', { className: 'dsh-orb-set-intro' }, text.intro))),
        state.status === 'error' && state.error
          ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, `${text.saveError} ${state.error}`)
          : null,
        snap.supported ? null : h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.linux),
        helperNotice(text, snap, disabled, mutate),
        snap.permissionFallback === true
          ? h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.permissionFallback)
          : null,
        // Below the runtime wait/failure: an interrupted download is more urgent than release
        // notes. Above the update card because this note is the reason the user came to look.
        whatsNewNotice(text, snap, mutate),
        // Outside the fieldset: an update is worth offering even where the ball itself is off.
        updateCard(text, snap, mutate),
        h('fieldset', { className: 'dsh-orb-set-fields', disabled },
          card({
            icon: 'orb',
            title: text.ball,
            description: text.ballDescription,
            control: toggleHead(text, snap.ballEnabled === true, text.ball, disabled,
              (enabled) => { void mutate('/.dsh-orb/ball', { enabled }) }),
          }),
          avatarCard(text, snap, disabled, mutate, avatarMessage, (next) => setState((prev) => ({ ...prev, ...next }))),
          card({
            icon: 'agent',
            title: text.overlayTitle,
            description: text.overlayDescription,
            body: h('div', { className: 'dsh-orb-set-panel' }, h(ModelPicker, {
              label: text.overlayTitle,
              catalog: state.catalog,
              current: snap.overlay,
              disabled,
              onSelect: (selection) => { void mutate('/.dsh-orb/overlay-model', selection) },
            })),
          }),
          card({
            icon: 'background',
            title: text.backgroundTitle,
            description: text.backgroundDescription,
            body: h('div', { className: 'dsh-orb-set-panel' }, h(ModelPicker, {
              label: text.backgroundTitle,
              catalog: state.catalog,
              current: snap.background,
              disabled,
              onSelect: (selection) => { void mutate('/.dsh-orb/background-model', selection) },
            })),
          }),
          // Voice sits right after the two Agent cards: it is the other per-session choice
          // people come here to make, not a trailing detail of the coordinate and frame rows.
          h(VoiceCard, { text, snap, disabled, mutate }),
          card({
            icon: 'millifraction',
            title: text.millifractionTitle,
            description: text.millifractionDescription,
            control: toggleHead(text, snap.millifractionEnabled === true, text.millifractionToggle, disabled,
              (enabled) => {
                if (enabled === snap.millifractionEnabled) return
                if (!window.confirm(text.millifractionConfirm)) return
                void mutate('/.dsh-orb/millifraction', { enabled })
              }),
          }),
          card({
            icon: 'frame',
            title: text.frameTitle,
            description: text.frameDescription,
            control: toggleHead(text, snap.observationFrameEnabled !== false, text.frameToggle, disabled,
              (enabled) => {
                if (enabled === snap.observationFrameEnabled) return
                void mutate('/.dsh-orb/observation-frame', { enabled })
              }),
          }),
          h(IdleCard, { text, snap, mutate }),
          snap.tcc && snap.tcc.applicable ? tccCard(text, snap, disabled, mutate) : null),
        h(WorkspaceCard, { text, snap, refreshSettings }),
        h(HistoryCard, { text, snap, mutate, refreshHistory }))
    }

    /** The shared card header: a tinted icon, a title with one line of explanation, an optional control. */
    function cardHead(icon, title, description, control) {
      return h('header', { className: 'dsh-orb-set-head' },
        h('span', { className: 'dsh-orb-set-head-icon', 'aria-hidden': 'true' }, orbIcon(icon)),
        h('div', { className: 'dsh-orb-set-head-text' },
          h('h3', null, title),
          description ? h('p', null, description) : null),
        control || null)
    }

    /** A top-level switch with its state spelled out, exactly like the voice panels. */
    function toggleHead(text, checked, label, disabled, onChange) {
      return h('div', { className: 'dsh-orb-set-head-control' },
        h('span', { className: 'dsh-orb-set-head-state' }, checked ? text.voiceOn : text.voiceOff),
        h(Toggle, { checked, label, disabled, onChange }))
    }

    /**
     * One settings card: icon head, then either a single control on the head line or a
     * body below it. Modelled on the voice card so every row of this page reads alike.
     */
    function card(options) {
      return h('section', { className: `dsh-orb-set-card${options.className ? ` ${options.className}` : ''}` },
        cardHead(options.icon, options.title, options.description, options.control),
        options.body ? h('div', { className: 'dsh-orb-set-card-body' }, options.body) : null)
    }

    /** The avatar picker: the current picture and its two actions, then the shipped GIFs. */
    function avatarCard(text, snap, disabled, mutate, avatarMessage, onAvatarError) {
      return h('section', { className: 'dsh-orb-set-card' },
        cardHead('avatar', text.avatarTitle, text.avatarDescription.replaceAll('{limit}', AVATAR_MAX_MB)),
        h('div', { className: 'dsh-orb-set-card-body' },
          h('div', { className: 'dsh-orb-set-avatar-row' },
            h('div', { className: 'dsh-orb-set-avatar-frame' },
              h('img', { className: 'dsh-orb-set-avatar', src: snap.avatarUrl, alt: text.avatarAlt })),
            h('div', { className: 'dsh-orb-set-actions' },
              h('button', {
                type: 'button',
                className: 'dsh-orb-set-button dsh-orb-set-primary',
                disabled,
                onClick: () => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/gif,image/png,image/webp,.gif,.png,.webp'
                  input.onchange = () => {
                    const file = input.files && input.files[0]
                    if (!file) return
                    if (file.size > AVATAR_MAX_BYTES) {
                      onAvatarError({ avatarError: 'too-large', avatarSize: file.size })
                      return
                    }
                    // A failed read used to vanish into the void: no request, no message,
                    // nothing on the ball. Say so instead.
                    void file.arrayBuffer().then(
                      (bytes) => mutate('/.dsh-orb/avatar', bytes),
                      () => { onAvatarError({ avatarError: 'unreadable', avatarSize: 0 }) },
                    )
                  }
                  input.click()
                },
              }, text.chooseImage),
              h('button', {
                type: 'button',
                className: 'dsh-orb-set-button dsh-orb-set-ghost',
                disabled,
                onClick: () => { void mutate('/.dsh-orb/avatar/restore', {}) },
              }, text.restoreDefault))),
          avatarMessage ? h('p', { className: 'dsh-orb-set-error dsh-orb-set-avatar-error', role: 'alert' }, avatarMessage) : null,
          presetGallery(text, snap, disabled, mutate)))
    }

    /**
     * Why the ball is not on screen yet: preparing (first-launch runtime), or failed with an
     * action that starts the work over. Nothing shows while a ball is up or the ball is off.
     *
     * The notice is deliberately loud. A quiet grey line in this page is what users walked past:
     * the failure colour follows a title and a filled button, and the waiting tone keeps its
     * own action so an interrupted first download can be restarted without leaving the page.
     */
    function helperNotice(text, snap, disabled, mutate) {
      if (snap.ballEnabled === false) return null
      const retryBall = () => {
        // POST the toggle's own value: the host restarts the helper and grants
        // a fresh download budget.
        void mutate('/.dsh-orb/ball', { enabled: true })
      }
      const redownload = () => {
        // Cancels the attempt in flight, clears what an interrupted one left behind, and
        // downloads again — no app restart, no waiting out a backoff.
        void mutate('/.dsh-orb/runtime/redownload', {})
      }
      if (snap.helperError === 'helper-exited') {
        return runtimeNotice(text.helperFailedTitle, text.helperFailed, 'error', text.retry, disabled, retryBall)
      }
      if (snap.helperError === 'runtime-download') {
        return runtimeNotice(text.runtimeFailedTitle, text.runtimeFailed, 'error', text.redownload, disabled, redownload)
      }
      if (typeof snap.helperPhase === 'string' && snap.helperPhase !== '') {
        return runtimeNotice(text.runtimePreparingTitle, text.runtimePreparing, 'wait', text.redownload, disabled, redownload)
      }
      return null
    }

    /**
     * One runtime notice: tone mark, title, body, and a filled action button on the same row.
     * The button is the point of the block, so it is a primary button, not the ghost one this
     * page used to render underneath the sentence.
     */
    function runtimeNotice(title, body, tone, action, disabled, onClick) {
      return h('section', {
        className: `dsh-orb-set-notice is-${tone}`,
        role: tone === 'error' ? 'alert' : 'status',
      },
        h('span', { className: 'dsh-orb-set-notice-mark', 'aria-hidden': 'true' }, tone === 'error' ? '!' : null),
        h('div', { className: 'dsh-orb-set-notice-main' },
          h('h3', { className: 'dsh-orb-set-notice-title' }, title),
          h('p', { className: 'dsh-orb-set-notice-body' }, body)),
        h('button', { type: 'button', className: 'dsh-orb-set-notice-action', disabled, onClick }, action))
    }

    /**
     * The one-time 0.2.0 release note. The host decides whether this profile still needs it;
     * the page owns the localized copy and only draws it when that copy names the same note.
     * Both the corner × and the "Got it" button go through the same dismiss route.
     */
    function whatsNewNotice(text, snap, mutate) {
      const note = snap.supported && text.whatsNew && snap.whatsNew && text.whatsNew.id === snap.whatsNew.id
        ? text.whatsNew
        : null
      if (!note) return null
      const dismiss = () => { void mutate('/.dsh-orb/whats-new/dismiss', { id: note.id }) }
      return h('section', {
        className: 'dsh-orb-set-notice is-info dsh-orb-set-whats-new',
        role: 'region',
        'aria-labelledby': 'dsh-orb-set-whats-new-title',
      },
        h('span', { className: 'dsh-orb-set-notice-mark', 'aria-hidden': 'true' }, '✦'),
        h('div', { className: 'dsh-orb-set-notice-main' },
          h('div', { className: 'dsh-orb-set-whats-new-head' },
            h('h3', { className: 'dsh-orb-set-notice-title', id: 'dsh-orb-set-whats-new-title' }, note.title),
            h('button', {
              type: 'button',
              className: 'dsh-orb-set-whats-new-close',
              'aria-label': note.close,
              title: note.close,
              onClick: dismiss,
            }, '×')),
          h('p', { className: 'dsh-orb-set-notice-body' }, note.lead),
          h('ul', { className: 'dsh-orb-set-whats-new-list' },
            note.items.map((item, index) => h('li', { key: index }, item))),
          h('div', { className: 'dsh-orb-set-whats-new-foot' },
            h('button', {
              type: 'button',
              className: 'dsh-orb-set-notice-action dsh-orb-set-whats-new-known',
              onClick: dismiss,
            }, note.dismiss))))
    }

    /** Current version, the newest published one, and the one-click upgrade. */
    function updateCard(text, snap, mutate) {
      const update = snap.update
      // No version means an unknown install layout (a source checkout): stay out of the way.
      if (!update || !update.currentVersion) return null
      const installed = update.installedVersion || update.currentVersion
      const control = update.available
        ? h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-primary',
          disabled: update.updating,
          onClick: () => { void mutate('/.dsh-orb/update/install', {}) },
        }, update.updating ? text.updating.replaceAll('{version}', update.latestVersion || installed) : text.updateNow)
        : h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-ghost',
          disabled: update.checking,
          onClick: () => { void mutate('/.dsh-orb/update/check', {}) },
        }, update.checking ? text.updateChecking : text.updateCheck)
      const allowBuilds = update.error === 'build-blocked' && Array.isArray(update.pendingBuilds) && update.pendingBuilds.length > 0
        ? h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-primary dsh-orb-set-update-builds',
          onClick: () => { void mutate('/.dsh-orb/update/install', { approvedBuilds: update.pendingBuilds }) },
        }, text.updateAllowBuilds)
        : null
      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-update' },
        cardHead('update',
          text.updateTitle,
          text.updateCurrent.replaceAll('{version}', installed),
          h('div', { className: 'dsh-orb-set-head-control' }, control)),
        updateNotice(text, snap, update),
        allowBuilds,
        h('div', { className: 'dsh-orb-set-card-body' },
          h('div', { className: 'dsh-orb-set-panel' },
            h('div', { className: 'dsh-orb-set-panel-row' },
              h('div', { className: 'dsh-orb-set-panel-text' },
                h('h4', null, text.updateAuto),
                h('p', null, text.updateAutoDescription)),
              h('div', { className: 'dsh-orb-set-panel-switch' },
                h('span', { className: 'dsh-orb-set-panel-state' }, update.autoCheck === true ? text.voiceOn : text.voiceOff),
                h(Toggle, {
                  checked: update.autoCheck === true,
                  label: text.updateAuto,
                  disabled: false,
                  onChange: (enabled) => { void mutate('/.dsh-orb/update/auto', { enabled }) },
                })))),
          update.canUpdate ? null : h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updateManual)))
    }

    function updateNotice(text, snap, update) {
      if (update.updating) {
        return h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updating.replaceAll('{version}', update.latestVersion || update.installedVersion))
      }
      if (update.error) {
        const detail = update.error === 'network'
          ? text.updateOffline
          : update.error === 'build-blocked'
            ? text.updateBuildBlocked
            : update.error === 'already-installed'
              ? text.updateAlreadyInstalled
              : update.error
        return h('p', { className: 'dsh-orb-set-error', role: 'alert' }, `${text.updateFailed}${detail}`)
      }
      if (update.installing) {
        const app = snap.tcc && snap.tcc.appName ? snap.tcc.appName : 'DeepSeek Harness'
        return h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updateInstalling
          .replaceAll('{name}', app))
      }
      if (update.deferred) {
        const app = snap.tcc && snap.tcc.appName ? snap.tcc.appName : 'DeepSeek Harness'
        return h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updateDeferred
          .replaceAll('{version}', update.latestVersion || '')
          .replaceAll('{name}', app))
      }
      if (update.restartRequired) {
        const app = snap.tcc && snap.tcc.appName ? snap.tcc.appName : 'DeepSeek Harness'
        return h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updateDone
          .replaceAll('{version}', update.installedVersion)
          .replaceAll('{name}', app))
      }
      if (update.available) {
        return h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.updateAvailable
          .replaceAll('{version}', update.latestVersion))
      }
      return null
    }

    /**
     * The Agent workspace is the cwd new floating-ball sessions are created in. Switching
     * never moves the old directory: only the pointer in this profile changes.
     */
    function WorkspaceCard({ text, snap, refreshSettings }) {
      const workspace = snap.workspace
      const [busy, setBusy] = React.useState(false)
      const [picking, setPicking] = React.useState(false)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [dialog, setDialog] = React.useState(null)
      if (!workspace || !workspace.path) return null

      function workspaceError(code) {
        if (code === 'workspace-running') return text.workspaceRunning
        if (code === 'workspace-not-empty') return text.workspaceNotEmpty
        if (code === 'workspace-not-found') return text.workspaceNotFound
        if (code === 'workspace-not-directory') return text.workspaceNotDirectory
        if (code === 'workspace-not-readable') return text.workspaceNotReadable
        if (code === 'workspace-create-failed') return text.workspaceCreateFailed
        if (code === 'workspace-invalid-path' || code === 'workspace-not-absolute') return text.workspaceInvalidPath
        if (code === 'workspace-unavailable') return text.workspaceUnavailable
        return code || text.workspaceCreateFailed
      }

      async function pickDirectory() {
        if (busy || picking || dialog) return
        setPicking(true)
        setError('')
        setNotice('')
        try {
          const response = await request('/.dsh-orb/workspace/pick', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          })
          const picked = response && typeof response.path === 'string' ? response.path : ''
          if (picked !== '' && picked !== workspace.path) setDialog({ path: picked, restore: false })
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : String(cause)
          setError(code === 'workspace-picker-unavailable' ? text.workspacePickerUnavailable : text.workspacePickFailed)
        } finally {
          setPicking(false)
        }
      }

      function beginDefault() {
        setError('')
        setNotice('')
        setDialog({ path: workspace.defaultPath, restore: true })
      }

      function cancelDialog() {
        if (busy) return
        setDialog(null)
        setError('')
      }

      async function applyDialog() {
        if (!dialog || busy) return
        setBusy(true)
        setError('')
        try {
          await request('/.dsh-orb/workspace', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path: dialog.path }),
          })
          setDialog(null)
          setNotice(text.workspaceChanged)
          await refreshSettings()
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : String(cause)
          setDialog((prev) => prev ? { ...prev, error: workspaceError(code) } : prev)
        } finally {
          setBusy(false)
        }
      }

      function workspaceDialog() {
        if (!dialog) return null
        return h('div', {
          className: 'dsh-orb-set-dialog-backdrop',
          onClick: (event) => { if (event.target === event.currentTarget && !busy) cancelDialog() },
        },
          h('div', {
            className: 'dsh-orb-set-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': text.workspaceDialogTitle,
          },
            h('h3', null, text.workspaceDialogTitle),
            h('p', null, text.workspaceDialogBody
              .replaceAll('{old}', workspace.path)
              .replaceAll('{new}', dialog.path)),
            h('p', { className: 'dsh-orb-set-muted' }, text.workspaceDialogKeep),
            dialog.error ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, dialog.error) : null,
            h('div', { className: 'dsh-orb-set-dialog-actions' },
              h('button', {
                type: 'button',
                className: 'dsh-orb-set-button dsh-orb-set-ghost',
                autoFocus: true,
                disabled: busy,
                onClick: cancelDialog,
              }, text.workspaceDialogCancel),
              h('button', {
                type: 'button',
                className: 'dsh-orb-set-button dsh-orb-set-primary',
                disabled: busy,
                onClick: () => { void applyDialog() },
              }, busy ? text.workspaceChanging : text.workspaceDialogConfirm))))
      }

      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-workspace' },
        cardHead('folder', text.workspaceTitle, text.workspaceDescription),
        h('div', { className: 'dsh-orb-set-card-body' },
          h('div', { className: 'dsh-orb-set-panel dsh-orb-set-workspace-panel' },
            h('div', { className: 'dsh-orb-set-workspace-top' },
              h('p', { className: 'dsh-orb-set-muted dsh-orb-set-workspace-path' },
                `${text.workspaceCurrent}${workspace.path}${workspace.custom ? `（${text.workspaceCustom}）` : `（${text.workspaceDefault}）`}`),
              h('span', { className: `dsh-orb-set-badge${workspace.custom ? ' is-custom' : ''}` },
                workspace.custom ? text.workspaceCustom : text.workspaceDefault)),
            h('div', { className: 'dsh-orb-set-workspace-controls' },
              h('button', {
                type: 'button',
                className: 'dsh-orb-set-path',
                title: text.workspacePick,
                disabled: busy || picking || dialog !== null,
                onClick: () => { void pickDirectory() },
              }, workspace.path),
              h('div', { className: 'dsh-orb-set-actions' },
                h('button', {
                  type: 'button',
                  className: 'dsh-orb-set-button dsh-orb-set-ghost',
                  disabled: busy || picking || !workspace.custom,
                  onClick: beginDefault,
                }, text.workspaceUseDefault),
                h('button', {
                  type: 'button',
                  className: 'dsh-orb-set-button dsh-orb-set-primary dsh-orb-set-pick',
                  title: text.workspacePick,
                  'aria-label': text.workspacePick,
                  disabled: busy || picking || dialog !== null,
                  onClick: () => { void pickDirectory() },
                }, picking ? text.workspacePicking : text.workspacePick))),
            error ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, error) : null,
            notice ? h('p', { className: 'dsh-orb-set-muted', role: 'status' }, notice) : null),
          workspaceDialog()))
    }

    /** Retention choices shared with the Host's accepted values. */
    const HISTORY_RETENTION_DAYS = [0, 1, 7, 14, 30, 60]

    /**
     * Old floating-ball conversations. A select is the whole control: choosing a
     * finite window previews and confirms, then saves the policy and starts the
     * cleanup; choosing forever saves a zero policy and deletes nothing.
     */
    function HistoryCard({ text, snap, mutate, refreshHistory }) {
      const history = snap.history
      const current = history && HISTORY_RETENTION_DAYS.includes(history.retentionDays)
        ? String(history.retentionDays)
        : '0'
      const [choice, setChoice] = React.useState(current)
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')
      const [dialog, setDialog] = React.useState(null)
      const scanRef = React.useRef(0)
      const abortRef = React.useRef(null)
      React.useEffect(() => {
        if (!history || history.cleaning !== true) return undefined
        const timer = setInterval(() => { void refreshHistory() }, 2000)
        return () => { clearInterval(timer) }
      }, [history && history.cleaning])
      React.useEffect(() => () => {
        scanRef.current += 1
        abortRef.current?.abort()
      }, [])
      React.useEffect(() => {
        if (!dialog) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') {
            setDialog(null)
            setChoice(current)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey) }
      }, [dialog, current])
      if (!history) return null
      if (history.available === false) {
        return h('section', { className: 'dsh-orb-set-card dsh-orb-set-history' },
          cardHead('history', text.historyTitle, text.historyDescription),
          h('div', { className: 'dsh-orb-set-card-body' },
            h('p', { className: 'dsh-orb-set-banner', role: 'status' }, text.historyUnavailable)))
      }
      const cleaning = history.cleaning === true
      const pending = busy || cleaning || dialog !== null

      async function saveRetention(days) {
        await request('/.dsh-orb/history/retention', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ days }),
        })
      }

      async function scan(next) {
        scanRef.current += 1
        const token = scanRef.current
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setDialog((prev) => prev && prev.next === next ? { ...prev, scanning: true, error: '', preview: null } : prev)
        try {
          const response = await request('/.dsh-orb/history/preview', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ days: next }),
            signal: controller.signal,
          })
          if (scanRef.current !== token) return
          if (!response || !response.preview) throw new Error(text.historyPreviewFailed)
          setDialog((prev) => prev && prev.next === next ? { ...prev, scanning: false, preview: response.preview } : prev)
        } catch (cause) {
          if (controller.signal.aborted || scanRef.current !== token) return
          setDialog((prev) => prev && prev.next === next
            ? { ...prev, scanning: false, error: cause instanceof Error ? cause.message : String(cause) }
            : prev)
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      }

      function choose(next) {
        if (pending) return
        if (next === history.retentionDays) {
          setChoice(current)
          return
        }
        setError('')
        setChoice(String(next))
        if (next === 0) {
          setDialog({ next: 0, preview: null, scanning: false, error: '' })
          return
        }
        setDialog({ next, preview: null, scanning: true, error: '' })
        void scan(next)
      }

      function cancelDialog() {
        scanRef.current += 1
        abortRef.current?.abort()
        abortRef.current = null
        setDialog(null)
        setChoice(current)
      }

      function retryScan() {
        if (!dialog || dialog.next === 0) return
        void scan(dialog.next)
      }

      async function applyDialog() {
        if (!dialog || dialog.scanning || dialog.error) return
        const next = dialog.next
        scanRef.current += 1
        abortRef.current?.abort()
        abortRef.current = null
        setDialog(null)
        setError('')
        setBusy(true)
        try {
          await saveRetention(next)
          if (next === 0) {
            await refreshHistory()
          } else {
            // The retention is already saved; the clean run now uses that new cutoff.
            await mutate('/.dsh-orb/history/clean', {})
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
          setChoice(current)
        } finally {
          setBusy(false)
        }
      }

      function dialogList() {
        const preview = dialog && dialog.preview
        if (!preview || !Array.isArray(preview.sessions) || preview.sessions.length === 0) return null
        const shown = preview.sessions.slice(0, 10)
        const more = Math.max(0, (preview.roots ?? 0) - shown.length)
        return h('ul', { className: 'dsh-orb-set-dialog-list' },
          shown.map((session) => h('li', { key: session.id }, session.title || text.historyDialogUnnamed)),
          more > 0 ? h('li', { className: 'dsh-orb-set-muted' }, text.historyDialogMore.replaceAll('{count}', String(more))) : null)
      }

      function retentionDialog() {
        if (!dialog) return null
        const next = dialog.next
        const preview = dialog.preview
        const cancel = h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-ghost',
          autoFocus: true,
          onClick: cancelDialog,
        }, text.historyDialogCancel)
        const confirm = h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-primary',
          disabled: dialog.scanning || dialog.error !== '',
          onClick: () => { void applyDialog() },
        }, text.historyDialogConfirm)
        const retry = h('button', {
          type: 'button',
          className: 'dsh-orb-set-button dsh-orb-set-primary',
          onClick: retryScan,
        }, text.historyDialogRetry)
        let body
        if (dialog.scanning) {
          body = h('div', null,
            h('p', null, text.historyDialogScanning.replaceAll('{days}', String(next))),
            h('div', { className: 'dsh-orb-set-dialog-progress', role: 'progressbar', 'aria-label': text.historyDialogScanning.replaceAll('{days}', String(next)) },
              h('div', { className: 'dsh-orb-set-dialog-progress-fill' })))
        } else if (dialog.error) {
          body = h('p', { className: 'dsh-orb-set-error', role: 'alert' }, `${text.historyFailed}${dialog.error}`)
        } else if (next === 0) {
          body = h('p', null, text.historyDialogForever)
        } else {
          body = h('div', null,
            h('p', null, preview && preview.roots > 0
              ? text.historyDialogDelete.replaceAll('{count}', String(preview.roots))
              : text.historyDialogNoDelete.replaceAll('{days}', String(next))),
            h('p', { className: 'dsh-orb-set-muted' }, text.historyDialogKeep.replaceAll('{days}', String(next))),
            dialogList())
        }
        return h('div', {
          className: 'dsh-orb-set-dialog-backdrop',
          onClick: (event) => { if (event.target === event.currentTarget) cancelDialog() },
        },
          h('div', {
            className: 'dsh-orb-set-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': text.historyDialogTitle,
          },
            h('h3', null, text.historyDialogTitle),
            body,
            h('div', { className: 'dsh-orb-set-dialog-actions' },
              cancel,
              dialog.error ? retry : confirm)))
      }

      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-history' },
        cardHead('history', text.historyTitle, text.historyDescription),
        h('div', { className: 'dsh-orb-set-card-body' },
          h('div', { className: 'dsh-orb-set-panel' },
            h('div', { className: 'dsh-orb-set-history-row' },
              h('div', { className: 'dsh-orb-set-panel-text' },
                h('h4', null, text.historyRetention),
                h('p', null, text.historyWorkspace.replaceAll('{path}', String(history.workspacePath || '')))),
              h('label', { className: 'dsh-orb-set-field dsh-orb-set-history-field' },
                h('span', { className: 'dsh-orb-set-select-wrap' },
                  h('select', {
                    className: 'dsh-orb-set-input',
                    'aria-label': text.historyRetention,
                    value: choice,
                    disabled: pending,
                    onChange: (event) => { void choose(Number(event.target.value)) },
                  },
                    HISTORY_RETENTION_DAYS.map((days) => h('option', { key: days, value: String(days) },
                      days === 0 ? text.historyForever : text.historyDaysOption.replaceAll('{days}', String(days))))))))),
          h('p', { className: 'dsh-orb-set-history-hint' }, text.historyRestoreHint),
          error ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, error) : null,
          cleaning ? h('p', { className: 'dsh-orb-set-banner', role: 'status' }, history.phase === 'restoring' ? text.historyRestoring : text.historyCleaning) : null,
          history.error ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, `${text.historyFailed}${history.error}`) : null,
          history.warning === 'images-kept'
            ? h('p', { className: 'dsh-orb-set-muted' }, text.historyWarning.replaceAll('{count}', String(history.warningSessions || 0)))
            : null,
          history.lastCleanupAt ? h('p', { className: 'dsh-orb-set-history-last' }, text.historyLast.replaceAll('{sessions}', String(history.lastDeletedSessions))) : null,
          retentionDialog()))
    }

    // Official sources and sizes. The host snapshot overrides these when it sends them.
    // Keep the URLs aligned with packages/voice/src/manifest.ts.
    const VOICE_OFFERS = {
      wake: {
        sources: [
          'https://registry.npmmirror.com/dsh-orb-kws/-/dsh-orb-kws-2026.10.0.tgz',
          'https://registry.npmjs.org/dsh-orb-kws/-/dsh-orb-kws-2026.10.0.tgz',
        ],
        bytes: 9_024_132,
      },
      tts: {
        sources: [
          'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/matcha-icefall-zh-baker.tar.bz2',
          'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/matcha-icefall-en_US-ljspeech.tar.bz2',
          'https://github.com/k2-fsa/sherpa-onnx/releases/download/vocoder-models/vocos-22khz-univ.onnx',
        ],
        bytes: 214 * 1024 * 1024,
      },
      asr: {
        sources: ['https://huggingface.co', 'https://hf-mirror.com'],
        bytes: 239233841 + 315894 + 1807522,
      },
    }

    const VOICE_DEFAULTS = {
      voiceEnabled: false,
      wakeEnabled: true,
      wakeWords: ['你好大肥鱼'],
      wakeThreshold: 0.25,
      wakeScore: 1,
      wakeChunk: 8,
      wakeCooldownMs: 1500,
      wakeReply: '我在',
      commandEnabled: true,
      interjectKeyword: '大肥鱼',
      dismissPhrases: ['你退下吧', '退下吧'],
      dismissReply: '好的，再见',
      ttsEnabled: true,
      ttsBackend: 'local',
      qwenApiKey: '',
      qwenVoice: 'Cherry',
      qwenSpeed: 1.4,
      questionPrompt: '我有几个问题，你来选一下',
      ttsSpeed: 1.5,
      ttsVolume: 1,
      idleMs: 30000,
    }

    function normalizeVoice(raw) {
      const present = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      const item = present ? raw : {}
      // A host that predates the master field kept voice on if any column was on.
      const legacyOn = item.wakeEnabled === true || item.commandEnabled === true || item.ttsEnabled === true
      return {
        voiceEnabled: typeof item.voiceEnabled === 'boolean' ? item.voiceEnabled : legacyOn,
        wakeEnabled: typeof item.wakeEnabled === 'boolean' ? item.wakeEnabled : VOICE_DEFAULTS.wakeEnabled,
        wakeWords: Array.isArray(item.wakeWords) ? item.wakeWords : VOICE_DEFAULTS.wakeWords,
        wakeThreshold: typeof item.wakeThreshold === 'number' ? item.wakeThreshold : VOICE_DEFAULTS.wakeThreshold,
        wakeScore: typeof item.wakeScore === 'number' ? item.wakeScore : VOICE_DEFAULTS.wakeScore,
        wakeChunk: item.wakeChunk === 16 ? 16 : 8,
        wakeCooldownMs: typeof item.wakeCooldownMs === 'number' ? item.wakeCooldownMs : VOICE_DEFAULTS.wakeCooldownMs,
        wakeReply: typeof item.wakeReply === 'string' ? item.wakeReply : VOICE_DEFAULTS.wakeReply,
        commandEnabled: typeof item.commandEnabled === 'boolean' ? item.commandEnabled : VOICE_DEFAULTS.commandEnabled,
        interjectKeyword: typeof item.interjectKeyword === 'string' ? item.interjectKeyword : VOICE_DEFAULTS.interjectKeyword,
        dismissPhrases: Array.isArray(item.dismissPhrases) ? item.dismissPhrases : VOICE_DEFAULTS.dismissPhrases,
        dismissReply: typeof item.dismissReply === 'string' ? item.dismissReply : VOICE_DEFAULTS.dismissReply,
        ttsEnabled: typeof item.ttsEnabled === 'boolean' ? item.ttsEnabled : VOICE_DEFAULTS.ttsEnabled,
        ttsBackend: item.ttsBackend === 'qwen' ? 'qwen' : 'local',
        qwenApiKey: typeof item.qwenApiKey === 'string' ? item.qwenApiKey : VOICE_DEFAULTS.qwenApiKey,
        qwenVoice: typeof item.qwenVoice === 'string' ? item.qwenVoice : VOICE_DEFAULTS.qwenVoice,
        qwenSpeed: typeof item.qwenSpeed === 'number' ? item.qwenSpeed : VOICE_DEFAULTS.qwenSpeed,
        questionPrompt: typeof item.questionPrompt === 'string' ? item.questionPrompt : VOICE_DEFAULTS.questionPrompt,
        ttsSpeed: typeof item.ttsSpeed === 'number' ? item.ttsSpeed : VOICE_DEFAULTS.ttsSpeed,
        ttsVolume: typeof item.ttsVolume === 'number' ? item.ttsVolume : VOICE_DEFAULTS.ttsVolume,
        idleMs: typeof item.idleMs === 'number' ? item.idleMs : VOICE_DEFAULTS.idleMs,
      }
    }

    function normalizeModel(raw, offer) {
      const item = raw && typeof raw === 'object' ? raw : {}
      const sources = Array.isArray(item.sources) ? item.sources.filter((entry) => typeof entry === 'string' && entry !== '') : []
      return {
        present: item.present === true,
        downloading: item.downloading === true,
        progress: typeof item.progress === 'number' ? item.progress : 0,
        sources: sources.length > 0 ? sources : offer.sources,
        bytes: typeof item.bytes === 'number' ? item.bytes : offer.bytes,
        error: typeof item.error === 'string' ? item.error : '',
        notice: item.notice === 'present' ? 'present' : '',
        official: item.official === false ? false : item.official === true ? true : undefined,
      }
    }

    function voiceLocks(control, models, backend) {
      const missing = []
      if ((control === 'wake' || control === 'wake-reply') && !models.wake.present) missing.push('wake')
      // Qwen does not use the local files: while it is selected those controls stay editable.
      if (backend !== 'qwen'
        && (control === 'wake-reply' || control === 'dismiss-reply' || control === 'tts')
        && !models.tts.present) missing.push('tts')
      if (control === 'command' && !models.asr.present) missing.push('asr')
      return missing
    }

    function splitLines(value) {
      return String(value).split(/\n/).map((line) => line.trim()).filter(Boolean)
    }

    /** Inline line icons for the settings page: they inherit the surrounding colour and size. */
    function orbIcon(name) {
      if (name === 'orb') {
        // A ball, not a progress ring: the tinted body plus one highlight reads as an orb
        // at both 20 px (the card head) and 26 px (the page head).
        return h('svg', {
          viewBox: '0 0 24 24',
          width: 20,
          height: 20,
          fill: 'none',
          'aria-hidden': 'true',
          focusable: 'false',
        },
          h('circle', { cx: 12, cy: 12, r: 8.6, fill: 'currentColor', opacity: 0.12 }),
          h('circle', { cx: 12, cy: 12, r: 8.6, stroke: 'currentColor', strokeWidth: 1.5 }),
          h('ellipse', { cx: 9.3, cy: 8.3, rx: 2.5, ry: 1.45, fill: 'currentColor', opacity: 0.5, transform: 'rotate(-32 9.3 8.3)' }))
      }
      const paths = {
        update: [
          'M20 12a8 8 0 1 1-2.34-5.66',
          'M20 4.5V10h-5.5',
        ],
        avatar: [
          'M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z',
          'M8.6 10.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Z',
          'M21 15.6l-4.7-4.5-8.8 8.4',
        ],
        agent: [
          'M3.8 6.4a2 2 0 0 1 2-2h12.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2Z',
          'M9 20h6',
          'M12 16.4V20',
          'M9.5 8.1 15 11.7l-2.6.8-.9 2.6-2-7Z',
        ],
        background: [
          'M12 3.5 21 8l-9 4.5L3 8l9-4.5Z',
          'M3 11.8 12 16.3l9-4.5',
          'M3 15.6 12 20.1l9-4.5',
        ],
        millifraction: [
          'M4 9V4h5',
          'M15 4h5v5',
          'M20 15v5h-5',
          'M9 20H4v-5',
          'M12 8.4v7.2',
          'M8.4 12h7.2',
        ],
        frame: [
          'M6.5 3.5v14a2 2 0 0 0 2 2h12',
          'M3.5 6.5h14a2 2 0 0 1 2 2v12',
        ],
        shield: [
          'M12 3.5 5 6.2v5.6c0 4.2 2.9 7.4 7 8.7 4.1-1.3 7-4.5 7-8.7V6.2L12 3.5Z',
          'M9 12l2.2 2.2L15.4 10',
        ],
        folder: [
          'M3.5 7.5a2 2 0 0 1 2-2h3.2l2 2.2h7.8a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z',
          'M3.5 10.6h17',
        ],
        history: [
          'M4.5 12a7.5 7.5 0 1 0 2.2-5.3',
          'M4.5 4.5v4h4',
          'M12 8v4.2l2.8 1.7',
        ],
        voice: [
          'M12 3.5a2.7 2.7 0 0 1 2.7 2.7v5.3a2.7 2.7 0 0 1-5.4 0V6.2A2.7 2.7 0 0 1 12 3.5Z',
          'M6.5 11.1v.5a5.5 5.5 0 0 0 11 0v-.5',
          'M12 17.4v3.1',
          'M9.5 20.5h5',
        ],
        wake: [
          'M12 3.6a2.6 2.6 0 0 1 2.6 2.6v4.9a2.6 2.6 0 0 1-5.2 0V6.2A2.6 2.6 0 0 1 12 3.6Z',
          'M7 10.9v.5a5 5 0 0 0 10 0v-.5',
          'M12 16.4v2.1',
          'M9.9 19.7h4.2',
          'M19.2 4.2a8.7 8.7 0 0 1 0 9.3',
          'M21.4 2.4a11.6 11.6 0 0 1 0 12.9',
        ],
        command: [
          'M4.5 10.5v3',
          'M8.3 7.5v9',
          'M12 4.8v14.4',
          'M15.7 8.2v7.6',
          'M19.5 10.5v3',
        ],
        tts: [
          'M4 9.4h3.3L12 5.6v12.8L7.3 14.6H4Z',
          'M15.7 9.1a4.1 4.1 0 0 1 0 5.8',
          'M18.3 6.5a7.8 7.8 0 0 1 0 11',
        ],
        idle: [
          'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
          'M12 7.2v5l3.2 1.9',
        ],
        micOff: [
          'M4 4l16 16',
          'M9.4 5.1A2.6 2.6 0 0 1 14.6 7v3.7',
          'M17 9.4v2a5 5 0 0 1-1.3 3.4',
          'M7 10.9v.5a5 5 0 0 0 7.4 4.5',
          'M12 16.4v2.1',
          'M9.9 19.7h4.2',
        ],
      }
      const lines = paths[name] || paths.orb
      return h('svg', {
        viewBox: '0 0 24 24',
        width: 20,
        height: 20,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
      }, lines.map((d, index) => h('path', { key: index, d })))
    }

    /** A value with its unit, so 600 seconds reads as 10 分钟. */
    function secondsLabel(value, text) {
      const total = Math.round(value)
      if (total < 60) return text.unitSeconds.replaceAll('{value}', String(total))
      const minutes = Math.floor(total / 60)
      const rest = total % 60
      return rest === 0
        ? text.unitMinutes.replaceAll('{value}', String(minutes))
        : text.unitMinuteSeconds.replaceAll('{minutes}', String(minutes)).replaceAll('{seconds}', String(rest))
    }

    function voiceFieldHead(label, valueText) {
      return h('span', { className: 'dsh-orb-set-voice-field-head' },
        h('span', { className: 'dsh-orb-set-voice-field-label' }, label),
        valueText === null ? null : h('span', { className: 'dsh-orb-set-voice-field-value' }, valueText))
    }

    /**
     * One stored value as a slider. `factor` converts display units to stored units:
     * 1000 for milliseconds, 0.01 for the volume fraction, 1 for the rest. The caller owns
     * the draft and the save; `settled` de-duplicates the release and the blur that follows.
     * A plain node builder rather than a component: the value and its state live in the caller.
     */
    function voiceSliderNode({ label, value, spec, hint, locked, wide, settled, stateKey, onLocked, onPreview, onCommit }) {
      const stepText = String(spec.step)
      const dot = stepText.indexOf('.')
      const stepDecimals = dot === -1 ? 0 : stepText.length - dot - 1
      const factor = spec.factor ?? 1
      const raw = Number(value)
      const stored = Number.isFinite(raw) ? raw : (spec.fallback ?? spec.min * factor)
      let display = stored / factor
      if (!Number.isFinite(display)) display = spec.min
      display = Math.min(spec.max, Math.max(spec.min, Number(display.toFixed(stepDecimals))))
      const percent = spec.max === spec.min ? 0 : ((display - spec.min) / (spec.max - spec.min)) * 100
      const shownValue = spec.format(display)
      const storedFrom = (next) => {
        const stepped = Math.round((next - spec.min) / spec.step) * spec.step + spec.min
        return Number((stepped * factor).toFixed(spec.decimals ?? 2))
      }
      const commit = (event) => {
        if (locked) return
        let next = display
        if (event && event.target && event.target.value !== undefined && event.target.value !== '') {
          const parsed = Number(event.target.value)
          if (Number.isFinite(parsed)) next = parsed
        }
        next = Math.min(spec.max, Math.max(spec.min, next))
        const nextStored = storedFrom(next)
        // A release already saved this value; the blur that follows it must not save twice.
        if (settled[stateKey] === nextStored) return
        settled[stateKey] = nextStored
        onCommit(nextStored)
      }
      return h('label', { className: `dsh-orb-set-voice-field${wide ? ' is-wide' : ''}` },
        voiceFieldHead(label, shownValue),
        h('input', {
          type: 'range',
          className: `dsh-orb-set-voice-field-range${locked ? ' is-locked' : ''}`,
          'aria-label': label,
          'aria-valuetext': shownValue,
          'aria-disabled': locked ? 'true' : 'false',
          min: spec.min,
          max: spec.max,
          step: spec.step,
          value: String(display),
          style: { '--dsh-orb-voice-fill': `${Math.max(0, Math.min(100, percent))}%` },
          onChange: (event) => {
            if (locked) return
            const next = Number(event.target.value)
            if (!Number.isFinite(next)) return
            delete settled[stateKey]
            onPreview(storedFrom(next))
          },
          onMouseDown: (event) => {
            if (!locked) return
            event.preventDefault()
            if (onLocked) onLocked()
          },
          onClick: () => {
            if (locked && onLocked) onLocked()
          },
          onPointerUp: commit,
          onKeyUp: (event) => {
            if (!event) return
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home'
              || event.key === 'End' || event.key === 'PageUp' || event.key === 'PageDown') commit(event)
          },
          onBlur: commit,
        }),
        h('span', { className: 'dsh-orb-set-voice-field-scale' },
          h('span', null, spec.format(spec.min)),
          h('span', null, spec.format(spec.max))),
        hint ? h('span', { className: 'dsh-orb-set-voice-field-hint' }, hint) : null)
    }

    /**
     * Voice group on the floating-ball page. A missing model looks unavailable, but the
     * control still takes a click and explains which model to prepare. Native `disabled`
     * would swallow that click.
     *
     * The three columns are cards of their own: an icon and a switch in the header, the
     * adjustable values below. Every bounded value is a slider, so nobody has to type a
     * number whose unit and range they only learn from an error message.
     */
    function VoiceCard({ text, snap, disabled, mutate }) {
      const [dialog, setDialog] = React.useState(null)
      const draftRef = React.useRef({})
      const settledRef = React.useRef({})
      const [, bump] = React.useState(0)
      const voice = normalizeVoice(snap.voice)
      const models = {
        wake: normalizeModel(snap.voiceModels && snap.voiceModels.wake, VOICE_OFFERS.wake),
        tts: normalizeModel(snap.voiceModels && snap.voiceModels.tts, VOICE_OFFERS.tts),
        asr: normalizeModel(snap.voiceModels && snap.voiceModels.asr, VOICE_OFFERS.asr),
      }
      const missingText = {
        wake: text.modelMissingWake,
        tts: text.modelMissingTts,
        asr: text.modelMissingAsr,
      }

      function shown(key) {
        return Object.prototype.hasOwnProperty.call(draftRef.current, key) ? draftRef.current[key] : voice[key]
      }

      function remember(key, value) {
        draftRef.current = { ...draftRef.current, [key]: value }
        bump((count) => count + 1)
      }

      function save(patch) {
        const merged = { ...voice, ...draftRef.current, ...patch }
        if (typeof merged.wakeWords === 'string') merged.wakeWords = splitLines(merged.wakeWords)
        if (typeof merged.dismissPhrases === 'string') merged.dismissPhrases = splitLines(merged.dismissPhrases)
        void mutate('/.dsh-orb/voice', merged)
      }

      function openLock(missing) {
        setDialog({ type: 'locked', missing })
      }

      async function startDownload(kind) {
        if (models[kind].downloading) return
        setDialog(null)
        const snapshot = await mutate('/.dsh-orb/voice/download', { kind })
        if (snapshot && snapshot.voiceModels && snapshot.voiceModels[kind] && snapshot.voiceModels[kind].notice === 'present') {
          setDialog({ type: 'present' })
        }
      }

      function onDownload(kind) {
        if (disabled || models[kind].downloading) return
        if (kind === 'asr' && models.asr.official === false) {
          setDialog({ type: 'service' })
          return
        }
        if (!models[kind].present) {
          setDialog({ type: 'confirm', kind })
          return
        }
        void startDownload(kind)
      }

      function lockedProps(missing) {
        return {
          onMouseDown: (event) => {
            if (missing.length === 0) return
            event.preventDefault()
            openLock(missing)
          },
          onClick: () => {
            if (missing.length === 0) return
            openLock(missing)
          },
        }
      }

      function rangeField(label, key, missing, spec, wide) {
        return voiceSliderNode({
          label,
          value: shown(key),
          spec,
          hint: spec.hint,
          locked: missing.length > 0,
          wide,
          settled: settledRef.current,
          stateKey: key,
          onLocked: () => openLock(missing),
          onPreview: (stored) => remember(key, stored),
          onCommit: (stored) => {
            remember(key, stored)
            save({})
          },
        })
      }

      function textInput(label, key, missing, hint, options) {
        const value = shown(key)
        const secret = options && options.secret === true
        const note = options && options.note ? options.note : null
        return h('label', { className: 'dsh-orb-set-voice-field is-wide' },
          h('span', { className: 'dsh-orb-set-voice-field-label' }, label),
          note,
          h('input', {
            className: `dsh-orb-set-voice-input${missing.length ? ' is-locked' : ''}`,
            type: secret ? 'password' : 'text',
            autoComplete: 'off',
            spellCheck: false,
            'aria-label': label,
            'aria-disabled': missing.length ? 'true' : 'false',
            value: String(value ?? ''),
            onChange: (event) => {
              if (missing.length) return
              remember(key, event.target.value)
            },
            onBlur: (event) => {
              if (missing.length) return
              remember(key, event.target.value)
              save({})
            },
            ...lockedProps(missing),
          }),
          hint ? h('span', { className: 'dsh-orb-set-voice-field-hint' }, hint) : null)
      }

      function linesInput(label, key, missing, hint) {
        const value = shown(key)
        return h('label', { className: 'dsh-orb-set-voice-field is-wide' },
          h('span', { className: 'dsh-orb-set-voice-field-label' }, label),
          h('textarea', {
            className: `dsh-orb-set-voice-input dsh-orb-set-voice-textarea${missing.length ? ' is-locked' : ''}`,
            'aria-label': label,
            'aria-disabled': missing.length ? 'true' : 'false',
            rows: 2,
            value: Array.isArray(value) ? value.join('\n') : String(value ?? ''),
            onChange: (event) => {
              if (missing.length) return
              remember(key, event.target.value)
            },
            onBlur: (event) => {
              if (missing.length) return
              remember(key, splitLines(event.target.value))
              save({})
            },
            ...lockedProps(missing),
          }),
          hint ? h('span', { className: 'dsh-orb-set-voice-field-hint' }, hint) : null)
      }

      /** Two or three fixed choices read as buttons, not as another form control to decipher. */
      function segmentedField(label, options, current, missing, pick, hint, wide) {
        return h('div', { className: `dsh-orb-set-voice-field${wide ? ' is-wide' : ''}` },
          h('span', { className: 'dsh-orb-set-voice-field-label' }, label),
          h('div', {
            className: 'dsh-orb-set-voice-seg',
            role: 'radiogroup',
            'aria-label': label,
            'aria-disabled': missing.length ? 'true' : 'false',
          }, options.map((option) => h('button', {
            key: String(option.value),
            type: 'button',
            role: 'radio',
            className: `dsh-orb-set-voice-seg-item${option.value === current ? ' is-active' : ''}${missing.length ? ' is-locked' : ''}`,
            'aria-checked': option.value === current ? 'true' : 'false',
            'aria-disabled': missing.length ? 'true' : 'false',
            onMouseDown: (event) => {
              if (missing.length === 0) return
              event.preventDefault()
              openLock(missing)
            },
            onClick: () => {
              if (missing.length) {
                openLock(missing)
                return
              }
              pick(option.value)
            },
          }, option.label))),
          hint ? h('span', { className: 'dsh-orb-set-voice-field-hint' }, hint) : null)
      }

      /** The host owns the 48 names; the page only groups and formats them. */
      function qwenVoiceField() {
        const listed = Array.isArray(snap.qwenVoices)
          ? snap.qwenVoices.filter((item) => item && typeof item.voice === 'string')
          : []
        const current = String(shown('qwenVoice') ?? 'Cherry')
        const voices = listed.length > 0
          ? listed
          : [{ voice: current, label: current, group: 'standard' }]
        const groups = [
          { id: 'standard', label: text.qwenVoiceStandard },
          { id: 'dialect', label: text.qwenVoiceDialect },
        ]
        const options = groups.flatMap((group) => {
          const items = voices.filter((item) => (item.group === 'dialect' ? 'dialect' : 'standard') === group.id)
          if (items.length === 0) return []
          return [h('optgroup', { key: group.id, label: group.label },
            items.map((item) => h('option', { key: item.voice, value: item.voice }, item.label || item.voice)))]
        })
        return h('label', { className: 'dsh-orb-set-voice-field is-wide' },
          h('span', { className: 'dsh-orb-set-voice-field-label' }, text.qwenVoice),
          h('span', { className: 'dsh-orb-set-voice-select' },
            h('select', {
              className: 'dsh-orb-set-voice-input',
              'aria-label': text.qwenVoice,
              value: current,
              onChange: (event) => {
                const next = event.target.value
                remember('qwenVoice', next)
                save({ qwenVoice: next })
              },
            }, options)))
      }

      const sizeText = (bytes) => text.voiceSize.replaceAll('{size}', String(Math.round(bytes / (1024 * 1024))))

      function modelFooter(kind, label) {
        const model = models[kind]
        const percent = Math.max(0, Math.min(100, Math.round(model.progress * 100)))
        const name = kind === 'wake'
          ? text.voiceWakeModel
          : kind === 'asr'
            ? text.voiceAsrModel
            : text.voiceTtsModel
        const state = model.downloading
          ? text.voiceModelDownloading
          : model.present
            ? text.voiceModelReady
            : text.voiceModelMissing.replaceAll('{size}', sizeText(model.bytes))
        const action = kind === 'asr' && model.present
          ? null
          : h('button', {
            type: 'button',
            className: `dsh-orb-set-button dsh-orb-set-voice-action${model.present ? ' dsh-orb-set-ghost' : ' dsh-orb-set-primary'}`,
            onClick: () => onDownload(kind),
          }, model.present ? text.voiceRedownload : label)
        return h('div', { className: 'dsh-orb-set-voice-model-block' },
          h('div', { className: 'dsh-orb-set-voice-model' },
            h('div', { className: 'dsh-orb-set-voice-model-info' },
              h('span', {
                className: `dsh-orb-set-voice-model-dot${model.present ? ' is-ready' : ''}${model.downloading ? ' is-active' : ''}`,
                'aria-hidden': 'true',
              }),
              h('div', { className: 'dsh-orb-set-voice-model-text' },
                h('span', { className: 'dsh-orb-set-voice-model-name' }, name),
                h('span', { className: 'dsh-orb-set-voice-model-state' }, state))),
            action),
          model.downloading ? h('div', {
            className: 'dsh-orb-set-voice-progress',
            role: 'progressbar',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': percent,
            'aria-label': label,
          },
            h('div', { className: 'dsh-orb-set-voice-progress-track' },
              h('span', { style: { width: `${percent}%` } })),
            h('p', { className: 'dsh-orb-set-voice-progress-text' }, text.voiceProgress.replaceAll('{percent}', String(percent)))) : null,
          model.error ? h('p', { className: 'dsh-orb-set-error', role: 'alert' }, model.error) : null)
      }

      function voicePanel(icon, title, description, control, body, footer) {
        return h('section', { key: icon, className: 'dsh-orb-set-voice-panel' },
          h('header', { className: 'dsh-orb-set-voice-panel-head' },
            h('span', { className: 'dsh-orb-set-voice-panel-icon', 'aria-hidden': 'true' }, orbIcon(icon)),
            h('div', { className: 'dsh-orb-set-voice-panel-heading' },
              h('h4', null, title),
              h('p', null, description)),
            control),
          h('div', { className: 'dsh-orb-set-voice-panel-body' }, body),
          footer)
      }

      function panelSwitch(label, checked, missing, onChange) {
        return h('div', { className: 'dsh-orb-set-voice-panel-switch' },
          h('span', { className: 'dsh-orb-set-voice-panel-state' }, checked ? text.voiceOn : text.voiceOff),
          h(Toggle, {
            checked,
            label,
            disabled,
            locked: missing.length > 0,
            onLocked: () => openLock(missing),
            onChange,
          }))
      }

      const backend = shown('ttsBackend') === 'qwen' ? 'qwen' : 'local'
      const wakeLocks = voiceLocks('wake', models, backend)
      const wakeReplyLocks = voiceLocks('wake-reply', models, backend)
      const commandLocks = voiceLocks('command', models, backend)
      const dismissReplyLocks = voiceLocks('dismiss-reply', models, backend)
      const ttsLocks = voiceLocks('tts', models, backend)
      const currentChunk = Number(shown('wakeChunk')) === 16 ? 16 : 8

      const dialogNode = dialog === null ? null : h('div', { className: 'dsh-orb-set-dialog-backdrop' },
        h('div', { className: 'dsh-orb-set-dialog', role: 'dialog' },
          dialog.type === 'locked' ? [
            h('h3', { key: 'title' }, text.voiceTitle),
            ...dialog.missing.map((code) => h('p', { key: code }, missingText[code])),
            h('div', { key: 'actions', className: 'dsh-orb-set-dialog-actions' },
              h('button', { type: 'button', className: 'dsh-orb-set-button dsh-orb-set-primary', onClick: () => setDialog(null) }, text.voiceClose)),
          ] : null,
          dialog.type === 'present' ? [
            h('h3', { key: 'title' }, text.voiceTitle),
            h('p', { key: 'body' }, text.modelPresent),
            h('div', { key: 'actions', className: 'dsh-orb-set-dialog-actions' },
              h('button', { type: 'button', className: 'dsh-orb-set-button dsh-orb-set-primary', onClick: () => setDialog(null) }, text.voiceClose)),
          ] : null,
          dialog.type === 'service' ? [
            h('h3', { key: 'title' }, text.downloadAsr),
            h('p', { key: 'body' }, text.asrService),
            h('div', { key: 'actions', className: 'dsh-orb-set-dialog-actions' },
              h('button', { type: 'button', className: 'dsh-orb-set-button dsh-orb-set-primary', onClick: () => setDialog(null) }, text.voiceClose)),
          ] : null,
          dialog.type === 'confirm' ? [
            h('h3', { key: 'title' }, dialog.kind === 'wake' ? text.downloadWake : dialog.kind === 'tts' ? text.downloadTts : text.downloadAsr),
            h('p', { key: 'source-label' }, text.voiceSource),
            ...models[dialog.kind].sources.map((source) => h('p', { key: source }, source)),
            h('p', { key: 'size' }, sizeText(models[dialog.kind].bytes)),
            h('div', { key: 'actions', className: 'dsh-orb-set-dialog-actions' },
              h('button', { type: 'button', className: 'dsh-orb-set-button dsh-orb-set-ghost', onClick: () => setDialog(null) }, text.voiceCancel),
              h('button', { type: 'button', className: 'dsh-orb-set-button dsh-orb-set-primary', onClick: () => { void startDownload(dialog.kind) } }, text.voiceDownload)),
          ] : null))

      const wakePanel = voicePanel('wake', text.wakeTitle, text.wakeDesc,
        panelSwitch(text.wakeToggle, voice.wakeEnabled === true, wakeLocks, (enabled) => save({ wakeEnabled: enabled })),
        h('div', { className: 'dsh-orb-set-voice-fields' },
          rangeField(text.wakeThreshold, 'wakeThreshold', wakeLocks, {
            min: 0.05,
            max: 0.9,
            step: 0.01,
            fallback: 0.25,
            format: (value) => value.toFixed(2),
            hint: text.wakeThresholdHint,
          }),
          rangeField(text.wakeScore, 'wakeScore', wakeLocks, {
            min: 0.5,
            max: 4,
            step: 0.1,
            fallback: 1,
            format: (value) => value.toFixed(1),
            hint: text.wakeScoreHint,
          }),
          segmentedField(text.wakeChunk, [
            { value: 8, label: text.wakeChunk8 },
            { value: 16, label: text.wakeChunk16 },
          ], currentChunk, wakeLocks, (next) => {
            remember('wakeChunk', Number(next))
            save({ wakeChunk: Number(next) })
          }, text.wakeChunkHint),
          rangeField(text.wakeCooldown, 'wakeCooldownMs', wakeLocks, {
            min: 0.5,
            max: 5,
            step: 0.1,
            factor: 1000,
            decimals: 0,
            fallback: 1500,
            format: (value) => text.unitSeconds.replaceAll('{value}', value.toFixed(1)),
            hint: text.wakeCooldownHint,
          }),
          linesInput(text.wakeWords, 'wakeWords', wakeLocks, text.wakeWordsHint),
          textInput(text.wakeReply, 'wakeReply', wakeReplyLocks, null)),
        modelFooter('wake', text.downloadWake))

      const commandPanel = voicePanel('command', text.commandTitle, text.commandDesc,
        panelSwitch(text.commandToggle, voice.commandEnabled === true, commandLocks, (enabled) => save({ commandEnabled: enabled })),
        h('div', { className: 'dsh-orb-set-voice-fields' },
          textInput(text.interjectKeyword, 'interjectKeyword', commandLocks, text.interjectHint),
          linesInput(text.dismissPhrases, 'dismissPhrases', commandLocks, text.dismissHint),
          textInput(text.dismissReply, 'dismissReply', dismissReplyLocks, null)),
        modelFooter('asr', text.downloadAsr))

      const ttsPanel = voicePanel('tts', text.ttsTitle, text.ttsDesc,
        panelSwitch(text.ttsToggle, voice.ttsEnabled === true, ttsLocks, (enabled) => save({ ttsEnabled: enabled })),
        h('div', { className: 'dsh-orb-set-voice-fields' },
          segmentedField(text.ttsBackend, [
            { value: 'local', label: text.ttsBackendLocal },
            { value: 'qwen', label: text.ttsBackendQwen },
          ], backend, [], (next) => {
            remember('ttsBackend', next)
            save({ ttsBackend: next })
          }, null, true),
          rangeField(text.ttsVolume, 'ttsVolume', ttsLocks, {
            min: 0,
            max: 200,
            step: 1,
            factor: 0.01,
            decimals: 2,
            fallback: 1,
            format: (value) => `${Math.round(value)}%`,
            hint: text.ttsVolumeHint,
          }),
          backend === 'qwen'
            ? rangeField(text.qwenSpeed, 'qwenSpeed', [], {
              min: 0.5,
              max: 2,
              step: 0.1,
              fallback: 1.4,
              format: (value) => `${value.toFixed(1)}×`,
              hint: text.qwenSpeedHint,
            })
            : rangeField(text.ttsSpeed, 'ttsSpeed', ttsLocks, {
              min: 1,
              max: 3,
              step: 0.1,
              fallback: 1.5,
              format: (value) => `${value.toFixed(1)}×`,
              hint: text.ttsSpeedHint,
            }),
          textInput(text.questionPrompt, 'questionPrompt', ttsLocks, text.questionPromptHint),
          backend === 'qwen'
            ? textInput(text.qwenApiKey, 'qwenApiKey', [], String(shown('qwenApiKey') ?? '').trim() === '' ? text.qwenApiKeyHint : null, {
              secret: true,
              note: h('span', { className: 'dsh-orb-set-voice-field-hint' },
                text.qwenApiKeyNote,
                ' ',
                h('a', {
                  className: 'dsh-orb-set-voice-link',
                  href: BAILIAN_API_KEY_URL,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }, text.qwenApiKeyLink)),
            })
            : null,
          backend === 'qwen' ? qwenVoiceField() : null),
        // Qwen has no local files; its footer (status + download) belongs to the local backend only.
        backend === 'local' ? modelFooter('tts', text.downloadTts) : null)

      // The master switch is the whole card's gate. Off hides every column, but the three
      // column switches keep their stored values, so the next switch-on restores the mix.
      const voiceOn = shown('voiceEnabled') === true

      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-voice' },
        cardHead('voice', text.voiceTitle, voiceOn ? text.voiceIntro : text.voiceOffIntro,
          h('div', { className: 'dsh-orb-set-head-control' },
            h('span', { className: 'dsh-orb-set-head-state' }, voiceOn ? text.voiceOn : text.voiceOff),
            h(Toggle, {
              checked: voiceOn,
              label: text.voiceMasterToggle,
              disabled,
              onChange: (enabled) => {
                remember('voiceEnabled', enabled)
                save({ voiceEnabled: enabled })
              },
            }))),
        voiceOn ? [
          snap.voiceMic === false ? h('div', { key: 'mic', className: 'dsh-orb-set-voice-mic' },
            h('span', { className: 'dsh-orb-set-voice-mic-icon', 'aria-hidden': 'true' }, orbIcon('micOff')),
            h('p', { className: 'dsh-orb-set-voice-mic-text' }, text.voiceMicBody),
            h('button', {
              type: 'button',
              className: 'dsh-orb-set-button dsh-orb-set-voice-action',
              onClick: () => { void mutate('/.dsh-orb/voice/mic', {}) },
            }, text.voiceMicOpen)) : null,
          wakePanel,
          commandPanel,
          ttsPanel,
        ] : null,
        dialogNode)
    }

    /**
     * Idle unpin is a ball behavior, not a voice column. It lives outside the voice card so
     * the master switch can collapse the long voice form without taking this setting with it.
     */
    function IdleCard({ text, snap, mutate }) {
      const voice = normalizeVoice(snap.voice)
      const settledRef = React.useRef({})
      const [draft, setDraft] = React.useState(null)
      const value = draft === null ? voice.idleMs : draft
      function commit(stored) {
        setDraft(stored)
        void mutate('/.dsh-orb/voice', { ...voice, idleMs: stored }).then((saved) => {
          if (saved) setDraft(null)
        })
      }
      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-idle' },
        cardHead('idle', text.idleTitle, text.idleDesc),
        h('div', { className: 'dsh-orb-set-card-body' },
          h('div', { className: 'dsh-orb-set-panel dsh-orb-set-idle-body' },
            voiceSliderNode({
              label: text.idleSeconds,
              value,
              spec: {
                min: 5,
                max: 600,
                step: 1,
                factor: 1000,
                decimals: 0,
                fallback: 30000,
                format: (seconds) => secondsLabel(seconds, text),
              },
              hint: text.idleHint,
              locked: false,
              wide: true,
              settled: settledRef.current,
              stateKey: 'idleMs',
              onPreview: (stored) => setDraft(stored),
              onCommit: commit,
            }))))
    }

    /**
     * The shipped GIFs as clickable animated thumbnails, with the outbound link to the
     * community gallery trailing the row. The host owns the preset list, this page the
     * names; the gallery link is this page's own, so an older host that sends no presets
     * still gets it.
     */
    function presetGallery(text, snap, disabled, mutate) {
      const presets = Array.isArray(snap.avatarPresets) ? snap.avatarPresets : []
      const names = text.avatarPresetNames || {}
      const tiles = presets.map((preset) => {
        const name = names[preset.id] || preset.id
        const selected = snap.avatarPresetId === preset.id
        return h('button', {
          key: preset.id,
          type: 'button',
          className: `dsh-orb-set-preset${selected ? ' is-selected' : ''}`,
          'aria-pressed': selected ? 'true' : 'false',
          title: name,
          disabled,
          onClick: () => { void mutate('/.dsh-orb/avatar/preset', { preset: preset.id }) },
        },
          h('img', { src: preset.url, alt: '', draggable: false }),
          h('span', null, name))
      })
      // A text link taking the row's leftover space, not a seventh tile: it is no avatar, so
      // the row keeps exactly the built-ins. An anchor rather than a button, so the shell
      // hands the https open to the system browser — and so browsing the gallery stays
      // available while the ball is off or a save is in flight, where fieldset disabled-ness
      // cannot reach it. Kept to the label alone (no arrow, no padding): the leftover after
      // six 72px tiles is about 62px in a half-width window, and a wider link would wrap onto
      // a line of its own instead of sitting in that space. With no presets it sits flush left.
      tiles.push(h('a', {
        key: 'more',
        className: `dsh-orb-set-more${presets.length === 0 ? ' is-alone' : ''}`,
        href: AVATAR_GALLERY_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: text.avatarMoreHint,
      }, text.avatarMore))
      return h('div', { className: 'dsh-orb-set-presets' },
        presets.length === 0
          ? null
          : h('p', { className: 'dsh-orb-set-presets-title', id: 'dsh-orb-presets-label' }, text.avatarBuiltin),
        h('div', {
          className: 'dsh-orb-set-presets-row',
          role: 'group',
          ...(presets.length === 0
            ? { 'aria-label': text.avatarMore }
            : { 'aria-labelledby': 'dsh-orb-presets-label' }),
        }, ...tiles))
    }

    function tccCard(text, snap, disabled, mutate) {
      const name = snap.tcc.appName || ''
      const tone = (state) => state === 'granted' ? 'ok' : state === 'needsRelaunch' ? 'wait' : 'off'
      return h('section', { className: 'dsh-orb-set-card dsh-orb-set-tcc-card' },
        cardHead('shield', text.tccTitle, text.tccDescription),
        h('div', { className: 'dsh-orb-set-card-body' },
          h('p', { className: 'dsh-orb-set-tcc-hint' }, text.tccAppHint.replaceAll('{name}', name)),
          h('div', { className: 'dsh-orb-set-perms' },
            tccRow(text.tccScreenName, text.tccScreenReason, text.tccScreenPath,
              statusText(text, snap.tcc.screen), tone(snap.tcc.screen), text.tccScreenOpen,
              disabled || snap.tcc.screen === 'granted', () => {
                void mutate('/.dsh-orb/tcc', { right: 'screen' })
              }),
            tccRow(text.tccAccessibilityName, text.tccAccessibilityReason, text.tccAccessibilityPath,
              statusText(text, snap.tcc.accessibility), tone(snap.tcc.accessibility), text.tccAccessibilityOpen,
              disabled || snap.tcc.accessibility === 'granted', () => {
                void mutate('/.dsh-orb/tcc', { right: 'accessibility' })
              })),
          h('p', { className: 'dsh-orb-set-tcc-foot' }, text.tccFooter.replaceAll('{name}', name))))
    }

    function tccRow(name, reason, path, status, tone, open, disabled, onClick) {
      return h('div', { className: `dsh-orb-set-perm is-${tone}` },
        h('div', { className: 'dsh-orb-set-perm-main' },
          h('div', { className: 'dsh-orb-set-perm-title' },
            h('h4', null, name),
            h('span', { className: `dsh-orb-set-perm-status is-${tone}` }, status)),
          h('p', { className: 'dsh-orb-set-perm-reason' }, reason),
          h('p', { className: 'dsh-orb-set-perm-path' }, path)),
        h('button', {
          type: 'button',
          className: `dsh-orb-set-button${tone === 'ok' ? ' dsh-orb-set-ghost' : ' dsh-orb-set-primary'}`,
          disabled,
          onClick,
        }, open))
    }

    const style = `
/* The page borrows the voice card's vocabulary: a tinted icon, a title with one
   line of explanation, a control on the head line, and nested panels below. */
.dsh-orb-set {
  --dsh-orb-accent: var(--dsw-alias-button-info-fill, #2f6fed);
  --dsh-orb-line: color-mix(in srgb, currentColor 9%, transparent);
  --dsh-orb-line-soft: color-mix(in srgb, currentColor 7.5%, transparent);
  --dsh-orb-panel: color-mix(in srgb, currentColor 2.4%, transparent);
  display: flex; flex-direction: column; gap: 14px; max-width: 720px; color: inherit;
}
.dsh-orb-set p { margin: 0; color: color-mix(in srgb, currentColor 68%, transparent); font-size: 13px; line-height: 1.5; }
.dsh-orb-set h3, .dsh-orb-set h4 { margin: 0; }

/* Page header */
.dsh-orb-set-hero { display: flex; align-items: center; gap: 14px; padding: 2px 0 6px; }
.dsh-orb-set-hero-icon {
  flex: none; width: 48px; height: 48px; border-radius: 15px;
  display: flex; align-items: center; justify-content: center; color: var(--dsh-orb-accent);
  background: linear-gradient(145deg, color-mix(in srgb, var(--dsh-orb-accent) 16%, transparent), color-mix(in srgb, var(--dsh-orb-accent) 7%, transparent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsh-orb-accent) 14%, transparent);
}
.dsh-orb-set-hero-icon svg { width: 26px; height: 26px; }
.dsh-orb-set-hero-text { min-width: 0; }
.dsh-orb-set .dsh-orb-set-title { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.25; }
.dsh-orb-set .dsh-orb-set-intro { margin: 3px 0 0; font-size: 13px; line-height: 1.5; color: color-mix(in srgb, currentColor 62%, transparent); }

/* Cards */
.dsh-orb-set-fields { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.dsh-orb-set-fields:disabled { opacity: 0.55; }
.dsh-orb-set-card { border: 1px solid var(--dsh-orb-line); border-radius: 14px; padding: 16px 16px 17px; }
.dsh-orb-set-head { display: flex; align-items: flex-start; gap: 12px; }
.dsh-orb-set-head-icon {
  flex: none; width: 38px; height: 38px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--dsh-orb-accent); background: color-mix(in srgb, var(--dsh-orb-accent) 11%, transparent);
}
.dsh-orb-set-head-icon svg { width: 20px; height: 20px; }
.dsh-orb-set-head-text { flex: 1; min-width: 0; padding-top: 1px; }
.dsh-orb-set .dsh-orb-set-head-text h3 { font-size: 15px; font-weight: 600; line-height: 1.35; color: inherit; }
.dsh-orb-set .dsh-orb-set-head-text p { margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: color-mix(in srgb, currentColor 62%, transparent); }
.dsh-orb-set-head-control { flex: none; display: flex; align-items: center; gap: 9px; margin-left: auto; padding-top: 2px; }
.dsh-orb-set-head-control .dsh-orb-set-ghost { border-color: color-mix(in srgb, currentColor 18%, transparent); color: color-mix(in srgb, currentColor 78%, transparent); }
.dsh-orb-set-head-state { font-size: 11px; line-height: 1.6; color: color-mix(in srgb, currentColor 55%, transparent); white-space: nowrap; }
.dsh-orb-set-card-body { margin-top: 14px; }
.dsh-orb-set-card > .dsh-orb-set-banner { margin-top: 10px; }

/* Nested panel, the sub-card voice uses for each column */
.dsh-orb-set-panel { border: 1px solid var(--dsh-orb-line-soft); border-radius: 12px; padding: 13px 14px; background: var(--dsh-orb-panel); }
.dsh-orb-set-panel + .dsh-orb-set-panel { margin-top: 10px; }
.dsh-orb-set-panel-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dsh-orb-set-panel-text { min-width: 0; }
.dsh-orb-set .dsh-orb-set-panel-text h4 { font-size: 13.5px; font-weight: 600; color: inherit; }
.dsh-orb-set .dsh-orb-set-panel-text p { margin-top: 3px; font-size: 12px; line-height: 1.5; color: color-mix(in srgb, currentColor 58%, transparent); }
.dsh-orb-set-panel-switch { flex: none; display: flex; align-items: center; gap: 8px; }
.dsh-orb-set-panel-state { font-size: 11px; line-height: 1.6; color: color-mix(in srgb, currentColor 55%, transparent); white-space: nowrap; }

/* Fields and inputs */
.dsh-orb-set-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: 12px; }
.dsh-orb-set-field-label { font-size: 12.5px; font-weight: 500; line-height: 1.4; color: color-mix(in srgb, currentColor 84%, transparent); }
.dsh-orb-set-input {
  box-sizing: border-box; width: 100%; min-width: 0;
  border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 9px;
  background: color-mix(in srgb, currentColor 2.5%, transparent); color: inherit;
  font: inherit; font-size: 12.5px; line-height: 1.45; padding: 7px 10px;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.dsh-orb-set-input:focus { outline: none; border-color: var(--dsh-orb-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsh-orb-accent) 15%, transparent); }
.dsh-orb-set-select-wrap { position: relative; display: block; min-width: 0; }
.dsh-orb-set-select-wrap::after {
  content: ''; position: absolute; right: 13px; top: 50%; width: 6px; height: 6px;
  border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor;
  transform: translateY(-70%) rotate(45deg); opacity: 0.5; pointer-events: none;
}
.dsh-orb-set select.dsh-orb-set-input { appearance: none; -webkit-appearance: none; padding-right: 30px; cursor: pointer; }
.dsh-orb-set-model-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; align-items: start; }

/* Buttons */
.dsh-orb-set-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  background: color-mix(in srgb, currentColor 2%, transparent); color: inherit;
  border-radius: 8px; padding: 7px 12px; font: inherit; font-size: 12.5px; font-weight: 500;
  line-height: 1.2; white-space: nowrap; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.dsh-orb-set-button:hover:not(:disabled) { background: color-mix(in srgb, currentColor 6%, transparent); border-color: color-mix(in srgb, currentColor 26%, transparent); }
.dsh-orb-set-button:active:not(:disabled) { transform: translateY(0.5px); }
.dsh-orb-set-button:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; }
.dsh-orb-set-button:disabled { opacity: 0.5; cursor: default; }
.dsh-orb-set-ghost { border-color: transparent; background: transparent; }
.dsh-orb-set-ghost:hover:not(:disabled) { background: color-mix(in srgb, currentColor 4%, transparent); border-color: color-mix(in srgb, currentColor 14%, transparent); }
.dsh-orb-set-primary { background: var(--dsh-orb-accent); border-color: transparent; color: var(--dsw-alias-label-primary-inverted, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
.dsh-orb-set-primary:hover:not(:disabled) { background: var(--dsh-orb-accent); filter: brightness(1.06); border-color: transparent; }

/* Switch */
.dsh-orb-set-switch {
  width: 40px; height: 24px; border-radius: 999px; border: 0; padding: 0; flex: none;
  background: color-mix(in srgb, currentColor 18%, transparent); position: relative;
  cursor: pointer; transition: background 160ms ease;
}
.dsh-orb-set-switch:hover:not(:disabled) { background: color-mix(in srgb, currentColor 26%, transparent); }
.dsh-orb-set-switch::after {
  content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: var(--dsw-static-neutral-bluish-00, #fff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 140ms ease;
}
.dsh-orb-set-switch.is-on { background: var(--dsh-orb-accent); }
.dsh-orb-set-switch.is-on:hover:not(:disabled) { background: var(--dsh-orb-accent); filter: brightness(1.05); }
.dsh-orb-set-switch.is-on::after { transform: translateX(16px); }
.dsh-orb-set-switch:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; }
.dsh-orb-set-switch:disabled { opacity: 0.55; cursor: default; }
.dsh-orb-set .is-locked { opacity: 0.45; }

/* Avatar */
.dsh-orb-set-avatar-row { display: flex; align-items: center; gap: 16px; }
.dsh-orb-set-avatar-frame {
  flex: none; padding: 3px; border-radius: 50%;
  background: linear-gradient(145deg, color-mix(in srgb, var(--dsh-orb-accent) 26%, transparent), color-mix(in srgb, var(--dsh-orb-accent) 6%, transparent));
}
.dsh-orb-set-avatar { display: block; width: 64px; height: 64px; border-radius: 50%; object-fit: cover; background: color-mix(in srgb, currentColor 8%, transparent); }
.dsh-orb-set-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto; justify-content: flex-end; }
.dsh-orb-set-avatar-error { margin-top: 8px; }
.dsh-orb-set-presets { margin-top: 12px; padding: 12px 13px 11px; border: 1px solid var(--dsh-orb-line-soft); border-radius: 12px; background: var(--dsh-orb-panel); }
.dsh-orb-set-presets-title { margin: 0 0 7px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; color: color-mix(in srgb, currentColor 55%, transparent); }
.dsh-orb-set-presets-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dsh-orb-set-preset {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px;
  width: 68px; padding: 6px 4px 5px; border: 1px solid transparent; border-radius: 11px;
  background: transparent; color: inherit; font: inherit; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.dsh-orb-set-preset img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; background: color-mix(in srgb, currentColor 8%, transparent); }
.dsh-orb-set-preset span { font-size: 11px; line-height: 1.2; color: color-mix(in srgb, currentColor 72%, transparent); }
.dsh-orb-set-preset:hover:not(:disabled) { border-color: color-mix(in srgb, currentColor 12%, transparent); background: color-mix(in srgb, currentColor 4%, transparent); }
.dsh-orb-set-preset.is-selected { border-color: color-mix(in srgb, var(--dsh-orb-accent) 40%, transparent); background: color-mix(in srgb, var(--dsh-orb-accent) 8%, transparent); }
.dsh-orb-set-preset.is-selected span { color: var(--dsh-orb-accent); font-weight: 600; }
.dsh-orb-set-preset.is-selected::after { content: ''; position: absolute; top: 4px; right: 9px; width: 7px; height: 7px; border-radius: 50%; background: var(--dsh-orb-accent); box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-3, #fff); }
.dsh-orb-set-preset:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 1px; }
.dsh-orb-set-more { margin-left: auto; align-self: center; padding: 4px 2px; color: var(--dsh-orb-accent); font-size: 12px; font-weight: 500; line-height: 1.2; text-decoration: none; white-space: nowrap; }
.dsh-orb-set-more.is-alone { margin-left: 0; }
.dsh-orb-set-more:hover { text-decoration: underline; }
.dsh-orb-set-more:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; border-radius: 4px; }

/* Width, errors, notices */
.dsh-orb-set-banner { color: color-mix(in srgb, currentColor 62%, transparent); }
.dsh-orb-set-card > .dsh-orb-set-banner { display: flex; align-items: center; gap: 7px; font-size: 12px; line-height: 1.5; }
.dsh-orb-set > .dsh-orb-set-banner { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border: 1px solid color-mix(in srgb, currentColor 10%, transparent); border-radius: 10px; background: color-mix(in srgb, currentColor 2.5%, transparent); font-size: 12.5px; }
.dsh-orb-set > .dsh-orb-set-banner::before { content: ''; flex: none; width: 6px; height: 6px; margin-top: 6px; border-radius: 50%; background: color-mix(in srgb, currentColor 38%, transparent); }
.dsh-orb-set-card > .dsh-orb-set-banner::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsh-orb-accent); }
.dsh-orb-set-error { margin-top: 8px; color: var(--dsw-alias-state-error-primary, #d92d20); }
.dsh-orb-set > .dsh-orb-set-error { margin-top: 0; }
.dsh-orb-set p.dsh-orb-set-error { margin-top: 8px; color: var(--dsw-alias-state-error-primary, #d92d20); }
.dsh-orb-set > .dsh-orb-set-error { margin-top: 0; }
.dsh-orb-set-muted { color: color-mix(in srgb, currentColor 58%, transparent); }
.dsh-orb-set-update-builds { margin-top: 10px; }
.dsh-orb-set-notice { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1px solid transparent; }
.dsh-orb-set-notice.is-error { border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d92d20) 40%, transparent); background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d92d20) 8%, transparent); }
.dsh-orb-set-notice.is-wait { border-color: color-mix(in srgb, var(--dsh-orb-accent) 35%, transparent); background: color-mix(in srgb, var(--dsh-orb-accent) 7%, transparent); }
.dsh-orb-set-notice.is-info { border-color: color-mix(in srgb, var(--dsh-orb-accent) 32%, transparent); background: color-mix(in srgb, var(--dsh-orb-accent) 6%, transparent); }
.dsh-orb-set-notice-mark { flex: none; width: 23px; height: 23px; margin-top: -1px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; line-height: 1; }
.dsh-orb-set-notice.is-error .dsh-orb-set-notice-mark { background: var(--dsw-alias-state-error-primary, #d92d20); color: var(--dsw-static-neutral-bluish-00, #fff); }
.dsh-orb-set-notice.is-wait .dsh-orb-set-notice-mark { border: 2px solid color-mix(in srgb, var(--dsh-orb-accent) 28%, transparent); border-top-color: var(--dsh-orb-accent); animation: dsh-orb-set-spin 0.9s linear infinite; }
.dsh-orb-set-notice.is-info .dsh-orb-set-notice-mark { background: var(--dsh-orb-accent); color: var(--dsw-alias-label-primary-inverted, #fff); font-size: 13px; }
@keyframes dsh-orb-set-spin { to { transform: rotate(360deg); } }
.dsh-orb-set-notice-main { flex: 1; min-width: 0; }
.dsh-orb-set .dsh-orb-set-notice-title { margin: 0; font-size: 14px; font-weight: 600; color: inherit; }
.dsh-orb-set-notice.is-error .dsh-orb-set-notice-title { color: var(--dsw-alias-state-error-primary, #d92d20); }
.dsh-orb-set p.dsh-orb-set-notice-body { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; color: color-mix(in srgb, currentColor 72%, transparent); }
.dsh-orb-set .dsh-orb-set-notice-action { flex: none; margin-left: auto; align-self: center; border: 0; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 12.5px; font-weight: 600; white-space: nowrap; cursor: pointer; background: var(--dsh-orb-accent); color: var(--dsw-alias-label-primary-inverted, #fff); }
.dsh-orb-set .dsh-orb-set-notice-action:hover:enabled { filter: brightness(1.08); }
.dsh-orb-set .dsh-orb-set-notice-action:disabled { opacity: 0.5; cursor: default; }
.dsh-orb-set .dsh-orb-set-notice-action:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; }
.dsh-orb-set-whats-new-head { display: flex; align-items: flex-start; gap: 10px; }
.dsh-orb-set-whats-new-head .dsh-orb-set-notice-title { flex: 1; min-width: 0; }
.dsh-orb-set .dsh-orb-set-whats-new-close { flex: none; margin: -3px -4px 0 0; border: 0; border-radius: 6px; padding: 0 5px; background: transparent; color: inherit; font: inherit; font-size: 20px; line-height: 1.1; opacity: 0.55; cursor: pointer; }
.dsh-orb-set .dsh-orb-set-whats-new-close:hover { opacity: 1; }
.dsh-orb-set .dsh-orb-set-whats-new-close:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; }
.dsh-orb-set-whats-new-list { margin: 8px 0 0; padding-left: 18px; list-style: disc; font-size: 12.5px; line-height: 1.6; color: color-mix(in srgb, currentColor 72%, transparent); }
.dsh-orb-set-whats-new-list li { margin: 3px 0; }
.dsh-orb-set-whats-new-foot { display: flex; justify-content: flex-end; margin-top: 10px; }
.dsh-orb-set-whats-new-foot .dsh-orb-set-notice-action { margin-left: 0; }

/* Permissions */
.dsh-orb-set .dsh-orb-set-tcc-hint { font-size: 12.5px; color: color-mix(in srgb, currentColor 62%, transparent); }
.dsh-orb-set-perms { margin-top: 10px; display: flex; flex-direction: column; border: 1px solid var(--dsh-orb-line-soft); border-radius: 12px; background: var(--dsh-orb-panel); overflow: hidden; }
.dsh-orb-set-perm { display: flex; align-items: center; gap: 14px; padding: 12px 14px; }
.dsh-orb-set-perm + .dsh-orb-set-perm { border-top: 1px dashed color-mix(in srgb, currentColor 10%, transparent); }
.dsh-orb-set-perm-main { flex: 1; min-width: 0; }
.dsh-orb-set-perm-title { display: flex; align-items: center; gap: 8px; }
.dsh-orb-set .dsh-orb-set-perm-title h4 { font-size: 13.5px; font-weight: 600; color: inherit; }
.dsh-orb-set-perm-status { flex: none; font-size: 10.5px; font-weight: 600; line-height: 1.6; padding: 1px 8px; border-radius: 999px; }
.dsh-orb-set-perm-status.is-ok { color: var(--dsw-alias-state-success-primary, #12b76a); background: color-mix(in srgb, #12b76a 13%, transparent); }
.dsh-orb-set-perm-status.is-off { color: var(--dsw-alias-state-warn-primary, #b45309); background: color-mix(in srgb, #d97706 12%, transparent); }
.dsh-orb-set-perm-status.is-wait { color: var(--dsh-orb-accent); background: color-mix(in srgb, var(--dsh-orb-accent) 11%, transparent); }
.dsh-orb-set .dsh-orb-set-perm-reason { margin-top: 2px; font-size: 12px; line-height: 1.45; color: color-mix(in srgb, currentColor 60%, transparent); }
.dsh-orb-set .dsh-orb-set-perm-path { margin-top: 2px; font-size: 11px; line-height: 1.45; color: color-mix(in srgb, currentColor 46%, transparent); }
.dsh-orb-set-perm .dsh-orb-set-button { flex: none; }
.dsh-orb-set .dsh-orb-set-tcc-foot { margin-top: 10px; font-size: 11.5px; line-height: 1.55; color: color-mix(in srgb, currentColor 52%, transparent); }

/* Workspace */
.dsh-orb-set-workspace-top { display: flex; align-items: center; gap: 10px; }
.dsh-orb-set .dsh-orb-set-workspace-path { flex: 1; min-width: 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; color: color-mix(in srgb, currentColor 60%, transparent); }
.dsh-orb-set-badge { flex: none; font-size: 10.5px; font-weight: 600; line-height: 1.6; padding: 1px 8px; border-radius: 999px; color: color-mix(in srgb, currentColor 58%, transparent); background: color-mix(in srgb, currentColor 7%, transparent); }
.dsh-orb-set-badge.is-custom { color: var(--dsh-orb-accent); background: color-mix(in srgb, var(--dsh-orb-accent) 10%, transparent); }
.dsh-orb-set-workspace-controls { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.dsh-orb-set-workspace-controls .dsh-orb-set-actions { margin-left: 0; }
.dsh-orb-set-path {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-align: start; cursor: pointer; border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  background: color-mix(in srgb, currentColor 2%, transparent); color: inherit; border-radius: 8px;
  padding: 7px 10px; font: inherit; font-size: 12px;
  font-family: var(--ds-font-family-code, ui-monospace, monospace);
  transition: border-color 120ms ease;
}
.dsh-orb-set-path:hover:not(:disabled) { border-color: color-mix(in srgb, var(--dsh-orb-accent) 45%, transparent); }
.dsh-orb-set-path:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; }
.dsh-orb-set-path:disabled { opacity: 0.6; cursor: default; }
.dsh-orb-set-pick { flex: none; }

/* History */
.dsh-orb-set-history-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.dsh-orb-set-history-field { flex: none; min-width: 132px; }
.dsh-orb-set .dsh-orb-set-history-hint { margin-top: 10px; font-size: 11.5px; line-height: 1.55; color: color-mix(in srgb, currentColor 52%, transparent); }
.dsh-orb-set .dsh-orb-set-history-last { margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.55; color: color-mix(in srgb, currentColor 52%, transparent); }
.dsh-orb-set .dsh-orb-set-history-last::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary, #12b76a); box-shadow: 0 0 0 3px color-mix(in srgb, #12b76a 14%, transparent); }
.dsh-orb-set-history > .dsh-orb-set-card-body > .dsh-orb-set-banner { display: flex; align-items: center; gap: 7px; margin-top: 10px; font-size: 12px; }
.dsh-orb-set-history > .dsh-orb-set-card-body > .dsh-orb-set-banner::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsh-orb-accent); }

/* Dialogs */
.dsh-orb-set-dialog-backdrop { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.32)); backdrop-filter: blur(2px); }
.dsh-orb-set-dialog {
  width: min(480px, 100%); max-height: min(72vh, 600px); overflow: auto;
  border: 1px solid var(--dsh-orb-line-soft); border-radius: 16px; padding: 22px 22px 20px;
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-3, #fff));
  box-shadow: 0 24px 80px var(--dsw-alias-bg-mask-3, rgba(0, 0, 0, 0.28));
}
.dsh-orb-set-dialog h3 { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
.dsh-orb-set-dialog p { margin: 8px 0; font-size: 13px; line-height: 1.55; color: color-mix(in srgb, currentColor 68%, transparent); overflow-wrap: anywhere; }
.dsh-orb-set-dialog .dsh-orb-set-muted { color: color-mix(in srgb, currentColor 52%, transparent); }
.dsh-orb-set-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.dsh-orb-set-dialog-list { margin: 12px 0 0; padding-left: 20px; max-height: 200px; overflow: auto; }
.dsh-orb-set-dialog-list li { margin: 4px 0; font-size: 12.5px; overflow-wrap: anywhere; }
.dsh-orb-set-dialog-progress { height: 4px; margin: 16px 0 4px; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
.dsh-orb-set-dialog-progress-fill { width: 34%; height: 100%; border-radius: inherit; background: var(--dsh-orb-accent); animation: dsh-orb-set-progress 1.1s ease-in-out infinite; }
@keyframes dsh-orb-set-progress { from { transform: translateX(-110%); } to { transform: translateX(320%); } }

/* Voice: the reference card, unchanged in structure, now sharing the page head */
.dsh-orb-set-idle-body { margin: 0; }
.dsh-orb-set-voice-panel { margin-top: 12px; padding: 14px 15px 15px; border: 1px solid var(--dsh-orb-line-soft); border-radius: 13px; background: var(--dsh-orb-panel); }
.dsh-orb-set-voice-panel-head { display: flex; align-items: center; gap: 11px; }
.dsh-orb-set-voice-panel-icon { flex: none; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--dsh-orb-accent); background: color-mix(in srgb, var(--dsh-orb-accent) 11%, transparent); }
.dsh-orb-set-voice-panel-icon svg { width: 19px; height: 19px; }
.dsh-orb-set-voice-panel-heading { flex: 1; min-width: 0; }
.dsh-orb-set .dsh-orb-set-voice-panel-heading h4 { font-size: 13.5px; font-weight: 600; color: inherit; }
.dsh-orb-set .dsh-orb-set-voice-panel-heading p { margin-top: 2px; font-size: 12px; line-height: 1.45; color: color-mix(in srgb, currentColor 58%, transparent); }
.dsh-orb-set-voice-panel-switch { flex: none; display: flex; align-items: center; gap: 8px; }
.dsh-orb-set-voice-panel-state { font-size: 11px; line-height: 1.6; color: color-mix(in srgb, currentColor 55%, transparent); white-space: nowrap; }
.dsh-orb-set-voice-panel-body { margin-top: 13px; }
.dsh-orb-set-voice-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px 20px; align-items: start; }
.dsh-orb-set-voice-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; font-size: 12px; }
.dsh-orb-set-voice-field.is-wide { grid-column: 1 / -1; }
.dsh-orb-set-voice-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dsh-orb-set-voice-field-label { font-size: 12.5px; font-weight: 500; color: color-mix(in srgb, currentColor 84%, transparent); }
.dsh-orb-set-voice-field-value { flex: none; font-size: 11.5px; font-weight: 600; line-height: 1.4; padding: 1px 8px; border-radius: 999px; color: var(--dsh-orb-accent); background: color-mix(in srgb, var(--dsh-orb-accent) 10%, transparent); font-variant-numeric: tabular-nums; white-space: nowrap; }
.dsh-orb-set-voice-field-scale { display: flex; justify-content: space-between; gap: 8px; font-size: 10.5px; line-height: 1.2; color: color-mix(in srgb, currentColor 52%, transparent); font-variant-numeric: tabular-nums; }
.dsh-orb-set-voice-field-hint { font-size: 11px; line-height: 1.5; color: color-mix(in srgb, currentColor 56%, transparent); }
.dsh-orb-set-voice-link { color: var(--dsh-orb-accent); text-decoration: none; font-weight: 500; }
.dsh-orb-set-voice-link:hover { text-decoration: underline; }
.dsh-orb-set-voice-link:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 2px; border-radius: 4px; }
.dsh-orb-set-voice-field-range { -webkit-appearance: none; appearance: none; width: 100%; height: 20px; margin: 0; padding: 0; background: transparent; cursor: pointer; }
.dsh-orb-set-voice-field-range::-webkit-slider-runnable-track { height: 5px; border-radius: 999px; background: linear-gradient(90deg, var(--dsh-orb-accent) 0 var(--dsh-orb-voice-fill, 0%), color-mix(in srgb, currentColor 13%, transparent) var(--dsh-orb-voice-fill, 0%) 100%); }
.dsh-orb-set-voice-field-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; margin-top: -5.5px; border-radius: 50%; border: 2px solid var(--dsh-orb-accent); background: var(--dsw-alias-bg-overlay, #fff); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22); transition: transform 120ms ease, box-shadow 120ms ease; }
.dsh-orb-set-voice-field-range:hover::-webkit-slider-thumb { transform: scale(1.08); }
.dsh-orb-set-voice-field-range:focus { outline: none; }
.dsh-orb-set-voice-field-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px color-mix(in srgb, var(--dsh-orb-accent) 20%, transparent); }
.dsh-orb-set-voice-field-range::-moz-range-track { height: 5px; border-radius: 999px; background: color-mix(in srgb, currentColor 13%, transparent); }
.dsh-orb-set-voice-field-range::-moz-range-progress { height: 5px; border-radius: 999px; background: var(--dsh-orb-accent); }
.dsh-orb-set-voice-field-range::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; border: 2px solid var(--dsh-orb-accent); background: var(--dsw-alias-bg-overlay, #fff); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22); }
.dsh-orb-set-voice-input { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 9px; background: color-mix(in srgb, currentColor 2.5%, transparent); color: inherit; font: inherit; font-size: 12.5px; line-height: 1.45; padding: 7px 10px; transition: border-color 120ms ease, box-shadow 120ms ease; }
.dsh-orb-set-voice-input:focus { outline: none; border-color: var(--dsh-orb-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsh-orb-accent) 15%, transparent); }
.dsh-orb-set textarea.dsh-orb-set-voice-input { min-height: 56px; resize: vertical; }
.dsh-orb-set-voice-select { position: relative; display: block; }
.dsh-orb-set-voice-select::after { content: ''; position: absolute; right: 13px; top: 50%; width: 6px; height: 6px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: translateY(-70%) rotate(45deg); opacity: 0.5; pointer-events: none; }
.dsh-orb-set-voice-select select { appearance: none; -webkit-appearance: none; padding-right: 30px; }
.dsh-orb-set-voice-seg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: color-mix(in srgb, currentColor 6%, transparent); }
.dsh-orb-set-voice-seg-item { flex: 1; min-width: 0; border: 0; border-radius: 7px; background: transparent; color: color-mix(in srgb, currentColor 68%, transparent); font: inherit; font-size: 12px; font-weight: 500; padding: 6px 8px; cursor: pointer; white-space: nowrap; transition: background 120ms ease, color 120ms ease, box-shadow 120ms ease; }
.dsh-orb-set-voice-seg-item:hover:not(.is-active) { background: color-mix(in srgb, currentColor 5%, transparent); color: inherit; }
.dsh-orb-set-voice-seg-item.is-active { background: var(--dsh-orb-accent); color: var(--dsw-alias-label-primary-inverted, #fff); box-shadow: 0 1px 4px color-mix(in srgb, var(--dsh-orb-accent) 35%, transparent); }
.dsh-orb-set-voice-seg-item:focus-visible { outline: 2px solid var(--dsh-orb-accent); outline-offset: 1px; }
.dsh-orb-set-voice-model-block { margin-top: 14px; padding-top: 12px; border-top: 1px dashed color-mix(in srgb, currentColor 13%, transparent); }
.dsh-orb-set-voice-model { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-orb-set-voice-model-info { display: flex; align-items: center; gap: 9px; min-width: 0; }
.dsh-orb-set-voice-model-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, currentColor 28%, transparent); }
.dsh-orb-set-voice-model-dot.is-ready { background: #12b76a; box-shadow: 0 0 0 3px color-mix(in srgb, #12b76a 16%, transparent); }
.dsh-orb-set-voice-model-dot.is-active { background: var(--dsh-orb-accent); animation: dsh-orb-set-voice-pulse 1.4s ease-in-out infinite; }
@keyframes dsh-orb-set-voice-pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--dsh-orb-accent) 32%, transparent); } 50% { box-shadow: 0 0 0 5px transparent; } }
.dsh-orb-set-voice-model-text { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; }
.dsh-orb-set-voice-model-name { font-size: 12.5px; font-weight: 600; }
.dsh-orb-set-voice-model-state { font-size: 11.5px; color: color-mix(in srgb, currentColor 58%, transparent); }
.dsh-orb-set .dsh-orb-set-voice-action { flex: none; padding: 6px 11px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.dsh-orb-set-voice-model .dsh-orb-set-ghost { border-color: color-mix(in srgb, currentColor 18%, transparent); color: color-mix(in srgb, currentColor 78%, transparent); }
.dsh-orb-set-voice-progress { margin-top: 10px; }
.dsh-orb-set-voice-progress-track { height: 5px; border-radius: 999px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
.dsh-orb-set-voice-progress-track > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--dsh-orb-accent) 65%, #fff), var(--dsh-orb-accent)); transition: width 240ms ease; }
.dsh-orb-set .dsh-orb-set-voice-progress-text { margin: 5px 0 0; font-size: 11px; color: color-mix(in srgb, currentColor 55%, transparent); }
.dsh-orb-set-voice-mic { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 12px; border-radius: 11px; border: 1px solid color-mix(in srgb, #d97706 22%, transparent); background: color-mix(in srgb, #d97706 8%, transparent); }
.dsh-orb-set-voice-mic-icon { flex: none; display: flex; color: var(--dsw-alias-state-warning-primary, #b45309); }
.dsh-orb-set .dsh-orb-set-voice-mic-text { flex: 1; min-width: 0; margin: 0; font-size: 12px; line-height: 1.45; color: inherit; }

@media (max-width: 620px) {
  .dsh-orb-set-head { flex-wrap: wrap; }
  .dsh-orb-set-head-control { margin-left: 0; padding-left: 50px; }
  .dsh-orb-set-head-state { display: none; }
  .dsh-orb-set-voice-panel-switch .dsh-orb-set-voice-panel-state { display: none; }
  .dsh-orb-set-avatar-row { align-items: flex-start; }
  .dsh-orb-set-actions { margin-left: 0; }
  .dsh-orb-set-workspace-controls { flex-wrap: wrap; }
  .dsh-orb-set-path { flex-basis: 100%; }
  .dsh-orb-set-history-row { align-items: flex-start; flex-direction: column; }
  .dsh-orb-set-history-field { width: 100%; }
  .dsh-orb-set-workspace-controls .dsh-orb-set-actions { width: 100%; justify-content: flex-end; }
  .dsh-orb-set-voice-model { flex-wrap: wrap; }
  .dsh-orb-set-model-fields { grid-template-columns: 1fr; }
  .dsh-orb-set-more { flex-basis: 100%; margin-left: 0; }
}
`

    /** Settings-section id of this page; the ball's menu row asks the shell to show exactly this one. */
    const SECTION_ID = 'orb'

    const inject = ['slots']

    function apply(ctx) {
      // Rewrite the node, don't just skip when it exists: a hot reload keeps the previous
      // run's <style> in the document, and an early return would leave old rules applied
      // to markup that already expects the new ones.
      let styleNode = document.getElementById('dsh-orb-settings-style')
      if (!styleNode) {
        styleNode = document.createElement('style')
        styleNode.id = 'dsh-orb-settings-style'
        document.head.append(styleNode)
      }
      styleNode.textContent = style
      /**
       * Show the floating-ball section in the main window's settings modal, switching
       * away from whichever section is up. The shell owns modal visibility: its store
       * handle is the ledger currency of the `sidebar.settings` entry, and its create()
       * hands back the mounted instance, whose openSection also opens the modal. Reports
       * false when no shell can be reached yet, so the caller leaves the ball's request
       * armed and retries instead of dropping the click.
       */
      function showOrbSettings() {
        let entries
        let sections
        try {
          entries = ctx.slots.entries('sidebar.settings')
          sections = ctx.slots.entries('settings.section')
        } catch {
          return false
        }
        // openSection does not validate its id: opening one this page no longer occupies
        // would show the panel with no matching nav row and nothing in it.
        const ours = (sections ?? []).some((entry) => entry && entry.options && entry.options.id === SECTION_ID)
        if (!ours) return false
        for (const entry of entries ?? []) {
          // The handle rides the entry itself: SlotCore keeps only id/order/label/priority
          // inside `options`, and the mounted-store axis resolves `entry.store`.
          const handle = entry === undefined || entry === null
            ? undefined
            : entry.store ?? (entry.options === undefined ? undefined : entry.options.store)
          if (!handle || typeof handle !== 'object' || typeof handle.create !== 'function') continue
          let instance
          try {
            // A mounted shell returns the same instance every time; a bare store handle
            // would mint a fresh, invisible one per call — opening that helps nobody.
            instance = handle.create()
            if (instance !== handle.create()) continue
          } catch {
            continue
          }
          const openSection = instance && instance.actions ? instance.actions.openSection : undefined
          if (typeof openSection !== 'function') continue
          try {
            openSection(SECTION_ID)
          } catch {
            return false
          }
          return true
        }
        return false
      }
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: SECTION_ID,
        order: 25,
        label: () => copy().nav,
        inject: () => ({}),
      }, OrbSettingsSection))
      // Main-window bridge. The ball cannot reach this window, so it arms targets on the
      // host and this page consumes them. Bookmark jumps open a session through the
      // workspace navigator: a bare sessions.retain would stack a second mainView
      // reference while the current session keeps its own, and the main view would never
      // move. The settings row asks this page to show the floating-ball section the ball
      // belongs to. Both are confirmed with a POST via request() — mutate() lives inside
      // the settings component and is not in scope here.
      ctx.effect(() => {
        let openedKey = ''
        let openedSettingsAt = 0
        const poll = setInterval(() => { void consume(); void consumeSettings() }, 2000)
        async function consume() {
          let target
          try {
            target = await request('/.dsh-orb/jump')
          } catch {
            return
          }
          const sessionId = target && typeof target.sessionId === 'string' ? target.sessionId : ''
          if (sessionId === '') {
            openedKey = ''
            return
          }
          // The arm timestamp makes the key: reading the same armed target
          // twice means the earlier confirm failed — re-confirm only, never
          // re-open, or every poll would yank the main view back.
          const key = `${sessionId}:${typeof target.at === 'number' ? target.at : 0}`
          if (key !== openedKey) {
            let workspace
            try {
              workspace = ctx.get('uiWorkspace')
            } catch {
              workspace = undefined
            }
            if (workspace === undefined || typeof workspace.openSession !== 'function') return
            try {
              workspace.openSession(sessionId)
            } catch {
              // The session may not be listed yet; the target stays armed until it expires.
              return
            }
            openedKey = key
          }
          try {
            await request('/.dsh-orb/jump', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ sessionId }),
            })
          } catch {
            // Consuming is best-effort; the same-target guard above stops any yank loop.
          }
        }
        async function consumeSettings() {
          let target
          try {
            target = await request('/.dsh-orb/settings-open')
          } catch {
            return
          }
          const at = target && typeof target.at === 'number' ? target.at : 0
          if (at === 0) {
            openedSettingsAt = 0
            return
          }
          // Same guard as jumps, keyed on the arm timestamp: a confirm that got lost
          // re-confirms on the next poll instead of re-opening the panel.
          if (at !== openedSettingsAt) {
            if (!showOrbSettings()) {
              // The settings shell is not on the ledger yet (a cold launch composes
              // plugins after the first poll); the target stays armed and we retry.
              return
            }
            openedSettingsAt = at
          }
          try {
            await request('/.dsh-orb/settings-open', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ at }),
            })
          } catch {
            // Consuming is best-effort; the arm timestamp guard stops any reopen loop.
          }
        }
        return () => {
          clearInterval(poll)
        }
      }, 'dsh-orb: main-window bridge')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
    })();
    // ===== END vendored dsh-orb client =====

    function apply(ctx) {
      if (typeof document === 'undefined' || !document.body) return;
      report('module', { build: CLIENT_BUILD });
      try {
        window.addEventListener('error', (event) => {
          report('error', {
            message: String(event?.message || ''),
            stack: String(event?.error?.stack || '').slice(0, 500),
          });
        });
        window.addEventListener('unhandledrejection', (event) => {
          report('rejection', { message: String(event?.reason?.message || event?.reason || '') });
        });
      } catch {
        /* ignore */
      }
      ensureStyle();
      // The floating-ball settings section from dsh-orb. It registers on the
      // same slot service `slots` and starts the ball's jump/settings bridge
      // poll; a shell without those slots just gets no section.
      try {
        __orbUi.apply(ctx);
        document.documentElement.dataset.whalegoOrb = '1';
      } catch (error) {
        report('orb-ui', { message: String(error?.message || error) });
      }
      try {
        document.documentElement.dataset.whalegoClient = '1';
      } catch {
        /* ignore */
      }
      let headerOk = false;
      try {
        headerOk = mountHeaderActions(ctx);
      } catch {
        /* ignore */
      }
      try {
        document.documentElement.dataset.whalegoSlot = mountNativeTrigger(ctx) ? '1' : '0';
        document.documentElement.dataset.whalegoHeader = headerOk ? '1' : '0';
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
