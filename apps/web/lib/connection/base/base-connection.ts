import { NotInitializedError } from './errors';
import type { ConnectionParameterDialect } from '../registry/types';
import { BaseConfig, ConnectionCapabilities, ConnectionQueryContext, HealthInfo, QueryResult } from './types';
import type { DriverQueryParams } from './params/types';
import { translate } from '@/lib/i18n/i18n';
import { routing } from '@/lib/i18n/routing';
import { SshTunnel, createSshTunnel, type SshOptions } from '../ssh/ssh-tunnel';

export abstract class BaseConnection {
    protected _initialized = false;
    abstract readonly dialect: ConnectionParameterDialect;
    readonly capabilities: ConnectionCapabilities = {};

    constructor(public readonly config: BaseConfig) {}

    private sshTunnel: SshTunnel | null = null;
    protected sshLocalEndpoint: { host: string; port: number } | null = null;

    /** Connection/pool initialization (idempotent) */
    async init(): Promise<void> {
        if (this._initialized) return;
        await this._init();
        this._initialized = true;
    }
    protected abstract _init(): Promise<void>;

    /** Close connection/pool */
    abstract close(): Promise<void>;

    /** Health check */
    abstract ping(): Promise<HealthInfo>;

    /** Execute query (query/DDL/transaction behavior depends on driver) */
    abstract query<Row = any>(sql: string, params?: DriverQueryParams, context?: ConnectionQueryContext): Promise<QueryResult<Row>>;

    /**
     * Query with context; defaults to plain query.
     * Subclasses can override to support database/schema selection.
     */
    async queryWithContext<Row = any>(
        sql: string,
        context?: ConnectionQueryContext & { params?: DriverQueryParams },
    ): Promise<QueryResult<Row>> {
        return this.query<Row>(sql, context?.params, context);
    }

    async command(sql: string, params?: DriverQueryParams, context?: ConnectionQueryContext): Promise<void> {
        await this.query(sql, params, context);
    }

    async cancelQuery(_queryId: string, _context?: ConnectionQueryContext): Promise<void> {
        throw new Error(translate(routing.defaultLocale, 'Utils.Connection.CancelUnsupported'));
    }

    protected assertReady() {
        if (!this._initialized) throw new NotInitializedError();
    }

    protected async setupSshIfNeeded(targetPort: number) {
        const ssh = this.getSshOptions();
        if (!ssh?.enabled) return;
        const targetHost = ssh.targetHostOverride ?? this.resolveTunnelTargetHost(this.config.host);
        this.sshTunnel = await createSshTunnel(targetHost, targetPort, ssh);
        this.sshLocalEndpoint = {
            host: this.sshTunnel.localHost,
            port: this.sshTunnel.localPort,
        };
    }

    protected async teardownSsh(): Promise<void> {
        if (this.sshTunnel) {
            await this.sshTunnel.close();
            this.sshTunnel = null;
        }
        this.sshLocalEndpoint = null;
    }

    protected getSshEndpoint(): { host: string; port: number } | null {
        return this.sshLocalEndpoint;
    }

    private getSshOptions(): SshOptions | null {
        const options = this.config.options as Record<string, unknown> | undefined;
        if (!options || typeof options !== 'object') return null;
        const ssh = (options as any).ssh as SshOptions | undefined;
        if (!ssh || !ssh.enabled) return null;
        return ssh;
    }

    private resolveTunnelTargetHost(host: string): string {
        const trimmed = host.trim();

        try {
            return new URL(trimmed).hostname;
        } catch {
            try {
                return new URL(`tcp://${trimmed}`).hostname;
            } catch {
                return trimmed;
            }
        }
    }
}
