export const isPostHogEnabled =
    process.env.NODE_ENV !== 'development' &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_HOST);
