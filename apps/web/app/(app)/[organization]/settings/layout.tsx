import Link from 'next/link';
import type React from 'react';
import { getTranslations } from 'next-intl/server';
import { isBillingEnabledForServer } from '@/lib/runtime/runtime';
import { cn } from '@/lib/utils';

export default async function OrganizationSettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ organization: string }> }) {
    const { organization } = await params;
    const t = await getTranslations('OrganizationSettings');
    const navItems = [{ slug: 'organization', label: t('Nav.Organization') }, ...(isBillingEnabledForServer() ? [{ slug: 'billing', label: t('Nav.Billing') }] : [])];

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">{t('Title')}</h1>
                <p className="text-sm text-muted-foreground">{t('Description')}</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {navItems.map(item => (
                    <Link
                        key={item.slug}
                        href={`/${organization}/settings/${item.slug}`}
                        className={cn('inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted')}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>

            {children}
        </div>
    );
}
