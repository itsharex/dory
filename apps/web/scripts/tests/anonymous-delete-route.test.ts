import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCleanupAnonymousUserAfterDelete } from '../../lib/auth/anonymous-delete';

test('anonymous delete cleanup only runs after the auth delete succeeds', () => {
    assert.equal(
        shouldCleanupAnonymousUserAfterDelete({
            pathname: '/api/auth/delete-anonymous-user',
            anonymousUserId: 'user_anon',
            responseOk: true,
        }),
        true,
    );

    assert.equal(
        shouldCleanupAnonymousUserAfterDelete({
            pathname: '/api/auth/delete-anonymous-user',
            anonymousUserId: 'user_anon',
            responseOk: false,
        }),
        false,
    );
});

test('anonymous delete cleanup does not run for non-anonymous or non-delete requests', () => {
    assert.equal(
        shouldCleanupAnonymousUserAfterDelete({
            pathname: '/api/auth/sign-in/email',
            anonymousUserId: 'user_anon',
            responseOk: true,
        }),
        false,
    );

    assert.equal(
        shouldCleanupAnonymousUserAfterDelete({
            pathname: '/api/auth/delete-anonymous-user',
            anonymousUserId: null,
            responseOk: true,
        }),
        false,
    );
});
