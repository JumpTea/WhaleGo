import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 560, height: 620 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL('orb.html').href);
await page.waitForTimeout(800);
await page.screenshot({ path: 'orb-candidates.png' });
await browser.close();
