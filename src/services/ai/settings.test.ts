/**
 * Unit tests for the persisted AI configuration.
 *
 * `keys.ts` is deliberately NOT covered here: it needs IndexedDB plus a
 * non-extractable WebCrypto key, i.e. a real browser. Its logic (generate key,
 * encrypt, store, decrypt, warm) is exercised by the Settings UI end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadAiConfig,
  saveAiConfig,
  clearAiConfig,
  loadCustomBaseUrl,
  saveCustomBaseUrl,
  resolveModel,
  refreshModelCatalog,
  type AiConfig,
} from './settings';
import { getCachedModels } from './models';

const STORAGE_KEY = 'libriwouo_ai_config';
const CUSTOM_BASE_KEY = 'libriwouo_ai_custom_base';
const CACHE_PREFIX = 'libriwouo_models_';

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

describe('AI config persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to OpenRouter with no model selected', () => {
    const config = loadAiConfig();
    expect(config.providerId).toBe('openrouter');
    expect(config.model).toBe('');
    expect(config.customModels).toEqual([]);
  });

  it('round-trips through save / load', () => {
    const config: AiConfig = { providerId: 'anthropic', model: 'claude-sonnet-4-5-20250929' };
    saveAiConfig(config);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('anthropic');
    // The loader always normalises: customModels is filled in, nothing is dropped.
    expect(loadAiConfig()).toEqual({
      providerId: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      customModels: [],
    });
  });

  it('preserves an explicitly empty model across a round-trip', () => {
    saveAiConfig({ providerId: 'openai', model: '' });
    expect(loadAiConfig()).toEqual({ providerId: 'openai', model: '', customModels: [] });
  });

  it('ignores a corrupted payload instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadAiConfig().providerId).toBe('openrouter');
  });

  it('ignores a payload missing the provider id', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: 'x' }));
    expect(loadAiConfig().providerId).toBe('openrouter');
  });

  it('sanitises customModels down to strings', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ providerId: 'custom', model: 'm', customModels: ['ok', 42, null, 'also-ok'] })
    );
    expect(loadAiConfig().customModels).toEqual(['ok', 'also-ok']);
  });

  it('clears both the config and the custom base URL', () => {
    saveAiConfig({ providerId: 'openai', model: 'gpt-4o' });
    saveCustomBaseUrl('http://localhost:11434/v1/');
    clearAiConfig();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadCustomBaseUrl()).toBe('');
  });
});

describe('custom base URL', () => {
  beforeEach(() => localStorage.clear());

  it('strips trailing slashes so the endpoint joins cleanly', () => {
    saveCustomBaseUrl('http://localhost:11434/v1///');
    expect(loadCustomBaseUrl()).toBe('http://localhost:11434/v1');
  });

  it('trims whitespace', () => {
    saveCustomBaseUrl('  http://localhost:8000/v1  ');
    expect(loadCustomBaseUrl()).toBe('http://localhost:8000/v1');
  });
});

describe('resolveModel', () => {
  beforeEach(() => localStorage.clear());

  it('returns the selected model when one is set', () => {
    expect(resolveModel({ providerId: 'openrouter', model: 'openai/gpt-4o' }, 'openrouter')).toBe('openai/gpt-4o');
  });

  it('falls back to the first known vision+tools model', () => {
    const resolved = resolveModel({ providerId: 'anthropic', model: '' }, 'anthropic');
    const usable = getCachedModels('anthropic');
    expect(resolved).toBe(usable[0].id);
    expect(usable[0].vision).toBe(true);
    expect(usable[0].tools).toBe(true);
  });

  it('refreshModelCatalog forgets the cached list', () => {
    localStorage.setItem(
      CACHE_PREFIX + 'openrouter',
      JSON.stringify({ fetchedAt: Date.now(), models: [{ id: 'x', name: 'x', vision: true, tools: true, source: 'live' }] })
    );
    expect(getCachedModels('openrouter')).toHaveLength(1);
    refreshModelCatalog('openrouter');
    // Back to the curated fallback.
    expect(getCachedModels('openrouter').map((m) => m.id)).not.toContain('x');
  });
});
