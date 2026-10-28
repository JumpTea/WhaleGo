/**
 * Render the orb's sky (SVG fractal clouds) to a WebP data URI.
 * The client embeds the result so the orb costs one image decode, not a live
 * SVG filter on every frame.
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const SIZE = 1024;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5b7cf2"/><stop offset="0.26" stop-color="#6f8ef4"/>
      <stop offset="0.44" stop-color="#9fb8f9"/><stop offset="0.6" stop-color="#dbe6ff"/>
      <stop offset="0.8" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="cloud" x="-25%" y="-25%" width="150%" height="150%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves="5" seed="23" result="n"/>
      <feComponentTransfer in="n" result="t">
        <feFuncA type="linear" slope="2.4" intercept="-1.05"/>
      </feComponentTransfer>
      <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/>
      <feGaussianBlur stdDeviation="2"/>
    </filter>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.14" stop-color="#000"/><stop offset="0.36" stop-color="#fff"/>
      <stop offset="0.72" stop-color="#fff"/><stop offset="0.9" stop-color="#000"/>
    </linearGradient>
    <mask id="m"><rect width="400" height="400" fill="url(#fade)"/></mask>
  </defs>
  <rect width="400" height="400" fill="url(#sky)"/>
  <rect width="400" height="400" filter="url(#cloud)" mask="url(#m)" opacity="0.92"/>
</svg>`;

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"></body></html>');
const dataUrl = await page.evaluate(
  async ({ svg, size }) => {
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL('image/webp', 0.92);
  },
  { svg, size: SIZE },
);
await browser.close();

const base64 = dataUrl.replace(/^data:image\/webp;base64,/, '');
const bytes = Buffer.from(base64, 'base64');
writeFileSync('orb-sky.webp', bytes);
writeFileSync('orb-sky.b64', base64);
console.log(JSON.stringify({ size: bytes.length, chars: base64.length, head: base64.slice(0, 24) }));
