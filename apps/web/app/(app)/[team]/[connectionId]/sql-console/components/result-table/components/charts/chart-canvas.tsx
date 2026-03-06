'use client';

import React from 'react';
import { Bar, BarChart, Brush, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { Button } from '@/registry/new-york-v4/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/registry/new-york-v4/ui/chart';

import { AggregatedChartData, ChartEmptyState, ChartType, NONE_VALUE } from './chart-shared';

export function ChartCanvas(props: {
    chartType: ChartType;
    chartConfig: ChartConfig;
    aggregated: AggregatedChartData;
    effectiveGroupKey: string;
    emptyMessage: string | null;
    timelineSliderEnabled: boolean;
    onApplyChartFilter: (
        filters: Array<{ col: string; kind: 'exact'; raw: unknown } | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }>,
        mode?: { append?: boolean },
    ) => void;
}) {
    const { chartType, chartConfig, aggregated, effectiveGroupKey, emptyMessage, timelineSliderEnabled, onApplyChartFilter } = props;
    const clickFilterEnabled = chartType !== 'line';
    const [brushSelection, setBrushSelection] = React.useState<{ startIndex: number; endIndex: number } | null>(null);
    const lastBrushIndex = Math.max(aggregated.data.length - 1, 0);
    const controlledBrushSelection = brushSelection ?? { startIndex: 0, endIndex: lastBrushIndex };
    const isZoomed = brushSelection != null;

    React.useEffect(() => {
        if (!timelineSliderEnabled) {
            setBrushSelection(null);
        }
    }, [timelineSliderEnabled]);

    React.useEffect(() => {
        if (!brushSelection) {
            return;
        }
        const lastIndex = aggregated.data.length - 1;
        if (lastIndex <= 0) {
            setBrushSelection(null);
            return;
        }
        if (brushSelection.startIndex > lastIndex || brushSelection.endIndex > lastIndex) {
            setBrushSelection({
                startIndex: Math.min(brushSelection.startIndex, lastIndex),
                endIndex: Math.min(brushSelection.endIndex, lastIndex),
            });
        }
    }, [aggregated.data.length, brushSelection]);

    const handleDatumClick = React.useCallback(
        (datum: Record<string, unknown> | undefined, seriesKey: string, seriesLabel: string, append = false) => {
            if (!clickFilterEnabled) {
                return;
            }

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
        [clickFilterEnabled, effectiveGroupKey, onApplyChartFilter],
    );

    const handleBrushChange = React.useCallback((selection: { startIndex?: number; endIndex?: number } | undefined) => {
        const startIndex = selection?.startIndex;
        const endIndex = selection?.endIndex;
        if (startIndex == null || endIndex == null || endIndex <= startIndex) {
            setBrushSelection(null);
            return;
        }
        if (startIndex <= 0 && endIndex >= lastBrushIndex) {
            setBrushSelection(null);
            return;
        }
        setBrushSelection({ startIndex, endIndex });
    }, [lastBrushIndex]);

    const brushFilter = React.useMemo(() => {
        if (!brushSelection) {
            return null;
        }

        const startDatum = aggregated.data[brushSelection.startIndex] as Record<string, unknown> | undefined;
        const endDatum = aggregated.data[brushSelection.endIndex] as Record<string, unknown> | undefined;
        const startFilter = startDatum?.__xBrushFilter as
            | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }
            | undefined;
        const endFilter = endDatum?.__xBrushFilter as
            | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }
            | undefined;

        if (!startFilter || !endFilter || startFilter.col !== endFilter.col || startFilter.valueType !== endFilter.valueType) {
            return null;
        }

        return {
            col: startFilter.col,
            kind: 'range' as const,
            from: startFilter.from,
            to: endFilter.to,
            valueType: startFilter.valueType,
            label: `${startFilter.label} -> ${endFilter.label}`,
        };
    }, [aggregated.data, brushSelection]);

    return (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {emptyMessage ? (
                <ChartEmptyState message={emptyMessage} />
            ) : (
                <div className="flex h-full min-h-[220px] w-full flex-col">
                    {timelineSliderEnabled ? (
                        <div className="flex items-center justify-between gap-2 pb-1">
                            <span className="text-[11px] text-muted-foreground">DataZoom timeline</span>
                            <div className="flex gap-2">
                                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setBrushSelection(null)} disabled={!isZoomed}>
                                    Reset Zoom
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => {
                                        if (!brushFilter) {
                                            return;
                                        }
                                        onApplyChartFilter([brushFilter]);
                                    }}
                                    disabled={!brushFilter}
                                >
                                    Apply Brush Filter
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    {clickFilterEnabled ? <div className="pb-1 text-right text-[11px] text-muted-foreground">Click bar to filter</div> : null}
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
                                <ChartTooltip content={<ChartFilterTooltipContent filterEnabled={clickFilterEnabled} chartConfig={chartConfig} />} />
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
                                                className={clickFilterEnabled ? 'cursor-pointer' : undefined}
                                                onClick={
                                                    clickFilterEnabled
                                                        ? event =>
                                                              handleDatumClick(
                                                                  dotProps.payload as Record<string, unknown>,
                                                                  series.key,
                                                                  series.label,
                                                                  event.shiftKey,
                                                              )
                                                        : undefined
                                                }
                                            />
                                        )}
                                    />
                                ))}
                                {timelineSliderEnabled ? (
                                    <Brush
                                        dataKey="xLabel"
                                        height={18}
                                        travellerWidth={8}
                                        onChange={handleBrushChange}
                                        startIndex={controlledBrushSelection.startIndex}
                                        endIndex={controlledBrushSelection.endIndex}
                                    />
                                ) : null}
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
                                <ChartTooltip cursor={false} content={<ChartFilterTooltipContent filterEnabled={clickFilterEnabled} chartConfig={chartConfig} />} />
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
                                {timelineSliderEnabled ? (
                                    <Brush
                                        dataKey="xLabel"
                                        height={18}
                                        travellerWidth={8}
                                        onChange={handleBrushChange}
                                        startIndex={controlledBrushSelection.startIndex}
                                        endIndex={controlledBrushSelection.endIndex}
                                    />
                                ) : null}
                            </BarChart>
                        )}
                    </ChartContainer>
                </div>
            )}
        </div>
    );
}

function ChartFilterTooltipContent(props: React.ComponentProps<typeof ChartTooltipContent> & { filterEnabled?: boolean; chartConfig: ChartConfig }) {
    const { filterEnabled, chartConfig } = props;
    if (!props.active || !props.payload?.length) {
        return null;
    }

    return (
        <ChartTooltipContent
            {...props}
            className="min-w-[9rem]"
            formatter={(value, name, item, index, payload) => {
                const dataKey = String((item as { dataKey?: string | number } | undefined)?.dataKey ?? name);
                const seriesLabel = chartConfig[dataKey]?.label ?? name;
                const defaultRow = (
                    <>
                        <div className="flex items-center gap-2">
                            <div
                                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color ?? item.payload?.fill ?? 'currentColor',
                                }}
                            />
                            <span className="text-muted-foreground">{seriesLabel}</span>
                        </div>
                        <span className="text-foreground font-mono font-medium tabular-nums">{typeof value === 'number' ? value.toLocaleString() : String(value)}</span>
                    </>
                );

                const isLast = index === (props.payload?.length ?? 1) - 1;
                if (!isLast || !filterEnabled) {
                    return defaultRow;
                }

                return defaultRow;
            }}
        />
    );
}
