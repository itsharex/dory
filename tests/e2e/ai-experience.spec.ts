import { expect } from '@playwright/test';

import { expectAppHealthy, test } from './fixtures';
import { createWorkbenchConnection, mockWorkbenchApis, openMockConnectionConsole } from './helpers/workbench';

const seededConnection = createWorkbenchConnection();

/**
 * Mock chatbot-related APIs so the page renders without a real backend.
 */
async function mockChatApis(page: import('@playwright/test').Page) {
    const sessions: Array<{ id: string; title: string | null; type: string; createdAt: string }> = [];

    await page.route('**/api/chat/sessions*', async route => {
        const request = route.request();
        if (request.method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(sessions),
            });
            return;
        }
        if (request.method() === 'POST') {
            const now = new Date().toISOString();
            const session = {
                id: `session-${sessions.length + 1}`,
                title: null,
                type: 'global',
                createdAt: now,
                updatedAt: now,
                lastMessageAt: null,
                archivedAt: null,
                metadata: null,
            };
            sessions.push(session);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(session),
            });
            return;
        }
        await route.fallback();
    });

    await page.route('**/api/chat/session/*', async route => {
        const request = route.request();
        if (request.method() === 'GET') {
            const url = new URL(request.url());
            const sessionId = url.pathname.split('/').pop();
            const session = sessions.find(s => s.id === sessionId) ?? sessions[0];
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    detail: session ?? { id: sessionId, title: null, type: 'global' },
                    messages: [],
                }),
            });
            return;
        }
        await route.fallback();
    });

    // Mock the main chat POST — return a simple streamed text response
    await page.route('**/api/chat', async route => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }

        const body = route.request().postDataJSON() as any;
        const chatId = body?.chatId ?? sessions[0]?.id ?? 'session-1';

        // Return a minimal AI SDK-compatible data stream
        const responseText = 'Here is the result for your query.';
        const streamParts = [
            `0:${JSON.stringify(responseText)}\n`,
        ];

        await route.fulfill({
            status: 200,
            contentType: 'text/plain; charset=utf-8',
            headers: {
                'x-chat-id': chatId,
            },
            body: streamParts.join(''),
        });
    });
}

// ---------------------------------------------------------------------------
// Chatbot welcome page tests
// ---------------------------------------------------------------------------

test.describe('Chatbot welcome page', () => {
    test('shows welcome heading and suggested prompts when no session is selected', async ({ page, appErrors }) => {
        await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
        await mockChatApis(page);

        await page.goto('/');
        await page.waitForURL(/\/[^/]+\/connections$/);

        const match = page.url().match(/\/([^/]+)\/connections$/);
        const orgId = match?.[1];

        await page.goto(`/${orgId}/${seededConnection.connection.id}/chatbot`);

        // Welcome heading should be visible
        await expect(page.getByText('Ask anything about your data')).toBeVisible();

        // Subheading should be visible
        await expect(page.getByText(/AI generates SQL/i)).toBeVisible();

        // Suggested prompt buttons should be visible
        await expect(page.getByRole('button', { name: /top 10 users/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /error logs/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /order trends/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /table.*row counts/i })).toBeVisible();

        await expectAppHealthy(appErrors);
    });

    test('clicking a suggested prompt creates a session and sends a message', async ({ page, appErrors }) => {
        await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
        await mockChatApis(page);

        await page.goto('/');
        await page.waitForURL(/\/[^/]+\/connections$/);

        const match = page.url().match(/\/([^/]+)\/connections$/);
        const orgId = match?.[1];

        await page.goto(`/${orgId}/${seededConnection.connection.id}/chatbot`);

        // Click a suggestion
        await page.getByRole('button', { name: /top 10 users/i }).click();

        // Welcome page should disappear and chat view should appear
        await expect(page.getByText('Ask anything about your data')).toBeHidden({ timeout: 10000 });

        // The chat input area should now be visible (the PromptInput textarea within ChatBotComp)
        await expect(page.locator('textarea[name="message"]')).toBeVisible();

        await expectAppHealthy(appErrors);
    });
});

// ---------------------------------------------------------------------------
// SQL Console empty state AI button tests
// ---------------------------------------------------------------------------

test.describe('SQL Console AI entry', () => {
    test('shows "Ask AI" button in empty state', async ({ page, appErrors }) => {
        await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
        await openMockConnectionConsole(page, seededConnection);

        // The "Ask AI to write SQL" button should be visible
        await expect(page.getByRole('button', { name: /ask ai/i })).toBeVisible();

        await expectAppHealthy(appErrors);
    });

    test('"Ask AI" button navigates to chatbot page', async ({ page, appErrors }) => {
        await mockWorkbenchApis(page, { initialConnections: [seededConnection] });
        await mockChatApis(page);
        await openMockConnectionConsole(page, seededConnection);

        // Click the AI button
        await page.getByRole('button', { name: /ask ai/i }).click();

        // Should navigate to chatbot
        await expect(page).toHaveURL(/\/chatbot$/);

        // Welcome page should be visible on the chatbot page
        await expect(page.getByText('Ask anything about your data')).toBeVisible();

        await expectAppHealthy(appErrors);
    });
});
