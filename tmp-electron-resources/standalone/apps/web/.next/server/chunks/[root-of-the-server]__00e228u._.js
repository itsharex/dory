module.exports=[709134,e=>{"use strict";let t=(0,e.i(689452).isDesktopRuntime)();e.s(["USE_CLOUD_AI",0,t,"X_CONNECTION_ID_KEY",0,"X-Connection-ID"])},951615,(e,t,n)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},504446,(e,t,n)=>{t.exports=e.x("net",()=>require("net"))},755004,(e,t,n)=>{t.exports=e.x("tls",()=>require("tls"))},781598,e=>e.a(async(t,n)=>{try{var s=e.i(89171),r=e.i(379931),a=e.i(975795),o=e.i(276688),i=e.i(468291),l=e.i(951834),u=t([r,i]);[r,i]=u.then?(await u)():u;let f={notFound:"connection_not_found",missingHost:"missing_host",missingPath:"missing_path",missingUsername:"missing_username",missingIdentity:"missing_identity",missingPassword:"missing_password",missingIdentityInfo:"missing_identity_info",missingSshPassword:"missing_ssh_password",missingSshPrivateKey:"missing_ssh_private_key"};function c(e){let t=Error(e);return t.code=e,t}function d(e){if(e&&"object"==typeof e&&"code"in e){let t=e.code;if("string"==typeof t)return t}if(e instanceof Error){let t=e.message;if(Object.values(f).includes(t))return t}return null}async function m(e){let t=await (0,i.getDatasourcePool)(e.id);return t&&(e.configVersion&&t.config.configVersion!==e.configVersion||e.updatedAt&&t.config.updatedAt!==e.updatedAt)&&await (0,i.destroyDatasourcePool)(e.id),(0,i.ensureDatasourcePool)(e)}async function h(e,t,n,s){let a=await (0,r.getDBService)(),o=await a.connections.getById(t,n);if(!o)throw c(f.notFound);let i=(0,l.pickConnectionIdentity)(o.identities,s??null);if(!i)throw c(f.missingIdentity);let u=i.id?await a.connections.getIdentityPlainPassword(t,i.id):null,d=await a.connections.getSshPlainSecrets(t,o.connection.id),h=o.ssh?{...o.ssh,...d??{}}:d?{enabled:!0,...d}:null,p=(0,l.buildStoredConnectionConfig)(o.connection,{...i,password:u},h,e=>c(e));return{entry:await m(p),config:p,identity:i}}e.s(["CONNECTION_ERROR_CODES",0,f,"createConnectionError",0,c,"ensureConnectionPoolForUser",0,h,"getConnectionErrorCode",0,d,"mapConnectionErrorToResponse",0,function(e,t){let n=d(e);return n===f.notFound?s.NextResponse.json(a.ResponseUtil.error({code:o.ErrorCodes.NOT_FOUND,message:t.notFound}),{status:404}):n===f.missingHost?s.NextResponse.json(a.ResponseUtil.error({code:o.ErrorCodes.INVALID_PARAMS,message:t.missingHost}),{status:400}):n===f.missingPath?s.NextResponse.json(a.ResponseUtil.error({code:o.ErrorCodes.INVALID_PARAMS,message:t.missingPath??t.fallback}),{status:400}):s.NextResponse.json(a.ResponseUtil.error({code:o.ErrorCodes.ERROR,message:t.fallback}),{status:500})}]),n()}catch(e){n(e)}},!1),964395,e=>{"use strict";e.s(["isMissingAiEnvError",0,function(e){let t=e instanceof Error?e.message:String(e??"");return t.includes("DORY_AI_API_KEY")||t.includes("DORY_AI_CF_AIG_TOKEN")||t.includes("DORY_AI_CF_ACCOUNT_ID")||t.includes("DORY_AI_CF_GATEWAY")||t.includes("DORY_AI_URL")||t.includes("MISSING_AI_ENV")}])},721117,e=>e.a(async(t,n)=>{try{var s=e.i(781598),r=t([s]);[s]=r.then?(await r)():r;let h=`
--- Database Context ---
{schema}
-----------------------
`,f=i(process.env.CHATBOT_TABLE_SAMPLE_LIMIT,50),p=i(process.env.CHATBOT_COLUMN_SAMPLE_LIMIT,50);async function a(e){let{userId:t,organizationId:n,datasourceId:r,database:a,table:o,tableSampleLimit:i=f,columnSampleLimit:u=p}=e;try{let{entry:e,config:h}=await (0,s.ensureConnectionPoolForUser)(t,n,r,null),g=e.instance,_=await c(g,h.database,a,o);if(!_)return null;let y=l(i,f),b=l(u,p),S=[];if(S.push(`Current database: ${_}`),S.push("Below are representative tables and columns for context; this is not a complete list."),S.push(""),o){let e=await d(g,_,o,b);if(S.push(`Table: ${o}`),e.length>0)for(let t of(S.push(`Column examples (up to ${Math.min(b,e.length)}):`),e))S.push(`- ${m(t)}`);else S.push("- <no column info found>")}else{let e=g.capabilities.metadata;if(!e)return null;let t=await e.getTables(_);if(t&&0!==t.length){let e=t.slice(0,y);S.push(`Sample tables (up to ${Math.min(y,t.length)}):`);let n=e.map(async e=>{let t=e.value||e.label;if(!t)return null;let n=e.database||_,s=await d(g,n,t,b),r=[];if(r.push(`- Table: ${t}`),s.length>0)for(let e of s)r.push(`    • ${m(e)}`);else r.push("    • <no column info found>");return r.join("\n")});for(let e of(await Promise.all(n)))e&&S.push(e)}else S.push("No tables found.")}return S.push(""),S.push("Please write SQL and answer based on the real schema above."),S.push("If the schema is insufficient to support a field or table, say you are not sure rather than guessing."),S.join("\n")}catch(e){return console.error("[chat] failed to build schema context",e),null}}async function o(e){let{userId:t,organizationId:n,datasourceId:r,database:a,schema:o,tables:i,columnSampleLimit:h=p}=e;if(!i.length)return null;try{let{entry:e,config:g}=await (0,s.ensureConnectionPoolForUser)(t,n,r,null),_=e.instance,y=l(h,p),b=function(e){let t=new Set,n=[];for(let s of e){let e=s.name?.trim();if(!e)continue;let r=s.database?.trim()||null,a=s.schema?.trim()||null,o=`${r??""}:${a??""}:${e}`;t.has(o)||(t.add(o),n.push({database:r,schema:a,name:e}))}return n}(i),S=[];for(let e of(S.push("Below are the real columns for the tables referenced by the current SQL."),S.push("Use only these columns unless the schema is clearly incomplete."),S.push(""),b)){var f;let t=e.database?.trim()||await c(_,g.database,a,(f=e,u(f))),n=u({...e,schema:e.schema?.trim()||o?.trim()||null});if(S.push(`Table: ${t?`${t}.`:""}${n}`),!t){S.push("- <database could not be resolved>"),S.push("");continue}let s=await d(_,t,n,y);if(s.length>0)for(let e of(S.push(`Column examples (up to ${Math.min(y,s.length)}):`),s))S.push(`- ${m(e)}`);else S.push("- <no column info found>");S.push("")}return S.push("If a referenced field is not listed here, do not invent it."),S.join("\n")}catch(e){return console.error("[copilot-action] failed to build schema context for tables",e),null}}function i(e,t){let n=Number(e);return Number.isFinite(n)&&n>0?Math.floor(n):t}function l(e,t){return"number"==typeof e&&Number.isFinite(e)&&e>0?Math.floor(e):t}function u(e){let t=e.schema?.trim(),n=e.name.trim();return t&&"public"!==t?`${t}.${n}`:n}async function c(e,t,n,s){let r=n?.trim();if(r)return r;if(s){let n=e.capabilities.metadata;if(!n)return t?.trim()||void 0;let r=(await n.getTables()).find(e=>e.value===s||e.label===s);if(r?.database?.trim())return r.database.trim()}if(t?.trim())return t.trim();let a=e.capabilities.metadata;if(!a)return;let o=await a.getDatabases();return o[0]?.value}async function d(e,t,n,s){if(!t||!n)return[];let r=e.capabilities.metadata;if(!r?.getTableColumns)return[];try{let e=await r.getTableColumns(t,n),a=Number.isFinite(s)&&s>0?Math.floor(s):e.length;return e.slice(0,a)}catch(e){return console.error("[chat] failed to fetch columns",{database:t,table:n,error:e}),[]}}function m(e){let t=e.columnName||"<unknown>",n=e.columnType||"unknown",s=e.isPrimaryKey?" (primary key)":"",r=e.comment?.trim()?`, comment: ${e.comment.trim()}`:"";return`${t} ${n}${s}${r}`}e.s(["SCHEMA_PROMPT",0,h,"buildSchemaContext",0,a,"buildSchemaContextForTables",0,o,"getDefaultSchemaSampleLimits",0,function(){return{table:f,column:p}}]),n()}catch(e){n(e)}},!1),484616,e=>{"use strict";let t=`
You are a data assistant. When possible, cite retrieved snippets.
If unsure, say "I am not sure" explicitly and do not fabricate.
Keep responses structured (bullets/steps/code blocks).
When available, prefer using the ragSearch tool.
`;e.s(["SYSTEM_PROMPT",0,t])},391726,e=>{"use strict";e.s(["MAX_HISTORY_MESSAGES",0,16])},804303,e=>{"use strict";var t=e.i(93885);e.s(["buildToAggregationPrompt",0,function(e){let n=e.dialect??"unknown",s=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",a=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior data analyst. Your goal is to convert SQL into an aggregated version by dimensions for charts/metrics.

${a}

Constraints (must follow):
- Keep the original filters, time range, and JOIN logic; do not introduce non-existent tables/columns/functions
- Prefer 1-3 group dimensions: time fields bucketed by day/week/month; categorical fields like status/region
- Metrics must be numeric/countable; use SUM/COUNT/AVG/MAX/MIN; if no suitable metric, return the original SQL and set risk to "high"
- Do not generate DML/DDL or add EXPLAIN/ANALYZE
- Result row count should be manageable; keep reasonable LIMIT/ORDER BY if needed
- If the original query is already aggregated, you may do a light normalization if semantics stay equivalent; if unsure, return the original SQL and explain with risk set to "high"

Engine/Dialect: ${n}
Database: ${s}
${e.schemaContext?`
Real schema context:
${e.schemaContext}
`:""}

Original SQL:
\`\`\`sql
${e.sql}
\`\`\`

${r}

You must output JSON only (no markdown, no code fences), in this format:
{
  "title": "...",
  "explanation": "...",
  "fixedSql": "...",
  "risk": "low|medium|high"
}
`}])},391036,e=>{"use strict";var t=e.i(93885);e.s(["buildFixSqlErrorPrompt",0,function(e){let n=e.dialect??"unknown",s=e.database??"",r=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database expert. Your goal is to fix this failed SQL while keeping changes minimal.

${r}

Constraints (must follow):
- Make the minimal change required for the query to run
- Do not do performance optimization or style rewrites (do not convert comma joins to ANSI joins unless required)
- Do not introduce non-existent tables/columns/functions
- If you cannot determine a fix, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${s}
${e.schemaContext?`
Real schema context:
${e.schemaContext}
`:""}

Original SQL:
\`\`\`sql
${e.sql}
\`\`\`

Error message:
${e.error?.message??""}

You must output JSON only (no markdown, no code fences), in this format:
{
  "title": "...",
  "explanation": "...",
  "fixedSql": "...",
  "risk": "low|medium|high"
}
`}])},743154,e=>{"use strict";var t=e.i(93885);e.s(["buildOptimizePerformancePrompt",0,function(e){let n=e.dialect??"unknown",s=e.database??"",r=e.error?.message??"",a=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database performance expert. Your goal is to improve SQL performance without changing results.

${a}

Constraints (must follow):
- Keep results equivalent: rows/aggregations/order must not change
- Make only small necessary changes; avoid major rewrites
- Do not introduce non-existent tables/columns/indexes, do not add EXPLAIN/ANALYZE, do not generate DML (INSERT/UPDATE/DELETE)
- Prefer reducing full scans, repeated subqueries, and unnecessary computation; consolidate reusable filters
- If you are unsure, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${s}
${e.schemaContext?`
Real schema context:
${e.schemaContext}
`:""}

Original SQL:
\`\`\`sql
${e.sql}
\`\`\`

${r?`Recent error/hint: ${r}`:""}

You must output JSON only (no markdown, no code fences), in this format:
{
  "title": "...",
  "explanation": "...",
  "fixedSql": "...",
  "risk": "low|medium|high"
}
`}])},373394,e=>{"use strict";var t=e.i(93885);e.s(["buildRewriteSqlPrompt",0,function(e){let n=e.dialect??"unknown",s=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",a=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database engineer. Your goal is to rewrite SQL for clarity while keeping results equivalent.

${a}

Constraints (must follow):
- Result equivalence: returned rows/columns/order must match the original SQL
- Focus on readability/maintainability: clearer JOINs, consistent aliases, reasonable CTEs, remove unnecessary nesting
- Do not introduce non-existent tables/columns/functions, do not add EXPLAIN/ANALYZE, do not generate DML (INSERT/UPDATE/DELETE)
- If you cannot determine a better rewrite, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${s}
${e.schemaContext?`
Real schema context:
${e.schemaContext}
`:""}

Original SQL:
\`\`\`sql
${e.sql}
\`\`\`

${r}

You must output JSON only (no markdown, no code fences), in this format:
{
  "title": "...",
  "explanation": "...",
  "fixedSql": "...",
  "risk": "low|medium|high"
}
`}])},370990,e=>{"use strict";var t=e.i(93885);e.s(["buildTabTitlePrompt",0,function(e){let{sql:n,database:s,locale:r}=e;return["You are a SQL console naming assistant. Generate a short, readable title for the SQL tab.",(0,t.getPromptLanguageLine)(r),"Requirements:","- Max 15 characters; shorter is better.","- No quotes, no newlines, output the title only.","- Name based on SQL semantics, for example:","  SELECT * FROM users LIMIT 100  => User list","  SELECT count(*) FROM orders WHERE status = 'PAID' => Paid order count","  SELECT * FROM events WHERE event_date >= today() - 7 => Events in last 7 days","",s?`Current database: ${s}`:"","","SQL to analyze:",n].filter(Boolean).join("\n")}])},921742,e=>{"use strict";let t=`
When the user asks for data queries, first generate a read-only SQL statement (SELECT only) and call the sqlRunner tool. In your response, include the SQL and explain the query results.
`;e.s(["CHART_BUILDER_GUIDE",0,`
About charts and the chartBuilder tool

- When the user asks for charts, visualization, trends, dashboards, or charts, do:
  1) Use sqlRunner to fetch query results (SELECT only).
  2) After getting results, call chartBuilder to produce the chart config.

- When generating chart config:
  - Choose an appropriate chartType (bar / line / area / pie) and provide a data array.
  - Specify xKey (time field or category), and yKeys array (each with key and optional label/color); if there is only one metric, use valueKey.
  - If the query returns many columns, select or reshape to what the chart needs, do not dump all columns into the chart.
  - After generating the chart, explain in natural language:
    - What the x/y axes represent;
    - Trends or comparisons;
    - What the user can conclude or learn.
`.trim(),"SQL_RUNNER_GUIDE",0,`
About the sqlRunner tool

- For questions related to data querying, aggregation, reporting, metrics, monitoring, or comparisons, follow these steps:
  1) Based on the current database context (database / table / schema), write read-only SQL for ClickHouse or the data warehouse (prefer SELECT).
  2) If table structure is unclear, generate DESCRIBE / SHOW statements and use sqlRunner to inspect schema before writing the final query.
  3) Call sqlRunner to execute the SQL.
  4) Analyze results using previewRows, columns, rowCount, hasMore, and explain what the data indicates.
     - If hasMore=true, note that only a sample is shown and conclusions are based on the sample.

- If sqlRunner returns ok=false:
  - If the error says the SQL is not read-only, do not retry with sqlRunner. Tell the user the SQL must be executed manually in the SQL editor or console.
  - Read error.message and error.code to determine syntax issues, missing tables/columns, or other errors.
  - Try to fix the SQL using the error hints and retry up to 2 times.
  - If it still fails, be honest about the cause and suggest next steps (e.g., check table names, column names, time ranges).

- Do not fabricate query results. If the query cannot be executed or data is insufficient, say you are not sure or that there is not enough data.
`.trim(),"SQL_TOOL_INSTRUCTION",0,t])},620,e=>{"use strict";e.s(["CHART_BUILDER_TOOL_DESCRIPTION",0,"Return a chart configuration based on the provided data.\n\nUsage:\n1. Specify chartType (bar/line/area/pie).\n2. data is an array of query result rows.\n3. If you are unsure about xKey / yKeys / categoryKey / valueKey, leave them empty and the tool will infer:\n   - Line/area: prefer a time field for x, numeric fields for y.\n   - Bar: prefer a category field for x, numeric fields for y.\n   - Pie: choose one category field as categoryKey and one numeric field as valueKey.\n4. The tool infers time/numeric/category columns and sets options.xKeyType/sortBy when appropriate."])},622846,e=>e.a(async(t,n)=>{try{e.i(391726);var s=e.i(721117),r=e.i(484616),a=e.i(281167),o=e.i(132942),i=e.i(966181),l=e.i(804303),u=e.i(391036),c=e.i(743154),d=e.i(373394),m=e.i(370990),h=e.i(921742),f=e.i(620),p=t([s]);[s]=p.then?(await p)():p,r.SYSTEM_PROMPT,s.SCHEMA_PROMPT,a.buildSchemaExplanationPrompt,o.buildColumnTaggingPrompt,i.buildTableSummaryPrompt,l.buildToAggregationPrompt,u.buildFixSqlErrorPrompt,c.buildOptimizePerformancePrompt,d.buildRewriteSqlPrompt,m.buildTabTitlePrompt,h.SQL_TOOL_INSTRUCTION,h.SQL_RUNNER_GUIDE,h.CHART_BUILDER_GUIDE,f.CHART_BUILDER_TOOL_DESCRIPTION,e.s([]),n()}catch(e){n(e)}},!1),791368,e=>{"use strict";e.s(["isPostgresFamilyConnectionType",0,function(e){return"postgres"===e||"neon"===e}])},52974,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__0euvgz4._.js"].map(t=>e.l(t))).then(()=>t(748867)))},192538,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_dt-sql-parser_dist_index_0uxqxw0.js"].map(t=>e.l(t))).then(()=>t(285782)))},967030,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@vercel_oidc_dist_0srtcxg._.js"].map(t=>e.l(t))).then(()=>t(783697)))},683671,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@vercel_oidc_dist_0-rx1bm._.js"].map(t=>e.l(t))).then(()=>t(390391)))},903237,e=>{e.v(e=>Promise.resolve().then(()=>e(503815)))},929114,e=>{e.v(e=>Promise.resolve().then(()=>e(865740)))},563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},998367,e=>{e.v(t=>Promise.all(["server/chunks/0t6k_@better-auth_kysely-adapter_dist_bun-sqlite-dialect-C8OaCWSL_mjs_0duzuha._.js"].map(t=>e.l(t))).then(()=>t(35908)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_node-sqlite-dialect_mjs_036w40n._.js"].map(t=>e.l(t))).then(()=>t(689127)))},873138,e=>{e.v(t=>Promise.all(["server/chunks/0_lp_modules_@better-auth_kysely-adapter_dist_d1-sqlite-dialect-sYHNqBte_mjs_01w3w0i._.js"].map(t=>e.l(t))).then(()=>t(661871)))},299302,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_node_dns_promises_11l6s5x._.js"].map(t=>e.l(t))).then(()=>t(300794)))},606630,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_crypto_index_mjs_088ibmc._.js"].map(t=>e.l(t))).then(()=>t(110352)))},406693,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__0t8xdq1._.js","server/chunks/node_modules_04d~.79._.js"].map(t=>e.l(t))).then(()=>t(701631)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__00e228u._.js.map