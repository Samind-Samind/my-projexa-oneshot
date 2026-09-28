// @ts-check
const { test, expect } = require('@playwright/test');

test('หน้า login เปิดได้', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/เข้าสู่ระบบ/);
});

test('ยังไม่ล็อกอิน เข้าหน้า SCR-009 แล้วต้องถูกส่งกลับไปหน้า login', async ({ page }) => {
  await page.goto('/scr-009');
  await expect(page).toHaveURL(/login/);
});
