import { test } from '@playwright/test';
import { execSync } from 'node:child_process';

const shouldRun = process.env.PLAYWRIGHT_INCLUDE_DOCKER === '1';

test.describe('@docker first-install container smoke', () => {
    test.skip(!shouldRun, 'Set PLAYWRIGHT_INCLUDE_DOCKER=1 to run Docker smoke tests.');

    test('container starts and home page is reachable', async ({ page }) => {
        const image = process.env.DORY_DOCKER_IMAGE ?? 'dorylab/dory:latest';
        const container = `dory-e2e-${Date.now()}`;
        const port = process.env.DORY_DOCKER_PORT ?? '3300';

        try {
            execSync(
                [
                    'docker run -d',
                    `--name ${container}`,
                    `-p ${port}:3000`,
                    '-e BETTER_AUTH_URL=http://localhost:3300',
                    '-e DB_TYPE=pglite',
                    '-e DS_SECRET_KEY=test-secret-key-test-secret-key',
                    '-e BETTER_AUTH_SECRET=test-better-auth-secret',
                    image,
                ].join(' '),
                { stdio: 'ignore' },
            );

            await page.goto(`http://127.0.0.1:${port}`);
            await page.waitForURL(/\/sign-in$/);
        } finally {
            execSync(`docker rm -f ${container}`, { stdio: 'ignore' });
        }
    });
});
