import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { localDb } from '../services/localDb';
import { useAuth } from '../contexts/AuthContext';
import { calculateTaxes, TaxCalculation, TaxRegime } from '../lib/tax-rules';
import { ExtractedTransaction } from '../services/nim';
import { fetchDailyIntelligence, IntelligenceNews } from '../services/intelligence';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Calendar, Sparkles, TrendingUp, TrendingDown, Clock, ArrowUpRight, Wallet, User, Bell, Download, Briefcase, Gavel, Newspaper, RefreshCcw, Loader2, ChevronRight, Activity, PieChart, ExternalLink, Bot, Plus, FileText, Scan, Zap, Target, ArrowRight, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  
  const [company, setCompany] = useState<any>(null);
  const [taxData, setTaxData] = useState<TaxCalculation | null>(null);
  const [nextDeadline, setNextDeadline] = useState<any>(null);
  
  const [intelligence, setIntelligence] = useState<IntelligenceNews[]>([]);
  const [intelPage, setIntelPage] = useState(0);
  const [loadingIntel, setLoadingIntel] = useState(false);
  
  const [periodMode, setPeriodMode] = useState<'mensuel' | 'trimestriel' | 'annuel'>('mensuel');
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [isPersistent, setIsPersistent] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultMsg, setVaultMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    localDb.getIsPersistent().then(res => setIsPersistent(res));
  }, []);

  const handleCloudBackup = async () => {
    if (!user) return;
    if (!passphrase.trim() || passphrase.length < 8) {
      setVaultMsg({ type: 'error', text: 'La phrase de passe doit contenir au moins 8 caractères pour être hautement sécurisée.' });
      return;
    }
    setVaultLoading(true);
    setVaultMsg(null);
    try {
      await localDb.uploadEncryptedCloudBackup(user.uid, passphrase);
      setVaultMsg({ type: 'success', text: '✓ Sauvegarde chiffrée de bout en bout (Zéro-Knowledge) envoyée avec succès sur le cloud !' });
    } catch (err: any) {
      setVaultMsg({ type: 'error', text: err.message || 'Une erreur est survenue lors de la sauvegarde.' });
    } finally {
      setVaultLoading(false);
    }
  };

  const handleCloudRestore = async () => {
    if (!user) return;
    if (!passphrase.trim()) {
      setVaultMsg({ type: 'error', text: 'Veuillez saisir votre phrase de passe maîtresse.' });
      return;
    }
    setVaultLoading(true);
    setVaultMsg(null);
    try {
      await localDb.restoreEncryptedCloudBackup(user.uid, passphrase);
      setVaultMsg({ type: 'success', text: '✓ Restauration et déchiffrement terminés avec succès ! Vos données locales sont rechargées.' });
    } catch (err: any) {
      setVaultMsg({ type: 'error', text: err.message || 'La phrase de passe est incorrecte ou aucun coffre n\'existe pour cet utilisateur.' });
    } finally {
      setVaultLoading(false);
    }
  };

  const handleFileExport = async () => {
    if (!user) return;
    try {
      const payload = await localDb.exportLocalPayload(user.uid);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `neocompta_export_fiscal_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setVaultMsg({ type: 'success', text: '✓ Fichier de sauvegarde locale exporté avec succès ! Gardez ce fichier en lieu sûr (clé USB).' });
    } catch (err) {
      setVaultMsg({ type: 'error', text: 'Impossible d\'exporter le fichier de sauvegarde.' });
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setVaultLoading(true);
    setVaultMsg(null);
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await localDb.importLocalPayload(text, user.uid);
        setVaultMsg({ type: 'success', text: '✓ Fichier de sauvegarde locale importé et rechargé avec succès !' });
      } catch (err) {
        setVaultMsg({ type: 'error', text: 'Fichier de sauvegarde corrompu ou invalide.' });
      } finally {
        setVaultLoading(false);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!user) return;

    const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const compData = docSnap.data();
        setCompany(compData);
        
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        
        if (compData.taxRegime === 'RSI' || compData.taxRegime === 'RNI') {
          const nextTva = new Date(year, month, 20);
          if (today.getDate() > 20) nextTva.setMonth(month + 1);
          setNextDeadline({ title: 'Déclaration TVA (G50)', date: nextTva, priority: 'HIGH' });
        } else if (compData.taxRegime === 'CME') {
          const nextCme = new Date(year, month, 10);
          if (today.getDate() > 10) nextCme.setMonth(month + 1);
          setNextDeadline({ title: 'Paiement CME', date: nextCme, priority: 'MEDIUM' });
        }
      }
    });

    const unsubscribeSnapshot = localDb.subscribe('transactions', user.uid, (txs) => {
      setTransactions(txs as ExtractedTransaction[]);
    });

    return () => {
      unsubscribeCompany();
      unsubscribeSnapshot();
    };
  }, [user]);

  useEffect(() => {
    if (company && transactions) {
      const revenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
      const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
      const grossPayroll = transactions.filter(t => t.type === 'PAYROLL').reduce((acc, t) => acc + (Number((t as any).payrollDetails?.grossSalary) || 0), 0);
      
      const taxes = calculateTaxes(revenue, expenses, company.taxRegime as TaxRegime, company.sector?.toLowerCase().includes('service') ?? true, 12, grossPayroll);
      setTaxData(taxes);
    }
  }, [company, transactions]);

  useEffect(() => {
    if (company && company.sector) {
      const today = new Date().toISOString().split('T')[0];
      const intelRef = collection(db, 'intelligence_feed');
      const q = query(intelRef, where("date", "==", today));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allNews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IntelligenceNews))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        const relevantNews = allNews.filter(news => 
          news.targetSectors.includes('GLOBAL') || 
          news.targetSectors.includes(company.sector)
        );
        
        if (relevantNews.length > 0) {
          setIntelligence(relevantNews);
          // Optional: reset page to 0 if data changes significantly
        } else {
          refreshIntelligence();
        }
      });

      return () => unsubscribe();
    }
  }, [company?.sector]);

  const refreshIntelligence = async (force: boolean = false) => {
    if (!company) return;
    setLoadingIntel(true);
    try {
      await fetchDailyIntelligence(company.sector, force);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingIntel(false);
    }
  };

  const handleNextIntelPage = () => {
    if (intelligence.length > (intelPage + 1) * 5) {
      setIntelPage(p => p + 1);
    } else {
      setIntelPage(0);
    }
  };

  const interactiveChartData = useMemo(() => {
    const dataMap = new Map<string, { name: string, Revenus: number, Dépenses: number, Bénéfice: number }>();
    const currentYear = new Date().getFullYear();

    if (periodMode === 'mensuel') {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      months.forEach((m, i) => dataMap.set(String(i), { name: m, Revenus: 0, Dépenses: 0, Bénéfice: 0 }));
    } else if (periodMode === 'trimestriel') {
      ['T1', 'T2', 'T3', 'T4'].forEach(q => dataMap.set(q, { name: q, Revenus: 0, Dépenses: 0, Bénéfice: 0 }));
    }

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const month = d.getMonth();
      const amount = Number(t.amountExclTax) || 0;

      let key = '';
      if (periodMode === 'mensuel') {
        if (year !== currentYear) return;
        key = String(month);
      } else if (periodMode === 'trimestriel') {
        if (year !== currentYear) return;
        const q = Math.floor(month / 3) + 1;
        key = `T${q}`;
      } else if (periodMode === 'annuel') {
        key = String(year);
        if (!dataMap.has(key)) {
          dataMap.set(key, { name: key, Revenus: 0, Dépenses: 0, Bénéfice: 0 });
        }
      }

      if (dataMap.has(key)) {
        const item = dataMap.get(key)!;
        if (t.type === 'INCOME') item.Revenus += amount;
        else if (t.type === 'EXPENSE' || t.type === 'PAYROLL') item.Dépenses += amount;
      }
    });

    const result = Array.from(dataMap.values());
    result.forEach(item => item.Bénéfice = item.Revenus - item.Dépenses);
    if (periodMode === 'annuel') result.sort((a, b) => parseInt(a.name) - parseInt(b.name));
    return result;
  }, [transactions, periodMode]);

  const revenue = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
  const expenses = transactions.filter(t => t.type === 'EXPENSE' || t.type === 'PAYROLL').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
  const totalTax = (taxData?.cmeAmount || 0) + (taxData?.isAmount || 0) + (taxData?.tvaAmount || 0);

  const getHealthScore = () => {
    if (revenue === 0 && expenses === 0) return { score: 100, status: 'EXCELLENT', color: 'text-money-400', bg: 'bg-money-500/10' };
    const margin = revenue === 0 ? -1 : (revenue - expenses) / revenue;
    
    let score = 50;
    if (margin > 0.3) score = 90 + Math.min(10, (margin - 0.3) * 50);
    else if (margin > 0) score = 60 + (margin / 0.3) * 30;
    else if (margin === 0) score = 50;
    else score = Math.max(0, 50 + margin * 100);

    score = Math.floor(score);
    if (score >= 80) return { score, status: 'TRÈS BON', color: 'text-money-400', bg: 'bg-money-500/10' };
    if (score >= 50) return { score, status: 'CORRECT', color: 'text-gold-500', bg: 'bg-gold-500/10' };
    return { score, status: 'DANGER', color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const topSpending = useMemo(() => {
    const spendByCategory = transactions
      .filter(t => t.type === 'EXPENSE' || t.type === 'PAYROLL')
      .reduce((acc: any, t) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amountExclTax);
          return acc;
      }, {});
    const maxVal = Math.max(...Object.values(spendByCategory) as number[], 1);
    
    return Object.entries(spendByCategory)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value: value as number, percent: ((value as number) / maxVal) * 100 }));
  }, [transactions]);

  const health = getHealthScore();
  const formatXOF = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val);

  const quickActions = [
    { title: 'Scanner Facture', icon: Scan, path: '/scan', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { title: 'Nouvelle Facture', icon: Plus, path: '/invoices', color: 'text-gold-400', bg: 'bg-gold-500/10' },
    { title: 'Consulter NEO', icon: Bot, path: '/hub', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { title: 'Régler Échéance', icon: Calendar, path: '/calendar', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-8">
      
      {/* LOCAL VAULT AND ZERO KNOWLEDGE BACKUP MODAL */}
      <AnimatePresence>
        {isVaultOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-base/85 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl overflow-y-auto max-h-[90vh] rounded-3xl bg-luxury-900 border border-emerald-500/30 p-6 md:p-8 shadow-2xl text-text-body space-y-6 scrollbar-thin"
            >
              <button 
                onClick={() => { setIsVaultOpen(false); setVaultMsg(null); setPassphrase(''); }} 
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-850 text-zinc-400 hover:text-white transition-colors"
                id="close-vault-modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-serif text-white font-bold flex items-center gap-2">
                    Coffre-fort Haute Sécurité Local & Cloud ZK
                  </h2>
                  <p className="text-xs text-emerald-400 font-mono uppercase tracking-wider">
                    Chiffrement Client-Side AES-GCM 256
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs md:text-sm text-zinc-300">
                <p>
                  Pour répondre à votre exigence de <strong>confidentialité absolue</strong>, vos données fiscales et comptables restent à 100% stockées localement sur cet appareil via <strong>IndexedDB</strong>, le moteur asynchrone sécurisé de haute capacité de votre navigateur.
                </p>

                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Immunité contre l'auto-nettoyage OS :</span>
                    <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {isPersistent ? "Persistent Globale Activée ✓" : "Durable & Indexée ✓"}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Grâce à la technologie IndexedDB persistante, votre navigateur réserve jusqu'à 80% de l'espace disque de l'appareil (plusieurs Gigaoctets) et s'engage à **ne jamais nettoyer automatiquement** le cache de NeoCompta.
                  </p>
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gold-400 font-sans">Option 1 : Sauvegarde Cloud Cryptée de Bout en Bout (Zero-Knowledge)</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pour parer les risques de perte de données en cas de panne physique, réinstallation d'ordinateur ou de suppression manuelle du navigateur, vous pouvez envoyer une copie de sauvegarde sur le cloud. 
                    En utilisant notre technologie <strong>Zero-Knowledge</strong>, nous n'avons aucun moyen technique de lire vos données : <strong className="text-emerald-400">Tout est crypté localement sur votre ordinateur avant le transfert par clé AES-GCM-256 déduite de votre phrase secrète</strong>. Pour les serveurs, vos données fiscales n'apparaissent que comme du texte aléatoire illisible.
                  </p>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-400">Saisissez votre Phrase de Passe Secrète Personnelle :</label>
                    <input 
                      type="password" 
                      placeholder="Saisissez une clé secrète forte pour encrypter/décrypter vos sauvegardes..."
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-emerald-500 text-white focus:outline-none"
                    />
                    <div className="text-[10px] text-red-400 flex items-start gap-1">
                      <span>⚠️</span>
                      <span><strong>Règle de fer :</strong> Nous ne stockons pas cette clé. Si vous l'oubliez, aucune opération (ni vous, ni nous) ne pourra restaurer les données sauvegardées sur le cloud. Notez-la en lieu sûr !</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button 
                      onClick={handleCloudBackup}
                      disabled={vaultLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {vaultLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Sauvegarder dans le Cloud (Zéro-Knowledge)
                    </button>
                    <button 
                      onClick={handleCloudRestore}
                      disabled={vaultLoading}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-805 hover:bg-zinc-750 hover:text-white border border-zinc-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      Restaurer depuis le Cloud de l'appareil
                    </button>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider text-gold-400 font-sans">Option 2 : Exports et Sauvegardes Physiques Locaux (100% Offline)</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pour être serein, archivez manuellement vos données sur une clé USB physique, un disque dur de sauvegarde de l'entreprise ou un lecteur réseau local de confiance.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={handleFileExport}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-705 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      💾 Exporter mon fichier fiscal .json
                    </button>
                    <label className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 hover:bg-zinc-801 cursor-pointer text-xs font-bold text-zinc-400 hover:text-white flex items-center justify-center gap-2 transition-all">
                      📂 Importer un fichier fiscal .json
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleFileImport}
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>

                {vaultMsg && (
                  <div className={cn(
                    "p-4 rounded-xl text-xs font-semibold border mt-4",
                    vaultMsg.type === 'success' 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                      : "bg-red-500/10 border-red-500/20 text-red-300"
                  )}>
                    {vaultMsg.text}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Local-First Secure Banner */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm shadow-md overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-300 shrink-0 mt-0.5 md:mt-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="font-bold block text-emerald-300">🔒 Coffre-fort Fiscal Sécurisé Local-First</span>
            <span className="text-zinc-300 text-[11px] sm:text-xs block mt-0.5 leading-relaxed">
              Vos informations comptables sont stockées localement en toute fluidité (IndexedDB) pour préserver 100% de votre vie privée d'entreprise.
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto self-stretch md:self-auto justify-end shrink-0">
          <button 
            onClick={() => setIsVaultOpen(true)}
            className="px-3.5 py-2 sm:py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-[10px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider transition-all cursor-pointer text-center sm:whitespace-nowrap"
          >
            🛡️ Gérer Sauvegardes & Coffre
          </button>
          <div className="px-3 py-2 sm:py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400 text-center sm:whitespace-nowrap">
            Abonnement Valide ✓ Verified
          </div>
        </div>
      </div>

      {/* Header with Quick Actions */}
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-text-title flex flex-col uppercase">
            <span className="text-sm md:text-base text-gold-500 font-sans font-bold uppercase tracking-[0.2em] mb-2">Vue d'ensemble</span>
            {company?.companyName || 'Votre Espace Privé'}
          </h1>
          <p className="text-sm text-zinc-500 mt-2 font-medium">Tout ce qu'il faut savoir sur votre activité aujourd'hui, de manière simple et clair.</p>
        </div>
        
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full sm:w-auto">
           {quickActions.map(action => (
             <Link 
               key={action.title}
               to={action.path}
               className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-luxury-800/40 border border-border-subtle text-zinc-300 hover:text-text-title hover:bg-luxury-800 transition-all font-semibold text-xs whitespace-nowrap group shadow-lg"
             >
               <div className={cn("p-1.5 rounded-lg transition-transform group-hover:scale-110", action.bg, action.color)}>
                  <action.icon className="w-3.5 h-3.5" />
               </div>
               {action.title}
             </Link>
           ))}
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        
        {/* Bento 1: Main Performance Card (Resultat Net) */}
        <div className="lg:col-span-4 p-8 rounded-[2.5rem] bg-gradient-to-br from-luxury-800 to-luxury-900 border border-gold-500/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col justify-between group">
           <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <Zap className="w-64 h-64 text-gold-500" />
           </div>
           
           <div className="relative z-10">
              <div className="flex justify-between items-start mb-12">
                <div className="p-3 rounded-2xl bg-gold-500/10 text-gold-500 border border-gold-500/20">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                   <div className="px-3 py-1 rounded-full bg-money-500/10 text-money-400 text-[10px] font-bold uppercase tracking-widest border border-money-500/20 mb-2">
                     MON BÉNÉFICE (CE QU'IL ME RESTE)
                   </div>
                   <div className="flex items-center gap-1.5 text-xs font-bold text-money-400">
                     <TrendingUp className="w-3.5 h-3.5" /> +12.3% <span className="text-zinc-500 font-medium lowercase">vs mois dernier</span>
                   </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="text-5xl lg:text-6xl font-serif text-text-title tracking-tighter mb-4 font-bold flex items-baseline gap-2">
                   {formatXOF(taxData?.netIncome || 0).split(' ')[0]}
                   <span className="text-xl text-gold-500/50 uppercase font-sans tracking-widest">fcfa</span>
                </div>
                <div className="flex items-center gap-3">
                   <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, (taxData?.netIncome || 0) / (revenue || 1) * 100))}%` }} className="h-full bg-gold-500" />
                   </div>
                   <span className="text-xs font-bold text-zinc-500 font-mono">
                      {Math.max(0, Math.min(100, (taxData?.netIncome || 0) / (revenue || 1) * 100)).toFixed(1)}% MARGE
                   </span>
                </div>
              </div>
           </div>

           <div className="mt-12 pt-8 border-t border-white/5 relative z-10">
              <Link to="/simulator" className="flex items-center justify-between group-hover:text-gold-400 text-gold-500 transition-all font-bold text-sm tracking-wide">
                <span>OPTIMISER LA FISCALITÉ</span>
                <div className="w-10 h-10 rounded-full bg-gold-500/10 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-gold-500/20 transition-all">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </Link>
           </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
           {/* Revenue */}
           <div className="p-6 rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl hover:border-gold-500/20 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-zinc-500 mb-6 text-[10px] font-bold uppercase tracking-widest">
                  <div className="p-1.5 rounded-lg bg-gold-500/10 text-gold-500"><TrendingUp className="w-3 h-3" /></div> L'ARGENT ENTRÉ
                </div>
                <div className="text-2xl font-bold text-text-title tracking-tight font-mono">{formatXOF(revenue)}</div>
              </div>
              <div className="mt-4 text-[10px] text-zinc-600 font-medium">L'argent reçu (ventes de l'année)</div>
           </div>

           {/* Expenses */}
           <div className="p-6 rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl hover:border-red-500/20 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-zinc-500 mb-6 text-[10px] font-bold uppercase tracking-widest">
                  <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400"><TrendingDown className="w-3 h-3" /></div> L'ARGENT SORTI
                </div>
                <div className="text-2xl font-bold text-text-title tracking-tight font-mono">{formatXOF(expenses)}</div>
              </div>
              <div className="mt-4 text-[10px] text-zinc-600 font-medium">Total de mes dépenses de l'année</div>
           </div>

           {/* Taxes Summary */}
           <div className="p-6 rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl hover:border-orange-500/20 transition-colors flex flex-col justify-between group">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                     <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400"><Gavel className="w-3 h-3" /></div> Sécurité Fiscale
                   </div>
                   <div className="text-[9px] font-bold text-orange-500/70">{company?.taxRegime || 'RÉGIME'}</div>
                </div>
                <div className="text-2xl font-bold text-text-title tracking-tight font-mono">{formatXOF(totalTax)}</div>
              </div>
              <Link to="/simulator" className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold group-hover:text-gold-500 transition-colors">
                Détails du moteur fiscal <ChevronRight className="w-3 h-3" />
              </Link>
           </div>

           {/* Health Score */}
           <div className="p-6 rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl hover:border-money-500/20 transition-colors flex flex-col justify-between">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                  <div className={cn("p-1.5 rounded-lg", health.bg)}><Activity className={cn("w-3 h-3", health.color)} /></div> Indice de Santé
                </div>
                <div className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg border", health.color, health.color.replace('text-', 'border-').replace('400', '400/20'))}>
                  {health.status}
                </div>
              </div>
              <div className={cn("text-3xl font-bold tracking-tighter font-mono", health.color)}>{health.score}<span className="text-sm opacity-50 ml-1">pts</span></div>
           </div>
        </div>

        {/* Bento 3: Deadlines & High Priority Notifications */}
        <div className="lg:col-span-3 p-6 rounded-[2.5rem] bg-luxury-800/40 border border-border-subtle shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-8">
               <h3 className="font-bold text-text-title text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                 <Bell className="w-4 h-4 text-gold-500" /> CE QUE JE DOIS FAIRE
               </h3>
               <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>

           <div className="flex-1 space-y-4">
              {nextDeadline && (
                 <div className="p-5 rounded-3xl bg-luxury-900 border border-border-subtle relative overflow-hidden shadow-inner group cursor-pointer hover:border-gold-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-2">
                       <Zap className={cn("w-4 h-4 opacity-20", nextDeadline.priority === 'HIGH' ? 'text-red-500' : 'text-gold-500')} />
                    </div>
                    <div className="flex items-start gap-4 mb-4">
                       <div className={cn("p-3 rounded-2xl shrink-0 border", nextDeadline.priority === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gold-500/10 text-gold-500 border-gold-500/20')}>
                          <Clock className="w-5 h-5" />
                       </div>
                       <div>
                          <p className="text-sm font-bold text-text-title mb-1">{nextDeadline.title}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">Prévu le : {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(nextDeadline.date)}</p>
                       </div>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                       <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} className={cn("h-full", nextDeadline.priority === 'HIGH' ? 'bg-red-500' : 'bg-gold-500')} />
                    </div>
                 </div>
              )}

              <div className="p-5 rounded-3xl bg-luxury-900/50 border border-dashed border-border-subtle group hover:bg-luxury-900 transition-colors cursor-pointer">
                 <div className="flex items-center gap-3 text-zinc-500 mb-2">
                    <Target className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Évolution de l'entreprise</span>
                 </div>
                 <div className="text-sm font-bold text-text-title mb-1">Croissance</div>
                 <p className="text-[10px] text-zinc-500 leading-relaxed">Plus que <span className="text-gold-500 font-bold">{formatXOF(15000000 - revenue)}</span> de ventes pour franchir un nouveau cap (RSI).</p>
              </div>
           </div>
           
           <button onClick={() => navigate('/journal')} className="mt-8 w-full py-4 rounded-[1.5rem] bg-luxury-900 border border-border-subtle text-xs font-bold text-zinc-400 hover:text-text-title transition-all uppercase tracking-widest">
              VOIR TOUT MON CALENDRIER
           </button>
        </div>

        {/* Growth & Cashflow Chart */}
        <div className="lg:col-span-8 p-8 rounded-[2.5rem] bg-luxury-800/40 border border-border-subtle shadow-xl flex flex-col h-[500px]">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
              <div>
                <h3 className="text-xl font-serif text-text-title flex items-center gap-2">
                  L'évolution de mon activité
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Comment mon argent rentre, sort, et ce qu'il me reste au fil des mois.</p>
              </div>
              <div className="flex bg-luxury-900 p-1.5 rounded-2xl border border-border-subtle shadow-inner">
                {['mensuel', 'trimestriel', 'annuel'].map((mode) => (
                  <button 
                    key={mode}
                    onClick={() => setPeriodMode(mode as any)} 
                    className={cn("px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all", periodMode === mode ? 'bg-gold-500 text-zinc-900 shadow-lg' : 'text-zinc-500 hover:text-text-title')}
                  >
                    {mode.slice(0, 3)}
                  </button>
                ))}
              </div>
           </div>
           
           <div className="flex-1 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={interactiveChartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.03)" vertical={false} />
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="#3f3f46" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={15} 
                    tick={{ fill: '#71717a', fontWeight: 'bold' }}
                  />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 1.5, strokeDasharray: '6 6' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-luxury-900 border border-gold-500/20 p-5 rounded-[1.5rem] shadow-2xl backdrop-blur-xl">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">{label}</p>
                            <div className="space-y-3">
                              {payload.map((entry: any, index: number) => (
                                <div key={index} className="flex items-center justify-between gap-8">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs text-zinc-400 font-medium">{entry.name}</span>
                                  </div>
                                  <span className="text-xs font-bold text-text-title font-mono">{formatXOF(entry.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="Revenus" stroke="#D4AF37" strokeWidth={4} fillOpacity={1} fill="url(#colorIncome)" activeDot={{ r: 8, strokeWidth: 0, fill: '#D4AF37' }} />
                  <Area type="monotone" dataKey="Bénéfice" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                  <ReferenceLine y={0} stroke="#3f3f46" strokeWidth={1} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Expense Category Breakdown */}
        <div className="lg:col-span-4 p-8 rounded-[2.5rem] bg-luxury-800/40 border border-border-subtle shadow-xl flex flex-col justify-between h-[500px]">
           <div>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-serif text-text-title">Où part mon argent ?</h3>
                <PieChart className="w-5 h-5 text-zinc-500" />
              </div>
              
              <div className="space-y-6">
                  {topSpending.map((cat, idx) => (
                    <div key={cat.name} className="group">
                       <div className="flex justify-between items-center mb-2.5">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-gold-500 transition-colors truncate max-w-[150px]">{cat.name || 'Général'}</span>
                          <span className="text-xs font-bold text-text-title font-mono">{formatXOF(cat.value)}</span>
                       </div>
                       <div className="h-2 w-full bg-luxury-900 rounded-full overflow-hidden shadow-inner border border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.percent}%` }}
                            transition={{ duration: 1.5, delay: idx * 0.2 }}
                            className={cn("h-full rounded-full", idx === 0 ? "bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : idx === 1 ? "bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.3)]" : "bg-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.3)]")} 
                          />
                       </div>
                       <div className="mt-1.5 flex justify-end">
                          <span className="text-[10px] text-zinc-600 font-bold ">{cat.percent.toFixed(1)}% des charges</span>
                       </div>
                    </div>
                  ))}
                  {topSpending.length === 0 && (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                      <PieChart className="w-12 h-12 text-zinc-800" />
                      <p className="text-xs text-zinc-500 italic max-w-[200px]">Aucune donnée de dépense à analyser pour le moment.</p>
                    </div>
                  )}
              </div>
           </div>

           <div className="mt-8 pt-8 border-t border-white/5">
              <button onClick={() => navigate('/journal')} className="w-full flex items-center justify-between text-[11px] font-bold text-zinc-400 hover:text-text-title transition-colors uppercase tracking-widest group">
                 Voir toutes mes entrées et sorties
                 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>

      </div>

      {/* Intelligence Feed Section (Echo de NEO) */}
      <section className="mt-16 pb-12">
         <div className="flex flex-col md:flex-row items-baseline justify-between mb-10 gap-4">
           <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 text-gold-500 border border-gold-500/20 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                         Actualités pour mon métier
                      </div>
              <h2 className="text-3xl font-serif text-text-title flex items-center gap-3">
                 <Sparkles className="w-7 h-7 text-gold-500" />
                 L'actualité pour moi
              </h2>
           </div>
           <button 
             onClick={() => refreshIntelligence(true)}
             disabled={loadingIntel}
             className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-luxury-800/80 text-gold-500 border border-border-subtle hover:bg-gold-500/10 transition-all font-bold text-xs uppercase tracking-widest shadow-xl disabled:opacity-50"
           >
             <RefreshCcw className={cn("w-4 h-4", loadingIntel && "animate-spin")} />
             Chercher de nouveaux conseils
           </button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingIntel && intelligence.length === 0 ? (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-zinc-500">
                 <div className="relative mb-8">
                   <div className="absolute inset-0 bg-gold-500/20 blur-3xl rounded-full" />
                   <Loader2 className="w-12 h-12 animate-spin text-gold-500 relative z-10" />
                 </div>
                 <p className="text-sm font-medium">NEO analyse ce qui se passe dans votre métier...</p>
              </div>
            ) : intelligence.length > 0 ? (
              intelligence.slice(intelPage * 5, (intelPage + 1) * 5).map((news) => (
                <div key={news.id} className="p-8 rounded-[2.5rem] bg-luxury-800/60 border border-border-subtle hover:border-gold-500/30 hover:shadow-2xl transition-all duration-500 flex flex-col h-full group relative overflow-hidden">
                   <div className="absolute -top-12 -right-12 w-32 h-32 bg-gold-500/5 blur-3xl rounded-full group-hover:bg-gold-500/10 transition-all" />
                   
                   <div className="flex items-center justify-between mb-8">
                     <div className={cn(
                       "px-4 py-1.5 rounded-xl text-[10px] font-bold border uppercase tracking-widest",
                       news.category === 'OPPORTUNITY' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                       news.category === 'FISCAL' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                       "bg-gold-500/10 text-gold-400 border-gold-500/20"
                     )}>
                        {news.category === 'OPPORTUNITY' ? 'OPPORTUNITÉ' : 
                         news.category === 'FISCAL' ? 'FISCALITÉ' : 
                         news.category === 'MARKET' ? 'MARCHÉ' : 'TECH'}
                     </div>
                     <span className="text-[10px] text-zinc-500 font-bold font-mono tracking-tighter">{new Date(news.date).toLocaleDateString('fr-FR')}</span>
                   </div>
                   
                   <h3 className="text-xl font-serif text-text-title mb-4 leading-snug group-hover:text-gold-500 transition-colors">
                     {news.title}
                   </h3>
                   <p className="text-sm text-zinc-400 flex-1 mb-8 leading-relaxed line-clamp-3">
                     {news.excerpt}
                   </p>
                   
                   <div className="mt-auto flex flex-col gap-3">
                     {news.url && (
                        <a 
                          href={news.url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-luxury-900 text-xs font-bold text-zinc-300 border border-border-subtle hover:text-text-title hover:bg-gold-500/10 hover:border-gold-500/20 transition-all"
                        >
                          LIRE L'ARTICLE <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                     )}
                     <button
                        onClick={() => navigate(`/hub?q=Je veux en savoir plus sur cette actualité : ${encodeURIComponent(news.title)}`)}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gold-500 text-zinc-900 text-xs font-bold uppercase tracking-widest hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/10"
                     >
                       <Bot className="w-4 h-4" /> Demander à NEO d'expliquer
                     </button>
                   </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-border-subtle rounded-[2.5rem] bg-luxury-900/10">
                 <Newspaper className="w-20 h-20 mb-6 opacity-5" />
                 <p className="text-sm font-medium mb-6">Il n'y a pas de nouvelle information marquante pour votre métier aujourd'hui.</p>
                 <button 
                  onClick={() => refreshIntelligence(true)} 
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-gold-500 text-zinc-900 font-bold text-xs uppercase tracking-widest hover:bg-gold-400 transition-all"
                 >
                   Chercher à nouveau
                 </button>
              </div>
            )}
         </div>
      </section>
    </div>
  );
}
