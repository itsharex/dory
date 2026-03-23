import type { ConnectionType } from '../base/types';
import type { ConnectionDriverCtor } from './types';
import { ClickhouseDatasource } from '../drivers/clickhouse/ClickhouseDatasource';
import { MySqlDatasource } from '../drivers/mysql/MySqlDatasource';
import { PostgresDatasource } from '../drivers/postgres/PostgresDatasource';

const registry = new Map<ConnectionType, ConnectionDriverCtor>();

registry.set('clickhouse', ClickhouseDatasource);
registry.set('mysql', MySqlDatasource);
registry.set('postgres', PostgresDatasource);

export function registerDriver(type: ConnectionType, ctor: ConnectionDriverCtor) {
    registry.set(type, ctor);
}

export function getDriver(type: ConnectionType): ConnectionDriverCtor | undefined {
    return registry.get(type);
}
