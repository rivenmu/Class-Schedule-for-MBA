// v0.8.0 登录胶水: 未配置 Logto 时点登录只 toast; 预置假 token 时显示登出态; 登出回落.
// 不碰真后端: 纯前端态断言。假 JWT 仅过 idSub() 的 base64 解码, 后端照样会 401。
import { test, expect } from '@playwright/test';
import { startServer, APP_URL } from './scripts/lib.mjs';

let SERVER = null;
async function appUrl() { if (!SERVER) SERVER = await startServer(0); return APP_URL(SERVER); }
async function gotoFresh(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('mba-disclaimer-seen', '1'); } catch (e) {} });
  await page.goto(await appUrl(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fakeJwt = () => `${b64({ alg: 'none' })}.${b64({ sub: 'tester01' })}.x`;

test.describe('cloud login glue', () => {
  test('unconfigured login toasts instead of navigating', async ({ page }) => {
    await gotoFresh(page);
    await expect(page.locator('#loginBtn')).toHaveText('登录');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#toast.show')).toContainText('Logto');
  });

  test('preset token shows logout state and scheme save entry', async ({ page }) => {
    const jwt = fakeJwt();
    await page.addInitScript((t) => {
      try { sessionStorage.setItem('mba-disclaimer-seen', '1'); sessionStorage.setItem('mba-id-token', t); } catch (e) {}
    }, jwt);
    await page.route('**/api/schemes', (r) => r.fulfill({ json: [] }));
    await page.goto(await appUrl(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await expect(page.locator('#loginBtn')).toHaveText('登出');
    await expect(page.locator('#userChip')).toContainText('tester01');
    await expect(page.locator('#schSave')).toBeVisible();
  });

  test('logout falls back to guest hint', async ({ page }) => {
    const jwt = fakeJwt();
    await page.addInitScript((t) => {
      try { sessionStorage.setItem('mba-disclaimer-seen', '1'); sessionStorage.setItem('mba-id-token', t); } catch (e) {}
    }, jwt);
    await page.route('**/api/schemes', (r) => r.fulfill({ json: [] }));
    await page.goto(await appUrl(), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.locator('#loginBtn').click();
    await expect(page.locator('#loginBtn')).toHaveText('登录');
    await expect(page.locator('#schemeBody')).toContainText('Cookie');
  });
});
