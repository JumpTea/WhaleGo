import { chromium } from "playwright-core";
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".wg-slot", { timeout: 60000 });
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  let cur = document.querySelector(".uV2eYG_card");
  const out = [];
  for (let i = 0; i < 14 && cur; i += 1) {
    const r = cur.getBoundingClientRect();
    const s = getComputedStyle(cur);
    out.push({ i, tag: cur.tagName, cls: String(cur.className || "").slice(0, 100), id: cur.id, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], pos: s.position, display: s.display, flex: s.flex, align: s.alignItems, justify: s.justifyContent, overflow: s.overflow, pad: s.padding });
    cur = cur.parentElement;
  }
  const editable = document.querySelector('[contenteditable="true"]');
  return { chain: out, editable: editable ? { tag: editable.tagName, cls: String(editable.className).slice(0,100), rect: editable.getBoundingClientRect().toJSON() } : null, html: document.body.firstElementChild?.innerHTML.slice(0, 300) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
