import { Button } from "@/registry/new-york-v4/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

export default function SQLTabEmpty(props: { addTab: () => void; disabled?: boolean }) {
    const { addTab, disabled = false } = props;
    const t = useTranslations('SqlConsole');
    const router = useRouter();
    const params = useParams<{ organization: string; connectionId: string }>();

    const handleAskAI = () => {
        if (params?.organization && params?.connectionId) {
            router.push(`/${params.organization}/${params.connectionId}/chatbot`);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="mb-6 text-5xl font-semibold tracking-wide">
                {t('Empty.Brand')}
            </div>
            <div className="space-y-2 text-sm mb-6 text-center">
                <div>{t('Empty.ShortcutRunSelection')}</div>
                <div>{t('Empty.ShortcutSave')}</div>
                <div>{t('Empty.ShortcutNewTab')}</div>
                <div>{t('Empty.ShortcutToggleCopilot')}</div>
                <div>{t('Empty.ShortcutFormat')}</div>
            </div>
            <div className="flex flex-col items-center gap-3">
                <Button onClick={addTab} disabled={disabled}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Empty.NewConsole')}
                </Button>
                <span className="text-xs text-muted-foreground">{t('Empty.OrDivider')}</span>
                <Button variant="outline" onClick={handleAskAI} disabled={disabled}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('Empty.AskAI')}
                </Button>
            </div>
        </div>
    );
}
