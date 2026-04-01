'use client';

import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import {
    PromptInput,
    PromptInputBody,
    PromptInputSubmit,
    PromptInputTextarea,
    PromptInputFooter,
    type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';
import { activeDatabaseAtom } from '@/shared/stores/app.store';
import { useDatabases } from '@/hooks/use-databases';
import { useTables } from '@/hooks/use-tables';
import { DatabaseSelect } from '../../../components/sql-console-sidebar/database-select';
import { TableMentionTextarea } from '../thread/table-mention-textarea';

type ChatWelcomeProps = {
    onSend: (text: string) => void;
    disabled?: boolean;
};

const SUGGESTION_KEYS = ['TopUsers', 'ErrorLogs', 'OrderTrends', 'TableSummary'] as const;

export default function ChatWelcome({ onSend, disabled = false }: ChatWelcomeProps) {
    const t = useTranslations('Chatbot');
    const [input, setInput] = useState('');
    const [activeDatabase, setActiveDatabase] = useAtom(activeDatabaseAtom);
    const { databases } = useDatabases();
    const { tables } = useTables(activeDatabase);

    const handleSubmit = (message: PromptInputMessage) => {
        const text = message.text?.trim();
        if (!text) return;
        onSend(text);
    };

    const handleSuggestionClick = (suggestion: string) => {
        onSend(suggestion);
    };

    const handleDatabaseChange = (db: string) => {
        setActiveDatabase(db);
    };

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-4">
            <div className="flex w-full max-w-2xl flex-col items-center gap-8">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {t('Welcome.Heading')}
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {t('Welcome.Subheading')}
                    </p>
                </div>

                <Suggestions className="justify-center flex-wrap">
                    {SUGGESTION_KEYS.map((key) => (
                        <Suggestion
                            key={key}
                            suggestion={t(`Welcome.Suggestions.${key}`)}
                            onClick={handleSuggestionClick}
                            disabled={disabled}
                        />
                    ))}
                </Suggestions>

                <div className="w-full">
                    <PromptInput onSubmit={handleSubmit} className="mt-1">
                        <PromptInputBody>
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex items-center gap-2">
                                    <DatabaseSelect
                                        className="w-auto max-w-80 border-0 shadow-none text-xs outline-0 focus-visible:ring-0"
                                        value={activeDatabase}
                                        databases={databases}
                                        onChange={handleDatabaseChange}
                                    />
                                </div>
                                <div className="flex items-start gap-2 w-full">
                                    <TableMentionTextarea value={input} onChange={setInput} tables={tables.map((t: any) => t.name ?? t)}>
                                        <PromptInputTextarea
                                            placeholder={t('Input.GlobalPlaceholder')}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            className="min-h-18 w-full resize-none border-0 bg-transparent text-sm focus-visible:outline-none focus-visible:ring-0"
                                        />
                                    </TableMentionTextarea>
                                </div>
                            </div>
                        </PromptInputBody>
                        <PromptInputFooter className="justify-end">
                            <PromptInputSubmit disabled={disabled || !input} />
                        </PromptInputFooter>
                    </PromptInput>
                </div>
            </div>
        </div>
    );
}
