import { DatabaseResourceView } from '@/components/explorer/resources/database/views/database-view';
import { SchemaResourceView } from '@/components/explorer/resources/schema/views/schema-view';
import type { ExplorerDriverModule } from '../types';
import { postgresSchemaDriver } from './schema';
import { postgresTableDriver } from './table';

export const postgresExplorerDriver: ExplorerDriverModule = {
    id: 'postgres',
    views: {
        namespace: DatabaseResourceView,
        schema: SchemaResourceView,
    },
    table: postgresTableDriver,
    schema: postgresSchemaDriver,
};
