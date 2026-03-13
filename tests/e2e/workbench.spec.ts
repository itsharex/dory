import { expect } from '@playwright/test';

import { expectAppHealthy, test } from './fixtures';
import { createWorkbenchConnection, mockWorkbenchApis, openMockConnectionConsole, setSqlEditorValue } from './helpers/workbench';

const seededConnection = createWorkbenchConnection();

test('can create a connection from the connections page', async ({ page, appErrors }) => {
    await mockWorkbenchApis(page);

    await page.goto('/');
    await page.waitForURL(/\/[^/]+\/connections$/);

    await page.getByRole('button', { name: /add connection/i }).click();
    const dialog = page.getByRole('dialog', { name: /create connection/i });
    await page.getByLabel(/Connection Name/i).fill('E2E ClickHouse');
    await page.getByLabel(/Host/i).fill('localhost');
    await page.getByLabel(/^Port/i).fill('8123');
    await page.getByLabel(/Database Username/i).fill('default');
    await dialog.locator('input[type="password"]').fill('password');

    await page.getByRole('button', { name: /test connection/i }).click();
    await expect(page.getByText(/24\.8\.1/)).toBeVisible();

    await page.getByRole('button', { name: /create connection/i }).click();
    await expect(page.getByRole('main').getByText('E2E ClickHouse')).toBeVisible();
    await expectAppHealthy(appErrors);
});

test('can open SQL editor and run a query', async ({ page, appErrors }) => {
    await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
    await openMockConnectionConsole(page, seededConnection);

    await expect(page.getByText(/New Console|New Query/i)).toBeVisible();
    await page.getByRole('button', { name: /New Console/i }).click();
    await expect(page.locator('.sql-editor-container')).toBeVisible();

    await setSqlEditorValue(page, 'SELECT 1 AS value');
    await page.getByRole('button', { name: /Run\s*\(/i }).click();

    await expect(page.getByRole('tab', { name: /Result 1/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'value' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1' }).last()).toBeVisible();
    await expect(page.getByText(/Finished/i)).toBeVisible();
    await expectAppHealthy(appErrors);
});

test('shows a readable SQL error without crashing the page', async ({ page, appErrors }) => {
    await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
    await openMockConnectionConsole(page, seededConnection);

    await page.getByRole('button', { name: /New Console/i }).click();
    await expect(page.locator('.sql-editor-container')).toBeVisible();

    await setSqlEditorValue(page, 'SELECT FROM missing_table');
    await page.getByRole('button', { name: /Run\s*\(/i }).click();

    await expect(page.getByText(/^Failed$/)).toBeVisible();
    await expect(page.getByText(/SELECT FROM missing_table LIMIT 200/i)).toBeVisible();
    await expect(page.locator('.sql-editor-container')).toBeVisible();
    await expectAppHealthy(appErrors);
});
