export function shouldCleanupAnonymousUserAfterDelete(params: {
    pathname: string;
    anonymousUserId: string | null;
    responseOk: boolean;
}) {
    return params.pathname.endsWith('/delete-anonymous-user') && Boolean(params.anonymousUserId) && params.responseOk;
}
