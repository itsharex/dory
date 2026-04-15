import fs from 'node:fs';
import Database from 'better-sqlite3';
import { faker } from '@faker-js/faker';

const SEED = 42;
const USER_COUNT = 100;
const ORDER_COUNT = 1000;
const LOG_COUNT = 10000;

const ORDER_STATUSES = ['pending', 'completed', 'cancelled', 'refunded'] as const;
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const SERVICES = ['api-gateway', 'auth-service', 'payment-service', 'order-service', 'notification-service', 'search-service', 'analytics-service', 'file-service'] as const;

const LOG_MESSAGES: Record<string, string[]> = {
    'debug': [
        'Cache miss for key',
        'Retry attempt',
        'Connection pool stats',
        'Query plan analysis complete',
        'GC pause detected',
    ],
    'info': [
        'Request processed successfully',
        'User session created',
        'Payment processed',
        'Email sent successfully',
        'Database migration applied',
        'Health check passed',
        'New user registered',
    ],
    'warn': [
        'Response time exceeded threshold',
        'Rate limit approaching',
        'Disk usage above 80%',
        'Deprecated API version used',
        'Connection pool nearly exhausted',
        'Certificate expires in 7 days',
    ],
    'error': [
        'Database connection timeout',
        'Authentication failed',
        'Payment gateway unavailable',
        'File upload failed: size limit exceeded',
        'Unhandled exception in request handler',
        'Failed to send notification',
    ],
};

function createTables(db: Database.Database) {
    db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            country TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE orders (
            order_id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE logs (
            id INTEGER PRIMARY KEY,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            service TEXT NOT NULL,
            message TEXT NOT NULL,
            duration_ms INTEGER
        );

        CREATE INDEX idx_orders_user_id ON orders(user_id);
        CREATE INDEX idx_orders_status ON orders(status);
        CREATE INDEX idx_logs_level ON logs(level);
        CREATE INDEX idx_logs_timestamp ON logs(timestamp);
        CREATE INDEX idx_logs_service ON logs(service);
    `);
}

function seedUsers(db: Database.Database) {
    const insert = db.prepare('INSERT INTO users (id, name, country, created_at) VALUES (?, ?, ?, ?)');
    const tx = db.transaction(() => {
        for (let i = 1; i <= USER_COUNT; i++) {
            insert.run(
                i,
                faker.person.fullName(),
                faker.location.country(),
                faker.date.between({ from: '2024-01-01', to: '2026-03-01' }).toISOString(),
            );
        }
    });
    tx();
}

function seedOrders(db: Database.Database) {
    const insert = db.prepare('INSERT INTO orders (order_id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)');
    const tx = db.transaction(() => {
        for (let i = 1; i <= ORDER_COUNT; i++) {
            const userId = faker.number.int({ min: 1, max: USER_COUNT });
            const amount = Math.round(faker.number.float({ min: 5, max: 500, fractionDigits: 2 }) * 100) / 100;
            const status = faker.helpers.arrayElement(ORDER_STATUSES);
            insert.run(
                i,
                userId,
                amount,
                status,
                faker.date.between({ from: '2025-01-01', to: '2026-03-30' }).toISOString(),
            );
        }
    });
    tx();
}

function seedLogs(db: Database.Database) {
    const insert = db.prepare('INSERT INTO logs (id, timestamp, level, service, message, duration_ms) VALUES (?, ?, ?, ?, ?, ?)');
    // Weighted log levels: more info/debug, fewer warn/error
    const levelWeights = { debug: 25, info: 45, warn: 20, error: 10 };
    const weightedLevels: string[] = [];
    for (const [level, weight] of Object.entries(levelWeights)) {
        for (let i = 0; i < weight; i++) weightedLevels.push(level);
    }

    const tx = db.transaction(() => {
        for (let i = 1; i <= LOG_COUNT; i++) {
            const level = faker.helpers.arrayElement(weightedLevels);
            const service = faker.helpers.arrayElement(SERVICES);
            const message = faker.helpers.arrayElement(LOG_MESSAGES[level] ?? LOG_MESSAGES['info']!);
            const durationMs = level === 'error'
                ? faker.number.int({ min: 500, max: 30000 })
                : faker.number.int({ min: 1, max: 2000 });
            insert.run(
                i,
                faker.date.between({ from: '2026-03-01', to: '2026-03-31' }).toISOString(),
                level,
                service,
                message,
                durationMs,
            );
        }
    });
    tx();
}

/**
 * Generate the demo.sqlite file at the given absolute path.
 * Idempotent: skips if the file already exists.
 * Returns true if the file was created, false if it already existed.
 */
export function generateDemoSqlite(targetPath: string): boolean {
    if (fs.existsSync(targetPath)) {
        console.log(`[demo] demo.sqlite already exists at ${targetPath}, skipping`);
        return false;
    }

    console.log(`[demo] generating demo.sqlite at ${targetPath}...`);
    faker.seed(SEED);

    const db = new Database(targetPath);
    try {
        // Keep the bundled demo database portable for read-only/serverless deployments.
        db.pragma('journal_mode = DELETE');
        createTables(db);
        seedUsers(db);
        seedOrders(db);
        seedLogs(db);
        console.log(`[demo] demo.sqlite created (${USER_COUNT} users, ${ORDER_COUNT} orders, ${LOG_COUNT} logs)`);
        return true;
    } finally {
        db.close();
    }
}
