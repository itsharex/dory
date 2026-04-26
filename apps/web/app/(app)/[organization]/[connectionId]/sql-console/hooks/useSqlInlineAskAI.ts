'use client';

import { useCallback } from 'react';
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { EventSourceParserStream } from 'eventsource-parser/stream';

import { authFetch } from '@/lib/client/auth-fetch';
import type { ConnectionType } from '@/types/connections';
import { apiGetOrCreateCopilotSession } from '../../chatbot/core/api';
import { extractGeneratedSqlFromAssistantMessage } from '../../chatbot/core/utils';
import type { CopilotEnvelopeV1 } from '../../chatbot/copilot/types/copilot-envelope';

type GenerateSqlFromPromptInput = {
    prompt: string;
    connectionId: string | null;
    connectionType: ConnectionType | null;
    database: string | null;
    activeSchema: string | null;
    tabId: string;
    copilotEnvelope: CopilotEnvelopeV1;
    errorMessage: string;
};

function createUIChunkStream(responseStream: ReadableStream): ReadableStream<UIMessageChunk> {
    return responseStream
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(new TransformStream({
            transform(event, controller) {
                if (!event.data || event.data === '[DONE]') {
                    return;
                }

                controller.enqueue(JSON.parse(event.data) as UIMessageChunk);
            },
        }));
}

async function readLastAssistantMessage(stream: ReadableStream<Uint8Array>): Promise<UIMessage | null> {
    let lastMessage: UIMessage | null = null;

    for await (const message of readUIMessageStream<UIMessage>({ stream: createUIChunkStream(stream) })) {
        lastMessage = message;
    }

    return lastMessage?.role === 'assistant' ? lastMessage : null;
}

export function useSqlInlineAskAI() {
    return useCallback(async (input: GenerateSqlFromPromptInput) => {
        const {
            prompt,
            connectionId,
            connectionType,
            database,
            activeSchema,
            tabId,
            copilotEnvelope,
            errorMessage,
        } = input;

        const trimmedPrompt = prompt.trim();
        if (!trimmedPrompt) {
            throw new Error(errorMessage);
        }

        const session = await apiGetOrCreateCopilotSession({
            envelope: copilotEnvelope,
            errorMessage,
        });

        const res = await authFetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: uuidv4(),
                messages: [
                    {
                        id: uuidv4(),
                        role: 'user',
                        parts: [{ type: 'text', text: trimmedPrompt }],
                    },
                ],
                database,
                activeSchema,
                connectionId,
                connectionType,
                mode: 'copilot',
                tabId,
                copilotEnvelope,
                chatId: session.id,
            }),
        });

        if (!res.ok || !res.body) {
            const text = await res.text().catch(() => '');
            throw new Error(text || errorMessage);
        }

        const lastMessage = await readLastAssistantMessage(res.body);
        const sql = extractGeneratedSqlFromAssistantMessage(lastMessage);

        if (!sql?.trim()) {
            throw new Error(errorMessage);
        }

        return sql.trim();
    }, []);
}
