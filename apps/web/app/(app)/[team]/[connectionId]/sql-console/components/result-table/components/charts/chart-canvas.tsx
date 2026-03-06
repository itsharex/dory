'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/registry/new-york-v4/ui/chart';

import { AggregatedChartData, ChartEmptyState, ChartType, NONE_VALUE } from './chart-shared';

export function ChartCanvas(props: {
    chartType: ChartType;
    chartConfig: ChartConfig;
    aggregated: AggregatedChartData;
    effectiveGroupKey: string;
    emptyMessage: string | null;
}) {
    const { chartType, chartConfig, aggregated, effectiveGroupKey, emptyMessage } = props;

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
                                <ChartTooltip content={<ChartTooltipContent />} />
                                {aggregated.series.map(series => (
                                    <Line key={series.key} type="monotone" dataKey={series.key} stroke={`var(--color-${series.key})`} strokeWidth={2} dot={false} />
                                ))}
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
    );
}
