/**
 * Subscription / feature-gating service (Phase 3.1).
 *
 * Architecture:
 *   Client  →  POST /api/create-checkout-session (Cloudflare Worker)  →  Stripe
 *   Stripe  →  POST /api/stripe-webhook (Cloudflare Worker)           →  Firestore subscriptions/{uid}
 *   Client  →  reads subscriptions/{uid} (read-only, rules deny writes)
 *
 * SECURITY: Stripe keys live ONLY in Cloudflare secrets (`wrangler secret put
 * STRIPE_SECRET_KEY`). Nothing secret is ever bundled into the client (Règle 6).
 *
 * STRIPE_NOT_CONFIGURED: while no Stripe account is provisioned, `createCheckoutSession`
 * throws a typed error so the UI can show an explicit, honest banner instead of a
 * broken payment button. See FINAL_ENGINEERING_REPORT.md > Remaining blockers.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'ultra';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  /** ISO date when the current period ends. */
  expiresAt?: string;
  /** ISO date when the free trial ends (7 days from signup). */
  trialEndsAt?: string;
  stripeCustomerId?: string;
  updatedAt?: string;
}

export const FREE_TRIAL_DAYS = 7;

/** Monthly price in FCFA — mirrors the landing page tiers. */
export const PLAN_PRICES_FCFA: Record<Exclude<PlanId, 'free'>, number> = {
  starter: 15_000,
  pro: 25_000,
  ultra: 50_000,
};

/** Stripe price id env names, one per plan. Empty = not configured. */
const PRICE_ENV_KEYS: Record<Exclude<PlanId, 'free'>, string> = {
  starter: 'VITE_STRIPE_PRICE_STARTER',
  pro: 'VITE_STRIPE_PRICE_PRO',
  ultra: 'VITE_STRIPE_PRICE_ULTRA',
};

export class StripeNotConfiguredError extends Error {
  readonly code = 'STRIPE_NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'StripeNotConfiguredError';
  }
}

/** True when the Stripe price IDs are present in the build environment. */
export function isStripeConfigured(): boolean {
  const env = (import.meta as any).env ?? {};
  return Object.values(PRICE_ENV_KEYS).some((k) => typeof env[k] === 'string' && env[k].length > 0);
}

export function getPriceId(plan: Exclude<PlanId, 'free'>): string | null {
  const env = (import.meta as any).env ?? {};
  const id = env[PRICE_ENV_KEYS[plan]];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Redirects the browser to Stripe Checkout for the given plan.
 * Throws StripeNotConfiguredError when Stripe is not wired up.
 */
export async function createCheckoutSession(plan: Exclude<PlanId, 'free'>, uid: string): Promise<void> {
  const priceId = getPriceId(plan);

  if (!priceId) {
    throw new StripeNotConfiguredError(
      `Stripe n'est pas configuré : le price ID du plan "${plan}" est absent ` +
        `(VITE_STRIPE_PRICE_${plan.toUpperCase()}). Configurez-le dans Cloudflare Pages > Variables d'environnement.`
    );
  }

  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      priceId,
      uid,
      // Bring the user back to the dashboard after a successful payment.
      successUrl: `${window.location.origin}/dashboard?checkout=success`,
      cancelUrl: `${window.location.origin}/?checkout=canceled`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Checkout impossible (${response.status}) ${text}`.trim());
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Le serveur n'a pas renvoyé d'URL de paiement Stripe.");
  }
  window.location.assign(data.url);
}

/** Adds a waitlist entry (Phase 3.2 — pre-launch email capture). */
export async function joinWaitlist(email: string, sector?: string): Promise<void> {
  const response = await fetch('/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, sector, source: 'landing' }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Inscription à la liste d'attente impossible (${response.status}) ${text}`.trim());
  }
}

// ---------------------------------------------------------------------------
// Feature gating
// ---------------------------------------------------------------------------

/**
 * Gated capabilities. Everything NOT listed here (dashboard, simulator, tax engine,
 * documents, journal, vault, references, calendar, settings) stays permanently free.
 */
export type FeatureId =
  | 'transactions_unlimited'
  | 'invoice_pdf'
  | 'export_data'
  | 'payroll'
  | 'bank_import'
  | 'unlimited_scan'
  | 'unlimited_chat';

/**
 * What each plan unlocks.
 * Free unlocks nothing here — the free plan is a *quota*, not a tier (see FREE_LIMITS).
 */
const FEATURE_MATRIX: Record<PlanId, FeatureId[]> = {
  free: [],
  starter: ['transactions_unlimited', 'invoice_pdf', 'payroll'],
  pro: [
    'transactions_unlimited',
    'invoice_pdf',
    'export_data',
    'payroll',
    'bank_import',
    'unlimited_scan',
    'unlimited_chat',
  ],
  ultra: [
    'transactions_unlimited',
    'invoice_pdf',
    'export_data',
    'payroll',
    'bank_import',
    'unlimited_scan',
    'unlimited_chat',
  ],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isTrialActive(sub: Subscription | null): boolean {
  if (!sub?.trialEndsAt) return false;
  const ends = new Date(sub.trialEndsAt).getTime();
  return Number.isFinite(ends) && ends > Date.now();
}

export function isSubscriptionActive(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status === 'active') {
    if (!sub.expiresAt) return true;
    return new Date(sub.expiresAt).getTime() > Date.now();
  }
  if (sub.status === 'trialing') return isTrialActive(sub) || !sub.trialEndsAt;
  return false;
}

/** Remaining days before the free trial expires (0 when expired/absent). */
export function trialDaysLeft(sub: Subscription | null): number {
  if (!sub?.trialEndsAt) return 0;
  const ends = new Date(sub.trialEndsAt).getTime();
  if (!Number.isFinite(ends) || ends <= Date.now()) return 0;
  return Math.ceil((ends - Date.now()) / MS_PER_DAY);
}

/**
 * True when the feature is usable. Requires an active subscription (or a running
 * free trial) for any gated capability.
 */
export function canUseFeature(feature: FeatureId, sub: Subscription | null): boolean {
  if (!isSubscriptionActive(sub)) return false;
  return FEATURE_MATRIX[sub?.plan ?? 'free'].includes(feature);
}

/** Quotas granted to users without a subscription. */
export const FREE_LIMITS = {
  scansPerMonth: 10,
  chatMessagesPerDay: 20,
} as const;
