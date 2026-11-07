import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onSessionChange, getCurrentUser, signOutLocal, type LocalUser } from '../services/session';
import { localDb } from '../services/localDb';
import {
  loadAiConfig,
  getProviderKey,
  type AiConfig,
} from '../services/ai';
import type { Subscription } from '../services/subscription';

interface AuthContextType {
  /** Local identity, or null before onboarding. */
  user: LocalUser | null;
  loading: boolean;
  /** True once a company profile exists locally. */
  hasProfile: boolean | null;
  /** Subscription document read from the local `subscriptions` collection. */
  subscription: Subscription | null;
  /** The user's persisted AI provider/model selection. */
  aiConfig: AiConfig;
  /** True when a key is stored for the selected provider. */
  aiReady: boolean;
  refreshProfile: () => void;
  setHasProfile: (value: boolean | null) => void;
  /** Convenience: the id used to namespace every local collection. */
  userId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(() => getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => loadAiConfig());
  const [aiReady, setAiReady] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const userId = user?.id || '';

  // Local identity — replaces Firebase's onAuthStateChanged.
  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
    setLoading(false);
    return onSessionChange((next) => {
      setUser(next);
      if (!next) setHasProfile(null);
    });
  }, []);

  // Company profile lives in the local `companies` collection.
  useEffect(() => {
    if (!userId) {
      setHasProfile(null);
      return;
    }
    const check = () => {
      const local = localDb.get('companies', userId);
      setHasProfile(!!local);
    };
    check();
    const unsubscribe = localDb.subscribe('companies', userId, () => check());
    // Startup race: on a cold page load the IndexedDB cache is still empty when this
    // effect first runs, which used to send an already-onboarded user back to
    // /onboarding. Re-check once storage has been hydrated.
    localDb.whenReady(check);
    return unsubscribe;
  }, [userId]);

  // AI configuration + whether a key is actually stored.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const config = loadAiConfig();
      const key = await getProviderKey(config.providerId);
      if (cancelled) return;
      setAiConfig(config);
      setAiReady(!!key);
    };
    check();

    // Another tab may have changed the config or the key vault.
    const onVisible = () => check();
    window.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  const refreshProfile = () => {
    if (userId) {
      const local = localDb.get('companies', userId);
      setHasProfile(!!local);
    }
  };

  // Subscription state for feature gating (local-first; a Stripe webhook would
  // write the same document once a backend exists).
  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      return;
    }
    return localDb.subscribe('subscriptions', userId, (rows) => {
      setSubscription((rows[0] as Subscription) ?? null);
    });
  }, [userId]);

  const value: AuthContextType = {
    user,
    loading,
    hasProfile,
    subscription,
    aiConfig,
    aiReady,
    refreshProfile,
    setHasProfile,
    userId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/** Sign out of the local session (data is kept on the device). */
export function useSignOut() {
  return () => signOutLocal();
}
