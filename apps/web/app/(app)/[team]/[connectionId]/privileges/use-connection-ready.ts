'use client';

import { useAtomValue } from 'jotai';
import { useParams } from 'next/navigation';

import { currentConnectionAtom } from '@/shared/stores/app.store';
import { connectionListLoadingAtom, connectionLoadingAtom } from '../../connections/states';

type RouteParams = {
    connectionId?: string | string[];
    connection?: string | string[];
};

export function usePrivilegesConnectionReady() {
    const params = useParams<RouteParams>();
    const routeConnectionParam = params?.connectionId ?? params?.connection;
    const routeConnectionId = Array.isArray(routeConnectionParam) ? routeConnectionParam[0] : routeConnectionParam;
    const currentConnection = useAtomValue(currentConnectionAtom);
    const isConnectionListLoading = useAtomValue(connectionListLoadingAtom);
    const connectLoadings = useAtomValue(connectionLoadingAtom);
    const connectionId = currentConnection?.connection.id;
    const isCurrentRouteConnection = Boolean(routeConnectionId && connectionId === routeConnectionId);
    const isConnectionLoading = Boolean(
        routeConnectionId &&
            Object.entries(connectLoadings ?? {}).some(([key, value]) => value && (key === routeConnectionId || key.startsWith(`${routeConnectionId}:`))),
    );

    return {
        connectionId,
        routeConnectionId,
        isConnectionReady: !isConnectionListLoading && isCurrentRouteConnection && !isConnectionLoading,
    };
}
