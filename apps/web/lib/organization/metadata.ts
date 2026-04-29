const DEFAULT_AI_QUOTA_EXEMPT_OWNER_EMAILS = ['demo@getdory.dev'];

export function getAiQuotaExemptOwnerEmails(env: Record<string, string | undefined> = process.env): string[] {
    const raw = env.DORY_AI_QUOTA_EXEMPT_ORG_OWNER_EMAILS;
    const values = raw
        ?.split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);

    return values && values.length > 0 ? values : DEFAULT_AI_QUOTA_EXEMPT_OWNER_EMAILS;
}

export function isOrganizationEligibleForAiQuotaExemption(ownerEmail?: string | null, env: Record<string, string | undefined> = process.env): boolean {
    if (!ownerEmail) {
        return false;
    }

    return getAiQuotaExemptOwnerEmails(env).includes(ownerEmail.trim().toLowerCase());
}
