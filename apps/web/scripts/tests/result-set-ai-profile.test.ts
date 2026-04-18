import assert from 'node:assert/strict';
import { profileResultSet } from '@/lib/client/result-set-ai';

function testSingleValue() {
    const profiled = profileResultSet({
        sqlText: 'select count(*) as total from events',
        rawColumns: [{ name: 'total', type: 'integer' }],
        rows: [{ total: 42 }],
        rowCount: 1,
        limited: false,
        limit: null,
    });

    assert.equal(profiled.stats.summary.kind, 'single_value');
    assert.equal(profiled.stats.summary.recommendedChart, 'metric');
}

function testTimeSeries() {
    const profiled = profileResultSet({
        sqlText: 'select created_at, amount from orders',
        rawColumns: [
            { name: 'created_at', type: 'timestamp' },
            { name: 'amount', type: 'numeric' },
        ],
        rows: [
            { created_at: '2025-01-01T00:00:00.000Z', amount: 10 },
            { created_at: '2025-01-02T00:00:00.000Z', amount: 20 },
            { created_at: '2025-01-03T00:00:00.000Z', amount: 30 },
        ],
        rowCount: 3,
        limited: false,
        limit: null,
    });

    assert.equal(profiled.stats.summary.kind, 'time_series');
    assert.equal(profiled.stats.summary.primaryTimeColumn, 'created_at');
    assert.equal(profiled.stats.columns.amount.p95, 30);
}

function testAggregatedTable() {
    const profiled = profileResultSet({
        sqlText: 'select country, count(*) as total from users group by country',
        rawColumns: [
            { name: 'country', type: 'text' },
            { name: 'total', type: 'integer' },
        ],
        rows: [
            { country: 'US', total: 10 },
            { country: 'CN', total: 8 },
            { country: 'JP', total: 3 },
        ],
        rowCount: 3,
        limited: false,
        limit: null,
    });

    assert.equal(profiled.stats.summary.kind, 'aggregated_table');
    assert.equal(profiled.stats.summary.recommendedChart, 'pie');
    assert.equal(profiled.columns[0]?.semanticRole, 'dimension');
    assert.equal(profiled.columns[1]?.semanticRole, 'measure');
}

function testDetailTable() {
    const profiled = profileResultSet({
        sqlText: 'select * from users',
        rawColumns: [
            { name: 'id', type: 'uuid' },
            { name: 'email', type: 'text' },
            { name: 'name', type: 'text' },
        ],
        rows: [
            { id: 'u1', email: 'a@example.com', name: 'A' },
            { id: 'u2', email: 'b@example.com', name: 'B' },
            { id: 'u3', email: 'c@example.com', name: 'C' },
        ],
        rowCount: 3,
        limited: false,
        limit: null,
    });

    assert.equal(profiled.stats.summary.kind, 'detail_table');
    assert.equal(profiled.columns[0]?.semanticRole, 'identifier');
}

testSingleValue();
testTimeSeries();
testAggregatedTable();
testDetailTable();

console.log('result-set-ai-profile tests passed');
