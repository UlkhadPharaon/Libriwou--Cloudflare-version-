import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, collection, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Calendar as CalendarIcon, AlertCircle, Clock, CheckCircle2, Wallet, ChevronRight, Info, ShieldCheck, PieChart, Activity, HelpCircle } from 'lucide-react';
import { calculateTaxes, TaxCalculation } from '../lib/tax-rules';
import { cn } from '../lib/utils';

interface Deadline {
  id: string;
  title: string;
  description: string;
  date: Date;
  status: 'upcoming' | 'urgent' | 'past';
  diffDays: number;
  category: 'CME' | 'TVA' | 'IS' | 'LIASSE';
}

const formatXOF = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount);
};

export function CalendarPage() {
  const [company, setCompany] = useState<any>(null);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [taxData, setTaxData] = useState<TaxCalculation | null>(null);
  const [ytdData, setYtdData] = useState({ revenue: 0, expenses: 0 });
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const compData = docSnap.data();
          setCompany(compData);
          generateDeadlines(compData);
        }
      });

      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('date', '>=', startOfYear));
      const unsubscribeTx = onSnapshot(q, (snapshot) => {
        let rev = 0;
        let exp = 0;
        snapshot.forEach(doc => {
          const t = doc.data();
          if (t.type === 'INCOME') rev += Number(t.amountExclTax || 0);
          if (t.type === 'EXPENSE') exp += Number(t.amountExclTax || 0);
        });
        
        setYtdData({ revenue: rev, expenses: exp });
        setTaxData(calculateTaxes(rev, exp, company?.taxRegime || 'CME'));
      });

      return () => {
        unsubscribeCompany();
        unsubscribeTx();
      };
    });
    return () => unsubscribeAuth();
  }, [company?.taxRegime]);

  const generateDeadlines = (compData: any) => {
    const regime = compData.taxRegime || 'CME';
    const completedDeadlines = compData.completedDeadlines || [];
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    let generated: Omit<Deadline, 'status' | 'diffDays'>[] = [];

    if (regime === 'RSI' || regime === 'RNI') {
      generated.push({
        id: `tva_${month}_${year}`,
        title: 'Déclaration TVA (G50)',
        description: 'Déclaration et paiement de la TVA collectée le mois dernier.',
        date: new Date(year, month, 20),
        category: 'TVA'
      });
      generated.push({
        id: `tva_${month + 1}_${year}`,
        title: 'Déclaration TVA (G50)',
        description: 'Déclaration et paiement de la TVA du mois en cours.',
        date: new Date(year, month + 1, 20),
        category: 'TVA'
      });
      generated.push({
        id: `liasse_${year}`,
        title: 'Dépôt Liasse Fiscale',
        description: 'Dépôt des états financiers (SYSCOHADA) de l\'exercice précédent.',
        date: new Date(year, 3, 30), // 30 Avril
        category: 'LIASSE'
      });
      generated.push({
        id: `is_1_${year}`,
        title: '1er Acompte IS',
        description: 'Paiement du 1er acompte de l\'Impôt sur les Sociétés.',
        date: new Date(year, 6, 20), // 20 Juillet
        category: 'IS'
      });
      generated.push({
        id: `is_2_${year}`,
        title: '2ème Acompte IS',
        description: 'Paiement du 2ème acompte de l\'Impôt sur les Sociétés.',
        date: new Date(year, 9, 20), // 20 Octobre
        category: 'IS'
      });
      generated.push({
        id: `is_3_${year}`,
        title: '3ème Acompte IS',
        description: 'Paiement du 3ème acompte de l\'Impôt sur les Sociétés.',
        date: new Date(year + 1, 0, 20), // 20 Janvier N+1
        category: 'IS'
      });
    } else {
      // Default CME
      generated.push({
        id: `cme_${month}_${year}`,
        title: 'Paiement CME',
        description: 'Paiement de la Contribution des Micro-Entreprises (Taux : 5% services, 2% biens).',
        date: new Date(year, month, 10),
        category: 'CME'
      });
      generated.push({
        id: `cme_${month+1}_${year}`,
        title: 'Paiement CME',
        description: 'Paiement anticipé de la Contribution mensuelle suivante.',
        date: new Date(year, month + 1, 10),
        category: 'CME'
      });
    }

    // Process status
    const processed = generated.map(d => {
      const diffDays = Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 3600 * 24));
      let status: 'upcoming' | 'urgent' | 'past' = 'upcoming';
      
      // Clear past dates at midnight locally
      if (d.date.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
         status = 'past';
      } else if (diffDays <= 7) {
         status = 'urgent';
      }
      
      return { ...d, status, diffDays };
    })
    .filter(d => !completedDeadlines.includes(d.id))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

    setDeadlines(processed as Deadline[]);
  };

  const handleMarkAsDone = async (deadlineId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'companies', auth.currentUser.uid), {
        completedDeadlines: arrayUnion(deadlineId)
      });
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  // Split deadlines into urgent/upcoming and past
  const activeDeadlines = deadlines.filter(d => d.status !== 'past').filter(d => d.diffDays <= 90);
  const pastDeadlines = deadlines.filter(d => d.status === 'past' && d.diffDays >= -30);

  const totalProvision = (taxData?.cmeAmount || 0) + (taxData?.isAmount || 0) + (taxData?.tvaAmount || 0);

  const RegimenDetails = {
    'CME': 'Contribution des Micro-Entreprises (CME) - Remplace l\'IBICA et la TVA. Simplifié pour les CA < 15M.',
    'RSI': 'Régime Simplifié d\'Imposition (RSI) - Assujetti à l\'IS et à la TVA. CA 15M - 50M.',
    'RNI': 'Régime Réel Normal d\'Imposition (RNI) - Comptabilité complète, IS et TVA. CA > 50M.',
    'UNKNOWN': 'Régime non défini'
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-gold-500" />
            Calendrier Fiscal
          </h1>
          <p className="text-zinc-400 font-sans max-w-2xl">
            Suivi intelligent de vos échéances fiscales, déclarations et provisions recommandées, calibré sur votre régime d'imposition du Burkina Faso.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-luxury-800/80 px-4 py-2 border border-blue-500/20 rounded-xl relative group">
           <ShieldCheck className="w-5 h-5 text-blue-400" />
           <div className="text-sm font-medium">
             <span className="text-zinc-400">Régime Actif: </span>
             <span className="text-blue-400 font-bold ml-1">{company?.taxRegime || 'CME'}</span>
           </div>
           
           <div className="absolute top-12 right-0 w-64 p-3 bg-luxury-900 border border-border-subtle rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-xs text-zinc-300">
             {RegimenDetails[(company?.taxRegime as keyof typeof RegimenDetails) || 'UNKNOWN']}
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main Content - Deadlines */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Urgent & Upcoming */}
          <div>
            <h2 className="text-xl font-serif text-gold-100 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold-500" /> Échéances à venir (90j)
            </h2>
            <div className="space-y-4">
              {activeDeadlines.length === 0 ? (
                 <div className="text-center py-12 px-6 rounded-2xl border border-dashed border-border-subtle bg-luxury-800/20 text-zinc-500">
                   <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                   <p>Aucune échéance prévue dans les prochains mois.</p>
                 </div>
              ) : (
                activeDeadlines.map((deadline, index) => (
                  <motion.div 
                    key={`${deadline.id}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 group shadow-lg relative overflow-hidden",
                      deadline.status === 'urgent' 
                        ? 'bg-red-500/5 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.05)]' 
                        : 'bg-luxury-800/40 border-border-subtle hover:border-gold-500/30'
                    )}
                  >
                    {deadline.status === 'urgent' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}

                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                        deadline.status === 'urgent' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        deadline.category === 'TVA' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        deadline.category === 'IS' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-gold-500/10 text-gold-500 border-gold-500/20'
                      )}>
                        {deadline.status === 'urgent' ? <AlertCircle className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-lg font-bold text-text-title">{deadline.title}</h3>
                          {deadline.status === 'urgent' && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                              Urgent (J-{deadline.diffDays})
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-luxury-900 border border-border-subtle text-zinc-400">
                            {deadline.category}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-2 max-w-lg leading-relaxed">{deadline.description}</p>
                        <div className={cn("inline-flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-md", deadline.status === 'urgent' ? "bg-red-500/10 text-red-400" : "bg-gold-500/10 text-gold-400")}>
                          <Clock className="w-3.5 h-3.5" />
                          <span className="capitalize">{formatDate(deadline.date)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleMarkAsDone(deadline.id)}
                      className="shrink-0 flex items-center gap-2 px-4 py-2 mt-4 md:mt-0 rounded-xl text-sm font-semibold transition-all duration-300 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Traiter
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Past Missed Deadlines */}
          {pastDeadlines.length > 0 && (
            <div className="pt-8">
              <h2 className="text-lg font-serif text-zinc-500 mb-4 flex items-center gap-2 opacity-80">
                <AlertCircle className="w-4 h-4" /> Échéances passées non traitées
              </h2>
              <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                {pastDeadlines.map((deadline, index) => (
                  <div key={`${deadline.id}-past`} className="p-4 rounded-xl border border-red-500/20 bg-luxury-900/50 flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-400/80 mb-0.5 line-through">{deadline.title}</p>
                          <p className="text-xs text-zinc-500 font-mono">Date passée : {deadline.date.toLocaleDateString('fr-FR')}</p>
                        </div>
                     </div>
                     <button onClick={() => handleMarkAsDone(deadline.id)} className="text-xs px-3 py-1.5 rounded-lg bg-luxury-800 text-zinc-400 hover:text-text-title border border-border-subtle transition-colors shrink-0">
                       Régulariser
                     </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Provision & Stats */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="p-6 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-luxury-800 to-luxury-700 border border-gold-500/20 shadow-[0_0_30px_rgba(212,175,55,0.05)] sticky top-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-serif text-gold-100">Provision d'Impôts</h2>
                <p className="text-xs text-gold-500/60">Estimation sur l'exercice en cours</p>
              </div>
            </div>

            <div className="space-y-6">
               <div className="text-center p-4 bg-black/40 rounded-xl border border-black/50 shadow-inner">
                 <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Total Estimé Annuel</div>
                 <div className="text-3xl font-bold text-text-title tracking-tight">{formatXOF(totalProvision)}</div>
               </div>

               <div className="space-y-3">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-zinc-400 flex items-center gap-1">
                     <HelpCircle 
                       className="w-3.5 h-3.5 cursor-pointer hover:text-text-title transition-colors" 
                       onMouseEnter={() => setShowTooltip('tva')} 
                       onMouseLeave={() => setShowTooltip(null)} 
                     />
                     TVA {showTooltip === 'tva' && <span className="absolute left-0 -translate-x-full ml-[-10px] w-48 text-[10px] bg-black p-2 rounded z-50">Taxe sur la Valeur Ajoutée (18%) calculée sur la marge (Ventes HT - Achats HT). Applicable uniquement (RSI/RNI).</span>}
                   </span>
                   <span className="font-mono text-gold-100">{formatXOF(taxData?.tvaAmount || 0)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm relative">
                   <span className="text-zinc-400 flex items-center gap-1">
                     <HelpCircle 
                       className="w-3.5 h-3.5 cursor-pointer hover:text-text-title transition-colors" 
                       onMouseEnter={() => setShowTooltip('is')} 
                       onMouseLeave={() => setShowTooltip(null)} 
                     />
                     IR / IS {showTooltip === 'is' && <span className="absolute left-0 -translate-x-full ml-[-10px] w-48 text-[10px] bg-black p-2 rounded z-50">Impôt sur les Sociétés (27.5% du bénéfice) OU Minimum Forfaitaire (0.5% du CA). Applicable RSI/RNI.</span>}
                   </span>
                   <span className="font-mono text-gold-100">{formatXOF(taxData?.isAmount || 0)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm relative">
                   <span className="text-zinc-400 flex items-center gap-1">
                     <HelpCircle 
                       className="w-3.5 h-3.5 cursor-pointer hover:text-text-title transition-colors" 
                       onMouseEnter={() => setShowTooltip('cme')} 
                       onMouseLeave={() => setShowTooltip(null)} 
                     />
                     CME {showTooltip === 'cme' && <span className="absolute left-0 -translate-x-full ml-[-10px] w-48 text-[10px] bg-black p-2 rounded z-50">Contribution Micro-Entreprise (remplace TVA/IS). 2% pour commerce, 5% pour prestation de service.</span>}
                   </span>
                   <span className="font-mono text-gold-100">{formatXOF(taxData?.cmeAmount || 0)}</span>
                 </div>
               </div>

               <div className="pt-4 border-t border-border-subtle">
                 <div className="bg-money-500/10 border border-money-500/20 rounded-xl p-4 glow-green">
                   <div className="text-[10px] text-money-500 uppercase tracking-wider font-bold mb-1">Épargne Recommandée (Mensuel)</div>
                   <div className="flex items-end justify-between">
                     <span className="text-2xl font-bold text-money-400 tracking-tight">{formatXOF(totalProvision / 12)}</span>
                     <span className="text-xs text-money-500/50 font-medium mb-1">/ mois</span>
                   </div>
                   <p className="text-[10px] text-money-500/70 mt-2 leading-tight">Mettez de côté ce montant chaque mois cette année pour éviter les surprises lors du règlement fiscal global.</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle">
             <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-sm text-gold-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gold-500" /> Stats de l'année ({new Date().getFullYear()})
                </h3>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">CA Hors Taxe</div>
                   <div className="text-sm font-bold text-text-title">{formatXOF(ytdData.revenue)}</div>
                </div>
                <div>
                   <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Charges HT</div>
                   <div className="text-sm font-bold text-text-title">{formatXOF(ytdData.expenses)}</div>
                </div>
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}

