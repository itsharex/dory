import type { ConnectionListIdentity, ConnectionListItem, ConnectionSsh, TestConnectionPayload } from '@/types/connections';
import { UnsupportedTypeError } from './base/errors';
import type { BaseConfig } from './base/types';
import { applyQueryRequestTimeout } from './defaults';
import { isDatasourceType } from './registry/types';

type IdentityWithPassword = ConnectionListIdentity & { password?: string | null };
type SshWithSecrets = ConnectionSsh & { password?: string | null; privateKey?: string | null; passphrase?: string | null };
type TestIdentity = TestConnectionPayload['identity'];
type TestSshWithSecrets = NonNullable<TestConnectionPayload['ssh']> & {
    password?: string | null;
    privateKey?: string | null;
    passphrase?: string | null;
};

type ErrorFactory = (code: string) => Error;

function defaultErrorFactory(code: string): Error {
    return new Error(code);
}

export function parseConnectionOptions(raw: unknown): Record<string, unknown> | undefined {
    if (!raw) return undefined;
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
        } catch {
            return undefined;
        }
    }
    return undefined;
}

export function pickConnectionIdentity(list: ConnectionListIdentity[], targetId?: string | null): ConnectionListIdentity | null {
    if (!Array.isArray(list) || list.length === 0) return null;
    if (targetId) {
        const matched = list.find(item => item.id === targetId);
        if (matched) return matched;
    }
    const defaultOne = list.find(item => item.isDefault);
    if (defaultOne) return defaultOne;
    return list[0] ?? null;
}

export function resolveConnectionType(rawType: unknown): BaseConfig['type'] {
    const normalizedType = typeof rawType === 'string' ? rawType.toLowerCase() : rawType;
    if (!isDatasourceType(normalizedType)) {
        throw new UnsupportedTypeError(String(rawType));
    }
    return normalizedType;
}

function buildOptions(
    rawOptions: unknown,
    ports: { httpPort?: number | null; port?: number | string | null },
    ssh?: {
        enabled?: boolean;
        host?: string | null;
        port?: number | string | null;
        username?: string | null;
        authMethod?: string | null;
        password?: string | null;
        privateKey?: string | null;
        passphrase?: string | null;
    } | null,
) {
    const options = parseConnectionOptions(rawOptions) ?? {};

    if (typeof ports.httpPort === 'number') {
        (options as any).httpPort = ports.httpPort;
    }

    applyQueryRequestTimeout(options);

    if (ssh?.enabled) {
        (options as any).ssh = {
            enabled: true,
            host: ssh.host ?? undefined,
            port: ssh.port ?? undefined,
            username: ssh.username ?? undefined,
            authMethod: ssh.authMethod ?? undefined,
            password: ssh.password ?? undefined,
            privateKey: ssh.privateKey ?? undefined,
            passphrase: ssh.passphrase ?? undefined,
        };
    }

    return options;
}

export function buildStoredConnectionConfig(
    connection: ConnectionListItem['connection'],
    identity: IdentityWithPassword,
    ssh?: SshWithSecrets | null,
    createError: ErrorFactory = defaultErrorFactory,
): BaseConfig {
    if (!connection?.host) {
        throw createError('missing_host');
    }
    if (!identity?.username) {
        throw createError('missing_username');
    }

    const options = buildOptions(connection.options, { httpPort: connection.httpPort, port: connection.port }, ssh);
    const type = resolveConnectionType(connection.engine ?? connection.type ?? 'clickhouse');
    const database = identity.database ?? (connection as any).database ?? undefined;
    const port = typeof connection.httpPort === 'number' ? connection.httpPort : connection.port;
    const updatedAt = connection.updatedAt instanceof Date ? connection.updatedAt.getTime() : connection.updatedAt;

    return {
        id: connection.id,
        type,
        host: connection.host,
        port: port ?? undefined,
        username: identity.username,
        password: identity.password ?? undefined,
        database: database ?? undefined,
        options: Object.keys(options).length ? options : undefined,
        configVersion: connection.configVersion ?? undefined,
        updatedAt: updatedAt ?? undefined,
    };
}

export function buildTestConnectionConfig(
    payload: TestConnectionPayload & { ssh?: TestSshWithSecrets | null },
    createError: ErrorFactory = defaultErrorFactory,
): BaseConfig {
    const { connection, ssh, identity } = payload;

    if (!connection?.host) {
        throw createError('missing_host');
    }
    if (!identity) {
        throw createError('missing_identity_info');
    }
    if (!identity.username) {
        throw createError('missing_username');
    }

    const options = buildOptions(connection.options, { httpPort: connection.httpPort, port: connection.port }, ssh);
    const type = resolveConnectionType(connection.engine ?? connection.type ?? 'clickhouse');
    const database = identity.database ?? undefined;
    const id = connection.name ? `test-${connection.name}` : `test-${connection.host}`;

    return {
        id,
        type,
        host: connection.host,
        port: connection.port,
        username: identity.username,
        password: identity.password ?? undefined,
        database,
        options: Object.keys(options).length ? options : undefined,
    };
}
