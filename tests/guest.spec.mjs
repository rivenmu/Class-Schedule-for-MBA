// v0.8.0 未登录 Cookie: 一年暂存恢复勾选; 坏 Cookie 降级不白屏; 写 Cookie 一年过期.
// 课程 id 不硬编码: 先读第一个秋季选修 id, 再种 Cookie 重进断言。
import { test, expect } from '@playwright/test';
import { startServer, APP_URL } from './scripts/lib.mjs';

let SERVER = null;
async function appUrl() { if (!SERVER) SERVER = await startServer(0); return APP_URL(SERVER); }
async function gotoFresh(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('mba-disclaimer-seen', '1'); } catch (e) {} });
  await page.goto(await appUrl(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
async function firstFallElective(page) {
  return page.evaluate(() => {
    const sem = SEMESTERS[state.sem] || SEMESTERS.fall2026;
    const c = sem.courses.find((x) => x.type === 'ele' || x.type === 'sum');
    return c ? c.id : null;
  });
}
function draftCookie(cid) {
  return encodeURIComponent(JSON.stringify({ v: 1, classId: 'quanji', sem: 'fall2026', sel: {}, ele: { fall2026: [cid], spring2025: [] } }));
}

test.describe('guest draft cookie', () => {
  test('draft restores checkbox after reload', async ({ page, context }) => {
    await gotoFresh(page);
    const cid = await firstFallElective(page);
    expect(cid).toBeTruthy();
    await context.addCookies([{ name: 'mba_draft', value: draftCookie(cid), url: await appUrl() }]);
    await gotoFresh(page);
    await expect(page.locator('#toast.show')).toContainText('恢复');
    await expect(page.locator(`#checkBody input[data-cid="${cid}"]`)).toBeChecked();
  });

  test('corrupt cookie degrades without blank page', async ({ page, context }) => {
    await gotoFresh(page);
    await context.addCookies([{ name: 'mba_draft', value: '%%broken%%', url: await appUrl() }]);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await gotoFresh(page);
    await expect(page.locator('#toast.show')).toContainText('损坏');
    await expect(page.locator('#calGrid')).not.toBeEmpty();
    expect(errs).toEqual([]);
  });

  test('toggle writes cookie with one-year expiry', async ({ page, context }) => {
    await gotoFresh(page);
    const cid = await firstFallElective(page);
    await page.locator(`#checkBody input[data-cid="${cid}"]`).click();
    await page.waitForTimeout(900); // 防抖 500ms + 余量
    const cookies = await context.cookies();
    const d = cookies.find((c) => c.name === 'mba_draft');
    expect(d).toBeTruthy();
    expect(d.expires).toBeGreaterThan(Date.now() / 1000 + 3600 * 24 * 300);
    expect(decodeURIComponent(d.value)).toContain(cid);
  });
});
