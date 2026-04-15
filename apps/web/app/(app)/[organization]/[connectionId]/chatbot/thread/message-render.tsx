'use client';

import { ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { AlertTriangleIcon, CheckCircle2Icon, ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon, MoreHorizontalIcon } from 'lucide-react';

import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Source, Sources, SourcesContent, SourcesTrigger } from '@/components/ai-elements/sources';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { ChartResultPart, ChartResultCard } from '@/components/@dory/ui/ai/charts-result';
import { SqlResultBody, SqlStatementBlock } from '@/components/@dory/ui/ai/sql-result';
import { AssistantFallbackCard } from '@/components/@dory/ui/ai/assistant-fallback';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/registry/new-york-v4/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/registry/new-york-v4/ui/dropdown-menu';
import { buildAutoChartFromSql } from '@/components/@dory/ui/ai/utils/auto-charts';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

import type { CopilotActionExecutor } from '../copilot/action-bridge';
import { SqlResultPart, SqlResultManualExecutionMode } from '@/components/@dory/ui/ai/sql-result/type';
import { ChatMode } from '../core/types';

type MessageRendererProps = {
    message: UIMessage;
    messageIndex: number;
    messages: UIMessage[];
    status: string;

    onCopySql: (sql: string) => Promise<void> | void;
    onManualExecute: (payload: { sql: string; database: string | null; mode?: SqlResultManualExecutionMode }) => void;

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

    if (toolName === 'sqlRunner') return 'SQL Runner';
    if (toolName === 'chartBuilder') return 'Chart Builder';

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
    if (normalized.includes('pragma table_info') || normalized.includes('information_schema.columns') || normalized.startsWith('describe ')) return 'Inspect schema';
    if (normalized.includes('from sqlite_master')) return 'List tables';
    if (normalized.includes('datetime(') && normalized.includes('timestamp')) return 'Validate timestamp parsing';
    if ((normalized.includes('max(timestamp)') || normalized.includes('min(timestamp)')) && normalized.includes('from')) return 'Check time range';
    if (normalized.includes('order by timestamp desc')) return 'Review recent rows';
    if (/where\s+.*level\s*=\s*['"]?error['"]?/i.test(normalized)) return 'Filter error logs';
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
        'Inspect schema': '检查表结构',
        'List tables': '读取数据表',
        'Validate timestamp parsing': '验证时间字段解析',
        'Check time range': '检查时间范围',
        'Review recent rows': '查看最近记录',
        'Filter error logs': '筛选错误日志',
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

function getProcessNotesLabel(locale: 'zh' | 'en'): string {
    return locale === 'zh' ? '过程说明' : 'Notes';
}

type ProcessVisualStatus = 'running' | 'completed' | 'error';

function getProcessVisualStatus(part: any): ProcessVisualStatus {
    if (part?.type === 'tool-error' || part?.state === 'output-error') {
        return 'error';
    }

    if (part?.type === 'tool-result' || part?.type === 'tool_result' || (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output)) {
        return 'completed';
    }

    return 'running';
}

function getProcessStatusCopy(status: ProcessVisualStatus, locale: 'zh' | 'en') {
    if (status === 'error') {
        return {
            label: locale === 'zh' ? '失败' : 'Error',
            icon: <AlertTriangleIcon className="size-3.5" />,
            badgeClassName: 'border-destructive/20 bg-destructive/[0.04] text-destructive',
            dotClassName: 'bg-destructive',
        };
    }

    if (status === 'running') {
        return {
            label: locale === 'zh' ? '执行中' : 'Running',
            icon: <LoaderCircleIcon className="size-3.5 animate-spin" />,
            badgeClassName: 'border-border bg-muted/40 text-muted-foreground',
            dotClassName: 'bg-primary',
        };
    }

    return {
        label: locale === 'zh' ? '已完成' : 'Completed',
        icon: <CheckCircle2Icon className="size-3.5" />,
        badgeClassName: 'border-border bg-muted/30 text-muted-foreground',
        dotClassName: 'bg-emerald-500',
    };
}

const MessageRenderer = ({ message, messageIndex, messages, status, onCopySql, onManualExecute, mode = 'global', onExecuteAction }: MessageRendererProps) => {
    const t = useTranslations('Chatbot');
    const doryUiT = useTranslations('DoryUI');
    const processItems: Array<{ key: string; summary: string; content: ReactNode; status: ProcessVisualStatus; actions?: ReactNode; defaultOpen?: boolean }> = [];
    const leadingContentItems: ReactNode[] = [];
    const narrativeContentItems: ReactNode[] = [];
    const deferredToolItems: ReactNode[] = [];
    const foldedNarrativeParts: ReactNode[] = [];
    const sqlResults: SqlResultPart[] = [];
    const chartResults: ChartResultPart[] = [];

    const assistantMessage = message.role === 'assistant';
    const isLatestAssistant = assistantMessage && messageIndex === messages.length - 1;
    const isStreaming = status !== 'ready';
    const locale = getMessageLocale(messages, message);
    const textPartIndexes = (message.parts ?? [])
        .map((part: any, index: number) => (part?.type === 'text' && typeof part.text === 'string' && part.text.trim() ? index : -1))
        .filter((index: number) => index >= 0);
    const finalTextPartIndex = textPartIndexes.at(-1) ?? -1;
    const hasMultipleTextParts = textPartIndexes.length > 1;

    const userRequestedChart = didUserRequestChart(messages, messageIndex);
    const renderTextPart = (text: string, key: string) => {
        if (message.role === 'user') {
            const shouldKeepSingleLine = !text.includes('\n') && text.trim().length <= 24;

            return (
                <div key={key} className={cn('max-w-full leading-7 text-foreground', shouldKeepSingleLine ? 'whitespace-nowrap' : 'whitespace-pre-wrap break-words')}>
                    {text}
                </div>
            );
        }

        return <MessageResponse key={key}>{text}</MessageResponse>;
    };
    const pushNarrativeContent = (node: ReactNode) => {
        narrativeContentItems.push(node);
    };
    const pushDeferredToolContent = (node: ReactNode) => {
        deferredToolItems.push(
            <div className="py-1.5" key={`tool-block-${message.id}-${deferredToolItems.length}`}>
                {node}
            </div>,
        );
    };

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
    const toolCallPartById = new Map<string, { part: any; messageIndex: number; partIndex: number }>();
    const toolResultPartById = new Map<string, { part: any; messageIndex: number; partIndex: number }>();
    messages.forEach((msg, msgIndex) => {
        (msg.parts ?? []).forEach((part: any, partIndex: number) => {
            const toolCallId = getToolCallId(part);
            if (toolCallId && isToolCallPart(part) && !toolCallPartById.has(toolCallId)) {
                toolCallPartById.set(toolCallId, { part, messageIndex: msgIndex, partIndex });
            }

            const toolResultId = getToolResultId(part);
            const isResultPart = part?.type === 'tool_result' || part?.type === 'tool-result' || (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output);
            if (toolResultId && isResultPart && !toolResultPartById.has(toolResultId)) {
                toolResultPartById.set(toolResultId, { part, messageIndex: msgIndex, partIndex });
            }
        });
    });
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

    const getToolDisplayTitle = (part: any) => {
        const summary = getToolStepSummary(part);
        const toolLabel = formatToolName(getToolName(part));

        return summary === toolLabel ? summary : `${summary} · ${toolLabel}`;
    };

    const renderToolStateCard = ({
        part,
        key,
        fallbackInput,
        inputContent,
        resultContent,
        forceState,
    }: {
        part: any;
        key: string;
        fallbackInput?: unknown;
        inputContent?: ReactNode;
        resultContent?: ReactNode;
        forceState?: 'input-available' | 'output-available' | 'output-error';
    }) => {
        const title = getToolDisplayTitle(part);
        const state =
            forceState ??
            (part?.type === 'tool-error' || part?.state === 'output-error'
                ? 'output-error'
                : part?.type === 'tool-result' || part?.type === 'tool_result' || (typeof part?.type === 'string' && part.type.startsWith('tool-') && part.output)
                  ? 'output-available'
                  : 'input-available');
        const input = part?.input ?? fallbackInput;
        const output = part?.result ?? part?.output ?? part?.data ?? null;
        const errorText = part?.errorText ?? part?.error?.message ?? (part?.type === 'tool-error' && typeof part?.message === 'string' ? part.message : undefined);
        const defaultOpen = state !== 'output-available';

        return (
            <Tool key={key} defaultOpen={defaultOpen} className="mb-0 border-border/60 shadow-none">
                <ToolHeader type="dynamic-tool" state={state} toolName={title} title={title} />
                <ToolContent>
                    {inputContent ?? (input !== undefined ? <ToolInput input={input} /> : null)}
                    {resultContent ? (
                        <div className="pt-3">{resultContent}</div>
                    ) : state !== 'input-available' ? (
                        <div className="pt-3">
                            <ToolOutput output={output} errorText={errorText} />
                        </div>
                    ) : null}
                </ToolContent>
            </Tool>
        );
    };

    const hasLaterVisibleSqlSuccess = (currentIndex: number) =>
        (message.parts ?? []).slice(currentIndex + 1).some((candidate: any) => {
            if (!shouldRenderToolResult(candidate)) {
                return false;
            }

            const nextSqlResult = getSqlResultFromPart(candidate, t('Errors.SqlExecutionFailed'));
            return Boolean(nextSqlResult?.ok);
        });

    const hasLaterVisibleChartResult = (currentIndex: number) =>
        (message.parts ?? []).slice(currentIndex + 1).some((candidate: any) => {
            if (!shouldRenderToolResult(candidate)) {
                return false;
            }

            return Boolean(getChartResultFromPart(candidate));
        });

    const shouldHideToolFailure = (part: any, index: number) => {
        if (part?.type === 'tool-error' || part?.state === 'output-error') {
            return true;
        }

        const sqlResult = getSqlResultFromPart(part, t('Errors.SqlExecutionFailed'));
        if (sqlResult && !sqlResult.ok && hasLaterVisibleSqlSuccess(index)) {
            return true;
        }

        return Boolean(sqlResult && !sqlResult.ok);
    };

    const shouldHideIntermediateSuccess = (part: any, index: number) => {
        const sqlResult = getSqlResultFromPart(part, t('Errors.SqlExecutionFailed'));
        if (sqlResult?.ok && hasLaterVisibleSqlSuccess(index)) {
            return true;
        }

        const chartResult = getChartResultFromPart(part);
        if (chartResult && hasLaterVisibleChartResult(index)) {
            return true;
        }

        return false;
    };

    if (assistantMessage && message.parts?.some((part: any) => part.type === 'source-url')) {
        const sourceParts = message.parts.filter((part: any) => part.type === 'source-url');
        leadingContentItems.push(
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
            if (!shouldRenderToolCall(part)) {
                return;
            }
            const toolId = getToolCallId(part);
            const toolName = getToolName(part);
            const pairedResult = toolId ? toolResultPartById.get(toolId) : null;

            if (toolName === 'sqlRunner') {
                const sqlResult = pairedResult?.part ? getSqlResultFromPart(pairedResult.part, t('Errors.SqlExecutionFailed')) : null;
                const sql = typeof part?.input?.sql === 'string' ? part.input.sql : '';
                pushDeferredToolContent(
                    renderToolStateCard({
                        part,
                        key: `${message.id}-tool-call-${i}`,
                        inputContent: sql ? <SqlStatementBlock sql={sql} onCopy={onCopySql} /> : undefined,
                        resultContent: sqlResult ? (
                            <SqlResultBody
                                key={`${message.id}-sql-${i}`}
                                result={sqlResult}
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
                                embedded
                            />
                        ) : undefined,
                        forceState: sqlResult ? 'output-available' : 'input-available',
                    }),
                );
                return;
            }

            processItems.push({
                key: `${message.id}-tool-call-${i}`,
                summary: getToolStepSummary(part),
                status: getProcessVisualStatus(part),
                defaultOpen: getProcessVisualStatus(part) !== 'completed',
                content: renderToolStateCard({ part, key: `${message.id}-tool-call-${i}` }),
            });
            return;
        }

        if (typeof part.type === 'string' && part.type.startsWith('tool-') && part.input && part.state === 'input-available') {
            if (!shouldRenderToolCall(part)) {
                return;
            }
            const toolId = getToolCallId(part);
            const toolName = getToolName(part);
            const pairedResult = toolId ? toolResultPartById.get(toolId) : null;

            if (toolName === 'sqlRunner') {
                const sqlResult = pairedResult?.part ? getSqlResultFromPart(pairedResult.part, t('Errors.SqlExecutionFailed')) : null;
                const sql = typeof part?.input?.sql === 'string' ? part.input.sql : '';
                pushDeferredToolContent(
                    renderToolStateCard({
                        part,
                        key: `${message.id}-dynamic-tool-call-${i}`,
                        inputContent: sql ? <SqlStatementBlock sql={sql} onCopy={onCopySql} /> : undefined,
                        resultContent: sqlResult ? (
                            <SqlResultBody key={`${message.id}-dynamic-sql-${i}`} result={sqlResult} onManualExecute={onManualExecute} mode={mode} embedded />
                        ) : undefined,
                        forceState: sqlResult ? 'output-available' : 'input-available',
                    }),
                );
                return;
            }

            processItems.push({
                key: `${message.id}-dynamic-tool-call-${i}`,
                summary: getToolStepSummary(part),
                status: getProcessVisualStatus(part),
                defaultOpen: getProcessVisualStatus(part) !== 'completed',
                content: renderToolStateCard({ part, key: `${message.id}-dynamic-tool-call-${i}` }),
            });
            return;
        }

        // tool-error
        if (part.type === 'tool-error') {
            return;
        }

        if (!shouldRenderToolResult(part)) {
            return;
        }

        const chartResult = getChartResultFromPart(part);
        if (chartResult) {
            if (shouldHideIntermediateSuccess(part, i)) {
                return;
            }

            chartResults.push(chartResult);

            processItems.push({
                key: `${message.id}-tool-chart-${i}`,
                summary: getToolStepSummary(part),
                status: getProcessVisualStatus(part),
                defaultOpen: false,
                content: (
                    <div key={`${message.id}-tool-chart-${i}`} className="pt-1">
                        <ChartResultCard key={`${message.id}-chart-${i}`} result={chartResult} source="tool" />
                    </div>
                ),
            });
            return;
        }

        const sqlResult = getSqlResultFromPart(part, t('Errors.SqlExecutionFailed'));
        if (sqlResult) {
            const toolId = getToolResultId(part);
            const pairedToolCall = toolId ? toolCallPartById.get(toolId) : null;
            if (pairedToolCall && (pairedToolCall.messageIndex < messageIndex || (pairedToolCall.messageIndex === messageIndex && pairedToolCall.partIndex < i))) {
                return;
            }
            if (shouldHideToolFailure(part, i)) {
                return;
            }
            if (shouldHideIntermediateSuccess(part, i)) {
                return;
            }

            sqlResults.push(sqlResult);

            pushDeferredToolContent(
                renderToolStateCard({
                    part,
                    key: `${message.id}-tool-sql-${i}`,
                    inputContent: sqlResult.sql ? <SqlStatementBlock sql={sqlResult.sql} onCopy={onCopySql} /> : undefined,
                    resultContent: (
                        <SqlResultBody
                            key={`${message.id}-sql-${i}`}
                            result={sqlResult}
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
                            embedded
                        />
                    ),
                    forceState: 'output-available',
                }),
            );
            return;
        }

        const toolName = getToolName(part);
        if (toolName) {
            if (shouldHideToolFailure(part, i)) {
                return;
            }

            processItems.push({
                key: `${message.id}-tool-result-${i}`,
                summary: getToolStepSummary(part),
                status: getProcessVisualStatus(part),
                defaultOpen: getProcessVisualStatus(part) !== 'completed',
                content: renderToolStateCard({
                    part,
                    key: `${message.id}-tool-result-${i}`,
                    fallbackInput: inferToolArgsFromResult(part),
                }),
            });
        }

        if (part.type === 'text') {
            if (assistantMessage && hasMultipleTextParts && i !== finalTextPartIndex) {
                foldedNarrativeParts.push(renderTextPart(part.text, `${message.id}-folded-text-${i}`));
                return;
            }
            pushNarrativeContent(renderTextPart(part.text, `${message.id}-text-${i}`));
            return;
        }

        // reasoning
        if (part.type === 'reasoning') {
            pushNarrativeContent(
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
            pushDeferredToolContent(<ChartResultCard key={`${message.id}-auto-chart`} result={autoChart} source="auto" />);
        }
    }

    if (processItems.length > 0) {
        if (foldedNarrativeParts.length > 0) {
            processItems.unshift({
                key: `${message.id}-process-notes`,
                summary: getProcessNotesLabel(locale),
                status: 'completed',
                defaultOpen: false,
                content: (
                    <div key={`${message.id}-process-notes`} className="space-y-3 pt-1">
                        {foldedNarrativeParts}
                    </div>
                ),
            });
        }

        const processNodes = processItems.map(item => {
            const statusCopy = getProcessStatusCopy(item.status, locale);

            return (
                <Collapsible key={item.key} defaultOpen={item.defaultOpen ?? false} className="group/step overflow-hidden">
                    <div className="px-1 py-1.5">
                        <div className="min-w-0">
                            <div className="min-w-0 flex-1">
                                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-[12.5px] text-muted-foreground transition-colors hover:text-foreground/80">
                                    <span className="inline-flex min-w-0 items-center gap-2">
                                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusCopy.dotClassName)} />
                                        <span className="truncate">{item.summary}</span>
                                        <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]', statusCopy.badgeClassName)}>
                                            {statusCopy.icon}
                                            <span>{statusCopy.label}</span>
                                        </span>
                                        <ChevronRightIcon className="size-3.5 shrink-0 group-data-[state=open]/step:hidden" />
                                        <ChevronDownIcon className="hidden size-3.5 shrink-0 group-data-[state=open]/step:block" />
                                    </span>
                                    <span className="flex shrink-0 items-center gap-0.5">{item.actions}</span>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-2">
                                    <div className="min-w-0 pl-0.5">{item.content}</div>
                                </CollapsibleContent>
                            </div>
                        </div>
                    </div>
                </Collapsible>
            );
        });

        deferredToolItems.unshift(...processNodes);
    }

    const hasToolParts = !!message.parts?.some((part: any) => {
        if (!part || typeof part !== 'object') return false;
        if (part.type === 'tool-call' || part.type === 'tool_call') return false;
        if (part.type === 'tool-error') return true;
        if (part.type === 'tool-result' || part.type === 'tool_result') return true;
        return typeof part.type === 'string' && part.type.startsWith('tool-');
    });

    if (assistantMessage && narrativeContentItems.length === 0 && (!isLatestAssistant || !isStreaming) && !hasToolParts) {
        pushNarrativeContent(<AssistantFallbackCard key={`${message.id}-fallback`} />);
    }

    const contentItems: ReactNode[] = [...leadingContentItems];

    if (narrativeContentItems.length > 0) {
        const [firstNarrativeItem, ...remainingNarrativeItems] = narrativeContentItems;
        contentItems.push(firstNarrativeItem);
        contentItems.push(...deferredToolItems);
        contentItems.push(...remainingNarrativeItems);
    } else {
        contentItems.push(...deferredToolItems);
    }

    if (contentItems.length === 0) {
        return null;
    }

    const isAssistant = message.role === 'assistant';

    return (
        <div key={message.id} className="w-full space-y-1.5">
            <Message from={message.role} className={isAssistant ? 'w-full' : undefined}>
                <MessageContent className={isAssistant ? 'w-full max-w-none bg-transparent' : undefined}>{contentItems}</MessageContent>
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
