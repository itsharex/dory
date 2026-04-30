'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import type { ResultColumnMeta, ResultSetStatsV1 } from '@/lib/client/type';
import { buildInsights, buildInsightRewriteRequest, buildStructuredInsightView, type InsightAction, type InsightRewriteResponse } from '@/lib/client/result-set-insights';
import { fetchInsightRewrite, getCachedInsightRewrite, makeInsightRewriteCacheKey } from '@/lib/client/result-insight-rewrite';
import { useAtomValue } from 'jotai';
import { activeSessionIdAtom, copilotAnalysisRequestAtom, copilotPanelOpenAtom, copilotPanelTabAtom } from '../../sql-console.store';
import { copilotPromptRequestAtom } from './stores/copilot-prompt.atoms';
import { makeActiveSetAtom } from './stores/active-set.atoms';
import { activeTabIdAtom } from '@/shared/stores/app.store';

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
    const rewriteCacheKey = useMemo(() => makeInsightRewriteCacheKey(rewriteRequest), [rewriteRequest]);

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
                action: action.action,
                sqlPreview: action.sqlPreview,
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
        if (!rewriteCacheKey) {
            setRewritten(null);
            return;
        }

        const cached = getCachedInsightRewrite(rewriteCacheKey);
        if (cached !== undefined) {
            setRewritten(cached ?? null);
            return;
        }

        let cancelled = false;

        void (async () => {
            const payload = await fetchInsightRewrite(rewriteCacheKey);
            if (!cancelled) setRewritten(payload);
        })();

        return () => {
            cancelled = true;
        };
    }, [rewriteCacheKey]);

    return (
        <div className="flex h-full min-h-0 w-full">
            <ScrollArea className="h-full w-full">
                <div className="flex flex-col gap-4 p-4">
                    <Section
                        title={t('Insights.KeyInsights.SectionTitle')}
                        icon={<Sparkles className="h-3.5 w-3.5 text-violet-400" />}
                        description={t('Insights.KeyInsights.Description')}
                    >
                        <div className="space-y-3">
                            {structuredInsight.decision.items.length > 0 ? (
                                structuredInsight.decision.items.map((item, index) => (
                                    <div key={item.id} className="rounded-lg border bg-background px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                                {index + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold leading-snug text-foreground">{item.title}</div>
                                                {item.summary !== item.title ? <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.summary}</div> : null}
                                                {item.actions.length > 0 ? (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {item.actions.map(action => (
                                                            <Button
                                                                key={`${item.id}:${action.id}`}
                                                                variant={action.priority === 'primary' ? 'default' : 'outline'}
                                                                size="sm"
                                                                className="h-8 rounded-full px-3 text-xs"
                                                                onClick={() => handleAction(action)}
                                                            >
                                                                <span className="truncate">{action.label}</span>
                                                            </Button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-lg border bg-background px-4 py-3 text-xs text-muted-foreground">{structuredInsight.narrative}</div>
                            )}
                        </div>
                    </Section>
                </div>
            </ScrollArea>
        </div>
    );
}
