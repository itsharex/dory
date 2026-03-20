import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, organization, role } from 'better-auth/plugins';
import { schema } from '@/lib/database/schema';
import { getDatabaseProvider } from '@/lib/database/provider';
import { sendEmail } from './email';
import { PostgresDBClient } from '@/types';
import { eq } from 'drizzle-orm';
import { getClient } from './database/postgres/client';
import { getServerLocale } from './i18n/server-locale';
import { translate } from './i18n/i18n';
import { createCachedAsyncFactory } from '@dory/auth-core';
import { isDesktopRuntime } from './runtime/runtime';
import {
    resolveOrganizationIdForSession,
    shouldBackfillLegacyDefaultTeamId,
    shouldCreateDefaultOrganization,
} from './auth/migration-state';

// User type with legacy defaultTeamId, used during the migration window.
type UserWithDefaultTeam = {
    id: string;
    email: string | null;
    emailVerified: boolean;
    defaultTeamId?: string | null;
};

type SessionWithActiveOrganization = {
    userId: string;
    activeOrganizationId?: string | null;
};

function slugifyOrganizationName(name: string) {
    const normalized = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || 'workspace';
}

async function syncLegacyDefaultTeamId(db: PostgresDBClient, userId: string, organizationId: string) {
    const [dbUser] = await db
        .select({ defaultTeamId: schema.user.defaultTeamId })
        .from(schema.user)
        .where(eq(schema.user.id, userId));

    if (!shouldBackfillLegacyDefaultTeamId({
        currentLegacyDefaultTeamId: dbUser?.defaultTeamId ?? null,
        organizationId,
    })) {
        return dbUser?.defaultTeamId ?? organizationId;
    }

    await db.update(schema.user).set({ defaultTeamId: organizationId }).where(eq(schema.user.id, userId));

    return organizationId;
}

function createAuth() {
    return (async () => {
        const db = (await getClient()) as PostgresDBClient;
        const provider = getDatabaseProvider() === 'pglite' ? 'pg' : 'pg';
        const isDesktop = isDesktopRuntime();
        const desktopOrigin =
            process.env.DORY_ELECTRON_ORIGIN?.trim() ||
            process.env.NEXT_PUBLIC_DORY_ELECTRON_ORIGIN?.trim() ||
            (isDesktop ? `http://127.0.0.1:${process.env.PORT ?? 3000}` : '');

        console.log('[auth] TRUSTED_ORIGINS =', process.env.TRUSTED_ORIGINS);

        async function findInitialOrganizationId(userId: string): Promise<string | null> {
            const [existingUser] = await db.select({ defaultTeamId: schema.user.defaultTeamId }).from(schema.user).where(eq(schema.user.id, userId));
            const [existingMembership] = await db
                .select({ organizationId: schema.teamMembers.teamId })
                .from(schema.teamMembers)
                .where(eq(schema.teamMembers.userId, userId))
                .limit(1);

            const resolvedOrganizationId = resolveOrganizationIdForSession({
                legacyDefaultTeamId: existingUser?.defaultTeamId ?? null,
                membershipOrganizationId: existingMembership?.organizationId ?? null,
            });

            if (!resolvedOrganizationId) {
                return null;
            }

            return syncLegacyDefaultTeamId(db, userId, resolvedOrganizationId);
        }

        async function hasExistingOrganization(userId: string): Promise<boolean> {
            return Boolean(await findInitialOrganizationId(userId));
        }

        /**
         * Shared helper: create a default organization + member relation through better-auth.
         * The plugin owns the organization/member writes; we keep user.defaultTeamId as a
         * legacy fallback during the migration.
         */
        async function ensureDefaultOrganizationForUser(auth: any, userId: string, email: string | null | undefined) {
            if (isDesktop) {
                return;
            }

            const existingOrganizationId = await findInitialOrganizationId(userId);
            if (existingOrganizationId) {
                return;
            }

            const locale = await getServerLocale();
            const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
            const name = t('Auth.TeamName', { name: email ?? t('Auth.TeamDefaultName') });

            const created = await auth.api.createOrganization({
                body: {
                    name,
                    slug: `${slugifyOrganizationName(name)}-${userId.slice(0, 8)}`,
                    userId,
                    keepCurrentActiveOrganization: false,
                },
            });

            const organizationId = created?.id ?? null;
            if (!organizationId) {
                throw new Error(`failed_to_create_default_organization_for_${userId}`);
            }

            await syncLegacyDefaultTeamId(db, userId, organizationId);
            console.log(`[auth] default organization ${organizationId} created for user ${userId}`);
        }

        const auth = betterAuth({
            database: drizzleAdapter(db, { provider, schema }),
            plugins: [
                jwt(),
                organization({
                    roles: {
                        owner: role({}),
                        admin: role({}),
                        member: role({}),
                        viewer: role({}),
                    },
                    schema: {
                        session: {
                            fields: {
                                activeOrganizationId: 'activeOrganizationId',
                            },
                        },
                        organization: {
                            modelName: 'teams',
                            fields: {
                                name: 'name',
                                slug: 'slug',
                                logo: 'logo',
                                createdAt: 'createdAt',
                                updatedAt: 'updatedAt',
                            },
                            additionalFields: {
                                ownerUserId: {
                                    type: 'string',
                                    required: false,
                                    input: false,
                                },
                            },
                        },
                        member: {
                            modelName: 'teamMembers',
                            fields: {
                                organizationId: 'teamId',
                                userId: 'userId',
                                role: 'role',
                                createdAt: 'createdAt',
                            },
                            additionalFields: {
                                status: {
                                    type: 'string',
                                    required: false,
                                    input: false,
                                },
                                joinedAt: {
                                    type: 'date',
                                    required: false,
                                    input: false,
                                },
                            },
                        },
                        invitation: {
                            modelName: 'invitation',
                            fields: {
                                organizationId: 'organizationId',
                                email: 'email',
                                role: 'role',
                                status: 'status',
                                expiresAt: 'expiresAt',
                                createdAt: 'createdAt',
                                inviterId: 'inviterId',
                            },
                        },
                    },
                    organizationHooks: {
                        beforeCreateOrganization: async ({ organization, user }) => {
                            return {
                                data: {
                                    ...organization,
                                    ownerUserId: user.id,
                                },
                            };
                        },
                        afterCreateOrganization: async ({ organization, user }) => {
                            await syncLegacyDefaultTeamId(db, user.id, organization.id);
                        },
                    },
                }),
            ],
            baseURL: isDesktop && desktopOrigin ? desktopOrigin : undefined,
            advanced: isDesktop ? { useSecureCookies: false } : undefined,
            account: {
                storeStateStrategy: 'database',
                skipStateCookieCheck: true,
            },
            trustedOrigins: [
                'http://127.0.0.1:*',
                'http://localhost:*',
                `dory://`,
                ...(process.env.TRUSTED_ORIGINS?.split(',')
                    .map(s => s.trim())
                    .filter(Boolean) ?? []),
            ],

            /**
             * Extra user field: defaultTeamId
             */
            user: {
                additionalFields: {
                    defaultTeamId: {
                        type: 'string',
                        required: false,
                        input: false, // Disallow client input
                        defaultValue: null,
                    },
                },
            },

            /**
             * ✅ Database hooks:
             * user.create.after: runs after any new-user creation (email / social / magic link, etc.)
             *
             * Used to:
             *   - auto-create a team on first social login
             *   - for email signup, optionally wait for emailVerified=true (enabled here)
             */
            databaseHooks: {
                user: {
                    create: {
                        after: async rawUser => {
                            // Explicitly narrow type to include defaultTeamId
                            const user = rawUser as UserWithDefaultTeam;

                            // Skip if the user is already attached to an organization.
                            const existingOrganizationId = await findInitialOrganizationId(user.id);

                            // For social login:
                            //   - If SSO marks email as verified, emailVerified is true
                            //   → Create the organization immediately here
                            //
                            // For email+password signup:
                            //   - With requireEmailVerification, emailVerified is usually false
                            //   → Create the organization in afterEmailVerification instead
                            if (shouldCreateDefaultOrganization({
                                isDesktop,
                                existingOrganizationId,
                                emailVerified: user.emailVerified,
                            })) {
                                await ensureDefaultOrganizationForUser(auth as any, user.id, user.email);
                            }
                        },
                    },
                },
                session: {
                    create: {
                        before: async rawSession => {
                            const session = rawSession as SessionWithActiveOrganization;
                            const activeOrganizationId = resolveOrganizationIdForSession({
                                activeOrganizationId: session.activeOrganizationId ?? null,
                                membershipOrganizationId: await findInitialOrganizationId(session.userId),
                            });

                            return {
                                data: {
                                    ...session,
                                    activeOrganizationId,
                                },
                            };
                        },
                    },
                },
            },

            emailAndPassword: {
                enabled: true,
                requireEmailVerification: true,
                autoSignInAfterVerification: true,

                sendResetPassword: async ({ user, url, token }, request) => {
                    const locale = await getServerLocale();
                    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
                    const r = console.log('[auth] sendVerificationEmail hook', { to: user.email, url });
                    await sendEmail({
                        to: user.email,
                        subject: t('Auth.Emails.ResetPassword.Subject'),
                        text: t('Auth.Emails.ResetPassword.Text', { url }),
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #0f172a; padding: 24px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                                    <img src="https://app.getdory.dev/logo.png" width="32" height="32" alt="${t('Auth.Emails.ResetPassword.BrandName')}" style="display: inline-block; border-radius: 6px;" />
                                    <span style="font-size: 16px; font-weight: 600; color: #0f172a;">${t('Auth.Emails.ResetPassword.BrandName')}</span>
                                </div>
                                <h2 style="margin: 0 0 12px; font-size: 20px;">${t('Auth.Emails.ResetPassword.Subject')}</h2>
                                <p style="margin: 0 0 16px; font-size: 14px; color: #334155;">
                                    ${t('Auth.Emails.ResetPassword.Intro')}
                                </p>
                                <p style="margin: 0 0 24px;">
                                    <a href="${url}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">
                                        ${t('Auth.Emails.ResetPassword.Button')}
                                    </a>
                                </p>
                                <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
                                    ${t('Auth.Emails.ResetPassword.Fallback')}
                                </p>
                                <p style="margin: 0; font-size: 12px; color: #2563eb; word-break: break-all;">
                                    <a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>
                                </p>
                            </div>
                        `.trim(),
                    });
                    console.log('[auth] sendEmail result', r);
                },
            },

            emailVerification: {
                sendOnSignUp: true,

                sendVerificationEmail: async ({ user, url, token }, request) => {
                    const locale = await getServerLocale();
                    const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);
                    await sendEmail({
                        to: user.email,
                        subject: t('Auth.Emails.VerifyEmail.Subject'),
                        text: t('Auth.Emails.VerifyEmail.Text', { url }),
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #0f172a; padding: 24px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                                    <img src="https://app.getdory.dev/logo.png" width="32" height="32" alt="${t('Auth.Emails.VerifyEmail.BrandName')}" style="display: inline-block; border-radius: 6px;" />
                                    <span style="font-size: 16px; font-weight: 600; color: #0f172a;">${t('Auth.Emails.VerifyEmail.BrandName')}</span>
                                </div>
                                <h2 style="margin: 0 0 12px; font-size: 20px;">${t('Auth.Emails.VerifyEmail.Subject')}</h2>
                                <p style="margin: 0 0 16px; font-size: 14px; color: #334155;">
                                    ${t('Auth.Emails.VerifyEmail.Intro')}
                                </p>
                                <p style="margin: 0 0 24px;">
                                    <a href="${url}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">
                                        ${t('Auth.Emails.VerifyEmail.Button')}
                                    </a>
                                </p>
                                <p style="margin: 0 0 8px; font-size: 12px; color: #64748b;">
                                    ${t('Auth.Emails.VerifyEmail.Fallback')}
                                </p>
                                <p style="margin: 0; font-size: 12px; color: #2563eb; word-break: break-all;">
                                    <a href="${url}" style="color: #2563eb; text-decoration: underline;">${url}</a>
                                </p>
                            </div>
                        `.trim(),
                    });
                },

                /**
                 * ✅ After email verification:
                 * - Create organization only if defaultTeamId is missing
                 * - Covers two cases:
                 *   1) Standard email+password signup
                 *   2) Social login where SSO doesn't mark emailVerified
                 */
                afterEmailVerification: async (rawUser, request) => {
                    const user = rawUser as UserWithDefaultTeam;

                    if (await hasExistingOrganization(user.id)) {
                        // Possibly created via databaseHooks during social login,
                        // or backfilled from an existing membership.
                        return;
                    }

                    await ensureDefaultOrganizationForUser(auth as any, user.id, user.email);
                    console.log(`[auth] user ${user.email} verified by email, default organization created via afterEmailVerification`);
                },
            },

            socialProviders: {
                github: {
                    clientId: process.env.GITHUB_CLIENT_ID as string,
                    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
                },
                google: {
                    clientId: process.env.GOOGLE_CLIENT_ID as string,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                },
            },
        });

        return auth;
    })();
}

const getCachedAuth = createCachedAsyncFactory(createAuth);

export async function getAuth() {
    return getCachedAuth();
}
