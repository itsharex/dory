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

export type SqlResultCardProps = {
    result: SqlResultPart;
    onCopy: (sql: string) => void;
    onManualExecute: (payload: { sql: string; database: string | null; mode?: SqlResultManualExecutionMode }) => void;
    onFollowUp?: (prompt: string) => void;
    footerActions?: ReactNode;
    manualPrimaryAction?: ReactNode;
    manualMenuActions?: ReactNode;
    mode?: SqlResultCardMode;
    hideHeader?: boolean;
    codeActions?: ReactNode;
};

export type SqlResultCardMode = 'global' | 'copilot';
