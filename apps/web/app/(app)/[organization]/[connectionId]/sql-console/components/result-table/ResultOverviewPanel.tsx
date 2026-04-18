'use client';

import React from 'react';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { ScrollArea } from '@/registry/new-york-v4/ui/scroll-area';
import { Separator } from '@/registry/new-york-v4/ui/separator';
import { BarChart3, Binary, CalendarRange, Hash, Sigma, Table2 } from 'lucide-react';
import type { ResultColumnMeta, ResultSetStatsV1 } from '@/lib/client/type';
import { useLocale, useTranslations } from 'next-intl';

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

function labelForKind(kind?: string | null) {
    switch (kind) {
        case 'single_value':
            return 'Single value';
        case 'time_series':
            return 'Time series';
        case 'aggregated_table':
            return 'Aggregated';
        case 'detail_table':
            return 'Detail table';
        default:
            return 'Unknown';
    }
}

function labelForChart(kind?: string | null) {
    if (!kind) return '—';
    return kind.replace(/_/g, ' ');
}

function labelForRole(role?: string | null) {
    switch (role) {
        case 'identifier':
            return 'ID';
        case 'dimension':
            return 'Dimension';
        case 'measure':
            return 'Measure';
        case 'time':
            return 'Time';
        case 'text':
            return 'Text';
        case 'json':
            return 'JSON';
        default:
            return 'Unknown';
    }
}

function Section(props: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    const { title, icon, children } = props;

    return (
        <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {icon}
                <span>{title}</span>
            </div>
            {children}
        </section>
    );
}

export function ResultOverviewPanel(props: {
    stats?: ResultSetStatsV1 | null;
    columns?: ResultColumnMeta[] | null;
    rowCount?: number;
}) {
    const { stats, columns, rowCount } = props;
    const t = useTranslations('SqlConsole');
    const locale = useLocale();

    const summary = stats?.summary ?? null;
    const profiledColumns = columns ?? [];
    const highlightedColumns = profiledColumns
        .filter(column => ['time', 'measure', 'dimension', 'identifier'].includes(column.semanticRole ?? ''))
        .slice(0, 8);

    return (
        <div className="flex h-full min-h-0 w-full bg-muted/20">
            <ScrollArea className="h-full w-full">
                <div className="space-y-5 p-3">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">Summary</div>
                        <div className="text-xs leading-5 text-muted-foreground">
                            {summary ? 'Profiled result summary from the current ResultSet.' : 'Profiling current ResultSet…'}
                        </div>
                    </div>

                    <Section title="Shape" icon={<Table2 className="h-3.5 w-3.5" />}>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border bg-background/80 px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">Kind</div>
                                <div className="mt-1 text-sm font-medium">{labelForKind(summary?.kind)}</div>
                            </div>
                            <div className="rounded-lg border bg-background/80 px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">Chart</div>
                                <div className="mt-1 text-sm font-medium">{labelForChart(summary?.recommendedChart)}</div>
                            </div>
                            <div className="rounded-lg border bg-background/80 px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">Rows</div>
                                <div className="mt-1 text-sm font-medium">{formatNumber(locale, summary?.rowCount ?? rowCount ?? null)}</div>
                            </div>
                            <div className="rounded-lg border bg-background/80 px-3 py-2">
                                <div className="text-[11px] text-muted-foreground">Columns</div>
                                <div className="mt-1 text-sm font-medium">{formatNumber(locale, summary?.columnCount ?? profiledColumns.length)}</div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Signals" icon={<BarChart3 className="h-3.5 w-3.5" />}>
                        <div className="space-y-2 rounded-lg border bg-background/80 p-3 text-xs">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Null ratio</span>
                                <span className="font-medium text-foreground">{formatRatio(summary?.nullCellRatio)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Duplicate rows</span>
                                <span className="font-medium text-foreground">{formatRatio(summary?.duplicateRowRatio)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Good for chart</span>
                                <span className="font-medium text-foreground">{summary?.isGoodForChart ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </Section>

                    <Section title="Key Columns" icon={<Sigma className="h-3.5 w-3.5" />}>
                        <div className="flex flex-wrap gap-1.5">
                            {highlightedColumns.length > 0 ? (
                                highlightedColumns.map(column => (
                                    <Badge key={column.name} variant="outline" className="gap-1 rounded-md bg-background/80 px-2 py-1 text-[11px] font-normal">
                                        <span className="font-medium text-foreground">{column.name}</span>
                                        <span className="text-muted-foreground">{labelForRole(column.semanticRole)}</span>
                                    </Badge>
                                ))
                            ) : (
                                <div className="text-xs text-muted-foreground">Waiting for column profiling…</div>
                            )}
                        </div>
                    </Section>

                    {summary?.primaryTimeColumn && (
                        <>
                            <Separator />
                            <Section title="Timeline" icon={<CalendarRange className="h-3.5 w-3.5" />}>
                                <div className="rounded-lg border bg-background/80 p-3 text-xs">
                                    <div className="text-[11px] text-muted-foreground">Primary time column</div>
                                    <div className="mt-1 text-sm font-medium text-foreground">{summary.primaryTimeColumn}</div>
                                </div>
                            </Section>
                        </>
                    )}

                    {stats?.columns && Object.keys(stats.columns).length > 0 && (
                        <>
                            <Separator />
                            <Section title="Column Stats" icon={<Hash className="h-3.5 w-3.5" />}>
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
                                                        distinct {formatNumber(locale, profile.distinctCount)} / null {formatNumber(locale, profile.nullCount)}
                                                    </span>
                                                </div>
                                                {profile.topK && profile.topK.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {profile.topK.slice(0, 3).map(item => (
                                                            <Badge key={`${column.name}:${item.value}`} variant="secondary" className="rounded-md px-1.5 py-0.5 text-[10px] font-normal">
                                                                {item.value} · {formatNumber(locale, item.count)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Section>
                        </>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
