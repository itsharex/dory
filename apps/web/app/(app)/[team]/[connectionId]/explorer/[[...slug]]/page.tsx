import { ExplorerPage } from '@/components/explorer/explorer-page';

type ExplorerCatchAllPageProps = {
    params: Promise<{
        team: string;
        connectionId: string;
        slug?: string[];
    }>;
};

export default async function ExplorerCatchAllPage({ params }: ExplorerCatchAllPageProps) {
    const { team, connectionId, slug } = await params;

    return (
        <ExplorerPage
            team={team}
            connectionId={connectionId}
            slug={slug}
        />
    );
}
