export function isAnonymousUser(user: unknown) {
    const candidate = user as { isAnonymous?: boolean | null } | null | undefined;
    return Boolean(candidate?.isAnonymous);
}
