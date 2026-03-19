import type { ExplorerResource } from '../types';
import { resolveMysqlExplorerResource } from './mysql';

export function resolveDorisExplorerResource(resource?: ExplorerResource): ExplorerResource | undefined {
    return resolveMysqlExplorerResource(resource);
}
