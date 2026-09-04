// v0.8.0 方案面板: 保存命名 -> 201 toast; 满槽 409 -> 三选一覆盖框 -> 覆盖成功.
// /api 全部 page.route  mock, 不碰真后端。
import { test, expect } from '@playwright/test';
import { startServer, APP_URL } from './scripts/lib.mjs';

let SERVER = null;
async function appUrl() { if (!SERVER) SERVER = await startServer(0); return APP_URL(SERVER); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = () => `${b64({ alg: 'none' })}.${b64({ sub: 'tester01' })}.x`;

async function gotoLoggedIn(page, routes) {
  const jwt = fakeJwt();
  await page.addInitScript((t) => {
    try { sessionStorage.setItem('mba-disclaimer-seen', '1'); sessionStorage.setItem('mba-id-token', t); } catch (e) {}
  }, jwt);
  await page.route('**/api/schemes*', routes);
  await page.goto(await appUrl(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

test.describe('cloud schemes panel', () => {
  test('save names a scheme and toasts', async ({ page }) => {
    let posted = null;
    await gotoLoggedIn(page, (r) => {
      if (r.request().method() === 'POST') {
        posted = r.request().postDataJSON();
        return r.fulfill({ status: 201, json: { id: 'n1' } });
      }
      return r.fulfill({ json: [] });
    });
    await page.locator('#schSave').click();
    await page.locator('#mName').fill('冲刺版');
    await page.locator('#mOk').click();
    await expect(page.locator('#toast.show')).toContainText('冲刺版');
    expect(posted.name).toBe('冲刺版');
    expect(posted.data).toHaveProperty('electiveSel');
  });

  test('full slots show overwrite picker and overwrite works', async ({ page }) => {
    const posts = [];
    await gotoLoggedIn(page, (r) => {
      if (r.request().method() === 'POST') {
        const b = r.request().postDataJSON();
        posts.push(b.name);
        if (posts.length === 1) return r.fulfill({ status: 409, json: { error: 'slots_full', slots: ['A', 'B', 'C'] } });
        return r.fulfill({ json: { id: 'x', updated: true } });
      }
      return r.fulfill({ json: [] });
    });
    await page.locator('#schSave').click();
    await page.locator('#mName').fill('D');
    await page.locator('#mOk').click();
    await expect(page.locator('#modalContent')).toContainText('覆盖哪一份');
    await page.locator('#modalContent button[data-slot="B"]').click();
    await expect(page.locator('#toast.show')).toContainText('B');
    expect(posts).toEqual(['D', 'B']);
  });

  test('cancel keeps local state untouched', async ({ page }) => {
    await gotoLoggedIn(page, (r) => {
      if (r.request().method() === 'POST') return r.fulfill({ status: 409, json: { error: 'slots_full', slots: ['A'] } });
      return r.fulfill({ json: [] });
    });
    const before = await page.evaluate(() => JSON.stringify(window.__SAVED_STATE || null) + document.querySelectorAll('#checkBody input:checked').length);
    await page.locator('#schSave').click();
    await page.locator('#mName').fill('D');
    await page.locator('#mOk').click();
    await expect(page.locator('#modalContent')).toContainText('覆盖哪一份');
    await page.locator('#mCancel').click();
    const after = await page.evaluate(() => JSON.stringify(window.__SAVED_STATE || null) + document.querySelectorAll('#checkBody input:checked').length);
    expect(after).toBe(before);
  });
});
