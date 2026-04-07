module.exports=[484199,(e,t,n)=>{"use strict";var a=Object.defineProperty,r=Object.getOwnPropertyDescriptor,o=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,s={},l={VercelOidcTokenError:()=>c};for(var u in l)a(s,u,{get:l[u],enumerable:!0});t.exports=((e,t,n)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let s of o(t))i.call(e,s)||void 0===s||a(e,s,{get:()=>t[s],enumerable:!(n=r(t,s))||n.enumerable});return e})(a({},"__esModule",{value:!0}),s);class c extends Error{constructor(e,t){super(e),this.name="VercelOidcTokenError",this.cause=t}toString(){return this.cause?`${this.name}: ${this.message}: ${this.cause}`:`${this.name}: ${this.message}`}}},772685,e=>{"use strict";var t=e.i(709134),n=e.i(453070);let a=["content-type","cookie","authorization","x-connection-id","accept-language","origin","referer","user-agent"];function r(e,t){let n=new Headers;for(let t of a){let a=e.headers.get(t);a&&n.set(t,a)}if(n.delete("host"),n.delete("connection"),t){let e=new URL(t).origin;n.has("origin")&&n.set("origin",e);let a=n.get("referer");if(a)try{let t=new URL(a);n.set("referer",e+t.pathname+t.search)}catch{n.delete("referer")}}let r=n.get("cookie");return r&&n.set("cookie",function(e){let t=e.split(";").map(e=>e.trim()).filter(Boolean),n=t.some(e=>e.startsWith("better-auth.session_token=")),a=t.some(e=>e.startsWith("__Secure-better-auth.session_token=")),r=[...t];if(n&&!a){let e=t.find(e=>e.startsWith("better-auth.session_token="));e&&r.push(e.replace("better-auth.session_token=","__Secure-better-auth.session_token="))}return r.join("; ")}(r)),n}async function o(e,a,o){if(!t.USE_CLOUD_AI)return null;let i=(0,n.getCloudApiBaseUrl)();if(!i)return new Response("CLOUD_API_NOT_CONFIGURED",{status:500,headers:{"Content-Type":"text/plain; charset=utf-8"}});let s=null;try{s=new URL(e.url).origin}catch{s=null}let l=new URL(a,i);if(s&&l.origin===s)return new Response("CLOUD_API_URL_MUST_DIFFER_FROM_LOCAL_ORIGIN",{status:500,headers:{"Content-Type":"text/plain; charset=utf-8"}});let u=e.method.toUpperCase(),c="GET"!==u&&"HEAD"!==u?o&&"body"in o?JSON.stringify(o.body):await e.text():void 0,m=await fetch(l.toString(),{method:u,headers:r(e,i),body:c}),h=new Headers(m.headers);return h.delete("content-encoding"),h.delete("content-length"),new Response(m.body,{status:m.status,statusText:m.statusText,headers:h})}e.s(["buildCloudForwardHeaders",0,r,"proxyAiRouteIfNeeded",0,o])},572938,e=>{"use strict";var t=e.i(832969),n=e.i(859233);function a(...e){return e.filter(Boolean).join("\n")}e.s(["compileSystemPrompt",0,function(e){if(!e)return;let r="auto"===e.language?"Ai.SystemLanguage.Auto":"en"===e.language?"Ai.SystemLanguage.En":"zh"===e.language?"Ai.SystemLanguage.Zh":void 0,o=r?(0,t.translate)(n.routing.defaultLocale,r):void 0,i="json"===e.output.kind?a("Output format: JSON string only (no Markdown, no code fences, no extra text).",e.output.strict?"Must be strict JSON parseable by JSON.parse.":void 0,e.output.schemaHint?`JSON schema hint: ${e.output.schemaHint}`:void 0):"Output format: plain text only (no explanations, no prefixes/suffixes).";return a(e.persona?`You are: ${e.persona}`:void 0,o,i,e.rules&&e.rules.length?["Rules:",...e.rules.map(e=>`- ${e}`)].join("\n"):void 0,e.notes&&e.notes.length?["Notes:",...e.notes.map(e=>`- ${e}`)].join("\n"):void 0)}])},93885,e=>{"use strict";var t=e.i(832969),n=e.i(859233);e.s(["getPromptLanguageLine",0,function(e){let a=e??n.routing.defaultLocale;return(0,t.translate)(a,"Ai.PromptLanguage")}])},281167,e=>{"use strict";var t=e.i(93885);e.s(["buildSchemaExplanationPrompt",0,function(e){let{columns:n,dbType:a,database:r,table:o,locale:i}=e;return["You are a schema explanation assistant. Write a short explanation (15-25 words) for each column.",(0,t.getPromptLanguageLine)(i),'Output format: {"columns":[{"name":"column","semanticSummary":"summary"}]} and output JSON only (no Markdown or extra text).',a?`Database type: ${a}`:"",r?`Database: ${r}`:"",o?`Table: ${o}`:"","Columns:",...n.map(e=>{let t=e.comment?`, comment: ${e.comment}`:"";return`- ${e.name} (type: ${e.type??"unknown"}${t})`})].filter(Boolean).join("\n")}])},132942,e=>{"use strict";var t=e.i(93885);e.s(["buildColumnTaggingPrompt",0,function(e){let{columns:n,dbType:a,database:r,table:o,locale:i}=e;return["You are a schema tagging assistant. Provide 2-4 short tags and one short description for each column.",(0,t.getPromptLanguageLine)(i),"Example tags: primary key, identifier, time, dimension, amount, status, enum, low-cardinality, boolean, geo, JSON, array.","Output must be JSON with a columns array, each item like:",'{ "name": "column", "semanticTags": ["tag1","tag2"], "semanticSummary": "one sentence" }',"Output JSON only (no Markdown, no code fences, no extra text).",a?`Database type: ${a}`:"",r?`Database: ${r}`:"",o?`Table: ${o}`:"","Columns:",...n.map(e=>{let t=e.comment?`, comment: ${e.comment}`:"";return`- ${e.name} (type: ${e.type??"unknown"}${t})`})].filter(Boolean).join("\n")}])},966181,e=>{"use strict";var t=e.i(832969),n=e.i(93885);function a(e){let n=e.slice(0,60);return{lines:n.map(e=>{let n=function(e){let n=(void 0)??(0,t.translate)((void 0)??"zh","Utils.FormatType.Unknown");if(!e)return n;let a=e;return a.replace(/Enum\d*\([^)]*\)/gi,"Enum")}(e.type),a=(e.semanticTags||[]).join(","),r=[];if(r.push(`name=${e.name}`),r.push(`type=${n}`),a&&r.push(`tags=${a}`),e.comment){let t=e.comment.length>80?e.comment.slice(0,80)+"...":e.comment;r.push(`comment=${t}`)}return"- "+r.join(" | ")}),usedCount:n.length}}e.s(["buildColumnLinesForPrompt",0,a,"buildTableSummaryPrompt",0,function(e){let{dbType:t,database:r,table:o,properties:i,columns:s,locale:l}=e,u=(0,n.getPromptLanguageLine)(l),c=i?[i.engine?`Engine: ${i.engine}`:"",i.primaryKey?`Primary key: ${i.primaryKey}`:"",i.partitionKey?`Partition key: ${i.partitionKey}`:"",i.comment?`Comment: ${i.comment}`:""].filter(Boolean).join("\n"):"",{lines:m,usedCount:h}=a(s);return["You are a table summary assistant. Return a JSON object with:","- summary: 40-80 words, describing table purpose and key fields","- detail: 150-260 words, covering business context, typical queries, time/partition meaning, write patterns","- highlights: 3-6 items, each { field, description }, field must come from the input column list","- snippets: 3-5 items, each { title, sql }, sql must be executable",u,"Output JSON only (no code fences or extra text).","Prefer primary keys, time fields, partition fields, geo fields, and core metrics for highlights.","SQL snippets should be diverse: basic query, filter/aggregation, grouped stats, time filter, geo/partition example when relevant.",t?`Database type: ${t}`:"",r?`Database: ${r}`:"",o?`Table: ${o}`:"",c?`Table properties:
${c}`:"","Columns:",...m,s.length>h?`(The remaining ${s.length-h} columns are omitted for brevity.)`:""].filter(Boolean).join("\n")}],966181)},721117,e=>e.a(async(t,n)=>{try{var a=e.i(781598),r=t([a]);[a]=r.then?(await r)():r;let d=`
--- Database Context ---
{schema}
-----------------------
`,p=s(process.env.CHATBOT_TABLE_SAMPLE_LIMIT,50),f=s(process.env.CHATBOT_COLUMN_SAMPLE_LIMIT,50);async function o(e){let{userId:t,organizationId:n,datasourceId:r,database:o,table:i,tableSampleLimit:s=p,columnSampleLimit:u=f}=e;try{let{entry:e,config:d}=await (0,a.ensureConnectionPoolForUser)(t,n,r,null),g=e.instance,y=await c(g,d.database,o,i);if(!y)return null;let b=l(s,p),S=l(u,f),L=[];if(L.push(`Current database: ${y}`),L.push("Below are representative tables and columns for context; this is not a complete list."),L.push(""),i){let e=await m(g,y,i,S);if(L.push(`Table: ${i}`),e.length>0)for(let t of(L.push(`Column examples (up to ${Math.min(S,e.length)}):`),e))L.push(`- ${h(t)}`);else L.push("- <no column info found>")}else{let e=g.capabilities.metadata;if(!e)return null;let t=await e.getTables(y);if(t&&0!==t.length){let e=t.slice(0,b);L.push(`Sample tables (up to ${Math.min(b,t.length)}):`);let n=e.map(async e=>{let t=e.value||e.label;if(!t)return null;let n=e.database||y,a=await m(g,n,t,S),r=[];if(r.push(`- Table: ${t}`),a.length>0)for(let e of a)r.push(`    • ${h(e)}`);else r.push("    • <no column info found>");return r.join("\n")});for(let e of(await Promise.all(n)))e&&L.push(e)}else L.push("No tables found.")}return L.push(""),L.push("Please write SQL and answer based on the real schema above."),L.push("If the schema is insufficient to support a field or table, say you are not sure rather than guessing."),L.join("\n")}catch(e){return console.error("[chat] failed to build schema context",e),null}}async function i(e){let{userId:t,organizationId:n,datasourceId:r,database:o,schema:i,tables:s,columnSampleLimit:d=f}=e;if(!s.length)return null;try{let{entry:e,config:g}=await (0,a.ensureConnectionPoolForUser)(t,n,r,null),y=e.instance,b=l(d,f),S=function(e){let t=new Set,n=[];for(let a of e){let e=a.name?.trim();if(!e)continue;let r=a.database?.trim()||null,o=a.schema?.trim()||null,i=`${r??""}:${o??""}:${e}`;t.has(i)||(t.add(i),n.push({database:r,schema:o,name:e}))}return n}(s),L=[];for(let e of(L.push("Below are the real columns for the tables referenced by the current SQL."),L.push("Use only these columns unless the schema is clearly incomplete."),L.push(""),S)){var p;let t=e.database?.trim()||await c(y,g.database,o,(p=e,u(p))),n=u({...e,schema:e.schema?.trim()||i?.trim()||null});if(L.push(`Table: ${t?`${t}.`:""}${n}`),!t){L.push("- <database could not be resolved>"),L.push("");continue}let a=await m(y,t,n,b);if(a.length>0)for(let e of(L.push(`Column examples (up to ${Math.min(b,a.length)}):`),a))L.push(`- ${h(e)}`);else L.push("- <no column info found>");L.push("")}return L.push("If a referenced field is not listed here, do not invent it."),L.join("\n")}catch(e){return console.error("[copilot-action] failed to build schema context for tables",e),null}}function s(e,t){let n=Number(e);return Number.isFinite(n)&&n>0?Math.floor(n):t}function l(e,t){return"number"==typeof e&&Number.isFinite(e)&&e>0?Math.floor(e):t}function u(e){let t=e.schema?.trim(),n=e.name.trim();return t&&"public"!==t?`${t}.${n}`:n}async function c(e,t,n,a){let r=n?.trim();if(r)return r;if(a){let n=e.capabilities.metadata;if(!n)return t?.trim()||void 0;let r=(await n.getTables()).find(e=>e.value===a||e.label===a);if(r?.database?.trim())return r.database.trim()}if(t?.trim())return t.trim();let o=e.capabilities.metadata;if(!o)return;let i=await o.getDatabases();return i[0]?.value}async function m(e,t,n,a){if(!t||!n)return[];let r=e.capabilities.metadata;if(!r?.getTableColumns)return[];try{let e=await r.getTableColumns(t,n),o=Number.isFinite(a)&&a>0?Math.floor(a):e.length;return e.slice(0,o)}catch(e){return console.error("[chat] failed to fetch columns",{database:t,table:n,error:e}),[]}}function h(e){let t=e.columnName||"<unknown>",n=e.columnType||"unknown",a=e.isPrimaryKey?" (primary key)":"",r=e.comment?.trim()?`, comment: ${e.comment.trim()}`:"";return`${t} ${n}${a}${r}`}e.s(["SCHEMA_PROMPT",0,d,"buildSchemaContext",0,o,"buildSchemaContextForTables",0,i,"getDefaultSchemaSampleLimits",0,function(){return{table:p,column:f}}]),n()}catch(e){n(e)}},!1),484616,e=>{"use strict";let t=`
You are a data assistant. When possible, cite retrieved snippets.
If unsure, say "I am not sure" explicitly and do not fabricate.
Keep responses structured (bullets/steps/code blocks).
When available, prefer using the ragSearch tool.
`;e.s(["SYSTEM_PROMPT",0,t])},391726,e=>{"use strict";e.s(["MAX_HISTORY_MESSAGES",0,16])},804303,e=>{"use strict";var t=e.i(93885);e.s(["buildToAggregationPrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",o=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior data analyst. Your goal is to convert SQL into an aggregated version by dimensions for charts/metrics.

${o}

Constraints (must follow):
- Keep the original filters, time range, and JOIN logic; do not introduce non-existent tables/columns/functions
- Prefer 1-3 group dimensions: time fields bucketed by day/week/month; categorical fields like status/region
- Metrics must be numeric/countable; use SUM/COUNT/AVG/MAX/MIN; if no suitable metric, return the original SQL and set risk to "high"
- Do not generate DML/DDL or add EXPLAIN/ANALYZE
- Result row count should be manageable; keep reasonable LIMIT/ORDER BY if needed
- If the original query is already aggregated, you may do a light normalization if semantics stay equivalent; if unsure, return the original SQL and explain with risk set to "high"

Engine/Dialect: ${n}
Database: ${a}
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
`}])},391036,e=>{"use strict";var t=e.i(93885);e.s(["buildFixSqlErrorPrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database expert. Your goal is to fix this failed SQL while keeping changes minimal.

${r}

Constraints (must follow):
- Make the minimal change required for the query to run
- Do not do performance optimization or style rewrites (do not convert comma joins to ANSI joins unless required)
- Do not introduce non-existent tables/columns/functions
- If you cannot determine a fix, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${a}
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
`}])},743154,e=>{"use strict";var t=e.i(93885);e.s(["buildOptimizePerformancePrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message??"",o=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database performance expert. Your goal is to improve SQL performance without changing results.

${o}

Constraints (must follow):
- Keep results equivalent: rows/aggregations/order must not change
- Make only small necessary changes; avoid major rewrites
- Do not introduce non-existent tables/columns/indexes, do not add EXPLAIN/ANALYZE, do not generate DML (INSERT/UPDATE/DELETE)
- Prefer reducing full scans, repeated subqueries, and unnecessary computation; consolidate reusable filters
- If you are unsure, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${a}
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
`}])},373394,e=>{"use strict";var t=e.i(93885);e.s(["buildRewriteSqlPrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",o=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database engineer. Your goal is to rewrite SQL for clarity while keeping results equivalent.

${o}

Constraints (must follow):
- Result equivalence: returned rows/columns/order must match the original SQL
- Focus on readability/maintainability: clearer JOINs, consistent aliases, reasonable CTEs, remove unnecessary nesting
- Do not introduce non-existent tables/columns/functions, do not add EXPLAIN/ANALYZE, do not generate DML (INSERT/UPDATE/DELETE)
- If you cannot determine a better rewrite, return the original SQL and set risk to "high" with an explanation

Engine/Dialect: ${n}
Database: ${a}
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
`}])},370990,e=>{"use strict";var t=e.i(93885);e.s(["buildTabTitlePrompt",0,function(e){let{sql:n,database:a,locale:r}=e;return["You are a SQL console naming assistant. Generate a short, readable title for the SQL tab.",(0,t.getPromptLanguageLine)(r),"Requirements:","- Max 15 characters; shorter is better.","- No quotes, no newlines, output the title only.","- Name based on SQL semantics, for example:","  SELECT * FROM users LIMIT 100  => User list","  SELECT count(*) FROM orders WHERE status = 'PAID' => Paid order count","  SELECT * FROM events WHERE event_date >= today() - 7 => Events in last 7 days","",a?`Current database: ${a}`:"","","SQL to analyze:",n].filter(Boolean).join("\n")}])},921742,e=>{"use strict";let t=`
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
`.trim(),"SQL_TOOL_INSTRUCTION",0,t])},620,e=>{"use strict";e.s(["CHART_BUILDER_TOOL_DESCRIPTION",0,"Return a chart configuration based on the provided data.\n\nUsage:\n1. Specify chartType (bar/line/area/pie).\n2. data is an array of query result rows.\n3. If you are unsure about xKey / yKeys / categoryKey / valueKey, leave them empty and the tool will infer:\n   - Line/area: prefer a time field for x, numeric fields for y.\n   - Bar: prefer a category field for x, numeric fields for y.\n   - Pie: choose one category field as categoryKey and one numeric field as valueKey.\n4. The tool infers time/numeric/category columns and sets options.xKeyType/sortBy when appropriate."])},622846,e=>e.a(async(t,n)=>{try{e.i(391726);var a=e.i(721117),r=e.i(484616),o=e.i(281167),i=e.i(132942),s=e.i(966181),l=e.i(804303),u=e.i(391036),c=e.i(743154),m=e.i(373394),h=e.i(370990),d=e.i(921742),p=e.i(620),f=t([a]);[a]=f.then?(await f)():f,r.SYSTEM_PROMPT,a.SCHEMA_PROMPT,o.buildSchemaExplanationPrompt,i.buildColumnTaggingPrompt,s.buildTableSummaryPrompt,l.buildToAggregationPrompt,u.buildFixSqlErrorPrompt,c.buildOptimizePerformancePrompt,m.buildRewriteSqlPrompt,h.buildTabTitlePrompt,d.SQL_TOOL_INSTRUCTION,d.SQL_RUNNER_GUIDE,d.CHART_BUILDER_GUIDE,p.CHART_BUILDER_TOOL_DESCRIPTION,e.s([]),n()}catch(e){n(e)}},!1)];

//# sourceMappingURL=_0glhkvp._.js.map