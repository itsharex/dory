# Dory ResultSet AI Profiling v1 Design

## 1. Background

Dory is evolving from a traditional SQL client into an **AI-native data workspace**.

Today, our execution pipeline is already well-structured:

* `query_session` → execution context
* `query_result_set` → per-statement result
* `query_result_page` → paginated data storage

However, **ResultSet is still treated as a passive data container**, not an intelligent object.

This creates a major limitation:

> AI currently receives raw rows + SQL, but lacks structured understanding of the result.

---

## 2. Problem

Current limitations:

### 2.1 Lack of semantic understanding

* Columns only contain `{ name, type }`
* No notion of:

  * identifier vs dimension vs measure
  * time columns
  * categorical vs high-cardinality fields

### 2.2 No statistical profiling

* No min/max/avg for numeric columns
* No topK distribution for string columns
* No time range detection
* No null / distinct analysis

### 2.3 No ResultSet-level summary

AI cannot determine:

* Is this a detail table or aggregated table?
* Is this suitable for charting?
* What are the key columns?

### 2.4 AI inefficiency

* AI must consume full row data
* No compressed representation
* Poor reasoning quality

---

## 3. Goal

Transform ResultSet into a **first-class, AI-ready object**.

This means:

* ResultSet becomes the **primary context unit for AI**
* AI consumes **structured summaries**, not raw data
* Users can interact with ResultSet as a **persistent analysis object**

---

## 4. Design Overview

We introduce three key additions:

### 4.1 Column Metadata Upgrade

Enhance `columns` field with normalized types and semantic roles.

### 4.2 ResultSet Profiling (`stats`)

Add structured statistical and semantic analysis.

### 4.3 View State (`view_state`)

Capture how users interact with the result.

---

## 5. Schema Changes

### 5.1 query_result_set (extended)

```ts
stats: jsonb('stats'),
viewState: jsonb('view_state'),
aiProfileVersion: integer('ai_profile_version').default(1),
```

---

## 6. Column Metadata (v1)

```ts
export interface ResultColumnMeta {
  name: string;
  displayName?: string;

  dbType?: string;

  normalizedType:
    | 'string'
    | 'integer'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'json'
    | 'array'
    | 'unknown';

  nullable?: boolean;

  semanticRole?:
    | 'identifier'
    | 'dimension'
    | 'measure'
    | 'time'
    | 'text'
    | 'json'
    | 'unknown';

  isPrimaryKeyLike?: boolean;
  isHighCardinality?: boolean;
  isCategorical?: boolean;
}
```

---

## 7. ResultSet Profiling Structure

```ts
export interface ResultSetStatsV1 {
  summary: ResultSetSummary;
  columns: Record<string, ColumnProfile>;
  sample: ResultSampleInfo;
}
```

---

### 7.1 Result Summary

```ts
export interface ResultSetSummary {
  kind:
    | 'detail_table'
    | 'aggregated_table'
    | 'time_series'
    | 'single_value'
    | 'unknown';

  rowCount: number | null;
  columnCount: number;

  limited: boolean;
  limit: number | null;

  numericColumnCount: number;
  dimensionColumnCount: number;
  timeColumnCount: number;
  identifierColumnCount: number;

  nullCellRatio?: number | null;
  duplicateRowRatio?: number | null;

  isGoodForChart: boolean;
  recommendedChart?:
    | 'table'
    | 'bar'
    | 'line'
    | 'pie'
    | 'metric'
    | 'scatter'
    | null;

  primaryTimeColumn?: string | null;
  primaryMeasureColumns?: string[];
  primaryDimensionColumns?: string[];
}
```

---

### 7.2 Column Profile

```ts
export interface ColumnProfile {
  name: string;
  normalizedType: string;
  semanticRole: string;

  nullCount: number;
  nonNullCount: number;
  distinctCount?: number | null;

  sampleValues: unknown[];

  topK?: Array<{ value: string; count: number }>;

  min?: number | null;
  max?: number | null;
  sum?: number | null;
  avg?: number | null;
  p50?: number | null;
  p95?: number | null;

  zeroCount?: number | null;
  negativeCount?: number | null;

  minTime?: string | null;
  maxTime?: string | null;

  inferredTimeGrain?: string;

  isHighCardinality?: boolean;
  isCategorical?: boolean;
}
```

---

### 7.3 Sample Info

```ts
export interface ResultSampleInfo {
  sampleStrategy: 'head' | 'head_tail' | 'reservoir';
  sampleRowCount: number;
  truncatedForAI: boolean;
}
```

---

## 8. View State (v1)

```ts
export interface ResultSetViewState {
  searchText?: string;
  sorts?: Array<{ column: string; direction: 'asc' | 'desc' }>;
  filters?: Array<{
    column: string;
    op: string;
    value?: unknown;
  }>;
  hiddenColumns?: string[];
  pinnedColumns?: string[];
  selectedRowIndexes?: number[];
}
```

---

## 9. Profiling Strategy

### 9.1 Processing Scope

* Analyze first N = 1000 rows
* Sample 50–100 rows for AI

---

### 9.2 Type Normalization

Map DB types into unified types:

* int → integer
* numeric → number
* text → string
* timestamp → datetime

---

### 9.3 Semantic Role Inference

#### identifier

* column name contains `id`
* high distinct ratio (>95%)

#### time

* date/datetime type
* column name contains `time`, `date`

#### measure

* numeric + not identifier
* column name contains `count`, `sum`, `amount`

#### dimension

* string + low cardinality

---

### 9.4 Statistics

| Type    | Metrics                     |
| ------- | --------------------------- |
| numeric | min / max / avg / p50 / p95 |
| string  | topK / distinct / length    |
| time    | minTime / maxTime / grain   |

---

## 10. Execution Flow

### Step 1: Query execution

Persist:

* query_session
* query_result_set
* query_result_page

### Step 2: Async profiling

Compute:

* column types
* semantic roles
* statistics
* summary

### Step 3: Update stats field

---

## 11. AI Context Payload

```ts
export interface AIResultContextPayload {
  sqlText: string;

  summary: ResultSetSummary;

  columns: Array<{
    name: string;
    normalizedType: string;
    semanticRole: string;
    nullCount: number;
    distinctCount?: number | null;
    sampleValues: unknown[];
    topK?: Array<{ value: string; count: number }>;
  }>;

  sampleRows: Array<Record<string, unknown>>;
}
```

---

## 12. Supported AI Scenarios (v1)

### 12.1 Explain Result

AI explains:

* structure
* key columns
* patterns

### 12.2 Chart Recommendation

Based on:

* time column
* measure column
* cardinality

### 12.3 Next Query Suggestion

Generate follow-up SQL

### 12.4 Continue in Chat

Use ResultSet as context instead of raw SQL

---

## 13. Rollout Plan

### Phase 1 (P0)

* stats field
* normalizedType
* semanticRole
* basic profiling

### Phase 2 (P1)

* chart recommendation
* time grain inference
* better cardinality detection

### Phase 3 (P2)

* interaction-aware AI
* cross-result comparison
* lineage

---

## 14. Final Outcome

After this change:

**Before**

* ResultSet = raw data container

**After**

* ResultSet = structured, semantic, AI-ready object

This is the foundation for:

* AI-native analytics
* multi-step reasoning
* human + AI collaborative workflows
