import type { ExplorerDriverModule } from '../types';
import { noopSchemaDriver } from '../shared';
import { mysqlTableDriver } from './table';

export const mysqlExplorerDriver: ExplorerDriverModule = {
    id: 'mysql',
    views: {},
    table: mysqlTableDriver,
    schema: noopSchemaDriver,
};
