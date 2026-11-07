/**
 * AI provider registry (BYOK — bring your own key).
 *
 * Design rules enforced here:
 *  1. Only providers whose API can be called straight from the browser are listed
 *     (CORS-enabled endpoints). The key belongs to the user, is stored on their
 *     device, and is sent only to the provider they chose.
 *  2. The model catalogue is fetched LIVE from the provider and filtered to models
 *     that support BOTH image input (vision) and tool/function calling — see
 *     `src/services/ai/models.ts`. A curated fallback lives here for offline use.
 *  3. Adding a provider = adding one entry to `PROVIDERS`. Nothing else changes.
 *
 * `apiShape` matters because Anthropic's Messages API is NOT OpenAI-compatible:
 * the system prompt is a top-level field, images are `{type:'image', source:{...}}`
 * blocks, tool calls come back as `tool_use` content blocks, and the request needs
 * an `anthropic-version` header. The client normalises both shapes.
 */

export type ApiShape = 'openai' | 'anthropic';

export interface ModelInfo {
  /** Provider-native model id, e.g. "anthropic/claude-sonnet-4.5" on OpenRouter. */
  id: string;
  name: string;
  /** Can the model read images? Required for receipt/invoice scanning. */
  vision: boolean;
  /** Does it support function/tool calling? Required for the agentic loop. */
  tools: boolean;
  /** Context window in tokens when known. */
  contextLength?: number;
  /** Rough relative cost hint for the UI (1 = cheapest). */
  priceTier?: 1 | 2 | 3;
  /** Where this entry came from. */
  source: 'static' | 'live';
}

export interface AiProvider {
  id: string;
  label: string;
  /** Human hint shown next to the key field. */
  keyHint: string;
  /** Expected key prefix, used for validation. Empty = no known prefix. */
  keyPrefix: string;
  /** Chat completions endpoint. */
  chatUrl: string;
  /** Model listing endpoint, when the provider has one. */
  modelsUrl?: string;
  apiShape: ApiShape;
  docsUrl: string;
  /** Extra headers required for browser (CORS) access. */
  browserHeaders?: Record<string, string>;
  /**
   * Static capability knowledge, used when `/models` is unavailable and to
   * validate/filter live results that lack capability metadata.
   */
  isVisionModel?: (modelId: string) => boolean;
  isToolModel?: (modelId: string) => boolean;
  /** Curated models shown before the live list is fetched. */
  fallbackModels: ModelInfo[];
  notes?: string;
}

const VISION_HINTS = [
  'vision',
  'vl',
  'pixtral',
  'llava',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4.1',
  'gpt-5',
  'claude-3',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-haiku-4',
  'llama-4',
  'llama-3.2',
  'qwen2.5-vl',
  'qwen2-vl',
  'qwen-vl',
  'internvl',
  'phi-3.5-vision',
  'phi-4-multimodal',
  'molmo',
  'gemma-3',
];

const TOOL_HINTS = [
  'claude-3',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-haiku-4',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4.1',
  'gpt-5',
  'llama-3.3',
  'llama-4',
  'llama-3.1',
  'qwen2.5',
  'qwen3',
  'mistral-large',
  'mistral-small',
  'pixtral',
  'gemma-3',
  'phi-4',
  'command-r',
  'nemotron',
];

const hasHint = (modelId: string, hints: string[]) => {
  const id = modelId.toLowerCase();
  return hints.some((h) => id.includes(h));
};

export const PROVIDERS: AiProvider[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyHint: 'sk-or-v1-… (openrouter.ai/keys)',
    keyPrefix: 'sk-or-v1-',
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://openrouter.ai/docs#api-keys',
    browserHeaders: { 'X-Title': 'Libriwouô' },
    // OpenRouter publishes capability metadata, so the live path is authoritative.
    isVisionModel: (id) => hasHint(id, VISION_HINTS),
    isToolModel: (id) => hasHint(id, TOOL_HINTS),
    fallbackModels: [
      { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', vision: true, tools: true, contextLength: 200000, priceTier: 2, source: 'static' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', vision: true, tools: true, contextLength: 128000, priceTier: 2, source: 'static' },
      { id: 'qwen/qwen-2.5-vl-72b-instruct', name: 'Qwen2.5-VL 72B', vision: true, tools: true, contextLength: 32768, priceTier: 1, source: 'static' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', vision: true, tools: true, contextLength: 1000000, priceTier: 1, source: 'static' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', vision: true, tools: true, contextLength: 200000, priceTier: 1, source: 'static' },
    ],
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    keyHint: 'nvapi-… (build.nvidia.com)',
    keyPrefix: 'nvapi-',
    chatUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    modelsUrl: 'https://integrate.api.nvidia.com/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html',
    isVisionModel: (id) => hasHint(id, VISION_HINTS),
    isToolModel: (id) => hasHint(id, TOOL_HINTS),
    fallbackModels: [
      { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', vision: true, tools: true, contextLength: 128000, priceTier: 1, source: 'static' },
      { id: 'meta/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', vision: true, tools: true, contextLength: 128000, priceTier: 1, source: 'static' },
      { id: 'microsoft/phi-3.5-vision-instruct', name: 'Phi-3.5 Vision', vision: true, tools: true, contextLength: 128000, priceTier: 1, source: 'static' },
    ],
    notes: 'NVIDIA NIM exposes a generous free tier and serves open vision models.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    keyHint: 'sk-ant-… (console.anthropic.com)',
    keyPrefix: 'sk-ant-',
    chatUrl: 'https://api.anthropic.com/v1/messages',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    apiShape: 'anthropic',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    // Required by Anthropic to allow direct browser calls.
    browserHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    isVisionModel: (id) => /claude-3|claude-opus-4|claude-sonnet-4|claude-haiku-4/i.test(id),
    isToolModel: (id) => /claude-3|claude-opus-4|claude-sonnet-4|claude-haiku-4/i.test(id),
    fallbackModels: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', vision: true, tools: true, contextLength: 200000, priceTier: 2, source: 'static' },
      { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', vision: true, tools: true, contextLength: 200000, priceTier: 3, source: 'static' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', vision: true, tools: true, contextLength: 200000, priceTier: 1, source: 'static' },
    ],
    notes: 'Toute la famille Claude 3+ accepte les images et les outils.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyHint: 'sk-… (platform.openai.com/api-keys)',
    keyPrefix: 'sk-',
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    modelsUrl: 'https://api.openai.com/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    isVisionModel: (id) => /gpt-4o|gpt-4-turbo|gpt-4\.1|gpt-5|o4-mini|\bo3\b/i.test(id),
    isToolModel: (id) => /gpt-4o|gpt-4-turbo|gpt-4\.1|gpt-5|o1|o3|o4/i.test(id),
    fallbackModels: [
      { id: 'gpt-4o', name: 'GPT-4o', vision: true, tools: true, contextLength: 128000, priceTier: 2, source: 'static' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', vision: true, tools: true, contextLength: 128000, priceTier: 1, source: 'static' },
      { id: 'gpt-4.1', name: 'GPT-4.1', vision: true, tools: true, contextLength: 1000000, priceTier: 2, source: 'static' },
    ],
  },
  {
    id: 'mistral',
    label: 'Mistral',
    keyHint: 'clé API (console.mistral.ai)',
    keyPrefix: '',
    chatUrl: 'https://api.mistral.ai/v1/chat/completions',
    modelsUrl: 'https://api.mistral.ai/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://docs.mistral.ai/api/',
    isVisionModel: (id) => /pixtral|mistral-large|mistral-small/i.test(id),
    isToolModel: (id) => /mistral-large|mistral-small|mistral-medium|pixtral/i.test(id),
    fallbackModels: [
      { id: 'pixtral-large-latest', name: 'Pixtral Large', vision: true, tools: true, contextLength: 128000, priceTier: 2, source: 'static' },
      { id: 'pixtral-12b-2409', name: 'Pixtral 12B', vision: true, tools: true, contextLength: 128000, priceTier: 1, source: 'static' },
    ],
  },
  {
    id: 'groq',
    label: 'Groq',
    keyHint: 'gsk_… (console.groq.com)',
    keyPrefix: 'gsk_',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://console.groq.com/docs/quickstart',
    isVisionModel: (id) => /llama-4|llama-guard-4|scout|maverick/i.test(id),
    isToolModel: (id) => /llama-3\.3|llama-4|qwen2\.5|gemma2/i.test(id),
    fallbackModels: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout (Groq)', vision: true, tools: true, contextLength: 131072, priceTier: 1, source: 'static' },
      { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick (Groq)', vision: true, tools: true, contextLength: 131072, priceTier: 2, source: 'static' },
    ],
    notes: 'Inférence très rapide, utile pour les longs documents.',
  },
  {
    id: 'together',
    label: 'Together AI',
    keyHint: 'clé API (api.together.ai)',
    keyPrefix: '',
    chatUrl: 'https://api.together.xyz/v1/chat/completions',
    modelsUrl: 'https://api.together.xyz/v1/models',
    apiShape: 'openai',
    docsUrl: 'https://docs.together.ai/docs/openai-api-compatibility',
    isVisionModel: (id) => hasHint(id, VISION_HINTS),
    isToolModel: (id) => hasHint(id, TOOL_HINTS),
    fallbackModels: [
      { id: 'Qwen/Qwen2.5-VL-72B-Instruct', name: 'Qwen2.5-VL 72B', vision: true, tools: true, contextLength: 32768, priceTier: 1, source: 'static' },
      { id: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', name: 'Llama 3.2 90B Vision', vision: true, tools: true, contextLength: 131072, priceTier: 1, source: 'static' },
    ],
  },
  {
    id: 'custom',
    label: 'Personnalisé (compatible OpenAI)',
    keyHint: 'votre clé API',
    keyPrefix: '',
    chatUrl: '',
    apiShape: 'openai',
    docsUrl: '',
    notes:
      "Pour vLLM, Ollama (avec proxy CORS), LM Studio, ou tout endpoint exposant /chat/completions. Renseignez l'URL de base vous-même.",
    fallbackModels: [],
  },
];

export const DEFAULT_PROVIDER_ID = 'openrouter';

export function getProvider(id: string): AiProvider {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

/** Validates a key against the provider's expected prefix. Non-blocking by design. */
export function looksLikeValidKey(provider: AiProvider, key: string): boolean {
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (!provider.keyPrefix) return true;
  return trimmed.startsWith(provider.keyPrefix);
}
