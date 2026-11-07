/**
 * BYOK multi-provider AI — public surface.
 *
 * Everything the app needs to talk to a user-supplied model:
 *   providers  -> which providers exist and how to reach them
 *   models     -> live catalogue, filtered to vision + tool calling
 *   keys       -> encrypted per-device key vault
 *   client     -> one normalised chat call for every provider
 *   settings  -> persisted provider/model selection
 */

export {
  PROVIDERS,
  DEFAULT_PROVIDER_ID,
  getProvider,
  looksLikeValidKey,
  type AiProvider,
  type ApiShape,
  type ModelInfo,
} from './providers';

export {
  fetchModels,
  getCachedModels,
  clearModelCache,
  describeModel,
  type FetchModelsResult,
} from './models';

export {
  setProviderKey,
  getProviderKey,
  peekProviderKey,
  listConfiguredProviders,
  warmKeyVault,
  wipeKeyVault,
} from './keys';

export {
  sendChat,
  testProvider,
  AiConfigError,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type ChatTool,
  type ContentPart,
  type ToolCall,
} from './client';

export {
  loadAiConfig,
  saveAiConfig,
  clearAiConfig,
  loadCustomBaseUrl,
  saveCustomBaseUrl,
  resolveModel,
  refreshModelCatalog,
  type AiConfig,
} from './settings';
