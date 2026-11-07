/**
 * Analytics service (Phase 5.2) — PostHog wrapper.
 *
 * Design rules:
 *  - No-op until a public key is configured (VITE_POSTHOG_KEY). The app must work
 *    perfectly with analytics disabled — a missing key is NOT an error.
 *  - The PostHog project key is PUBLIC BY DESIGN (like the Firebase web config).
 *    Never put a secret in a VITE_ variable.
 *  - Events are fire-and-forget: an analytics failure must never break a user flow.
 *  - All tracking is gated behind a consent flag so the GDPR/opt-out path is real.
 */

const POSTHOG_KEY = (import.meta as any).env?.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST =
  ((import.meta as any).env?.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com';

export const ANALYTICS_ENABLED: boolean =
  typeof POSTHOG_KEY === 'string' && POSTHOG_KEY.length > 0 && !(import.meta as any).env?.DEV;

/** Consent is stored in localStorage so the user's choice survives reloads. */
const CONSENT_KEY = 'libriwouo_analytics_consent';

type Consent = 'granted' | 'denied' | 'unknown';

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : 'unknown';
  } catch {
    return 'unknown';
  }
}

let initialized = false;
let consent: Consent = 'unknown';

/** Named events tracked for the conversion funnel. */
export type AnalyticsEvent =
  | 'page_view'
  | 'signup_complete'
  | 'login_complete'
  | 'beta_login'
  | 'scan_receipt'
  | 'generate_invoice'
  | 'start_trial'
  | 'upgrade_click'
  | 'waitlist_join'
  | 'checkout_started'
  | 'feature_gate_hit'
  | 'bank_import'
  | 'onboarding_complete';

/** Initialise PostHog. Safe to call multiple times. */
export function initAnalytics(): void {
  if (initialized || !ANALYTICS_ENABLED) return;
  consent = readConsent();

  void (async () => {
    try {
      const posthog = (await import('posthog-js')).default;
      posthog.init(POSTHOG_KEY as string, {
        api_host: POSTHOG_HOST,
        // Elevate privacy: no autocapture, no session recording, no cross-session ids
        // until the user grants consent.
        autocapture: consent === 'granted',
        capture_pageview: false,
        disable_session_recording: true,
        persistence: consent === 'granted' ? 'localStorage' : 'memory',
        loaded: (client) => {
          if (consent !== 'granted') client.opt_out_capturing();
        },
      });
      initialized = true;
    } catch (error) {
      console.warn('[Analytics] PostHog failed to load, tracking disabled:', error);
    }
  })();
}

/** Record the user's consent choice and apply it. */
export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  consent = value;
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
  if (!initialized) return;
  void (async () => {
    try {
      const posthog = (await import('posthog-js')).default;
      if (value === 'granted') posthog.opt_in_capturing();
      else posthog.opt_out_capturing();
    } catch {}
  })();
}

export function getAnalyticsConsent(): Consent {
  return consent;
}

/** Track an event. Never throws, never blocks the caller. */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if (!initialized || consent !== 'granted') return;
  void (async () => {
    try {
      const posthog = (await import('posthog-js')).default;
      posthog.capture(event, {
        ...properties,
        // Never send raw amounts/PII-like data; a coarse bucket is enough.
        url: window.location.pathname,
      });
    } catch {}
  })();
}

/** Identify the signed-in user (hashed uid, never the email). */
export function identifyUser(uid: string, traits?: Record<string, unknown>): void {
  if (!initialized || consent !== 'granted') return;
  void (async () => {
    try {
      const posthog = (await import('posthog-js')).default;
      posthog.identify(uid, traits);
    } catch {}
  })();
}

/** Reset the identity on logout. */
export function resetAnalytics(): void {
  if (!initialized) return;
  void (async () => {
    try {
      const posthog = (await import('posthog-js')).default;
      posthog.reset();
    } catch {}
  })();
}
