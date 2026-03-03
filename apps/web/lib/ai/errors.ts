export function isMissingAiEnvError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return (
        message.includes('DORY_AI_API_KEY') ||
        message.includes('DORY_AI_CF_AIG_TOKEN') ||
        message.includes('DORY_AI_CF_ACCOUNT_ID') ||
        message.includes('DORY_AI_CF_GATEWAY') ||
        message.includes('DORY_AI_URL') ||
        message.includes('MISSING_AI_ENV')
    );
}
