/**
 * Persisted AI configuration: which provider + model the user selected.
 *
 * Keys are NOT here — they live in the encrypted vault (`keys.ts`).
 * Only the selection is stored in localStorage so the UI restores instantly.
 */

import { DEFAULT_PROVIDER_ID } from './providers';
import { clearModelCache, getCachedModels } from './models';

const STORAGE_KEY = 'libriwouo_ai_config';
const CUSTOM_BASE_KEY = 'libriwouo_ai_custom_base';

export interface AiConfig {
  providerId: string;
  model: string;
  /** Extra model ids the user typed manually (custom providers). */
  customModels?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed) && typeof parsed.providerId === 'string') {
        return {
          providerId: parsed.providerId,
          model: typeof parsed.model === 'string' ? parsed.model : '',
          customModels: Array.isArray(parsed.customModels)
            ? parsed.customModels.filter((m): m is string => typeof m === 'string')
            : [],
        };
      }
    }
  } catch {}
  return { providerId: DEFAULT_PROVIDER_ID, model: '', customModels: [] };
}

export function saveAiConfig(config: AiConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CUSTOM_BASE_KEY);
  } catch {}
}

export function loadCustomBaseUrl(): string {
  try {
    return localStorage.getItem(CUSTOM_BASE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomBaseUrl(url: string): void {
  try {
    localStorage.setItem(CUSTOM_BASE_KEY, url.trim().replace(/\/+$/, ''));
  } catch {}
}

/**
 * Resolves the effective model id, preferring the live catalogue.
 * Falls back to whatever the user selected, then the first usable model.
 */
export function resolveModel(config: AiConfig, providerId: string): string {
  if (config.model) return config.model;
  const usable = getCachedModels(providerId);
  return usable[0]?.id || '';
}

/** Drops the cached model list so the next read refetches it. */
export function refreshModelCatalog(providerId?: string): void {
  clearModelCache(providerId);
}
