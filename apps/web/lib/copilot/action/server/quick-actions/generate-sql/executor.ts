import 'server-only';

import { buildGenerateSqlPrompt } from '@/lib/ai/prompts';
import { ActionContext, ActionResult } from '../../../types';
import { runLLMJson } from '../../llm-json';
import { GenerateSqlOutputSchema } from './schema';

export async function executeGenerateSql(ctx: ActionContext): Promise<ActionResult> {
    const prompt = buildGenerateSqlPrompt(ctx);

    const out = await runLLMJson({
        prompt,
        schema: GenerateSqlOutputSchema,
        temperature: 0.1,
        maxRetries: 1,
        model: ctx.model,
        context: {
            organizationId: ctx.organizationId,
            userId: ctx.userId,
            feature: 'copilot_action_generate_sql',
        },
    });

    return {
        title: out.title,
        explanation: out.explanation,
        fixedSql: out.fixedSql.trim(),
        risk: out.risk,
    };
}
