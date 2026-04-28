import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCreateOrganizationRequest } from '../../lib/auth/organization-provisioning';

test('buildCreateOrganizationRequest omits headers for server-owned provisioning', () => {
    const request = buildCreateOrganizationRequest({
        auth: {},
        userId: 'user_1',
        name: 'User workspace',
        slug: 'user-workspace',
        provisioningKind: 'system_default',
    });

    assert.equal('headers' in request, false);
    assert.deepEqual(request.body, {
        name: 'User workspace',
        slug: 'user-workspace',
        userId: 'user_1',
        keepCurrentActiveOrganization: false,
    });
});

test('buildCreateOrganizationRequest preserves headers for session-backed organization creation', () => {
    const headers = new Headers({ cookie: 'better-auth.session_token=session_1' });
    const request = buildCreateOrganizationRequest({
        auth: {},
        headers,
        userId: 'user_1',
        name: 'Manual workspace',
        slug: 'manual-workspace',
        provisioningKind: 'manual',
    });

    assert.equal(request.headers, headers);
    assert.deepEqual(request.body, {
        name: 'Manual workspace',
        slug: 'manual-workspace',
        userId: 'user_1',
        keepCurrentActiveOrganization: false,
    });
});
