import type { ExplorerDriverModule } from '../types';
import { noopSchemaDriver } from '../shared';
import { clickhouseTableDriver } from './table';

export const clickhouseExplorerDriver: ExplorerDriverModule = {
    id: 'clickhouse',
    views: {},
    table: clickhouseTableDriver,
    schema: noopSchemaDriver,
};
