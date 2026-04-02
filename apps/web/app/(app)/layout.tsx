import { redirect } from 'next/navigation';
import { getSessionFromRequest } from '@/lib/auth/session';
import SWRConfigWrapper from '@/components/@dory/ui/swr-config-wrapper';
import QueryClientWrapper from '@/components/@dory/ui/query-client-wrapper/query-client-wrapper';

export default async function AppRootLayout({ children }: { children: React.ReactNode }) {
    const session = await getSessionFromRequest();
    if (!session) redirect('/sign-in');

    return (
        <SWRConfigWrapper>
            <QueryClientWrapper>{children}</QueryClientWrapper>
        </SWRConfigWrapper>
    );
}
