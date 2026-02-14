const baseUrl = process.env.DORY_BASE_URL ?? 'http://localhost:3000';
const cookie = process.env.DORY_TEST_COOKIE;
const connectionId = process.env.DORY_TEST_CONNECTION_ID;
const database = process.env.DORY_TEST_DATABASE ?? null;

if (!cookie) {
    throw new Error('Missing DORY_TEST_COOKIE');
}

if (!connectionId) {
    throw new Error('Missing DORY_TEST_CONNECTION_ID');
}

const messageId = `msg_${Date.now()}`;
const userPrompt =
    process.env.DORY_TEST_PROMPT ??
    'Use sqlRunner to query the active database and list 3 rows from any table.';

const body = {
    id: messageId,
    messages: [
        {
            id: messageId,
            role: 'user',
            parts: [{ type: 'text', text: userPrompt }],
        },
    ],
    connectionId,
    database,
};

const chatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        cookie,
    },
    body: JSON.stringify(body),
});

if (!chatResponse.ok) {
    const text = await chatResponse.text();
    throw new Error(`Chat request failed: ${chatResponse.status} ${text}`);
}

const chatId = chatResponse.headers.get('x-chat-id');
if (!chatId) {
    throw new Error('Missing x-chat-id header from chat response');
}

await chatResponse.text();

const sessionResponse = await fetch(
    `${baseUrl}/api/chat/session/${chatId}`,
    {
        headers: {
            cookie,
        },
    },
);

if (!sessionResponse.ok) {
    const text = await sessionResponse.text();
    throw new Error(`Session fetch failed: ${sessionResponse.status} ${text}`);
}

const payload = (await sessionResponse.json()) as {
    data?: { messages?: Array<{ role: string; parts: unknown[] }> };
};

const messages = payload.data?.messages ?? [];
const hasUser = messages.some(msg => msg.role === 'user');
const hasTool = messages.some(msg => msg.role === 'tool');
const hasAssistant = messages.some(msg => msg.role === 'assistant');

if (!hasUser || !hasTool || !hasAssistant) {
    console.error('Missing expected message roles', {
        hasUser,
        hasTool,
        hasAssistant,
    });
    process.exitCode = 1;
} else {
    console.log('Chat orchestrator test passed', {
        chatId,
        messageCount: messages.length,
    });
}

export {};
