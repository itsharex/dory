import assert from 'node:assert/strict';
import { profileResultSet } from '@/lib/client/result-set-ai';
import { buildInsightDraft } from '@/lib/client/result-set-insights';
import { buildAnalysisSuggestions } from '@/lib/analysis/suggestions';
import { buildResultContext } from '@/lib/analysis/result-context';

function translate(key: string, values?: Record<string, string | number>) {
    return `${key}${values ? ` ${JSON.stringify(values)}` : ''}`;
}

function testTrendAndServiceSuggestions() {
    const rows = [
        { created_at: '2025-01-01T00:00:00.000Z', service: 'auth', level: 'error', duration_ms: 120 },
        { created_at: '2025-01-01T01:00:00.000Z', service: 'auth', level: 'error', duration_ms: 110 },
        { created_at: '2025-01-01T02:00:00.000Z', service: 'payment', level: 'info', duration_ms: 20 },
        { created_at: '2025-01-01T03:00:00.000Z', service: 'payment', level: 'error', duration_ms: 90 },
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

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select created_at, service, level, duration_ms from logs',
        rows,
        locale: 'en',
        t: translate,
    });

    const resultContext = buildResultContext({
        sessionId: 'session-1',
        setIndex: 0,
        sqlText: 'select created_at, service, level, duration_ms from logs',
        databaseName: 'db',
        rowCount: rows.length,
        columns: profiled.columns,
    });

    const suggestions = buildAnalysisSuggestions({
        resultContext,
        draft,
        recommendedActions: draft.recommendedActions,
    });

    assert.ok(suggestions.some(item => item.id === 'time-error-trend'));
    assert.ok(suggestions.some(item => item.id === 'service-error-breakdown'));
}

function testNoInvalidSuggestionWithoutDimensions() {
    const rows = [
        { total: 10 },
        { total: 20 },
        { total: 30 },
    ];

    const profiled = profileResultSet({
        sqlText: 'select total from metrics',
        rawColumns: [{ name: 'total', type: 'integer' }],
        rows,
        rowCount: rows.length,
        limited: false,
        limit: null,
    });

    const draft = buildInsightDraft({
        stats: profiled.stats,
        columns: profiled.columns,
        sqlText: 'select total from metrics',
        rows,
        locale: 'en',
        t: translate,
    });

    const resultContext = buildResultContext({
        sessionId: 'session-2',
        setIndex: 0,
        sqlText: 'select total from metrics',
        databaseName: 'db',
        rowCount: rows.length,
        columns: profiled.columns,
    });

    const suggestions = buildAnalysisSuggestions({
        resultContext,
        draft,
        recommendedActions: draft.recommendedActions,
    });

    assert.ok(!suggestions.some(item => item.id === 'service-error-breakdown'));
}

testTrendAndServiceSuggestions();
testNoInvalidSuggestionWithoutDimensions();

console.log('analysis-suggestions tests passed');
