import type { ExplorerDriver, ExplorerListKind, ExplorerObjectResource } from '@/lib/explorer/types';
import type { NamespaceViewComponent, ObjectViewComponent, SchemaViewComponent } from '@/components/explorer/core/explorer-types';

export type ExplorerTableIndexesTarget = {
    database: string;
    table: string;
};

export type ExplorerTableDriver = {
    getTableBrowserDriver: () => ExplorerDriver;
    getQualifiedName: (resource: ExplorerObjectResource) => string;
    getTableIndexes: (resource: ExplorerObjectResource) => ExplorerTableIndexesTarget;
};

export type ExplorerSchemaDriver = {
    getListEndpoint: (listKind: ExplorerListKind) => string | null;
};

export type ExplorerDriverViews = Partial<{
    namespace: NamespaceViewComponent;
    schema: SchemaViewComponent;
    object: ObjectViewComponent;
    tableObject: ObjectViewComponent;
}>;

export type ExplorerDriverModule = {
    id: ExplorerDriver;
    views: ExplorerDriverViews;
    table: ExplorerTableDriver;
    schema: ExplorerSchemaDriver;
};
