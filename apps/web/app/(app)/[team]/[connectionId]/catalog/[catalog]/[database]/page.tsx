
import DatabaseTabs from './components/database-tabs';

type CatalogDatabasePageProps = {
    team: string;
    connectionId: string;
    catalog: string;
    database: string;
};

export default async function CatalogTablePage({ params }: { params: Promise<CatalogDatabasePageProps> }) {
    const { catalog, database } = await params;

    return (
        <DatabaseTabs catalog={catalog} database={database} />
    );
}
