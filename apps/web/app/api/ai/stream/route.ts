import 'server-only';
import { NextRequest } from 'next/server';
import { createIdGenerator, stepCountIs } from 'ai';

import { streamText } from '@/lib/ai/gateway';
import { getEffectiveModelBundle } from '@/lib/ai/model';
import { buildCloudToolSet } from '@/lib/ai/cloud-tools';
import { isMissingAiEnvError } from '@/lib/ai/errors';
import { USE_CLOUD_AI } from '@/app/config/app';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as {
            system: string;
            messages: unknown[];
            tools?: Record<string, unknown> | null;
            toolChoice?: 'auto' | 'none';
            temperature?: number;
            maxSteps?: number;
            model?: string | null;
        };

        const { model, preset, modelName: providerModelName } = getEffectiveModelBundle('chat', body.model);

        const toolSet = buildCloudToolSet(
            body.tools as Record<string, any> | null,
        );

        const result = streamText({
            model,
            system: body.system,
            messages: body.messages as any,
            tools: toolSet,
            toolChoice: body.toolChoice ?? 'auto',
            stopWhen: stepCountIs(Math.max(1, body.maxSteps ?? 1)),
            temperature: body.temperature ?? preset.temperature,
        });

        return result.toUIMessageStreamResponse({
            generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
        });
    } catch (error) {
        if (isMissingAiEnvError(error) && !USE_CLOUD_AI) {
            return new Response('MISSING_AI_ENV', {
                status: 500,
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        console.error('[api/ai/stream] error:', error);
        const message = error instanceof Error ? error.message : 'Internal error';
        return new Response(message, {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}
