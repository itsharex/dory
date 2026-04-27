import type { TableSchema } from '@/shared/stores/schema.store';

type SuggestedQuestion = {
    text: string;
    priority: number;
};

type TableRule = {
    pattern: RegExp;
    template: (formatters: SuggestionFormatters, table: string) => string;
};

type ColumnRule = {
    pattern: RegExp;
    template: (formatters: SuggestionFormatters, table: string, column: string) => string;
};

type ChatbotTranslate = (key: string, values?: Record<string, string>) => string;

export type SuggestionFormatters = {
    orderTrend: (table: string) => string;
    topUsers: (table: string) => string;
    errorLogs: (table: string) => string;
    popularProducts: (table: string) => string;
    paymentSummary: (table: string) => string;
    recentTrend: (table: string) => string;
    topRecordsByColumn: (table: string, column: string) => string;
    breakdownByColumn: (table: string, column: string) => string;
};

const TABLE_RULES: TableRule[] = [
    { pattern: /order/i, template: (formatters, table) => formatters.orderTrend(table) },
    { pattern: /user|customer/i, template: (formatters, table) => formatters.topUsers(table) },
    { pattern: /log|event/i, template: (formatters, table) => formatters.errorLogs(table) },
    { pattern: /product|item/i, template: (formatters, table) => formatters.popularProducts(table) },
    { pattern: /payment|transaction/i, template: (formatters, table) => formatters.paymentSummary(table) },
];

const COLUMN_RULES: ColumnRule[] = [
    {
        pattern: /^(created_at|updated_at|timestamp|date|time|datetime|created|updated)$/i,
        template: (formatters, table) => formatters.recentTrend(table),
    },
    {
        pattern: /^(amount|price|revenue|total|cost|salary|balance)$/i,
        template: (formatters, table, column) => formatters.topRecordsByColumn(table, column),
    },
    {
        pattern: /^(status|state|type|category)$/i,
        template: (formatters, table, column) => formatters.breakdownByColumn(table, column),
    },
];

function getTableBaseName(name: string): string {
    const parts = name.split('.');
    return parts[parts.length - 1];
}

export function createSuggestionFormatters(t: ChatbotTranslate): SuggestionFormatters {
    return {
        orderTrend: table => t('Welcome.DynamicSuggestions.OrderTrend', { table }),
        topUsers: table => t('Welcome.DynamicSuggestions.TopUsers', { table }),
        errorLogs: table => t('Welcome.DynamicSuggestions.ErrorLogs', { table }),
        popularProducts: table => t('Welcome.DynamicSuggestions.PopularProducts', { table }),
        paymentSummary: table => t('Welcome.DynamicSuggestions.PaymentSummary', { table }),
        recentTrend: table => t('Welcome.DynamicSuggestions.RecentTrend', { table }),
        topRecordsByColumn: (table, column) => t('Welcome.DynamicSuggestions.TopRecordsByColumn', { table, column }),
        breakdownByColumn: (table, column) => t('Welcome.DynamicSuggestions.BreakdownByColumn', { table, column }),
    };
}

export function generateSuggestions(tables: TableSchema[], fallbacks: string[], formatters: SuggestionFormatters, limit = 4): string[] {
    const suggestions: SuggestedQuestion[] = [];
    const usedTables = new Set<string>();

    for (const table of tables) {
        const baseName = getTableBaseName(table.name);

        for (const rule of TABLE_RULES) {
            if (rule.pattern.test(baseName) && !usedTables.has(table.name)) {
                suggestions.push({ text: rule.template(formatters, baseName), priority: 1 });
                usedTables.add(table.name);
                break;
            }
        }
    }

    for (const table of tables) {
        if (usedTables.has(table.name)) continue;
        const baseName = getTableBaseName(table.name);

        for (const column of table.columns) {
            if (usedTables.has(table.name)) break;

            for (const rule of COLUMN_RULES) {
                if (rule.pattern.test(column)) {
                    suggestions.push({ text: rule.template(formatters, baseName, column), priority: 2 });
                    usedTables.add(table.name);
                    break;
                }
            }
        }
    }

    suggestions.sort((a, b) => a.priority - b.priority);
    const result = suggestions.slice(0, limit).map(suggestion => suggestion.text);

    if (result.length < limit) {
        for (const fallback of fallbacks) {
            if (result.length >= limit) break;
            if (!result.includes(fallback)) {
                result.push(fallback);
            }
        }
    }

    return result;
}
