'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/registry/new-york-v4/ui/button';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/registry/new-york-v4/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';
import { cn } from '@/registry/new-york-v4/lib/utils';

type ChartType = 'bar' | 'line';
type MetricKind = 'count' | 'sum';
type ChartRow = { rowData: Record<string, unknown> };

type MetricOption = {
    key: string;
    label: string;
    kind: MetricKind;
    column?: string;
};

type ChartsProps = {
    rows: ChartRow[];
    columnsRaw?: unknown;
    className?: string;
};

const NONE_VALUE = '__none__';
const ALL_SERIES_KEY = '__value__';
const CHART_COLORS = [
    'var(--primary)',
    'color-mix(in oklab, var(--primary) 84%, var(--background))',
    'color-mix(in oklab, var(--primary) 68%, var(--background))',
    'color-mix(in oklab, var(--primary) 52%, var(--background))',
    'color-mix(in oklab, var(--primary) 36%, var(--background))',
    'color-mix(in oklab, var(--primary) 20%, var(--background))',
];

function isNumericValue(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return Number.isFinite(Number(trimmed));
}

function toNumericValue(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function toDimensionLabel(value: unknown) {
    if (value == null) return 'NULL';
    if (typeof value === 'string') return value || '(empty)';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function toSeriesId(label: string) {
    const normalized = label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized ? `series-${normalized}` : 'series-empty';
}

function getColumnNames(columnsRaw: unknown, rows: ChartRow[]) {
    if (Array.isArray(columnsRaw)) {
        const names = columnsRaw.map(column => (column && typeof column === 'object' && 'name' in column ? String((column as { name?: unknown }).name ?? '') : '')).filter(Boolean);
        if (names.length > 0) return names;
    }

    const firstRow = rows[0]?.rowData;
    if (firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)) {
        return Object.keys(firstRow);
    }

    return [];
}

function getNumericColumns(columnNames: string[], rows: ChartRow[]) {
    return columnNames.filter(columnName => rows.some(row => isNumericValue(row.rowData?.[columnName])));
}

function getSuggestedState(columnNames: string[]) {
    return {
        chartType: 'bar' as ChartType,
        xKey: columnNames[0] ?? '',
        yKey: 'count',
        groupKey: NONE_VALUE,
    };
}

export function Charts({ rows, columnsRaw, className }: ChartsProps) {
    const columnNames = useMemo(() => getColumnNames(columnsRaw, rows), [columnsRaw, rows]);
    const numericColumns = useMemo(() => getNumericColumns(columnNames, rows), [columnNames, rows]);
    const suggestedState = useMemo(() => getSuggestedState(columnNames), [columnNames]);

    const [chartType, setChartType] = useState<ChartType>(suggestedState.chartType);
    const [xKey, setXKey] = useState(suggestedState.xKey);
    const [yKey, setYKey] = useState(suggestedState.yKey);
    const [groupKey, setGroupKey] = useState(suggestedState.groupKey);

    const metricOptions = useMemo<MetricOption[]>(
        () => [
            { key: 'count', label: 'Count rows', kind: 'count' },
            ...numericColumns.map(columnName => ({
                key: `sum:${columnName}`,
                label: `Sum ${columnName}`,
                kind: 'sum' as const,
                column: columnName,
            })),
        ],
        [numericColumns],
    );

    const selectedMetric = useMemo(() => metricOptions.find(option => option.key === yKey) ?? metricOptions[0] ?? null, [metricOptions, yKey]);

    const effectiveXKey = columnNames.includes(xKey) ? xKey : suggestedState.xKey;
    const effectiveGroupKey = groupKey !== NONE_VALUE && columnNames.includes(groupKey) ? groupKey : NONE_VALUE;

    useEffect(() => {
        if (!columnNames.includes(xKey)) {
            setXKey(suggestedState.xKey);
        }
    }, [columnNames, suggestedState.xKey, xKey]);

    useEffect(() => {
        if (!metricOptions.some(option => option.key === yKey)) {
            setYKey(suggestedState.yKey);
        }
    }, [metricOptions, suggestedState.yKey, yKey]);

    useEffect(() => {
        if (groupKey !== NONE_VALUE && !columnNames.includes(groupKey)) {
            setGroupKey(suggestedState.groupKey);
        }
    }, [columnNames, groupKey, suggestedState.groupKey]);

    const chartStateIsAuto = chartType === suggestedState.chartType && xKey === suggestedState.xKey && yKey === suggestedState.yKey && groupKey === suggestedState.groupKey;

    const aggregated = useMemo(() => {
        if (!effectiveXKey || !selectedMetric) {
            return { data: [], series: [] as Array<{ key: string; label: string }> };
        }

        const dataMap = new Map<string, Record<string, number | string>>();
        const seriesMap = new Map<string, string>();

        for (const row of rows) {
            const rowData = row.rowData ?? {};
            const xLabel = toDimensionLabel(rowData[effectiveXKey]);
            const seriesLabel = effectiveGroupKey === NONE_VALUE ? ALL_SERIES_KEY : toDimensionLabel(rowData[effectiveGroupKey]);
            const seriesKey = effectiveGroupKey === NONE_VALUE ? ALL_SERIES_KEY : toSeriesId(seriesLabel);
            const currentValue = selectedMetric.kind === 'count' ? 1 : selectedMetric.column ? toNumericValue(rowData[selectedMetric.column]) : null;

            if (currentValue == null) {
                continue;
            }

            let datum = dataMap.get(xLabel);
            if (!datum) {
                datum = { xLabel };
                dataMap.set(xLabel, datum);
            }

            datum[seriesKey] = typeof datum[seriesKey] === 'number' ? Number(datum[seriesKey]) + currentValue : currentValue;
            seriesMap.set(seriesKey, seriesLabel);
        }

        return {
            data: Array.from(dataMap.values()).slice(0, 24),
            series: Array.from(seriesMap.entries()).map(([key, label]) => ({ key, label })),
        };
    }, [effectiveGroupKey, effectiveXKey, rows, selectedMetric]);

    const chartConfig = useMemo<ChartConfig>(() => {
        const config: ChartConfig = {};

        aggregated.series.forEach((series, index) => {
            config[series.key] = {
                label: series.label === ALL_SERIES_KEY ? (selectedMetric?.label ?? 'Value') : series.label,
                color: CHART_COLORS[index % CHART_COLORS.length],
            };
        });

        return config;
    }, [aggregated.series, selectedMetric]);

    const hasRenderableData = aggregated.data.length > 0 && aggregated.series.length > 0;

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
            <div className="border-b border-border/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    <ChartSelect
                        label="Chart"
                        value={chartType}
                        onValueChange={value => {
                            if (value === 'bar' || value === 'line') {
                                setChartType(value);
                            }
                        }}
                        options={[
                            { value: 'bar', label: 'Bar' },
                            { value: 'line', label: 'Line' },
                        ]}
                    />
                    <ChartSelect
                        label="X"
                        value={xKey}
                        onValueChange={setXKey}
                        options={columnNames.map(columnName => ({ value: columnName, label: columnName }))}
                        disabled={columnNames.length === 0}
                    />
                    <ChartSelect
                        label="Y"
                        value={yKey}
                        onValueChange={setYKey}
                        options={metricOptions.map(option => ({ value: option.key, label: option.label }))}
                        disabled={metricOptions.length === 0}
                    />
                    <ChartSelect
                        label="Group"
                        value={groupKey}
                        onValueChange={setGroupKey}
                        options={[
                            { value: NONE_VALUE, label: 'None' },
                            ...columnNames.filter(columnName => columnName !== effectiveXKey).map(columnName => ({ value: columnName, label: columnName })),
                        ]}
                        disabled={columnNames.length === 0}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant={chartStateIsAuto ? 'secondary' : 'outline'}
                        className="h-8"
                        onClick={() => {
                            setChartType(suggestedState.chartType);
                            setXKey(suggestedState.xKey);
                            setYKey(suggestedState.yKey);
                            setGroupKey(suggestedState.groupKey);
                        }}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        Auto
                    </Button>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/10 p-4">
                    {columnNames.length === 0 ? (
                        <EmptyState message="No columns available for charting." />
                    ) : !selectedMetric || !effectiveXKey ? (
                        <EmptyState message="Choose chart dimensions to preview." />
                    ) : !hasRenderableData ? (
                        <EmptyState message="No chartable values for the current selection." />
                    ) : (
                        <div className="h-full min-h-[220px] w-full">
                            <ChartContainer config={chartConfig} className="aspect-auto h-full w-full overflow-hidden">
                                {chartType === 'line' ? (
                                    <LineChart accessibilityLayer data={aggregated.data} margin={{ left: 8, right: 8, top: 8 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tickFormatter={value => String(value).slice(0, 18)} />
                                        <YAxis tickLine={false} axisLine={false} width={56} />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        {aggregated.series.map(series => (
                                            <Line key={series.key} type="monotone" dataKey={series.key} stroke={`var(--color-${series.key})`} strokeWidth={2} dot={false} />
                                        ))}
                                    </LineChart>
                                ) : (
                                    <BarChart accessibilityLayer data={aggregated.data} margin={{ left: 8, right: 8, top: 8 }}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="xLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tickFormatter={value => String(value).slice(0, 18)} />
                                        <YAxis tickLine={false} axisLine={false} width={56} />
                                        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                        {aggregated.series.map(series => (
                                            <Bar
                                                key={series.key}
                                                dataKey={series.key}
                                                fill={`var(--color-${series.key})`}
                                                radius={4}
                                                stackId={effectiveGroupKey === NONE_VALUE ? undefined : 'group'}
                                            />
                                        ))}
                                    </BarChart>
                                )}
                            </ChartContainer>
                        </div>
                    )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Based on {rows.length.toLocaleString()} filtered rows</span>
                    <span>{hasRenderableData ? `${aggregated.data.length.toLocaleString()} chart buckets` : effectiveGroupKey === NONE_VALUE ? 'Ungrouped' : `Grouped by ${effectiveGroupKey}`}</span>
                </div>
            </div>
        </div>
    );
}

function ChartSelect(props: { label: string; value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
    const { label, value, onValueChange, options, disabled = false } = props;

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{label}:</span>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger size="sm" className="h-8 min-w-[140px] justify-between">
                    <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent align="start">
                    {options.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <BarChart3 className="h-5 w-5" />
            <div>{message}</div>
        </div>
    );
}
