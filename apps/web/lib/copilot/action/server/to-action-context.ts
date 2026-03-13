import 'server-only';

import type { CopilotFixInput } from '@/app/(app)/[team]/[connectionId]/chatbot/copilot/types/copilot-fix-input';
import { ActionContext } from '../types';
import { Locale, routing } from '@/lib/i18n/routing';
import { translate } from '@/lib/i18n/i18n';

export function toActionContext(
    input: CopilotFixInput,
    locale?: Locale,
    identity?: { teamId?: string; userId?: string },
): ActionContext {
    if (input.surface !== 'sql') {
        const resolvedLocale = locale ?? routing.defaultLocale;
        throw new Error(translate(resolvedLocale, 'SqlConsole.Copilot.Errors.UnsupportedSurface'));
    }

    const exec = input.lastExecution;

    return {
        teamId: identity?.teamId,
        userId: identity?.userId,
        connectionId: input.meta?.connectionId,
        dialect: exec.dialect ?? 'unknown',
        sql: exec.sql,
        database: exec.database ?? undefined,
        locale,
        model: input.model ?? null,
        error: exec.error
            ? {
                  message: exec.error.message,
                  code: exec.error.code ?? undefined,
              }
            : undefined,
    };
}
