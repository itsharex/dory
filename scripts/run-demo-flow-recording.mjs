import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const targetDir = path.resolve(rootDir, 'apps/web/public/e2e-demo-flow');
const targetVideoPath = path.join(targetDir, 'demo-flow.webm');
const testResultsDir = path.resolve(rootDir, 'test-results');

function run(command, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: rootDir,
            stdio: 'inherit',
            env,
        });

        child.on('exit', code => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
        });

        child.on('error', reject);
    });
}

async function collectFiles(dir, predicate, acc = []) {
    let entries = [];

    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return acc;
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await collectFiles(fullPath, predicate, acc);
            continue;
        }

        if (predicate(fullPath)) {
            acc.push(fullPath);
        }
    }

    return acc;
}

async function main() {
    const env = {
        ...process.env,
        PLAYWRIGHT_DEMO_RECORDING: '1',
        E2E_DEMO_CINEMATIC: '1',
    };

    await run('yarn', ['playwright', 'test', 'tests/e2e/demo-connection-sql-console.spec.ts', '--project=chromium', '--no-deps'], env);

    const videos = await collectFiles(testResultsDir, filePath => filePath.endsWith('.webm'));
    if (!videos.length) {
        throw new Error('No Playwright video artifact was produced');
    }

    videos.sort();
    const latestVideo = videos[videos.length - 1];

    await mkdir(targetDir, { recursive: true });
    await cp(latestVideo, targetVideoPath);

    console.log(`Exported demo flow video to ${targetVideoPath}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
