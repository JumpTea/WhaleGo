import { chromium } from "playwright-core";

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
  args: ["--no-first-run", "--disable-extensions"],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".wg-slot", { timeout: 60000 });
await page.waitForTimeout(1200);

const dump = async (tag) =>
  page.evaluate(({ tag }) => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      return {
        tag,
        cls: String(node.className ?? "").slice(0, 70),
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        display: cs.display,
        position: cs.position,
        marginTop: cs.marginTop,
        overflow: cs.overflow,
      };
    };
    const slot = document.querySelector(".wg-slot");
    const card = slot?.closest('[class*="card"]');
    const seat = slot?.closest('[class*="composerSeat"]');
    const stack = slot?.closest('[class*="composerStack"]');
    const toolbar = slot?.parentElement;
    const buttons = Array.from(document.querySelectorAll("button"))
      .filter((b) => b.getBoundingClientRect().y > 760)
      .map((b) => ({
        text: (b.textContent || b.getAttribute("aria-label") || "").slice(0, 12),
        ...box(b),
      }));
    return {
      tag,
      inner: { w: innerWidth, h: innerHeight },
      slot: box(slot),
      toolbar: box(toolbar),
      toolbarChildren: toolbar ? Array.from(toolbar.children).map(box) : [],
      card: box(card),
      cardChildren: card ? Array.from(card.children).map(box) : [],
      seat: box(seat),
      stack: box(stack),
      buttons,
      bodyScroll: { h: document.body.scrollHeight, top: document.body.scrollTop },
    };
  }, { tag });

console.log(JSON.stringify(await dump("closed"), null, 2));
await page.locator(".wg-slot").click();
await page.waitForTimeout(1000);
console.log(JSON.stringify(await dump("open"), null, 2));
await page.screenshot({ path: "shots-v2/layout-open.png" });
await browser.close();
