'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
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
    const isProPlan = billingStatus?.plan === 'pro';
    const showProPlan = !isLoading && !billingStatusQuery.isError && billingStatus?.plan !== 'pro';
    const billingDescription = billingStatusQuery.isError
        ? billingStatusQuery.error instanceof Error
            ? billingStatusQuery.error.message
            : t('Errors.LoadBillingFailed')
        : isLoading
          ? t('LoadingBillingStatus')
          : getStatusDescription(billingStatus?.subscriptionStatus ?? null, billingStatus?.cancelAtPeriodEnd ?? false, billingStatus?.periodEnd ?? null, t, formatWithFallback);

    const currentPeriodEnd = isProPlan ? formatWithFallback(billingStatus?.periodEnd ?? null) : null;
    const hobbyFeatures = [t('Hobby.Features.DatabaseConnections'), t('Hobby.Features.DatabaseTypes'), t('Hobby.Features.AiQuota'), t('Hobby.Features.CommunitySupport')];
    const proFeatures = [t('Pro.Features.UnlimitedConnections'), t('Pro.Features.AiQuota'), t('Pro.Features.Byok'), t('Pro.Features.PrioritySupport')];

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
                <div className={showProPlan ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
                    <div className="rounded-lg border bg-muted/30 px-4 py-4">
                        <div className="text-sm font-medium">{t('CurrentPlan')}</div>
                        <div className="mt-2 text-2xl font-semibold">{isLoading ? t('Loading') : currentPlanLabel}</div>
                        {/* {isProPlan || isLoading || billingStatusQuery.isError ? <p className="mt-2 text-sm text-muted-foreground">{billingDescription}</p> : null} */}

                        {!isLoading && !billingStatusQuery.isError ? (
                            <ul className="mt-4 space-y-3 text-sm">
                                {(isProPlan ? proFeatures : hobbyFeatures).map(feature => (
                                    <li key={feature} className="flex items-center gap-2">
                                        <Check className="size-4 text-primary" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : null}

                        {currentPeriodEnd ? (
                            <div className="mt-4 grid gap-3">
                                <div className="flex items-center justify-between gap-4 rounded-md border bg-background/60 px-3 py-2 text-sm">
                                    <span className="font-medium">{t('Details.CurrentPeriodEnd')}</span>
                                    <span className="text-right text-muted-foreground">{currentPeriodEnd}</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {showProPlan ? (
                        <div className="flex flex-col rounded-lg border bg-background px-4 py-4">
                            <div className="text-sm font-medium text-muted-foreground">{t('Pro.Label')}</div>
                            <div className="mt-2 text-2xl font-semibold">{t('Pro.Title')}</div>
                            <ul className="mt-4 space-y-3 text-sm">
                                {proFeatures.map(feature => (
                                    <li key={feature} className="flex items-center gap-2">
                                        <Check className="size-4 text-primary" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-auto pt-5">
                                {canManageBilling ? (
                                    <Button className="w-full" onClick={() => upgradeMutation.mutate()} disabled={upgradeMutation.isPending || isLoading || !organization}>
                                        {upgradeMutation.isPending ? t('Redirecting') : t('UpgradeToPro')}
                                    </Button>
                                ) : (
                                    <p className="text-sm text-muted-foreground">{t('ReadOnlyHint')}</p>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                {billingStatus?.cancelAtPeriodEnd ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                        {t('CancellationScheduled', { date: formatWithFallback(billingStatus.cancelAt || billingStatus.periodEnd) })}
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                    {billingStatus?.isManageable && canManageBilling ? (
                        <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending || isLoading || !organization}>
                            {portalMutation.isPending ? t('Opening') : t('ManageBilling')}
                        </Button>
                    ) : null}
                </div>

                {!canManageBilling && !showProPlan ? <p className="text-sm text-muted-foreground">{t('ReadOnlyHint')}</p> : null}
            </CardContent>
        </Card>
    );
}
