import { expect } from '@playwright/test';

import { expectAppHealthy, test } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('demo login redirects to workspace and shows user info', async ({ page, appErrors }) => {
    await page.goto('/sign-in');

    const demoButton = page.getByRole('button', { name: /enter as demo/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    await page.waitForURL(/\/[^/]+\/connections$/);
    await expect(page.getByRole('heading', { name: /connections/i })).toBeVisible();
    await expect(page.getByText('Demo User')).toBeVisible();
    await expectAppHealthy(appErrors);
});
