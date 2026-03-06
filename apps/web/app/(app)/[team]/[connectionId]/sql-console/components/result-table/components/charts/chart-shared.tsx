'use client';

import { BarChart3 } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';

export type ChartType = 'bar' | 'line';
export type MetricKind = 'count' | 'sum';
export type ChartRow = { rowData: Record<string, unknown> };

export type MetricOption = {
    key: string;
    label: string;
    kind: MetricKind;
    column?: string;
};

export type ChartSeries = {
    key: string;
    label: string;
};

export type AggregatedChartData = {
    data: Array<Record<string, number | string>>;
    series: ChartSeries[];
};

export type ChartState = {
    chartType: ChartType;
    xKey: string;
    yKey: string;
    groupKey: string;
};

export const NONE_VALUE = '__none__';
export const ALL_SERIES_KEY = '__value__';
export const CHART_COLORS = [
    'var(--primary)',
    'color-mix(in oklab, var(--primary) 84%, var(--background))',
    'color-mix(in oklab, var(--primary) 68%, var(--background))',
    'color-mix(in oklab, var(--primary) 52%, var(--background))',
    'color-mix(in oklab, var(--primary) 36%, var(--background))',
    'color-mix(in oklab, var(--primary) 20%, var(--background))',
];

export function ChartSelect(props: { label: string; value: string; onValueChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) {
    const { label, value, onValueChange, options, disabled = false } = props;

    return (
        <div className="flex items-center gap-1">
            <span className="mr-1 text-[11px] font-medium text-muted-foreground/80">{label}</span>
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger
                    size="sm"
                    className="h-7 min-w-[104px] justify-between border bg-background/50 px-2 text-[11px] text-muted-foreground shadow-none hover:bg-background/70"
                >
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

export function ChartEmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <BarChart3 className="h-5 w-5" />
            <div>{message}</div>
        </div>
    );
}
