'use client';

import * as React from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/registry/new-york-v4/lib/utils';
import { useTranslations } from 'next-intl';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/registry/new-york-v4/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/registry/new-york-v4/ui/popover';
import { selectTriggerVariants } from '@/registry/new-york-v4/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/registry/new-york-v4/ui/tooltip';

export type SelectOption = {
    value: string;
    label: string;
};

type SearchableSelectProps = {
    value: string; // 当前选中值
    options: SelectOption[]; // 选项列表
    onChange: (value: string) => void; // 选中回调

    placeholder?: string; // 没有选中时按钮上显示
    emptyText?: string; // 搜索无结果文案
    groupLabel?: string; // CommandGroup heading

    /**
     * 「全部」选项配置：
     * - enableAll: 是否开启一个虚拟的「全部」选项
     * - allLabel: 显示文案，比如「所有数据库」「所有用户」
     * - allValue: 传给 onChange 的真实值，默认 ''
     */
    enableAll?: boolean;
    allLabel?: string;
    allValue?: string;

    /**
     * 左侧图标，可选
     */
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;

    /**
     * 样式
     */
    className?: string; // 整个按钮的 className
    popoverClassName?: string; // PopoverContent 的 className
    triggerSize?: 'sm' | 'control';
};

export function SearchableSelect({
    value,
    options,
    onChange,
    placeholder,
    emptyText,
    groupLabel,
    enableAll = false,
    allLabel,
    allValue = '',
    icon: Icon,
    className,
    popoverClassName,
    triggerSize = 'sm',
}: SearchableSelectProps) {
    const t = useTranslations('DoryUI');
    const resolvedPlaceholder = placeholder ?? t('Select.Placeholder');
    const resolvedEmptyText = emptyText ?? t('Select.Empty');
    const resolvedAllLabel = allLabel ?? t('Select.All');
    const searchPlaceholder = t('Select.SearchPlaceholder');
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');

    const selected = React.useMemo(() => options.find(o => o.value === value) || null, [options, value]);

    const displayLabel = React.useMemo(() => {
        if (enableAll && (value === allValue || value === '')) {
            return resolvedAllLabel;
        }
        return selected?.label ?? resolvedPlaceholder;
    }, [enableAll, value, resolvedAllLabel, allValue, selected, resolvedPlaceholder]);

    const filtered = React.useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    }, [options, query]);

    const handleSelect = (val: string) => {
        if (enableAll && val === '__ALL__') {
            onChange(allValue);
        } else {
            onChange(val);
        }
        setOpen(false);
    };

    const isAllSelected = enableAll && (value === allValue || value === '' || !value);

    return (
        <TooltipProvider>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        data-slot="select-trigger"
                        data-size={triggerSize}
                        role="combobox"
                        aria-expanded={open}
                        className={cn(selectTriggerVariants({ size: triggerSize }), 'w-full', className)}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="max-w-[220px] truncate">{displayLabel}</span>
                                </TooltipTrigger>
                                <TooltipContent side="right">{displayLabel}</TooltipContent>
                            </Tooltip>
                        </span>

                        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>

                <PopoverContent align="start" className={cn('w-80 p-0', popoverClassName)}>
                    <Command shouldFilter={false}>
                        <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} className="h-9" />
                        <CommandList className="max-h-64">
                            <CommandEmpty>{resolvedEmptyText}</CommandEmpty>
                            <CommandGroup heading={groupLabel}>
                                {enableAll && (
                                    <CommandItem key="__ALL__" value="__ALL__" onSelect={handleSelect} className="flex items-center gap-2">
                                        <span className="truncate text-xs">{resolvedAllLabel}</span>
                                        <Check className={cn('ml-auto h-4 w-4', isAllSelected ? 'opacity-100' : 'opacity-0')} />
                                    </CommandItem>
                                )}

                                {filtered.map(opt => (
                                    <CommandItem key={opt.value} value={opt.value} onSelect={handleSelect} className="flex items-center gap-2">
                                        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="max-w-[200px] truncate text-sm">{opt.label}</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">{opt.label}</TooltipContent>
                                        </Tooltip>
                                        <Check className={cn('ml-auto h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </TooltipProvider>
    );
}
