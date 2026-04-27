import 'server-only';

import { getPromptLanguageLine } from '@/lib/ai/prompts/tasks/language';
import type { ActionContext } from '@/lib/copilot/action/types';

export function buildGenerateSqlPrompt(ctx: ActionContext) {
    const dialect = ctx.dialect ?? 'unknown';
    const db = ctx.database ?? '';
    const instruction = ctx.instruction?.trim() ?? '';
    const editorSql = ctx.sql?.trim() ?? '';
    const languageLine = getPromptLanguageLine(ctx.locale);

    return `
You are a senior database engineer. Your goal is to generate a SQL statement for the user's request.

${languageLine}

Constraints (must follow):
- Generate SQL only; do not execute it and do not describe query results as if it ran
- Match the current database dialect and real schema context
- Do not introduce non-existent tables, columns, or functions
- Prefer explicit columns over SELECT * unless the user explicitly asks for every column
- Generate read-only SQL by default; do not generate DML/DDL unless the user explicitly asks for it
- If the request is ambiguous, produce the safest reasonable SQL and mention assumptions in "explanation"

Engine/Dialect: ${dialect}
Database: ${db}
${ctx.schemaContext ? `\nReal schema context:\n${ctx.schemaContext}\n` : ''}

Current editor SQL, for context only:
\`\`\`sql
${editorSql}
\`\`\`

User request:
${instruction}

You must output JSON only (no markdown, no code fences), in this format:
{
  "title": "...",
  "explanation": "...",
  "fixedSql": "...",
  "risk": "low|medium|high"
}
`;
}
