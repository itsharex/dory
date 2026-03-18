'use client';

import { getExplorerDriver } from '../drivers';
import { useExplorerConnectionContext } from './explorer-store';

export function useExplorerDriver() {
    const { connectionType } = useExplorerConnectionContext();
    return getExplorerDriver(connectionType);
}
