import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInLocal } from '../services/session';
import { isStripeConfigured } from '../services/subscription';
import { SplashScreen } from '../components/SplashScreen';
import { WaitlistSection } from '../components/WaitlistSection';
import { NavBar, HeroSection } from './sections/HeroSection';
import { WhySection, FeaturesSection } from './sections/FeaturesSection';
import { PricingSection, FAQSection, FinalCTASection, LandingFooter } from './sections/PricingSection';

/**
 * LandingPage — composition root (Phase 6.1 refactor).
 *
 * Was a single 578-line component; each `<section>` now lives in its own file under
 * `sections/`. This file is only layout + the three interaction handlers.
 *
 * Firebase Auth was removed: "Se connecter" now creates the local session and sends
 * the visitor to onboarding. No Google, no shared beta password.
 */
export function LandingPage() {
  const { t } = useTranslation();
  const { user, loading, hasProfile } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState<boolean>(false);

  const handleStart = () => {
    try {
      setLoginError(null);
      signInLocal();
      // AuthContext re-renders and the ProtectedRoute redirect kicks in.
    } catch (error: any) {
      console.error('Local session creation failed:', error);
      setLoginError(error?.message || t('common.error'));
    }
  };

  /**
   * Pricing CTA (Phase 3.1/3.2). While Stripe is not configured we must NOT pretend a
   * paid trial exists — the button scrolls to the waitlist form instead.
   */
  const handlePlanSelect = () => {
    if (isStripeConfigured()) {
      // Stripe live: the in-app checkout flow handles it.
      return;
    }
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) return <SplashScreen />;
  if (user && hasProfile) return <Navigate to="/dashboard" replace />;
  if (user && hasProfile === false) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-luxury-950 text-zinc-100 flex flex-col font-sans selection:bg-gold-500/20 antialiased">
      <NavBar onStart={handleStart} />

      <main className="flex-1 flex flex-col">
        <HeroSection onStart={handleStart} errorMessage={loginError} />
        <WhySection />
        <FeaturesSection />
        <PricingSection isAnnual={isAnnual} onToggleAnnual={setIsAnnual} onSelectPlan={handlePlanSelect} />

        {/* WAITLIST (Phase 3.2) — pre-launch email capture while Stripe is not configured */}
        <div id="waitlist">
          <WaitlistSection className="bg-luxury-950 border-b border-white/5" />
        </div>

        <FAQSection />
        <FinalCTASection onStart={handleStart} />
      </main>

      <LandingFooter />
    </div>
  );
}
