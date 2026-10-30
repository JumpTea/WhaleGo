import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://127.0.0.1:3099/?voice=1';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browser = await chromium.launch({
  executablePath: edge,
  headless: true,
  args: ['--no-first-run', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['microphone'],
  locale: 'zh-CN',
});
const page = await context.newPage();
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 160)));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
for (let i = 0; i < 8; i += 1) {
  await page.waitForTimeout(2000);
  const s = await page.evaluate(() => {
    const ph = document.querySelector('[contenteditable="true"]');
    return {
      href: location.href,
      stored: localStorage.getItem('dsh.sessions.current'),
      hero: Boolean(document.querySelector('[class*="composerHero"]')),
      editable: Boolean(ph && !ph.getAttribute('aria-disabled')),
      text: document.querySelector('[class*="_placeholder"]')?.textContent || '',
      phase: document.querySelector('.wg-space')?.dataset.phase,
    };
  });
  console.log(i * 2 + 2 + 's', JSON.stringify(s));
}
await page.screenshot({ path: 'tools/live/shots-v7/05-landing.png' });
await browser.close();
