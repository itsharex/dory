import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionFromRequest } from '@/lib/auth/session';
import SWRConfigWrapper from '@/components/@dory/ui/swr-config-wrapper';
import QueryClientWrapper from '@/components/@dory/ui/query-client-wrapper/query-client-wrapper';

export default async function AppRootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const session = await getSessionFromRequest();

  const userAgent = headersList.get('user-agent') ?? '';
  const isElectron = userAgent.includes('Electron');

  const tokenCookie = (await cookies()).get('dory_access_token')?.value;
  const hasElectronToken = Boolean(tokenCookie && tokenCookie.length > 20);

  if (!isElectron && !session) redirect('/sign-in');
  if (isElectron && !session && !hasElectronToken) redirect('/sign-in');

  return (
    <SWRConfigWrapper>
      <QueryClientWrapper>{children}</QueryClientWrapper>
    </SWRConfigWrapper>
  );
}
