module.exports=[709134,e=>{"use strict";let t=(0,e.i(689452).isDesktopRuntime)();e.s(["USE_CLOUD_AI",0,t,"X_CONNECTION_ID_KEY",0,"X-Connection-ID"])},951615,(e,t,n)=>{t.exports=e.x("node:buffer",()=>require("node:buffer"))},504446,(e,t,n)=>{t.exports=e.x("net",()=>require("net"))},755004,(e,t,n)=>{t.exports=e.x("tls",()=>require("tls"))},781598,e=>e.a(async(t,n)=>{try{var a=e.i(89171),r=e.i(379931),s=e.i(975795),o=e.i(276688),i=e.i(468291),l=e.i(951834),u=t([r,i]);[r,i]=u.then?(await u)():u;let p={notFound:"connection_not_found",missingHost:"missing_host",missingPath:"missing_path",missingUsername:"missing_username",missingIdentity:"missing_identity",missingPassword:"missing_password",missingIdentityInfo:"missing_identity_info",missingSshPassword:"missing_ssh_password",missingSshPrivateKey:"missing_ssh_private_key"};function c(e){let t=Error(e);return t.code=e,t}function d(e){if(e&&"object"==typeof e&&"code"in e){let t=e.code;if("string"==typeof t)return t}if(e instanceof Error){let t=e.message;if(Object.values(p).includes(t))return t}return null}async function h(e){let t=await (0,i.getDatasourcePool)(e.id);return t&&(e.configVersion&&t.config.configVersion!==e.configVersion||e.updatedAt&&t.config.updatedAt!==e.updatedAt)&&await (0,i.destroyDatasourcePool)(e.id),(0,i.ensureDatasourcePool)(e)}async function m(e,t,n,a){let s=await (0,r.getDBService)(),o=await s.connections.getById(t,n);if(!o)throw c(p.notFound);let i=(0,l.pickConnectionIdentity)(o.identities,a??null);if(!i)throw c(p.missingIdentity);let u=i.id?await s.connections.getIdentityPlainPassword(t,i.id):null,d=await s.connections.getSshPlainSecrets(t,o.connection.id),m=o.ssh?{...o.ssh,...d??{}}:d?{enabled:!0,...d}:null,f=(0,l.buildStoredConnectionConfig)(o.connection,{...i,password:u},m,e=>c(e));return{entry:await h(f),config:f,identity:i}}e.s(["CONNECTION_ERROR_CODES",0,p,"createConnectionError",0,c,"ensureConnectionPoolForUser",0,m,"getConnectionErrorCode",0,d,"mapConnectionErrorToResponse",0,function(e,t){let n=d(e);return n===p.notFound?a.NextResponse.json(s.ResponseUtil.error({code:o.ErrorCodes.NOT_FOUND,message:t.notFound}),{status:404}):n===p.missingHost?a.NextResponse.json(s.ResponseUtil.error({code:o.ErrorCodes.INVALID_PARAMS,message:t.missingHost}),{status:400}):n===p.missingPath?a.NextResponse.json(s.ResponseUtil.error({code:o.ErrorCodes.INVALID_PARAMS,message:t.missingPath??t.fallback}),{status:400}):a.NextResponse.json(s.ResponseUtil.error({code:o.ErrorCodes.ERROR,message:t.fallback}),{status:500})}]),n()}catch(e){n(e)}},!1),721117,e=>e.a(async(t,n)=>{try{var a=e.i(781598),r=t([a]);[a]=r.then?(await r)():r;let m=`
--- Database Context ---
{schema}
-----------------------
`,p=i(process.env.CHATBOT_TABLE_SAMPLE_LIMIT,50),f=i(process.env.CHATBOT_COLUMN_SAMPLE_LIMIT,50);async function s(e){let{userId:t,organizationId:n,datasourceId:r,database:s,table:o,tableSampleLimit:i=p,columnSampleLimit:u=f}=e;try{let{entry:e,config:m}=await (0,a.ensureConnectionPoolForUser)(t,n,r,null),g=e.instance,y=await c(g,m.database,s,o);if(!y)return null;let b=l(i,p),_=l(u,f),w=[];if(w.push(`Current database: ${y}`),w.push("Below are representative tables and columns for context; this is not a complete list."),w.push(""),o){let e=await d(g,y,o,_);if(w.push(`Table: ${o}`),e.length>0)for(let t of(w.push(`Column examples (up to ${Math.min(_,e.length)}):`),e))w.push(`- ${h(t)}`);else w.push("- <no column info found>")}else{let e=g.capabilities.metadata;if(!e)return null;let t=await e.getTables(y);if(t&&0!==t.length){let e=t.slice(0,b);w.push(`Sample tables (up to ${Math.min(b,t.length)}):`);let n=e.map(async e=>{let t=e.value||e.label;if(!t)return null;let n=e.database||y,a=await d(g,n,t,_),r=[];if(r.push(`- Table: ${t}`),a.length>0)for(let e of a)r.push(`    • ${h(e)}`);else r.push("    • <no column info found>");return r.join("\n")});for(let e of(await Promise.all(n)))e&&w.push(e)}else w.push("No tables found.")}return w.push(""),w.push("Please write SQL and answer based on the real schema above."),w.push("If the schema is insufficient to support a field or table, say you are not sure rather than guessing."),w.join("\n")}catch(e){return console.error("[chat] failed to build schema context",e),null}}async function o(e){let{userId:t,organizationId:n,datasourceId:r,database:s,schema:o,tables:i,columnSampleLimit:m=f}=e;if(!i.length)return null;try{let{entry:e,config:g}=await (0,a.ensureConnectionPoolForUser)(t,n,r,null),y=e.instance,b=l(m,f),_=function(e){let t=new Set,n=[];for(let a of e){let e=a.name?.trim();if(!e)continue;let r=a.database?.trim()||null,s=a.schema?.trim()||null,o=`${r??""}:${s??""}:${e}`;t.has(o)||(t.add(o),n.push({database:r,schema:s,name:e}))}return n}(i),w=[];for(let e of(w.push("Below are the real columns for the tables referenced by the current SQL."),w.push("Use only these columns unless the schema is clearly incomplete."),w.push(""),_)){var p;let t=e.database?.trim()||await c(y,g.database,s,(p=e,u(p))),n=u({...e,schema:e.schema?.trim()||o?.trim()||null});if(w.push(`Table: ${t?`${t}.`:""}${n}`),!t){w.push("- <database could not be resolved>"),w.push("");continue}let a=await d(y,t,n,b);if(a.length>0)for(let e of(w.push(`Column examples (up to ${Math.min(b,a.length)}):`),a))w.push(`- ${h(e)}`);else w.push("- <no column info found>");w.push("")}return w.push("If a referenced field is not listed here, do not invent it."),w.join("\n")}catch(e){return console.error("[copilot-action] failed to build schema context for tables",e),null}}function i(e,t){let n=Number(e);return Number.isFinite(n)&&n>0?Math.floor(n):t}function l(e,t){return"number"==typeof e&&Number.isFinite(e)&&e>0?Math.floor(e):t}function u(e){let t=e.schema?.trim(),n=e.name.trim();return t&&"public"!==t?`${t}.${n}`:n}async function c(e,t,n,a){let r=n?.trim();if(r)return r;if(a){let n=e.capabilities.metadata;if(!n)return t?.trim()||void 0;let r=(await n.getTables()).find(e=>e.value===a||e.label===a);if(r?.database?.trim())return r.database.trim()}if(t?.trim())return t.trim();let s=e.capabilities.metadata;if(!s)return;let o=await s.getDatabases();return o[0]?.value}async function d(e,t,n,a){if(!t||!n)return[];let r=e.capabilities.metadata;if(!r?.getTableColumns)return[];try{let e=await r.getTableColumns(t,n),s=Number.isFinite(a)&&a>0?Math.floor(a):e.length;return e.slice(0,s)}catch(e){return console.error("[chat] failed to fetch columns",{database:t,table:n,error:e}),[]}}function h(e){let t=e.columnName||"<unknown>",n=e.columnType||"unknown",a=e.isPrimaryKey?" (primary key)":"",r=e.comment?.trim()?`, comment: ${e.comment.trim()}`:"";return`${t} ${n}${a}${r}`}e.s(["SCHEMA_PROMPT",0,m,"buildSchemaContext",0,s,"buildSchemaContextForTables",0,o,"getDefaultSchemaSampleLimits",0,function(){return{table:p,column:f}}]),n()}catch(e){n(e)}},!1),484616,e=>{"use strict";let t=`
You are a data assistant. When possible, cite retrieved snippets.
If unsure, say "I am not sure" explicitly and do not fabricate.
Keep responses structured (bullets/steps/code blocks).
When available, prefer using the ragSearch tool.
`;e.s(["SYSTEM_PROMPT",0,t])},391726,e=>{"use strict";e.s(["MAX_HISTORY_MESSAGES",0,16])},804303,e=>{"use strict";var t=e.i(93885);e.s(["buildToAggregationPrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",s=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior data analyst. Your goal is to convert SQL into an aggregated version by dimensions for charts/metrics.

${s}

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
`}])},743154,e=>{"use strict";var t=e.i(93885);e.s(["buildOptimizePerformancePrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message??"",s=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database performance expert. Your goal is to improve SQL performance without changing results.

${s}

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
`}])},373394,e=>{"use strict";var t=e.i(93885);e.s(["buildRewriteSqlPrompt",0,function(e){let n=e.dialect??"unknown",a=e.database??"",r=e.error?.message?`Recent error/hint: ${e.error.message}`:"",s=(0,t.getPromptLanguageLine)(e.locale);return`
You are a senior database engineer. Your goal is to rewrite SQL for clarity while keeping results equivalent.

${s}

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
`.trim(),"SQL_TOOL_INSTRUCTION",0,t])},620,e=>{"use strict";e.s(["CHART_BUILDER_TOOL_DESCRIPTION",0,"Return a chart configuration based on the provided data.\n\nUsage:\n1. Specify chartType (bar/line/area/pie).\n2. data is an array of query result rows.\n3. If you are unsure about xKey / yKeys / categoryKey / valueKey, leave them empty and the tool will infer:\n   - Line/area: prefer a time field for x, numeric fields for y.\n   - Bar: prefer a category field for x, numeric fields for y.\n   - Pie: choose one category field as categoryKey and one numeric field as valueKey.\n4. The tool infers time/numeric/category columns and sets options.xKeyType/sortBy when appropriate."])},622846,e=>e.a(async(t,n)=>{try{e.i(391726);var a=e.i(721117),r=e.i(484616),s=e.i(281167),o=e.i(132942),i=e.i(966181),l=e.i(804303),u=e.i(391036),c=e.i(743154),d=e.i(373394),h=e.i(370990),m=e.i(921742),p=e.i(620),f=t([a]);[a]=f.then?(await f)():f,r.SYSTEM_PROMPT,a.SCHEMA_PROMPT,s.buildSchemaExplanationPrompt,o.buildColumnTaggingPrompt,i.buildTableSummaryPrompt,l.buildToAggregationPrompt,u.buildFixSqlErrorPrompt,c.buildOptimizePerformancePrompt,d.buildRewriteSqlPrompt,h.buildTabTitlePrompt,m.SQL_TOOL_INSTRUCTION,m.SQL_RUNNER_GUIDE,m.CHART_BUILDER_GUIDE,p.CHART_BUILDER_TOOL_DESCRIPTION,e.s([]),n()}catch(e){n(e)}},!1),405753,e=>e.a(async(t,n)=>{try{var a=e.i(741063),r=e.i(452439),s=e.i(572938),o=e.i(622846),i=e.i(370990),l=e.i(796660),u=e.i(499542),c=e.i(709134),d=e.i(772685),h=t([a,o,u]);[a,o,u]=h.then?(await h)():h;let m=(0,u.withUserAndOrganizationHandler)(async({req:e,organizationId:t,userId:n})=>{try{let o=await (0,l.getApiLocale)(),u=await e.json(),{sql:h,database:m,model:p}=u,f=c.USE_CLOUD_AI,g=await (0,d.proxyAiRouteIfNeeded)(e,"/api/ai/tab-title",{body:c.USE_CLOUD_AI?{...u,model:null}:u});if(g)return g;let{model:y,preset:b,modelName:_}=(0,r.getEffectiveModelBundle)("title",f?null:p);if(!h||!h.trim())return new Response(JSON.stringify({title:null}),{status:400,headers:{"Content-Type":"application/json"}});let w=(0,i.buildTabTitlePrompt)({sql:h,database:m,locale:o}),{text:R}=await (0,a.generateText)({model:y,system:(0,s.compileSystemPrompt)(b.system)??"Return a concise title only, with no explanation.",prompt:w,temperature:b.temperature,context:{organizationId:t,userId:n,feature:"tab_title",model:_,provider:(process.env.DORY_AI_PROVIDER??"").trim().toLowerCase()||null}}),v=R.trim();return new Response(JSON.stringify({title:v}),{status:200,headers:{"Content-Type":"application/json"}})}catch(e){return console.error("[api/ai/tab-title] error:",e),new Response(JSON.stringify({title:null}),{status:500,headers:{"Content-Type":"application/json"}})}});e.s(["POST",0,m]),n()}catch(e){n(e)}},!1),535109,e=>e.a(async(t,n)=>{try{var a=e.i(747909),r=e.i(174017),s=e.i(996250),o=e.i(759756),i=e.i(561916),l=e.i(174677),u=e.i(869741),c=e.i(316795),d=e.i(487718),h=e.i(995169),m=e.i(47587),p=e.i(666012),f=e.i(570101),g=e.i(626937),y=e.i(10372),b=e.i(193695);e.i(52474);var _=e.i(600220),w=e.i(405753),R=t([w]);[w]=R.then?(await R)():R;let E=new a.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/ai/tab-title/route",pathname:"/api/ai/tab-title",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/apps/web/app/api/ai/tab-title/route.ts",nextConfigOutput:"standalone",userland:w,...{}}),{workAsyncStorage:S,workUnitAsyncStorage:x,serverHooks:C}=E;async function v(e,t,n){n.requestMeta&&(0,o.setRequestMeta)(e,n.requestMeta),E.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/ai/tab-title/route";a=a.replace(/\/index$/,"")||"/";let s=await E.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!s)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:w,params:R,nextConfig:v,parsedUrl:S,isDraftMode:x,prerenderManifest:C,routerServerContext:T,isOnDemandRevalidate:P,revalidateOnlyGenerated:L,resolvedPathname:I,clientReferenceManifest:A,serverActionsManifest:N}=s,O=(0,u.normalizeAppPath)(a),k=!!(C.dynamicRoutes[O]||C.routes[I]),q=async()=>((null==T?void 0:T.render404)?await T.render404(e,t,S,!1):t.end("This page could not be found"),null);if(k&&!x){let e=!!C.routes[I],t=C.dynamicRoutes[O];if(t&&!1===t.fallback&&!e){if(v.adapterPath)return await q();throw new b.NoFallbackError}}let D=null;!k||E.isDev||x||(D=I,D="/index"===D?"/":D);let $=!0===E.isDev||!k,M=k&&!$;N&&A&&(0,l.setManifestsSingleton)({page:a,clientReferenceManifest:A,serverActionsManifest:N});let U=e.method||"GET",j=(0,i.getTracer)(),H=j.getActiveScopeSpan(),Q=!!(null==T?void 0:T.isWrappedByNextServer),B=!!(0,o.getRequestMeta)(e,"minimalMode"),F=(0,o.getRequestMeta)(e,"incrementalCache")||await E.getIncrementalCache(e,v,C,B);null==F||F.resetRequestCache(),globalThis.__incrementalCache=F;let K={params:R,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!v.experimental.authInterrupts},cacheComponents:!!v.cacheComponents,supportsDynamicResponse:$,incrementalCache:F,cacheLifeProfiles:v.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,n,a,r)=>E.onRequestError(e,t,a,r,T)},sharedContext:{buildId:w}},Y=new c.NodeNextRequest(e),W=new c.NodeNextResponse(t),z=d.NextRequestAdapter.fromNodeNextRequest(Y,(0,d.signalFromNodeResponse)(t));try{let s,o=async e=>E.handle(z,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let n=j.getRootSpanAttributes();if(!n)return;if(n.get("next.span_type")!==h.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${n.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=n.get("next.route");if(r){let t=`${U} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t),s&&s!==e&&(s.setAttribute("http.route",r),s.updateName(t))}else e.updateName(`${U} ${a}`)}),l=async s=>{var i,l;let u=async({previousCacheEntry:r})=>{try{if(!B&&P&&L&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await o(s);e.fetchMetrics=K.renderOpts.fetchMetrics;let i=K.renderOpts.pendingWaitUntil;i&&n.waitUntil&&(n.waitUntil(i),i=void 0);let l=K.renderOpts.collectedTags;if(!k)return await (0,p.sendResponse)(Y,W,a,K.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,f.toNodeOutgoingHttpHeaders)(a.headers);l&&(t[y.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let n=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,r=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:_.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:n,expire:r}}}}catch(t){throw(null==r?void 0:r.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:P})},!1,T),t}},c=await E.handleResponse({req:e,nextConfig:v,cacheKey:D,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:P,revalidateOnlyGenerated:L,responseGenerator:u,waitUntil:n.waitUntil,isMinimalMode:B});if(!k)return null;if((null==c||null==(i=c.value)?void 0:i.kind)!==_.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",P?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),x&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,f.fromNodeOutgoingHttpHeaders)(c.value.headers);return B&&k||d.delete(y.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,g.getCacheControlHeader)(c.cacheControl)),await (0,p.sendResponse)(Y,W,new Response(c.value.body,{headers:d,status:c.value.status||200})),null};Q&&H?await l(H):(s=j.getActiveScopeSpan(),await j.withPropagatedContext(e.headers,()=>j.trace(h.BaseServerSpan.handleRequest,{spanName:`${U} ${a}`,kind:i.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},l),void 0,!Q))}catch(t){if(t instanceof b.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:O,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:P})},!1,T),k)throw t;return await (0,p.sendResponse)(Y,W,new Response(null,{status:500})),null}}e.s(["handler",0,v,"patchFetch",0,function(){return(0,s.patchFetch)({workAsyncStorage:S,workUnitAsyncStorage:x})},"routeModule",0,E,"serverHooks",0,C,"workAsyncStorage",0,S,"workUnitAsyncStorage",0,x]),n()}catch(e){n(e)}},!1),967030,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@vercel_oidc_dist_0srtcxg._.js"].map(t=>e.l(t))).then(()=>t(783697)))},683671,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@vercel_oidc_dist_0-rx1bm._.js"].map(t=>e.l(t))).then(()=>t(390391)))},903237,e=>{e.v(e=>Promise.resolve().then(()=>e(503815)))},929114,e=>{e.v(e=>Promise.resolve().then(()=>e(865740)))},52974,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__0euvgz4._.js"].map(t=>e.l(t))).then(()=>t(748867)))},563921,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_memory-adapter_dist_index_mjs_07pm9hq._.js"].map(t=>e.l(t))).then(()=>t(268905)))},246120,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_adapters_kysely-adapter_index_mjs_0.9gz-c._.js"].map(t=>e.l(t))).then(()=>t(69580)))},998367,e=>{e.v(t=>Promise.all(["server/chunks/0t6k_@better-auth_kysely-adapter_dist_bun-sqlite-dialect-C8OaCWSL_mjs_0duzuha._.js"].map(t=>e.l(t))).then(()=>t(35908)))},209477,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_@better-auth_kysely-adapter_dist_node-sqlite-dialect_mjs_036w40n._.js"].map(t=>e.l(t))).then(()=>t(689127)))},873138,e=>{e.v(t=>Promise.all(["server/chunks/0_lp_modules_@better-auth_kysely-adapter_dist_d1-sqlite-dialect-sYHNqBte_mjs_01w3w0i._.js"].map(t=>e.l(t))).then(()=>t(661871)))},299302,e=>{e.v(t=>Promise.all(["server/chunks/[externals]_node_dns_promises_11l6s5x._.js"].map(t=>e.l(t))).then(()=>t(300794)))},606630,e=>{e.v(t=>Promise.all(["server/chunks/node_modules_better-auth_dist_crypto_index_mjs_088ibmc._.js"].map(t=>e.l(t))).then(()=>t(110352)))},406693,e=>{e.v(t=>Promise.all(["server/chunks/[root-of-the-server]__0dws1le._.js","server/chunks/node_modules_04d~.79._.js"].map(t=>e.l(t))).then(()=>t(701631)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__00un1m4._.js.map