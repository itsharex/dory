module.exports=[895910,e=>e.a(async(t,a)=>{try{var r=e.i(485889),i=e.i(283110),n=e.i(503815),o=e.i(796660),s=e.i(254799),l=e.i(875225),c=e.i(89171),d=e.i(371272),u=e.i(998631),p=t([r,n]);async function h(e,t,a){let r=await e.api.getSession({headers:t.headers}).catch(()=>null);if(r)return r;let i="google"===a.searchParams.get("provider")?"google":"github";if(!a.searchParams.get("code")||!a.searchParams.get("state"))return null;let n=await e.api.callbackOAuth({headers:t.headers,params:{id:i},query:Object.fromEntries(a.searchParams),asResponse:!0}),o=await e.$context,s=function(e,t){let a,r=(a=t.replace(/^__Secure-/,"").replace(/^__Host-/,""),Array.from(new Set([a,`__Secure-${a}`,`__Host-${a}`])));for(let t of function(e){if("function"==typeof e.getSetCookie)return e.getSetCookie();let t=e.get("set-cookie");return t?[t]:[]}(e))for(let e of r){let a=function(e,t){let a=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),r=e.match(RegExp(`^${a}=([^;]+)`));return r?.[1]??null}(t,e);if(a)return{name:e,value:a}}return null}(n.headers??new Headers,o.authCookies.sessionToken.name);if(!s)return null;let l=new Headers(t.headers),c=l.get("cookie"),d=`${s.name}=${s.value}`;return l.set("cookie",c?`${c}; ${d}`:d),e.api.getSession({headers:l}).catch(()=>null)}function f(e){let t=new URL("dory://auth-complete");for(let[a,r]of Object.entries(e))r&&t.searchParams.set(a,r);return t.toString()}function m(e,t){return new c.NextResponse(`
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${t.title}</title>
          <style>
            :root {
              color-scheme: light;
            }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: linear-gradient(180deg, #f7fafc 0%, #eef2f7 100%);
              color: #1f2937;
            }
            .card {
              width: min(560px, calc(100vw - 32px));
              background: #fff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              padding: 24px;
              box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
            }
            h1 {
              margin: 0 0 8px;
              font-size: 22px;
              line-height: 1.3;
            }
            p {
              margin: 0;
              line-height: 1.6;
              color: #4b5563;
            }
            .actions {
              margin-top: 18px;
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
            a, button {
              border-radius: 10px;
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              color: #0f172a;
              padding: 10px 14px;
              font-size: 14px;
              text-decoration: none;
              cursor: pointer;
            }
            a.primary {
              background: #0f172a;
              border-color: #0f172a;
              color: #fff;
            }
            .hint {
              margin-top: 14px;
              font-size: 13px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <main class="card">
            <h1>${t.title}</h1>
            <p>${t.description}</p>
            <div class="actions">
              <a id="open-link" class="primary" href=${JSON.stringify(e)}>${t.openApp}</a>
              <button id="close-btn" type="button">${t.closePage}</button>
            </div>
            <p class="hint">${t.hint}</p>
          </main>
          <script>
            const deepLinkUrl = ${JSON.stringify(e)};
            const openLink = document.getElementById('open-link');
            const closeBtn = document.getElementById('close-btn');
            if (openLink) {
              openLink.setAttribute('href', deepLinkUrl);
            }
            if (closeBtn) {
              closeBtn.addEventListener('click', () => window.close());
            }

            // Trigger deep link after first paint so fallback UI is visible.
            setTimeout(() => {
              window.location.assign(deepLinkUrl);
            }, 200);
          </script>
        </body>
      </html>
    `,{headers:{"Content-Type":"text/html"}})}async function g(e,t){let a=await e.$context,r=`electron-${(0,s.randomUUID)()}`;if(!await a.internalAdapter.createVerificationValue({value:JSON.stringify(t),identifier:r,expiresAt:new Date(Date.now()+3e5)}))throw Error("failed_to_create_ticket");return r}async function w(e){var t;let a,s=new URL(e.url),p=(t=await (0,o.getApiLocale)(),{title:(0,o.translateApi)("Api.ElectronAuthFinalize.Title",void 0,t),description:(0,o.translateApi)("Api.ElectronAuthFinalize.Description",void 0,t),openApp:(0,o.translateApi)("Api.ElectronAuthFinalize.OpenApp",void 0,t),closePage:(0,o.translateApi)("Api.ElectronAuthFinalize.ClosePage",void 0,t),hint:(0,o.translateApi)("Api.ElectronAuthFinalize.Hint",void 0,t)}),w=s.searchParams.get("error");if(w){let e=f({error:w,error_description:s.searchParams.get("error_description")??void 0});return m(e,p)}let v=await (0,r.getAuth)(),R=await v.$context;console.log("[electron-auth][finalize] request summary",{hasCode:!!s.searchParams.get("code"),hasState:!!s.searchParams.get("state"),cookieNames:(a=e.headers.get("cookie"))?a.split(";").map(e=>e.split("=")[0]?.trim()).filter(e=>!!e):[],sessionCookieName:R.authCookies.sessionToken.name});let x=await h(v,e,s);if(!x?.session?.token)return c.NextResponse.json({error:"missing_session_cookie"},{status:401});let y=await R.internalAdapter.findSession(x.session.token);if(!y)return c.NextResponse.json({error:"missing_session"},{status:401});let A=await (0,n.getClient)(),[b]=await A.select().from(i.schema.user).where((0,l.eq)(i.schema.user.id,y.user.id)),E=(0,d.resolveCurrentOrganizationIdStrict)(x),k=(0,u.buildElectronTicketUser)({id:b?.id??y.user.id,email:b?.email??y.user.email??null,name:b?.name??y.user.name??null,image:b?.image??y.user.image??null,emailVerified:b?.emailVerified??y.user.emailVerified??!1,activeOrganizationId:E}),C=await g(v,{user:k}),S=f({ticket:C});return m(S,p)}[r,n]=p.then?(await p)():p,e.s(["GET",0,w,"dynamic",0,"force-dynamic","runtime",0,"nodejs"]),a()}catch(e){a(e)}},!1),733492,e=>e.a(async(t,a)=>{try{var r=e.i(747909),i=e.i(174017),n=e.i(996250),o=e.i(759756),s=e.i(561916),l=e.i(174677),c=e.i(869741),d=e.i(316795),u=e.i(487718),p=e.i(995169),h=e.i(47587),f=e.i(666012),m=e.i(570101),g=e.i(626937),w=e.i(10372),v=e.i(193695);e.i(52474);var R=e.i(600220),x=e.i(895910),y=t([x]);[x]=y.then?(await y)():y;let b=new r.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/electron/auth/finalize/route",pathname:"/api/electron/auth/finalize",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/apps/web/app/api/electron/auth/finalize/route.ts",nextConfigOutput:"standalone",userland:x,...{}}),{workAsyncStorage:E,workUnitAsyncStorage:k,serverHooks:C}=b;async function A(e,t,a){a.requestMeta&&(0,o.setRequestMeta)(e,a.requestMeta),b.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let r="/api/electron/auth/finalize/route";r=r.replace(/\/index$/,"")||"/";let n=await b.prepare(e,t,{srcPage:r,multiZoneDraftMode:!1});if(!n)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:x,params:y,nextConfig:A,parsedUrl:E,isDraftMode:k,prerenderManifest:C,routerServerContext:S,isOnDemandRevalidate:_,revalidateOnlyGenerated:P,resolvedPathname:N,clientReferenceManifest:T,serverActionsManifest:$}=n,O=(0,c.normalizeAppPath)(r),U=!!(C.dynamicRoutes[O]||C.routes[N]),H=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,E,!1):t.end("This page could not be found"),null);if(U&&!k){let e=!!C.routes[N],t=C.dynamicRoutes[O];if(t&&!1===t.fallback&&!e){if(A.adapterPath)return await H();throw new v.NoFallbackError}}let I=null;!U||b.isDev||k||(I=N,I="/index"===I?"/":I);let q=!0===b.isDev||!U,D=U&&!q;$&&T&&(0,l.setManifestsSingleton)({page:r,clientReferenceManifest:T,serverActionsManifest:$});let M=e.method||"GET",z=(0,s.getTracer)(),L=z.getActiveScopeSpan(),F=!!(null==S?void 0:S.isWrappedByNextServer),j=!!(0,o.getRequestMeta)(e,"minimalMode"),B=(0,o.getRequestMeta)(e,"incrementalCache")||await b.getIncrementalCache(e,A,C,j);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let K={params:y,previewProps:C.preview,renderOpts:{experimental:{authInterrupts:!!A.experimental.authInterrupts},cacheComponents:!!A.cacheComponents,supportsDynamicResponse:q,incrementalCache:B,cacheLifeProfiles:A.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,i)=>b.onRequestError(e,t,r,i,S)},sharedContext:{buildId:x}},V=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),J=u.NextRequestAdapter.fromNodeNextRequest(V,(0,u.signalFromNodeResponse)(t));try{let n,o=async e=>b.handle(J,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=z.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let i=a.get("next.route");if(i){let t=`${M} ${i}`;e.setAttributes({"next.route":i,"http.route":i,"next.span_name":t}),e.updateName(t),n&&n!==e&&(n.setAttribute("http.route",i),n.updateName(t))}else e.updateName(`${M} ${r}`)}),l=async n=>{var s,l;let c=async({previousCacheEntry:i})=>{try{if(!j&&_&&P&&!i)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let r=await o(n);e.fetchMetrics=K.renderOpts.fetchMetrics;let s=K.renderOpts.pendingWaitUntil;s&&a.waitUntil&&(a.waitUntil(s),s=void 0);let l=K.renderOpts.collectedTags;if(!U)return await (0,f.sendResponse)(V,G,r,K.renderOpts.pendingWaitUntil),null;{let e=await r.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(r.headers);l&&(t[w.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=w.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,i=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=w.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:R.CachedRouteKind.APP_ROUTE,status:r.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:i}}}}catch(t){throw(null==i?void 0:i.isStale)&&await b.onRequestError(e,t,{routerKind:"App Router",routePath:r,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:_})},!1,S),t}},d=await b.handleResponse({req:e,nextConfig:A,cacheKey:I,routeKind:i.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:_,revalidateOnlyGenerated:P,responseGenerator:c,waitUntil:a.waitUntil,isMinimalMode:j});if(!U)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==R.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(l=d.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});j||t.setHeader("x-nextjs-cache",_?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),k&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return j&&U||u.delete(w.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,g.getCacheControlHeader)(d.cacheControl)),await (0,f.sendResponse)(V,G,new Response(d.value.body,{headers:u,status:d.value.status||200})),null};F&&L?await l(L):(n=z.getActiveScopeSpan(),await z.withPropagatedContext(e.headers,()=>z.trace(p.BaseServerSpan.handleRequest,{spanName:`${M} ${r}`,kind:s.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},l),void 0,!F))}catch(t){if(t instanceof v.NoFallbackError||await b.onRequestError(e,t,{routerKind:"App Router",routePath:O,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:_})},!1,S),U)throw t;return await (0,f.sendResponse)(V,G,new Response(null,{status:500})),null}}e.s(["handler",0,A,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:k})},"routeModule",0,b,"serverHooks",0,C,"workAsyncStorage",0,E,"workUnitAsyncStorage",0,k]),a()}catch(e){a(e)}},!1)];

//# sourceMappingURL=_0evg64.._.js.map