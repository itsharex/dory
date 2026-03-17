import type { ReactNode } from 'react';
import { ExplorerLayout } from './components/explorer-layout';

type ExplorerLayoutParams = {
    team: string;
    connectionId: string;
};

export default async function ExplorerPageLayout({
    params: _params,
    children,
}: {
    params: Promise<ExplorerLayoutParams>;
    children: ReactNode;
}) {
    return (
        <ExplorerLayout>{children}</ExplorerLayout>
    );
}
