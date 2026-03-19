import type { ExplorerResource } from '../types';
import { resolveMysqlExplorerResource } from './mysql';

export function resolveClickhouseExplorerResource(resource?: ExplorerResource): ExplorerResource | undefined {
    return resolveMysqlExplorerResource(resource);
}
