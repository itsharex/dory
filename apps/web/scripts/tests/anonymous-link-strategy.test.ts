import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAnonymousOrganizationLinkDecision } from '../../lib/auth/anonymous-link-strategy';

test('merges guest organizations into the only system default organization', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'anonymous' }],
        userOrganizations: [{ id: 'org_default', provisioningKind: 'system_default' }],
        newActiveOrganizationId: null,
    });

    assert.deepEqual(decision, {
        action: 'merge',
        primarySourceOrganizationId: 'org_guest',
        sourceOrganizationIds: ['org_guest'],
        targetOrganizationId: 'org_default',
    });
});

test('prefers an explicit active manual organization over the system default organization', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'anonymous' }],
        userOrganizations: [
            { id: 'org_default', provisioningKind: 'system_default' },
            { id: 'org_manual', provisioningKind: 'manual' },
        ],
        newActiveOrganizationId: 'org_manual',
    });

    assert.deepEqual(decision, {
        action: 'merge',
        primarySourceOrganizationId: 'org_guest',
        sourceOrganizationIds: ['org_guest'],
        targetOrganizationId: 'org_manual',
    });
});

test('promotes the guest organization when both default and manual organizations exist without an explicit target', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'anonymous' }],
        userOrganizations: [
            { id: 'org_default', provisioningKind: 'system_default' },
            { id: 'org_manual', provisioningKind: 'manual' },
        ],
        newActiveOrganizationId: null,
    });

    assert.deepEqual(decision, {
        action: 'promote',
        primarySourceOrganizationId: 'org_guest',
        sourceOrganizationIds: ['org_guest'],
        targetOrganizationId: null,
    });
});

test('promotes the guest organization when no merge target exists', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'anonymous' }],
        userOrganizations: [],
        newActiveOrganizationId: null,
    });

    assert.deepEqual(decision, {
        action: 'promote',
        primarySourceOrganizationId: 'org_guest',
        sourceOrganizationIds: ['org_guest'],
        targetOrganizationId: null,
    });
});

test('allows an explicit active organization with unknown provisioning kind', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'anonymous' }],
        userOrganizations: [{ id: 'org_legacy', provisioningKind: null }],
        newActiveOrganizationId: 'org_legacy',
    });

    assert.deepEqual(decision, {
        action: 'merge',
        primarySourceOrganizationId: 'org_guest',
        sourceOrganizationIds: ['org_guest'],
        targetOrganizationId: 'org_legacy',
    });
});

test('does not merge when the source organization is not explicitly marked anonymous', () => {
    const decision = resolveAnonymousOrganizationLinkDecision({
        sourceOrganizations: [{ id: 'org_guest', provisioningKind: 'manual' }],
        userOrganizations: [{ id: 'org_default', provisioningKind: 'system_default' }],
        newActiveOrganizationId: null,
    });

    assert.equal(decision, null);
});
