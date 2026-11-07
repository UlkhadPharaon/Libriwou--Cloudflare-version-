import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Lock, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isStripeConfigured, createCheckoutSession, isSubscriptionActive, trialDaysLeft, type PlanId } from '../services/subscription';
import { track } from '../services/analytics';
import { cn } from '../lib/utils';

/**
 * PRO badge shown next to a gated feature (Phase 3.1).
 * Renders nothing when the user already has an active subscription.
 *
 * NOTE: Stripe is dormant until keys are configured (see FINAL_ENGINEERING_REPORT.md),
 * so in practice no user has an active subscription yet and every gated feature
 * shows the badge. `isBeta` is gone with Firebase — beta testers are no longer a
 * special case.
 */
export function ProBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { subscription } = useAuth();
  if (isSubscriptionActive(subscription)) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-400',
        'border border-gold-500/30 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
        className
      )}
      title={t('subscription.upgradeTooltip')}
    >
      <Crown className="w-3 h-3" />
      {t('subscription.pro')}
    </span>
  );
}

/**
 * Panel that replaces a locked feature's content.
 * Always gives an honest explanation and, when Stripe is live, a real CTA.
 */
export function UpgradePanel({
  feature,
  title,
  description,
  className,
}: {
  feature: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { user, subscription } = useAuth();
  const stripeLive = isStripeConfigured();
  const [pendingPlan, setPendingPlan] = useState<Exclude<PlanId, 'free'> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trialDaysRemaining = trialDaysLeft(subscription);
  const handleUpgrade = async (plan: Exclude<PlanId, 'free'>) => {
    if (!user) return;
    setPendingPlan(plan);
    setError(null);
    // Phase 5.2 — funnel event for the pricing → checkout step.
    track('upgrade_click', { plan, feature });
    try {
      await createCheckoutSession(plan, user.id);
      // On success the browser is redirected by createCheckoutSession.
    } catch (e: any) {
      console.error('[UpgradePanel] checkout failed', e);
      setError(e?.message || t('common.error'));
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-500/25 bg-luxury-900/60 p-6 md:p-8 text-center',
        className
      )}
    >
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-gold-500/10 blur-[80px] rounded-full pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/25 flex items-center justify-center text-gold-400 mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-serif text-gold-100 mb-2 flex items-center gap-2">
          {title ?? t('subscription.lockedTitle')}
          <ProBadge />
        </h3>
        <p className="text-sm text-zinc-400 max-w-md leading-relaxed mb-5">
          {description ?? t('subscription.lockedDescription', { feature })}
        </p>

        {stripeLive ? (
          <button
            onClick={() => handleUpgrade('pro')}
            disabled={pendingPlan !== null}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gold-500 text-zinc-950 text-sm font-bold hover:bg-gold-400 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] disabled:opacity-60"
          >
            {pendingPlan ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('subscription.upgradeCta')} — 25 000 FCFA/mois
              </>
            )}
          </button>
        ) : (
          <div className="w-full max-w-md space-y-3">
            {/* Règle 4: never promise a payment flow that cannot complete. */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left">
              <Crown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                {t('subscription.stripeNotConfigured')}
              </p>
            </div>
            <Link
              to="/settings"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 transition-all"
            >
              {t('subscription.joinWaitlist')}
            </Link>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {trialDaysRemaining > 0 && (
          <p className="mt-4 text-xs text-emerald-400">
            {t('subscription.trialActive', { days: trialDaysRemaining })}
          </p>
        )}
      </div>
    </div>
  );
}
