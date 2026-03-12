import { expect, test as base } from '@playwright/test';

type AppErrorsFixture = {
    appErrors: string[];
};

export const test = base.extend<AppErrorsFixture>({
    appErrors: async ({ page }, use) => {
        const appErrors: string[] = [];

        page.on('pageerror', error => {
            appErrors.push(`pageerror: ${error.message}`);
        });

        page.on('console', message => {
            if (message.type() !== 'error') return;
            const text = message.text();
            if (/hydration|500|failed to fetch|chunkloaderror/i.test(text)) {
                appErrors.push(`console: ${text}`);
            }
        });

        await use(appErrors);
    },
});

export const expectAppHealthy = async (appErrors: string[]) => {
    expect(appErrors, appErrors.join('\n')).toEqual([]);
};
