'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { Input } from '@/registry/new-york-v4/ui/input';
import { Label } from '@/registry/new-york-v4/ui/label';
import { getFullOrganization, getOrganizationAccess, slugifyOrganizationName, updateOrganization } from '@/lib/organization/api';

export default function OrganizationSettingsPage() {
    const params = useParams<{ organization: string }>();
    const organizationSlug = params.organization;
    const t = useTranslations('OrganizationSettings.Organization');
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');

    const organizationQuery = useQuery({
        queryKey: ['organization-full', organizationSlug],
        queryFn: () => getFullOrganization({ organizationSlug }),
    });
    const accessQuery = useQuery({
        queryKey: ['organization-access', organizationSlug],
        queryFn: () => getOrganizationAccess(),
    });

    useEffect(() => {
        if (!organizationQuery.data) return;
        setName(organizationQuery.data.name ?? '');
        setSlug(organizationQuery.data.slug ?? '');
    }, [organizationQuery.data]);

    const updateMutation = useMutation({
        mutationFn: () => {
            const normalizedSlug = slugifyOrganizationName(slug);
            if (!slug.trim()) {
                throw new Error(t('Errors.SlugRequired'));
            }

            if (normalizedSlug !== slug.trim()) {
                throw new Error(t('Errors.SlugInvalid'));
            }

            return updateOrganization({
                organizationId: organizationQuery.data!.id,
                name: name.trim(),
                slug: slug.trim(),
            });
        },
        onSuccess: async updated => {
            toast.success(t('Toasts.Updated'));
            await queryClient.invalidateQueries({ queryKey: ['organization-full'] });
            await queryClient.invalidateQueries({ queryKey: ['organization-list'] });
            if (updated?.slug && updated.slug !== organizationSlug) {
                window.location.assign(`/${updated.slug}/settings/organization`);
            }
        },
        onError: error => {
            toast.error(error instanceof Error ? error.message : t('Toasts.UpdateFailed'));
        },
    });

    const organization = organizationQuery.data;
    const access = accessQuery.data;
    const canUpdate = Boolean(access?.permissions.organization.update);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('CardTitle')}</CardTitle>
                <CardDescription>{t('CardDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-2">
                    <Label htmlFor="organization-name">{t('Fields.Name')}</Label>
                    <Input
                        id="organization-name"
                        value={name}
                        onChange={event => setName(event.target.value)}
                        disabled={!organization || !canUpdate || updateMutation.isPending}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="organization-slug">{t('Fields.Slug')}</Label>
                    <Input
                        id="organization-slug"
                        value={slug}
                        onChange={event => setSlug(event.target.value)}
                        disabled={!organization || !canUpdate || updateMutation.isPending}
                    />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <div>
                        <div className="font-medium">{t('Fields.OrganizationId')}</div>
                        <div className="text-muted-foreground">{organization?.id ?? t('Loading')}</div>
                    </div>
                    <Button
                        onClick={() => updateMutation.mutate()}
                        disabled={!organization || !canUpdate || !name.trim() || !slug.trim() || updateMutation.isPending}
                    >
                        {updateMutation.isPending ? t('Saving') : t('SaveChanges')}
                    </Button>
                </div>
                {!canUpdate ? (
                    <p className="text-sm text-muted-foreground">
                        {t('ReadOnlyHint')}
                    </p>
                ) : null}
            </CardContent>
        </Card>
    );
}
