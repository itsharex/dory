import { createAiGateway } from 'ai-gateway-provider';
import { createUnified } from 'ai-gateway-provider/providers/unified';

export type CloudflareGatewayOptions = {
    accountId?: string;
    gateway?: string;
    apiKey?: string;
    defaultProvider?: string;
};

export function createCloudflareGatewayProvider(options: CloudflareGatewayOptions = {}) {
    const accountId = options.accountId ?? process.env.DORY_AI_CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) {
        throw new Error('DORY_AI_CLOUDFLARE_ACCOUNT_ID is required');
    }

    const gateway = options.gateway ?? process.env.DORY_AI_CLOUDFLARE_GATEWAY;
    if (!gateway) {
        throw new Error('DORY_AI_CLOUDFLARE_GATEWAY is required');
    }

    const apiKey = options.apiKey ?? process.env.DORY_AI_CF_AIG_TOKEN;
    if (!apiKey) {
        throw new Error('DORY_AI_CF_AIG_TOKEN is required');
    }

    const defaultProvider = options.defaultProvider ?? process.env.DORY_AI_CLOUDFLARE_DEFAULT_PROVIDER ?? 'openai';
    const aiGateway = createAiGateway({
        accountId,
        gateway,
        apiKey,
    });
    const unified = createUnified();

    return {
        chatModel: (modelName: string) => {
            const normalized = modelName.includes('/') ? modelName : `${defaultProvider}/${modelName}`;
            return aiGateway(unified(normalized));
        },
    };
}
