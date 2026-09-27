import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await expect(page.locator('#page-surface')).toHaveCSS('visibility', 'visible');
  await expect(page.locator('#page-loading')).toHaveText('');
}

test('annotations survive rotate, reorder, recovery, export and reopen', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('#sample').click(); await ready(page);
  await page.locator('#tool-text').click();
  await page.locator('#annotation-text').fill('Kept through export');
  await ready(page);
  await page.locator('#page-surface').click({ position: { x: 55, y: 250 } });
  await expect(page.locator('#annotation-layer')).toContainText('Kept through export');
  await page.locator('#tool-select').click();
  await page.locator('#rotate').click(); await ready(page);
  await page.locator('#move-down').click(); await ready(page);
  await page.locator('#undo').click(); await ready(page);
  await page.locator('#redo').click(); await ready(page);
  await expect(page.locator('#page-number')).toHaveValue('2');
  await expect(page.locator('#session-status')).toHaveText('Session saved in this browser');
  page.on('dialog', dialog => dialog.accept());
  await page.reload();
  await page.locator('#restore').click(); await ready(page);
  await expect(page.locator('#save-state')).toHaveText('Changes to export');
  await page.locator('#next').click(); await ready(page);
  await expect(page.locator('#annotation-layer')).toContainText('Kept through export');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloaded;
  const file = info.outputPath('exported.pdf'); await download.saveAs(file);
  await expect(page.locator('#save-state')).toHaveText('No unexported changes');
  await page.locator('#pdf-input').setInputFiles(file); await ready(page);
  await expect(page.locator('#filename')).toHaveText('exported.pdf');
  await page.locator('#next').click(); await ready(page);
  await expect(page.locator('#text-layer')).toContainText('Kept through export');
  await expect(page.locator('#annotation-layer g[data-id]')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test('bad inputs preserve work and forgetting removes recovery', async ({ page }) => {
  await page.goto('/'); await page.locator('#sample').click(); await ready(page);
  await page.locator('#delete-page').click(); await ready(page);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#pdf-input').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') });
  await expect(page.locator('#notice')).toContainText('Could not open this PDF');
  await expect(page.locator('#page-count')).toHaveText('2');
  await expect(page.locator('#save-state')).toHaveText('Changes to export');
  await page.locator('#close-document').click();
  await expect(page.locator('#welcome')).toBeVisible();
  // Wait for the IndexedDB transaction, not just the synchronous UI transition.
  await page.waitForFunction(async () => new Promise(resolve => {
    const request = indexedDB.open('foliovale', 1);
    request.onsuccess = () => { const db = request.result; const get = db.transaction('session').objectStore('session').get('current'); get.onsuccess = () => { db.close(); resolve(!get.result); }; };
  }));
  await page.reload(); await expect(page.locator('#recovery')).toBeHidden();
});
