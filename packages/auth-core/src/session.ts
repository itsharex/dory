export type SessionAuthLike<Session> = {
  api: {
    getSession: (options: { headers: Headers }) => Promise<Session>;
  };
};

type CreateSessionResolverOptions<Session> = {
  getAuth: () => Promise<SessionAuthLike<Session>>;
  shouldProxyAuthRequest: () => boolean;
  createAuthProxyHeaders: (incoming: Headers, cloudBaseUrl: string) => Headers;
  getCloudApiBaseUrl: () => string | null;
  getRuntime?: () => string | null;
  strictProxyEnvVar?: string;
  log?: Pick<Console, 'info' | 'warn'>;
};

type ResolveSessionRequest = {
  headers: Headers;
  url?: string | null;
};

function getCookieNamesFromHeader(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

function getCloudAuthSessionUrl(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  return new URL('/api/auth/get-session', baseUrl).toString();
}

export function createSessionResolver<Session>(options: CreateSessionResolverOptions<Session>) {
  const log = options.log ?? console;
  const strictEnvKey = options.strictProxyEnvVar ?? 'DORY_AUTH_PROXY_STRICT';

  return async function resolveSession(request: ResolveSessionRequest): Promise<Session | null> {
    const auth = await options.getAuth();
    const reqHeaders = request.headers;
    const runtime = options.getRuntime?.() ?? null;
    const cloudBase = options.getCloudApiBaseUrl();
    const proxied = options.shouldProxyAuthRequest();
    const strictProxyOnly = proxied && process.env[strictEnvKey] !== '0';
    const cookieNames = getCookieNamesFromHeader(reqHeaders.get('cookie'));
    const requestHost = reqHeaders.get('host');
    const requestUrl = request.url ?? null;

    if (proxied) {
      const sessionUrl = getCloudAuthSessionUrl(cloudBase);
      if (sessionUrl && cloudBase) {
        try {
          const res = await fetch(sessionUrl, {
            headers: options.createAuthProxyHeaders(reqHeaders, cloudBase),
            cache: 'no-store',
          });

          if (res.ok) {
            const session = (await res.json()) as Session | null;
            if (session) {
              return session;
            }
          } else {
            // 
          }
        } catch {
        }
      }

      if (strictProxyOnly) {
        return null;
      }
      log.warn('[auth/session] cloud session unavailable, fallback to local auth', {
        runtime,
        hasCloudBase: Boolean(cloudBase),
        requestHost,
        requestUrl,
        cookieNames,
      });
    }

    const session = await auth.api
      .getSession({
        headers: reqHeaders,
      })
      .catch(() => null);

    if (session) {
      return session;
    }

    log.warn('[auth/session] no session resolved', {
      runtime,
      hasCloudBase: Boolean(cloudBase),
      proxied,
      requestHost,
      requestUrl,
      cookieNames,
    });

    return null;
  };
}
