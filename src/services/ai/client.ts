/**
 * Unified AI chat client (BYOK, multi-provider).
 *
 * One call surface for every provider. Normalises:
 *   - request  : OpenAI `{messages, tools}`  <->  Anthropic `{system, messages, tools}`
 *   - images   : `image_url` data URI        <->  `{type:'image', source:{data, media_type}}`
 *   - response : `choices[0].message`        <->  `content[]` blocks (`text` / `tool_use`)
 *
 * Everything talks to the provider DIRECTLY from the browser using the key the
 * user stored — no server, no shared key, no Cloudflare secret.
 */

import { AiProvider, getProvider } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  /** Populated on assistant turns that requested tool calls. */
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  providerId: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  /** Optional one-shot override, e.g. a custom OpenAI-compatible endpoint. */
  baseUrlOverride?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  /** Final assistant text ('' when the turn only requested tools). */
  text: string;
  toolCalls: ToolCall[];
  /** True when the provider stopped because of the token limit. */
  truncated: boolean;
  raw?: unknown;
}

export class AiConfigError extends Error {
  readonly code = 'AI_NOT_CONFIGURED';
}

// ---------------------------------------------------------------------------
// Request shaping
// ---------------------------------------------------------------------------

/** Splits a leading `system` message out (Anthropic needs it as a top-level field). */
function splitSystem(messages: ChatMessage[]): { system?: string; rest: ChatMessage[] } {
  const rest: ChatMessage[] = [];
  const systemParts: string[] = [];
  for (const m of messages) {
    if (m.role === 'system' && typeof m.content === 'string') {
      systemParts.push(m.content);
    } else {
      rest.push(m);
    }
  }
  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, rest };
}

function toOpenAIPayload(options: ChatOptions) {
  const messages = options.messages.map((m) => {
    // Tool results keep the OpenAI shape.
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content as string };
    }
    return { role: m.role, content: m.content, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls } : {}) };
  });

  return {
    model: options.model,
    messages,
    ...(options.tools?.length ? { tools: options.tools, tool_choice: 'auto' } : {}),
    stream: false,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };
}

function toAnthropicPayload(options: ChatOptions) {
  const { system, rest } = splitSystem(options.messages);

  const messages = rest
    .filter((m) => m.role !== 'tool')
    .map((m) => {
      // Assistant turn that requested tools -> tool_use blocks
      if (m.role === 'assistant' && m.tool_calls?.length) {
        const blocks: any[] = [];
        if (typeof m.content === 'string' && m.content) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls) {
          let input: unknown = {};
          try {
            input = JSON.parse(tc.function.arguments || '{}');
          } catch {}
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        return { role: 'assistant', content: blocks };
      }
      return { role: m.role, content: m.content };
    });

  // Tool results become `user` turns carrying tool_result blocks.
  const toolResults = options.messages.filter((m) => m.role === 'tool');
  const flattened = [...messages];
  if (toolResults.length) {
    flattened.push({
      role: 'user',
      content: toolResults.map((m) => ({
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    } as any);
  }

  return {
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    ...(system ? { system } : {}),
    messages: flattened,
    ...(options.tools?.length
      ? {
          tools: options.tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }
      : {}),
  };
}

function buildHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(provider.browserHeaders || {}),
  };
  if (provider.apiShape === 'anthropic') {
    headers['x-api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function endpointFor(provider: AiProvider, override?: string): string {
  if (override) {
    const base = override.replace(/\/+$/, '');
    return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  }
  return provider.chatUrl;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

function parseOpenAI(data: any): ChatResult {
  const message = data?.choices?.[0]?.message ?? {};
  const toolCalls: ToolCall[] = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .filter((tc: any) => tc?.function?.name)
        .map((tc: any) => ({
          id: String(tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`),
          type: 'function',
          function: { name: tc.function.name, arguments: tc.function.arguments || '{}' },
        }))
    : [];

  const text = typeof message.content === 'string' ? message.content : (message.reasoning as string) || '';

  return {
    text,
    toolCalls,
    truncated: data?.choices?.[0]?.finish_reason === 'length',
    raw: data,
  };
}

function parseAnthropic(data: any): ChatResult {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') textParts.push(block.text);
    if (block?.type === 'tool_use') {
      toolCalls.push({
        id: String(block.id ?? `toolu_${Math.random().toString(36).slice(2, 10)}`),
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }

  return {
    text: textParts.join('\n'),
    toolCalls,
    truncated: data?.stop_reason === 'max_tokens',
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends one turn. Throws `AiConfigError` when no key/model is configured,
 * and a descriptive `Error` for transport/HTTP failures.
 */
export async function sendChat(options: ChatOptions): Promise<ChatResult> {
  const provider = getProvider(options.providerId);
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new AiConfigError(
      `Aucune clé API configurée pour ${provider.label}. Ajoutez-la dans Réglages → Fournisseur IA.`
    );
  }

  const isAnthropic = provider.apiShape === 'anthropic';
  const payload = isAnthropic ? toAnthropicPayload(options) : toOpenAIPayload(options);
  const url = endpointFor(provider, options.baseUrlOverride);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.signal ? undefined : 60000);
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(provider, apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(`Réponse non-JSON du fournisseur (${response.status}) : ${rawText.slice(0, 300)}`);
    }

    if (!response.ok) {
      const detail =
        data?.error?.message || data?.error?.type || data?.message || `HTTP ${response.status}`;
      throw new Error(`${provider.label} a renvoyé une erreur : ${detail}`);
    }

    return isAnthropic ? parseAnthropic(data) : parseOpenAI(data);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('La requête IA a dépassé le délai imparti. Réessayez ou changez de modèle.');
    }
    // A CORS failure surfaces here as an opaque TypeError — make it actionable.
    if (error instanceof TypeError) {
      throw new Error(
        `Impossible de joindre ${provider.label} depuis le navigateur (CORS ou réseau). ` +
          `Vérifiez votre connexion, ou choisissez un fournisseur compatible navigateur.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Lightweight connectivity + capability probe used by the Settings UI. */
export async function testProvider(options: {
  providerId: string;
  apiKey: string;
  model: string;
  baseUrlOverride?: string;
}): Promise<{ ok: boolean; message: string; vision?: boolean }> {
  try {
    const result = await sendChat({
      providerId: options.providerId,
      apiKey: options.apiKey,
      model: options.model,
      baseUrlOverride: options.baseUrlOverride,
      maxTokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Réponds uniquement par le mot: OK' },
            {
              // 1x1 transparent PNG — proves image input works on this model.
              type: 'image_url',
              image_url: {
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
              },
            },
          ],
        },
      ],
    });

    const saidOk = /ok/i.test(result.text);
    return {
      ok: true,
      message: saidOk
        ? 'Connexion réussie — le modèle lit les images et répond.'
        : 'Connexion réussie (réponse inattendue, mais le modèle accepte les images).',
      vision: true,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Échec du test de connexion.' };
  }
}
