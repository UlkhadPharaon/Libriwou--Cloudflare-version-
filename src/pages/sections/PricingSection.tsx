import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ArrowRight } from 'lucide-react';
import { useMotionPreference } from '../../hooks/useMotionPreference';

/**
 * Pricing tiers + FAQ sections (Phase 6.1 — extracted from LandingPage.tsx).
 */

const TIERS = [
  { key: 'starter', monthly: 15_000, highlight: false },
  { key: 'pro', monthly: 25_000, highlight: true },
  { key: 'ultra', monthly: 50_000, highlight: false },
] as const;

/** Feature lists per tier come from `landing.pricingFeatures.*`. */
const TIER_FEATURES: Record<string, string[]> = {
  starter: ['oneUser', 'autoReceipt', 'simpleLedger', 'simpleTools'],
  pro: ['allStarter', 'upTo5', 'bankCheck', 'stockFollow', 'autoPayroll', 'priorityHelp'],
  ultra: ['allStarter', 'unlimitedUsers', 'eSintax', 'tailoredAdvice', 'tailoredNews'],
};

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center border border-gold-500/20 shrink-0">
        <Check className="w-2.5 h-2.5" />
      </div>
      <span className="text-xs sm:text-sm text-zinc-400">{text}</span>
    </li>
  );
}

export function PricingSection({
  isAnnual,
  onToggleAnnual,
  onSelectPlan,
}: {
  isAnnual: boolean;
  onToggleAnnual: (annual: boolean) => void;
  onSelectPlan: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useMotionPreference();

  const getPrice = (monthlyPrice: number) => (isAnnual ? Math.round(monthlyPrice * 0.85) : monthlyPrice);

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: reduceMotion ? 0 : 0.15, delayChildren: reduceMotion ? 0 : 0.1 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  return (
    <section className="py-20 sm:py-28 px-6 bg-luxury-900/30 border-b border-white/5 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">
            {t('landing.pricingTitle')}
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mb-6 font-sans">{t('landing.pricingSubtitle')}</p>

          <div className="inline-flex items-center gap-2.5 bg-luxury-950 p-1.5 rounded-full border border-white/5 mb-8">
            <button
              onClick={() => onToggleAnnual(false)}
              aria-pressed={!isAnnual}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                !isAnnual ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t('landing.monthly')}
            </button>
            <button
              onClick={() => onToggleAnnual(true)}
              aria-pressed={isAnnual}
              className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                isAnnual ? 'bg-gold-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t('landing.annual')}
              <span className="bg-white/15 text-white text-[10px] px-2 py-0.5 rounded font-black">
                {t('landing.savePercent')}
              </span>
            </button>
          </div>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch"
        >
          {TIERS.map((tier) => {
            const features = TIER_FEATURES[tier.key] ?? [];
            const ctaKey = tier.key === 'pro' ? 'takePro' : tier.key === 'ultra' ? 'tryUltra' : 'tryStarter';
            return (
              <motion.div
                key={tier.key}
                variants={item}
                className={
                  tier.highlight
                    ? 'bg-luxury-950 border-2 border-gold-500/50 rounded-2xl p-7 flex flex-col justify-between relative shadow-lg shadow-gold-500/5'
                    : 'bg-luxury-950 border border-white/5 rounded-2xl p-7 flex flex-col justify-between'
                }
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-500 text-zinc-950 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider animate-pulse">
                    {t('landing.bestChoice')}
                  </div>
                )}
                <div>
                  <h3
                    className={`text-sm font-bold uppercase tracking-wider mb-1 ${
                      tier.highlight ? 'text-gold-400 mt-2' : 'text-zinc-400'
                    }`}
                  >
                    {t(`landing.${tier.key}`)}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 mb-4">{t(`landing.${tier.key}Desc`)}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span
                      className={`font-bold text-white font-mono ${
                        tier.key === 'ultra' ? 'text-2xl' : tier.highlight ? 'text-4xl' : 'text-3xl'
                      }`}
                    >
                      {getPrice(tier.monthly).toLocaleString()} F
                    </span>
                    <span className="text-zinc-500 text-xs">{t('landing.perMonth')}</span>
                  </div>
                  <ul className="space-y-3.5 mb-8">
                    {features.map((f) => (
                      <PricingFeature key={f} text={t(`landing.pricingFeatures.${f}`)} />
                    ))}
                  </ul>
                </div>
                <button
                  onClick={onSelectPlan}
                  className={
                    tier.highlight
                      ? 'w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-all shadow shadow-gold-500/20'
                      : 'w-full py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all'
                  }
                >
                  {t(`landing.${ctaKey}`)}
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white/5 rounded-xl bg-luxury-900/60 overflow-hidden transition-all duration-300 hover:border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-5 py-4 text-left flex items-center justify-between focus:outline-none"
      >
        <span className="font-medium text-white text-sm sm:text-base pr-6">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-4 text-xs sm:text-sm text-zinc-400 leading-relaxed">{answer}</p>
      </motion.div>
    </div>
  );
}

export function FAQSection() {
  const { t } = useTranslation();
  const items = [
    { q: t('landing.faq1Q'), a: t('landing.faq1A') },
    { q: t('landing.faq2Q'), a: t('landing.faq2A') },
    { q: t('landing.faq3Q'), a: t('landing.faq3A') },
    { q: t('landing.faq4Q'), a: t('landing.faq4A') },
  ];

  return (
    <section className="py-20 px-6 bg-luxury-900/50">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">
            {t('landing.faqTitle')}
          </h2>
          <p className="text-sm text-zinc-400">{t('landing.faqSubtitle')}</p>
        </div>
        <div className="space-y-4">
          {items.map((item) => (
            <FAQItem key={item.q} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTASection({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="py-24 px-6 text-center relative overflow-hidden">
      <div className="relative z-10 max-w-xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">
          {t('landing.finalTitle')}
        </h2>
        <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">{t('landing.finalSubtitle')}</p>
        <button
          onClick={onStart}
          className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all duration-300 shadow-sm animate-bounce"
        >
          {t('landing.ctaCreateAccount')}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();
  return (
    <footer className="py-6 text-center text-zinc-600 text-xs border-t border-white/5 bg-luxury-950">
      <p>{t('landing.footer', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
