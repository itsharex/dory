import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAnonymousDeleteResponse, isLocalAnonymousDeleteRequest } from '../../lib/auth/anonymous-delete';

test('anonymous delete route matcher only matches the delete endpoint', () => {
    assert.equal(isLocalAnonymousDeleteRequest('/api/auth/delete-anonymous-user'), true);
    assert.equal(isLocalAnonymousDeleteRequest('/api/auth/sign-in/email'), false);
});

test('anonymous delete response clears both Better Auth session cookies', () => {
    const response = buildAnonymousDeleteResponse(new Request('http://localhost:3000/api/auth/delete-anonymous-user', { method: 'POST' }));
    const setCookies = [...response.headers.entries()]
        .filter(([header]) => header === 'set-cookie')
        .map(([, value]) => value);

    assert.equal(response.status, 200);
    assert.equal(setCookies.some(cookie => cookie.includes('better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=lax')), true);
    assert.equal(setCookies.some(cookie => cookie.includes('__Secure-better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=lax')), true);
});
