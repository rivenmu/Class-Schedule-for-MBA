import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startServer, APP_URL } from './lib.mjs';

const OUT = process.env.OUT_DIR || '/tmp/mba-baseline';
mkdirSync(OUT, { recursive: true });

const viewports = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-375', width: 375, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const server = await startServer(0);
const url = APP_URL(server);
const browser = await chromium.launch();
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 });
  await page.addInitScript(() => { try { sessionStorage.setItem('mba-disclaimer-seen', '1'); } catch (e) {} });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp.name}-top.png` });
  await page.screenshot({ path: `${OUT}/${vp.name}-full.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  console.log(vp.name, JSON.stringify(metrics));
  await page.close();
}
await browser.close();
await server.close();
console.log('done ->', OUT);
