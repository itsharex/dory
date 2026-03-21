import QueryClientWrapper from '@/components/@dory/ui/query-client-wrapper/query-client-wrapper';
import { getSessionFromRequest } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import CreateOrganizationClient from './page.client';

export default async function CreateOrganizationPage() {
    const session = await getSessionFromRequest();
    if (!session) {
        redirect('/sign-in?callbackURL=%2Fcreate-organization');
    }

    return (
        <QueryClientWrapper>
            <CreateOrganizationClient />
        </QueryClientWrapper>
    );
}
