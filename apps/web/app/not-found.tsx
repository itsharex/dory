'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/registry/new-york-v4/ui/button';

// This page renders when a route like `/unknown.txt` is requested.
// In this case, the layout at `app/[locale]/layout.tsx` receives
// an invalid value as the `[locale]` param and calls `notFound()`.

export default function GlobalNotFound() {
    const locale = useLocale();
    const t = useTranslations('NotFoundPage');

    return (
        <html lang={locale}>
            <body className="min-h-screen bg-[radial-gradient(60%_80%_at_50%_0%,rgba(14,116,144,0.12),transparent_70%),radial-gradient(40%_60%_at_10%_20%,rgba(59,130,246,0.12),transparent_60%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_60%,#f8fafc_100%)] text-slate-900">
                {/* <Error statusCode={404} /> */}
                <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">
                        404
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        {t('title')}
                    </h1>
                    <p className="max-w-xl text-base text-slate-600 sm:text-lg">
                        {t('description')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button asChild>
                            <Link href="/">{t('backToHome')}</Link>
                        </Button>
                    </div>
                </main>
            </body>
        </html>
    );
}
