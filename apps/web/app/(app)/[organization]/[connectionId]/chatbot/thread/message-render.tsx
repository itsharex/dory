'use client';

import { ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { BotIcon, ChevronDownIcon, CopyIcon, RefreshCcwIcon } from 'lucide-react';

import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { ChartResultPart, ChartResultCard } from '@/components/@dory/ui/ai/charts-result';
import { SqlResultCard } from '@/components/@dory/ui/ai/sql-result';
import { AssistantFallbackCard } from '@/components/@dory/ui/ai/assistant-fallback';
import { Card, CardContent, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import { DropdownMenuItem } from '@/registry/new-york-v4/ui/dropdown-menu';
import { buildAutoChartFromSql } from '@/components/@dory/ui/ai/utils/auto-charts';
import { useTranslations } from 'next-intl';

import type { CopilotActionExecutor } from '../copilot/action-bridge';
import { SqlResultPart } from '@/components/@dory/ui/ai/sql-result/type';
import { ChatMode } from '../core/types';

type MessageRendererProps = {
    message: UIMessage;
    messageIndex: number;
    messages: UIMessage[];
    status: string;

    onCopySql: (sql: string) => Promise<void> | void;
    onManualExecute: (payload: { sql: string; database: string | null }) => void;

    mode?: ChatMode;
    onExecuteAction?: CopilotActionExecutor;
};

export function getSqlResultFromPart(part: any, fallbackMessage?: string): SqlResultPart | null {
    if (!part || typeof part !== 'object') return null;

    const candidate = (() => {
        if (part?.type === 'tool-result' && part.result) return part.result;
        if (part?.type === 'tool_result' && part.result) return part.result;
        if (part?.type === 'data' && part.data) return part.data;
        if (part?.type === 'tool-call-output' && part.output) return part.output;
        if (part?.type === 'tool-sqlRunner' && part.output) return part.output;
        if (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output) return part.output;
        return null;
    })();

    if (!candidate || typeof candidate !== 'object') return null;
    if (candidate.type !== 'sql-result') return null;

    return {
        type: 'sql-result',
        ok: Boolean(candidate.ok),
        sql: String(candidate.sql ?? ''),
        database: candidate.database ?? null,
        manualExecution:
            candidate.ok === false && candidate.manualExecution?.required
                ? {
                      required: true,
                      reason: 'non-readonly-query' as const,
                  }
                : undefined,
        previewRows: Array.isArray(candidate.previewRows) ? candidate.previewRows : [],
        columns: Array.isArray(candidate.columns)
            ? candidate.columns.map((col: any) => ({
                  name: String(col?.name ?? ''),
                  type: col?.type != null ? String(col.type) : null,
              }))
            : [],
        rowCount: typeof candidate.rowCount === 'number' ? candidate.rowCount : undefined,
        truncated: Boolean(candidate.truncated),
        durationMs: typeof candidate.durationMs === 'number' ? candidate.durationMs : undefined,
        error:
            candidate.ok === false && candidate.error
                ? {
                      message: String(candidate.error?.message ?? fallbackMessage ?? 'SQL execution failed'),
                  }
                : undefined,
        timestamp: typeof candidate.timestamp === 'string' ? candidate.timestamp : undefined,
    };
}

export function getChartResultFromPart(part: any): ChartResultPart | null {
    if (!part || typeof part !== 'object') return null;

    const candidate = (() => {
        if (part?.type === 'tool-result' && part.result) return part.result;
        if (part?.type === 'tool_result' && part.result) return part.result;
        if (part?.type === 'data' && part.data) return part.data;
        if (part?.type === 'tool-call-output' && part.output) return part.output;
        if (part?.type === 'tool-chartBuilder' && part.output) return part.output;
        if (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output) return part.output;
        return null;
    })();

    if (!candidate || typeof candidate !== 'object') return null;
    if (candidate.type !== 'chart') return null;

    return {
        type: 'chart',
        chartType: candidate.chartType,
        title: candidate.title ?? undefined,
        description: candidate.description ?? undefined,
        data: Array.isArray(candidate.data) ? (candidate.data as Array<Record<string, unknown>>) : [],
        xKey: candidate.xKey ?? undefined,
        yKeys: Array.isArray(candidate.yKeys)
            ? (candidate.yKeys as any[])
                  .filter(item => item && typeof item === 'object' && typeof item.key === 'string')
                  .map(item => ({
                      key: item.key,
                      label: item.label ?? undefined,
                      color: item.color ?? undefined,
                  }))
            : undefined,
        categoryKey: candidate.categoryKey ?? undefined,
        valueKey: candidate.valueKey ?? undefined,
        options: candidate.options ?? undefined,
    };
}

function didUserRequestChart(messages: UIMessage[], messageIndex: number): boolean {
    const previousUserMessage =
        messages
            .slice(0, messageIndex)
            .reverse()
            .find(msg => msg.role === 'user') ?? null;

    return !!previousUserMessage?.parts?.some((part: any) => part?.type === 'text' && /visualization|chart/i.test(part?.text ?? ''));
}

function formatToolName(toolName: string | null | undefined, fallback = 'Tool'): string {
    if (!toolName) return fallback;

    const normalized = toolName
        .replace(/^tool[-_]/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .trim();

    if (!normalized) return fallback;

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function summarizeSqlStep(sql: string): string {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (!normalized) return 'Run SQL';
    if (normalized.includes('from sqlite_master')) return 'List tables';
    if (normalized.includes('count(*)')) return 'Count rows';
    if (normalized.startsWith('select')) return 'Query data';
    if (normalized.startsWith('insert')) return 'Insert data';
    if (normalized.startsWith('update')) return 'Update data';
    if (normalized.startsWith('delete')) return 'Delete data';
    if (normalized.startsWith('create')) return 'Create object';
    if (normalized.startsWith('drop')) return 'Drop object';
    return 'Run SQL';
}

function containsChinese(text: string): boolean {
    return /[\u4E00-\u9FFF]/u.test(text);
}

function getMessageLocale(messages: UIMessage[], currentMessage: UIMessage): 'zh' | 'en' {
    const sampleText = [...messages, currentMessage]
        .flatMap(message =>
            Array.isArray(message.parts)
                ? message.parts.filter((part: any) => (part?.type === 'text' || part?.type === 'reasoning') && typeof part.text === 'string').map((part: any) => part.text)
                : [],
        )
        .join(' ');

    return containsChinese(sampleText) ? 'zh' : 'en';
}

function localizeStepLabel(step: string, locale: 'zh' | 'en'): string {
    if (locale === 'en') return step;

    const map: Record<string, string> = {
        'Run SQL': '执行 SQL',
        'List tables': '读取数据表',
        'Count rows': '统计行数',
        'Query data': '查询数据',
        'Insert data': '插入数据',
        'Update data': '更新数据',
        'Delete data': '删除数据',
        'Create object': '创建对象',
        'Drop object': '删除对象',
        'Build chart': '生成图表',
        'Run tool': '执行工具',
    };

    if (step.startsWith('Build ') && step.endsWith(' chart')) {
        const chartType = step.slice('Build '.length, -' chart'.length);
        return `生成 ${chartType} 图表`;
    }

    return map[step] ?? step;
}

function buildAgentSummary(stepSummaries: string[], locale: 'zh' | 'en'): string {
    const uniqueSteps = Array.from(new Set(stepSummaries.filter(Boolean))).slice(0, 3);

    if (locale === 'zh') {
        if (uniqueSteps.length === 0) return '已完成执行';
        return `已完成 ${stepSummaries.length} 步：${uniqueSteps.join('、')}`;
    }

    if (uniqueSteps.length === 0) return 'Execution completed';
    return `${stepSummaries.length} steps: ${uniqueSteps.join(', ')}`;
}

const MessageRenderer = ({ message, messageIndex, messages, status, onCopySql, onManualExecute, mode = 'global', onExecuteAction }: MessageRendererProps) => {
    const t = useTranslations('Chatbot');
    const processItems: Array<{ summary: string; content: ReactNode }> = [];
    const contentItems: ReactNode[] = [];
    const sqlResults: SqlResultPart[] = [];
    const chartResults: ChartResultPart[] = [];

    const assistantMessage = message.role === 'assistant';
    const isLatestAssistant = assistantMessage && messageIndex === messages.length - 1;
    const isStreaming = status !== 'ready';
    const locale = getMessageLocale(messages, message);

    const userRequestedChart = didUserRequestChart(messages, messageIndex);

    const showCopilotSqlActions = mode === 'copilot' && typeof onExecuteAction === 'function';
    const getToolCallId = (part: any) => {
        if (!part || typeof part !== 'object') return null;
        if (typeof part.callId === 'string') return part.callId;
        if (typeof part.toolCallId === 'string') return part.toolCallId;
        return null;
    };
    const isToolCallPart = (part: any) => {
        if (!part || typeof part !== 'object') return false;
        if (part.type === 'tool_call' || part.type === 'tool-call') return true;
        if (typeof part.type === 'string' && part.type.startsWith('tool-') && part.state === 'input-available') {
            return true;
        }
        return false;
    };
    const toolCallFirstIndex = new Map<string, number>();
    messages.forEach((msg, index) => {
        (msg.parts ?? []).forEach((part: any) => {
            const id = getToolCallId(part);
            if (id && isToolCallPart(part) && !toolCallFirstIndex.has(id)) {
                toolCallFirstIndex.set(id, index);
            }
        });
    });
    const shouldRenderToolCall = (part: any) => {
        const id = getToolCallId(part);
        if (!id) return true;
        return toolCallFirstIndex.get(id) === messageIndex;
    };
    const getToolResultId = (part: any) => {
        if (!part || typeof part !== 'object') return null;
        if (typeof part.callId === 'string') return part.callId;
        if (typeof part.toolCallId === 'string') return part.toolCallId;
        return null;
    };
    const toolResultFirstIndex = new Map<string, number>();
    messages.forEach((msg, index) => {
        (msg.parts ?? []).forEach((part: any) => {
            if (part?.type === 'tool_result' || part?.type === 'tool-result' || (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output)) {
                const id = getToolResultId(part);
                if (id && !toolResultFirstIndex.has(id)) {
                    toolResultFirstIndex.set(id, index);
                }
            }
        });
    });
    const shouldRenderToolResult = (part: any) => {
        const id = getToolResultId(part);
        if (!id) return true;
        return toolResultFirstIndex.get(id) === messageIndex;
    };
    const inferToolArgsFromResult = (part: any) => {
        const result = part?.result ?? part?.output ?? part?.data;
        if (result?.type === 'sql-result' && typeof result.sql === 'string') {
            return { sql: result.sql };
        }
        if (result?.type === 'chart') {
            const rawData = Array.isArray(result.data) ? result.data : [];
            const maxPreview = 20;
            const dataPreview = rawData.slice(0, maxPreview);
            return {
                chartType: result.chartType,
                xKey: result.xKey,
                yKeys: result.yKeys,
                categoryKey: result.categoryKey,
                valueKey: result.valueKey,
                data: rawData.length <= maxPreview ? rawData : dataPreview,
                dataCount: rawData.length,
            };
        }
        return { toolCallId: getToolResultId(part) };
    };
    const toolCallStateById = new Map<
        string,
        {
            hasFinalState: boolean;
        }
    >();
    messages.forEach(msg => {
        (msg.parts ?? []).forEach((part: any) => {
            const id = getToolCallId(part) ?? getToolResultId(part);
            if (!id) return;

            const current = toolCallStateById.get(id) ?? {
                hasFinalState: false,
            };

            const hasOutput =
                part?.type === 'tool-result' ||
                part?.type === 'tool_result' ||
                part?.type === 'tool-error' ||
                (typeof part?.type === 'string' && part.type.startsWith('tool-') && (part.output || part.state?.startsWith?.('output')));

            if (hasOutput) {
                current.hasFinalState = true;
            }

            toolCallStateById.set(id, current);
        });
    });

    const getToolName = (part: any) => {
        if (typeof part?.toolName === 'string') return part.toolName;
        if (typeof part?.type === 'string' && part.type.startsWith('tool-')) {
            return part.type.replace(/^tool-/, '');
        }

        const result = part?.result ?? part?.output ?? part?.data;
        if (result?.type === 'sql-result') return 'sqlRunner';
        if (result?.type === 'chart') return 'chartBuilder';
        return null;
    };

    const getToolStepSummary = (part: any) => {
        const toolName = getToolName(part);
        const input = part?.input ?? part?.result ?? part?.output ?? part?.data;

        if (toolName === 'sqlRunner') {
            const sql = typeof part?.input?.sql === 'string' ? part.input.sql : typeof input?.sql === 'string' ? input.sql : '';
            return localizeStepLabel(summarizeSqlStep(sql), locale);
        }

        if (toolName === 'chartBuilder') {
            const chartType = typeof part?.input?.chartType === 'string' ? part.input.chartType : typeof input?.chartType === 'string' ? input.chartType : null;
            return localizeStepLabel(chartType ? `Build ${chartType} chart` : 'Build chart', locale);
        }

        return localizeStepLabel(formatToolName(toolName, 'Run tool'), locale);
    };

    const renderToolStateCard = ({ part, key, fallbackInput, resultContent }: { part: any; key: string; fallbackInput?: unknown; resultContent?: ReactNode }) => {
        const toolName = getToolName(part);
        const title = formatToolName(toolName);
        const state =
            part?.type === 'tool-error' || part?.state === 'output-error'
                ? 'output-error'
                : part?.type === 'tool-result' || part?.type === 'tool_result' || (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output)
                  ? 'output-available'
                  : 'input-available';
        const input = part?.input ?? fallbackInput;
        const output = part?.result ?? part?.output ?? part?.data ?? null;
        const errorText = part?.errorText ?? part?.error?.message ?? (part?.type === 'tool-error' && typeof part?.message === 'string' ? part.message : undefined);
        const defaultOpen = state !== 'output-available';

        return (
            <Tool key={key} defaultOpen={defaultOpen}>
                <ToolHeader type="dynamic-tool" state={state} toolName={title} title={title} />
                <ToolContent>
                    {input !== undefined ? <ToolInput input={input} /> : null}
                    {resultContent ?? (state !== 'input-available' ? <ToolOutput output={output} errorText={errorText} /> : null)}
                </ToolContent>
            </Tool>
        );
    };

    if (assistantMessage && message.parts?.some((part: any) => part.type === 'source-url')) {
        const sourceParts = message.parts.filter((part: any) => part.type === 'source-url');
        contentItems.push(
            <Sources key={`${message.id}-sources`}>
                <SourcesTrigger count={sourceParts.length} />
                {sourceParts.map((part: any, i: number) => (
                    <SourcesContent key={`${message.id}-source-${i}`}>
                        <Source href={part.url} title={part.url} />
                    </SourcesContent>
                ))}
            </Sources>,
        );
    }

    message.parts?.forEach((part: any, i: number) => {
        // tool-call
        if (part.type === 'tool-call' || part.type === 'tool_call') {
            const id = getToolCallId(part);
            const toolState = id ? toolCallStateById.get(id) : null;
            if (toolState?.hasFinalState) {
                return;
            }
            if (!shouldRenderToolCall(part)) {
                return;
            }
            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({ part, key: `${message.id}-tool-call-${i}` }),
            });
            return;
        }

        if (typeof part.type === 'string' && part.type.startsWith('tool-') && part.input && part.state === 'input-available') {
            const id = getToolCallId(part);
            const toolState = id ? toolCallStateById.get(id) : null;
            if (toolState?.hasFinalState) {
                return;
            }
            if (!shouldRenderToolCall(part)) {
                return;
            }
            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({ part, key: `${message.id}-dynamic-tool-call-${i}` }),
            });
            return;
        }

        // tool-error
        if (part.type === 'tool-error') {
            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({ part, key: `${message.id}-tool-error-${i}` }),
            });
            return;
        }

        if (!shouldRenderToolResult(part)) {
            return;
        }

        const chartResult = getChartResultFromPart(part);
        if (chartResult) {
            chartResults.push(chartResult);

            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({
                    part,
                    key: `${message.id}-tool-chart-${i}`,
                    fallbackInput: inferToolArgsFromResult(part),
                    resultContent: (
                        <div className="p-4 pt-0">
                            <ChartResultCard key={`${message.id}-chart-${i}`} result={chartResult} source="tool" />
                        </div>
                    ),
                }),
            });
            return;
        }

        const sqlResult = getSqlResultFromPart(part, t('Errors.SqlExecutionFailed'));
        if (sqlResult) {
            sqlResults.push(sqlResult);

            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({
                    part,
                    key: `${message.id}-tool-sql-${i}`,
                    fallbackInput: inferToolArgsFromResult(part),
                    resultContent: (
                        <div className="p-4 pt-0">
                            <SqlResultCard
                                key={`${message.id}-sql-${i}`}
                                result={sqlResult}
                                onCopy={onCopySql}
                                onManualExecute={onManualExecute}
                                mode={mode}
                                manualPrimaryAction={
                                    showCopilotSqlActions && sqlResult.manualExecution?.required && sqlResult.sql?.trim() ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 rounded-full px-4 text-sm font-medium"
                                            onClick={() => onExecuteAction?.({ type: 'sql.replace', sql: sqlResult.sql })}
                                        >
                                            {t('Tools.ReplaceSql')}
                                        </Button>
                                    ) : undefined
                                }
                                manualMenuActions={
                                    showCopilotSqlActions && sqlResult.manualExecution?.required && sqlResult.sql?.trim() ? (
                                        <DropdownMenuItem onClick={() => onExecuteAction?.({ type: 'sql.newTab', sql: sqlResult.sql })}>{t('Tools.NewTab')}</DropdownMenuItem>
                                    ) : undefined
                                }
                                footerActions={
                                    showCopilotSqlActions && !sqlResult.manualExecution?.required && sqlResult.sql?.trim() ? (
                                        <>
                                            <Button
                                                size="sm"
                                                className="h-9 rounded-full px-4 text-sm font-medium"
                                                onClick={() => onExecuteAction?.({ type: 'sql.replace', sql: sqlResult.sql })}
                                            >
                                                {t('Tools.ReplaceSql')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-9 rounded-full border-0 px-4 text-sm font-medium"
                                                onClick={() => onExecuteAction?.({ type: 'sql.newTab', sql: sqlResult.sql })}
                                            >
                                                {t('Tools.NewTab')}
                                            </Button>
                                        </>
                                    ) : null
                                }
                            />
                        </div>
                    ),
                }),
            });
            return;
        }

        const toolName = getToolName(part);
        if (toolName) {
            processItems.push({
                summary: getToolStepSummary(part),
                content: renderToolStateCard({
                    part,
                    key: `${message.id}-tool-result-${i}`,
                    fallbackInput: inferToolArgsFromResult(part),
                }),
            });
        }

        if (part.type === 'text') {
            contentItems.push(<MessageResponse key={`${message.id}-text-${i}`}>{part.text}</MessageResponse>);
            return;
        }

        // reasoning
        if (part.type === 'reasoning') {
            contentItems.push(
                <Reasoning
                    key={`${message.id}-reasoning-${i}`}
                    className="w-full"
                    isStreaming={status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id}
                >
                    <ReasoningTrigger />
                    <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>,
            );
            return;
        }
    });

    if (userRequestedChart && chartResults.length === 0 && sqlResults.length > 0) {
        const autoChart = buildAutoChartFromSql(sqlResults[0]);
        if (autoChart) {
            contentItems.push(<ChartResultCard key={`${message.id}-auto-chart`} result={autoChart} source="auto" />);
        }
    }

    if (processItems.length > 0) {
        const hasProcessError = message.parts?.some((part: any) => part?.type === 'tool-error' || part?.state === 'output-error');
        const toolCallIds = Array.from(
            new Set((message.parts ?? []).map((part: any) => getToolCallId(part) ?? getToolResultId(part)).filter((id: any): id is string => typeof id === 'string')),
        );
        const hasRunningProcess =
            !hasProcessError &&
            toolCallIds.some(id => {
                const toolState = toolCallStateById.get(id);
                return toolState ? !toolState.hasFinalState : false;
            });
        const processStatus =
            locale === 'zh' ? (hasProcessError ? '失败' : hasRunningProcess ? '执行中' : '已完成') : hasProcessError ? 'Error' : hasRunningProcess ? 'Running' : 'Completed';
        const processBadgeVariant = hasProcessError ? 'destructive' : 'secondary';
        const processSummary = buildAgentSummary(
            processItems.map(item => item.summary),
            locale,
        );

        contentItems.unshift(
            <Collapsible
                key={`${message.id}-agent-process`}
                defaultOpen={hasProcessError || hasRunningProcess || processItems.length <= 1}
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
            >
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <BotIcon className="size-4" />
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-sm">Agent</span>
                                <Badge
                                    variant={processBadgeVariant}
                                    className={processBadgeVariant === 'secondary' ? 'rounded-full border-0 bg-muted px-2.5 text-muted-foreground' : 'rounded-full px-2.5'}
                                >
                                    {processStatus}
                                </Badge>
                            </div>
                            <p className="truncate text-muted-foreground text-xs">{processSummary}</p>
                        </div>
                    </div>
                    <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border/70 bg-muted/20 px-4 py-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2">
                    <div className="space-y-3">
                        {processItems.map((item, index) => (
                            <div key={`${message.id}-process-step-${index}`} className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                    <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]">
                                        {locale === 'zh' ? `步骤 ${index + 1}` : `Step ${index + 1}`}
                                    </span>
                                    <span className="text-foreground text-sm">{item.summary}</span>
                                </div>
                                {item.content}
                            </div>
                        ))}
                    </div>
                </CollapsibleContent>
            </Collapsible>,
        );
    }

    const hasToolParts = !!message.parts?.some((part: any) => {
        if (!part || typeof part !== 'object') return false;
        if (part.type === 'tool-call' || part.type === 'tool_call') return false;
        if (part.type === 'tool-error') return true;
        if (part.type === 'tool-result' || part.type === 'tool_result') return true;
        return typeof part.type === 'string' && part.type.startsWith('tool-');
    });

    if (assistantMessage && contentItems.length === 0 && (!isLatestAssistant || !isStreaming) && !hasToolParts) {
        contentItems.push(<AssistantFallbackCard key={`${message.id}-fallback`} />);
    }

    if (contentItems.length === 0) {
        return null;
    }

    const showActions = assistantMessage && message.parts?.some((p: any) => p.type === 'text');
    const isAssistant = message.role === 'assistant';

    return (
        <div key={message.id} className="space-y-2 w-full">
            <Message from={message.role} className={isAssistant ? 'w-full' : undefined}>
                <MessageContent className={isAssistant ? 'w-full max-w-none bg-transparent' : 'w-full'}>{contentItems}</MessageContent>
            </Message>

            {/* {showActions && (
                <ResponseActions>
                    <Action
                        label={t('Actions.Copy')}
                        onClick={() => {
                            
                            const lastTextPart: any = (message.parts ?? []).filter((p: any) => p?.type === 'text' && p.text)?.at(-1);
                            const text = lastTextPart?.text?.toString?.() ?? '';
                            if (text) navigator.clipboard.writeText(text);
                        }}
                    >
                        <CopyIcon className="size-3" />
                    </Action>

                    <Action label={t('Actions.Retry')}>
                        <RefreshCcwIcon className="size-3" />
                    </Action>
                </Actions>
            )} */}
        </div>
    );
};

export default MessageRenderer;
