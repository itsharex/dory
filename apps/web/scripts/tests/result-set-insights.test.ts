import assert from 'node:assert/strict';
import { profileResultSet } from '@/lib/client/result-set-ai';
import { buildInsights } from '@/lib/client/result-set-insights';

function translate(key: string, values?: Record<string, string | number>) {
    return `${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
}

function testTimeSeriesInsights() {
    const profiled = profileResultSet({
        sqlText: 'select created_at, level, duration_ms from logs',
        rawColumns: [
            { name: 'created_at', type: 'timestamp' },
            { name: 'level', type: 'text' },
            { name: 'duration_ms', type: 'numeric' },
        ],
        rows: [
            { created_at: '2025-01-01T00:00:00.000Z', level: 'info', duration_ms: 100 },
            { created_at: '2025-01-01T01:00:00.000Z', level: 'error', duration_ms: 450 },
            { created_at: '2025-01-01T02:00:00.000Z', level: 'info', duration_ms: 900 },
            { created_at: '2025-01-01T03:00:00.000Z', level: 'warn', duration_ms: 1200 },
        ],
        rowCount: 4,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select created_at, level, duration_ms from logs',
        locale: 'en',
        t: translate,
    });

    assert.equal(view.keyColumns.time, 'created_at');
    assert.ok(view.quickSummary.title.includes('Insights.QuickSummary.Title'));
    assert.ok(view.insights.some(item => item.includes('Insights.Messages.TimeTrend')));
    assert.ok(view.insights.some(item => item.includes('Insights.Messages.MeasureSpread')));
}

function testLogDistributionInsights() {
    const rows = [
        { timestamp: '2025-01-01T00:00:00.000Z', level: 'info', service: 'order-service', message: 'Request processed successfully' },
        { timestamp: '2025-01-01T00:05:00.000Z', level: 'info', service: 'order-service', message: 'Request processed successfully' },
        { timestamp: '2025-01-01T00:10:00.000Z', level: 'error', service: 'auth-service', message: 'User session failed' },
        { timestamp: '2025-01-01T00:15:00.000Z', level: 'error', service: 'auth-service', message: 'User session failed' },
        { timestamp: '2025-01-01T00:20:00.000Z', level: 'error', service: 'order-service', message: 'Payment timeout' },
        { timestamp: '2025-01-01T00:25:00.000Z', level: 'info', service: 'billing-service', message: 'Invoice created' },
        { timestamp: '2025-01-01T00:30:00.000Z', level: 'warn', service: 'order-service', message: 'Retry scheduled' },
        { timestamp: '2025-01-01T00:35:00.000Z', level: 'info', service: 'order-service', message: 'Request processed successfully' },
        { timestamp: '2025-01-01T00:40:00.000Z', level: 'info', service: 'order-service', message: 'Request processed successfully' },
        { timestamp: '2025-01-01T00:45:00.000Z', level: 'info', service: 'billing-service', message: 'Invoice created' },
    ];

    const profiled = profileResultSet({
        sqlText: 'select * from logs',
        rawColumns: [
            { name: 'timestamp', type: 'timestamp' },
            { name: 'level', type: 'text' },
            { name: 'service', type: 'text' },
            { name: 'message', type: 'text' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select * from logs',
        locale: 'en',
        t: translate,
    });

    assert.ok(view.insights.some(item => item.includes('Insights.Messages.PrimaryCategory')));
    assert.ok(view.insights.some(item => item.includes('Insights.Messages.RiskCategory')));
    assert.ok(view.insights.some(item => item.includes('Insights.Messages.TopMessage')));
    assert.equal(view.recommendedActions[0]?.id, 'time-error-trend');
}

function testNoTimeColumnDoesNotSuggestTrend() {
    const profiled = profileResultSet({
        sqlText: 'select service, count(*) as total from logs group by service',
        rawColumns: [
            { name: 'service', type: 'text' },
            { name: 'total', type: 'integer' },
        ],
        rows: [
            { service: 'order-service', total: 20 },
            { service: 'auth-service', total: 5 },
        ],
        rowCount: 2,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select service, count(*) as total from logs group by service',
        locale: 'en',
        t: translate,
    });

    assert.ok(!view.insights.some(item => item.includes('Insights.Messages.TimeTrend')));
    assert.ok(!view.recommendedActions.some(action => action.id === 'time-error-trend'));
}

function testLowErrorRatioDoesNotTriggerRisk() {
    const rows = Array.from({ length: 20 }, (_, index) => ({
        level: index === 0 ? 'error' : 'info',
        service: index === 0 ? 'auth-service' : 'order-service',
    }));

    const profiled = profileResultSet({
        sqlText: 'select level, service from logs',
        rawColumns: [
            { name: 'level', type: 'text' },
            { name: 'service', type: 'text' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select level, service from logs',
        locale: 'en',
        t: translate,
    });

    assert.ok(!view.insights.some(item => item.includes('Insights.Messages.RiskCategory')));
}

function testInsightCap() {
    const profiled = profileResultSet({
        sqlText: 'select timestamp, level, service, message, duration_ms from logs',
        rawColumns: [
            { name: 'timestamp', type: 'timestamp' },
            { name: 'level', type: 'text' },
            { name: 'service', type: 'text' },
            { name: 'message', type: 'text' },
            { name: 'duration_ms', type: 'numeric' },
        ],
        rows: [
            { timestamp: '2025-01-01T00:00:00.000Z', level: 'error', service: 'auth-service', message: 'Failed login', duration_ms: 1200 },
            { timestamp: '2025-01-01T00:05:00.000Z', level: 'error', service: 'auth-service', message: 'Failed login', duration_ms: 1400 },
            { timestamp: '2025-01-01T00:10:00.000Z', level: 'info', service: 'order-service', message: 'Request processed', duration_ms: 90 },
            { timestamp: '2025-01-01T00:15:00.000Z', level: 'warn', service: 'billing-service', message: 'Retry scheduled', duration_ms: 600 },
            { timestamp: '2025-01-01T00:20:00.000Z', level: 'info', service: 'order-service', message: 'Request processed', duration_ms: 110 },
        ],
        rowCount: 5,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select timestamp, level, service, message, duration_ms from logs',
        locale: 'en',
        t: translate,
    });

    assert.ok(view.insights.length >= 3);
    assert.ok(view.insights.length <= 5);
}

testTimeSeriesInsights();
testLogDistributionInsights();
testNoTimeColumnDoesNotSuggestTrend();
testLowErrorRatioDoesNotTriggerRisk();
testInsightCap();

console.log('result-set-insights tests passed');
