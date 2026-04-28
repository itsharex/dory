import { expect } from '@playwright/test';

import { expectAppHealthy, test } from './fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test('home page renders without white screen or hydration errors', async ({ page, appErrors }) => {
    await page.goto('/');
    await page.waitForURL(/\/sign-in$/);

    await expect(page.getByRole('heading', { name: /welcome back|sign in/i })).toBeVisible();
    await expect(
        page
            .getByTestId('demo-sign-in')
            .or(page.getByRole('button', { name: /enter as demo|login as demo|sign in as demo/i })),
    ).toBeVisible();
    await expect(page.locator('body')).toContainText(/Sign in|Login/i);
    await expectAppHealthy(appErrors);
});
