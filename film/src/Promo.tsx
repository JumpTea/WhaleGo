import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FPS = 60;
const at = (seconds: number) => Math.round(seconds * FPS);

const C = {
  ink: "#050B16",
  ink2: "#081426",
  panel: "#0B1A30",
  blue: "#4E6FFF",
  blueSoft: "#8EA8FF",
  cyan: "#36E2C7",
  cyanSoft: "#9DF5E8",
  pink: "#FF8FB8",
  amber: "#FFC46B",
  red: "#FF6B7A",
  white: "#F4F8FF",
  muted: "#8FA6BF",
  line: "rgba(143,166,191,0.18)",
};

const FONT_EN = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
const FONT_CN = '"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
const FONT_MONO = '"Cascadia Mono", "Consolas", "SFMono-Regular", monospace';

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function ease(frame: number, start: number, duration: number) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    ...clamp,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
}

function rise(frame: number, start: number, duration = 20, distance = 34) {
  const p = ease(frame, start, duration);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
  };
}

function slide(frame: number, start: number, duration = 22, distance = 80) {
  const p = ease(frame, start, duration);
  return {
    opacity: p,
    transform: `translateX(${(1 - p) * distance}px)`,
  };
}

function Shot({
  duration,
  children,
  fade = 10,
  instant = true,
}: {
  duration: number;
  children: React.ReactNode;
  fade?: number;
  instant?: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = instant
    ? 1
    : interpolate(frame, [-1, 0, duration - fade, duration], [1, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function Eyebrow({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: 16,
        letterSpacing: 7,
        textTransform: "uppercase",
        color,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

function Headline({
  children,
  size = 96,
  color = C.white,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: FONT_EN,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 0.92,
        letterSpacing: -4,
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Sub({ children, size = 28, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: FONT_CN,
        fontSize: size,
        lineHeight: 1.7,
        color: C.muted,
        letterSpacing: 0.6,
        marginTop: 22,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Mono({ children, color = C.muted, size = 13, style }: { children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        fontSize: size,
        letterSpacing: 2.4,
        color,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Backdrop({ tone = "blue", dim = 0 }: { tone?: "blue" | "deep"; dim?: number }) {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 170) * 26;
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background:
            tone === "deep"
              ? "radial-gradient(82% 74% at 68% 18%, #0B1B34 0%, #06101F 48%, #030812 100%)"
              : "radial-gradient(90% 78% at 70% 18%, #10254A 0%, #071326 48%, #030812 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(143,166,191,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(143,166,191,0.07) 1px, transparent 1px)",
          backgroundSize: "84px 84px",
          backgroundPosition: `${drift}px ${drift / 2}px`,
          maskImage: "radial-gradient(72% 68% at 58% 44%, black 18%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1040,
          height: 1040,
          left: 780 + drift,
          top: -360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(78,111,255,0.28) 0%, rgba(78,111,255,0) 68%)",
          filter: "blur(26px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 840,
          height: 840,
          left: -300 - drift,
          bottom: -360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(54,226,199,0.14) 0%, rgba(54,226,199,0) 68%)",
          filter: "blur(30px)",
        }}
      />
      {Array.from({ length: 26 }).map((_, i) => {
        const x = (i * 317 + 91) % 1920;
        const y = 80 + ((i * 181) % 860);
        const s = 1 + (i % 3);
        const o = 0.08 + (i % 5) * 0.025;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: "50%",
              background: i % 4 === 0 ? C.cyan : C.blueSoft,
              opacity: o,
              transform: `translateY(${Math.sin(frame / 28 + i) * 6}px)`,
            }}
          />
        );
      })}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.045, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 45%, transparent 38%, rgba(2,6,12,${0.72 + dim}) 100%)` }} />
    </AbsoluteFill>
  );
}

function Sonar({ cx, cy, base = 120, count = 4, color = C.cyan, speed = 1 }: { cx: number; cy: number; base?: number; count?: number; color?: string; speed?: number }) {
  const frame = useCurrentFrame();
  const p = ((frame * speed) % 150) / 150;
  return (
    <svg width={1400} height={1400} viewBox="-700 -700 1400 1400" style={{ position: "absolute", left: cx - 700, top: cy - 700, overflow: "visible" }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = base + i * 84 + p * 22;
        return (
          <circle
            key={i}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={i === 0 ? 1.6 : 1}
            strokeDasharray={i === 0 ? "2 11" : "1 15"}
            opacity={0.3 - i * 0.052}
          />
        );
      })}
    </svg>
  );
}

function Orb({
  size = 240,
  frame,
  active = true,
  style,
  variant = "aurora",
}: {
  size?: number;
  frame: number;
  active?: boolean;
  style?: React.CSSProperties;
  variant?: "aurora" | "minimal" | "pixel";
}) {
  const pulse = active ? 1 + Math.sin(frame / 17) * 0.035 : 0.9;
  const spin = frame * 0.22;
  return (
    <div style={{ width: size, height: size, position: "relative", transform: `scale(${pulse})`, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: -size * 0.5,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(78,111,255,0.52) 0%, rgba(54,226,199,0.12) 46%, transparent 70%)",
          filter: `blur(${size * 0.16}px)`,
          opacity: active ? 0.95 : 0.42,
        }}
      />
      {[1.24, 1.46, 1.68].map((k, i) => (
        <div
          key={k}
          style={{
            position: "absolute",
            inset: -size * (k - 1) * 0.5,
            borderRadius: "50%",
            border: `1px solid rgba(157,245,232,${0.26 - i * 0.06})`,
            transform: `scale(${1 + Math.sin(frame / 26 + i * 1.3) * 0.018})`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          background:
            variant === "minimal"
              ? "radial-gradient(circle at 38% 30%, #F0FAFF 0%, #A8D8FF 18%, #6A93FF 48%, #2344B8 78%, #0B1B52 100%)"
              : "radial-gradient(circle at 34% 27%, #F0FAFF 0%, #B8DCFF 12%, #6F9BFF 34%, #345BFF 58%, #132B86 82%, #09163F 100%)",
          boxShadow: "inset -20px -24px 42px rgba(3,10,30,0.62), inset 12px 14px 28px rgba(255,255,255,0.22), 0 0 0 1px rgba(180,220,255,0.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "64%",
            height: "50%",
            left: "6%",
            top: "12%",
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 40%, rgba(255,255,255,0.85), rgba(185,225,255,0.18) 48%, transparent 72%)",
            filter: "blur(8px)",
            transform: `rotate(${spin}deg)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "58%",
            height: "40%",
            right: "-5%",
            bottom: "13%",
            borderRadius: "50%",
            background: "radial-gradient(circle at 55% 55%, rgba(54,226,199,0.5), rgba(54,226,199,0.08) 46%, transparent 70%)",
            filter: "blur(7px)",
            transform: `rotate(${-spin * 0.7}deg)`,
          }}
        />
        {variant === "pixel" ? (
          <Img
            src={staticFile("whale.png")}
            style={{
              position: "absolute",
              width: "86%",
              left: "7%",
              top: "20%",
              filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.45))",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function Waveform({ frame, bars = 7, color = C.cyan, height = 26, stopped = false }: { frame: number; bars?: number; color?: string; height?: number; stopped?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const live = 5 + (Math.sin(frame / 6 + i * 1.8) * 0.5 + 0.5) * (height - 6);
        const h = stopped ? 3 : live;
        return <div key={i} style={{ width: 3, height: h, borderRadius: 2, background: stopped ? C.red : color, opacity: 0.9 }} />;
      })}
    </div>
  );
}

function Wordmark({ size = 72, cn = false }: { size?: number; cn?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <div style={{ fontFamily: FONT_EN, fontWeight: 800, fontSize: size, letterSpacing: -size * 0.045, color: C.white }}>
        Whale<span style={{ color: C.cyan }}>Go</span>
      </div>
      {cn ? <div style={{ fontFamily: FONT_CN, fontSize: size * 0.34, color: C.cyan, letterSpacing: 5 }}>鲸语</div> : null}
    </div>
  );
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        height: 42,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        color: dark ? "#111" : C.white,
        fontFamily: FONT_EN,
        fontSize: 13,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <span>09:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[3, 5, 7, 9].map((h) => (
          <div key={h} style={{ width: 3, height: h, borderRadius: 1, background: "currentColor", opacity: 0.85 }} />
        ))}
        <div style={{ width: 22, height: 10, border: "1px solid currentColor", borderRadius: 2, opacity: 0.75, marginLeft: 4 }}>
          <div style={{ width: 15, height: 6, margin: 1, borderRadius: 1, background: "currentColor" }} />
        </div>
      </div>
    </div>
  );
}

function Phone({
  children,
  width = 460,
  height = 920,
  style,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 58,
        padding: 11,
        background: "linear-gradient(150deg, #2A3A56 0%, #0D1626 30%, #050A12 70%, #24344D 100%)",
        boxShadow: "0 70px 140px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 0 1px rgba(255,255,255,0.08)",
        position: "relative",
        ...style,
      }}
    >
      <div style={{ position: "absolute", right: -3, top: 208, width: 3, height: 74, borderRadius: 3, background: "#1A2638" }} />
      <div style={{ position: "absolute", right: -3, top: 300, width: 3, height: 42, borderRadius: 3, background: "#1A2638" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 48,
          overflow: "hidden",
          background: "#050B16",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 102,
            height: 28,
            borderRadius: 20,
            background: "#02060C",
            zIndex: 8,
          }}
        />
        {children}
      </div>
    </div>
  );
}

function ChatHeader({ title = "WhaleGo", sub = "VOICE / LIVE" }: { title?: string; sub?: string }) {
  return (
    <div style={{ padding: "52px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 14, height: 2, background: C.white, boxShadow: `0 5px 0 ${C.white}, 0 -5px 0 ${C.white}` }} />
        </div>
        <div>
          <div style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: 17, color: C.white }}>{title}</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: C.cyan, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 3 }}>
          {[5, 8, 5].map((h, i) => (
            <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: C.muted }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text, opacity = 1 }: { text: string; opacity?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 18px", opacity }}>
      <div
        style={{
          maxWidth: "84%",
          padding: "13px 17px",
          borderRadius: "22px 22px 7px 22px",
          background: "linear-gradient(140deg, #4E6FFF 0%, #3457D5 100%)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 12px 30px rgba(24,60,160,0.28)",
          fontFamily: FONT_CN,
          fontSize: 15,
          lineHeight: 1.55,
          color: "#F8FBFF",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function VoiceLine({ text, frame, start = 0, stopped = false }: { text: string; frame: number; start?: number; stopped?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 16px", alignItems: "flex-start" }}>
      <div style={{ marginTop: 3, flexShrink: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #DFF4FF, #5B8BFF 48%, #19307F)", boxShadow: "0 0 18px rgba(78,111,255,0.5)" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <Mono color={stopped ? C.red : C.cyan} size={9}>
            {stopped ? "STOPPED" : "VOICE"}
          </Mono>
          <Waveform frame={frame - start} bars={5} height={12} stopped={stopped} />
        </div>
        <div style={{ fontFamily: FONT_CN, fontSize: 14.5, lineHeight: 1.55, color: stopped ? "rgba(244,248,255,0.65)" : C.white }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function AssistantText({ children, opacity = 1, small = false }: { children: React.ReactNode; opacity?: number; small?: boolean }) {
  return (
    <div
      style={{
        padding: "6px 18px 10px 52px",
        fontFamily: FONT_CN,
        fontSize: small ? 13.5 : 15,
        lineHeight: 1.78,
        color: "rgba(244,248,255,0.9)",
        opacity,
      }}
    >
      {children}
    </div>
  );
}

function Stream({ text, frame, start, cps = 20, style }: { text: string; frame: number; start: number; cps?: number; style?: React.CSSProperties }) {
  const n = Math.max(0, Math.min(text.length, Math.floor(((frame - start) / FPS) * cps)));
  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, n)}
      {n > 0 && n < text.length ? <span style={{ color: C.cyan }}>▍</span> : null}
    </span>
  );
}

function MiniTable({ frame, start }: { frame: number; start: number }) {
  const rows = [
    ["推理", 92, C.cyan],
    ["代码", 86, C.blueSoft],
    ["长上下文", 96, C.amber],
  ] as const;
  return (
    <div style={{ margin: "6px 0 4px", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
      {rows.map(([label, value, color], i) => {
        const p = ease(frame, start + i * 8, 18);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: i ? `1px solid ${C.line}` : undefined }}>
            <div style={{ width: 64, fontFamily: FONT_CN, fontSize: 12.5, color: C.muted }}>{label}</div>
            <div style={{ flex: 1, height: 5, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${value * p}%`, height: "100%", borderRadius: 4, background: color }} />
            </div>
            <Mono size={10} color={C.white} style={{ width: 28, textAlign: "right" }}>{value}</Mono>
          </div>
        );
      })}
    </div>
  );
}

function Composer({ frame, label = "Ask WhaleGo", listening = true, stopped = false, note = true }: { frame: number; label?: string; listening?: boolean; stopped?: boolean; note?: boolean }) {
  const pulse = listening && !stopped ? 1 + Math.sin(frame / 11) * 0.05 : 1;
  return (
    <div style={{ padding: "10px 16px 26px", flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px 9px 16px",
          borderRadius: 30,
          border: `1px solid ${C.line}`,
          background: "rgba(14,26,46,0.92)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.38)",
        }}
      >
        <div style={{ flex: 1, fontFamily: FONT_CN, fontSize: 13.5, color: C.muted }}>{label}</div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: stopped ? C.red : listening ? "linear-gradient(145deg, #5B8BFF, #2C4BC4)" : "rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${pulse})`,
            boxShadow: listening && !stopped ? "0 0 24px rgba(78,111,255,0.45)" : "none",
          }}
        >
          {stopped ? (
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#fff" }} />
          ) : (
            <div style={{ width: 9, height: 14, borderRadius: 5, background: "#fff", boxShadow: "0 0 0 1px rgba(255,255,255,0.3)" }} />
          )}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.white, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0A1424" }} />
        </div>
      </div>
      {note ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 10 }}>
          <Mono size={8} color={C.muted}>NO SUBTITLES</Mono>
          <Mono size={8} color={C.muted}>NO DANMAKU</Mono>
          <Mono size={8} color={C.cyan}>IN THE THREAD</Mono>
        </div>
      ) : null}
    </div>
  );
}

function PhoneThread({ frame, mode = "ask" }: { frame: number; mode?: "ask" | "answer" }) {
  const ask = mode === "ask";
  return (
    <>
      <StatusBar />
      <ChatHeader sub={ask ? "VOICE / LISTENING" : "VOICE / ANSWERING"} />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ paddingTop: 8 }}>
          <UserBubble text="帮我对比这三款模型，做个选型建议。" opacity={ask ? ease(frame, 40, 16) : 1} />
          <div style={{ height: 8 }} />
          <VoiceLine text={ask ? "先说说你的使用场景，我再往下查。" : "行，我来查查。"} frame={frame} start={ask ? 96 : 8} />
          {!ask ? (
            <AssistantText opacity={ease(frame, 36, 18)}>
              <Stream
                text={"先看三个维度：推理、代码和长上下文。\n如果主要写代码，优先看代码能力；如果读长文档，优先看上下文窗口。"}
                frame={frame}
                start={36}
                cps={22}
              />
              <MiniTable frame={frame} start={96} />
              <div style={{ marginTop: 8, color: C.muted, fontSize: 12 }}>示意数据 · 用于演示双脑节奏</div>
            </AssistantText>
          ) : null}
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: ask ? 280 : 300,
            transform: "translateX(-50%)",
            opacity: ask ? interpolate(frame, [60, 90], [0, 1], clamp) : 0,
          }}
        >
          <Orb size={190} frame={frame} active={!!ask} />
        </div>
        <div style={{ position: "absolute", left: 18, bottom: 12, right: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, background: "rgba(9,20,36,0.9)", border: `1px solid ${C.line}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ask ? C.cyan : C.blue }} />
            <Mono size={9} color={C.muted}>{ask ? "LISTENING · 0:04" : "ANSWER STREAMING · 0:12"}</Mono>
            <div style={{ flex: 1 }} />
            <Waveform frame={frame} bars={9} height={16} stopped={!ask} />
          </div>
        </div>
      </div>
      <Composer frame={frame} listening={ask} stopped={!ask} />
    </>
  );
}

function S1Hook({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const title = ease(frame, -16, 26);
  return (
    <Shot duration={duration} instant>
      <Backdrop />
      <div style={{ position: "absolute", left: 132, top: 292, width: 940 }}>
        <div style={{ ...rise(frame, 2, 20) }}>
          <Eyebrow>DSH-GO / DUAL-BRAIN VOICE</Eyebrow>
        </div>
        <div style={{ overflow: "hidden", paddingBottom: 10 }}>
          <div style={{ transform: `translateY(${(1 - title) * 110}px)` }}>
            <div style={{ fontFamily: FONT_EN, fontWeight: 800, fontSize: 166, lineHeight: 0.86, letterSpacing: -10, color: C.white }}>
              Whale<span style={{ color: C.cyan }}>Go</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, ...rise(frame, 18, 20) }}>
          <div style={{ fontFamily: FONT_CN, fontSize: 38, letterSpacing: 8, color: C.cyan }}>鲸语</div>
          <div style={{ width: 56, height: 1, background: C.line }} />
          <Mono size={12}>VOICE + TEXT, IN ONE THREAD</Mono>
        </div>
        <div style={{ ...rise(frame, 30, 20), marginTop: 54, maxWidth: 760 }}>
          <div style={{ fontFamily: FONT_EN, fontWeight: 600, fontSize: 34, color: "rgba(244,248,255,0.82)", letterSpacing: -0.5 }}>
            Hear it first. Read it after.
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", right: 168, top: 246 }}>
        <Sonar cx={230} cy={240} base={160} count={5} />
        <Orb size={440} frame={frame} />
      </div>

      <div style={{ position: "absolute", left: 132, bottom: 58, display: "flex", gap: 24 }}>
        <Mono size={11}>48 SECONDS</Mono>
        <Mono size={11} color={C.cyan}>60 FPS</Mono>
        <Mono size={11}>NO SUBTITLES</Mono>
      </div>
      <div style={{ position: "absolute", right: 168, bottom: 58, textAlign: "right" }}>
        <Mono size={10}>WHALEGO / 2026</Mono>
      </div>
    </Shot>
  );
}

function S2Problem({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const left = spring({ frame: frame - 4, fps: FPS, config: { damping: 20, mass: 0.8 } });
  const right = spring({ frame: frame - 14, fps: FPS, config: { damping: 20, mass: 0.8 } });
  const cut = ease(frame, 86, 30);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", left: 112, top: 92, ...rise(frame, 0, 18) }}>
        <Eyebrow>THE TRADE-OFF</Eyebrow>
      </div>
      <div style={{ position: "absolute", left: 112, top: 150, width: 1080, ...rise(frame, 4, 24) }}>
        <Headline size={92}>
          YOU CAN&apos;T HAVE
          <br />
          <span style={{ color: C.cyan }}>BOTH</span> AT ONCE.
        </Headline>
        <Sub size={26}>说得快，往往浅；写得深，又太慢。</Sub>
      </div>

      <div
        style={{
          position: "absolute",
          left: 112,
          top: 520,
          width: 790,
          height: 380,
          borderRadius: 26,
          border: `1px solid ${C.line}`,
          background: "linear-gradient(155deg, rgba(13,31,58,0.9), rgba(7,17,33,0.86))",
          boxShadow: "0 40px 90px rgba(0,0,0,0.35)",
          padding: 34,
          opacity: left,
          transform: `translateX(${(1 - left) * -80}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Mono color={C.cyan}>01 / SPEECH</Mono>
          <Mono size={9}>ONE CHANNEL</Mono>
        </div>
        <Headline size={78} color={C.cyan} style={{ marginTop: 18 }}>SAY</Headline>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
          <Waveform frame={frame} bars={22} height={62} />
          <div style={{ fontFamily: FONT_EN, fontSize: 21, color: "rgba(244,248,255,0.75)", lineHeight: 1.4 }}>
            Fast. Shallow.<br />Gone in seconds.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 112,
          top: 584,
          width: 790,
          height: 380,
          borderRadius: 26,
          border: `1px solid ${C.line}`,
          background: "linear-gradient(155deg, rgba(14,27,49,0.92), rgba(7,15,29,0.86))",
          boxShadow: "0 40px 90px rgba(0,0,0,0.35)",
          padding: 34,
          opacity: right,
          transform: `translateX(${(1 - right) * 80}px)`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Mono color={C.blueSoft}>02 / TEXT</Mono>
          <Mono size={9}>ONE CHANNEL</Mono>
        </div>
        <Headline size={78} color={C.blueSoft} style={{ marginTop: 18 }}>WRITE</Headline>
        <div style={{ marginTop: 24, width: "92%" }}>
          {[0.92, 0.76, 0.84, 0.6, 0.72].map((w, i) => (
            <div
              key={i}
              style={{
                height: 9,
                width: `${w * 100}%`,
                marginBottom: 10,
                borderRadius: 2,
                background: i === 0 ? "rgba(142,168,255,0.55)" : "rgba(143,166,191,0.2)",
                transform: `scaleX(${interpolate(frame, [28 + i * 8, 66 + i * 8], [0.1, 1], clamp)})`,
                transformOrigin: "left",
              }}
            />
          ))}
          <div style={{ fontFamily: FONT_EN, fontSize: 21, color: "rgba(244,248,255,0.75)", lineHeight: 1.4, marginTop: 18 }}>
            Deep. Slow.<br />Minutes to read.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 944,
          top: 500,
          width: 3,
          height: 440,
          background: `linear-gradient(180deg, transparent, ${C.cyan}, transparent)`,
          opacity: cut,
          boxShadow: `0 0 38px ${C.cyan}`,
        }}
      />
    </Shot>
  );
}

function S3Dual({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const dash = interpolate(frame, [12, 110], [1, 0], clamp);
  const converge = ease(frame, 118, 40);
  return (
    <Shot duration={duration}>
      <Backdrop />
      <div style={{ position: "absolute", left: 112, top: 92, width: 920, ...rise(frame, 0, 20) }}>
        <Eyebrow>WHALEGO / DUAL BRAIN</Eyebrow>
        <Headline size={96}>
          TWO BRAINS.
          <br />
          <span style={{ color: C.cyan }}>ONE THREAD.</span>
        </Headline>
        <Sub size={25}>一个先说，一个后写。</Sub>
      </div>

      <div
        style={{
          position: "absolute",
          left: 130,
          top: 560,
          width: 420,
          height: 300,
          borderRadius: 24,
          border: `1px solid ${C.line}`,
          background: "linear-gradient(160deg, rgba(12,30,52,0.92), rgba(6,15,29,0.9))",
          padding: 28,
          ...slide(frame, 20, 24, -50),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Mono color={C.cyan}>VOICE BRAIN</Mono>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 14px ${C.cyan}` }} />
        </div>
        <div style={{ marginTop: 28 }}>
          <Waveform frame={frame} bars={13} height={54} />
        </div>
        <div style={{ fontFamily: FONT_CN, fontSize: 19, lineHeight: 1.7, color: "rgba(244,248,255,0.82)", marginTop: 22 }}>
          先接住你。<br />
          <span style={{ color: C.cyan }}>一句话，马上出声。</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 130,
          top: 560,
          width: 420,
          height: 300,
          borderRadius: 24,
          border: `1px solid ${C.line}`,
          background: "linear-gradient(160deg, rgba(12,30,52,0.92), rgba(6,15,29,0.9))",
          padding: 28,
          ...slide(frame, 28, 24, 50),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Mono color={C.blueSoft}>TEXT BRAIN</Mono>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.blueSoft, boxShadow: `0 0 14px ${C.blueSoft}` }} />
        </div>
        <div style={{ marginTop: 26 }}>
          {[0.9, 0.7, 0.82, 0.66].map((w, i) => (
            <div
              key={i}
              style={{
                height: 8,
                width: `${w * 100}%`,
                marginBottom: 10,
                borderRadius: 2,
                background: i === 0 ? "rgba(142,168,255,0.6)" : "rgba(143,166,191,0.18)",
                transform: `scaleX(${interpolate(frame, [40 + i * 8, 80 + i * 8], [0.1, 1], clamp)})`,
                transformOrigin: "left",
              }}
            />
          ))}
        </div>
        <div style={{ fontFamily: FONT_CN, fontSize: 19, lineHeight: 1.7, color: "rgba(244,248,255,0.82)", marginTop: 18 }}>
          把答案写全。<br />
          <span style={{ color: C.blueSoft }}>不照顾语音速度。</span>
        </div>
      </div>

      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="lineA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={C.cyan} stopOpacity="0" />
            <stop offset="0.6" stopColor={C.cyan} stopOpacity="0.9" />
            <stop offset="1" stopColor={C.cyan} stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="lineB" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={C.blueSoft} stopOpacity="0" />
            <stop offset="0.6" stopColor={C.blueSoft} stopOpacity="0.9" />
            <stop offset="1" stopColor={C.blueSoft} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M 550 710 C 720 710 760 560 920 560" fill="none" stroke="url(#lineA)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={dash} />
        <path d="M 1370 710 C 1200 710 1160 560 1000 560" fill="none" stroke="url(#lineB)" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={dash} />
      </svg>

      <div
        style={{
          position: "absolute",
          left: 860,
          top: 522,
          width: 200,
          height: 76,
          borderRadius: 38,
          border: `1px solid rgba(54,226,199,0.48)`,
          background: "rgba(7,20,36,0.94)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_MONO,
          fontSize: 11,
          letterSpacing: 2,
          color: C.cyan,
          opacity: converge,
          boxShadow: "0 0 40px rgba(54,226,199,0.18)",
        }}
      >
        SAME THREAD
      </div>
    </Shot>
  );
}

function S4Voice({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const phone = spring({ frame: frame - 2, fps: FPS, config: { damping: 18, mass: 0.9 } });
  return (
    <Shot duration={duration}>
      <Backdrop />
      <div style={{ position: "absolute", left: 112, top: 168, width: 780 }}>
        <div style={{ ...rise(frame, 0, 20) }}>
          <Eyebrow>VOICE MODE / IN THE THREAD</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={88}>
            SPEAK.
            <br />
            <span style={{ color: C.cyan }}>STAY.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 22, 22) }}>
          <Sub size={26}>开口就行。转写直接进会话，不是字幕。</Sub>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 34, ...rise(frame, 42, 20) }}>
          {["NO SUBTITLES", "NO DANMAKU", "NO EXTRA WINDOW"].map((t) => (
            <div key={t} style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 1.6, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 16, padding: "8px 10px" }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 42, paddingLeft: 18, borderLeft: `2px solid ${C.cyan}`, ...rise(frame, 58, 20) }}>
          <div style={{ fontFamily: FONT_EN, fontSize: 24, color: "rgba(244,248,255,0.82)", lineHeight: 1.5 }}>
            The transcript is a message.
            <br />
            The answer is right below it.
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 210,
          top: 58,
          transform: `translateY(${(1 - phone) * 60}px) scale(${0.96 + phone * 0.04})`,
          opacity: phone,
        }}
      >
        <Phone width={500} height={960}>
          <PhoneThread frame={frame} mode="ask" />
        </Phone>
      </div>
    </Shot>
  );
}

function S5Answer({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const push = interpolate(frame, [0, 120], [0, 42], clamp);
  const answerOpacity = ease(frame, 26, 18);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", left: 112, top: 160, width: 800 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow>VOICE SPEAKS / TEXT WRITES</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 22) }}>
          <Headline size={90}>
            TWO SPEEDS.
            <br />
            <span style={{ color: C.cyan }}>ONE THREAD.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 24, 20) }}>
          <Sub size={25}>语音先出声，文字把答案写全。</Sub>
        </div>

        <div style={{ marginTop: 54, display: "flex", flexDirection: "column", gap: 18, width: 620 }}>
          {[
            ["VOICE", "2s", 26, C.cyan],
            ["TEXT", "8s", 88, C.blueSoft],
          ].map(([label, time, width, color], i) => (
            <div key={label as string} style={{ opacity: ease(frame, 30 + i * 12, 18) }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Mono color={color as string} size={11}>{label}</Mono>
                <Mono size={10}>{time}</Mono>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: `${width}%`, height: "100%", borderRadius: 4, background: color as string }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 46, ...rise(frame, 60, 20) }}>
          <div style={{ fontFamily: FONT_CN, fontSize: 21, lineHeight: 1.8, color: "rgba(244,248,255,0.8)" }}>
            语音转写占满时，文字答案自然往下走。
            <br />
            不抢行，也不等语音。
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 160,
          top: 42,
          transform: `translateY(${push}px)`,
          opacity: ease(frame, 4, 20),
        }}
      >
        <Phone width={540} height={1000}>
          <StatusBar />
          <ChatHeader sub="VOICE / ANSWERING" />
          <div style={{ flex: 1, overflow: "hidden", position: "relative", paddingTop: 2 }}>
            <UserBubble text="帮我对比这三款模型，做个选型建议。" />
            <VoiceLine text="行，我来查查。先看推理、代码和长上下文。" frame={frame} start={20} />
            <AssistantText opacity={answerOpacity}>
              <Stream
                text={"先看三个维度：推理、代码、长上下文。"}
                frame={frame}
                start={50}
                cps={20}
              />
            </AssistantText>
            <div style={{ padding: "0 18px 0 52px", opacity: answerOpacity }}>
              <MiniTable frame={frame} start={110} />
              <div style={{ marginTop: 8, color: C.muted, fontSize: 12 }}>示意数据 · 用于演示双脑节奏</div>
            </div>
          </div>
          <Composer frame={frame} listening={false} stopped={false} label="继续问 WhaleGo" />
        </Phone>
      </div>
    </Shot>
  );
}

function S6Interrupt({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const stop = frame > 135;
  const cut = ease(frame, 135, 12);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", left: 112, top: 170, width: 760 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow color={C.amber}>BARGE-IN / INSTANT STOP</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={94}>
            YOU SPEAK.
            <br />
            <span style={{ color: C.amber }}>IT STOPS.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 22, 22) }}>
          <Sub size={25}>不用等它说完，也不用找停止键。</Sub>
        </div>
        <div style={{ marginTop: 52, display: "flex", alignItems: "center", gap: 18, ...rise(frame, 50, 18) }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: stop ? C.red : C.cyan, boxShadow: `0 0 20px ${stop ? C.red : C.cyan}` }} />
          <Mono color={stop ? C.red : C.cyan} size={11}>{stop ? "PLAYBACK STOPPED / 0.0s" : "PLAYING / 2.6s"}</Mono>
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 8, ...rise(frame, 60, 18) }}>
          {["AUDIO", "VOICE", "ORB"].map((t) => (
            <div key={t} style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 1.4, color: stop ? C.muted : C.cyanSoft, border: `1px solid ${stop ? C.line : "rgba(157,245,232,0.25)"}`, borderRadius: 14, padding: "7px 9px", opacity: stop ? 0.5 : 1 }}>
              {t} / {stop ? "CUT" : "LIVE"}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 250, top: 60, opacity: ease(frame, 4, 18) }}>
        <Phone width={500} height={960}>
          <StatusBar />
          <ChatHeader sub={stop ? "VOICE / CANCELLED" : "VOICE / SPEAKING"} />
          <div style={{ flex: 1, overflow: "hidden", paddingTop: 6 }}>
            <UserBubble text="等等，换个方向。" opacity={ease(frame, 118, 14)} />
            <VoiceLine text={stop ? "好，停。" : "我先按推理能力、代码能力和长上下文三个维度来看。"} frame={frame} start={0} stopped={stop} />
            <div style={{ opacity: stop ? 0.35 : 0.8 }}>
              <AssistantText small>
                先看三个维度：推理、代码和长上下文。如果主要写代码，优先看代码能力；如果读长文档，优先看上下文窗口。
              </AssistantText>
            </div>
            <div style={{ position: "absolute", left: "50%", top: 390, transform: "translateX(-50%)", opacity: stop ? 0.32 : 0 }}>
              <Orb size={170} frame={frame} active={false} />
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 292,
                height: 2,
                background: C.red,
                transform: `scaleX(${cut})`,
                transformOrigin: "left",
                boxShadow: `0 0 20px ${C.red}`,
              }}
            />
            <div style={{ position: "absolute", left: 0, right: 0, top: 590, textAlign: "center", opacity: ease(frame, 160, 16) }}>
              <Mono color={C.muted} size={9}>SESSION PAUSED / TAP TO RESUME</Mono>
            </div>
          </div>
          <Composer frame={frame} listening={false} stopped={stop} label={stop ? "已停止" : "正在播放"} />
        </Phone>
      </div>
    </Shot>
  );
}

function SettingRow({ label, value, active, frame, start }: { label: string; value: string; active?: boolean; frame: number; start: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 14px",
        borderBottom: `1px solid ${C.line}`,
        opacity: ease(frame, start, 14),
        transform: `translateX(${(1 - ease(frame, start, 14)) * 26}px)`,
      }}
    >
      <div style={{ fontFamily: FONT_CN, fontSize: 13.5, color: C.white }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: FONT_CN, fontSize: 12, color: active ? C.cyan : C.muted }}>{value}</div>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: active ? C.cyan : C.muted, opacity: 0.8 }} />
      </div>
    </div>
  );
}

function S7Native({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const select = Math.min(3, Math.floor(frame / 38));
  const chips = ["像素鲸", "声呐", "极简", "关闭"];
  return (
    <Shot duration={duration}>
      <Backdrop />
      <div style={{ position: "absolute", left: 112, top: 150, width: 780 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow>NATIVE / SETTINGS</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={92}>
            NATIVE
            <br />
            <span style={{ color: C.cyan }}>BY DESIGN.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 22, 22) }}>
          <Sub size={25}>设置住在 App 设置里，不在球下面。</Sub>
        </div>
        <div style={{ marginTop: 42, display: "flex", flexDirection: "column", gap: 13, ...rise(frame, 40, 20) }}>
          {["悬浮球由 Flutter 原生绘制", "颜色 / 字体 / 尺寸跟随系统", "设置与插件页分离"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.cyan }} />
              <div style={{ fontFamily: FONT_CN, fontSize: 17, color: "rgba(244,248,255,0.8)" }}>{t}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", right: 210, top: 58, opacity: ease(frame, 4, 18), transform: `translateY(${(1 - ease(frame, 4, 18)) * 50}px)` }}>
        <Phone width={500} height={960}>
          <StatusBar />
          <div style={{ padding: "48px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <Mono size={9} color={C.cyan}>SETTINGS</Mono>
              <div style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: 25, color: C.white, marginTop: 5 }}>WhaleGo</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #DFF4FF, #4E6FFF 48%, #132B86)" }} />
            </div>
          </div>
          <div style={{ padding: "0 16px" }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: C.muted, marginBottom: 8 }}>VOICE MODE</div>
            <SettingRow label="模式" value="自动 / 双脑" active frame={frame} start={30} />
            <SettingRow label="声音" value="晓晓 · 女声" frame={frame} start={38} />
            <SettingRow label="语速" value="正常" frame={frame} start={46} />
            <div style={{ height: 18 }} />
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 2, color: C.muted, marginBottom: 10 }}>ORB STYLE</div>
            <div style={{ display: "flex", gap: 7 }}>
              {chips.map((chip, i) => (
                <div
                  key={chip}
                  style={{
                    flex: 1,
                    padding: "9px 4px",
                    borderRadius: 10,
                    border: `1px solid ${select === i ? C.cyan : C.line}`,
                    background: select === i ? "rgba(54,226,199,0.09)" : "rgba(255,255,255,0.02)",
                    textAlign: "center",
                    fontFamily: FONT_CN,
                    fontSize: 11,
                    color: select === i ? C.cyan : C.muted,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
            <div style={{ height: 18 }} />
            <SettingRow label="语音文字流" value="显示在会话" active frame={frame} start={74} />
            <SettingRow label="悬浮球大小" value="中" frame={frame} start={82} />
            <SettingRow label="自动播放" value="关闭" frame={frame} start={90} />
          </div>
          <div style={{ position: "absolute", left: 18, right: 18, bottom: 20, borderRadius: 12, border: `1px solid ${C.line}`, background: "rgba(7,17,32,0.92)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.cyan }} />
            <Mono size={8.5}>SETTINGS LIVE IN APP SETTINGS, NOT UNDER THE ORB</Mono>
          </div>
        </Phone>
      </div>
    </Shot>
  );
}

function OrbCard({ title, sub, index, frame, selected }: { title: string; sub: string; index: number; frame: number; selected: boolean }) {
  const enter = ease(frame, 10 + index * 8, 22);
  return (
    <div
      style={{
        borderRadius: 24,
        border: `1px solid ${selected ? "rgba(54,226,199,0.6)" : C.line}`,
        background: selected ? "linear-gradient(160deg, rgba(18,44,64,0.96), rgba(7,17,32,0.94))" : "linear-gradient(160deg, rgba(11,26,47,0.94), rgba(5,13,26,0.94))",
        padding: 24,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px) scale(${selected ? 1.02 : 1})`,
        boxShadow: selected ? "0 28px 70px rgba(54,226,199,0.12)" : "0 24px 60px rgba(0,0,0,0.28)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Mono color={selected ? C.cyan : C.muted} size={10}>{`0${index + 1} / ${title}`}</Mono>
        {selected ? <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 16px ${C.cyan}` }} /> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 190 }}>
        {index === 2 ? (
          <div style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, rgba(78,111,255,0.4), rgba(5,11,22,0.9))", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.line}` }}>
            <Img src={staticFile("whale.png")} style={{ width: 128 }} />
          </div>
        ) : (
          <Orb size={150} frame={frame} variant={index === 2 ? "pixel" : index === 1 ? "minimal" : "aurora"} />
        )}
      </div>
      <div style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: 22, color: C.white, letterSpacing: -0.5 }}>{sub}</div>
      <div style={{ marginTop: 6, fontFamily: FONT_CN, fontSize: 13, color: C.muted }}>{title === "PIXEL" ? "像素鲸 · 声呐耳件" : title === "SONAR" ? "声呐环 · 呼吸" : title === "MINIMAL" ? "极简光点 · 静态" : "极光球 · 默认"}</div>
    </div>
  );
}

function S8Orbs({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const selected = Math.min(3, Math.floor(frame / 48));
  return (
    <Shot duration={duration}>
      <Backdrop />
      <div style={{ position: "absolute", left: 112, top: 150, width: 720 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow>ORB STYLES / NATIVE DRAWN</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={94}>
            FOUR ORBS.
            <br />
            <span style={{ color: C.cyan }}>YOUR PICK.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 22, 22) }}>
          <Sub size={25}>样式是声明，绘制交给 Flutter。</Sub>
        </div>
        <div style={{ marginTop: 44, fontFamily: FONT_CN, fontSize: 18, lineHeight: 1.8, color: "rgba(244,248,255,0.76)", ...rise(frame, 44, 20) }}>
          悬浮球不只是麦克风按钮。
          <br />
          它是鲸语在桌面上的脸。
        </div>
      </div>

      <div style={{ position: "absolute", right: 108, top: 120, width: 900, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <OrbCard title="AURORA" sub="AURORA" index={0} frame={frame} selected={selected === 0} />
        <OrbCard title="SONAR" sub="SONAR" index={1} frame={frame} selected={selected === 1} />
        <OrbCard title="PIXEL" sub="PIXEL" index={2} frame={frame} selected={selected === 2} />
        <OrbCard title="MINIMAL" sub="MINIMAL" index={3} frame={frame} selected={selected === 3} />
      </div>
    </Shot>
  );
}

function S9Thread({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const x = ease(frame, 34, 18);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", left: 112, top: 118, width: 1040 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow>WHERE THE WORDS LIVE</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={90}>
            NOT SUBTITLES.
            <br />
            <span style={{ color: C.cyan }}>MESSAGES.</span>
          </Headline>
        </div>
      </div>

      <div style={{ position: "absolute", left: 112, top: 380, width: 520, height: 430, borderRadius: 22, border: `1px solid ${C.line}`, background: "rgba(8,18,33,0.9)", overflow: "hidden", opacity: ease(frame, 20, 18) }}>
        <div style={{ height: 170, background: "linear-gradient(135deg, #15304F, #0B1B31)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(60% 80% at 50% 40%, rgba(78,111,255,0.25), transparent 70%)" }} />
          <div style={{ position: "absolute", left: 24, bottom: 24, fontFamily: FONT_EN, fontSize: 13, color: "rgba(244,248,255,0.55)" }}>A video, playing.</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 176, padding: "14px 18px", background: "rgba(0,0,0,0.65)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontFamily: FONT_CN, fontSize: 15, color: "#fff" }}>这是一条字幕，盖在画面上。</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 210,
            width: 480,
            height: 3,
            background: C.red,
            transform: `scaleX(${x})`,
            transformOrigin: "left",
            boxShadow: `0 0 20px ${C.red}`,
          }}
        />
        <div style={{ position: "absolute", left: 22, top: 238, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 2, color: C.red, opacity: x }}>
          SUBTITLE / OVERLAY / LOST
        </div>
      </div>

      <div style={{ position: "absolute", right: 132, top: 330, opacity: ease(frame, 30, 18), transform: `translateY(${(1 - ease(frame, 30, 18)) * 40}px)` }}>
        <Phone width={450} height={720}>
          <StatusBar />
          <ChatHeader sub="THREAD / SCROLLBACK" />
          <div style={{ flex: 1, overflow: "hidden", paddingTop: 8 }}>
            <UserBubble text="帮我对比这三款模型。" />
            <VoiceLine text="行，我来查查。" frame={frame} start={40} />
            <AssistantText>
              先看三个维度：推理、代码和长上下文。
              <br />
              <span style={{ color: C.cyan }}>语音转写在这里是消息，不是控件。</span>
            </AssistantText>
            <div style={{ margin: "4px 18px 0 52px", padding: "10px 12px", borderRadius: 9, border: `1px solid rgba(54,226,199,0.28)`, background: "rgba(54,226,199,0.05)" }}>
              <Mono color={C.cyan} size={8.5}>MESSAGE / SCROLLS WITH HISTORY</Mono>
            </div>
          </div>
          <Composer frame={frame} listening={false} />
        </Phone>
      </div>

      <div style={{ position: "absolute", left: 650, top: 430, width: 470, opacity: ease(frame, 44, 18) }}>
        <div style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: 30, color: C.white }}>Same words.</div>
        <div style={{ fontFamily: FONT_EN, fontWeight: 700, fontSize: 30, color: C.cyan, marginTop: 4 }}>Different place.</div>
        <div style={{ fontFamily: FONT_CN, fontSize: 17, lineHeight: 1.8, color: C.muted, marginTop: 18 }}>
          字幕是覆盖层，会话是内容。
          <br />
          滚动、复制、回看，都成立。
        </div>
      </div>
    </Shot>
  );
}

function Monitor({ frame, children }: { frame: number; children: React.ReactNode }) {
  return (
    <div style={{ width: 720, height: 440, borderRadius: 18, border: "8px solid #1A2638", background: "#050B16", boxShadow: "0 50px 100px rgba(0,0,0,0.5)", position: "relative", overflow: "hidden" }}>
      <div style={{ height: 30, background: "#0B1728", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
        {[C.red, C.amber, C.cyan].map((c) => (
          <div key={c} style={{ width: 6, height: 6, borderRadius: "50%", background: c, opacity: 0.7 }} />
        ))}
        <div style={{ marginLeft: 12, flex: 1, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div style={{ padding: 22, height: "calc(100% - 30px)" }}>{children}</div>
      <div style={{ position: "absolute", left: "50%", bottom: -34, transform: "translateX(-50%)", width: 160, height: 34, background: "#1A2638", clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0 100%)" }} />
    </div>
  );
}

function S10Devices({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const travel = ease(frame, 46, 50);
  return (
    <Shot duration={duration}>
      <Backdrop />
      <div style={{ position: "absolute", left: 112, top: 122, width: 860 }}>
        <div style={{ ...rise(frame, 0, 18) }}>
          <Eyebrow>ONE SESSION / EVERY SCREEN</Eyebrow>
        </div>
        <div style={{ ...rise(frame, 6, 24) }}>
          <Headline size={92}>
            ONE THREAD.
            <br />
            <span style={{ color: C.cyan }}>EVERY SCREEN.</span>
          </Headline>
        </div>
        <div style={{ ...rise(frame, 22, 22) }}>
          <Sub size={25}>手机、桌面，同一条会话。</Sub>
        </div>
      </div>

      <div style={{ position: "absolute", left: 140, bottom: 70, opacity: ease(frame, 22, 18) }}>
        <Phone width={320} height={590}>
          <StatusBar />
          <ChatHeader sub="PHONE / LIVE" />
          <div style={{ flex: 1, paddingTop: 8 }}>
            <UserBubble text="把刚才的对比整理一下。" />
            <VoiceLine text="好，我整理成一张表。" frame={frame} start={36} />
            <AssistantText small>推理、代码、长上下文，三项都在表里。</AssistantText>
          </div>
          <Composer frame={frame} listening={false} note={false} />
        </Phone>
      </div>

      <div style={{ position: "absolute", right: 72, top: 250, opacity: ease(frame, 30, 18) }}>
        <Monitor frame={frame}>
          <div style={{ display: "flex", gap: 20, height: "100%" }}>
            <div style={{ width: 210, borderRight: `1px solid ${C.line}`, paddingRight: 18 }}>
              <Mono size={9} color={C.cyan}>WHALEGO / SESSIONS</Mono>
              <div style={{ marginTop: 16, fontFamily: FONT_CN, fontSize: 13, color: C.white }}>模型选型对比</div>
              <div style={{ marginTop: 8, fontFamily: FONT_CN, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>手机发起的会话，桌面继续。</div>
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 9 }}>
                {["VOICE", "TEXT", "TABLE"].map((t) => (
                  <div key={t} style={{ fontFamily: FONT_MONO, fontSize: 9, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 5, padding: "6px 7px" }}>{t}</div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <UserBubble text="把刚才的对比整理一下。" />
              <VoiceLine text="好，我整理成一张表。" frame={frame} start={50} />
              <MiniTable frame={frame} start={60} />
            </div>
          </div>
        </Monitor>
      </div>

      <div style={{ position: "absolute", left: 660, bottom: 118, width: 270 }}>
        <div style={{ height: 2, background: "rgba(54,226,199,0.3)", position: "relative" }}>
          <div style={{ position: "absolute", left: `${travel * 100}%`, top: -4, width: 10, height: 10, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 20px ${C.cyan}` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <Mono size={8}>PHONE</Mono>
          <Mono size={8} color={C.cyan}>SYNCED</Mono>
          <Mono size={8}>DESKTOP</Mono>
        </div>
      </div>
    </Shot>
  );
}

function S11Brand({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const reveal = ease(frame, 0, 34);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", left: 120, top: 210, width: 1240 }}>
        <div style={{ ...rise(frame, 0, 20) }}>
          <Eyebrow>SONAR FOR DIRECTION / SONG FOR MESSAGES</Eyebrow>
        </div>
        <div style={{ overflow: "hidden", paddingBottom: 12 }}>
          <div style={{ transform: `translateY(${(1 - reveal) * 130}px)` }}>
            <div style={{ fontFamily: FONT_EN, fontWeight: 800, fontSize: 208, lineHeight: 0.84, letterSpacing: -14, color: C.white }}>
              Whale<span style={{ color: C.cyan }}>Go</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 18 }}>
          <div style={{ fontFamily: FONT_CN, fontSize: 42, letterSpacing: 10, color: C.cyan }}>鲸语</div>
          <div style={{ width: 70, height: 1, background: C.line }} />
          <Mono size={12}>DUAL-BRAIN VOICE FOR DSH-GO</Mono>
        </div>
        <div style={{ marginTop: 62, ...rise(frame, 30, 22) }}>
          <div style={{ fontFamily: FONT_EN, fontWeight: 600, fontSize: 50, letterSpacing: -1.6, color: "rgba(244,248,255,0.9)", lineHeight: 1.16 }}>
            Hear it first.
            <br />
            Read it after.
          </div>
          <div style={{ fontFamily: FONT_CN, fontSize: 26, color: C.muted, marginTop: 18, letterSpacing: 2 }}>先听见，再见。</div>
        </div>
      </div>

      <div style={{ position: "absolute", right: 170, top: 250 }}>
        <Sonar cx={260} cy={270} base={190} count={5} speed={0.7} />
        <Img
          src={staticFile("whale.png")}
          style={{
            width: 520,
            position: "relative",
            filter: "drop-shadow(0 40px 70px rgba(0,0,0,0.55))",
            transform: `translateY(${Math.sin(frame / 34) * 10}px)`,
          }}
        />
      </div>

      <div style={{ position: "absolute", left: 122, bottom: 62, display: "flex", gap: 26 }}>
        <Mono size={10}>SONAR / DIRECTION</Mono>
        <Mono size={10} color={C.cyan}>SONG / MESSAGES</Mono>
        <Mono size={10}>WHALE / DEEPSEEK</Mono>
        <Mono size={10}>GO / DSH-GO</Mono>
      </div>
    </Shot>
  );
}

function S12End({ duration }: { duration: number }) {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [duration - 20, duration], [1, 0], clamp);
  return (
    <Shot duration={duration}>
      <Backdrop tone="deep" />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: fade }}>
        <Img src={staticFile("whale.png")} style={{ width: 220, filter: "drop-shadow(0 24px 50px rgba(0,0,0,0.5))" }} />
        <div style={{ marginTop: 22, fontFamily: FONT_EN, fontWeight: 800, fontSize: 86, letterSpacing: -4, color: C.white }}>
          Whale<span style={{ color: C.cyan }}>Go</span>
        </div>
        <div style={{ fontFamily: FONT_CN, fontSize: 26, letterSpacing: 7, color: C.cyan, marginTop: 2 }}>鲸语</div>
        <div style={{ marginTop: 30, fontFamily: FONT_EN, fontSize: 22, color: "rgba(244,248,255,0.72)", letterSpacing: 1.4 }}>
          DSH-Go dual-brain voice plugin
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
          {["VOICE", "TEXT", "NATIVE", "MIT"].map((t) => (
            <div key={t} style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 1.8, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 16, padding: "8px 11px" }}>{t}</div>
          ))}
        </div>
        <div style={{ marginTop: 38, fontFamily: FONT_MONO, fontSize: 17, letterSpacing: 3, color: C.white }}>github.com/JumpTea/WhaleGo</div>
        <div style={{ marginTop: 12, fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 3, color: C.muted }}>MIT · OPEN SOURCE · 2026</div>
      </div>
    </Shot>
  );
}

const TIMELINE = [
  { from: 0, dur: 120, Comp: S1Hook },
  { from: 120, dur: 180, Comp: S2Problem },
  { from: 300, dur: 210, Comp: S3Dual },
  { from: 510, dur: 270, Comp: S4Voice },
  { from: 780, dur: 300, Comp: S5Answer },
  { from: 1080, dur: 240, Comp: S6Interrupt },
  { from: 1320, dur: 300, Comp: S7Native },
  { from: 1620, dur: 240, Comp: S8Orbs },
  { from: 1860, dur: 270, Comp: S9Thread },
  { from: 2130, dur: 240, Comp: S10Devices },
  { from: 2370, dur: 270, Comp: S11Brand },
  { from: 2640, dur: 240, Comp: S12End },
];

const VOICE_CUES: Array<[string, number]> = [
  ["v00-brand", 0.3],
  ["v01-problem", 2.2],
  ["v02-dual", 5.1],
  ["v03-voice", 8.3],
  ["u01-ask", 11.2],
  ["d01-check", 15.4],
  ["v05-stop", 18.2],
  ["u02-turn", 20.5],
  ["v06-native", 23.2],
  ["v07-orb", 27.4],
  ["v08-thread", 31.2],
  ["v09-device", 35.4],
  ["v10-tagline", 39.6],
  ["v11-end", 43.4],
];

export const Promo: React.FC = () => {
  const { durationInFrames, fps } = useVideoConfig();
  if (fps !== FPS) {
    // The composition is authored at 60fps; keep the constant honest.
  }
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {TIMELINE.map(({ from, dur, Comp }) => (
        <Sequence key={from} from={from} durationInFrames={dur}>
          <Comp duration={dur} />
        </Sequence>
      ))}
      {VOICE_CUES.map(([id, seconds]) => (
        <Sequence key={id} from={at(seconds)}>
          <Audio src={staticFile(`audio/${id}.mp3`)} volume={1} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 99, opacity: 0.02, backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)" }} />
    </AbsoluteFill>
  );
};
