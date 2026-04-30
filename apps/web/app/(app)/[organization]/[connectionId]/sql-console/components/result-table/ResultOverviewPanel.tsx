'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, Sigma, Lightbulb, CalendarRange, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import type { ResultColumnMeta, ResultSetStatsV1 } from '@/lib/client/type';
import { buildInsights, buildInsightRewriteRequest, buildStructuredInsightView, type InsightAction, type InsightRewriteResponse } from '@/lib/client/result-set-insights';
import { useAtomValue } from 'jotai';
import { activeSessionIdAtom, copilotAnalysisRequestAtom, copilotPanelOpenAtom, copilotPanelTabAtom } from '../../sql-console.store';
import { copilotPromptRequestAtom } from './stores/copilot-prompt.atoms';
import { makeActiveSetAtom } from './stores/active-set.atoms';
import { activeTabIdAtom } from '@/shared/stores/app.store';

const insightRewriteCache = new Map<string, InsightRewriteResponse | null>();

function Section(props: { title: string; icon: React.ReactNode; children: React.ReactNode; description?: string }) {
    const { title, icon, children, description } = props;

    return (
        <Collapsible defaultOpen asChild>
            <section className="flex flex-col gap-3">
                <CollapsibleTrigger className="group flex w-full items-start justify-between gap-3 text-left">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            {icon}
                            <span>{title}</span>
                        </div>
                        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
                    </div>
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>{children}</CollapsibleContent>
            </section>
        </Collapsible>
    );
}

function KeyColumnGroup(props: { label: string; values: string[]; emptyLabel: string }) {
    const { label, values, emptyLabel } = props;

    return (
        <div className="rounded-lg border bg-background px-3 py-2.5">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {values.length > 0 ? (
                    values.map(value => (
                        <Badge key={`${label}:${value}`} variant="outline" className="rounded-md bg-background px-2 py-1 text-[11px] font-normal">
                            {value}
                        </Badge>
                    ))
                ) : (
                    <span className="text-xs text-muted-foreground">{emptyLabel}</span>
                )}
            </div>
        </div>
    );
}

export function ResultOverviewPanel(props: {
    stats?: ResultSetStatsV1 | null;
    columns?: ResultColumnMeta[] | null;
    rowCount?: number;
    sqlText?: string | null;
    rows?: Array<Record<string, unknown>> | null;
}) {
    const { stats, columns, sqlText, rows } = props;
    const t = useTranslations('SqlConsole');
    const locale = useLocale();
    const setCopilotPanelOpen = useSetAtom(copilotPanelOpenAtom);
    const setCopilotPanelTab = useSetAtom(copilotPanelTabAtom);
    const setCopilotPromptRequest = useSetAtom(copilotPromptRequestAtom);
    const setCopilotAnalysisRequest = useSetAtom(copilotAnalysisRequestAtom);
    const activeTabId = useAtomValue(activeTabIdAtom);
    const activeSessionId = useAtomValue(activeSessionIdAtom);
    const activeSet = useAtomValue(useMemo(() => makeActiveSetAtom(activeTabId, activeSessionId), [activeSessionId, activeTabId]));
    const [rewritten, setRewritten] = useState<InsightRewriteResponse | null>(null);

    const rewriteRequest = useMemo(
        () =>
            buildInsightRewriteRequest({
                stats,
                columns,
                sqlText,
                rows,
                locale,
                t: (key, values) => t(key as any, values),
            }),
        [columns, locale, rows, sqlText, stats, t],
    );
    const rewriteCacheKey = useMemo(() => (rewriteRequest ? JSON.stringify(rewriteRequest) : null), [rewriteRequest]);

    const insightView = useMemo(
        () =>
            buildInsights(
                {
                    stats,
                    columns,
                    sqlText,
                    rows,
                    locale,
                    t: (key, values) => t(key as any, values),
                },
                rewritten,
            ),
        [columns, locale, rewritten, rows, sqlText, stats, t],
    );
    const structuredInsight = useMemo(
        () =>
            buildStructuredInsightView({
                context: {
                    stats,
                    columns,
                    sqlText,
                    rows,
                    locale,
                    t: (key, values) => t(key as any, values),
                },
                view: insightView,
            }),
        [columns, insightView, locale, rows, sqlText, stats, t],
    );

    const handleAction = (action: InsightAction) => {
        if (action.kind === 'analysis-suggestion') {
            setCopilotPanelOpen(true);
            setCopilotPanelTab('action');
            setCopilotAnalysisRequest({
                id: `${action.suggestionId}-${Date.now()}`,
                suggestionId: action.suggestionId,
                sourceResultRef:
                    activeSessionId && typeof activeSet === 'number' && activeSet >= 0
                        ? {
                              sessionId: activeSessionId,
                              setIndex: activeSet,
                          }
                        : undefined,
            });
            return;
        }

        if (action.kind !== 'copilot-prompt') {
            return;
        }

        setCopilotPanelOpen(true);
        setCopilotPanelTab('ask');
        setCopilotPromptRequest({
            id: `${action.id}-${Date.now()}`,
            prompt: action.prompt,
        });
    };

    useEffect(() => {
        if (!rewriteRequest || !rewriteCacheKey) {
            setRewritten(null);
            return;
        }

        if (insightRewriteCache.has(rewriteCacheKey)) {
            setRewritten(insightRewriteCache.get(rewriteCacheKey) ?? null);
            return;
        }

        const controller = new AbortController();
        let cancelled = false;

        void (async () => {
            try {
                const response = await fetch('/api/ai/result-insights', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(rewriteRequest),
                    signal: controller.signal,
                });

                const payload = (await response.json().catch(() => null)) as InsightRewriteResponse | null;
                if (cancelled) return;
                insightRewriteCache.set(rewriteCacheKey, payload ?? null);
                setRewritten(payload ?? null);
            } catch (error) {
                if (controller.signal.aborted || cancelled) return;
                insightRewriteCache.set(rewriteCacheKey, null);
                setRewritten(null);
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [rewriteCacheKey, rewriteRequest]);

    return (
        <div className="flex h-full min-h-0 w-full">
            <ScrollArea className="h-full w-full">
                <div className="flex flex-col gap-4 p-4">
                    <Section
                        title={t('Insights.QuickSummary.SectionTitle')}
                        icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.QuickSummary.Description')}
                    >
                        <div className="rounded-lg border bg-background px-4 py-3">
                            <div className="text-sm font-medium text-foreground">{insightView.quickSummary.title}</div>
                            {insightView.quickSummary.subtitle ? <div className="mt-1 text-xs text-muted-foreground">{insightView.quickSummary.subtitle}</div> : null}
                        </div>
                    </Section>

                    <Section
                        title={t('Insights.KeyInsights.SectionTitle')}
                        icon={<Lightbulb className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.KeyInsights.Description')}
                    >
                        <div className="rounded-lg border bg-background p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-semibold text-foreground">{rewritten?.primaryInsight ?? structuredInsight.card.headline}</div>
                                {rewritten?.analysisState ? (
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                        {rewritten.analysisState}
                                    </Badge>
                                ) : null}
                            </div>
                            <div className="mt-3 space-y-2">
                                {(rewritten?.limitations?.length ? rewritten.limitations : structuredInsight.card.summaryLines).length > 0 ? (
                                    (rewritten?.limitations?.length ? rewritten.limitations : structuredInsight.card.summaryLines).map(line => (
                                        <div key={line} className="text-sm text-foreground">
                                            {line}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-muted-foreground">{t('Insights.KeyInsights.Empty')}</div>
                                )}
                            </div>
                        </div>
                    </Section>

                    <Section
                        title={t('Insights.KeyColumns.SectionTitle')}
                        icon={<Sigma className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.KeyColumns.Description')}
                    >
                        <div className="grid gap-2 md:grid-cols-2">
                            <KeyColumnGroup
                                label={t('Insights.KeyColumns.Time')}
                                values={insightView.keyColumns.time ? [insightView.keyColumns.time] : []}
                                emptyLabel={t('Insights.KeyColumns.Empty')}
                            />
                            <KeyColumnGroup label={t('Insights.KeyColumns.Measure')} values={insightView.keyColumns.measures} emptyLabel={t('Insights.KeyColumns.Empty')} />
                            <KeyColumnGroup label={t('Insights.KeyColumns.Dimensions')} values={insightView.keyColumns.dimensions} emptyLabel={t('Insights.KeyColumns.Empty')} />
                            <KeyColumnGroup label={t('Insights.KeyColumns.Identifier')} values={insightView.keyColumns.identifiers} emptyLabel={t('Insights.KeyColumns.Empty')} />
                        </div>
                    </Section>

                    <Section
                        title={t('Insights.RecommendedActions.SectionTitle')}
                        icon={<CalendarRange className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.RecommendedActions.Description')}
                    >
                        <div className="flex flex-wrap gap-2">
                            {structuredInsight.recommendedActions.map(action => (
                                <Button key={action.id} variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => handleAction(action)}>
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                        {rewritten?.recommendedSql ? (
                            <div className="mt-3 rounded-lg border bg-background p-3">
                                <div className="text-xs font-medium text-muted-foreground">Recommended SQL</div>
                                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-xs leading-relaxed text-foreground">{rewritten.recommendedSql}</pre>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 h-8 text-xs"
                                    onClick={() => {
                                        setCopilotPanelOpen(true);
                                        setCopilotPanelTab('ask');
                                        setCopilotPromptRequest({
                                            id: `recommended-sql-${Date.now()}`,
                                            prompt: `Use this recommended SQL as the next analysis step:\n\n${rewritten.recommendedSql}`,
                                        });
                                    }}
                                >
                                    继续分析这个 SQL
                                </Button>
                            </div>
                        ) : null}
                    </Section>
                </div>
            </ScrollArea>
        </div>
    );
}
