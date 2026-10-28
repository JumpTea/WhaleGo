import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".wg-slot", { timeout: 60000 });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const slot = document.querySelector(".wg-slot");
  const textarea = document.querySelector("textarea");
  const chain = (node, n = 7) => {
    const out = [];
    let cur = node;
    for (let i = 0; i < n && cur; i += 1) {
      const r = cur.getBoundingClientRect();
      out.push({ tag: cur.tagName, cls: String(cur.className || "").slice(0, 120), id: cur.id, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, position: getComputedStyle(cur).position, display: getComputedStyle(cur).display });
      cur = cur.parentElement;
    }
    return out;
  };
  return { slot: chain(slot, 6), textarea: textarea ? chain(textarea, 8) : null, body: document.body.innerHTML.slice(0, 0) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
