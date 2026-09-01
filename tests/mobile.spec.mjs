import { test, expect } from '@playwright/test';
import { startServer, APP_URL } from './scripts/lib.mjs';

let SERVER = null;

async function ensureServer() {
  if (SERVER) return SERVER;
  SERVER = await startServer(0);
  return SERVER;
}

function appUrl() {
  return APP_URL(SERVER);
}

async function waitReady(page) {
  await page.addInitScript(() => { try { sessionStorage.setItem('mba-disclaimer-seen','1'); } catch (e) {} });
  await ensureServer();
  await page.goto(appUrl(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}

test.describe.configure({ mode: 'serial' });

test.describe('industry-standard mobile adaptation', () => {
  test('no horizontal overflow at any viewport', async ({ page }) => {
    await waitReady(page);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      body: document.body.scrollWidth
    }));
    expect(m.sw, 'scrollWidth<=clientWidth').toBeLessThanOrEqual(m.cw);
  });

  test('no console errors', async ({ page }) => {
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(String(e)));
    await waitReady(page);
    await page.evaluate(() => { if (typeof renderAll === 'function') renderAll(); });
    await page.waitForTimeout(300);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('mobile bottom-sheet sidebar opens and closes', async ({ page }) => {
    await waitReady(page);
    const sheet = page.locator('.sidebar');
    const toggle = page.locator('#mobileToggle');
    await expect(sheet).toBeVisible();
    await toggle.click();
    await page.waitForTimeout(450);
    const cls1 = await sheet.getAttribute('class');
    expect(cls1).toContain('open');
    await toggle.click();
    await page.waitForTimeout(450);
    const cls2 = await sheet.getAttribute('class');
    expect(cls2).not.toContain('open');
  });

  test('day-list calendar renders course chips on mobile', async ({ page }) => {
    await waitReady(page);
    const dayList = page.locator('#dayList');
    await expect(dayList).toBeVisible();
    const days = await dayList.locator('.dl-day').count();
    expect(days).toBeGreaterThanOrEqual(28);
    const chips = await dayList.locator('.cc').count();
    expect(chips).toBeGreaterThan(0);
  });

  test('checkbox course selection updates progress', async ({ page }) => {
    await waitReady(page);
    await page.locator('#mobileToggle').click();
    await page.waitForTimeout(450);
    await page.locator('#filterRow .filter-btn[data-filter="ele"]').click();
    await page.waitForTimeout(150);
    const cb = page.locator('#checkBody .sel-item input[type="checkbox"]').first();
    await cb.check({ force: true });
    await page.waitForTimeout(150);
    const meta = await page.locator('#courseListMeta').textContent();
    expect(meta).not.toEqual('\u2014');
  });

  test('modal opens and closes via chip tap', async ({ page }) => {
    await waitReady(page);
    const chip = page.locator('#dayList .cc').first();
    await chip.click();
    await page.waitForTimeout(200);
    const modal = page.locator('#modalOverlay');
    await expect(modal).toHaveClass(/show/);
    await page.locator('#modalClose').click();
    await page.waitForTimeout(200);
    await expect(modal).not.toHaveClass(/show/);
  });

  test('semester switch updates day-list', async ({ page }) => {
    await waitReady(page);
    const beforeChips = await page.locator('#dayList .cc').count();
    await page.locator('.tab[data-sem="spring2025"]').click();
    await page.waitForTimeout(250);
    const afterChips = await page.locator('#dayList .cc').count();
    expect(afterChips).not.toEqual(beforeChips);
  });

  test('save produces a valid downloaded HTML with state baked in', async ({ page }) => {
    await waitReady(page);
    await page.locator('#mobileToggle').click();
    await page.waitForTimeout(450);
    await page.locator('#filterRow .filter-btn[data-filter="ele"]').click();
    await page.waitForTimeout(150);
    await page.locator('#checkBody .sel-item input[type="checkbox"]').first().check({ force: true });
    await page.waitForTimeout(150);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#saveBtn').click()
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    const { readFile, stat } = await import('node:fs/promises');
    const st = await stat(path);
    expect(st.size).toBeGreaterThan(50000);
    const body = await readFile(path, 'utf8');
    expect(body).toContain('<!DOCTYPE html>');
    expect(body).toContain('__SAVED_STATE');
  });

  test('touch targets are at least 36px on key mobile controls', async ({ page }) => {
    await waitReady(page);
    const targets = [
      '#mobileToggle',
      '#saveBtn',
      '#exportBtn',
      '.tab.active',
      '.sem-switch .tab:not(.active)',
      '.ht-btn'
    ];
    const minH = 36;
    for (const sel of targets) {
      const box = await page.locator(sel).first().boundingBox();
      if (!box) continue;
      expect(box.height, sel).toBeGreaterThanOrEqual(minH);
    }
  });

  test('print container populates when export is triggered', async ({ page }) => {
    await waitReady(page);
    await page.evaluate(() => {
      window.__printed = false;
      window.print = () => { window.__printed = true; };
    });
    await page.locator('#exportBtn').click();
    await page.waitForTimeout(400);
    const result = await page.evaluate(() => ({
      printed: window.__printed,
      containerHtml: document.getElementById('printContainer').innerHTML.length
    }));
    expect(result.printed).toBe(true);
    expect(result.containerHtml).toBeGreaterThan(1000);
  });

  test('legend and chips do not overflow at 320px', async ({ page }) => {
    await waitReady(page);
    const overflow = await page.evaluate(() => {
      const list = document.getElementById('dayList');
      return list ? list.scrollWidth <= document.documentElement.clientWidth : true;
    });
    expect(overflow).toBe(true);
  });

  test('course list cards render on mobile when courses selected', async ({ page }) => {
    await waitReady(page);
    // Scroll to the course list panel
    await page.locator('#mobileToggle').click();
    await page.waitForTimeout(450);
    await page.locator('#filterRow .filter-btn[data-filter="ele"]').click();
    await page.waitForTimeout(150);
    await page.locator('#checkBody .sel-item input[type="checkbox"]').first().check({ force: true });
    await page.waitForTimeout(200);
    await page.locator('#mobileToggle').click(); // close sheet
    await page.waitForTimeout(450);
    const cardsVisible = await page.locator('#courseListBody .cl-cards .cl-card').count();
    expect(cardsVisible).toBeGreaterThan(0);
  });

  test('conflict group selection works on mobile', async ({ page }) => {
    await waitReady(page);
    await page.locator('#mobileToggle').click();
    await page.waitForTimeout(450);
    // Open conflict details if collapsed
    const details = page.locator('#conflictInline');
    if (await details.getAttribute('open') === null) {
      await details.locator('summary').click();
      await page.waitForTimeout(150);
    }
    const opt = page.locator('#conflictBody .cg-opt').first();
    await opt.click();
    await page.waitForTimeout(200);
    const cls = await opt.getAttribute('class');
    expect(cls).toContain('selected');
  });
});
