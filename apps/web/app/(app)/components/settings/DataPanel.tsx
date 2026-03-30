'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/registry/new-york-v4/ui/button';
import { SettingsRow } from './SettingsRow';
import { authFetch } from '@/lib/client/auth-fetch';

type ImportResult = {
    connections: { created: number; skipped: number };
    savedQueryFolders: { created: number };
    savedQueries: { created: number; skipped: number };
};

export function DataPanel() {
    const t = useTranslations('DoryUI.Settings');
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        setExporting(true);
        setMessage(null);
        try {
            const res = await authFetch('/api/workspace/export');
            const json = await res.json();
            if (json.code !== 0) {
                setMessage({ type: 'error', text: json.message ?? t('Data.ExportFailed') });
                return;
            }

            const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dory-workspace-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            setMessage({ type: 'success', text: t('Data.ExportSuccess') });
        } catch {
            setMessage({ type: 'error', text: t('Data.ExportFailedRetry') });
        } finally {
            setExporting(false);
        }
    };

    const handleImport = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so the same file can be selected again
        e.target.value = '';

        setImporting(true);
        setMessage(null);
        try {
            const text = await file.text();
            let data: unknown;
            try {
                data = JSON.parse(text);
            } catch {
                setMessage({ type: 'error', text: t('Data.InvalidJson') });
                return;
            }

            const res = await authFetch('/api/workspace/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const json = await res.json();
            if (json.code !== 0) {
                setMessage({ type: 'error', text: json.message ?? t('Data.ImportFailed') });
                return;
            }

            const r = json.data as ImportResult;
            const parts: string[] = [];
            if (r.connections.created > 0) parts.push(t('Data.ImportSummary.Connections', { count: String(r.connections.created) }));
            if (r.savedQueryFolders.created > 0) parts.push(t('Data.ImportSummary.Folders', { count: String(r.savedQueryFolders.created) }));
            if (r.savedQueries.created > 0) parts.push(t('Data.ImportSummary.Queries', { count: String(r.savedQueries.created) }));
            if (r.savedQueries.skipped > 0) parts.push(t('Data.ImportSummary.QueriesSkipped', { count: String(r.savedQueries.skipped) }));

            const summary = parts.length > 0
                ? t('Data.ImportSummary.Success', { summary: parts.join(t('Data.ImportSummary.Separator')) })
                : t('Data.ImportSummary.Empty');
            setMessage({ type: 'success', text: summary });
        } catch {
            setMessage({ type: 'error', text: t('Data.ImportFailedRetry') });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <SettingsRow
                label={t('Data.ExportLabel')}
                description={t('Data.ExportDescription')}
            >
                <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {t('Data.ExportAction')}
                </Button>
            </SettingsRow>

            <SettingsRow
                label={t('Data.ImportLabel')}
                description={t('Data.ImportDescription')}
            >
                <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
                    {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {t('Data.ImportAction')}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileSelected}
                />
            </SettingsRow>

            {message && (
                <div
                    className={`text-sm px-3 py-2 rounded-md ${
                        message.type === 'success'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-destructive/10 text-destructive'
                    }`}
                >
                    {message.text}
                </div>
            )}
        </div>
    );
}
