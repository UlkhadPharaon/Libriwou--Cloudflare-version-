import { useState } from 'react';
import { motion } from 'motion/react';
import { loginWithGoogle } from '../firebase';
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
  Coins
} from 'lucide-react';
import { SplashScreen } from '../components/SplashScreen';
import { NeoLogo } from '../components/NeoLogo';

export function LandingPage() {
  const { user, loading, hasProfile } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState<boolean>(false);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (error: any) {
      console.error("Login failed:", error);
      setLoginError(error.message || "Une erreur est survenue lors de la connexion.");
    }
  };

  const getPrice = (monthlyPrice: number) => {
    if (isAnnual) {
      // 15% de réduction
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
           <span className="font-serif font-semibold text-lg tracking-tight text-white">NeoCompta</span>
        </div>
        <button 
          onClick={handleLogin}
          className="px-5 py-2 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all shadow-sm"
        >
          Me connecter
        </button>
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
                L'assistant super simple pour les entrepreneurs d'Afrique de l'Ouest
              </div>
              
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif tracking-tight leading-tight mb-6 text-white max-w-3xl">
                Votre gestion d'entreprise sans <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-100 to-gold-400">aucune prise de tête.</span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                Pas besoin d'aimer les chiffres. Prenez vos reçus en photo, l'application range vos dépenses, prépare vos déclarations du Burkina & UEMOA et s'occupe de vos papiers.
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
                  Démarrer gratuitement
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button 
                  onClick={handleLogin}
                  className="px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 rounded-full hover:bg-white/10 transition-all w-full sm:w-auto"
                >
                  Découvrir
                </button>
              </div>
              <p className="mt-4 text-xs text-zinc-500">Sans carte bancaire • Totalement conforme aux règles locales</p>
            </motion.div>
        </section>

        {/* BENEFITS SECTION (THE "WHY") */}
        <section className="bg-luxury-900 border-y border-white/5 py-16 sm:py-24 px-6 overflow-hidden">
           <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 sm:mb-16">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">Pourquoi choisir NeoCompta ?</h2>
                 <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">Une application claire et zen, pensée pour ceux qui détestent la paperasse.</p>
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
                    <h3 className="text-base font-semibold text-white mb-2.5">Zéro stress administratif</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       Notre application surveille vos dates importantes et traduit les calculs complexes en informations simples (argent disponible, bénéfice, dépenses).
                    </p>
                 </motion.div>
                 
                 <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                       <BrainCircuit className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2.5">Toujours en règle, sans effort</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       Toutes vos ventes et vos achats sont automatiquement rangés selon les normes en vigueur en Afrique de l'Ouest. Votre comptable n'aura plus rien à trier.
                    </p>
                 </motion.div>

                 <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                       <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2.5">Suivi en direct de votre poche</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                       Ouvrez l'application et voyez directement combien vous avez gagné ce mois-ci, de manière visuelle et agréable, sur votre téléphone ou votre PC.
                    </p>
                 </motion.div>
              </motion.div>
           </div>
        </section>

        {/* HOW IT WORKS SECTION (THE "HOW") */}
        <section className="py-20 sm:py-28 px-6 border-b border-white/5 overflow-hidden">
           <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight mb-3.5 text-white">Tout ce dont vous avez besoin au même endroit</h2>
                 <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">Des outils simples qui fonctionnent parfaitement ensemble pour gérer votre activité.</p>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                 {/* Feature 1 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center shrink-0 border border-gold-500/20">
                       <Camera className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Scanner photo intelligent</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          Prenez simplement en photo vos reçus et tickets de caisse. NeoCompta lit le document tout seul, extrait les montants de TVA et range le tout en sécurité.
                       </p>
                    </div>
                 </motion.div>

                 {/* Feature 2 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Conforme aux lois locales</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          La législation et les calculs pour le Burkina Faso et l'espace UEMOA (SYSCOHADA) sont inclus. Préparez en 1 clic vos données prêtes à envoyer pour vos déclarations sur e-SINTAX.
                       </p>
                    </div>
                 </motion.div>

                 {/* Feature 3 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Banque & Argent au clair</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          Importez facilement vos relevés bancaires pour les valider. Notre application vous montre à l'avance combien d'argent il vous restera sur votre compte le mois prochain.
                       </p>
                    </div>
                 </motion.div>

                 {/* Feature 4 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Package className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Gestion des stocks et des produits</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          Suivez l'état de vos articles et étiquetez vos produits de manière visuelle. Sachez où s'en va votre marchandise et évitez les ruptures ou les surplus.
                       </p>
                    </div>
                 </motion.div>

                 {/* Feature 5 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Users className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Gestion des employés & Fiches de salaire</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          Ajoutez vos collaborateurs et créez des fiches de paie ultra-simples et claires contenant les aides de l'État et la mutuelle locale sans aucun calcul manuel.
                       </p>
                    </div>
                 </motion.div>

                 {/* Feature 6 */}
                 <motion.div variants={itemVariants} className="p-7 bg-luxury-900 border border-white/5 rounded-2xl flex gap-4 hover:border-white/10 transition-all duration-300">
                    <div className="w-9 h-9 rounded-lg bg-gold-500/10 text-gold-500 flex items-center justify-center shrink-0 border border-white/10">
                       <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="text-base font-semibold text-white mb-2">Simulateur simple & Veille</h3>
                       <p className="text-sm text-zinc-400 leading-relaxed">
                          Estimez en deux secondes vos futurs impôts ou taxes périodiques. Recevez également des explications courtes et claires sur les nouvelles lois fiscales qui vous concernent.
                       </p>
                    </div>
                 </motion.div>
              </motion.div>

              {/* Vos Bénéfices Subsection */}
              <div className="mt-20 sm:mt-24 pt-16 border-t border-white/5">
                <div className="text-center mb-12">
                   <h3 className="text-2xl sm:text-3xl font-serif tracking-tight text-white mb-3">Ce que vous y gagnez</h3>
                   <p className="text-sm text-zinc-400 max-w-md mx-auto">Des bienfaits concrets sur votre vie d'entrepreneur au jour le jour.</p>
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
                      <h4 className="text-base font-semibold text-white mb-2">Du temps libre retrouvé</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         Passez 5 fois moins de temps sur vos papiers administratifs. L'IA classe tout à votre place pour vous laisser vous concentrer sur votre commerce et vos clients.
                      </p>
                   </motion.div>

                   <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-gold-500/20 transition-all duration-300 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                         <Coins className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-2">Des économies d'argent</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         Émancipez-vous des amendes de retard et optimisez vos impôts grâce à des explications claires et des simulations simples adaptées au commerce local.
                      </p>
                   </motion.div>

                   <motion.div variants={itemVariants} className="p-7 rounded-2xl bg-luxury-950 border border-white/5 hover:border-gold-500/20 transition-all duration-300 flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-5 border border-blue-500/20">
                         <ShieldCheck className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-semibold text-white mb-2">Une sérénité totale</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                         Ne paniquez plus face aux impôts. Vos justificatifs papier sont bien rangés en photo, certifiés et parfaitement prêts pour vos déclarations familiales ou e-SINTAX.
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
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">Des abonnements sans surprise</h2>
                 <p className="text-sm sm:text-base text-zinc-400 mb-6 font-sans">Choisissez l'offre qui correspond à la taille de votre entreprise.</p>
                 
                 {/* Monthly / Annual Toggle */}
                 <div className="inline-flex items-center gap-2.5 bg-luxury-950 p-1.5 rounded-full border border-white/5 mb-8">
                   <button 
                     onClick={() => setIsAnnual(false)}
                     className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${!isAnnual ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                   >
                     Mensuel
                   </button>
                   <button 
                     onClick={() => setIsAnnual(true)}
                     className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${isAnnual ? 'bg-gold-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
                   >
                     Annuel
                     <span className="bg-white/15 text-white text-[10px] px-2 py-0.5 rounded font-black">-15% d'économie</span>
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
                {/* Starter */}
                <motion.div variants={itemVariants} className="bg-luxury-950 border border-white/5 rounded-2xl p-7 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Starter</h3>
                    <p className="text-xs sm:text-sm text-zinc-500 mb-4">Parfait pour les créateurs & entrepreneurs individuels</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-bold text-white font-mono">{getPrice(15000).toLocaleString()} F</span>
                      <span className="text-zinc-500 text-xs">/ mois</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text="1 seul utilisateur" />
                      <PricingFeature text="Tri automatique des reçus en photo" />
                      <PricingFeature text="Livre des dépenses et recettes simple" />
                      <PricingFeature text="Outils de calcul simples inclus" />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all">
                    Essayer l'offre Starter
                  </button>
                </motion.div>

                {/* Pro Tier (Best Value & Highly Popular) */}
                <motion.div 
                  variants={itemVariants} 
                  className="bg-luxury-950 border-2 border-gold-500/50 rounded-2xl p-7 flex flex-col justify-between relative shadow-lg shadow-gold-500/5"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-500 text-zinc-950 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider animate-pulse">
                    Meilleur choix
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gold-400 uppercase tracking-wider mb-1 mt-2">Pro</h3>
                    <p className="text-xs sm:text-sm text-zinc-400 mb-4">Idéal pour les PME en croissance</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-4xl font-bold text-white font-mono">{getPrice(25000).toLocaleString()} F</span>
                      <span className="text-zinc-400 text-xs">/ mois</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text="Tout ce qu'il y a dans l'offre Starter" />
                      <PricingFeature text="Jusqu'à 5 personnes (Équipe)" />
                      <PricingFeature text="Vérification facile de la banque" />
                      <PricingFeature text="Suivi de vos stocks de produits" />
                      <PricingFeature text="Fiches de salaire automatiques" />
                      <PricingFeature text="Aide de notre équipe en priorité" />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-gold-500 text-zinc-950 hover:bg-gold-400 transition-all shadow shadow-gold-500/20">
                    Prendre l'offre Pro
                  </button>
                </motion.div>

                {/* Ultra Tier */}
                <motion.div variants={itemVariants} className="bg-luxury-950 border border-white/5 rounded-2xl p-7 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Ultra</h3>
                    <p className="text-xs sm:text-sm text-zinc-500 mb-4">Pour les structures plus grandes et matures</p>
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-2xl font-bold text-white font-mono">{getPrice(50000).toLocaleString()} F</span>
                      <span className="text-zinc-500 text-xs">/ mois</span>
                    </div>
                    <ul className="space-y-3.5 mb-8">
                      <PricingFeature text="Tout ce qu'il y a dans l'offre Pro" />
                      <PricingFeature text="Nombre de personnes illimité" />
                      <PricingFeature text="Connexion rapide avec e-SINTAX" />
                      <PricingFeature text="Conseils et simulations sur-mesure" />
                      <PricingFeature text="Actualités de votre secteur personnalisées" />
                    </ul>
                  </div>
                  <button onClick={handleLogin} className="w-full py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all">
                    Essayer l'offre Ultra
                  </button>
                </motion.div>
              </motion.div>
           </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-20 px-6 bg-luxury-900/50">
           <div className="max-w-2xl mx-auto">
              <div className="text-center mb-12">
                 <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">Questions Fréquentes</h2>
                 <p className="text-sm text-zinc-400">Tout ce que vous devez savoir pour démarrer simplement.</p>
              </div>

              <div className="space-y-4">
                 <FAQItem 
                    question="Je n'ai pas de notions de comptabilité, puis-je utiliser l'application ?" 
                    answer="Oui, tout à fait. NeoCompta remplace le langage complexe des experts par des notions très faciles de la vie de tous les jours : Recettes, Dépenses et Bénéfices. Vous n'avez aucune écriture technique à enregistrer vous-même."
                 />
                 <FAQItem 
                    question="Les calculs respectent-ils vraiment les lois du Burkina Faso ?" 
                    answer="Oui. L'application gère parfaitement les taxes, impôts et déclarations demandés au Burkina Faso et dans l'espace UEMOA (CME, RSI, etc.). Tout est calculé selon les lois en vigueur pour que vous soyez tranquille."
                 />
                 <FAQItem 
                    question="Mes données et mes secrets sont-ils bien gardés ?" 
                    answer="Absolument. Vos justificatifs et vos comptes sont cryptés de bout en bout et conservés de manière totalement confidentielle au repos comme en transit. Vous seul possédez l'accès à vos comptes de gestion."
                 />
                 <FAQItem 
                    question="Est-ce possible de tester gratuitement sans engagement ?" 
                    answer="Oui, créer votre compte vous donne directement accès aux outils de simulation et aux calendriers par défaut. Vous commencez ainsi en douceur et sans aucun frais."
                 />
              </div>
           </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-24 px-6 text-center relative overflow-hidden">
           <div className="relative z-10 max-xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-serif tracking-tight text-white mb-3">
                 Pilotez votre entreprise l'esprit tranquille.
              </h2>
              <p className="text-sm text-zinc-400 mb-8 max-w-sm mx-auto">
                 Rejoignez les entrepreneurs qui ont complètement chassé la panique des papiers et du stress fiscal.
              </p>
              <button 
                onClick={handleLogin}
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs sm:text-sm font-semibold bg-white text-zinc-950 rounded-full hover:bg-zinc-200 transition-all duration-300 shadow-sm animate-bounce"
              >
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
           </div>
        </section>
      </main>

      <footer className="py-6 text-center text-zinc-600 text-xs border-t border-white/5 bg-luxury-950">
         <p>© {new Date().getFullYear()} NeoCompta. Tous droits réservés.</p>
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
