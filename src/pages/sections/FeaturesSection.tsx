import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  HeartHandshake,
  BrainCircuit,
  TrendingUp,
  Camera,
  Package,
  Users,
  Calculator,
  Zap,
  Coins,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * "Why Libriwouô" + "How it works" + benefits sections
 * (Phase 6.1 — extracted from LandingPage.tsx).
 *
 * NOTE: Tailwind v4 scans source files for complete class names, so every colour
 * variant is written out explicitly below. Never build class names with template
 * strings — the CSS would silently not be generated.
 */

/** Stagger delays: the multi-child reveal is the most expensive animation on the page. */
export const containerVariants = (reduceMotion = false) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // Phase 6.2 — no stagger on mobile / reduced-motion: every child animates at once.
      staggerChildren: reduceMotion ? 0 : 0.15,
      delayChildren: reduceMotion ? 0 : 0.1,
    },
  },
});

export const itemVariants = (reduceMotion = false) => ({
  hidden: { opacity: 0, y: reduceMotion ? 0 : 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: reduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
});

import { useMotionPreference } from '../../hooks/useMotionPreference';

/** Static → dynamic class maps (required for Tailwind to emit the CSS). */
const ICON_BOX: Record<'gold' | 'emerald' | 'blue', string> = {
  gold: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function WhySection() {
  const { t } = useTranslation();
  const reduceMotion = useMotionPreference();
  const container = containerVariants(reduceMotion);
  const item = itemVariants(reduceMotion);

  const cards: Array<{ icon: LucideIcon; color: 'gold' | 'emerald' | 'blue'; title: string; desc: string }> = [
    { icon: HeartHandshake, color: 'gold', title: t('landing.why1Title'), desc: t('landing.why1Desc') },
    { icon: BrainCircuit, color: 'emerald', title: t('landing.why2Title'), desc: t('landing.why2Desc') },
    { icon: TrendingUp, color: 'emerald', title: t('landing.why3Title'), desc: t('landing.why3Desc') },
  ];

  return (
    <section className="bg-luxury-900 border-y border-white/5 py-16 sm:py-24 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">
            {t('landing.whyTitle')}
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            {t('landing.whySubtitle')}
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {cards.map(({ icon: Icon, color, title, desc }) => (
            <motion.div
              key={title}
              variants={item}
              className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-5 border ${ICON_BOX[color]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2.5">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/** One row of the "how it works" grid. */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  variants,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  variants: any;
}) {
  return (
    <motion.div
      variants={variants}
      className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${ICON_BOX.gold}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

export function FeaturesSection() {
  const { t } = useTranslation();
  const reduceMotion = useMotionPreference();
  const container = containerVariants(reduceMotion);
  const item = itemVariants(reduceMotion);

  const features: Array<{ icon: LucideIcon; title: string; desc: string }> = [
    { icon: Camera, title: t('landing.featScanTitle'), desc: t('landing.featScanDesc') },
    { icon: BrainCircuit, title: t('landing.featCompliantTitle'), desc: t('landing.featCompliantDesc') },
    { icon: TrendingUp, title: t('landing.featBankTitle'), desc: t('landing.featBankDesc') },
    { icon: Package, title: t('landing.featStockTitle'), desc: t('landing.featStockDesc') },
    { icon: Users, title: t('landing.featTeamTitle'), desc: t('landing.featTeamDesc') },
    { icon: Calculator, title: t('landing.featSimTitle'), desc: t('landing.featSimDesc') },
  ];

  return (
    <section className="py-20 sm:py-28 px-6 border-b border-white/5 overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">
            {t('landing.featuresTitle')}
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            {t('landing.featuresSubtitle')}
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {features.map((f) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              desc={f.desc}
              variants={item}
            />
          ))}
        </motion.div>

        <BenefitsBlock />
      </div>
    </section>
  );
}

function BenefitsBlock() {
  const { t } = useTranslation();
  const reduceMotion = useMotionPreference();
  const container = containerVariants(reduceMotion);
  const item = itemVariants(reduceMotion);

  const benefits: Array<{ icon: LucideIcon; color: 'gold' | 'emerald' | 'blue'; title: string; desc: string }> = [
    { icon: Zap, color: 'gold', title: t('landing.benefitTimeTitle'), desc: t('landing.benefitTimeDesc') },
    { icon: Coins, color: 'emerald', title: t('landing.benefitMoneyTitle'), desc: t('landing.benefitMoneyDesc') },
    { icon: ShieldCheck, color: 'blue', title: t('landing.benefitPeaceTitle'), desc: t('landing.benefitPeaceDesc') },
  ];

  return (
    <div className="mt-20 sm:mt-24 pt-16 border-t border-white/5">
      <div className="text-center mb-12">
        <h3 className="text-2xl sm:text-3xl font-serif tracking-tight text-white mb-3">
          {t('landing.benefitsTitle')}
        </h3>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">{t('landing.benefitsSubtitle')}</p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
      >
        {benefits.map(({ icon: Icon, color, title, desc }) => (
          <motion.div
            key={title}
            variants={item}
            className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col items-center text-center"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-5 border ${ICON_BOX[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-white mb-2">{title}</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
