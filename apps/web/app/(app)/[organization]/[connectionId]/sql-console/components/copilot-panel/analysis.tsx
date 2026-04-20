'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Loader2, ChevronRight, Sparkles, ListTree, BarChart3, ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { Button } from '@/registry/new-york-v4/ui/button';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Textarea } from '@/registry/new-york-v4/ui/textarea';
import { Separator } from '@/registry/new-york-v4/ui/separator';
import { useDB } from '@/lib/client/use-pglite';
import { buildInsightDraft, buildInsights, buildStructuredInsightView } from '@/lib/client/result-set-insights';
import { buildAnalysisSuggestions, buildAnalysisSummaryFromDraft } from '@/lib/analysis/suggestions';
import { buildResultContext } from '@/lib/analysis/result-context';
import { runAnalysisRequest } from '@/lib/analysis/client';
import type { AnalysisResultRef, AnalysisSession, AnalysisSuggestion, AnalysisWorkspaceState } from '@/lib/analysis/types';
import {
    analysisWorkspaceStateAtom,
    analysisWorkspaceKeyFor,
    copilotAnalysisRequestAtom,
    sessionIdByTabAtom,
    upsertAnalysisWorkspaceAtom,
} from '../../sql-console.store';
import { currentSessionMetaAtom } from '../result-table/stores/result-table.atoms';
import { makeActiveSetAtom, upsertActiveSetAtom } from '../result-table/stores/active-set.atoms';

function PanelSection(props: { title: string; icon: React.ReactNode; children: React.ReactNode; description?: string }) {
    return (
        <section className="space-y-3">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {props.icon}
                    <span>{props.title}</span>
                </div>
                {props.description ? <div className="text-xs text-muted-foreground">{props.description}</div> : null}
            </div>
            {props.children}
        </section>
    );
}

function findResultRefFromSession(session: AnalysisSession): AnalysisResultRef | null {
    const artifact = session.outcome?.artifacts.find(item => item.type === 'result_ref');
    return artifact?.type === 'result_ref' ? artifact.resultRef : null;
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
                        : base.currentFocus?.suggestionId ?? insightBundle.suggestions[0]?.id;
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

    useEffect(() => {
        if (!analysisRequest?.id) return;
        if (analysisRequest.sourceResultRef?.sessionId !== activeSessionId || analysisRequest.sourceResultRef?.setIndex !== activeSet) return;
        setAnalysisRequest(null);
    }, [activeSessionId, activeSet, analysisRequest, setAnalysisRequest]);

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

    const persistAnalysisSession = (sourceSessionId: string, sourceSetIndex: number, session: AnalysisSession) => {
        if (!tabId) return;

        upsertWorkspace({
            tabId,
            sessionId: sourceSessionId,
            setIndex: sourceSetIndex,
            patch: prev => {
                const sessions = [...(prev?.sessions ?? [])];
                const existingIndex = sessions.findIndex(item => item.id === session.id);
                if (existingIndex >= 0) {
                    sessions[existingIndex] = session;
                } else {
                    sessions.push(session);
                }

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
                sessions: [...(prev?.sessions ?? []), session],
                lastSelectedSessionId: session.id,
            }),
        });
    };

    const handleRunSuggestion = async (suggestion: AnalysisSuggestion) => {
        if (!tabId || !activeSessionId || activeSet == null || activeSet < 0 || !connectionId || !insightBundle) {
            return;
        }

        setRunningSuggestionId(suggestion.id);

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

            persistAnalysisSession(activeSessionId, activeSet, response.session);

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
            toast.error(error instanceof Error ? error.message : 'Failed to run analysis.');
        } finally {
            setRunningSuggestionId(null);
        }
    };

    if (!activeSessionId || activeSet == null || activeSet < 0 || !insightBundle) {
        return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Select a result to start analysis.</div>;
    }

    return (
        <div className="flex h-full min-h-0 bg-muted/20">
            <ScrollArea className="h-full w-full">
                <div className="space-y-5 p-3">
                    <PanelSection title="Current Findings" icon={<Sparkles className="h-3.5 w-3.5" />} description="Structured findings derived from the active result set.">
                        <div className="rounded-xl border bg-background/90 p-3">
                            <div className="space-y-2">
                                {insightBundle.structured.findings.slice(0, 5).map(finding => (
                                    <div key={finding.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background/80 px-3 py-2">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-foreground">{finding.title}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">{finding.summary}</div>
                                        </div>
                                        <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                                            {finding.severity}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PanelSection>

                    <PanelSection title="Recommended Analysis" icon={<BarChart3 className="h-3.5 w-3.5" />} description="Rule-based next steps for the active result.">
                        <div className="space-y-2">
                            {workspace?.suggestions?.map(suggestion => {
                                const selected = selectedSuggestion?.id === suggestion.id;
                                const isRunning = runningSuggestionId === suggestion.id;

                                return (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        className={`w-full rounded-xl border bg-background/90 p-3 text-left transition-colors ${selected ? 'border-primary/60 bg-primary/5' : 'hover:border-primary/30'}`}
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">{suggestion.description}</div>
                                            </div>
                                            <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                                                {suggestion.kind}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    void handleRunSuggestion(suggestion);
                                                }}
                                                disabled={isRunning}
                                            >
                                                {isRunning ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                                                Run
                                            </Button>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </PanelSection>

                    <PanelSection title="Analysis Process" icon={<ListTree className="h-3.5 w-3.5" />} description="Structured execution history for this result chain.">
                        <div className="rounded-xl border bg-background/90 p-3">
                            {selectedSession ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-foreground">{selectedSession.title}</div>
                                            <div className="mt-1 text-xs text-muted-foreground">{selectedSession.outcome?.summary ?? 'No summary yet.'}</div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] uppercase">
                                            {selectedSession.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedSession.steps.map(step => (
                                            <div key={step.id} className="flex items-start gap-3 rounded-lg border bg-background/80 px-3 py-2">
                                                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-foreground">{step.title}</div>
                                                    {typeof step.data?.sql === 'string' ? (
                                                        <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">{step.data.sql}</pre>
                                                    ) : null}
                                                    {step.error ? <div className="mt-1 text-xs text-destructive">{step.error}</div> : null}
                                                </div>
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {step.status}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">Run one of the suggested analyses to populate the execution history.</div>
                            )}
                        </div>
                    </PanelSection>

                    <PanelSection title="Analysis Result" icon={<ChevronRight className="h-3.5 w-3.5" />} description="Outcome summary, generated SQL, and result handoff.">
                        <div className="rounded-xl border bg-background/90 p-3">
                            {selectedSession?.outcome ? (
                                <div className="space-y-3">
                                    <div className="text-sm text-foreground">{selectedSession.outcome.summary}</div>
                                    {selectedSession.outcome.artifacts
                                        .filter(artifact => artifact.type === 'sql')
                                        .map((artifact, index) => (
                                            <pre key={`${artifact.type}:${index}`} className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px]">
                                                {artifact.sql}
                                            </pre>
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
                                            Open Result
                                            <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground">Analysis results will appear here after execution.</div>
                            )}
                        </div>
                    </PanelSection>

                    <PanelSection title="Continue Analysis" icon={<ChevronRight className="h-3.5 w-3.5" />} description="V1 keeps follow-up analysis structured around explicit suggestions.">
                        <div className="space-y-3 rounded-xl border bg-background/90 p-3">
                            <Textarea value="Natural-language follow-up is planned for V2. Use the follow-up suggestions below in V1." readOnly className="min-h-20 resize-none text-xs" />
                            <Separator />
                            <div className="flex flex-wrap gap-2">
                                {(selectedSession?.outcome?.followups ?? workspace?.suggestions ?? []).map(suggestion => (
                                    <Button key={suggestion.id} variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleRunSuggestion(suggestion)}>
                                        {suggestion.title}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </PanelSection>
                </div>
            </ScrollArea>
        </div>
    );
}
