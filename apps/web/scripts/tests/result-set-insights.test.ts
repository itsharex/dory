import assert from 'node:assert/strict';
import { profileResultSet } from '@/lib/client/result-set-ai';
import { buildInsightDraft, buildInsightRewriteRequest, buildInsights } from '@/lib/client/result-set-insights';

function translate(key: string, values?: Record<string, string | number>) {
    return `${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
}

function testFactsAndPatternsForTimeSeries() {
    const rows = [
        { created_at: '2025-01-01T00:00:00.000Z', level: 'info', duration_ms: 10, queue_ms: 5 },
        { created_at: '2025-01-01T01:00:00.000Z', level: 'info', duration_ms: 12, queue_ms: 7 },
        { created_at: '2025-01-01T02:00:00.000Z', level: 'info', duration_ms: 11, queue_ms: 6 },
        { created_at: '2025-01-01T03:00:00.000Z', level: 'error', duration_ms: 100, queue_ms: 60 },
        { created_at: '2025-01-01T04:00:00.000Z', level: 'warn', duration_ms: 13, queue_ms: 8 },
        { created_at: '2025-01-01T05:00:00.000Z', level: 'info', duration_ms: 14, queue_ms: 9 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select created_at, level, duration_ms, queue_ms from logs',
        rawColumns: [
            { name: 'created_at', type: 'timestamp' },
            { name: 'level', type: 'text' },
            { name: 'duration_ms', type: 'numeric' },
            { name: 'queue_ms', type: 'numeric' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select created_at, level, duration_ms, queue_ms from logs',
        rows,
        locale: 'en',
        t: translate,
    });

    assert.equal(draft.keyColumns.time, 'created_at');
    assert.ok(draft.facts.some(fact => fact.type === 'trend_candidate'));
    assert.ok(draft.facts.some(fact => fact.type === 'measure_spread'));
    assert.ok(draft.patterns.some(pattern => pattern.kind === 'spike'));
    assert.ok(draft.patterns.some(pattern => pattern.kind === 'correlation'));
    assert.ok(draft.recommendedActions.length >= 3);
}

function testRiskSignalThreshold() {
    const rows = [
        { level: 'info', service: 'orders' },
        { level: 'info', service: 'orders' },
        { level: 'info', service: 'orders' },
        { level: 'error', service: 'auth' },
        { level: 'error', service: 'auth' },
    ];

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

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select level, service from logs',
        rows,
        locale: 'en',
        t: translate,
    });

    assert.ok(draft.facts.some(fact => fact.type === 'risk_signal'));
    assert.ok(draft.recommendedActions.some(action => action.id === 'service-error-breakdown'));
}

function testNoTimeColumnSkipsTrendRewritePrompt() {
    const rows = [
        { service: 'orders', total: 10 },
        { service: 'auth', total: 4 },
        { service: 'billing', total: 2 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select service, total from x',
        rawColumns: [
            { name: 'service', type: 'text' },
            { name: 'total', type: 'integer' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const rewriteRequest = buildInsightRewriteRequest({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select service, total from x',
        rows,
        locale: 'en',
        t: translate,
    });

    assert.ok(rewriteRequest);
    assert.ok(!rewriteRequest?.facts.some(fact => fact.type === 'trend_candidate'));
}

function testRulesFallbackView() {
    const rows = [
        { timestamp: '2025-01-01T00:00:00.000Z', message: 'ok', duration_ms: 10 },
        { timestamp: '2025-01-01T01:00:00.000Z', message: 'ok', duration_ms: 12 },
        { timestamp: '2025-01-01T02:00:00.000Z', message: 'slow', duration_ms: 100 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select timestamp, message, duration_ms from logs',
        rawColumns: [
            { name: 'timestamp', type: 'timestamp' },
            { name: 'message', type: 'text' },
            { name: 'duration_ms', type: 'numeric' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select timestamp, message, duration_ms from logs',
        rows,
        locale: 'en',
        t: translate,
    });

    assert.equal(view.source, 'rules');
    assert.ok(view.insights.length >= 2);
    assert.ok(view.advancedPatterns !== undefined);
}

testFactsAndPatternsForTimeSeries();
testRiskSignalThreshold();
testNoTimeColumnSkipsTrendRewritePrompt();
testRulesFallbackView();

console.log('result-set-insights tests passed');
