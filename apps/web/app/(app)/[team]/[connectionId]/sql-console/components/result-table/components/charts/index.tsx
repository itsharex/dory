'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { type ChartConfig } from '@/registry/new-york-v4/ui/chart';
import { cn } from '@/registry/new-york-v4/lib/utils';
import { ChartView } from './chart-view';
import { ChartRow, ChartType, NONE_VALUE, MetricOption, AggregatedChartData, ALL_SERIES_KEY, CHART_COLORS } from './chart-shared';

type ChartsProps = {
    rows: ChartRow[];
    columnsRaw?: unknown;
    className?: string;
};

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

    const aggregated = useMemo<AggregatedChartData>(() => {
        if (!effectiveXKey || !selectedMetric) {
            return { data: [], series: [] };
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
    const emptyMessage = getChartEmptyMessage({
        columnNames,
        effectiveXKey,
        hasRenderableData,
        selectedMetric,
    });

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
            <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
                <ChartView
                    chartState={{ chartType, xKey, yKey, groupKey }}
                    chartStateIsAuto={chartStateIsAuto}
                    columnNames={columnNames}
                    metricOptions={metricOptions}
                    effectiveXKey={effectiveXKey}
                    effectiveGroupKey={effectiveGroupKey}
                    aggregated={aggregated}
                    chartConfig={chartConfig}
                    emptyMessage={emptyMessage}
                    onChartTypeChange={value => {
                        if (value === 'bar' || value === 'line') {
                            setChartType(value);
                        }
                    }}
                    onXKeyChange={setXKey}
                    onYKeyChange={setYKey}
                    onGroupKeyChange={setGroupKey}
                    onResetAuto={() => {
                        setChartType(suggestedState.chartType);
                        setXKey(suggestedState.xKey);
                        setYKey(suggestedState.yKey);
                        setGroupKey(suggestedState.groupKey);
                    }}
                />
            </div>
        </div>
    );
}

function getChartEmptyMessage(props: {
    columnNames: string[];
    effectiveXKey: string;
    hasRenderableData: boolean;
    selectedMetric: MetricOption | null;
}) {
    const { columnNames, effectiveXKey, hasRenderableData, selectedMetric } = props;

    if (columnNames.length === 0) {
        return 'No columns available for charting.';
    }

    if (!selectedMetric || !effectiveXKey) {
        return 'Choose chart dimensions to preview.';
    }

    if (!hasRenderableData) {
        return 'No chartable values for the current selection.';
    }

    return null;
}
