export function isMissingAiEnvError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return (
        message.includes('DORY_AI_API_KEY') ||
        message.includes('DORY_AI_URL') ||
        message.includes('MISSING_AI_ENV')
    );
}

export function isDesktopCloudRuntime() {
    const runtime = process.env.NEXT_PUBLIC_DORY_RUNTIME?.trim() ?? '';
    const cloudUrl =
        process.env.NEXT_PUBLIC_DORY_CLOUD_API_URL?.trim() ??
        process.env.DORY_CLOUD_API_URL?.trim() ??
        '';
    return runtime === 'desktop' && Boolean(cloudUrl);
}
