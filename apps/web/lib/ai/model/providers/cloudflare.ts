import { createAiGateway } from 'ai-gateway-provider';
import { createUnified } from 'ai-gateway-provider/providers/unified';

export type CloudflareGatewayOptions = {
    accountId?: string;
    gateway?: string;
    apiKey?: string;
    defaultProvider?: string;
};

type CloudflareGatewayConfig = {
    accountId: string;
    gateway: string;
    token: string;
};

function parseGatewayUrl(baseURL?: string | null) {
    if (!baseURL) return null;
    try {
        const url = new URL(baseURL);
        const parts = url.pathname
            .split('/')
            .map(part => part.trim())
            .filter(Boolean);
        const v1Index = parts.findIndex(part => part.toLowerCase() === 'v1');
        if (v1Index < 0) return null;
        const accountId = parts[v1Index + 1];
        const gateway = parts[v1Index + 2];
        if (!accountId || !gateway) return null;
        return { accountId, gateway };
    } catch {
        return null;
    }
}

function resolveConfig(options: CloudflareGatewayOptions): CloudflareGatewayConfig {
    const parsed = parseGatewayUrl(options.baseURL ?? process.env.DORY_AI_URL ?? null);
    const accountId =
        options.accountId ??
        process.env.DORY_AI_CF_ACCOUNT_ID ??
        parsed?.accountId ??
        '';
    const gateway =
        options.gateway ??
        process.env.DORY_AI_CF_GATEWAY ??
        parsed?.gateway ??
        '';
    const token =
        options.cfAigToken ??
        options.apiKey ??
        process.env.DORY_AI_CF_AIG_TOKEN ??
        process.env.DORY_AI_API_KEY ??
        '';

    if (!accountId) {
        throw new Error('DORY_AI_CF_ACCOUNT_ID is required (or set DORY_AI_URL with /v1/{account}/{gateway}/compat)');
    }
    if (!gateway) {
        throw new Error('DORY_AI_CF_GATEWAY is required (or set DORY_AI_URL with /v1/{account}/{gateway}/compat)');
    }
    if (!token) {
        throw new Error('DORY_AI_CF_AIG_TOKEN is required');
    }

    return { accountId, gateway, token };
}

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
