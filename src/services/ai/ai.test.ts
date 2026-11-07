/**
 * Unit tests for the BYOK AI layer (provider registry + normalised client).
 *
 * `fetch` is mocked so these tests are deterministic and need no API key or network.
 * They lock in the two things most likely to regress:
 *   1. the OpenAI <-> Anthropic request/response normalisation
 *   2. the "vision + tools only" model filter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendChat, AiConfigError, type ChatMessage, type ChatTool } from './client';
import { PROVIDERS, getProvider, looksLikeValidKey } from './providers';
import { fetchModels } from './models';

/**
 * The model cache uses `localStorage`, which the node test environment does not
 * provide. A minimal in-memory stub is enough: the cache is key-value only.
 */
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Minimal OpenAI-shaped reply. */
const openAiReply = {
  choices: [
    {
      message: { role: 'assistant', content: 'Bonjour' },
      finish_reason: 'stop',
    },
  ],
};

/** Minimal Anthropic-shaped reply. */
const anthropicReply = {
  content: [{ type: 'text', text: 'Bonjour' }],
  stop_reason: 'end_turn',
};

describe('provider registry', () => {
  it('exposes every documented provider', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(['openrouter', 'nvidia', 'anthropic', 'openai', 'mistral', 'groq', 'together', 'custom']);
  });

  it('has a chat endpoint for every provider except the custom one', () => {
    for (const p of PROVIDERS) {
      if (p.id === 'custom') {
        expect(p.chatUrl).toBe('');
      } else {
        expect(p.chatUrl).toMatch(/^https:\/\//);
      }
    }
  });

  it('falls back to OpenRouter for an unknown id', () => {
    expect(getProvider('does-not-exist').id).toBe('openrouter');
  });

  it('declares Anthropic as a non-OpenAI-compatible API', () => {
    expect(getProvider('anthropic').apiShape).toBe('anthropic');
    expect(getProvider('anthropic').browserHeaders).toHaveProperty('anthropic-dangerous-direct-browser-access');
    // Every other provider speaks the OpenAI dialect.
    for (const p of PROVIDERS.filter((x) => x.id !== 'anthropic' && x.id !== 'custom')) {
      expect(p.apiShape).toBe('openai');
    }
  });

  describe('looksLikeValidKey', () => {
    it('accepts a correctly prefixed key', () => {
      expect(looksLikeValidKey(getProvider('anthropic'), 'sk-ant-api03-abcdef123456')).toBe(true);
      expect(looksLikeValidKey(getProvider('openrouter'), 'sk-or-v1-abcdef123456')).toBe(true);
      expect(looksLikeValidKey(getProvider('nvidia'), 'nvapi-abcdef123456')).toBe(true);
    });

    it('rejects a wrongly prefixed or too-short key', () => {
      expect(looksLikeValidKey(getProvider('anthropic'), 'sk-or-v1-abcdef123456')).toBe(false);
      expect(looksLikeValidKey(getProvider('openrouter'), 'abc')).toBe(false);
      expect(looksLikeValidKey(getProvider('openrouter'), '   ')).toBe(false);
    });

    it('accepts any length for providers without a known prefix', () => {
      expect(looksLikeValidKey(getProvider('mistral'), 'whatever-key-123')).toBe(true);
      expect(looksLikeValidKey(getProvider('custom'), 'whatever-key-123')).toBe(true);
    });
  });
});

describe('sendChat — OpenAI-compatible providers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws AiConfigError when no key is supplied', async () => {
    await expect(
      sendChat({ providerId: 'openai', apiKey: '', model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toBeInstanceOf(AiConfigError);
  });

  it('sends the Bearer header and returns the assistant text', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(openAiReply));

    const result = await sendChat({
      providerId: 'openrouter',
      apiKey: 'sk-or-v1-test',
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'Bonjour' }],
    });

    expect(result.text).toBe('Bonjour');
    expect(result.toolCalls).toEqual([]);
    expect(result.truncated).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-or-v1-test');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: 'openai/gpt-4o', stream: false });
    expect(body.messages).toEqual([{ role: 'user', content: 'Bonjour' }]);
  });

  it('forwards tools and parses tool calls', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'propose_transaction', arguments: '{"amount":100}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      })
    );

    const tools: ChatTool[] = [
      {
        type: 'function',
        function: {
          name: 'propose_transaction',
          description: 'propose a transaction',
          parameters: { type: 'object', properties: {} },
        },
      },
    ];

    const result = await sendChat({
      providerId: 'openrouter',
      apiKey: 'sk-or-v1-test',
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'analyse ce reçu' }],
      tools,
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('propose_transaction');
    expect(result.toolCalls[0].id).toBe('call_1');

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe('auto');
  });

  it('reports truncation when the provider hits the token limit', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: '...' }, finish_reason: 'length' }] })
    );
    const result = await sendChat({
      providerId: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'long prompt' }],
    });
    expect(result.truncated).toBe(true);
  });

  it('turns an HTTP error into a readable provider message', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: { message: 'Invalid API key' } }, 401));
    await expect(
      sendChat({ providerId: 'openai', apiKey: 'sk-bad', model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/Invalid API key/);
  });
});

describe('sendChat — Anthropic (non-OpenAI shape)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses x-api-key + anthropic-version, not Authorization', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(anthropicReply));

    await sendChat({
      providerId: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'Bonjour' }],
    });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(headers.Authorization).toBeUndefined();
  });

  it('lifts the system message to the top-level field', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(anthropicReply));

    const messages: ChatMessage[] = [
      { role: 'system', content: 'Tu es NEO.' },
      { role: 'user', content: 'Quel est mon solde ?' },
    ];
    await sendChat({
      providerId: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5-20250929',
      messages,
    });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('Tu es NEO.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Quel est mon solde ?' }]);
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  it('converts tools and parses tool_use content blocks', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        content: [
          { type: 'text', text: 'Je vais enregistrer.' },
          { type: 'tool_use', id: 'toolu_1', name: 'propose_transaction', input: { amount: 100 } },
        ],
        stop_reason: 'tool_use',
      })
    );

    const result = await sendChat({
      providerId: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-5-20250929',
      messages: [{ role: 'user', content: 'analyse' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'propose_transaction',
            description: 'd',
            parameters: { type: 'object', properties: { amount: { type: 'number' } } },
          },
        },
      ],
    });

    expect(result.text).toBe('Je vais enregistrer.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].function.name).toBe('propose_transaction');
    expect(JSON.parse(result.toolCalls[0].function.arguments)).toEqual({ amount: 100 });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    // Anthropic schema: input_schema, no `type: function` wrapper.
    expect(body.tools[0]).toEqual({
      name: 'propose_transaction',
      description: 'd',
      input_schema: { type: 'object', properties: { amount: { type: 'number' } } },
    });
  });

  it('honours a base URL override for custom endpoints', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(anthropicReply));
    await sendChat({
      providerId: 'custom',
      apiKey: 'k',
      model: 'm',
      baseUrlOverride: 'http://localhost:11434/v1/',
      messages: [{ role: 'user', content: 'hi' }],
    });
    const [url] = vi.mocked(fetch).mock.calls[0] as unknown as [string];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });
});

describe('fetchModels — vision + tool filtering', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only models that declare both image input and tools', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'vendor/vision-and-tools',
            name: 'Vision + Tools',
            architecture: { modality: 'text+image->text' },
            supported_parameters: ['tools', 'temperature'],
            context_length: 128000,
          },
          {
            id: 'vendor/vision-only',
            name: 'Vision Only',
            architecture: { modality: 'text+image->text' },
            supported_parameters: ['temperature'],
          },
          {
            id: 'vendor/tools-only',
            name: 'Tools Only',
            architecture: { modality: 'text->text' },
            supported_parameters: ['tools'],
          },
          {
            id: 'vendor/text-only',
            name: 'Text Only',
            architecture: { modality: 'text->text' },
            supported_parameters: ['temperature'],
          },
        ],
      })
    );

    const result = await fetchModels('openrouter', 'sk-or-v1-test');
    expect(result.models.map((m) => m.id)).toEqual(['vendor/vision-and-tools']);
    expect(result.models[0].vision).toBe(true);
    expect(result.models[0].tools).toBe(true);
    expect(result.models[0].contextLength).toBe(128000);
    expect(result.models[0].source).toBe('live');
    expect(result.fromLive).toBe(true);
  });

  it('falls back to the static predicates when the payload has no capability metadata', async () => {
    // OpenAI /v1/models returns only {id, created, owned_by} — no modality flags.
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'gpt-4o', created: 1, object: 'model', owned_by: 'system' },
          { id: 'gpt-4o-mini', created: 1, object: 'model', owned_by: 'system' },
          { id: 'text-embedding-3-small', created: 1, object: 'model', owned_by: 'system' },
        ],
      })
    );

    const result = await fetchModels('openai', 'sk-test');
    const ids = result.models.map((m) => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('gpt-4o-mini');
    // Embeddings are neither vision nor tool models.
    expect(ids).not.toContain('text-embedding-3-small');
  });

  it('degrades to the curated fallback list when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));
    const result = await fetchModels('anthropic', 'sk-bad');
    expect(result.fromLive).toBe(false);
    expect(result.warning).toMatch(/Catalogue de secours/);
    expect(result.models.length).toBeGreaterThan(0);
    expect(result.models[0].source).toBe('static');
    // The fallback list must itself satisfy the vision + tools requirement.
    for (const m of result.models) {
      expect(m.vision).toBe(true);
      expect(m.tools).toBe(true);
    }
  });

  it('returns the fallback list without calling the API when no key is given', async () => {
    const result = await fetchModels('nvidia', '');
    expect(fetch).not.toHaveBeenCalled();
    expect(result.fromLive).toBe(false);
    expect(result.models.every((m) => m.vision && m.tools)).toBe(true);
  });

  it('serves a cached catalogue on the second call', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 'vendor/live-model',
            architecture: { modality: 'image->text' },
            supported_parameters: ['tools'],
          },
        ],
      })
    );

    const first = await fetchModels('openrouter', 'sk-or-v1-test', { force: true });
    expect(first.fromLive).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    const second = await fetchModels('openrouter', 'sk-or-v1-test');
    expect(second.fromLive).toBe(true);
    expect(second.models[0].id).toBe('vendor/live-model');
    // Served from cache — no second network call.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
