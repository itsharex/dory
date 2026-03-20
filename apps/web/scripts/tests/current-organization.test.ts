import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getActiveOrganizationIdFromSession,
    getLegacyDefaultTeamIdFromSession,
    resolveCurrentOrganizationId,
} from '../../lib/auth/current-organization';
import {
    buildElectronTicketUser,
    buildSessionOrganizationPatch,
    resolveOrganizationIdForSession,
    resolveOrganizationIdFromTicket,
    shouldBackfillLegacyDefaultTeamId,
    shouldCreateDefaultOrganization,
} from '../../lib/auth/migration-state';

test('resolveCurrentOrganizationId prefers active organization over legacy default team', () => {
    const session = {
        session: { activeOrganizationId: 'org_active' },
        user: { defaultTeamId: 'team_legacy' },
    } as any;

    assert.equal(resolveCurrentOrganizationId(session), 'org_active');
    assert.equal(getActiveOrganizationIdFromSession(session), 'org_active');
    assert.equal(getLegacyDefaultTeamIdFromSession(session), 'team_legacy');
});

test('resolveCurrentOrganizationId falls back to legacy default team when needed', () => {
    const session = {
        session: { activeOrganizationId: null },
        user: { defaultTeamId: 'team_legacy' },
    } as any;

    assert.equal(resolveCurrentOrganizationId(session), 'team_legacy');
});

test('resolveCurrentOrganizationId returns null when neither source is present', () => {
    assert.equal(resolveCurrentOrganizationId(null), null);
    assert.equal(resolveCurrentOrganizationId({ session: {}, user: {} } as any), null);
});

test('resolveOrganizationIdForSession falls back from active org to legacy to membership', () => {
    assert.equal(
        resolveOrganizationIdForSession({
            activeOrganizationId: 'org_active',
            legacyDefaultTeamId: 'team_legacy',
            membershipOrganizationId: 'org_membership',
        }),
        'org_active',
    );
    assert.equal(
        resolveOrganizationIdForSession({
            legacyDefaultTeamId: 'team_legacy',
            membershipOrganizationId: 'org_membership',
        }),
        'team_legacy',
    );
    assert.equal(
        resolveOrganizationIdForSession({
            legacyDefaultTeamId: null,
            membershipOrganizationId: 'org_membership',
        }),
        'org_membership',
    );
});

test('shouldCreateDefaultOrganization only allows verified users without existing orgs outside desktop', () => {
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: null,
            emailVerified: true,
        }),
        true,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: 'org_existing',
            emailVerified: true,
        }),
        false,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: true,
            existingOrganizationId: null,
            emailVerified: true,
        }),
        false,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: null,
            emailVerified: false,
        }),
        false,
    );
});

test('shouldBackfillLegacyDefaultTeamId only writes when missing or divergent', () => {
    assert.equal(
        shouldBackfillLegacyDefaultTeamId({
            currentLegacyDefaultTeamId: null,
            organizationId: 'org_new',
        }),
        true,
    );
    assert.equal(
        shouldBackfillLegacyDefaultTeamId({
            currentLegacyDefaultTeamId: 'org_new',
            organizationId: 'org_new',
        }),
        false,
    );
    assert.equal(
        shouldBackfillLegacyDefaultTeamId({
            currentLegacyDefaultTeamId: 'org_old',
            organizationId: 'org_new',
        }),
        false,
    );
});

test('resolveOrganizationIdFromTicket prefers active organization then legacy default team', () => {
    assert.equal(
        resolveOrganizationIdFromTicket({
            activeOrganizationId: 'org_active',
            legacyDefaultTeamId: 'team_legacy',
        }),
        'org_active',
    );
    assert.equal(
        resolveOrganizationIdFromTicket({
            activeOrganizationId: null,
            legacyDefaultTeamId: 'team_legacy',
        }),
        'team_legacy',
    );
});

test('buildElectronTicketUser keeps active organization and backfills legacy default team', () => {
    assert.deepEqual(
        buildElectronTicketUser({
            id: 'user_1',
            email: 'user@example.com',
            name: 'User',
            image: null,
            emailVerified: true,
            activeOrganizationId: 'org_active',
            legacyDefaultTeamId: null,
        }),
        {
            id: 'user_1',
            email: 'user@example.com',
            name: 'User',
            image: null,
            emailVerified: true,
            activeOrganizationId: 'org_active',
            defaultTeamId: 'org_active',
        },
    );
});

test('buildSessionOrganizationPatch only returns a patch when an organization can be resolved', () => {
    assert.deepEqual(
        buildSessionOrganizationPatch({
            activeOrganizationId: 'org_active',
            legacyDefaultTeamId: 'team_legacy',
        }),
        { activeOrganizationId: 'org_active' },
    );
    assert.deepEqual(
        buildSessionOrganizationPatch({
            activeOrganizationId: null,
            legacyDefaultTeamId: 'team_legacy',
        }),
        { activeOrganizationId: 'team_legacy' },
    );
    assert.equal(
        buildSessionOrganizationPatch({
            activeOrganizationId: null,
            legacyDefaultTeamId: null,
        }),
        null,
    );
});
