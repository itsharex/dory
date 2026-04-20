import type { ResultColumnMeta } from '@/lib/client/type';
import type { ResultContext } from './types';
import { extractTableRefs } from './suggestions';
import { toResultContextColumns } from './types';

export function buildResultContext(params: {
    sessionId: string;
    setIndex: number;
    sqlText?: string | null;
    databaseName?: string | null;
    rowCount?: number | null;
    columns?: ResultColumnMeta[] | null;
}): ResultContext {
    return {
        resultSetId: {
            sessionId: params.sessionId,
            setIndex: params.setIndex,
        },
        sqlText: params.sqlText ?? undefined,
        databaseName: params.databaseName ?? null,
        tableRefs: extractTableRefs(params.sqlText, params.databaseName),
        rowCount: params.rowCount ?? 0,
        columns: toResultContextColumns(params.columns),
    };
}
