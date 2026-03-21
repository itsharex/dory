import { redirect } from 'next/navigation';
import QueryClientWrapper from '@/components/@dory/ui/query-client-wrapper/query-client-wrapper';
import { getSessionFromRequest } from '@/lib/auth/session';
import AcceptInvitationClient from './page.client';

export default async function AcceptInvitationPage({
    searchParams,
}: {
    searchParams: Promise<{ invitationId?: string }>;
}) {
    const session = await getSessionFromRequest();
    const { invitationId } = await searchParams;

    if (!session) {
        const callbackURL = `/organization/accept-invitation${invitationId ? `?invitationId=${encodeURIComponent(invitationId)}` : ''}`;
        redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
    }

    return (
        <QueryClientWrapper>
            <AcceptInvitationClient invitationId={invitationId ?? ''} />
        </QueryClientWrapper>
    );
}
