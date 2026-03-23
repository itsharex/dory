import type { ConnectionParameterDialect } from '@/lib/connection/registry/types';

export const MySqlDialect: ConnectionParameterDialect = {
    id: 'mysql',
    parameterStyle: 'positional',
};
