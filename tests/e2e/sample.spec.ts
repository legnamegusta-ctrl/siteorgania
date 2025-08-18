import { test, expect } from '@playwright/test';

test('sample', async ({ page }) => {
  await page.goto('about:blank');
  expect(1).toBe(1);
});
