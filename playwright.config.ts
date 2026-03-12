import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
    timeout: 60_000,
    expect: {
        timeout: 10_000,
    },
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'chromium',
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.auth/user.json',
            },
        },
    ],
    webServer: process.env.PLAYWRIGHT_BASE_URL
        ? undefined
        : {
              command:
                  "cd apps/web && NEXT_PUBLIC_DORY_CLOUD_API_URL='' BETTER_AUTH_URL='http://127.0.0.1:3000' yarn next dev --turbopack --hostname 127.0.0.1 --port 3000",
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 180_000,
          },
});
