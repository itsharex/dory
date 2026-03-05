import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type OpenAICompatibleProviderOptions = {
    apiKey?: string;
    baseURL?: string;
    name?: string;
};

function normalizeBaseURL(baseURL: string) {
    const trimmed = baseURL.trim().replace(/\/+$/, '');
    return trimmed.replace(/\/chat\/completions$/i, '');
}

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.DORY_AI_API_KEY;
    if (!apiKey) {
        throw new Error('DORY_AI_API_KEY is required');
    }

    const rawBaseURL = options.baseURL ?? process.env.DORY_AI_URL;
    if (!rawBaseURL) {
        throw new Error('DORY_AI_URL is required');
    }
    const baseURL = normalizeBaseURL(rawBaseURL);

    const provider = createOpenAICompatible({
        apiKey,
        baseURL,
        name: options.name ?? 'openai-compatible',
        includeUsage: true,
    });

    return {
        chatModel: (modelName: string) => provider.chatModel(modelName),
    };
}
