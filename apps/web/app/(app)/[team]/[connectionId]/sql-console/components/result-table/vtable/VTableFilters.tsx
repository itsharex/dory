'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Filter, X } from 'lucide-react';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { cn } from '@/lib/utils';
import { ColumnFilterPopover } from './ColumnFIlter';
import { ColumnFilter, NumOp, StrOp } from './type';

type ResultRow = { rowData: Record<string, any> };

type FilterDraft = {
    col: string;
    kind: 'string' | 'number';
    op: StrOp | NumOp;
    value?: string;
    cs: boolean;
};

type ColumnMeta = { name: string; type?: string | null };
type PopoverColumnMeta = { name: string; type: string };

function normalizeColumns(columnsRaw: ColumnMeta[]): PopoverColumnMeta[] {
    return columnsRaw.map(column => ({
        name: column.name,
        type: column.type ?? '',
    }));
}

function testString(raw: any, op: StrOp, val?: string, cs?: boolean) {
    const s = raw == null ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    const t = val ?? '';
    const a = cs ? s : s.toLowerCase();
    const b = cs ? t : t.toLowerCase();
    switch (op) {
        case 'contains':
            return a.includes(b);
        case 'equals':
            return a === b;
        case 'startsWith':
            return a.startsWith(b);
        case 'endsWith':
            return a.endsWith(b);
        case 'empty':
            return a.length === 0;
        case 'notEmpty':
            return a.length > 0;
        case 'regex':
            try {
                const re = new RegExp(val ?? '', cs ? '' : 'i');
                return re.test(s);
            } catch {
                return false;
            }
    }
}

function testNumber(raw: any, op: NumOp, val?: string) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    const m = Number(val);
    if (Number.isNaN(n)) return false;
    switch (op) {
        case 'eq':
            return n === m;
        case 'ne':
            return n !== m;
        case 'gt':
            return n > m;
        case 'ge':
            return n >= m;
        case 'lt':
            return n < m;
        case 'le':
            return n <= m;
    }
}

export function useVTableFilters({
    results,
    storageKey,
}: {
    results: ResultRow[];
    storageKey?: string;
}) {
    const [activeFilters, setActiveFilters] = useState<ColumnFilter[]>(() => {
        if (typeof window !== 'undefined' && storageKey) {
            try {
                const raw = localStorage.getItem(`${storageKey}:filters`);
                if (raw) return JSON.parse(raw) as ColumnFilter[];
            } catch {}
        }
        return [];
    });
    const [filterDraft, setFilterDraft] = useState<FilterDraft>({
        col: '',
        kind: 'string',
        op: 'contains',
        value: '',
        cs: false,
    });

    useEffect(() => {
        if (!storageKey) return;
        try {
            localStorage.setItem(`${storageKey}:filters`, JSON.stringify(activeFilters));
        } catch {}
    }, [activeFilters, storageKey]);

    const filteredResults = useMemo(() => {
        if (activeFilters.length === 0) return results;
        return results.filter(row => {
            for (const filter of activeFilters) {
                const raw = row.rowData?.[filter.col];
                if (filter.kind === 'string') {
                    if (!testString(raw, filter.op as StrOp, filter.value, filter.caseSensitive)) return false;
                } else if (!testNumber(raw, filter.op as NumOp, filter.value)) {
                    return false;
                }
            }
            return true;
        });
    }, [activeFilters, results]);

    const filtersByColumn = useMemo(() => {
        const map = new Map<string, ColumnFilter>();
        activeFilters.forEach(filter => map.set(filter.col, filter));
        return map;
    }, [activeFilters]);

    const setColumnFilter = useCallback((filter: ColumnFilter) => {
        setActiveFilters(prev => {
            const others = prev.filter(item => item.col !== filter.col);
            return [...others, filter];
        });
    }, []);

    const applyFilterDraft = useCallback(() => {
        const { col, kind, op, value, cs } = filterDraft;
        if (!col) return;
        setColumnFilter({ col, kind, op, value: value ?? '', caseSensitive: cs });
    }, [filterDraft, setColumnFilter]);

    const removeFilter = useCallback((col: string) => {
        setActiveFilters(prev => prev.filter(filter => filter.col !== col));
    }, []);

    const clearAllFilters = useCallback(() => {
        setActiveFilters([]);
    }, []);

    const getColumnFilter = useCallback(
        (column: string) => filtersByColumn.get(column),
        [filtersByColumn],
    );

    const getColumnFilterPopoverProps = useCallback(
        (column: string, columnsRaw: ColumnMeta[]) => ({
            column,
            columns: normalizeColumns(columnsRaw),
            draft: filterDraft,
            setDraft: setFilterDraft,
            existing: filtersByColumn.get(column),
            onApply: applyFilterDraft,
            onRemove: removeFilter,
        }),
        [applyFilterDraft, filterDraft, filtersByColumn, removeFilter],
    );

    return {
        activeFilters,
        filteredResults,
        setColumnFilter,
        removeFilter,
        clearAllFilters,
        getColumnFilter,
        getColumnFilterPopoverProps,
    };
}

export function useVTableFilterUi({
    activeFilters,
    columnsRaw,
    onUpsertFilter,
    onRemoveFilter,
}: {
    activeFilters: ColumnFilter[];
    columnsRaw: ColumnMeta[];
    onUpsertFilter: (filter: ColumnFilter) => void;
    onRemoveFilter: (col: string) => void;
}) {
    const [filterDraft, setFilterDraft] = useState<FilterDraft>({
        col: '',
        kind: 'string',
        op: 'contains',
        value: '',
        cs: false,
    });
    const filtersByColumn = useMemo(() => {
        const map = new Map<string, ColumnFilter>();
        activeFilters.forEach(filter => map.set(filter.col, filter));
        return map;
    }, [activeFilters]);
    const normalizedColumns = useMemo(() => normalizeColumns(columnsRaw), [columnsRaw]);
    const applyFilterDraft = useCallback(() => {
        const { col, kind, op, value, cs } = filterDraft;
        if (!col) return;
        onUpsertFilter({ col, kind, op, value: value ?? '', caseSensitive: cs });
    }, [filterDraft, onUpsertFilter]);
    const getColumnFilter = useCallback(
        (column: string) => filtersByColumn.get(column),
        [filtersByColumn],
    );
    const getColumnFilterPopoverProps = useCallback(
        (column: string) => ({
            column,
            columns: normalizedColumns,
            draft: filterDraft,
            setDraft: setFilterDraft,
            existing: filtersByColumn.get(column),
            onApply: applyFilterDraft,
            onRemove: onRemoveFilter,
        }),
        [applyFilterDraft, filterDraft, filtersByColumn, normalizedColumns, onRemoveFilter],
    );

    return {
        getColumnFilter,
        getColumnFilterPopoverProps,
        filterDraft,
        setFilterDraft,
        applyFilterDraft,
    };
}

export function VTableFilters({
    activeFilters,
    columnsRaw,
    onUpsertFilter,
    onRemoveFilter,
    onClearAllFilters,
}: {
    activeFilters: ColumnFilter[];
    columnsRaw: ColumnMeta[];
    onUpsertFilter: (filter: ColumnFilter) => void;
    onRemoveFilter: (col: string) => void;
    onClearAllFilters: () => void;
}) {
    const t = useTranslations('SqlConsole');
    const [tagFilterAnchor, setTagFilterAnchor] = useState<HTMLElement | null>(null);
    const [tagFilterCol, setTagFilterCol] = useState<string | null>(null);
    const [tagOpenSig, setTagOpenSig] = useState(0);
    const { getColumnFilterPopoverProps, setFilterDraft } = useVTableFilterUi({
        activeFilters,
        columnsRaw,
        onUpsertFilter,
        onRemoveFilter,
    });
    const tagFilterPopoverProps = tagFilterCol ? getColumnFilterPopoverProps(tagFilterCol) : null;

    return (
        <>
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 py-1 border-b bg-muted/30 justify-between items-center">
                    <div className="flex flex-wrap gap-2">
                        {activeFilters.map(filter => (
                            <Badge
                                key={filter.col}
                                variant="secondary"
                                className="gap-1 cursor-pointer"
                                onClick={event => {
                                    setFilterDraft({
                                        col: filter.col,
                                        kind: filter.kind === 'number' ? 'number' : 'string',
                                        op: filter.op as StrOp | NumOp,
                                        value: filter.value ?? '',
                                        cs: !!filter.caseSensitive,
                                    });
                                    setTagFilterAnchor(event.currentTarget as HTMLElement);
                                    setTagFilterCol(filter.col);
                                    setTagOpenSig(value => value + 1);
                                }}
                                title={t('VTable.Filter.EditHint')}
                            >
                                <Filter className="h-3 w-3" />
                                <span className="max-w-48 truncate">{filter.col}</span>
                                <span className="opacity-70">
                                    {String(filter.op)}
                                    {filter.value ? `:${filter.value}` : ''}
                                    {filter.kind === 'string' && filter.caseSensitive ? t('VTable.Filter.CaseSensitiveSuffix') : ''}
                                </span>
                                <button
                                    className="ml-1 opacity-70 hover:opacity-100"
                                    onClick={event => {
                                        event.stopPropagation();
                                        onRemoveFilter(filter.col);
                                    }}
                                    aria-label={t('VTable.Filter.RemoveAria')}
                                    title={t('VTable.Filter.RemoveTitle')}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <button
                        className={cn('text-xs px-2 py-1 rounded border cursor-pointer transition-colors', 'hover:bg-accent')}
                        onClick={onClearAllFilters}
                    >
                        {t('VTable.Filter.ClearAll')}
                    </button>
                </div>
            )}

            {tagFilterCol && tagFilterPopoverProps && (
                <ColumnFilterPopover
                    {...tagFilterPopoverProps}
                    onApply={() => {
                        tagFilterPopoverProps.onApply();
                        setTagFilterAnchor(null);
                        setTagFilterCol(null);
                    }}
                    onRemove={col => {
                        onRemoveFilter(col);
                        setTagFilterAnchor(null);
                        setTagFilterCol(null);
                    }}
                    externalAnchor={tagFilterAnchor}
                    externalOpenSignal={tagOpenSig}
                />
            )}
        </>
    );
}
