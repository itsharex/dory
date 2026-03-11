const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export const CONNECTION_REQUEST_TIMEOUT_MS = Number.isFinite(Number(process.env.CONNECTION_REQUEST_TIMEOUT_MS))
    ? Math.max(1000, Number(process.env.CONNECTION_REQUEST_TIMEOUT_MS))
    : DEFAULT_REQUEST_TIMEOUT_MS;

export function applyConnectionRequestTimeout(
    options: Record<string, unknown>,
    timeoutMs?: unknown,
): Record<string, unknown> {
    const resolved =
        typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
            ? Math.max(1000, Math.trunc(timeoutMs))
            : CONNECTION_REQUEST_TIMEOUT_MS;

    options.request_timeout = resolved;
    return options;
}
