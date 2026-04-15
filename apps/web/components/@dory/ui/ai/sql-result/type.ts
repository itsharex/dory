import type { ReactNode } from 'react';

export type SqlResultPart = {
    type: 'sql-result';
    ok: boolean;
    sql: string;
    database: string | null;
    manualExecution?: {
        required: boolean;
        reason: 'non-readonly-query';
    };
    previewRows?: Array<Record<string, unknown>>;
    columns?: Array<{ name: string; type: string | null }>;
    rowCount?: number;
    truncated?: boolean;
    durationMs?: number;
    error?: {
        message: string;
    };
    timestamp?: string;
};

export type SqlResultManualExecutionMode = 'run' | 'editor';

export type SqlResultBodyProps = {
    result: SqlResultPart;
    onManualExecute: (payload: { sql: string; database: string | null; mode?: SqlResultManualExecutionMode }) => void;
    onFollowUp?: (prompt: string) => void;
    footerActions?: ReactNode;
    manualPrimaryAction?: ReactNode;
    manualMenuActions?: ReactNode;
    mode?: SqlResultCardMode;
    embedded?: boolean;
};

export type SqlResultCardProps = SqlResultBodyProps & {
    onCopy: (sql: string) => void;
    hideHeader?: boolean;
    codeActions?: ReactNode;
};

export type SqlResultCardMode = 'global' | 'copilot';
