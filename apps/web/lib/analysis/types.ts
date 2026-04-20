import type { ResultColumnMeta } from '@/lib/client/type';
import type { InsightAction, InsightStructuredFinding, InsightStructuredSignal, StructuredInsightView } from '@/lib/client/result-set-insights';

export type AnalysisResultRef = {
    sessionId: string;
    setIndex: number;
};

export type TableRef = {
    database?: string;
    table: string;
    confidence: 'high' | 'medium' | 'low';
};

export type ResultContextColumn = {
    name: string;
    dataType: string;
    semanticType?: 'time' | 'dimension' | 'measure' | 'identifier';
};

export type ResultContext = {
    resultSetId: AnalysisResultRef;
    sqlText?: string;
    databaseName?: string | null;
    tableRefs: TableRef[];
    rowCount: number;
    columns: ResultContextColumn[];
};

export type AnalysisSuggestionKind = 'drilldown' | 'trend' | 'distribution' | 'topk' | 'compare';

export type AnalysisSuggestion = {
    id: string;
    kind: AnalysisSuggestionKind;
    title: string;
    description: string;
    intent: {
        type: 'generate_sql' | 'build_chart' | 'explain';
        payload: Record<string, unknown>;
    };
    priority: number;
};

export type AnalysisFocus = {
    suggestionId: string;
    title: string;
};

export type AnalysisTrigger =
    | { type: 'suggestion'; suggestionId: string }
    | { type: 'followup'; sourceSessionId: string; suggestionId: string };

export type AnalysisStepType = 'reasoning' | 'sql_generation' | 'execution' | 'summary';
export type AnalysisStepStatus = 'pending' | 'running' | 'done' | 'error';

export type AnalysisStep = {
    id: string;
    type: AnalysisStepType;
    title: string;
    status: AnalysisStepStatus;
    startedAt?: string;
    endedAt?: string;
    data?: Record<string, unknown>;
    error?: string;
};

export type AnalysisArtifact =
    | { type: 'sql'; sql: string }
    | { type: 'result_ref'; resultRef: AnalysisResultRef }
    | { type: 'text'; content: string }
    | { type: 'chart_spec'; spec: Record<string, unknown> };

export type AnalysisOutcome = {
    summary: string;
    artifacts: AnalysisArtifact[];
    followups: AnalysisSuggestion[];
};

export type AnalysisSession = {
    id: string;
    title: string;
    trigger: AnalysisTrigger;
    contextRef: AnalysisResultRef;
    status: 'pending' | 'running' | 'done' | 'error';
    steps: AnalysisStep[];
    outcome?: AnalysisOutcome;
    createdAt: string;
    updatedAt: string;
};

export type AnalysisWorkspace = {
    currentFocus?: AnalysisFocus;
    suggestions: AnalysisSuggestion[];
    sessions: AnalysisSession[];
    lastSelectedSessionId?: string;
};

export type InsightViewModel = StructuredInsightView;

export type InsightAnalysisWorkbench = {
    resultContext: ResultContext;
    insight: InsightViewModel;
    analysis: AnalysisWorkspace;
    meta: {
        version: 'v2';
        createdAt: string;
        updatedAt: string;
    };
};

export type AnalysisWorkspaceState = AnalysisWorkspace;

export type AnalysisSessionRef = {
    tabId: string;
    resultRef: AnalysisResultRef;
    sessionId: string;
};

export type AnalysisRunContext = {
    connectionId: string;
    databaseName?: string | null;
    resultRef: AnalysisResultRef;
    resultContext: ResultContext;
    insight: InsightViewModel;
};

export type RunAnalysisRequest = {
    context: AnalysisRunContext;
    trigger: AnalysisTrigger;
};

export type AnalysisQueryPayload = {
    session: {
        sessionId: string;
        tabId?: string | null;
        connectionId?: string | null;
        database?: string | null;
        sqlText: string;
        status: 'success' | 'error';
        errorMessage?: string | null;
        startedAt?: string | Date | null;
        finishedAt?: string | Date | null;
        durationMs?: number | null;
        resultSetCount?: number;
        stopOnError?: boolean;
        source?: string | null;
    };
    queryResultSets: Array<{
        sessionId: string;
        setIndex: number;
        sqlText: string;
        sqlOp?: string | null;
        title?: string | null;
        columns?: unknown | null;
        rowCount?: number | null;
        limited?: boolean | null;
        limit?: number | null;
        affectedRows?: number | null;
        status: 'success' | 'error';
        errorMessage?: string | null;
        errorCode?: string | null;
        errorSqlState?: string | null;
        errorMeta?: unknown | null;
        warnings?: unknown | null;
        startedAt?: string | Date | null;
        finishedAt?: string | Date | null;
        durationMs?: number | null;
    }>;
    results: Array<Array<Record<string, unknown>>>;
};

export type RunAnalysisResponse = {
    session: AnalysisSession;
    query: AnalysisQueryPayload;
};

export type InsightActionAnalysis = Extract<InsightAction, { kind: 'analysis-suggestion' }>;

export type InsightSignalsPayload = {
    signals: InsightStructuredSignal[];
    findings: InsightStructuredFinding[];
    recommendedActions: InsightAction[];
    narrative: string;
};

export function toResultContextColumns(columns: ResultColumnMeta[] | null | undefined): ResultContextColumn[] {
    return (columns ?? []).map(column => ({
        name: column.name,
        dataType: column.type ?? column.dbType ?? column.normalizedType,
        semanticType:
            column.semanticRole === 'time' || column.semanticRole === 'dimension' || column.semanticRole === 'measure' || column.semanticRole === 'identifier'
                ? column.semanticRole
                : undefined,
    }));
}
