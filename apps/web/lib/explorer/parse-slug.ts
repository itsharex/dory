import type {
    ExplorerListKind,
    ExplorerObjectKind,
    ParsedExplorerSlug,
} from './types';
import { DEFAULT_EXPLORER_CATALOG } from './types';

function decodeSegment(value: string | undefined): string | undefined {
    if (!value) return undefined;

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function parseExplorerSlug(slug: string[] | undefined): ParsedExplorerSlug {
    const safeSegments = (slug ?? []).filter(Boolean).map(item => decodeSegment(item) ?? item);

    if (safeSegments.length === 0) {
        return {
            catalog: DEFAULT_EXPLORER_CATALOG,
            segments: [],
            recognized: true,
        };
    }

    let catalog = DEFAULT_EXPLORER_CATALOG;
    let pathSegments = safeSegments;

    if (safeSegments[0] === 'catalog' && safeSegments[1]) {
        catalog = safeSegments[1];
        pathSegments = safeSegments.slice(2);
    }

    if (pathSegments.length === 0) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
        };
    }

    if (pathSegments[0] !== 'database' || !pathSegments[1]) {
        return {
            catalog,
            segments: safeSegments,
            recognized: false,
        };
    }

    if (pathSegments.length === 2) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'database',
                database: pathSegments[1],
            },
        };
    }

    if (pathSegments[2] === 'schema' && pathSegments[3] && pathSegments.length === 4) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'schema',
                database: pathSegments[1],
                schema: pathSegments[3],
            },
        };
    }

    if (pathSegments[2] && pathSegments.length === 3) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'list',
                database: pathSegments[1],
                listKind: pathSegments[2] as ExplorerListKind,
            },
        };
    }

    if (pathSegments[2] && pathSegments[3] && pathSegments.length === 4) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'object',
                database: pathSegments[1],
                objectKind: pathSegments[2] as Exclude<ExplorerObjectKind, 'database' | 'schema'>,
                name: pathSegments[3],
            },
        };
    }

    if (pathSegments[2] === 'schema' && pathSegments[3] && pathSegments[4] && pathSegments.length === 5) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'list',
                database: pathSegments[1],
                schema: pathSegments[3],
                listKind: pathSegments[4] as ExplorerListKind,
            },
        };
    }

    if (pathSegments[2] === 'schema' && pathSegments[3] && pathSegments[4] && pathSegments[5] && pathSegments.length === 6) {
        return {
            catalog,
            segments: safeSegments,
            recognized: true,
            resource: {
                kind: 'object',
                database: pathSegments[1],
                schema: pathSegments[3],
                objectKind: pathSegments[4] as Exclude<ExplorerObjectKind, 'database' | 'schema'>,
                name: pathSegments[5],
            },
        };
    }

    return {
        catalog,
        segments: safeSegments,
        recognized: false,
    };
}
