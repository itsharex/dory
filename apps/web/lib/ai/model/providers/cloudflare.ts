import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export type CloudflareGatewayOptions = {
    apiKey?: string;
    baseURL?: string;
    cfAigToken?: string;
    name?: string;
};

export function createCloudflareGatewayProvider(options: CloudflareGatewayOptions = {}) {
    const baseURL = options.baseURL ?? process.env.DORY_AI_URL;
    if (!baseURL) {
        throw new Error('DORY_AI_URL is required');
    }

    const apiKey = options.apiKey ?? process.env.DORY_AI_API_KEY;
    const cfAigToken = options.cfAigToken ?? process.env.DORY_AI_CF_AIG_TOKEN;

    const headers: Record<string, string> = {};
    if (cfAigToken) {
        headers['cf-aig-authorization'] = `Bearer ${cfAigToken}`;
    }

    const provider = createOpenAICompatible({
        baseURL,
        apiKey,
        headers: Object.keys(headers).length ? headers : undefined,
        name: options.name ?? 'cloudflare-gateway',
    });

    return {
        chatModel: (modelName: string) => provider.chatModel(modelName),
    };
}
