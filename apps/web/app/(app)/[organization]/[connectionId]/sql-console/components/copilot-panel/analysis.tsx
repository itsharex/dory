'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { CheckCircle2, ChevronDown, CircleAlert, FileText, Loader2, Sparkles, ListTree, BarChart3, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Separator } from '@/registry/new-york-v4/ui/separator';
import { useDB } from '@/lib/client/use-pglite';
import { buildInsightDraft, buildInsights, buildStructuredInsightView } from '@/lib/client/result-set-insights';
import { buildAnalysisSuggestions, buildAnalysisSummaryFromDraft } from '@/lib/analysis/suggestions';
import { buildResultContext } from '@/lib/analysis/result-context';
import { runAnalysisRequest } from '@/lib/analysis/client';
import type { AnalysisResultRef, AnalysisSession, AnalysisStep, AnalysisSuggestion, AnalysisWorkspaceState } from '@/lib/analysis/types';
import { analysisWorkspaceKeyFor, analysisWorkspaceStateAtom, copilotAnalysisRequestAtom, sessionIdByTabAtom, upsertAnalysisWorkspaceAtom } from '../../sql-console.store';
import { currentSessionMetaAtom } from '../result-table/stores/result-table.atoms';
import { makeActiveSetAtom, upsertActiveSetAtom } from '../result-table/stores/active-set.atoms';

function PanelSection(props: { title: string; icon: React.ReactNode; children: React.ReactNode; description?: string }) {
    return (
        <Collapsible defaultOpen asChild>
            <section className="flex flex-col gap-3">
                <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {props.icon}
                            <span>{props.title}</span>
                        </div>
                        {props.description ? <div className="text-xs text-muted-foreground">{props.description}</div> : null}
                    </div>
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>{props.children}</CollapsibleContent>
            </section>
        </Collapsible>
    );
}

function findResultRefFromSession(session: AnalysisSession): AnalysisResultRef | null {
    const artifact = session.outcome?.artifacts.find(item => item.type === 'result_ref');
    return artifact?.type === 'result_ref' ? artifact.resultRef : null;
}

function makeOptimisticSession(params: { suggestion: AnalysisSuggestion; resultRef: AnalysisResultRef; triggerId: string }): AnalysisSession {
    const startedAt = new Date().toISOString();
    const steps = params.suggestion.stepTemplates.map((step, index) => ({
        id: step.id,
        type: index === params.suggestion.stepTemplates.length - 1 ? 'summary' : index === params.suggestion.stepTemplates.length - 2 ? 'execution' : 'reasoning',
        title: step.title,
        status: index === 0 ? 'running' : 'pending',
        startedAt: index === 0 ? startedAt : undefined,
    })) as AnalysisStep[];

    return {
        id: `optimistic:${params.triggerId}`,
        title: params.suggestion.title,
        trigger: {
            type: 'suggestion',
            suggestionId: params.suggestion.id,
        },
        contextRef: params.resultRef,
        status: 'running',
        steps,
        createdAt: startedAt,
        updatedAt: startedAt,
    };
}

function statusIcon(step: AnalysisStep) {
    if (step.status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (step.status === 'error') return <CircleAlert className="h-4 w-4 text-destructive" />;
    if (step.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    return <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
}

function suggestionKindLabel(kind: AnalysisSuggestion['kind'], t: ReturnType<typeof useTranslations>) {
    return t(`Insights.Analysis.Kinds.${kind}` as any);
}

function mergeAnalysisSessions(...sessionGroups: Array<AnalysisSession[] | undefined>) {
    const sessions: AnalysisSession[] = [];
    for (const group of sessionGroups) {
        for (const session of group ?? []) {
            const existingIndex = sessions.findIndex(item => item.id === session.id);
            if (existingIndex >= 0) {
                sessions[existingIndex] = session;
            } else {
                sessions.push(session);
            }
        }
    }
    return sessions;
}

type AnalysisTabProps = {
    tabId?: string;
    connectionId?: string | null;
    databaseName?: string | null;
};

export default function AnalysisTab(props: AnalysisTabProps) {
    const { tabId, connectionId, databaseName } = props;
    const locale = useLocale();
    const t = useTranslations('SqlConsole');
    const { dbReady, getResultRows, applyServerResult } = useDB();
    const sessionMetas = useAtomValue(currentSessionMetaAtom);
    const sessionIdByTab = useAtomValue(sessionIdByTabAtom);
    const activeSessionId = tabId ? sessionIdByTab[tabId] : undefined;
    const activeSet = useAtomValue(useMemo(() => makeActiveSetAtom(tabId, activeSessionId), [activeSessionId, tabId]));
    const setSessionIdByTab = useSetAtom(sessionIdByTabAtom);
    const setExplicitActiveSet = useSetAtom(upsertActiveSetAtom);
    const analysisRequest = useAtomValue(copilotAnalysisRequestAtom);
    const setAnalysisRequest = useSetAtom(copilotAnalysisRequestAtom);
    const workspaces = useAtomValue(analysisWorkspaceStateAtom);
    const upsertWorkspace = useSetAtom(upsertAnalysisWorkspaceAtom);
    const [sampleRows, setSampleRows] = useState<Array<Record<string, unknown>>>([]);
    const [runningSuggestionId, setRunningSuggestionId] = useState<string | null>(null);
    const handledRequestIdsRef = useRef<Set<string>>(new Set());

    const workspaceKey = analysisWorkspaceKeyFor(tabId, activeSessionId, activeSet);
    const workspace = (workspaceKey ? workspaces[workspaceKey] : null) ?? null;

    useEffect(() => {
        let canceled = false;
        (async () => {
            if (!dbReady || !activeSessionId || activeSet == null || activeSet < 0) {
                if (!canceled) setSampleRows([]);
                return;
            }

            const rows = await getResultRows(activeSessionId, activeSet, {
                rowBudget: 200,
                yieldUi: false,
            }).catch(() => []);
            if (canceled) return;
            setSampleRows(rows.map(row => row.rowData as Record<string, unknown>).slice(0, 200));
        })();

        return () => {
            canceled = true;
        };
    }, [activeSessionId, activeSet, dbReady, getResultRows]);

    const insightBundle = useMemo(() => {
        if (!activeSessionId || activeSet == null || activeSet < 0) return null;
        const columns = Array.isArray(sessionMetas?.columns) ? sessionMetas.columns : [];
        const draft = buildInsightDraft({
            stats: sessionMetas?.stats,
            columns,
            sqlText: sessionMetas?.sqlText ?? '',
            rows: sampleRows,
            locale,
            t: (key, values) => t(key as any, values),
        });
        const view = buildInsights(
            {
                stats: sessionMetas?.stats,
                columns,
                sqlText: sessionMetas?.sqlText ?? '',
                rows: sampleRows,
                locale,
                t: (key, values) => t(key as any, values),
            },
            null,
        );
        const structured = buildStructuredInsightView({
            context: {
                stats: sessionMetas?.stats,
                columns,
                sqlText: sessionMetas?.sqlText ?? '',
                rows: sampleRows,
                locale,
                t: (key, values) => t(key as any, values),
            },
            draft,
            view,
        });
        const resultContext = buildResultContext({
            sessionId: activeSessionId,
            setIndex: activeSet,
            sqlText: sessionMetas?.sqlText ?? '',
            databaseName: databaseName ?? null,
            rowCount: sessionMetas?.rowCount ?? sampleRows.length,
            columns,
        });
        const suggestions = buildAnalysisSuggestions({
            resultContext,
            draft,
            recommendedActions: structured.recommendedActions,
        });

        return {
            draft,
            view,
            structured: {
                ...structured,
                narrative: buildAnalysisSummaryFromDraft(draft, view.insights),
            },
            resultContext,
            suggestions,
        };
    }, [activeSessionId, activeSet, databaseName, locale, sampleRows, sessionMetas, t]);

    useEffect(() => {
        if (!workspaceKey || !insightBundle || !tabId || !activeSessionId || activeSet == null || activeSet < 0) return;

        upsertWorkspace({
            tabId,
            sessionId: activeSessionId,
            setIndex: activeSet,
            patch: prev => {
                const base: AnalysisWorkspaceState = prev ?? {
                    suggestions: [],
                    sessions: [],
                };

                const selectedSuggestionId =
                    analysisRequest?.sourceResultRef?.sessionId === activeSessionId && analysisRequest?.sourceResultRef?.setIndex === activeSet
                        ? analysisRequest.suggestionId
                        : (base.currentFocus?.suggestionId ?? insightBundle.suggestions[0]?.id);
                const selectedSuggestion = insightBundle.suggestions.find(item => item.id === selectedSuggestionId) ?? insightBundle.suggestions[0];

                return {
                    ...base,
                    suggestions: insightBundle.suggestions,
                    currentFocus: selectedSuggestion
                        ? {
                              suggestionId: selectedSuggestion.id,
                              title: selectedSuggestion.title,
                          }
                        : base.currentFocus,
                };
            },
        });
    }, [activeSessionId, activeSet, analysisRequest, insightBundle, tabId, upsertWorkspace, workspaceKey]);

    const selectedSuggestion = useMemo(() => {
        if (!workspace?.currentFocus?.suggestionId) return workspace?.suggestions?.[0] ?? null;
        return workspace.suggestions.find(item => item.id === workspace.currentFocus?.suggestionId) ?? workspace.suggestions[0] ?? null;
    }, [workspace]);

    const selectedSession = useMemo(() => {
        if (!workspace?.sessions?.length) return null;
        const selectedId = workspace.lastSelectedSessionId ?? workspace.sessions[workspace.sessions.length - 1]?.id;
        return workspace.sessions.find(item => item.id === selectedId) ?? workspace.sessions[workspace.sessions.length - 1] ?? null;
    }, [workspace]);

    const handleSelectSuggestion = (suggestion: AnalysisSuggestion) => {
        if (!tabId || !activeSessionId || activeSet == null || activeSet < 0) return;
        upsertWorkspace({
            tabId,
            sessionId: activeSessionId,
            setIndex: activeSet,
            patch: prev => ({
                ...(prev ?? { suggestions: [], sessions: [] }),
                suggestions: prev?.suggestions ?? insightBundle?.suggestions ?? [],
                sessions: prev?.sessions ?? [],
                lastSelectedSessionId: prev?.lastSelectedSessionId,
                currentFocus: {
                    suggestionId: suggestion.id,
                    title: suggestion.title,
                },
            }),
        });
    };

    const persistAnalysisSession = (sourceSessionId: string, sourceSetIndex: number, session: AnalysisSession, optimisticId?: string) => {
        if (!tabId) return;
        let sourceSessions: AnalysisSession[] = [];

        upsertWorkspace({
            tabId,
            sessionId: sourceSessionId,
            setIndex: sourceSetIndex,
            patch: prev => {
                const existingSessions = (prev?.sessions ?? []).filter(item => item.id !== optimisticId);
                const sessions = mergeAnalysisSessions(existingSessions, [session]);
                sourceSessions = sessions;

                return {
                    currentFocus: prev?.currentFocus,
                    suggestions: prev?.suggestions ?? insightBundle?.suggestions ?? [],
                    sessions,
                    lastSelectedSessionId: session.id,
                };
            },
        });

        const targetResultRef = findResultRefFromSession(session);
        if (!targetResultRef) return;

        upsertWorkspace({
            tabId,
            sessionId: targetResultRef.sessionId,
            setIndex: targetResultRef.setIndex,
            patch: prev => ({
                currentFocus: session.outcome?.followups[0]
                    ? {
                          suggestionId: session.outcome.followups[0].id,
                          title: session.outcome.followups[0].title,
                      }
                    : prev?.currentFocus,
                suggestions: session.outcome?.followups ?? prev?.suggestions ?? [],
                sessions: mergeAnalysisSessions(prev?.sessions, sourceSessions.length ? sourceSessions : [session]),
                lastSelectedSessionId: session.id,
            }),
        });
    };

    const insertOptimisticSession = (suggestion: AnalysisSuggestion, requestId: string) => {
        if (!tabId || !activeSessionId || activeSet == null || activeSet < 0) return null;
        const optimistic = makeOptimisticSession({
            suggestion,
            triggerId: requestId,
            resultRef: {
                sessionId: activeSessionId,
                setIndex: activeSet,
            },
        });
        upsertWorkspace({
            tabId,
            sessionId: activeSessionId,
            setIndex: activeSet,
            patch: prev => ({
                ...(prev ?? { suggestions: [], sessions: [] }),
                suggestions: prev?.suggestions ?? insightBundle?.suggestions ?? [],
                sessions: [...(prev?.sessions ?? []).filter(item => item.id !== optimistic.id), optimistic],
                lastSelectedSessionId: optimistic.id,
                currentFocus: {
                    suggestionId: suggestion.id,
                    title: suggestion.title,
                },
            }),
        });
        return optimistic.id;
    };

    const handleRunSuggestion = async (suggestion: AnalysisSuggestion, requestId = `${suggestion.id}-${Date.now()}`) => {
        if (!tabId || !activeSessionId || activeSet == null || activeSet < 0 || !connectionId || !insightBundle) {
            return;
        }

        handleSelectSuggestion(suggestion);
        setRunningSuggestionId(suggestion.id);
        const optimisticId = insertOptimisticSession(suggestion, requestId);

        try {
            const response = await runAnalysisRequest({
                tabId,
                context: {
                    connectionId,
                    databaseName: databaseName ?? null,
                    resultRef: {
                        sessionId: activeSessionId,
                        setIndex: activeSet,
                    },
                    resultContext: insightBundle.resultContext,
                    insight: insightBundle.structured,
                },
                trigger: {
                    type: 'suggestion',
                    suggestionId: suggestion.id,
                },
            });

            await applyServerResult(response.query);
            persistAnalysisSession(activeSessionId, activeSet, response.session, optimisticId ?? undefined);

            const nextResultRef = findResultRefFromSession(response.session);
            if (nextResultRef) {
                setSessionIdByTab(prev => ({
                    ...prev,
                    [tabId]: nextResultRef.sessionId,
                }));
                try {
                    localStorage.setItem(`sqlconsole:sessionId:${tabId}`, nextResultRef.sessionId);
                } catch {
                    // ignore local storage failures
                }
                setExplicitActiveSet({
                    tabId,
                    sessionId: nextResultRef.sessionId,
                    activeSet: nextResultRef.setIndex,
                });
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t('Insights.Analysis.Errors.RunFailed'));
        } finally {
            setRunningSuggestionId(null);
        }
    };

    useEffect(() => {
        if (!analysisRequest?.id || !workspace || !activeSessionId || activeSet == null || activeSet < 0) return;
        if (handledRequestIdsRef.current.has(analysisRequest.id)) return;
        if (analysisRequest.sourceResultRef?.sessionId !== activeSessionId || analysisRequest.sourceResultRef?.setIndex !== activeSet) return;

        const suggestion = workspace.suggestions.find(item => item.id === analysisRequest.suggestionId);
        if (!suggestion) {
            setAnalysisRequest(null);
            return;
        }

        handledRequestIdsRef.current.add(analysisRequest.id);
        void handleRunSuggestion(suggestion, analysisRequest.id).finally(() => {
            setAnalysisRequest(null);
        });
    }, [activeSessionId, activeSet, analysisRequest, setAnalysisRequest, workspace]);

    if (!activeSessionId || activeSet == null || activeSet < 0 || !insightBundle) {
        return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">{t('Insights.Analysis.Empty')}</div>;
    }

    return (
        <div className="flex h-full min-h-0">
            <ScrollArea className="h-full w-full">
                <div className="flex flex-col gap-4 p-4">
                    <PanelSection
                        title={t('Insights.Analysis.CurrentInsightTitle')}
                        icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.Analysis.CurrentInsightDescription')}
                    >
                        <div className="rounded-lg border bg-background px-4 py-3">
                            <div className="text-sm font-semibold text-foreground">{insightBundle.structured.card.headline}</div>
                            <div className="mt-2 space-y-1">
                                {insightBundle.structured.card.summaryLines.map(line => (
                                    <div key={line} className="text-xs text-muted-foreground">
                                        {line}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PanelSection>

                    {selectedSession ? (
                        <>
                            <PanelSection
                                title={t('Insights.Analysis.ProcessTitle')}
                                icon={<ListTree className="h-3.5 w-3.5 text-violet-400" />}
                                description={t('Insights.Analysis.ProcessDescription')}
                            >
                                <div className="rounded-lg border bg-background px-4 py-3">
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">
                                                {selectedSession.status === 'running'
                                                    ? t('Insights.Analysis.RunningTitle', { title: selectedSession.title })
                                                    : selectedSession.title}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {selectedSession.status === 'running'
                                                    ? (selectedSuggestion?.goal ?? t('Insights.Analysis.RunningDescription'))
                                                    : (selectedSession.outcome?.summary ?? t('Insights.Analysis.ResultPending'))}
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] uppercase">
                                            {selectedSession.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedSession.steps.map((step, index) => (
                                            <div key={step.id} className="flex items-start gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
                                                <div className="mt-0.5">{statusIcon(step)}</div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-foreground">
                                                        {t('Insights.Analysis.StepLabel', {
                                                            index: index + 1,
                                                            title: step.title,
                                                        })}
                                                    </div>
                                                    {step.error ? <div className="mt-1 text-xs text-destructive">{step.error}</div> : null}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">{t(`Insights.Analysis.StepStatus.${step.status}` as any)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </PanelSection>

                            <PanelSection
                                title={t('Insights.Analysis.ResultTitle')}
                                icon={<FileText className="h-3.5 w-3.5 text-violet-400" />}
                                description={t('Insights.Analysis.ResultDescription')}
                            >
                                <div className="rounded-lg border bg-background px-4 py-3">
                                    {selectedSession.outcome ? (
                                        <div className="space-y-4">
                                            <div>
                                                <div className="text-sm font-semibold text-foreground">{selectedSession.outcome.headline}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">{selectedSession.outcome.summary}</div>
                                            </div>

                                            {selectedSession.outcome.keyFindings.length ? (
                                                <div className="space-y-1">
                                                    {selectedSession.outcome.keyFindings.map(item => (
                                                        <div key={item} className="text-sm text-foreground">
                                                            {item}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {selectedSession.outcome.recordHighlights.length ? (
                                                <div className="space-y-2">
                                                    <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                        {t('Insights.Analysis.RecordHighlightsTitle')}
                                                    </div>
                                                    {selectedSession.outcome.recordHighlights.map(item => (
                                                        <div
                                                            key={`${item.label}:${item.value}`}
                                                            className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-foreground">{item.label}</div>
                                                                {item.note ? <div className="mt-1 text-xs text-muted-foreground">{item.note}</div> : null}
                                                            </div>
                                                            <div className="text-sm text-foreground">{item.value}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            {selectedSession.outcome.sections.map(section => (
                                                <div key={section.id} className="space-y-2">
                                                    <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{section.title}</div>
                                                    <div className="space-y-1">
                                                        {section.items.map(item => (
                                                            <div key={item} className="text-sm text-foreground">
                                                                {item}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}

                                            {findResultRefFromSession(selectedSession) ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => {
                                                        const ref = findResultRefFromSession(selectedSession);
                                                        if (!ref || !tabId) return;
                                                        setSessionIdByTab(prev => ({
                                                            ...prev,
                                                            [tabId]: ref.sessionId,
                                                        }));
                                                        try {
                                                            localStorage.setItem(`sqlconsole:sessionId:${tabId}`, ref.sessionId);
                                                        } catch {
                                                            // ignore local storage failures
                                                        }
                                                        setExplicitActiveSet({
                                                            tabId,
                                                            sessionId: ref.sessionId,
                                                            activeSet: ref.setIndex,
                                                        });
                                                    }}
                                                >
                                                    {t('Insights.Analysis.OpenResult')}
                                                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground">{t('Insights.Analysis.ResultPending')}</div>
                                    )}
                                </div>
                            </PanelSection>

                            <PanelSection
                                title={t('Insights.Analysis.NextActionsTitle')}
                                icon={<BarChart3 className="h-3.5 w-3.5 text-violet-400" />}
                                description={t('Insights.Analysis.NextActionsDescription')}
                            >
                                <div className="flex flex-wrap gap-2 rounded-lg border bg-background px-4 py-3">
                                    {(selectedSession.outcome?.followups ?? []).length ? (
                                        (selectedSession.outcome?.followups ?? []).map(suggestion => (
                                            <Button
                                                key={suggestion.id}
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={() => void handleRunSuggestion(suggestion)}
                                                disabled={runningSuggestionId === suggestion.id}
                                            >
                                                {runningSuggestionId === suggestion.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                                                {suggestion.label}
                                            </Button>
                                        ))
                                    ) : (
                                        <div className="text-xs text-muted-foreground">{t('Insights.Analysis.NoNextActions')}</div>
                                    )}
                                </div>
                            </PanelSection>
                        </>
                    ) : (
                        <PanelSection
                            title={t('Insights.Analysis.AvailableActionsTitle')}
                            icon={<BarChart3 className="h-3.5 w-3.5 text-violet-400" />}
                            description={t('Insights.Analysis.AvailableActionsDescription')}
                        >
                            <div className="space-y-2">
                                {workspace?.suggestions?.map(suggestion => {
                                    const isRunning = runningSuggestionId === suggestion.id;

                                    return (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            className="flex w-full items-start gap-3 rounded-lg border bg-background px-4 py-3 text-left transition hover:border-primary/40 hover:bg-muted/40"
                                            onClick={() => void handleRunSuggestion(suggestion)}
                                        >
                                            <span className="flex size-5 items-center justify-center text-muted-foreground">
                                                {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <BarChart3 className="h-4 w-4 text-violet-400" />}
                                            </span>
                                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium text-foreground">{suggestion.label}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">{suggestion.description}</div>
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 text-[10px]">
                                                        {suggestionKindLabel(suggestion.kind, t)}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </PanelSection>
                    )}

                    {workspace?.sessions?.length ? (
                        <>
                            <Separator />
                            <PanelSection
                                title={t('Insights.Analysis.HistoryTitle')}
                                icon={<ListTree className="h-3.5 w-3.5" />}
                                description={t('Insights.Analysis.HistoryDescription')}
                            >
                                <div className="space-y-2">
                                    {workspace.sessions
                                        .slice()
                                        .reverse()
                                        .map(session => (
                                            <button
                                                key={session.id}
                                                type="button"
                                                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                                                    selectedSession?.id === session.id
                                                        ? 'border-primary/60 bg-primary/5'
                                                        : 'bg-background hover:border-primary/40 hover:bg-muted/40'
                                                }`}
                                                onClick={() => {
                                                    if (!tabId || !activeSessionId || activeSet == null || activeSet < 0) return;
                                                    upsertWorkspace({
                                                        tabId,
                                                        sessionId: activeSessionId,
                                                        setIndex: activeSet,
                                                        patch: prev => ({
                                                            ...(prev ?? { suggestions: [], sessions: [] }),
                                                            suggestions: prev?.suggestions ?? [],
                                                            sessions: prev?.sessions ?? [],
                                                            lastSelectedSessionId: session.id,
                                                            currentFocus: prev?.currentFocus,
                                                        }),
                                                    });
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-medium text-foreground">{session.title}</div>
                                                    <Badge variant="outline" className="text-[10px] uppercase">
                                                        {session.status}
                                                    </Badge>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                            </PanelSection>
                        </>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
}
