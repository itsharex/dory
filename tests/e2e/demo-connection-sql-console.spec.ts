import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect } from '@playwright/test';

import { expectAppHealthy, test } from './fixtures';

const SCREENSHOT_DIR = process.env.E2E_DEMO_SCREENSHOT_DIR
    ? path.resolve(process.env.E2E_DEMO_SCREENSHOT_DIR)
    : path.resolve(process.cwd(), 'apps/web/public/e2e-demo-flow');

const CONNECTION = {
    name: process.env.E2E_DEMO_CONNECTION_NAME ?? 'demo',
    type: 'PostgreSQL',
    host: process.env.E2E_DEMO_PG_HOST ?? '127.0.0.1',
    port: process.env.E2E_DEMO_PG_PORT ?? '5432',
    database: process.env.E2E_DEMO_PG_DATABASE ?? 'pagila',
    username: process.env.E2E_DEMO_PG_USERNAME ?? 'postgres',
    password: process.env.E2E_DEMO_PG_PASSWORD ?? 'postgres',
} as const;

test.use({ storageState: { cookies: [], origins: [] } });

async function saveShot(page: Parameters<typeof test>[0]['page'], fileName: string) {
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
        path: path.join(SCREENSHOT_DIR, fileName),
        fullPage: true,
    });
}

async function getOrganizationSlug(page: Parameters<typeof test>[0]['page']) {
    await page.waitForURL(/\/[^/]+\/connections$/);

    const url = new URL(page.url());
    const [organization] = url.pathname.split('/').filter(Boolean);

    expect(organization).toBeTruthy();
    return organization!;
}

async function loginAsDemo(page: Parameters<typeof test>[0]['page']) {
    console.log('[demo-flow] login:start');
    await page.goto('/sign-in');

    const demoButton = page.getByRole('button', {
        name: /enter as demo|login as demo/i,
    });

    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await page.waitForURL(/\/[^/]+\/connections$/);
    console.log('[demo-flow] login:done');
}

async function getConnectionCard(page: Parameters<typeof test>[0]['page'], name: string) {
    return page.locator('[data-testid="connection-card"]').filter({
        has: page.getByText(name, { exact: true }),
    });
}

async function getConnectionIdFromCard(card: ReturnType<Parameters<typeof test>[0]['page']['locator']>) {
    return card.evaluate(node => node.getAttribute('data-connection-id'));
}

async function ensureSqlTab(page: Parameters<typeof test>[0]['page'], connectionId: string) {
    console.log('[demo-flow] sql-tab:check');
    console.log('[demo-flow] sql-tab:reset-and-bootstrap');

    await page.evaluate(async ({ id }) => {
        const existingTabsResponse = await fetch('/api/sql-console/tabs', {
            method: 'GET',
            headers: {
                'X-Connection-ID': id,
            },
            credentials: 'include',
        });

        if (!existingTabsResponse.ok) {
            throw new Error(`Failed to load SQL tabs: ${existingTabsResponse.status}`);
        }

        const existingTabsPayload = await existingTabsResponse.json();
        const existingTabs = Array.isArray(existingTabsPayload?.data) ? existingTabsPayload.data : [];

        for (const tab of existingTabs) {
            if (!tab?.tabId) continue;

            const deleteResponse = await fetch(`/api/sql-console/tabs?tabId=${encodeURIComponent(tab.tabId)}`, {
                method: 'DELETE',
                headers: {
                    'X-Connection-ID': id,
                },
                credentials: 'include',
            });

            if (!deleteResponse.ok) {
                throw new Error(`Failed to delete SQL tab ${tab.tabId}: ${deleteResponse.status}`);
            }
        }

        const tabId = crypto.randomUUID();
        const response = await fetch('/api/sql-console/tabs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Connection-ID': id,
            },
            credentials: 'include',
            body: JSON.stringify({
                tabId,
                state: {
                    tabId,
                    tabType: 'sql',
                    tabName: 'New Query',
                    content: '',
                    status: 'idle',
                    userId: '',
                    connectionId: id,
                    orderIndex: 0,
                    createdAt: new Date().toISOString(),
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to create SQL tab: ${response.status}`);
        }

        localStorage.setItem(`sqlconsole:activeTabId:${id}`, tabId);
    }, { id: connectionId });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    const runButton = page.locator('[data-testid="run-query"]');
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toBeVisible();
    console.log('[demo-flow] sql-tab:fallback-ready');
}

async function setEditorSql(page: Parameters<typeof test>[0]['page'], sql: string) {
    await page.waitForFunction(() => typeof window.__DORY_E2E_MONACO__?.setValue === 'function');
    await page.evaluate(value => {
        window.__DORY_E2E_MONACO__?.setValue(value);
    }, sql);
}

async function runSql(page: Parameters<typeof test>[0]['page'], sql: string) {
    console.log(`[demo-flow] sql:run ${sql}`);
    await setEditorSql(page, sql);
    await page.waitForTimeout(500);

    const queryResponse = page.waitForResponse(response => response.url().includes('/api/query') && response.request().method() === 'POST');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('[data-testid="run-query"]'));
        if (buttons.length !== 1) {
            throw new Error(`Expected exactly one run button, got ${buttons.length}`);
        }
        const onlyButton = buttons[0];
        if (!(onlyButton instanceof HTMLButtonElement)) {
            throw new Error('Run button not found');
        }
        onlyButton.click();
    });

    const response = await queryResponse;
    const body = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(body?.data?.session?.status).toBe('success');
    console.log('[demo-flow] sql:done');

    return body;
}

test('demo login, postgres connection, SQL console flow, and screenshots', async ({ page, appErrors }) => {
    test.setTimeout(180_000);

    await loginAsDemo(page);

    const organization = await getOrganizationSlug(page);
    console.log(`[demo-flow] organization:${organization}`);

    await expect(page.getByRole('heading', { name: /connections/i })).toBeVisible();
    await saveShot(page, '01-connections.png');

    let connectionCard = await getConnectionCard(page, CONNECTION.name);
    let connectionId: string | null = (await connectionCard.count()) > 0 ? await getConnectionIdFromCard(connectionCard.first()) : null;

    if (!connectionId) {
        console.log('[demo-flow] connection:create');
        await page.getByRole('button', { name: /add connection/i }).click();

        const dialog = page.getByRole('dialog', { name: /create connection/i });
        await expect(dialog).toBeVisible();

        await dialog.getByRole('textbox', { name: /connection name/i }).fill(CONNECTION.name);
        await dialog.getByRole('combobox', { name: /type/i }).click();
        await page.getByRole('option', { name: CONNECTION.type }).click();
        await dialog.getByRole('textbox', { name: /host/i }).fill(CONNECTION.host);
        await dialog.getByRole('textbox', { name: /^port/i }).fill(CONNECTION.port);
        await dialog.getByRole('textbox', { name: /default database/i }).fill(CONNECTION.database);
        await dialog.getByRole('textbox', { name: /database username/i }).fill(CONNECTION.username);
        await dialog.getByRole('textbox', { name: /^password$/i }).fill(CONNECTION.password);

        const sshSwitch = dialog.getByRole('switch', { name: /^enable$/i });
        if ((await sshSwitch.getAttribute('aria-checked')) === 'true') {
            await sshSwitch.click();
        }

        await saveShot(page, '02-connection-form.png');

        const testResponsePromise = page.waitForResponse(response => response.url().includes('/api/connection/test') && response.request().method() === 'POST');
        await dialog.getByRole('button', { name: /test connection/i }).click();
        const testResponse = await testResponsePromise;
        const testBody = await testResponse.json();

        expect(testResponse.ok()).toBeTruthy();
        expect(testBody?.data?.ok).toBeTruthy();

        await saveShot(page, '03-connection-tested.png');

        const createResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/connection') && response.request().method() === 'POST');
        await dialog.getByRole('button', { name: /create connection/i }).click();
        await createResponsePromise;

        connectionCard = await getConnectionCard(page, CONNECTION.name);
        await expect(connectionCard.first()).toBeVisible();

        connectionId = await getConnectionIdFromCard(connectionCard.first());
        expect(connectionId).toBeTruthy();

        await saveShot(page, '04-connection-saved.png');
        console.log(`[demo-flow] connection:created ${connectionId}`);
    } else {
        await saveShot(page, '04-connection-saved.png');
        console.log(`[demo-flow] connection:reused ${connectionId}`);
    }

    console.log('[demo-flow] sql-console:goto');
    await page.goto(`/${organization}/${connectionId}/sql-console`);
    await ensureSqlTab(page, connectionId!);

    const dbSchemaResult = await runSql(page, 'select current_database() as database_name, current_schema() as schema_name;');
    expect(dbSchemaResult?.data?.queryResultSets?.[0]?.rowCount).toBe(1);
    const resultTable = page.getByTestId('result-table');
    await expect(resultTable).toBeVisible();
    expect(dbSchemaResult?.data?.results?.[0]?.[0]?.database_name).toBe(CONNECTION.database);
    expect(dbSchemaResult?.data?.results?.[0]?.[0]?.schema_name).toBe('public');
    await expect(resultTable.getByText(CONNECTION.database, { exact: true })).toBeVisible();
    await expect(resultTable.getByText('public', { exact: true })).toBeVisible();
    await saveShot(page, '05-sql-db-schema.png');

    const actorCountResult = await runSql(page, 'select count(*) as actor_count from actor;');
    expect(Number(actorCountResult?.data?.results?.[0]?.[0]?.actor_count)).toBe(200);
    await expect(resultTable.getByText('200', { exact: true })).toBeVisible();
    await saveShot(page, '06-sql-actor-count.png');

    const filmResult = await runSql(page, 'select film_id, title, release_year from film order by film_id limit 5;');
    expect(filmResult?.data?.queryResultSets?.[0]?.rowCount ?? 0).toBeGreaterThan(0);
    await expect(resultTable.getByText('ACADEMY DINOSAUR', { exact: true })).toBeVisible();
    await saveShot(page, '07-sql-film-sample.png');

    const relevantAppErrors = appErrors.filter(error => !error.includes('[PGlite migrate] failed: TypeError: Failed to fetch'));
    await expectAppHealthy(relevantAppErrors);
});
