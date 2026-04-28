import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getActiveOrganizationIdFromSession,
    resolveCurrentOrganizationId,
    resolveCurrentOrganizationIdStrict,
} from '../../lib/auth/current-organization';
import {
    buildElectronTicketUser,
    buildSessionOrganizationPatch,
    resolveOrganizationIdForSession,
    resolveOrganizationIdFromTicket,
    shouldCreateDefaultOrganization,
} from '../../lib/auth/migration-state';

test('resolveCurrentOrganizationId returns the active organization id when present', () => {
    const session = {
        session: { activeOrganizationId: 'org_active' },
    } as any;

    assert.equal(resolveCurrentOrganizationId(session), 'org_active');
    assert.equal(getActiveOrganizationIdFromSession(session), 'org_active');
});

test('resolveCurrentOrganizationId returns null when active organization is missing', () => {
    const session = {
        session: { activeOrganizationId: null },
    } as any;

    assert.equal(resolveCurrentOrganizationId(session), null);
    assert.equal(resolveCurrentOrganizationIdStrict(session), null);
});

test('resolveCurrentOrganizationIdStrict only trusts active organization id', () => {
    const session = {
        session: { activeOrganizationId: 'org_active' },
        user: { defaultTeamId: 'team_legacy' },
    } as any;

    assert.equal(resolveCurrentOrganizationIdStrict(session), 'org_active');
});

test('resolveCurrentOrganizationId returns null when neither source is present', () => {
    assert.equal(resolveCurrentOrganizationId(null), null);
    assert.equal(resolveCurrentOrganizationId({ session: {}, user: {} } as any), null);
});

test('resolveOrganizationIdForSession falls back from active org to legacy to membership', () => {
    assert.equal(
        resolveOrganizationIdForSession({
            activeOrganizationId: 'org_active',
            membershipOrganizationId: 'org_membership',
        }),
        'org_active',
    );
    assert.equal(
        resolveOrganizationIdForSession({
            membershipOrganizationId: 'org_membership',
        }),
        'org_membership',
    );
});

test('shouldCreateDefaultOrganization creates immediately when email verification is disabled', () => {
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: null,
            emailVerified: false,
            requireEmailVerification: false,
        }),
        true,
    );
});

test('shouldCreateDefaultOrganization waits for verified users when email verification is enabled', () => {
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: null,
            emailVerified: true,
            requireEmailVerification: true,
        }),
        true,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: 'org_existing',
            emailVerified: true,
            requireEmailVerification: true,
        }),
        false,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: true,
            existingOrganizationId: null,
            emailVerified: true,
            requireEmailVerification: true,
        }),
        false,
    );
    assert.equal(
        shouldCreateDefaultOrganization({
            isDesktop: false,
            existingOrganizationId: null,
            emailVerified: false,
            requireEmailVerification: true,
        }),
        false,
    );
});

test('resolveOrganizationIdFromTicket only trusts active organization', () => {
    assert.equal(
        resolveOrganizationIdFromTicket({
            activeOrganizationId: 'org_active',
        }),
        'org_active',
    );
    assert.equal(
        resolveOrganizationIdFromTicket({
            activeOrganizationId: null,
        }),
        null,
    );
});

test('buildElectronTicketUser only includes active organization in new tickets', () => {
    assert.deepEqual(
        buildElectronTicketUser({
            id: 'user_1',
            email: 'user@example.com',
            name: 'User',
            image: null,
            emailVerified: true,
            activeOrganizationId: 'org_active',
        }),
        {
            id: 'user_1',
            email: 'user@example.com',
            name: 'User',
            image: null,
            emailVerified: true,
            isAnonymous: false,
            activeOrganizationId: 'org_active',
        },
    );
});

test('buildSessionOrganizationPatch only returns a patch when active organization exists', () => {
    assert.deepEqual(
        buildSessionOrganizationPatch({
            activeOrganizationId: 'org_active',
        }),
        { activeOrganizationId: 'org_active' },
    );
    assert.equal(
        buildSessionOrganizationPatch({
            activeOrganizationId: null,
        }),
        null,
    );
});
