import { expect, test as setup } from '@playwright/test';

setup('authenticate demo user', async ({ page, context }) => {
    await page.goto('/sign-in');

    const demoButton = page
        .getByTestId('demo-sign-in')
        .or(page.getByRole('button', { name: /enter as demo|login as demo|sign in as demo/i }));
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    await page.waitForURL(/\/[^/]+\/connections$/);
    await context.storageState({ path: 'playwright/.auth/user.json' });
});
