import { useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { loginWithGoogle, loginAsBetaTesteur } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  AlertCircle, 
  ArrowRight, 
  Camera, 
  BrainCircuit, 
  TrendingUp,
  ChevronDown,
  HeartHandshake,
  Users,
  Package,
  Calculator,
  Sparkles,
  Check,
  Zap,
  ShieldCheck,
  Coins,
  FlaskConical,
  Beaker,
  Loader2
} from 'lucide-react';
import { SplashScreen } from '../components/SplashScreen';
import { NeoLogo } from '../components/NeoLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export function LandingPage() {
  const { t } = useTranslation();
  const { user, loading, hasProfile } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isBetaLoading, setIsBetaLoading] = useState(false);
  const [isAnnual, setIsAnnual] = useState<boolean>(false);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Login failed:", error);
      setLoginError(error.message || t('auth.loginError'));
    }
  };

  const handleBetaLogin = async () => {
    try {
      setLoginError(null);
      setIsBetaLoading(true);
      await loginAsBetaTesteur();
    } catch (error: any) {
      console.error("Beta login failed:", error);
      setLoginError(error.message || t('auth.betaAccess') + ' — ' + t('auth.loginError'));
    } finally {
      setIsBetaLoading(false);
    }
  };

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      return Math.round(monthlyPrice * 0.85);
    }
    return monthlyPrice;
  };

  if (loading) return <SplashScreen />;
  if (user && hasProfile) return <Navigate to="/dashboard" replace />;
  if (user && hasProfile === false) return <Navigate to="/onboarding" replace />;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="min-h-screen bg-luxury-950 text-zinc-100 flex flex-col font-sans selection:bg-gold-500/20 antialiased">
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-6 py-4 md:px-16 border-b border-white/5 bg-luxury-950/80 backdrop-blur-md sticky top-0 z-50"
      >
        <div className="flex items-center gap-3">
            <NeoLogo size="sm" showText={false} />
            <span className="font-serif font-semibold text-lg tracking-tight text-white">Libriwouô</span>
         </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="compact" />
          <button 
            onClick={handleBetaLogin}
            disabled={isBetaLoading}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full hover:bg-emerald-500/15 transition-all disabled:opacity-50"
            title={t('auth.betaHint')}
          >
            {isBetaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            {t('auth.betaShort')}
          </button>
          <button 
            onClick={handleLogin}
            className="px-5 py-2 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all shadow-sm"
          >
            {t('auth.login')}
          </button>
        </div>
      </motion.nav>

      <main className="flex-1 flex flex-col">
        {/* HERO SECTION */}
        <section className="relative px-6 py-20 md:py-32 flex flex-col items-center text-center max-w-4xl mx-auto w-full">
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
                {t('landing.heroTitle1')} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-100 to-gold-400">{t('landing.heroTitle2')}</span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                {t('landing.heroSubtitle')}
              </p>
              
              {loginError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-red-400 text-sm max-w-md w-full text-left">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{loginError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
                <button 
                  onClick={handleLogin}
                  className="group flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-semibold bg-gold-500 text-zinc-950 rounded-full hover:bg-gold-400 transition-all duration-300 w-full sm:w-auto"
                >
                  {t('landing.ctaStart')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  onClick={handleLogin}
                  className="px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 rounded-full hover:bg-white/10 transition-all w-full sm:w-auto"
                >
                  {t('landing.ctaDiscover')}
                </button>
              </div>
              <p className="mt-4 text-xs text-zinc-500">{t('landing.noCard')}</p>

              {/* Beta Tester — One-click, no Google / no email */}
              <div className="mt-8 w-full max-w-md">
                <div className="relative flex items-center gap-3 my-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] tracking-widest uppercase text-zinc-500 font-medium">ou</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-emerald-500/[0.06] border border-dashed border-emerald-500/25 text-left backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Beaker className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        {t('auth.betaAccess')}
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black tracking-wider uppercase">{t('auth.betaWithoutSignup')}</span>
                      </h3>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                        {t('auth.betaDescription')}
                      </p>
                      <button
                        onClick={handleBetaLogin}
                        disabled={isBetaLoading}
                        className="mt-3.5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold hover:bg-emerald-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isBetaLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('common.loading')}
                          </>
                        ) : (
                          <>
                            <FlaskConical className="w-4 h-4" />
                            {t('auth.betaButton')}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-[11px] text-zinc-500 text-center">
                        {t('auth.betaSharedInfo')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
        </section>

        {/* BENEFITS SECTION (THE "WHY") */}
        <section className="bg-luxury-900 border-y border-white/5 py-16 sm:py-24 px-6 overflow-hidden">
           <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">{t('landing.whyTitle')}</h2>
                 <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">{t('landing.whySubtitle')}</p>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
              >
                 <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-lg bg-gold-500/10 flex items-center justify-center text-gold-400 mb-5 border border-gold-500/20">
                       <HeartHandshake className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2.5">{t('landing.why1Title')}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       {t('landing.why1Desc')}
                    </p>
                 </motion.div>
                 
                 <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                       <BrainCircuit className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2.5">{t('landing.why2Title')}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       {t('landing.why2Desc')}
                    </p>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                       <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2.5">{t('landing.why3Title')}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       {t('landing.why3Desc')}
                    </p>
                 </motion.div>
              </motion.div>
           </div>
        </section>

        {/* HOW IT WORKS SECTION (THE "HOW") */}
        <section className="py-20 sm:py-28 px-6 border-b border-white/5 overflow-hidden">
           <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">{t('landing.featuresTitle')}</h2>
                 <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">{t('landing.featuresSubtitle')}</p>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center shrink-0 border border-gold-500/20">
                       <Camera className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featScanTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featScanDesc')}
                       </p>
                    </div>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featCompliantTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featCompliantDesc')}
                       </p>
                    </div>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featBankTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featBankDesc')}
                       </p>
                    </div>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Package className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featStockTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featStockDesc')}
                       </p>
                    </div>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Users className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featTeamTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featTeamDesc')}
                       </p>
                    </div>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">{t('landing.featSimTitle')}</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          {t('landing.featSimDesc')}
                       </p>
                    </div>
                 </motion.div>
              </motion.div>

              {/* Benefits Subsection */}
              <div className="mt-20 sm:mt-24 pt-16 border-t border-white/5">
                <div className="text-center mb-12">
                   <h3 className="text-2xl sm:text-3xl font-serif tracking-tight text-white mb-3">{t('landing.benefitsTitle')}</h3>
                   <p className="text-sm text-zinc-400 max-w-md mx-auto">{t('landing.benefitsSubtitle')}</p>
                </div>

                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-100px" }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-8"
                >
                   <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-gold-500/20 transition-all duration-300 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-gold-500/10 flex items-center justify-center text-gold-400 mb-5 border border-gold-500/20">
                         <Zap className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-2">{t('landing.benefitTimeTitle')}</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         {t('landing.benefitTimeDesc')}
                      </p>
                   </motion.div>

                   <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-gold-500/20 transition-all duration-300 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                         <Coins className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-2">{t('landing.benefitMoneyTitle')}</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         {t('landing.benefitMoneyDesc')}
                      </p>
                   </motion.div>

                   <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-gold-500/20 transition-all duration-300 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-5 border border-blue-500/20">
                         <ShieldCheck className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-2">{t('landing.benefitPeaceTitle')}</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         {t('landing.benefitPeaceDesc')}
                      </p>
                   </motion.div>
                </motion.div>
              </div>

           </div>
        </section>

        {/* PRICING SECTION */}
        <section className="py-20 sm:py-28 px-6 bg-luxury-900/30 border-b border-white/5 overflow-hidden">
           <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">{t('landing.pricingTitle')}</h2>
                 <p className="text-sm sm:text-base text-zinc-400 mb-6 font-sans">{t('landing.pricingSubtitle')}</p>
                 
                 <div className="inline-flex items-center gap-2.5 bg-luxury-950 p-1.5 rounded-full border border-white/5 mb-8">
                   <button 
                     onClick={() => setIsAnnual(false)}
                     className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${!isAnnual ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                   >
                     {t('landing.monthly')}
                   </button>
                   <button 
                     onClick={() => setIsAnnual(true)}
                     className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${isAnnual ? 'bg-gold-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                   >
                     {t('landing.annual')}
                     <span className="bg-white/15 text-white text-[10px] px-2 py-0.5 rounded font-black">{t('landing.savePercent')}</span>
                   </button>
                 </div>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch"
              >
                <motion.div variants={itemVariants} className="bg-luxury-950 border border-white/5 rounded-2xl p-7 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('landing.starter')}</h3>
                    <p className="text-xs sm:text-sm text-zinc-500 mb-4">{t('landing.starterDesc')}</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold text-white font-mono">{getPrice(15000).toLocaleString()} F</span>
                      <span className="text-zinc-500 text-xs">{t('landing.perMonth')}</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text={t('landing.pricingFeatures.oneUser')} />
                      <PricingFeature text={t('landing.pricingFeatures.autoReceipt')} />
                      <PricingFeature text={t('landing.pricingFeatures.simpleLedger')} />
                      <PricingFeature text={t('landing.pricingFeatures.simpleTools')} />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all">
                    {t('landing.tryStarter')}
                  </button>
                </motion.div>

                <motion.div 
                  variants={itemVariants} 
                  className="bg-luxury-950 border-2 border-gold-500/50 rounded-2xl p-7 flex flex-col justify-between relative shadow-lg shadow-gold-500/5"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-500 text-zinc-950 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider animate-pulse">
                    {t('landing.bestChoice')}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider mb-1 mt-2">{t('landing.pro')}</h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mb-4">{t('landing.proDesc')}</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-bold text-white font-mono">{getPrice(25000).toLocaleString()} F</span>
                      <span className="text-zinc-400 text-xs">{t('landing.perMonth')}</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text={t('landing.pricingFeatures.allStarter')} />
                      <PricingFeature text={t('landing.pricingFeatures.upTo5')} />
                      <PricingFeature text={t('landing.pricingFeatures.bankCheck')} />
                      <PricingFeature text={t('landing.pricingFeatures.stockFollow')} />
                      <PricingFeature text={t('landing.pricingFeatures.autoPayroll')} />
                      <PricingFeature text={t('landing.pricingFeatures.priorityHelp')} />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-all shadow shadow-gold-500/20">
                    {t('landing.takePro')}
                  </button>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-luxury-950 border border-white/5 rounded-2xl p-7 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('landing.ultra')}</h3>
                    <p className="text-xs sm:text-sm text-zinc-500 mb-4">{t('landing.ultraDesc')}</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-2xl font-bold text-white font-mono">{getPrice(50000).toLocaleString()} F</span>
                      <span className="text-zinc-500 text-xs">{t('landing.perMonth')}</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text={t('landing.pricingFeatures.allStarter')} />
                      <PricingFeature text={t('landing.pricingFeatures.unlimitedUsers')} />
                      <PricingFeature text={t('landing.pricingFeatures.eSintax')} />
                      <PricingFeature text={t('landing.pricingFeatures.tailoredAdvice')} />
                      <PricingFeature text={t('landing.pricingFeatures.tailoredNews')} />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all">
                    {t('landing.tryUltra')}
                  </button>
                </motion.div>
              </motion.div>
           </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-20 px-6 bg-luxury-900/50">
           <div className="max-w-2xl mx-auto">
              <div className="text-center mb-12">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">{t('landing.faqTitle')}</h2>
                 <p className="text-sm text-zinc-400">{t('landing.faqSubtitle')}</p>
              </div>

              <div className="space-y-4">
                 <FAQItem 
                    question={t('landing.faq1Q')} 
                    answer={t('landing.faq1A')}
                 />
                 <FAQItem 
                    question={t('landing.faq2Q')} 
                    answer={t('landing.faq2A')}
                 />
                 <FAQItem 
                    question={t('landing.faq3Q')} 
                    answer={t('landing.faq3A')}
                 />
                 <FAQItem 
                    question={t('landing.faq4Q')} 
                    answer={t('landing.faq4A')}
                 />
              </div>
           </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 px-6 text-center relative overflow-hidden">
           <div className="relative z-10 max-xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">
                 {t('landing.finalTitle')}
              </h2>
              <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">
                 {t('landing.finalSubtitle')}
              </p>
              <button 
                onClick={handleLogin}
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all duration-300 shadow-sm animate-bounce"
              >
                {t('landing.ctaCreateAccount')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
           </div>
        </section>
      </main>

      <footer className="py-6 text-center text-zinc-600 text-xs border-t border-white/5 bg-luxury-950">
         <p>{t('landing.footer', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}

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

function FAQItem({ question, answer }: { question: string, answer: string }) {
   const [isOpen, setIsOpen] = useState(false);
   
   return (
      <div className="border border-white/5 rounded-xl bg-luxury-900/60 overflow-hidden transition-all duration-300 hover:border-white/10">
         <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-5 py-4 text-left flex items-center justify-between focus:outline-none"
         >
            <span className="font-medium text-white text-sm sm:text-base pr-6">{question}</span>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
         </button>
         <motion.div 
            initial={false}
            animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
            className="overflow-hidden"
         >
            <p className="px-5 pb-4 text-xs sm:text-sm text-zinc-400 leading-relaxed">
               {answer}
            </p>
         </motion.div>
      </div>
   )
}
