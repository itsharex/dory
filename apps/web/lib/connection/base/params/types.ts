export type NamedParams = Record<string, unknown>;
export type PositionalParams = unknown[];
export type SQLParams = NamedParams | PositionalParams;

export function isNamedParams(params: SQLParams | undefined): params is NamedParams {
    return !!params && !Array.isArray(params);
}

export function isPositionalParams(params: SQLParams | undefined): params is PositionalParams {
    return Array.isArray(params);
}
