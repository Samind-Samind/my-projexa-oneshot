// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// URL ของเว็บบน Firebase Hosting (project projexa-b3a6a)
// ถ้าต้องการทดสอบกับที่อื่น เช่นเครื่องตัวเอง ให้ตั้ง BASE_URL เอง:
//   BASE_URL=http://localhost:3000 npx playwright test
const BASE_URL = process.env.BASE_URL || 'https://projexa-b3a6a.web.app';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'th-TH',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
