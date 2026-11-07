/**
 * Live model catalogue (Phase: BYOK multi-provider AI).
 *
 * Fetches the model list from the provider's own endpoint, then keeps ONLY the
 * models that can do BOTH:
 *   - vision  (read images — required to scan receipts/invoices)
 *   - tools   (function calling — required for the agentic loop)
 *
 * Capability metadata availability per provider:
 *   OpenRouter  -> `architecture.modality` + `supported_parameters` : authoritative
 *   Others      -> no capability flags in payload: fall back to the provider's
 *                  static `isVisionModel` / `isToolModel` predicates.
 *
 * Results are cached per provider for 6 hours so the dropdown stays instant and
 * the app keeps working offline.
 */

import { AiProvider, ModelInfo, getProvider } from './providers';

const CACHE_KEY_PREFIX = 'libriwouo_models_';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  fetchedAt: number;
  models: ModelInfo[];
}

function readCache(providerId: string): ModelInfo[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + providerId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.models)) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.models;
  } catch {
    return null;
  }
}

function writeCache(providerId: string, models: ModelInfo[]): void {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), models };
    localStorage.setItem(CACHE_KEY_PREFIX + providerId, JSON.stringify(entry));
  } catch {
    /* storage full / private mode — cache is best-effort */
  }
}

/** Removes a cached catalogue so the next fetch is guaranteed fresh. */
export function clearModelCache(providerId?: string): void {
  try {
    if (providerId) {
      localStorage.removeItem(CACHE_KEY_PREFIX + providerId);
      return;
    }
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {}
}

/** Headers for a browser-origin request to this provider. */
function buildHeaders(provider: AiProvider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...(provider.browserHeaders || {}),
  };
  // Anthropic expects the key in `x-api-key`, not `Authorization`.
  if (provider.apiShape === 'anthropic') {
    headers['x-api-key'] = apiKey;
    delete headers.Authorization;
  }
  return headers;
}

/**
 * `true` when a raw provider model entry declares image input.
 * OpenRouter is the only provider that publishes this today.
 */
function declaresVision(raw: any): boolean | null {
  const modality = raw?.architecture?.modality;
  if (typeof modality === 'string') {
    return /image/i.test(modality);
  }
  // Some providers expose `input_modalities` / `modalities`.
  for (const field of ['input_modalities', 'modalities', 'input']) {
    const value = raw?.[field];
    if (Array.isArray(value)) {
      return value.some((v) => typeof v === 'string' && /image/i.test(v));
    }
  }
  return null;
}

function declaresTools(raw: any): boolean | null {
  const supported = raw?.supported_parameters;
  if (Array.isArray(supported)) {
    return supported.some((p) => typeof p === 'string' && /^(tools?|tool_choice)$/i.test(p));
  }
  if (Array.isArray(raw?.tools)) return true;
  return null;
}

function normalise(raw: any, provider: AiProvider): ModelInfo | null {
  const id = typeof raw?.id === 'string' ? raw.id : null;
  if (!id) return null;
  const name = typeof raw?.name === 'string' && raw.name ? raw.name : id;

  const liveVision = declaresVision(raw);
  const vision = liveVision === null ? provider.isVisionModel?.(id) ?? false : liveVision;

  const liveTools = declaresTools(raw);
  const tools = liveTools === null ? provider.isToolModel?.(id) ?? false : liveTools;

  const contextLength =
    typeof raw?.context_length === 'number'
      ? raw.context_length
      : typeof raw?.context_window === 'number'
        ? raw.context_window
        : typeof raw?.max_context_length === 'number'
          ? raw.max_context_length
          : undefined;

  return { id, name, vision, tools, contextLength, source: 'live' };
}

export interface FetchModelsResult {
  models: ModelInfo[];
  /** True when the list came from the provider right now. */
  fromLive: boolean;
  /** Message to show the user when the live fetch failed. */
  warning?: string;
}

/**
 * Returns the usable (vision + tools) models for a provider.
 * Never throws — a failure degrades to the curated fallback list.
 */
export async function fetchModels(
  providerId: string,
  apiKey: string,
  opts: { force?: boolean } = {}
): Promise<FetchModelsResult> {
  const provider = getProvider(providerId);

  if (provider.id === 'custom') {
    return { models: [], fromLive: false, warning: 'Renseignez un modèle manuellement.' };
  }

  if (!opts.force) {
    const cached = readCache(provider.id);
    if (cached && cached.length > 0) return { models: cached, fromLive: true };
  }

  if (!apiKey.trim()) {
    return {
      models: provider.fallbackModels,
      fromLive: false,
      warning: 'Aucune clé API : catalogue de secours affiché.',
    };
  }

  if (!provider.modelsUrl) {
    return {
      models: provider.fallbackModels,
      fromLive: false,
      warning: 'Ce fournisseur ne publie pas sa liste de modèles.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(provider.modelsUrl, {
      method: 'GET',
      headers: buildHeaders(provider, apiKey),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const status = response.status;
      return {
        models: provider.fallbackModels,
        fromLive: false,
        warning: `Liste des modèles indisponible (${status}). Catalogue de secours affiché.`,
      };
    }

    const payload = await response.json();
    const rows: any[] = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];

    const usable = rows
      .map((r) => normalise(r, provider))
      .filter((m): m is ModelInfo => m !== null && m.vision && m.tools)
      // Keep the cheapest/most capable first: sort by id for stable ordering.
      .sort((a, b) => a.id.localeCompare(b.id));

    if (usable.length === 0) {
      return {
        models: provider.fallbackModels,
        fromLive: false,
        warning: 'Aucun modèle vision+outils trouvé sur ce compte. Catalogue de secours.',
      };
    }

    writeCache(provider.id, usable);
    return { models: usable, fromLive: true };
  } catch (error: any) {
    return {
      models: provider.fallbackModels,
      fromLive: false,
      warning:
        error?.name === 'AbortError'
          ? "Le fournisseur n'a pas répondu à temps. Catalogue de secours."
          : `Impossible de lister les modèles (${error?.message || 'erreur réseau'}).`,
    };
  }
}

/** Synchronous helper: cached list first, fallback otherwise. */
export function getCachedModels(providerId: string): ModelInfo[] {
  return readCache(providerId) ?? getProvider(providerId).fallbackModels;
}

/** Human label for a model id, used in the UI. */
export function describeModel(model: ModelInfo): string {
  const bits: string[] = [model.name];
  if (model.vision) bits.push('vision');
  if (model.tools) bits.push('outils');
  if (model.contextLength) bits.push(`${Math.round(model.contextLength / 1000)}k ctx`);
  return bits.join(' · ');
}
