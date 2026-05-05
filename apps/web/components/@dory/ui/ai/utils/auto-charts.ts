import { buildResultAutoChartProfile, toChartResultPart } from '@/lib/analysis/result-chart-profile';
import { getClientLocale } from '@/lib/i18n/client-locale';
import { translate } from '@/lib/i18n/i18n';

import { ChartResultPart } from '../charts-result';
import { SqlResultPart } from '../sql-result/type';

type AutoChartOptions = {
    title?: string;
    description?: string;
};

export function buildAutoChartFromSql(sqlResult: SqlResultPart, options?: AutoChartOptions): ChartResultPart | null {
    const rows = Array.isArray(sqlResult.previewRows) ? sqlResult.previewRows : [];
    if (!rows.length) return null;

    const profile = buildResultAutoChartProfile({
        rows,
        columns: sqlResult.columns,
    });
    const result = toChartResultPart(profile, {
        title: options?.title ?? translate(getClientLocale(), 'DoryUI.SqlResult.AutoChart.Title'),
        description: options?.description ?? translate(getClientLocale(), 'DoryUI.SqlResult.AutoChart.Description'),
    });

    return result as ChartResultPart | null;
}
