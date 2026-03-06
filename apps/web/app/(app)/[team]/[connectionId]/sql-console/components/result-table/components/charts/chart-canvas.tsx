'use client';

import React from 'react';
import { Bar, BarChart, Brush, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/registry/new-york-v4/ui/chart';

import { AggregatedChartData, ChartEmptyState, ChartType, NONE_VALUE } from './chart-shared';

export function ChartCanvas(props: {
    chartType: ChartType;
    chartConfig: ChartConfig;
    aggregated: AggregatedChartData;
    effectiveGroupKey: string;
    emptyMessage: string | null;
    onApplyChartFilter: (
        filters: Array<{ col: string; kind: 'exact'; raw: unknown } | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }>,
        mode?: { append?: boolean },
    ) => void;
}) {
    const { chartType, chartConfig, aggregated, effectiveGroupKey, emptyMessage, onApplyChartFilter } = props;
    const [shiftPressed, setShiftPressed] = React.useState(false);
    const pendingBrushSelectionRef = React.useRef<{ startIndex?: number; endIndex?: number } | null>(null);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Shift') {
                setShiftPressed(true);
            }
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Shift') {
                setShiftPressed(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    React.useEffect(() => {
        const commitBrushSelection = () => {
            const selection = pendingBrushSelectionRef.current;
            if (!selection) {
                return;
            }

            pendingBrushSelectionRef.current = null;
            const startIndex = selection.startIndex;
            const endIndex = selection.endIndex;

            if (startIndex == null || endIndex == null || endIndex <= startIndex) {
                return;
            }

            const startDatum = aggregated.data[startIndex] as Record<string, unknown> | undefined;
            const endDatum = aggregated.data[endIndex] as Record<string, unknown> | undefined;
            const startFilter = startDatum?.__xBrushFilter as
                | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }
                | undefined;
            const endFilter = endDatum?.__xBrushFilter as
                | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }
                | undefined;

            if (!startFilter || !endFilter || startFilter.col !== endFilter.col || startFilter.valueType !== endFilter.valueType) {
                return;
            }

            onApplyChartFilter(
                [
                    {
                        col: startFilter.col,
                        kind: 'range',
                        from: startFilter.from,
                        to: endFilter.to,
                        valueType: startFilter.valueType,
                        label: `${startFilter.label} -> ${endFilter.label}`,
                    },
                ],
                { append: shiftPressed },
            );
        };

        window.addEventListener('mouseup', commitBrushSelection);
        window.addEventListener('touchend', commitBrushSelection);

        return () => {
            window.removeEventListener('mouseup', commitBrushSelection);
            window.removeEventListener('touchend', commitBrushSelection);
        };
    }, [aggregated.data, onApplyChartFilter, shiftPressed]);

    const handleDatumClick = React.useCallback(
        (datum: Record<string, unknown> | undefined, seriesKey: string, seriesLabel: string, append = false) => {
            if (!datum) {
                return;
            }

            const filters = [];
            const xFilter = datum.__xFilter as
                | { col: string; kind: 'exact'; raw: unknown }
                | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }
                | undefined;

            if (xFilter) {
                filters.push(xFilter);
            }

            if (effectiveGroupKey !== NONE_VALUE && seriesKey !== '__value__' && seriesLabel !== 'Others') {
                filters.push({
                    col: effectiveGroupKey,
                    kind: 'exact' as const,
                    raw: seriesLabel,
                });
            }

            if (filters.length > 0) {
                onApplyChartFilter(filters, { append });
            }
        },
        [effectiveGroupKey, onApplyChartFilter],
    );

    const handleBrushChange = React.useCallback((selection: { startIndex?: number; endIndex?: number } | undefined) => {
        pendingBrushSelectionRef.current = selection ?? null;
    }, []);

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {emptyMessage ? (
                <ChartEmptyState message={emptyMessage} />
            ) : (
                <div className="h-full min-h-[220px] w-full">
                    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full overflow-hidden">
                        {chartType === 'line' ? (
                            <LineChart accessibilityLayer data={aggregated.data} margin={{ left: 8, right: 8, top: 8 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="xLabel"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    minTickGap={24}
                                    tickFormatter={value => String(value).slice(0, 18)}
                                />
                                <YAxis tickLine={false} axisLine={false} width={56} />
                                <ChartTooltip content={<ChartFilterTooltipContent />} />
                                {aggregated.series.map(series => (
                                    <Line
                                        key={series.key}
                                        type="monotone"
                                        dataKey={series.key}
                                        stroke={`var(--color-${series.key})`}
                                        strokeWidth={2}
                                        dot={dotProps => (
                                            <circle
                                                cx={dotProps.cx}
                                                cy={dotProps.cy}
                                                r={3}
                                                fill={`var(--color-${series.key})`}
                                                stroke="transparent"
                                                className="cursor-pointer"
                                                onClick={event => handleDatumClick(dotProps.payload as Record<string, unknown>, series.key, series.label, event.shiftKey)}
                                            />
                                        )}
                                    />
                                ))}
                                <Brush dataKey="xLabel" height={18} travellerWidth={8} onChange={handleBrushChange} />
                            </LineChart>
                        ) : (
                            <BarChart accessibilityLayer data={aggregated.data} margin={{ left: 8, right: 8, top: 8 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="xLabel"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    minTickGap={24}
                                    tickFormatter={value => String(value).slice(0, 18)}
                                />
                                <YAxis tickLine={false} axisLine={false} width={56} />
                                <ChartTooltip cursor={false} content={<ChartFilterTooltipContent />} />
                                {aggregated.series.map(series => (
                                    <Bar
                                        key={series.key}
                                        dataKey={series.key}
                                        fill={`var(--color-${series.key})`}
                                        radius={4}
                                        stackId={effectiveGroupKey === NONE_VALUE ? undefined : 'group'}
                                        className="cursor-pointer"
                                        onClick={(data, _index, event) =>
                                            handleDatumClick(
                                                data?.payload as Record<string, unknown>,
                                                series.key,
                                                series.label,
                                                Boolean((event as React.MouseEvent<SVGPathElement> | undefined)?.shiftKey),
                                            )
                                        }
                                    />
                                ))}
                                <Brush dataKey="xLabel" height={18} travellerWidth={8} onChange={handleBrushChange} />
                            </BarChart>
                        )}
                    </ChartContainer>
                </div>
            )}
        </div>
    );
}

function ChartFilterTooltipContent(props: React.ComponentProps<typeof ChartTooltipContent>) {
    if (!props.active || !props.payload?.length) {
        return null;
    }

    return (
        <ChartTooltipContent
            {...props}
            className="min-w-[9rem]"
            formatter={(value, name, item, index, payload) => {
                const defaultRow = (
                    <>
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color ?? item.payload?.fill ?? 'currentColor',
                                }}
                            />
                            <span className="text-muted-foreground">{name}</span>
                        </div>
                        <span className="text-foreground font-mono font-medium tabular-nums">{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
                    </>
                );

                const isLast = index === (props.payload?.length ?? 1) - 1;
                if (!isLast) {
                    return defaultRow;
                }

                return (
                    <>
                        {defaultRow}
                        <div className="col-span-2 border-t border-border/50 pt-1 text-[11px] text-muted-foreground">Click to filter</div>
                    </>
                );
            }}
        />
    );
}
