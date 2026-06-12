import { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { CheckCircle2, AlertCircle, Save, Building2, Briefcase, FileText, Bell, Trash2, RotateCcw, UserX, Moon, Sun, Bot, Component, LogOut, Phone, Mail, MapPin, Calculator, BadgePercent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { determineTaxRegime } from '../lib/tax-rules';
import { cn } from '../lib/utils';
import { signOut } from 'firebase/auth';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, setHasProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'fiscal' | 'preferences' | 'subscription' | 'danger'>('profile');

  const [company, setCompany] = useState<any>({
    companyName: '',
    ifu: '',
    rccm: '',
    phone: '',
    email: '',
    address: '',
    legalStatus: '',
    sector: '',
    estimatedRevenue: 0,
    currency: 'XOF',
    exchangeRate: 1,
    taxRegime: 'CME',
    autoTaxRegime: true,
    vatRate: 18,
    notificationSettings: { daysBefore: 7 }
  });

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCompany({
          ...data,
          vatRate: data.vatRate || 18,
          autoTaxRegime: data.autoTaxRegime ?? true
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleUpdate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let updatedRegime = company.taxRegime;
      if (company.autoTaxRegime) {
         updatedRegime = determineTaxRegime(company.estimatedRevenue || 0);
      }
      const companyToUpdate = { ...company, taxRegime: updatedRegime };
      
      await updateDoc(doc(db, 'companies', user.uid), companyToUpdate);
      setCompany(companyToUpdate);
      setToast({ message: 'Informations mises à jour avec succès', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ message: 'Erreur lors de la mise à jour', type: 'error' });
    }
    setLoading(false);
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error(error);
    }
  };

  const handlePartialReset = async () => {
    if (!user) return;
    setResetLoading(true);
    try {
      const batch = writeBatch(db);
      const collections = ['transactions', 'conversations', 'simulations', 'inventory', 'stock_movements', 'bug_reports'];
      
      for (const collName of collections) {
        const q = query(collection(db, collName), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }

      await batch.commit();
      setToast({ message: 'Activité réinitialisée (Profil conservé)', type: 'success' });
      setShowResetConfirm(false);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Erreur lors de la réinitialisation', type: 'error' });
    } finally {
      setResetLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteLoading(true);
    try {
      const batch = writeBatch(db);
      const collections = ['transactions', 'conversations', 'simulations', 'bug_reports', 'inventory', 'stock_movements'];
      
      for (const collName of collections) {
        const q = query(collection(db, collName), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => batch.delete(d.ref));
      }
      
      // Delete company profile
      batch.delete(doc(db, 'companies', user.uid));

      await batch.commit();
      
      setHasProfile(false);
      setToast({ message: 'Compte supprimé avec succès', type: 'success' });
      
      setTimeout(() => {
        navigate('/');
        window.location.reload();
      }, 2000);
    } catch (e) {
      console.error(e);
      setToast({ message: 'Erreur lors de la suppression', type: 'error' });
      setDeleteLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profil Entreprise', icon: Building2 },
    { id: 'fiscal', label: 'Comptabilité & Fiscalité', icon: FileText },
    { id: 'preferences', label: 'Préférences', icon: Component },
    { id: 'subscription', label: 'Abonnement', icon: CheckCircle2 },
    { id: 'danger', label: 'Zone de Danger', icon: Trash2 },
  ] as const;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
            Paramètres
          </h1>
          <p className="text-zinc-400 font-sans max-w-2xl">
            Personnalisez votre espace, gérez vos informations légales et configurez le moteur fiscal.
          </p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border-subtle bg-luxury-900/50 text-zinc-400 hover:text-text-title hover:bg-luxury-800 transition-colors shadow-sm"
        >
          <LogOut className="w-4 h-4" /> Se déconnecter
        </button>
      </header>
      
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="overflow-hidden"
          >
            <div className={cn("p-4 mb-6 rounded-xl border flex items-center gap-3", toast.type === 'success' ? 'bg-money-500/10 border-money-500/20 text-money-400' : 'bg-red-500/10 border-red-500/20 text-red-400')}>
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <p className="font-medium text-sm">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2">
           {tabs.map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
               className={cn(
                 "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200",
                 activeTab === tab.id 
                   ? tab.id === 'danger' ? "bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg" : "bg-gold-500/10 text-gold-400 border border-gold-500/20 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                   : "text-zinc-500 hover:bg-luxury-800 hover:text-zinc-300 border border-transparent"
               )}
             >
               <tab.icon className={cn("w-5 h-5", activeTab === tab.id && tab.id !== 'danger' ? "text-gold-500" : activeTab === tab.id && tab.id === 'danger' ? "text-red-500" : "opacity-70")} />
               {tab.label}
             </button>
           ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          
          <div className="p-6 md:p-8 rounded-3xl bg-luxury-800/40 border border-border-subtle shadow-xl min-h-[500px] flex flex-col justify-between">
             
             {activeTab === 'profile' && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-serif text-gold-100 flex items-center gap-2 mb-1">
                      <Building2 className="w-5 h-5 text-gold-500" /> Informations Légales
                    </h2>
                    <p className="text-sm text-zinc-500">Ces informations apparaîtront sur vos factures et dans vos exports comptables.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Nom de l'entreprise</label>
                      <input type="text" value={company.companyName || ''} onChange={e => setCompany({...company, companyName: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="Raison sociale" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Numéro IFU</label>
                        <input type="text" value={company.ifu || ''} onChange={e => setCompany({...company, ifu: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="Ex: 00000000X" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Numéro RCCM</label>
                        <input type="text" value={company.rccm || ''} onChange={e => setCompany({...company, rccm: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="Registre du commerce" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> Téléphone</label>
                        <input type="tel" value={company.phone || ''} onChange={e => setCompany({...company, phone: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="+226 XX XX XX XX" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email professionnel</label>
                        <input type="email" value={company.email || ''} onChange={e => setCompany({...company, email: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="contact@entreprise.com" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Adresse complète</label>
                      <input type="text" value={company.address || ''} onChange={e => setCompany({...company, address: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="Siège social, Ville, Pays" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Secteur d'activité</label>
                      <input type="text" value={company.sector || ''} onChange={e => setCompany({...company, sector: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="Ex: Commerce, Services informatiques..." />
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'fiscal' && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-serif text-gold-100 flex items-center gap-2 mb-1">
                      <Calculator className="w-5 h-5 text-gold-500" /> Données Comptables & Fiscales
                    </h2>
                    <p className="text-sm text-zinc-500">Configurez le moteur d'intelligence fiscale et les éléments de facturation.</p>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Chiffre d'Affaires Annuel Estimé (FCFA)</label>
                      <input type="number" value={company.estimatedRevenue || ''} onChange={e => setCompany({...company, estimatedRevenue: Number(e.target.value)})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-lg font-bold text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner mb-2" />
                      <p className="text-xs text-zinc-500">Sert de base de calcul pour la configuration automatique du régime fiscal si l'option est activée.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Devise principale</label>
                        <select value={company.currency || 'XOF'} onChange={e => setCompany({...company, currency: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors outline-none appearance-none">
                            <option value="XOF">XOF (Franc CFA)</option>
                            <option value="EUR">EUR (Euro)</option>
                            <option value="USD">USD (Dollar US)</option>
                        </select>
                      </div>
                      <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 items-center gap-1.5 flex"><BadgePercent className="w-4 h-4"/>Taux de TVA standard (%)</label>
                        <input type="number" value={company.vatRate || 18} onChange={e => setCompany({...company, vatRate: Number(e.target.value)})} className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" placeholder="18" />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">Régime d'Imposition (BF)</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={company.autoTaxRegime} onChange={e => setCompany({...company, autoTaxRegime: e.target.checked})} className="sr-only peer" />
                           <div className="w-9 h-5 bg-luxury-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gold-500 relative"></div>
                           <span className="text-[10px] text-zinc-400 font-medium">Détermination Automatique</span>
                        </label>
                      </div>
                      
                      <select 
                        disabled={company.autoTaxRegime}
                        value={company.taxRegime || 'CME'} 
                        onChange={e => setCompany({...company, taxRegime: e.target.value})} 
                        className={cn("w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-500/50 transition-colors outline-none appearance-none font-bold", company.autoTaxRegime ? "text-zinc-500 opacity-50 cursor-not-allowed" : "text-gold-100")}
                      >
                          <option value="CME">CME (Micro-Entreprise) - CA &lt; 15M FCFA</option>
                          <option value="RSI">RSI (Réel Simplifié) - CA 15M à 50M FCFA</option>
                          <option value="RNI">RNI (Réel Normal) - CA &gt; 50M FCFA</option>
                      </select>
                      {company.autoTaxRegime && (
                        <p className="text-[10px] text-gold-500/70 mt-3 font-medium bg-gold-500/10 p-2 rounded-lg border border-gold-500/20">
                          Mode automatique activé. Le régime est calculé sur la base de votre Chiffre d'Affaires Annuel Estimé. Régime actuel: <strong className="text-gold-400">{determineTaxRegime(company.estimatedRevenue || 0)}</strong>
                        </p>
                      )}
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'preferences' && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-serif text-gold-100 flex items-center gap-2 mb-1">
                      <Component className="w-5 h-5 text-gold-500" /> Préférences de l'Application
                    </h2>
                    <p className="text-sm text-zinc-500">Personnalisez votre expérience de navigation et l'assistant IA.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>} Thème Interface
                      </label>
                      <div className="flex p-1 bg-luxury-900 rounded-xl border border-border-subtle shadow-inner">
                         <button 
                           onClick={() => setTheme('dark')}
                           className={cn("flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all", theme === 'dark' ? 'bg-gold-500 text-zinc-900 shadow-md' : 'text-zinc-400 hover:text-gold-100')}
                         >
                           Sombre
                         </button>
                         <button 
                           onClick={() => setTheme('light')}
                           className={cn("flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all", theme === 'light' ? 'bg-gold-500 text-zinc-900 shadow-md' : 'text-zinc-400 hover:text-gold-100')}
                         >
                           Clair
                         </button>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Bot className="w-4 h-4" /> Nom de l'assistant IA
                      </label>
                      <input 
                        type="text" 
                        placeholder="Ex: Comptable Virtuel"
                        value={company.aiCompanionName || ''} 
                        onChange={e => setCompany({...company, aiCompanionName: e.target.value})} 
                        className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 transition-colors shadow-inner" 
                      />
                    </div>

                    <div className="p-6 rounded-2xl border border-border-subtle bg-luxury-900/40 md:col-span-2">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Bell className="w-4 h-4" /> Alertes et Notifications
                      </label>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-2">Combien de jours avant l'échéance fiscale souhaitez-vous être alerté(e) ?</label>
                        <div className="flex items-center gap-4">
                          <input type="range" min="1" max="30" value={company.notificationSettings?.daysBefore || 7} onChange={e => setCompany({...company, notificationSettings: {...company.notificationSettings, daysBefore: Number(e.target.value)}})} className="flex-1 accent-gold-500" />
                          <div className="w-16 text-center py-2 bg-luxury-900 border border-border-subtle rounded-lg text-gold-100 font-bold">{company.notificationSettings?.daysBefore || 7} j</div>
                        </div>
                      </div>
                    </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'subscription' && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-serif text-gold-100 flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-5 h-5 text-gold-500" /> Votre Abonnement
                    </h2>
                    <p className="text-sm text-zinc-500">Gérez votre formule d'abonnement et vos factures.</p>
                  </div>

                  <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-luxury-800 to-luxury-900 border border-gold-500/20 relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Building2 className="w-48 h-48 text-gold-500" />
                     </div>
                     <div className="relative z-10">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-500/10 text-gold-400 border border-gold-500/20 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                         Plan Actuel
                       </div>
                       <h3 className="text-3xl font-serif text-text-title mb-2">Formule Beta Privée</h3>
                       <p className="text-zinc-400 max-w-lg leading-relaxed mb-6">
                         Vous profitez actuellement d'un accès gratuit et anticipé à toutes les fonctionnalités de C-Suite.
                       </p>

                       <ul className="space-y-3 mb-8 max-w-sm">
                         <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Intelligence artificielle illimitée</li>
                         <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Moteur fiscal & prévisions</li>
                         <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Gestion des factures & coffre-fort</li>
                         <li className="flex items-center gap-3 text-sm text-zinc-300"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Inventaire avancé</li>
                       </ul>

                       <button className="px-6 py-3 bg-white text-black font-bold rounded-xl text-sm opacity-50 cursor-not-allowed hover:bg-gray-100 transition-colors">
                         Mettre à niveau (Bientôt disponible)
                       </button>
                     </div>
                  </div>
               </motion.div>
             )}

             {activeTab === 'danger' && (
               <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                  <div>
                    <h2 className="text-xl font-serif text-red-500 flex items-center gap-2 mb-1">
                      <Trash2 className="w-5 h-5" /> Zone de Danger
                    </h2>
                    <p className="text-sm text-red-500/70">Gestion des données et suppression de compte de manière irréversible.</p>
                  </div>

                  {/* Partial Reset */}
                  <div className="p-6 rounded-2xl bg-orange-950/20 border border-orange-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-orange-400 font-bold flex items-center gap-2 mb-2">
                          <RotateCcw className="w-4 h-4" /> Réinitialisation de l'Activité
                        </h3>
                        <p className="text-orange-500/70 text-sm">Supprime vos transactions, actions en coffre, inventaire et discussions avec l'IA. Votre profil et paramètres sont conservés.</p>
                      </div>
                      {!showResetConfirm ? (
                        <button onClick={() => setShowResetConfirm(true)} className="shrink-0 px-6 py-2.5 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-xl text-sm font-bold hover:bg-orange-500/20 transition-all">
                          Nettoyer l'activité
                        </button>
                      ) : (
                        <div className="flex gap-3 shrink-0 bg-luxury-900/80 p-2 rounded-xl border border-orange-500/30 flex-wrap">
                          <button onClick={handlePartialReset} disabled={resetLoading} className="px-4 py-2 bg-orange-600 text-text-title rounded-lg text-sm font-bold hover:bg-orange-500 transition-colors">
                            {resetLoading ? 'En cours...' : 'Confirmer'}
                          </button>
                          <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 bg-luxury-800 text-zinc-400 rounded-lg text-sm font-bold hover:text-text-title transition-colors">
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Complete Deletion */}
                  <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <h3 className="text-red-500 font-bold flex items-center gap-2 mb-2">
                          <UserX className="w-4 h-4" /> Suppression du Compte
                        </h3>
                        <p className="text-red-500/70 text-sm">Supprime définitivement TOUTES vos données. Action absolue et non restaurable.</p>
                      </div>
                      {!showDeleteConfirm ? (
                        <button onClick={() => setShowDeleteConfirm(true)} className="shrink-0 px-6 py-2.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all">
                          Supprimer le compte
                        </button>
                      ) : (
                        <div className="flex gap-3 shrink-0 bg-luxury-900/80 p-2 rounded-xl border border-red-500/30 flex-wrap">
                          <button onClick={handleDeleteAccount} disabled={deleteLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-500 transition-colors shadow-lg shadow-red-500/20">
                            {deleteLoading ? 'Suppression...' : 'Adieu'}
                          </button>
                          <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-luxury-800 text-zinc-400 rounded-lg text-sm font-bold hover:text-text-title transition-colors">
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
               </motion.div>
             )}


             {/* Save Button for active tabs !== danger */}
             {activeTab !== 'danger' && (
                <div className="mt-8 pt-8 border-t border-border-subtle flex justify-end">
                  <button 
                    onClick={handleUpdate}
                    disabled={loading}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl font-bold tracking-wide hover:from-gold-400 hover:to-gold-300 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)] disabled:opacity-50"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-luxury-900/20 border-t-luxury-900 rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                    {loading ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
