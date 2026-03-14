import type { ClickHouseClient } from '@clickhouse/client';
import { BaseConnection } from '../../base/base-connection';
import type { HealthInfo, QueryContext, QueryResult } from '../../base/types';
import type { SQLParams } from '../../base/params/types';
import { ClickhouseDialect } from './dialect';
import {
    cancelClickhouseQuery,
    createClickhouseClient,
    executeClickhouseCommand,
    executeClickhouseQuery,
    isClickhouseTlsEnabled,
    pingClickhouse,
    resolveClickhouseHttpPort,
} from './clickhouse-driver';
import { createClickhouseMetadataCapability, type ClickhouseMetadataAPI } from './capabilities/metadata';
import { createClickhouseQueryInsightsCapability } from './capabilities/insights';
import { createClickhouseTableInfoCapability } from './capabilities/table-info';
import { createClickhousePrivilegesCapability, type ClickhousePrivilegesImpl } from './capabilities/privileges';

export class ClickhouseDatasource extends BaseConnection {
    readonly dialect = ClickhouseDialect;
    readonly privileges: ClickhousePrivilegesImpl;
    private client: ClickHouseClient | null = null;

    constructor(config: BaseConnection['config']) {
        super(config);
        this.capabilities.metadata = createClickhouseMetadataCapability(this);
        this.capabilities.queryInsights = createClickhouseQueryInsightsCapability(this);
        this.capabilities.tableInfo = createClickhouseTableInfoCapability(this);
        this.privileges = createClickhousePrivilegesCapability(this);
    }

    protected async _init(): Promise<void> {
        const targetPort = resolveClickhouseHttpPort(this.config) ?? (isClickhouseTlsEnabled(this.config) ? 8443 : 8123);
        await this.setupSshIfNeeded(targetPort);
        this.client = createClickhouseClient(this.config, { sshAgent: this.sshAgent });
        await this.client.ping();
    }

    async close(): Promise<void> {
        if (this.client) {
            await this.client.close().catch(() => undefined);
            this.client = null;
        }
        await this.teardownSsh();
        this._initialized = false;
    }

    async ping(): Promise<HealthInfo & { version?: string }> {
        this.assertReady();
        return pingClickhouse(this.client!);
    }

    async query<Row = any>(sql: string, params?: SQLParams, context?: QueryContext): Promise<QueryResult<Row>> {
        this.assertReady();
        return executeClickhouseQuery<Row>(this.client!, sql, params, context);
    }

    async queryWithContext<Row = any>(sql: string, context?: QueryContext & { params?: SQLParams }): Promise<QueryResult<Row>> {
        const targetDb = context?.database ?? this.config.database;

        if (!targetDb || targetDb === this.config.database) {
            return this.query<Row>(sql, context?.params, context);
        }

        const tempClient = createClickhouseClient(this.config, {
            database: targetDb,
            sshAgent: this.sshAgent,
        });

        try {
            return await executeClickhouseQuery<Row>(tempClient, sql, context?.params, context);
        } finally {
            await tempClient.close().catch(() => undefined);
        }
    }

    async command(sql: string, params?: SQLParams): Promise<void> {
        this.assertReady();
        await executeClickhouseCommand(this.client!, sql, params);
    }

    async cancelQuery(queryId: string): Promise<void> {
        this.assertReady();
        await cancelClickhouseQuery(this.client!, queryId);
    }

    get metadata(): ClickhouseMetadataAPI {
        return this.capabilities.metadata as ClickhouseMetadataAPI;
    }
}
