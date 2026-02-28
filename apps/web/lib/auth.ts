import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins';
import { schema } from '@/lib/database/schema';
import { getDatabaseProvider } from '@/lib/database/provider';
import { sendEmail } from './email';
import { PostgresDBClient } from '@/types';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { getClient } from './database/postgres/client';
import { getServerLocale } from './i18n/server-locale';
import { translate } from './i18n/i18n';

let _authPromise: ReturnType<typeof createAuth> | null = null;

// User type with defaultTeamId, used for narrowing in hooks
type UserWithDefaultTeam = {
    id: string;
    email: string | null;
    emailVerified: boolean;
    defaultTeamId?: string | null;
};

function createAuth() {
    return (async () => {
        const db = (await getClient()) as PostgresDBClient;
        const provider = getDatabaseProvider() === 'pglite' ? 'pg' : 'pg';
        const runtime = process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim();
        const isDesktop = runtime === 'desktop';
        const desktopOrigin =
            process.env.DORY_ELECTRON_ORIGIN?.trim() ||
            process.env.NEXT_PUBLIC_DORY_ELECTRON_ORIGIN?.trim() ||
            (isDesktop ? `http://127.0.0.1:${process.env.PORT ?? 3000}` : '');

        console.log('[auth] TRUSTED_ORIGINS =', process.env.TRUSTED_ORIGINS);

        /**
         * Shared helper: create a default team + teamMembers relation, then set defaultTeamId
         * - Used for both email signup and social login
         */
        async function ensureDefaultTeamForUser(userId: string, email: string | null | undefined) {
            const locale = await getServerLocale();
            const t = (key: string, values?: Record<string, unknown>) => translate(locale, key, values);

            // Guard: skip if defaultTeamId already exists
            const [existingUser] = await db.select({ defaultTeamId: schema.user.defaultTeamId }).from(schema.user).where(eq(schema.user.id, userId));

            if (existingUser?.defaultTeamId) {
                return;
            }

            const teamId = uuidv7();
            const userTeamRelId = uuidv7();

            await db.transaction(async tx => {
                // 1) Create team
                await tx.insert(schema.teams).values({
                    id: teamId,
                    name: t('Auth.TeamName', { name: email ?? t('Auth.TeamDefaultName') }),
                    // Adjust fields for your schema
                    ownerUserId: userId,
                });

                // 2) teamMembers relation: owner
                await tx.insert(schema.teamMembers).values({
                    id: userTeamRelId,
                    userId,
                    teamId,
                    role: 'owner',
                });

                // 3) Update user.defaultTeamId
                await tx.update(schema.user).set({ defaultTeamId: teamId }).where(eq(schema.user.id, userId));
            });

            console.log(`[auth] default team ${teamId} created for user ${userId}`);
        }

        return betterAuth({
            database: drizzleAdapter(db, { provider, schema }),
            plugins: [jwt()],
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

                            // Skip if default team already exists
                            if (user.defaultTeamId) return;

                            // For social login:
                            //   - If SSO marks email as verified, emailVerified is true
                            //   → Create the team immediately here
                            //
                            // For email+password signup:
                            //   - With requireEmailVerification, emailVerified is usually false
                            //   → Create the team in afterEmailVerification instead
                            if (user.emailVerified) {
                                await ensureDefaultTeamForUser(user.id, user.email);
                            }
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
                                    <img src="https://demo.getdory.dev/logo.png" width="32" height="32" alt="${t('Auth.Emails.ResetPassword.BrandName')}" style="display: inline-block; border-radius: 6px;" />
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
                                    <img src="https://demo.getdory.dev/logo.png" width="32" height="32" alt="${t('Auth.Emails.VerifyEmail.BrandName')}" style="display: inline-block; border-radius: 6px;" />
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
                 * - Create team only if defaultTeamId is missing
                 * - Covers two cases:
                 *   1) Standard email+password signup
                 *   2) Social login where SSO doesn't mark emailVerified
                 */
                afterEmailVerification: async (rawUser, request) => {
                    const user = rawUser as UserWithDefaultTeam;

                    if (user.defaultTeamId) {
                        // Possibly created via databaseHooks during social login
                        return;
                    }

                    await ensureDefaultTeamForUser(user.id, user.email);
                    console.log(`[auth] user ${user.email} verified by email, default team created via afterEmailVerification`);
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
    })();
}

export async function getAuth() {
    if (!_authPromise) _authPromise = createAuth();
    return _authPromise;
}
