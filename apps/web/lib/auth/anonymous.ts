import { and, eq, isNull, or } from 'drizzle-orm';
import type { PostgresDBClient } from '@/types';
import { getServerLocale } from '@/lib/i18n/server-locale';
import { translate } from '@/lib/i18n/i18n';
import { getClient } from '@/lib/database/postgres/client';
import { schema } from '@/lib/database/schema';
import { isAnonymousUser } from './anonymous-user';

type AuthSessionLike = {
    session?: {
        token?: string | null;
        activeOrganizationId?: string | null;
    } | null;
    user?: {
        id?: string | null;
        email?: string | null;
        isAnonymous?: boolean | null;
    } | null;
};

function slugifyOrganizationName(name: string) {
    const normalized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
}

async function buildAnonymousOrganizationValues(userId: string) {
    const locale = await getServerLocale();
    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
    const name = t('Auth.AnonymousWorkspace.Name');

    return {
        name,
        slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
    };
}

async function getLinkedAnonymousOrganizationName() {
    const locale = await getServerLocale();
    return translate(locale, 'Auth.AnonymousWorkspace.LinkedName');
}

async function getDb() {
    return (await getClient()) as PostgresDBClient;
}

async function findFirstActiveOrganizationIdForUser(db: PostgresDBClient, userId: string) {
    const [membership] = await db
        .select({ organizationId: schema.organizationMembers.organizationId })
        .from(schema.organizationMembers)
        .where(and(eq(schema.organizationMembers.userId, userId), or(eq(schema.organizationMembers.status, 'active'), isNull(schema.organizationMembers.status))))
        .limit(1);

    return membership?.organizationId ?? null;
}

export async function buildDefaultOrganizationValues(userId: string, email: string | null | undefined) {
    const locale = await getServerLocale();
    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
    const name = t('Auth.TeamName', { name: email ?? t('Auth.TeamDefaultName') });

    return {
        name,
        slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
    };
}

export async function bootstrapAnonymousOrganization(params: { auth: any; session: AuthSessionLike; headers?: Headers }) {
    const db = await getDb();
    const userId = params.session.user?.id ?? null;
    const sessionToken = params.session.session?.token ?? null;
    const email = params.session.user?.email ?? null;

    if (!userId || !sessionToken) {
        throw new Error('missing_anonymous_session');
    }

    let organizationId = params.session.session?.activeOrganizationId ?? (await findFirstActiveOrganizationIdForUser(db, userId));

    if (!organizationId) {
        const defaults = await buildAnonymousOrganizationValues(userId);
        const created = await params.auth.api.createOrganization({
            headers: params.headers ?? new Headers(),
            body: {
                ...defaults,
                userId,
                keepCurrentActiveOrganization: false,
            },
        });

        organizationId = created?.id ?? null;
        if (!organizationId) {
            throw new Error(`failed_to_create_default_organization_for_${userId}`);
        }
    }

    const [organization] = await db
        .select({
            id: schema.organizations.id,
            slug: schema.organizations.slug,
            name: schema.organizations.name,
        })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

    if (!organization) {
        throw new Error(`organization_not_found_for_${organizationId}`);
    }

    await db
        .update(schema.session)
        .set({
            activeOrganizationId: organization.id,
            updatedAt: new Date(),
        })
        .where(eq(schema.session.token, sessionToken));

    return organization;
}

export async function linkAnonymousOrganizationToUser(params: {
    anonymousUserId: string;
    anonymousActiveOrganizationId?: string | null;
    newUserId: string;
    newSessionToken?: string | null;
}) {
    const db = await getDb();
    const targetOrganizationId = params.anonymousActiveOrganizationId ?? (await findFirstActiveOrganizationIdForUser(db, params.anonymousUserId));

    if (!targetOrganizationId) {
        return null;
    }

    const targetOrganization = await db.transaction(async tx => {
        const preexistingMemberships = await tx
            .select({ organizationId: schema.organizationMembers.organizationId })
            .from(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.userId, params.newUserId), or(eq(schema.organizationMembers.status, 'active'), isNull(schema.organizationMembers.status))));

        const hadExistingOrganizations = preexistingMemberships.some(membership => membership.organizationId !== targetOrganizationId);

        const [organization] = await tx
            .select({
                id: schema.organizations.id,
                slug: schema.organizations.slug,
                name: schema.organizations.name,
            })
            .from(schema.organizations)
            .where(eq(schema.organizations.id, targetOrganizationId))
            .limit(1);

        if (!organization) {
            return null;
        }

        if (hadExistingOrganizations) {
            const linkedName = await getLinkedAnonymousOrganizationName();
            await tx
                .update(schema.organizations)
                .set({
                    name: linkedName,
                    updatedAt: new Date(),
                })
                .where(eq(schema.organizations.id, organization.id));
            organization.name = linkedName;
        }

        await tx
            .update(schema.organizations)
            .set({
                ownerUserId: params.newUserId,
                updatedAt: new Date(),
            })
            .where(eq(schema.organizations.id, organization.id));

        const [existingMembership] = await tx
            .select({ id: schema.organizationMembers.id })
            .from(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.organizationId, organization.id), eq(schema.organizationMembers.userId, params.newUserId)))
            .limit(1);

        if (existingMembership) {
            await tx
                .update(schema.organizationMembers)
                .set({
                    role: 'owner',
                    status: 'active',
                    joinedAt: new Date(),
                })
                .where(eq(schema.organizationMembers.id, existingMembership.id));
        } else {
            await tx.insert(schema.organizationMembers).values({
                userId: params.newUserId,
                organizationId: organization.id,
                role: 'owner',
                status: 'active',
                joinedAt: new Date(),
            });
        }

        await tx
            .delete(schema.organizationMembers)
            .where(and(eq(schema.organizationMembers.organizationId, organization.id), eq(schema.organizationMembers.userId, params.anonymousUserId)));

        if (params.newSessionToken) {
            await tx
                .update(schema.session)
                .set({
                    activeOrganizationId: organization.id,
                    updatedAt: new Date(),
                })
                .where(eq(schema.session.token, params.newSessionToken));
        }

        const [newUser] = await tx
            .select({
                createdAt: schema.user.createdAt,
            })
            .from(schema.user)
            .where(eq(schema.user.id, params.newUserId))
            .limit(1);

        const isFreshlyCreatedUser = Boolean(newUser?.createdAt && Date.now() - new Date(newUser.createdAt).getTime() < 15 * 60 * 1000);

        if (isFreshlyCreatedUser) {
            const ownedOrganizations = await tx
                .select({
                    id: schema.organizations.id,
                    slug: schema.organizations.slug,
                    createdAt: schema.organizations.createdAt,
                })
                .from(schema.organizations)
                .where(eq(schema.organizations.ownerUserId, params.newUserId));

            for (const ownedOrganization of ownedOrganizations) {
                if (ownedOrganization.id === organization.id) {
                    continue;
                }

                const looksLikeAutoCreated =
                    (ownedOrganization.slug ?? '').endsWith(`-${params.newUserId.slice(0, 8)}`) && Date.now() - new Date(ownedOrganization.createdAt).getTime() < 15 * 60 * 1000;

                if (!looksLikeAutoCreated) {
                    continue;
                }

                const members = await tx
                    .select({ id: schema.organizationMembers.id })
                    .from(schema.organizationMembers)
                    .where(eq(schema.organizationMembers.organizationId, ownedOrganization.id));

                if (members.length !== 1) {
                    continue;
                }

                await tx.delete(schema.organizations).where(eq(schema.organizations.id, ownedOrganization.id));
            }
        }

        return organization;
    });

    return targetOrganization;
}
