'use client';

import { ChartConfig } from '@/registry/new-york-v4/ui/chart';

import { ChartCanvas } from './chart-canvas';
import { ChartControlBar } from './chart-control-bar';
import { AggregatedChartData, ChartState, MetricOption } from './chart-shared';

export function ChartView(props: {
    chartState: ChartState;
    chartStateIsAuto: boolean;
    columnNames: string[];
    metricOptions: MetricOption[];
    effectiveXKey: string;
    effectiveGroupKey: string;
    aggregated: AggregatedChartData;
    chartConfig: ChartConfig;
    emptyMessage: string | null;
    onChartTypeChange: (value: string) => void;
    onXKeyChange: (value: string) => void;
    onYKeyChange: (value: string) => void;
    onGroupKeyChange: (value: string) => void;
    onResetAuto: () => void;
}) {
    const {
        chartState,
        chartStateIsAuto,
        columnNames,
        metricOptions,
        effectiveXKey,
        effectiveGroupKey,
        aggregated,
        chartConfig,
        emptyMessage,
        onChartTypeChange,
        onXKeyChange,
        onYKeyChange,
        onGroupKeyChange,
        onResetAuto,
    } = props;

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-muted/10">
            <ChartControlBar
                chartState={chartState}
                chartStateIsAuto={chartStateIsAuto}
                columnNames={columnNames}
                metricOptions={metricOptions}
                effectiveXKey={effectiveXKey}
                onChartTypeChange={onChartTypeChange}
                onXKeyChange={onXKeyChange}
                onYKeyChange={onYKeyChange}
                onGroupKeyChange={onGroupKeyChange}
                onResetAuto={onResetAuto}
            />
            <ChartCanvas
                chartType={chartState.chartType}
                chartConfig={chartConfig}
                aggregated={aggregated}
                effectiveGroupKey={effectiveGroupKey}
                emptyMessage={emptyMessage}
            />
        </div>
    );
}
