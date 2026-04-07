'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Lock, MessageSquareText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/registry/new-york-v4/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { AuthLinkSheet } from './auth-link-sheet';

type AccountRequiredSheetProps = {
    compact?: boolean;
    title?: string;
};

export function AccountRequiredSheet({ compact = false, title }: AccountRequiredSheetProps) {
    const t = useTranslations('Chatbot');
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { data: session } = authClient.useSession();
    const [open, setOpen] = useState(false);

    const callbackURL = useMemo(() => {
        const query = searchParams?.toString();
        return query ? `${pathname}?${query}` : pathname || '/';
    }, [pathname, searchParams]);

    useEffect(() => {
        if (session?.user && !session.user.isAnonymous) {
            setOpen(false);
        }
    }, [session]);

    const card = (
        <Card className="mx-auto w-full max-w-sm border-dashed shadow-sm">
            <CardHeader className="space-y-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageSquareText className="h-5 w-5" />
                </div>
                <CardTitle>{title ?? t('AuthRequired.Title')}</CardTitle>
                <CardDescription>{t('AuthRequired.Hint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2 pt-0">
                <Button onClick={() => setOpen(true)} className="min-w-32">
                    <Lock className="mr-2 h-4 w-4" />
                    {t('AuthRequired.SignIn')}
                </Button>
            </CardContent>
        </Card>
    );

    return (
        <>
            <div className={compact ? 'h-full p-4' : 'flex h-full items-center justify-center p-6'}>{card}</div>
            <AuthLinkSheet open={open} onOpenChange={setOpen} callbackURL={callbackURL} />
        </>
    );
}
