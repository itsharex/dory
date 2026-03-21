import { redirect } from 'next/navigation';

export default async function OrganizationSettingsIndex({
    params,
}: {
    params: Promise<{ organization: string }>;
}) {
    const { organization } = await params;
    redirect(`/${organization}/settings/organization`);
}

