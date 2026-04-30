import assert from 'node:assert/strict';
import { profileResultSet } from '@/lib/client/result-set-ai';
import { buildInsightDraft, buildInsightRewriteRequest, buildInsights, buildStructuredInsightView } from '@/lib/client/result-set-insights';

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
    assert.ok(draft.recommendedActions.some(action => action.id === 'group-by-service' || action.id === 'analyze-source'));
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

function testStructuredInsightCardAndActionLabels() {
    const rows = [
        { service: 'service A', total_rows: 22 },
        { service: 'service B', total_rows: 21 },
        { service: 'service C', total_rows: 3 },
        { service: 'service D', total_rows: 2 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select service, total_rows from x',
        rawColumns: [
            { name: 'service', type: 'text' },
            { name: 'total_rows', type: 'integer' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select service, total_rows from x',
        rows,
        locale: 'en',
        t: translate,
    });
    const view = buildInsights({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select service, total_rows from x',
        rows,
        locale: 'en',
        t: translate,
    });
    const structured = buildStructuredInsightView({
        context: {
            stats: profiled.stats,
            columns: profiled.columns,
            sqlText: 'select service, total_rows from x',
            rows,
            locale: 'en',
            t: translate,
        },
        draft,
        view,
    });

    assert.ok(structured.decision.title.includes('Insights.QuickSummary.Title'));
    assert.ok(structured.decision.impact);
    assert.ok(!('recommendedActions' in structured.decision));
    assert.ok(structured.decision.items.length > 0);
    assert.ok(structured.decision.items.some(item => item.actions.some(action => action.id === 'inspect-outliers')));
    assert.ok(structured.decision.items.every(item => item.actions.every(action => action.kind !== 'analysis-suggestion' || !!action.action || !!action.sqlPreview)));
    assert.ok(draft.recommendedActions.some(action => action.id === 'inspect-outliers'));
    assert.ok(!draft.recommendedActions.some(action => action.label === 'Run'));
}

function testStructuredInsightActionsForRiskTrendAndOutlier() {
    const rows = [
        { created_at: '2025-01-01T00:00:00.000Z', service: 'auth', level: 'error', duration_ms: 15 },
        { created_at: '2025-01-01T01:00:00.000Z', service: 'auth', level: 'error', duration_ms: 16 },
        { created_at: '2025-01-01T02:00:00.000Z', service: 'orders', level: 'info', duration_ms: 17 },
        { created_at: '2025-01-01T03:00:00.000Z', service: 'orders', level: 'error', duration_ms: 200 },
        { created_at: '2025-01-01T04:00:00.000Z', service: 'billing', level: 'warn', duration_ms: 18 },
        { created_at: '2025-01-01T05:00:00.000Z', service: 'billing', level: 'info', duration_ms: 19 },
        { created_at: '2025-01-01T06:00:00.000Z', service: 'search', level: 'info', duration_ms: 20 },
        { created_at: '2025-01-01T07:00:00.000Z', service: 'search', level: 'info', duration_ms: 21 },
        { created_at: '2025-01-01T08:00:00.000Z', service: 'auth', level: 'error', duration_ms: 22 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select created_at, service, level, duration_ms from logs',
        rawColumns: [
            { name: 'created_at', type: 'timestamp' },
            { name: 'service', type: 'text' },
            { name: 'level', type: 'text' },
            { name: 'duration_ms', type: 'integer' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const context = {
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select created_at, service, level, duration_ms from logs',
        rows,
        locale: 'en',
        t: translate,
    };
    const structured = buildStructuredInsightView({
        context,
        draft: buildInsightDraft(context),
        view: buildInsights(context),
    });

    const riskItem = structured.decision.items.find(item => item.id.startsWith('risk:'));
    const trendItem = structured.decision.items.find(item => item.id.startsWith('trend:') || item.id.startsWith('spike:'));
    const outlierItem = structured.decision.items.find(item => item.id.startsWith('measure-spread:') || item.id.startsWith('outlier:'));

    assert.ok(riskItem?.actions.some(action => action.id === 'group-by-service' || action.id === 'analyze-source'));
    assert.ok(trendItem?.actions.some(action => action.id === 'view-time-trend'));
    assert.ok(outlierItem?.actions.some(action => action.id === 'inspect-outliers' || action.id === 'view-distribution'));
}

function testRewriteItemsCarryTheirOwnActions() {
    const rows = [
        { created_at: '2025-01-01T00:00:00.000Z', status: 'pending', amount: 10 },
        { created_at: '2025-01-01T01:00:00.000Z', status: 'paid', amount: 12 },
        { created_at: '2025-01-01T02:00:00.000Z', status: 'pending', amount: 100 },
        { created_at: '2025-01-01T03:00:00.000Z', status: 'paid', amount: 15 },
        { created_at: '2025-01-01T04:00:00.000Z', status: 'pending', amount: 20 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select created_at, status, amount from orders',
        rawColumns: [
            { name: 'created_at', type: 'timestamp' },
            { name: 'status', type: 'text' },
            { name: 'amount', type: 'numeric' },
        ],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });
    const context = {
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select created_at, status, amount from orders',
        rows,
        locale: 'en',
        t: translate,
    };
    const rewritten = {
        quickSummary: {
            title: 'Order trend is visible',
            subtitle: '5 rows',
        },
        primaryInsight: 'Order trend is visible',
        items: [
            {
                id: 'trend:created_at',
                title: 'Order trend is visible',
                summary: 'Order trend is visible',
                actions: [
                    {
                        type: 'trend' as const,
                        title: 'View created_at trend',
                        params: {
                            timeColumn: 'created_at',
                            measure: {
                                column: 'amount',
                                aggregation: 'SUM' as const,
                            },
                            limit: 50,
                        },
                        priority: 'primary' as const,
                    },
                ],
            },
            {
                id: 'dominant:status:pending',
                title: 'Pending orders are concentrated',
                summary: 'Pending orders are concentrated',
                actions: [
                    {
                        type: 'group' as const,
                        title: 'Analyze by status',
                        params: {
                            dimensions: ['status'],
                            measure: {
                                column: 'amount',
                                aggregation: 'SUM' as const,
                            },
                            limit: 20,
                        },
                        priority: 'primary' as const,
                    },
                ],
            },
        ],
        recommendedSql: null,
        autoRunPolicy: 'confirm_required' as const,
    };

    const view = buildInsights(context, rewritten);
    const structured = buildStructuredInsightView({
        context,
        draft: buildInsightDraft(context),
        view,
    });

    const trendItem = structured.decision.items.find(item => item.title === 'Order trend is visible');
    const statusItem = structured.decision.items.find(item => item.title === 'Pending orders are concentrated');

    assert.ok(trendItem?.actions.some(action => action.kind === 'analysis-suggestion' && action.action?.type === 'trend'));
    assert.ok(statusItem?.actions.some(action => action.kind === 'analysis-suggestion' && action.action?.type === 'group'));
    assert.ok(!('recommendedActions' in structured.decision));
}

function testLowInformationProfileSignals() {
    const rows = Array.from({ length: 20 }, (_, index) => ({
        event_type: 'CommitCommentEvent',
        actor_login: index % 3 === 0 ? 'alice' : index % 3 === 1 ? 'bob' : 'carol',
        repo_name: index % 2 === 0 ? 'dory/studio' : 'dory/web',
        created_at: `2025-01-01T${String(index % 10).padStart(2, '0')}:00:00.000Z`,
    }));

    const profiled = profileResultSet({
        sqlText: 'select event_type, actor_login, repo_name, created_at from github_events limit 20',
        rawColumns: [
            { name: 'event_type', type: 'text' },
            { name: 'actor_login', type: 'text' },
            { name: 'repo_name', type: 'text' },
            { name: 'created_at', type: 'timestamp' },
        ],
        rows,
        rowCount: rows.length,
        limited: true,
        limit: 20,
    });

    const eventType = profiled.stats.columns.event_type;
    const actorLogin = profiled.stats.columns.actor_login;
    assert.equal(eventType?.entropy, 0);
    assert.equal(eventType?.topValueShare, 1);
    assert.equal(eventType?.informationDensity, 'none');
    assert.ok((actorLogin?.entropy ?? 0) > 0);
    assert.notEqual(actorLogin?.informationDensity, 'none');

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select event_type, actor_login, repo_name, created_at from github_events limit 20',
        rows,
        locale: 'en',
        t: translate,
    });

    assert.ok(draft.facts.some(fact => fact.type === 'low_information_dimension' && fact.columns?.[0] === 'event_type'));
    assert.ok(!draft.facts.some(fact => fact.type === 'dominant_category' && fact.columns?.[0] === 'event_type'));
}

testFactsAndPatternsForTimeSeries();
testRiskSignalThreshold();
testNoTimeColumnSkipsTrendRewritePrompt();
testRulesFallbackView();
testStructuredInsightCardAndActionLabels();
testStructuredInsightActionsForRiskTrendAndOutlier();
testRewriteItemsCarryTheirOwnActions();
testLowInformationProfileSignals();

console.log('result-set-insights tests passed');
