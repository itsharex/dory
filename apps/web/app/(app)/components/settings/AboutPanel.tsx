'use client';

import { useTranslations } from 'next-intl';
import { IconBrandGithub } from '@tabler/icons-react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/registry/new-york-v4/ui/badge';
import { DoryLogo } from '@/components/@dory/ui/logo';
import packageJson from '../../../../package.json';

export function AboutPanel() {
    const t = useTranslations('DoryUI.Settings');

    return (
        <div>
            <div className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
                <div className="h-12 text-foreground">
                    <DoryLogo className='h-full block' />
                </div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{t('About.Subtitle')}</div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t('About.Version')}</span>
                <Badge variant="secondary">{packageJson.version}</Badge>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                    className="group inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:border-primary/60 hover:bg-primary/5"
                    href="https://github.com/dorylab/dory"
                    target="_blank"
                    rel="noreferrer"
                >
                    <IconBrandGithub size={18} />
                    <span className="font-medium">{t('About.GitHub')}</span>
                    <span className="text-xs text-muted-foreground group-hover:text-primary">dorylab/dory</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                </a>
                {/* <div className="text-sm text-muted-foreground">
                    License <Badge variant="outline">MIT License</Badge>
                </div> */}
            </div>

            <div className="mt-8 text-xs text-muted-foreground">{t('About.Footer')}</div>
        </div>
    );
}
