import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { NeoLogo } from '../../components/NeoLogo';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { SplashScreen } from '../../components/SplashScreen';

/**
 * LandingPage navigation bar + hero (Phase 6.1 — extracted section).
 *
 * Firebase Auth was removed: there is no Google login and no shared beta account.
 * The CTA creates the local session and hands off to onboarding.
 */

export function NavBar({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-between px-6 py-4 md:px-16 border-b border-white/5 bg-luxury-950/80 backdrop-blur-md sticky top-0 z-50"
    >
      <div className="flex items-center gap-3">
        <NeoLogo size="sm" showText={false} />
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher variant="compact" />
        <button
          onClick={onStart}
          className="px-5 py-2 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all shadow-sm"
        >
          {t('landing.ctaStart')}
        </button>
      </div>
    </motion.nav>
  );
}

export function HeroSection({ onStart, errorMessage }: { onStart: () => void; errorMessage?: string | null }) {
  const { t } = useTranslation();

  return (
    // `overflow-hidden` clips the 400px decorative glow below: without it the blurred
    // circle overflows the viewport by ~28px on a 360px phone and creates a
    // horizontal scrollbar (test U-01).
    <section className="relative overflow-hidden px-6 py-20 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto w-full">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gold-500/5 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gold-400 text-xs font-medium tracking-wider uppercase mb-6">
          <Sparkles className="w-3.5 h-3.5 text-gold-500" />
          {t('landing.badge')}
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif tracking-tight leading-tight mb-6 text-title max-w-3xl">
          {t('landing.heroTitle1')} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-100 to-gold-400">
            {t('landing.heroTitle2')}
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
          {t('landing.heroSubtitle')}
        </p>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-400 text-sm max-w-md w-full text-left">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <button
            onClick={onStart}
            className="group flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-semibold bg-gold-500 text-zinc-950 rounded-full hover:bg-gold-400 transition-all duration-300 w-full sm:w-auto"
          >
            {t('landing.ctaStart')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={onStart}
            className="px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 rounded-full hover:bg-white/10 transition-all w-full sm:w-auto"
          >
            {t('landing.ctaDiscover')}
          </button>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t('landing.noCard')}</p>
      </motion.div>
    </section>
  );
}

/** Shown while the local session resolves — keeps the layout stable instead of a blank page. */
export function HeroFallback() {
  return <SplashScreen />;
}
