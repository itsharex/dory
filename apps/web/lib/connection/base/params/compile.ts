import type { DatasourceDialect } from '@/lib/connection/registry/types';
import { isNamedParams, isPositionalParams, type SQLParams } from './types';

export type CompiledQuery = {
    sql: string;
    params: SQLParams | undefined;
};

export function compileParams(
    dialect: DatasourceDialect,
    sql: string,
    params?: SQLParams,
): CompiledQuery {
    if (!params) {
        return { sql, params: undefined };
    }

    if (dialect.parameterStyle === 'named') {
        if (!isNamedParams(params)) {
            throw new Error(`${dialect.id} requires named parameters`);
        }
        return { sql, params };
    }

    if (!isPositionalParams(params)) {
        throw new Error(`${dialect.id} requires positional parameters`);
    }

    return { sql, params };
}
