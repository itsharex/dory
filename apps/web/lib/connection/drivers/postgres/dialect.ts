import type { ConnectionParameterDialect } from '@/lib/connection/registry/types';

export const PostgresDialect: ConnectionParameterDialect = {
    id: 'postgres',
    parameterStyle: 'positional',
};
