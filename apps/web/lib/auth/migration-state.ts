type OrganizationResolutionInput = {
    activeOrganizationId?: string | null;
    legacyDefaultTeamId?: string | null;
    membershipOrganizationId?: string | null;
};

type TicketUserInput = {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    activeOrganizationId?: string | null;
    legacyDefaultTeamId?: string | null;
};

export function resolveOrganizationIdForSession(input: OrganizationResolutionInput): string | null {
    return input.activeOrganizationId ?? input.legacyDefaultTeamId ?? input.membershipOrganizationId ?? null;
}

export function shouldCreateDefaultOrganization(input: {
    isDesktop: boolean;
    existingOrganizationId?: string | null;
    emailVerified: boolean;
}): boolean {
    if (input.isDesktop) {
        return false;
    }

    if (input.existingOrganizationId) {
        return false;
    }

    return input.emailVerified;
}

export function shouldBackfillLegacyDefaultTeamId(input: {
    currentLegacyDefaultTeamId?: string | null;
    organizationId?: string | null;
}): boolean {
    if (!input.organizationId) {
        return false;
    }

    return !input.currentLegacyDefaultTeamId;
}

export function resolveOrganizationIdFromTicket(input: {
    activeOrganizationId?: string | null;
    legacyDefaultTeamId?: string | null;
}): string | null {
    return input.activeOrganizationId ?? input.legacyDefaultTeamId ?? null;
}

export function buildElectronTicketUser(input: TicketUserInput) {
    const activeOrganizationId = input.activeOrganizationId ?? null;
    const defaultTeamId = input.legacyDefaultTeamId ?? activeOrganizationId ?? null;

    return {
        id: input.id,
        email: input.email,
        name: input.name,
        image: input.image,
        emailVerified: input.emailVerified,
        activeOrganizationId,
        defaultTeamId,
    };
}

export function buildSessionOrganizationPatch(input: {
    activeOrganizationId?: string | null;
    legacyDefaultTeamId?: string | null;
}) {
    const activeOrganizationId = resolveOrganizationIdFromTicket(input);
    return activeOrganizationId ? { activeOrganizationId } : null;
}
