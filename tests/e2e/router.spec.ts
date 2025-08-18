import { test, expect } from '@playwright/test';
import path from 'path';

const routerPath = path.resolve('public/js/lib/router.js');

function toFileUrl(p) {
  const pathName = p.replace(/\\/g, '/');
  return 'file://' + pathName;
}

test('router toggles sections', async ({ page }) => {
  const url = toFileUrl(routerPath);
  await page.setContent(`
    <div id="dashboard"></div>
    <div id="order-view" class="hidden"></div>
    <div id="task-view" class="hidden"></div>
    <script type="module">
      import { handleHashChange } from '${url}';
      window.handleHashChange = handleHashChange;
    </script>
  `);
  await page.evaluate(() => window.handleHashChange('#task/1'));
  const taskHidden = await page.$eval('#task-view', el => el.classList.contains('hidden'));
  const dashHidden = await page.$eval('#dashboard', el => el.classList.contains('hidden'));
  expect(taskHidden).toBe(false);
  expect(dashHidden).toBe(true);
});
