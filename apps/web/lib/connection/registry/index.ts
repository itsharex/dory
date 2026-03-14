import type { ConnectionType } from '../base/types';
import type { DatasourceCtor } from './types';
import { ClickhouseDatasource } from '../drivers/clickhouse/ClickhouseDatasource';

const registry = new Map<ConnectionType, DatasourceCtor>();

registry.set('clickhouse', ClickhouseDatasource);

export function registerDriver(type: ConnectionType, ctor: DatasourceCtor) {
    registry.set(type, ctor);
}

export function getDriver(type: ConnectionType): DatasourceCtor | undefined {
    return registry.get(type);
}
