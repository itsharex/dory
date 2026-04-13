const READ_ONLY_SQL_PREFIXES = ['select', 'show', 'describe', 'desc', 'explain', 'with', 'pragma'] as const;

const READ_ONLY_SQL_PREFIX_PATTERN = new RegExp(`^(${READ_ONLY_SQL_PREFIXES.join('|')})\\b`, 'i');

export function isReadOnlyQuery(sql: string): boolean {
    return READ_ONLY_SQL_PREFIX_PATTERN.test(sql.trim());
}

export function getReadOnlyQueryKeywordList(): string {
    return READ_ONLY_SQL_PREFIXES.map(keyword => keyword.toUpperCase()).join('/');
}
