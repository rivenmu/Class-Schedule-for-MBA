import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: /(mobile|auth|schemes|guest)\.spec\.m?js$/,
  timeout: 30000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8765',
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 2,
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
  },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-375', use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-320', use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } }
  ]
});
