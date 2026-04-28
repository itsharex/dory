import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCloudflareAiGatewayHeaders, getAiQuotaConfig, getCurrentUtcMonthWindow, getLimitForPlan, parseMonthlyTokenLimit } from '../../lib/ai/usage-quota';
import { getAiQuotaExemptOwnerEmails, isOrganizationEligibleForAiQuotaExemption } from '../../lib/organization/metadata';

test('AI quota env parsing treats unset, zero, and invalid values as disabled', () => {
    assert.equal(parseMonthlyTokenLimit(undefined), null);
    assert.equal(parseMonthlyTokenLimit(''), null);
    assert.equal(parseMonthlyTokenLimit('0'), null);
    assert.equal(parseMonthlyTokenLimit('-1'), null);
    assert.equal(parseMonthlyTokenLimit('abc'), null);
});

test('AI quota env parsing accepts positive integer values', () => {
    assert.equal(parseMonthlyTokenLimit('1'), 1);
    assert.equal(parseMonthlyTokenLimit('1000000'), 1000000);
    assert.equal(parseMonthlyTokenLimit('10.9'), 10);
});

test('AI quota config maps plan limits from environment', () => {
    const config = getAiQuotaConfig({
        DORY_AI_QUOTA_HOBBY_MONTHLY_TOKENS: '1000',
        DORY_AI_QUOTA_PRO_MONTHLY_TOKENS: '9000',
    });

    assert.equal(getLimitForPlan('hobby', config), 1000);
    assert.equal(getLimitForPlan('pro', config), 9000);
});

test('AI quota month window uses UTC calendar month', () => {
    const window = getCurrentUtcMonthWindow(new Date('2026-04-28T12:30:00.000Z'));

    assert.equal(window.from.toISOString(), '2026-04-01T00:00:00.000Z');
    assert.equal(window.to.toISOString(), '2026-05-01T00:00:00.000Z');
    assert.equal(window.resetAt.toISOString(), '2026-05-01T00:00:00.000Z');
});

test('Cloudflare metadata includes exactly the planned five metadata keys', () => {
    const headers = buildCloudflareAiGatewayHeaders(
        {
            organizationId: 'org_123',
            userId: 'usr_123',
            userEmail: 'user@example.com',
            feature: 'chat_stream',
            plan: 'pro',
        },
        'cloudflare',
    );

    assert.ok(headers);
    assert.equal(headers['cf-aig-collect-log-payload'], 'false');

    const metadata = JSON.parse(headers['cf-aig-metadata']);
    assert.deepEqual(Object.keys(metadata), ['email', 'userId', 'orgId', 'feature', 'plan']);
    assert.deepEqual(metadata, {
        email: 'user@example.com',
        userId: 'usr_123',
        orgId: 'org_123',
        feature: 'chat_stream',
        plan: 'pro',
    });
});

test('Cloudflare metadata is not added for direct providers', () => {
    const headers = buildCloudflareAiGatewayHeaders(
        {
            organizationId: 'org_123',
            userId: 'usr_123',
            userEmail: 'user@example.com',
            feature: 'chat_stream',
            plan: 'pro',
        },
        'direct',
    );

    assert.equal(headers, null);
});

test('AI quota exemption owner allowlist defaults to the demo organization owner', () => {
    assert.deepEqual(getAiQuotaExemptOwnerEmails({}), ['demo@getdory.dev']);
    assert.equal(isOrganizationEligibleForAiQuotaExemption('demo@getdory.dev', {}), true);
    assert.equal(isOrganizationEligibleForAiQuotaExemption('customer@example.com', {}), false);
});

test('AI quota exemption owner allowlist can be configured explicitly', () => {
    const env = {
        DORY_AI_QUOTA_EXEMPT_ORG_OWNER_EMAILS: 'demo@getdory.dev, internal@getdory.dev',
    };

    assert.deepEqual(getAiQuotaExemptOwnerEmails(env), ['demo@getdory.dev', 'internal@getdory.dev']);
    assert.equal(isOrganizationEligibleForAiQuotaExemption('internal@getdory.dev', env), true);
    assert.equal(isOrganizationEligibleForAiQuotaExemption('customer@example.com', env), false);
});
