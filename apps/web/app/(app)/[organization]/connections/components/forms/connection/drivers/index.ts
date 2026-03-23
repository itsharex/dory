import type { ComponentType } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { RefinementCtx } from 'zod';
import {
    ClickhouseConnectionFields,
    createClickhouseConnectionDefaults,
    normalizeClickhouseConnectionForForm,
    normalizeClickhouseConnectionForSubmit,
    validateClickhouseConnection,
} from './clickhouse';
import {
    PostgresConnectionFields,
    createPostgresConnectionDefaults,
    normalizePostgresConnectionForForm,
    normalizePostgresConnectionForSubmit,
    validatePostgresConnection,
} from './postgres';
import { createMysqlConnectionDefaults, MysqlConnectionFields, normalizeMysqlConnectionForForm, normalizeMysqlConnectionForSubmit, validateMysqlConnection } from './mysql';

export type SupportedConnectionDriver = 'clickhouse' | 'mysql' | 'postgres';

type DriverDefinition = {
    label: string;
    FormComponent: ComponentType<{ form: UseFormReturn<any> }>;
    createDefaults: () => any;
    normalizeForForm: (connection: any) => any;
    normalizeForSubmit: (connection: any) => any;
    validate: (connection: any, ctx: RefinementCtx) => void;
};

const DRIVERS: Record<SupportedConnectionDriver, DriverDefinition> = {
    clickhouse: {
        label: 'ClickHouse',
        FormComponent: ClickhouseConnectionFields,
        createDefaults: createClickhouseConnectionDefaults,
        normalizeForForm: normalizeClickhouseConnectionForForm,
        normalizeForSubmit: normalizeClickhouseConnectionForSubmit,
        validate: validateClickhouseConnection,
    },
    postgres: {
        label: 'PostgreSQL',
        FormComponent: PostgresConnectionFields,
        createDefaults: createPostgresConnectionDefaults,
        normalizeForForm: normalizePostgresConnectionForForm,
        normalizeForSubmit: normalizePostgresConnectionForSubmit,
        validate: validatePostgresConnection,
    },
    mysql: {
        label: 'MySQL',
        FormComponent: MysqlConnectionFields,
        createDefaults: createMysqlConnectionDefaults,
        normalizeForForm: normalizeMysqlConnectionForForm,
        normalizeForSubmit: normalizeMysqlConnectionForSubmit,
        validate: validateMysqlConnection,
    },
};

export const CONNECTION_TYPE_OPTIONS = (Object.entries(DRIVERS) as Array<[SupportedConnectionDriver, DriverDefinition]>).map(([value, driver]) => ({
    value,
    label: driver.label,
}));

export function getConnectionDriver(type?: string): DriverDefinition {
    if (type === 'mysql') {
        return DRIVERS.mysql;
    }
    if (type === 'postgres') {
        return DRIVERS.postgres;
    }
    return DRIVERS.clickhouse;
}
