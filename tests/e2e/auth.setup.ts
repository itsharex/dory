import { expect, test as setup } from '@playwright/test';

setup('authenticate demo user', async ({ page, context }) => {
    await page.goto('/sign-in');

    const demoButton = page.getByRole('button', { name: /enter as demo/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    await page.waitForURL(/\/[^/]+\/connections$/);
    await context.storageState({ path: 'playwright/.auth/user.json' });
});
