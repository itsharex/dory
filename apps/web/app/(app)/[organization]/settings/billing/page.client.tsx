'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { getOrganizationBillingStatus, openOrganizationBillingPortal, upgradeOrganizationToPro } from '@/lib/billing/api';
import { getOrganizationAccess, getFullOrganization } from '@/lib/organization/api';

function formatDate(value: string | null, fallback: string) {
    if (!value) {
        return fallback;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function getStatusDescription(
    status: string | null,
    cancelAtPeriodEnd: boolean,
    periodEnd: string | null,
    t: (key: string, values?: Record<string, string>) => string,
    formatWithFallback: (value: string | null) => string,
) {
    if (cancelAtPeriodEnd) {
        return t('Status.CancelAtPeriodEnd', { date: formatWithFallback(periodEnd) });
    }

    if (!status) {
        return t('Status.NoSubscription');
    }

    if (status === 'canceled') {
        return t('Status.Canceled');
    }

    if (status === 'incomplete' || status === 'incomplete_expired' || status === 'past_due' || status === 'unpaid') {
        return t('Status.Inactive');
    }

    return t('Status.Reported', { status });
}

export default function BillingSettingsPageClient() {
    const params = useParams<{ organization: string }>();
    const organizationSlug = params.organization;
    const t = useTranslations('OrganizationSettings.Billing');
    const formatWithFallback = (value: string | null) => formatDate(value, t('NotAvailable'));

    const organizationQuery = useQuery({
        queryKey: ['organization-full', organizationSlug],
        queryFn: () => getFullOrganization({ organizationSlug }),
        retry: false,
    });
    const accessQuery = useQuery({
        queryKey: ['organization-access', organizationSlug, organizationQuery.data?.id],
        queryFn: () => getOrganizationAccess(organizationQuery.data!.id),
        enabled: Boolean(organizationQuery.data?.id),
        retry: false,
    });
    const billingStatusQuery = useQuery({
        queryKey: ['organization-billing', organizationSlug, organizationQuery.data?.id],
        queryFn: () => getOrganizationBillingStatus(organizationQuery.data!.id),
        enabled: Boolean(organizationQuery.data?.id),
        retry: false,
    });

    const upgradeMutation = useMutation({
        mutationFn: async () => {
            if (!organizationQuery.data?.id) {
                throw new Error(t('Errors.OrganizationNotFound'));
            }

            await upgradeOrganizationToPro(organizationQuery.data.id, organizationSlug);
        },
        onError: error => {
            toast.error(error instanceof Error ? error.message : t('Errors.CheckoutFailed'));
        },
    });

    const portalMutation = useMutation({
        mutationFn: async () => {
            if (!organizationQuery.data?.id || !billingStatusQuery.data?.subscriptionId) {
                throw new Error(t('Errors.NoManageableSubscription'));
            }

            await openOrganizationBillingPortal(organizationQuery.data.id, organizationSlug, billingStatusQuery.data.subscriptionId);
        },
        onError: error => {
            toast.error(error instanceof Error ? error.message : t('Errors.PortalFailed'));
        },
    });

    const canManageBilling = accessQuery.data?.role === 'owner';
    const billingStatus = billingStatusQuery.data;
    const organization = organizationQuery.data;
    const isOrganizationLoading = organizationQuery.isLoading;
    const isBillingLoading = organizationQuery.isSuccess && billingStatusQuery.isLoading;
    const isLoading = isOrganizationLoading || isBillingLoading;
    const currentPlanLabel = billingStatus?.plan === 'pro' ? t('Plan.Pro') : t('Plan.Hobby');
    const billingDescription = billingStatusQuery.isError
        ? billingStatusQuery.error instanceof Error
            ? billingStatusQuery.error.message
            : t('Errors.LoadBillingFailed')
        : isLoading
          ? t('LoadingBillingStatus')
          : getStatusDescription(
                billingStatus?.subscriptionStatus ?? null,
                billingStatus?.cancelAtPeriodEnd ?? false,
                billingStatus?.periodEnd ?? null,
                t,
                formatWithFallback,
            );

    const detailRows = useMemo(
        () => [
            { label: t('Details.Plan'), value: currentPlanLabel },
            { label: t('Details.SubscriptionStatus'), value: billingStatus?.subscriptionStatus ?? t('NoSubscription') },
            { label: t('Details.StripeSubscriptionId'), value: billingStatus?.stripeSubscriptionId ?? t('NotAvailable') },
            { label: t('Details.CurrentPeriodEnd'), value: formatWithFallback(billingStatus?.periodEnd ?? null) },
        ],
        [billingStatus, currentPlanLabel, t],
    );

    if (organizationQuery.isError) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('Title')}</CardTitle>
                    <CardDescription>{t('UnavailableDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        {organizationQuery.error instanceof Error ? organizationQuery.error.message : t('Errors.LoadOrganizationFailed')}
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!isLoading && !organization) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{t('Title')}</CardTitle>
                    <CardDescription>{t('UnavailableDescription')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{t('Errors.UnresolvedFromUrl')}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('Title')}</CardTitle>
                <CardDescription>{t('Description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="rounded-lg border bg-muted/30 px-4 py-4">
                    <div className="text-sm font-medium">{t('CurrentPlan')}</div>
                    <div className="mt-2 text-2xl font-semibold">{isLoading ? t('Loading') : currentPlanLabel}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{billingDescription}</p>
                </div>

                <div className="grid gap-3">
                    {detailRows.map(row => (
                        <div key={row.label} className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                            <span className="font-medium">{row.label}</span>
                            <span className="text-muted-foreground">{row.value}</span>
                        </div>
                    ))}
                </div>

                {billingStatus?.cancelAtPeriodEnd ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        {t('CancellationScheduled', { date: formatWithFallback(billingStatus.cancelAt || billingStatus.periodEnd) })}
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    {billingStatus?.plan !== 'pro' && canManageBilling ? (
                        <Button onClick={() => upgradeMutation.mutate()} disabled={upgradeMutation.isPending || isLoading || !organization}>
                            {upgradeMutation.isPending ? t('Redirecting') : t('UpgradeToPro')}
                        </Button>
                    ) : null}

                    {billingStatus?.isManageable && canManageBilling ? (
                        <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending || isLoading || !organization}>
                            {portalMutation.isPending ? t('Opening') : t('ManageBilling')}
                        </Button>
                    ) : null}
                </div>

                {!canManageBilling ? (
                    <p className="text-sm text-muted-foreground">{t('ReadOnlyHint')}</p>
                ) : null}
            </CardContent>
        </Card>
    );
}
