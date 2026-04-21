'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, Sigma, Lightbulb, BarChart3, CalendarRange, ChevronDown, Binary, Hash } from 'lucide-react';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Separator } from '@/registry/new-york-v4/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import type { ResultColumnMeta, ResultSetStatsV1 } from '@/lib/client/type';
import { buildInsights, buildInsightRewriteRequest, buildStructuredInsightView, type InsightAction, type InsightRewriteResponse } from '@/lib/client/result-set-insights';
import { useAtomValue } from 'jotai';
import { activeSessionIdAtom, copilotAnalysisRequestAtom, copilotPanelOpenAtom, copilotPanelTabAtom } from '../../sql-console.store';
import { copilotPromptRequestAtom } from './stores/copilot-prompt.atoms';
import { makeActiveSetAtom } from './stores/active-set.atoms';
import { activeTabIdAtom } from '@/shared/stores/app.store';

const insightRewriteCache = new Map<string, InsightRewriteResponse | null>();

function formatRatio(value?: number | null, digits = 1) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }

    return `${(value * 100).toFixed(digits)}%`;
}

function formatNumber(locale: string, value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
    }

    return value.toLocaleString(locale);
}

function labelForRole(role: string, t: ReturnType<typeof useTranslations>) {
    switch (role) {
        case 'time':
            return t('Insights.KeyColumns.Time');
        case 'measure':
            return t('Insights.KeyColumns.Measure');
        case 'dimension':
            return t('Insights.KeyColumns.Dimensions');
        case 'identifier':
            return t('Insights.KeyColumns.Identifier');
        default:
            return t('Insights.Kinds.Unknown');
    }
}

function Section(props: { title: string; icon: React.ReactNode; children: React.ReactNode; description?: string }) {
    const { title, icon, children, description } = props;

    return (
        <section className="space-y-3">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {icon}
                    <span>{title}</span>
                </div>
                {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
            </div>
            {children}
        </section>
    );
}

function KeyColumnGroup(props: { label: string; values: string[]; emptyLabel: string }) {
    const { label, values, emptyLabel } = props;

    return (
        <div className="rounded-lg border bg-background/80 px-3 py-2.5">
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
    const { stats, columns, rowCount, sqlText, rows } = props;
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

    const summary = stats?.summary ?? null;
    const profiledColumns = columns ?? [];
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

    const highlightedColumns = profiledColumns.filter(column => ['time', 'measure', 'dimension', 'identifier'].includes(column.semanticRole ?? '')).slice(0, 6);

    const handleAction = (action: InsightAction) => {
        if (action.kind === 'analysis-suggestion') {
            setCopilotPanelOpen(true);
            setCopilotPanelTab('analysis');
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
        <div className="flex h-full min-h-0 w-full bg-muted/20">
            <ScrollArea className="h-full w-full">
                <div className="space-y-5 p-3">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{t('Insights.Title')}</div>
                        <div className="text-xs leading-5 text-muted-foreground">{summary ? t('Insights.Subtitle') : t('Insights.Loading')}</div>
                    </div>

                    <Section title={t('Insights.QuickSummary.SectionTitle')} icon={<Sparkles className="h-3.5 w-3.5" />}>
                        <div className="rounded-xl border bg-background/90 px-4 py-3">
                            <div className="text-sm font-medium text-foreground">{insightView.quickSummary.title}</div>
                            {insightView.quickSummary.subtitle ? <div className="mt-1 text-xs text-muted-foreground">{insightView.quickSummary.subtitle}</div> : null}
                        </div>
                    </Section>

                    <Section title={t('Insights.KeyInsights.SectionTitle')} icon={<Lightbulb className="h-3.5 w-3.5" />} description={t('Insights.KeyInsights.Description')}>
                        <div className="rounded-xl border bg-background/90 p-4">
                            <div className="text-sm font-semibold text-foreground">{structuredInsight.card.headline}</div>
                            <div className="mt-3 space-y-2">
                                {structuredInsight.card.summaryLines.length > 0 ? (
                                    structuredInsight.card.summaryLines.map(line => (
                                        <div key={line} className="text-sm text-foreground">
                                            {line}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-muted-foreground">{t('Insights.KeyInsights.Empty')}</div>
                                )}
                            </div>
                            <div className="mt-3 text-[11px] text-muted-foreground">{insightView.source === 'llm' ? t('Insights.Source.Llm') : t('Insights.Source.Rules')}</div>
                        </div>
                    </Section>

                    <Section title={t('Insights.KeyColumns.SectionTitle')} icon={<Sigma className="h-3.5 w-3.5" />}>
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
                        icon={<CalendarRange className="h-3.5 w-3.5" />}
                        description={t('Insights.RecommendedActions.Description')}
                    >
                        <div className="flex flex-wrap gap-2">
                            {structuredInsight.recommendedActions.map(action => (
                                <Button key={action.id} variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => handleAction(action)}>
                                    {action.label}
                                </Button>
                            ))}
                        </div>
                    </Section>

                    <Collapsible>
                        <div className="rounded-xl border bg-background/85">
                            <CollapsibleTrigger asChild>
                                <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">{t('Insights.Profile.Title')}</div>
                                        <div className="mt-1 text-xs text-muted-foreground">{t('Insights.Profile.Description')}</div>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                                </button>
                            </CollapsibleTrigger>

                            <CollapsibleContent className="border-t px-4 py-3">
                                <div className="space-y-4">
                                    <Section title={t('Insights.Profile.SignalsTitle')} icon={<BarChart3 className="h-3.5 w-3.5" />}>
                                        <div className="space-y-2 rounded-lg border bg-background/80 p-3 text-xs">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">{t('Insights.Profile.NullRatio')}</span>
                                                <span className="font-medium text-foreground">{formatRatio(summary?.nullCellRatio)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">{t('Insights.Profile.DuplicateRows')}</span>
                                                <span className="font-medium text-foreground">{formatRatio(summary?.duplicateRowRatio)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">{t('Insights.Profile.ChartReadiness')}</span>
                                                <span className="font-medium text-foreground">
                                                    {summary?.isGoodForChart ? t('Insights.Profile.Yes') : t('Insights.Profile.No')}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-muted-foreground">{t('Insights.Profile.RowCount')}</span>
                                                <span className="font-medium text-foreground">{formatNumber(locale, summary?.rowCount ?? rowCount ?? null)}</span>
                                            </div>
                                        </div>
                                    </Section>

                                    {highlightedColumns.length > 0 ? (
                                        <>
                                            <Separator />
                                            <Section title={t('Insights.Profile.HighlightedColumns')} icon={<Binary className="h-3.5 w-3.5" />}>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {highlightedColumns.map(column => (
                                                        <Badge key={column.name} variant="outline" className="gap-1 rounded-md bg-background/80 px-2 py-1 text-[11px] font-normal">
                                                            <span className="font-medium text-foreground">{column.name}</span>
                                                            <span className="text-muted-foreground">{labelForRole(column.semanticRole ?? 'unknown', t)}</span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </Section>
                                        </>
                                    ) : null}

                                    {stats?.columns && Object.keys(stats.columns).length > 0 ? (
                                        <>
                                            <Separator />
                                            <Section title={t('Insights.Profile.ColumnStatsTitle')} icon={<Hash className="h-3.5 w-3.5" />}>
                                                <div className="space-y-2">
                                                    {profiledColumns.slice(0, 5).map(column => {
                                                        const profile = stats.columns[column.name];
                                                        if (!profile) return null;

                                                        return (
                                                            <div key={column.name} className="rounded-lg border bg-background/80 p-3 text-xs">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="font-medium text-foreground">{column.name}</span>
                                                                    <span className="text-muted-foreground">{column.normalizedType}</span>
                                                                </div>
                                                                <div className="mt-2 flex items-center gap-2 text-muted-foreground">
                                                                    <Binary className="h-3.5 w-3.5" />
                                                                    <span>
                                                                        {t('Insights.Profile.ColumnStatLine', {
                                                                            distinct: formatNumber(locale, profile.distinctCount),
                                                                            nulls: formatNumber(locale, profile.nullCount),
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {profile.topK && profile.topK.length > 0 ? (
                                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                                        {profile.topK.slice(0, 3).map(item => (
                                                                            <Badge
                                                                                key={`${column.name}:${item.value}`}
                                                                                variant="secondary"
                                                                                className="rounded-md px-1.5 py-0.5 text-[10px] font-normal"
                                                                            >
                                                                                {item.value} · {formatNumber(locale, item.count)}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Section>
                                        </>
                                    ) : null}
                                </div>
                            </CollapsibleContent>
                        </div>
                    </Collapsible>
                </div>
            </ScrollArea>
        </div>
    );
}
