import { redirect } from 'next/navigation';
import { getSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentOrganizationId } from '@/lib/auth/current-organization';
import { getFirstOrganizationForUser } from '@/lib/server/organization';
import { isAnonymousUser } from '@/lib/auth/anonymous-user';

export default async function Page() {
    const session = await getSessionFromRequest();

    if (!session) redirect('/sign-in');
    const currentOrganizationId = resolveCurrentOrganizationId(session);

    if (!currentOrganizationId) {
        const fallbackOrganization = await getFirstOrganizationForUser(session.user.id);
        if (fallbackOrganization) {
            redirect(`/${fallbackOrganization.slug}/connections`);
        }

        if (isAnonymousUser(session.user)) {
            redirect('/sign-in');
        }

        redirect('/create-organization');
    }

    redirect(`/${currentOrganizationId}/connections`);
}
