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
    timelineSliderEnabled: boolean;
    onApplyChartFilter: (
        filters: Array<{ col: string; kind: 'exact'; raw: unknown } | { col: string; kind: 'range'; from: string; to: string; valueType: 'number' | 'date'; label: string }>,
        mode?: { append?: boolean },
    ) => void;
    onChartTypeChange: (value: string) => void;
    onXKeyChange: (value: string) => void;
    onYKeyChange: (value: string) => void;
    onGroupKeyChange: (value: string) => void;
    onTimelineSliderEnabledChange: (value: boolean) => void;
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
        timelineSliderEnabled,
        onApplyChartFilter,
        onChartTypeChange,
        onXKeyChange,
        onYKeyChange,
        onGroupKeyChange,
        onTimelineSliderEnabledChange,
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
                bucketHint={aggregated.bucketHint}
                timelineSliderEnabled={timelineSliderEnabled}
                onChartTypeChange={onChartTypeChange}
                onXKeyChange={onXKeyChange}
                onYKeyChange={onYKeyChange}
                onGroupKeyChange={onGroupKeyChange}
                onTimelineSliderEnabledChange={onTimelineSliderEnabledChange}
                onResetAuto={onResetAuto}
            />
            <ChartCanvas
                chartType={chartState.chartType}
                chartConfig={chartConfig}
                aggregated={aggregated}
                effectiveGroupKey={effectiveGroupKey}
                emptyMessage={emptyMessage}
                timelineSliderEnabled={timelineSliderEnabled}
                onApplyChartFilter={onApplyChartFilter}
            />
        </div>
    );
}
