'use client';

import { Button } from '@/registry/new-york-v4/ui/button';
import { cn } from '@/registry/new-york-v4/lib/utils';
import { AISparkIcon } from '@/components/@dory/ui/ai-spark-icon';

import { ChartSelect, type ChartState, type MetricOption, NONE_VALUE } from './chart-shared';

export function ChartControlBar(props: {
    chartState: ChartState;
    chartStateIsAuto: boolean;
    columnNames: string[];
    metricOptions: MetricOption[];
    effectiveXKey: string;
    onChartTypeChange: (value: string) => void;
    onXKeyChange: (value: string) => void;
    onYKeyChange: (value: string) => void;
    onGroupKeyChange: (value: string) => void;
    onResetAuto: () => void;
}) {
    const { chartState, chartStateIsAuto, columnNames, metricOptions, effectiveXKey, onChartTypeChange, onXKeyChange, onYKeyChange, onGroupKeyChange, onResetAuto } = props;

    return (
        <div className="flex items-center justify-between px-3 pb-1.5 pt-2">
            <div className="flex flex-wrap items-center gap-4">
                <ChartSelect
                    label="Chart"
                    value={chartState.chartType}
                    onValueChange={onChartTypeChange}
                    options={[
                        { value: 'bar', label: 'Bar' },
                        { value: 'line', label: 'Line' },
                    ]}
                />
                <ChartSelect
                    label="X"
                    value={chartState.xKey}
                    onValueChange={onXKeyChange}
                    options={columnNames.map(columnName => ({ value: columnName, label: columnName }))}
                    disabled={columnNames.length === 0}
                />
                <ChartSelect
                    label="Y"
                    value={chartState.yKey}
                    onValueChange={onYKeyChange}
                    options={metricOptions.map(option => ({ value: option.key, label: option.label }))}
                    disabled={metricOptions.length === 0}
                />
                <ChartSelect
                    label="Group"
                    value={chartState.groupKey}
                    onValueChange={onGroupKeyChange}
                    options={[
                        { value: NONE_VALUE, label: 'None' },
                        ...columnNames.filter(columnName => columnName !== effectiveXKey).map(columnName => ({ value: columnName, label: columnName })),
                    ]}
                    disabled={columnNames.length === 0}
                />
            </div>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn('h-7 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground', chartStateIsAuto && 'bg-background/60 text-foreground')}
                onClick={onResetAuto}
            >
                <AISparkIcon className="h-3 w-3" />
                Auto
            </Button>
        </div>
    );
}
