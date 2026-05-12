import OpenAI from 'openai';
import { executeTool } from './tools.js';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TOOL_TIMEOUT_MS = 15_000; // 15 second timeout for tool calls
const TOTAL_BUDGET_MS = 60_000; // 60 second total budget for the entire conversation
const MAX_TOOL_CALLS = 10; // Max number of tool calls to prevent infinite loops

async function withTimeout(promise, ms) {
    let timer;
    const race = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tool timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, race]);
    } finally {
        clearTimeout(timer);
    }
}

export async function* chatStream(
    messages,
    { model = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o', tools = [] } = {}
) {
    const openAITools = tools.map(t =>
        t.type === 'function'
            ? t
            : { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }
    );

    let toolCallCount = 0;
    let currentMessages = [...messages];
    const startedAt = Date.now();

    while (toolCallCount < MAX_TOOL_CALLS) {
        if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
            yield { type: 'done', reason: 'budget_exceeded' };
            return;
        }

        const stream = await openai.chat.completions.create({
            model,
            messages: currentMessages,
            tools: openAITools.length > 0 ? openAITools : undefined,
            tool_choice: openAITools.length > 0 ? 'auto' : undefined,
            stream: true,
        });

        let textContent = '';
        const pending = {}; // index → { id, name, argsStr }

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                textContent += delta.content;
                yield { type: 'token', content: delta.content };
            }

            // Tool call arguments arrive in pieces — accumulate by index
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const i = tc.index;
                    if (!pending[i]) pending[i] = { id: '', name: '', argsStr: '' };
                    if (tc.id) pending[i].id += tc.id;
                    if (tc.function?.name) pending[i].name += tc.function.name;
                    if (tc.function?.arguments) pending[i].argsStr += tc.function.arguments;
                }
            }
        }
        const toolCalls = Object.values(pending);

        // No tool calls → model gave its final text response
        if (toolCalls.length === 0) {
            yield { type: 'done', reason: 'complete' };
            return;
        }
        
        // Append the assistant's tool-call message before executing
        currentMessages.push({
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.argsStr },
            })),
        });

        for (const tc of toolCalls) {
            let args;
            try { args = JSON.parse(tc.argsStr || '{}'); } catch { args = {}; }

            yield { type: 'tool_call', name: tc.name, args };

            let result;
            try {
                result = await withTimeout(executeTool(tc.name, args), TOOL_TIMEOUT_MS);
            } catch (err) {
                result = { error: err.message };
            }

            yield { type: 'tool_result', name: tc.name, result };

            currentMessages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
            });

            toolCallCount++;
        }
    }
}

export async function chatJSON(messages, hint = '') {
    const allMessages = hint
        ? [{ role: 'system', content: hint }, ...messages]
        : messages;

    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_INSIGHTS_MODEL ?? 'gpt-4o-mini',
        messages: allMessages,
        response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
}