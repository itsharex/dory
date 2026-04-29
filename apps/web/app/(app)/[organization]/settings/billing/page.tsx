import { redirect } from 'next/navigation';
import {
    isBillingManagementAvailableForServer,
    isBillingSettingsVisibleForServer,
    isDesktopBillingHandoffRuntimeForServer,
} from '@/lib/runtime/runtime';
import BillingSettingsPageClient from './page.client';

export default async function OrganizationBillingSettingsPage({ params }: { params: Promise<{ organization: string }> }) {
    const { organization } = await params;

    if (!isBillingSettingsVisibleForServer()) {
        redirect(`/${organization}/settings/organization`);
    }

    return (
        <BillingSettingsPageClient
            billingManagementAvailable={isBillingManagementAvailableForServer()}
            desktopBillingHandoff={isDesktopBillingHandoffRuntimeForServer()}
        />
    );
}
