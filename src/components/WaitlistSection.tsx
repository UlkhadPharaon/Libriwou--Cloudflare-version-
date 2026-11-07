import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Mail, CheckCircle2, AlertCircle, Loader2, BellRing } from 'lucide-react';
import { joinWaitlist } from '../services/subscription';
import { track } from '../services/analytics';
import { ProBadge } from './ProBadge';

/**
 * Waitlist email capture (Phase 3.2).
 *
 * Shown on the LandingPage in place of "Start Free Trial" while Stripe is not
 * configured (Règle 4 — never advertise a payment flow that cannot complete).
 * Posts to /api/waitlist which writes to Firestore `waitlist/{email}`.
 */
export function WaitlistSection({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setState('error');
      setMessage(t('subscription.waitlistInvalid'));
      return;
    }
    setState('loading');
    setMessage(null);
    try {
      await joinWaitlist(email.trim());
      setState('success');
      setMessage(t('subscription.waitlistSuccess'));
      // Phase 5.2 — conversion funnel event.
      track('waitlist_join');
      setEmail('');
    } catch (error: any) {
      setState('error');
      setMessage(error?.message || t('subscription.waitlistError'));
    }
  };

  return (
    <section className={`py-16 px-6 ${className ?? ''}`}>
      <div className="max-w-xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-luxury-900/50 p-8 sm:p-10"
        >
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-gold-500/10 blur-[70px] rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gold-500/15 border border-gold-500/25 flex items-center justify-center text-gold-400 mx-auto mb-5">
              <BellRing className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif tracking-tight text-white mb-3">
              {t('subscription.waitlistTitle')}
            </h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto mb-7 leading-relaxed">
              {t('subscription.waitlistSubtitle')}
            </p>

            {state === 'success' ? (
              <div className="flex items-center justify-center gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                {t('subscription.waitlistSuccess')}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('subscription.waitlistPlaceholder')}
                    aria-label={t('subscription.waitlistPlaceholder')}
                    disabled={state === 'loading'}
                    className="w-full bg-luxury-950 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-sm text-gold-100 placeholder:text-zinc-600 focus:outline-none focus:border-gold-500/50 disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={state === 'loading'}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gold-500 text-zinc-950 text-sm font-bold hover:bg-gold-400 transition-all disabled:opacity-60 shrink-0"
                >
                  {state === 'loading' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('subscription.waitlistCta')
                  )}
                </button>
              </form>
            )}

            {message && state === 'error' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3.5 h-3.5" />
                {message}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2">
              <ProBadge />
              <span className="text-[11px] text-zinc-500">
                {t('subscription.stripeNotConfigured')}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
