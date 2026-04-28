type OrganizationResolutionInput = {
    activeOrganizationId?: string | null;
    membershipOrganizationId?: string | null;
};

type TicketUserInput = {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    isAnonymous?: boolean;
    activeOrganizationId?: string | null;
};

export function resolveOrganizationIdForSession(input: OrganizationResolutionInput): string | null {
    return input.activeOrganizationId ?? input.membershipOrganizationId ?? null;
}

export function shouldCreateDefaultOrganization(input: {
    isDesktop: boolean;
    existingOrganizationId?: string | null;
    emailVerified: boolean;
    requireEmailVerification: boolean;
}): boolean {
    if (input.isDesktop) {
        return false;
    }

    if (input.existingOrganizationId) {
        return false;
    }

    return !input.requireEmailVerification || input.emailVerified;
}

export function resolveOrganizationIdFromTicket(input: { activeOrganizationId?: string | null }): string | null {
    return input.activeOrganizationId ?? null;
}

export function buildElectronTicketUser(input: TicketUserInput) {
    const activeOrganizationId = input.activeOrganizationId ?? null;

    return {
        id: input.id,
        email: input.email,
        name: input.name,
        image: input.image,
        emailVerified: input.emailVerified,
        isAnonymous: input.isAnonymous ?? false,
        activeOrganizationId,
    };
}

export function buildSessionOrganizationPatch(input: { activeOrganizationId?: string | null }) {
    const activeOrganizationId = resolveOrganizationIdFromTicket(input);
    return activeOrganizationId ? { activeOrganizationId } : null;
}
