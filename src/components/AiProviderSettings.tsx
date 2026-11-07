import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Cpu,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Search,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  PROVIDERS,
  getProvider,
  looksLikeValidKey,
  fetchModels,
  describeModel,
  getProviderKey,
  setProviderKey,
  peekProviderKey,
  loadAiConfig,
  saveAiConfig,
  loadCustomBaseUrl,
  saveCustomBaseUrl,
  testProvider,
  type ModelInfo,
} from '../services/ai';

/**
 * BYOK AI configuration panel (provider + key + model).
 *
 * Only models that support BOTH image input and tool/function calling are offered —
 * the app's core loop is "scan a document, extract a transaction, run tax tools".
 * The catalogue is fetched live from the provider and cached for 6 h, so it stays
 * current without an app release.
 */
export function AiProviderSettings() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(() => loadAiConfig());
  const [customBase, setCustomBase] = useState(() => loadCustomBaseUrl());

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsWarning, setModelsWarning] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'ok' | 'fail'; message: string }>({
    status: 'idle',
    message: '',
  });

  const provider = getProvider(config.providerId);

  // Load any stored key for the selected provider.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getProviderKey(config.providerId);
      if (cancelled) return;
      setApiKey(stored);
      setHasStoredKey(stored.length > 0);
      setTestState({ status: 'idle', message: '' });
    })();
    return () => {
      cancelled = true;
    };
  }, [config.providerId]);

  const loadModels = useCallback(
    async (force = false) => {
      setModelsLoading(true);
      setModelsWarning(null);
      const result = await fetchModels(config.providerId, apiKey || peekProviderKey(config.providerId), { force });
      setModels(result.models);
      setModelsWarning(result.warning ?? null);
      setModelsLoading(false);
    },
    [config.providerId, apiKey]
  );

  useEffect(() => {
    void loadModels(false);
  }, [loadModels]);

  const filtered = search.trim()
    ? models.filter((m) => (m.id + ' ' + m.name).toLowerCase().includes(search.toLowerCase()))
    : models;

  const persist = (patch: Partial<typeof config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveAiConfig(next);
  };

  const handleSaveKey = async () => {
    const ok = await setProviderKey(config.providerId, apiKey);
    if (!ok) {
      setTestState({ status: 'fail', message: "Stockage sécurisé indisponible dans ce navigateur." });
      return;
    }
    setHasStoredKey(apiKey.trim().length > 0);
    await loadModels(true);
  };

  const handleTest = async () => {
    setTestState({ status: 'testing', message: '' });
    const result = await testProvider({
      providerId: config.providerId,
      apiKey,
      model: config.model || filtered[0]?.id || '',
      baseUrlOverride: config.providerId === 'custom' ? customBase || undefined : undefined,
    });
    setTestState({ status: result.ok ? 'ok' : 'fail', message: result.message });
  };

  const keyValid = apiKey.trim().length === 0 || looksLikeValidKey(provider, apiKey);

  return (
    <div className="space-y-6">
      {/* Provider */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
          {t('ai.provider')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const active = p.id === config.providerId;
            return (
              <button
                key={p.id}
                onClick={() => persist({ providerId: p.id, model: '' })}
                className={cn(
                  'text-left p-4 rounded-2xl border transition-all',
                  active
                    ? 'bg-gold-500/10 border-gold-500/40 shadow-[0_0_15px_rgba(212,175,55,0.1)]'
                    : 'bg-luxury-900/40 border-border-subtle hover:border-white/10'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm font-bold', active ? 'text-gold-300' : 'text-zinc-300')}>
                    {p.label}
                  </span>
                  {active && <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0" />}
                </div>
                {p.notes && <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{p.notes}</p>}
                {p.keyPrefix && (
                  <p className="text-[10px] text-zinc-600 mt-1.5 font-mono">{p.keyHint}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom base URL */}
      {config.providerId === 'custom' && (
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
            {t('ai.customBaseUrl')}
          </label>
          <input
            type="url"
            value={customBase}
            onChange={(e) => {
              setCustomBase(e.target.value);
              saveCustomBaseUrl(e.target.value);
            }}
            placeholder="http://localhost:11434/v1"
            className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 font-mono focus:outline-none focus:border-gold-500/50"
          />
        </div>
      )}

      {/* API key */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {t('ai.apiKey')} — {provider.label}
          </label>
          {hasStoredKey && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3 h-3" /> {t('ai.keyStored')}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider.keyHint}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'w-full bg-luxury-900 border rounded-xl pl-9 pr-10 py-3 text-sm text-gold-100 font-mono focus:outline-none transition-colors',
                keyValid ? 'border-border-subtle focus:border-gold-500/50' : 'border-red-500/50'
              )}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            className="shrink-0 px-4 py-3 rounded-xl bg-gold-500 text-zinc-950 text-sm font-bold hover:bg-gold-400 transition-all disabled:opacity-40"
          >
            {t('ai.saveKey')}
          </button>
        </div>

        {!keyValid && (
          <p className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('ai.keyFormatHint', { prefix: provider.keyPrefix })}
          </p>
        )}
        <p className="mt-2 text-[11px] text-zinc-600 leading-relaxed">{t('ai.keyPrivacy')}</p>

        {provider.docsUrl && (
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-gold-500/80 hover:text-gold-400"
          >
            <ExternalLink className="w-3 h-3" /> {t('ai.getKey')}
          </a>
        )}
      </div>

      {/* Models */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {t('ai.model')}
            <span className="ml-2 text-[10px] font-medium normal-case tracking-normal text-zinc-600">
              {t('ai.modelFilterNote')}
            </span>
          </label>
          <button
            onClick={() => loadModels(true)}
            disabled={modelsLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-[11px] font-bold text-zinc-400 hover:text-gold-300 transition-colors disabled:opacity-50"
          >
            {modelsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('ai.refreshModels')}
          </button>
        </div>

        {modelsWarning && (
          <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/90 leading-relaxed">{modelsWarning}</p>
          </div>
        )}

        {modelsLoading && models.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('ai.loadingModels')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40 text-center">
            <Cpu className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">{t('ai.noModels')}</p>
            {config.providerId === 'custom' && (
              <input
                value={config.model}
                onChange={(e) => persist({ model: e.target.value })}
                placeholder={t('ai.customModelPlaceholder')}
                className="mt-4 w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-gold-100 font-mono focus:outline-none focus:border-gold-500/50"
              />
            )}
          </div>
        ) : (
          <>
            {models.length > 6 && (
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('ai.searchModels')}
                  className="w-full bg-luxury-900 border border-border-subtle rounded-xl pl-9 pr-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50"
                />
              </div>
            )}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-border-subtle bg-luxury-900/40 divide-y divide-border-subtle">
              {filtered.map((m) => {
                const active = m.id === config.model;
                return (
                  <button
                    key={m.id}
                    onClick={() => persist({ model: m.id })}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors',
                      active ? 'bg-gold-500/10' : 'hover:bg-white/[0.03]'
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn('text-sm font-semibold truncate', active ? 'text-gold-300' : 'text-zinc-200')}>
                        {m.name}
                      </p>
                      <p className="text-[11px] text-zinc-600 font-mono truncate">{m.id}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        {describeModel(m)} {m.source === 'live' ? t('ai.liveTag') : t('ai.fallbackTag')}
                      </p>
                    </div>
                    {active && <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Test */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <button
          onClick={handleTest}
          disabled={testState.status === 'testing' || !apiKey.trim() || !config.model}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all disabled:opacity-40"
        >
          {testState.status === 'testing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {t('ai.testing')}
            </>
          ) : (
            t('ai.testConnection')
          )}
        </button>

        {testState.status === 'ok' && (
          <p className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {testState.message}
          </p>
        )}
        {testState.status === 'fail' && (
          <p className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" /> {testState.message}
          </p>
        )}
      </div>

      {/* Reset */}
      <div className="pt-4 border-t border-border-subtle">
        <button
          onClick={async () => {
            await setProviderKey(config.providerId, '');
            setApiKey('');
            setHasStoredKey(false);
            setConfig({ ...config, model: '' });
            saveAiConfig({ ...config, model: '' });
          }}
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> {t('ai.clearKey')}
        </button>
      </div>
    </div>
  );
}
