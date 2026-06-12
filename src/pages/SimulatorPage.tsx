import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { collection, query, where, onSnapshot, doc, addDoc, getDocs, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { calculateTaxes, TaxCalculation, TaxRegime } from '../lib/tax-rules';
import { ExtractedTransaction, sendChatMessage, UserContext } from '../services/nim';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, CartesianGrid, Cell } from 'recharts';
import { Calculator, TrendingUp, TrendingDown, Save, FolderOpen, CheckCircle2, Info, ArrowRight, ShieldCheck, HeartPulse, Trash2, HelpCircle, Activity, Target, BarChart2, PieChart as PieChartIcon, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { ErrorReporter } from '../components/ErrorReporter';

export function SimulatorPage() {
  const [actualRevenue, setActualRevenue] = useState(0);
  const [actualExpenses, setActualExpenses] = useState(0);
  const [actualCompany, setActualCompany] = useState<any>(null);

  const [simRevenue, setSimRevenue] = useState(0);
  const [simExpenses, setSimExpenses] = useState(0);
  const [simRegime, setSimRegime] = useState<TaxRegime>('CME');
  const [simSector, setSimSector] = useState('service');
  const [simName, setSimName] = useState('');
  const [savedSimulations, setSavedSimulations] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const [actualTaxes, setActualTaxes] = useState<TaxCalculation | null>(null);
  const [simTaxes, setSimTaxes] = useState<TaxCalculation | null>(null);

  // Chat AI State
  const [chatPrompt, setChatPrompt] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      // Fetch Company Profile
      const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const comp = docSnap.data();
          setActualCompany(comp);
          setSimRegime(comp.taxRegime as TaxRegime || 'CME');
          setSimSector(comp.sector || 'service');
        }
      });

      // Listen to Transactions
      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid), where('date', '>=', startOfYear));
      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const txs = snapshot.docs.map(doc => doc.data() as ExtractedTransaction);
        const rev = txs.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
        const exp = txs.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + (Number(t.amountExclTax) || 0), 0);
        setActualRevenue(rev);
        setActualExpenses(exp);
        
        // Only set sim initial values once
        setSimRevenue(prev => prev === 0 ? rev : prev);
        setSimExpenses(prev => prev === 0 ? exp : prev);
      });

      return () => {
        unsubscribeCompany();
        unsubscribeSnapshot();
      };
    });
    return () => unsubscribeAuth();
  }, []);

  const fetchSimulations = async () => {
      if (!auth.currentUser) return;
      const q = query(
          collection(db, 'simulations'), 
          where('userId', '==', auth.currentUser.uid),
          orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const sims = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedSimulations(sims);
  };

  useEffect(() => {
    fetchSimulations();
  }, []);

  const saveSimulation = async () => {
    if (!auth.currentUser || !simName.trim()) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'simulations'), {
          userId: auth.currentUser.uid,
          name: simName.trim(),
          revenue: simRevenue,
          expenses: simExpenses,
          regime: simRegime,
          sector: simSector,
          createdAt: serverTimestamp()
      });
      setSimName('');
      await fetchSimulations();
    } catch (e) {
      console.error(e);
    }
    setIsSaving(false);
  };

  const deleteSimulation = async (id: string) => {
     try {
       await deleteDoc(doc(db, 'simulations', id));
       await fetchSimulations();
     } catch(e) {
       console.error("Error deleting simulation", e);
     }
  }

  const loadSimulation = (sim: any) => {
    setSimRevenue(sim.revenue);
    setSimExpenses(sim.expenses);
    setSimRegime(sim.regime);
    setSimSector(sim.sector);
  };

  useEffect(() => {
    if (actualCompany) {
      const isServiceActual = actualCompany.sector?.toLowerCase().includes('service') ?? true;
      setActualTaxes(calculateTaxes(actualRevenue, actualExpenses, actualCompany.taxRegime as TaxRegime || 'CME', isServiceActual));
    }
  }, [actualRevenue, actualExpenses, actualCompany]);

  useEffect(() => {
    const isServiceSim = simSector.toLowerCase().includes('service');
    setSimTaxes(calculateTaxes(simRevenue, simExpenses, simRegime, isServiceSim));
  }, [simRevenue, simExpenses, simRegime, simSector]);

  const handleAiSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim() || !auth.currentUser) return;
    
    setIsSimulating(true);
    setAiExplanation(null);
    try {
      const dbContext: UserContext = {
        revenue: actualRevenue,
        expenses: actualExpenses,
        taxRegime: actualCompany?.taxRegime || 'CME',
        sector: actualCompany?.sector || 'service',
        taxes: actualTaxes
      };

      const handler = async (name: string, args: any) => {
         if (name === 'simulate_scenario') {
            setSimRevenue(args.simRevenue);
            setSimExpenses(args.simExpenses);
            setSimRegime(args.simRegime);
            setSimSector(args.simSector);
            setAiExplanation(args.explanation);
            return { status: "Scenario applied successfully" };
         }
         return { status: "Tool ignored" };
      };

      const response = await sendChatMessage([], chatPrompt, undefined, undefined, dbContext, handler);
      if (response && response.actions.length === 0 && response.text) {
         setAiExplanation(response.text);
      }
      
    } catch(err) {
      console.error(err);
      ErrorReporter.report("Impossible de générer le scénario prédictif.");
    } finally {
      setIsSimulating(false);
      setChatPrompt('');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val);

  const actualTotalTax = (actualTaxes?.cmeAmount || 0) + (actualTaxes?.isAmount || 0) + (actualTaxes?.tvaAmount || 0);
  const simTotalTax = (simTaxes?.cmeAmount || 0) + (simTaxes?.isAmount || 0) + (simTaxes?.tvaAmount || 0);
  const taxDifference = simTotalTax - actualTotalTax;
  
  const netIncomeDiff = (simTaxes?.netIncome || 0) - (actualTaxes?.netIncome || 0);

  const chartData = [
    {
      name: 'Actuel',
      'Résultat Net': actualTaxes?.netIncome || 0,
      'Total Impôts': actualTotalTax,
    },
    {
      name: 'Simulation',
      'Résultat Net': simTaxes?.netIncome || 0,
      'Total Impôts': simTotalTax,
    }
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-gold-500" />
            Simulateur d'Optimisation Fiscale
          </h1>
          <p className="text-zinc-400 font-sans max-w-2xl">
            Testez la projection de votre activité, modélisez différents régimes d'imposition et trouvez la configuration fiscale optimale pour votre chiffre d'affaires.
          </p>
        </div>
      </header>

      {/* AI Assistant Block */}
      <div className="bg-gradient-to-r from-luxury-800 to-luxury-900 border border-gold-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-32 h-32 text-gold-500" />
        </div>
        <div className="relative z-10">
           <h2 className="text-lg font-serif text-gold-100 mb-2 flex items-center gap-2">
             <MessageSquare className="w-5 h-5 text-gold-500" /> Scénario Prédictif (IA)
           </h2>
           <p className="text-sm text-zinc-400 mb-6 max-w-3xl">Demandez à Neo d'extrapoler l'impact d'une décision d'affaires sur votre trésorerie et vos impôts. Ex: "Et si j'embauche un salarié net 40k le mois prochain ?" ou "Si mes ventes doublent à la fin de l'année, quelle sera ma TVA ?"</p>
           
           <form onSubmit={handleAiSimulate} className="flex gap-3 max-w-3xl">
             <input 
               type="text" 
               disabled={isSimulating}
               value={chatPrompt}
               onChange={e => setChatPrompt(e.target.value)}
               placeholder="Testez un scénario (ex: ajouter 300 000 FCFA de charges)..."
               className="flex-1 bg-luxury-950 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-title placeholder-zinc-500 focus:outline-none focus:border-gold-500/50"
             />
             <button disabled={isSimulating || !chatPrompt.trim()} type="submit" className="bg-gold-500 text-zinc-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gold-400 disabled:opacity-50 transition-colors">
                {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Prédire'}
             </button>
           </form>

           {aiExplanation && (
             <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="mt-6 p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl text-gold-100 text-sm leading-relaxed max-w-3xl">
                <span className="font-bold flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4" /> Analyse de Neo :</span>
                <div className="markdown-body prose prose-invert max-w-none">
                  <Markdown>{aiExplanation}</Markdown>
                </div>
             </motion.div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Controls Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-3xl bg-luxury-800/40 border border-border-subtle shadow-xl relative overflow-hidden">
             
            <div className="flex items-center gap-2 mb-6 text-gold-100 font-serif text-lg">
              <Calculator className="w-5 h-5 text-gold-500" />
              Paramètres de Simulation
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Chiffre d'Affaires Actuel</label>
                  <span className="text-xs font-mono text-zinc-500">{formatCurrency(actualRevenue)}</span>
                </div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Chiffre d'Affaires Simulé (HT)</label>
                <input 
                  type="number" 
                  value={simRevenue || ''}
                  onChange={(e) => setSimRevenue(Number(e.target.value))}
                  className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-lg font-bold text-text-title focus:outline-none focus:border-gold-500/50 transition-all font-mono"
                  placeholder="0"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Charges Actuelles</label>
                  <span className="text-xs font-mono text-zinc-500">{formatCurrency(actualExpenses)}</span>
                </div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Charges Simulées (HT)</label>
                <input 
                  type="number" 
                  value={simExpenses || ''}
                  onChange={(e) => setSimExpenses(Number(e.target.value))}
                  className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-lg font-bold text-text-title focus:outline-none focus:border-gold-500/50 transition-all font-mono"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Régime Simulé</label>
                  <select 
                    value={simRegime}
                    onChange={(e) => setSimRegime(e.target.value as TaxRegime)}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 font-bold focus:outline-none focus:border-gold-500/50 transition-all outline-none appearance-none"
                  >
                    <option value="CME">CME (Micro)</option>
                    <option value="RSI">RSI (Simplifié)</option>
                    <option value="RNI">RNI (Normal)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Secteur</label>
                  <select 
                    value={simSector}
                    onChange={(e) => setSimSector(e.target.value)}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gold-100 font-bold focus:outline-none focus:border-gold-500/50 transition-all outline-none appearance-none"
                  >
                    <option value="service">Services</option>
                    <option value="commerce">Commerce</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border-subtle">
              <div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Nommez cette simulation..." 
                  value={simName} 
                  onChange={e => setSimName(e.target.value)} 
                  className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-title placeholder:text-zinc-600 focus:outline-none focus:border-gold-500/50" 
                />
                <button 
                  onClick={saveSimulation} 
                  disabled={!simName.trim() || isSaving}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:from-gold-400 hover:to-gold-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" /> 
                  {isSaving ? 'Enregistrement...' : 'Enregistrer cette hypothèse'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-luxury-800/40 border border-border-subtle shadow-xl">
            <h2 className="text-lg font-serif text-gold-100 mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-gold-500"/> Scénarios Sauvegardés
            </h2>
            
            {savedSimulations.length === 0 ? (
               <div className="text-center py-6 text-zinc-500 text-sm border border-dashed border-border-subtle rounded-xl bg-luxury-900/50">
                 Aucune simulation enregistrée.
               </div>
            ) : (
               <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {savedSimulations.map((sim: any) => (
                      <div key={sim.id} className="group flex flex-col p-3 rounded-xl bg-luxury-900 border border-border-subtle hover:border-gold-500/30 transition-all whitespace-nowrap overflow-hidden text-ellipsis">
                          <div className="flex items-center justify-between mb-2">
                             <span className="text-sm font-bold text-text-title truncate max-w-[150px]" title={sim.name}>{sim.name}</span>
                             <div className="flex gap-2">
                               <button onClick={() => loadSimulation(sim)} className="text-xs px-2 py-1 bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 rounded-md transition-colors font-medium">Charger</button>
                               <button onClick={() => deleteSimulation(sim.id)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                             </div>
                          </div>
                          <div className="flex text-[10px] text-zinc-500 font-mono gap-2 justify-between">
                            <span>CA: {formatCurrency(sim.revenue)}</span>
                            <span>{new Date(sim.createdAt.toDate()).toLocaleDateString('fr-FR')}</span>
                          </div>
                      </div>
                  ))}
               </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 md:p-8 rounded-[2rem] bg-gradient-to-br from-luxury-800 to-luxury-900 border border-border-subtle shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Calculator className="w-48 h-48 text-gold-500" />
               </div>
               <div className="relative z-10 flex flex-col h-full justify-between">
                 <div>
                   <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                     <ShieldCheck className="w-4 h-4" /> Impôts & Taxes (Simulé)
                   </h3>
                   <div className="text-4xl md:text-5xl font-bold text-text-title tracking-tight mb-2 font-mono">
                     {formatCurrency(simTotalTax)}
                   </div>
                 </div>
                 
                 <div className="mt-6">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border",
                      taxDifference > 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                      taxDifference < 0 ? "bg-money-500/10 text-money-500 border-money-500/20 glow-green" : 
                      "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    )}>
                      {taxDifference > 0 ? <TrendingDown className="w-4 h-4" /> : taxDifference < 0 ? <TrendingUp className="w-4 h-4" /> : null}
                      {taxDifference > 0 ? '+' : ''}{formatCurrency(taxDifference)} (vs. Actuel)
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 font-medium">L'impact attendu sur vos charges fiscales globales.</p>
                 </div>
               </div>
            </div>
            
            <div className="p-6 md:p-8 rounded-[2rem] bg-gradient-to-br from-luxury-800 to-luxury-900 border border-border-subtle shadow-2xl relative overflow-hidden flex flex-col justify-between">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Activity className="w-48 h-48 text-money-500" />
               </div>
               <div className="relative z-10">
                 <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                   <Target className="w-4 h-4" /> Résultat Net Simulé
                 </h3>
                 <div className="text-4xl md:text-5xl font-bold text-money-400 tracking-tight mb-2 font-mono glow-green">
                   {formatCurrency(simTaxes?.netIncome || 0)}
                 </div>
                 
                 <div className="mt-6">
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border",
                      netIncomeDiff < 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                      netIncomeDiff > 0 ? "bg-money-500/10 text-money-500 border-money-500/20 glow-green" : 
                      "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    )}>
                      {netIncomeDiff > 0 ? <TrendingUp className="w-4 h-4" /> : netIncomeDiff < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                      {netIncomeDiff > 0 ? '+' : ''}{formatCurrency(netIncomeDiff)} (vs. Actuel)
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 font-medium">Bénéfice estimé dans la poche après paiement des impôts.</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="p-6 rounded-3xl bg-luxury-800/40 border border-border-subtle shadow-xl">
              <h3 className="text-lg font-serif text-gold-100 mb-6 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-gold-500" /> Visualisation</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} width={40} />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }}
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#a1a1aa' }} iconType="circle" />
                    <Bar dataKey="Résultat Net" radius={[6, 6, 0, 0]} maxBarSize={50}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-net-${index}`} fill={index === 1 && netIncomeDiff > 0 ? '#10b981' : index === 1 && netIncomeDiff < 0 ? '#ef4444' : '#d4af37'} opacity={index === 0 ? 0.6 : 1} />
                       ))}
                    </Bar>
                    <Bar dataKey="Total Impôts" radius={[6, 6, 0, 0]} maxBarSize={50}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-tax-${index}`} fill="#3f3f46" opacity={index === 0 ? 0.6 : 1} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-luxury-800/40 border border-border-subtle shadow-xl flex flex-col">
              <h3 className="text-lg font-serif text-gold-100 mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-gold-500"/> Décomposition des Charges</h3>
              
              <div className="space-y-4 flex-1">
                {simTaxes?.regime === 'CME' && (
                  <div className="p-4 rounded-xl bg-luxury-900 border border-border-subtle relative overflow-hidden group hover:border-gold-500/50 transition-colors">
                     <div className="flex justify-between items-center mb-1">
                       <span className="text-sm font-bold text-text-title flex items-center gap-1.5 hover:text-gold-400 cursor-help" onMouseEnter={() => setShowTooltip('cme')} onMouseLeave={() => setShowTooltip(null)}>
                         CME <HelpCircle className="w-3 h-3 text-zinc-500" />
                       </span>
                       <span className="font-mono text-gold-400 font-bold">{formatCurrency(simTaxes.cmeAmount)}</span>
                     </div>
                     <p className="text-[10px] text-zinc-500">Contribution des Micro-Entreprises ({simSector === 'service' ? '5%' : '2%'} du CA)</p>
                     
                     <AnimatePresence>
                       {showTooltip === 'cme' && (
                         <motion.div initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 5}} className="absolute inset-0 bg-luxury-800/95 backdrop-blur-sm p-4 flex items-center justify-center text-[10px] text-zinc-300 z-10 text-center border border-gold-500/30 rounded-xl leading-snug">
                           La CME libère de l'obligation de payer les autres impôts sur le revenu (IS) et les taxes sur le chiffre d'affaires (TVA) et certaines taxes patronales.
                         </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
                )}
                
                {(simTaxes?.regime === 'RSI' || simTaxes?.regime === 'RNI') && (
                  <>
                    <div className="p-4 rounded-xl bg-luxury-900 border border-border-subtle relative overflow-hidden group hover:border-gold-500/50 transition-colors">
                       <div className="flex justify-between items-center mb-1">
                         <span className="text-sm font-bold text-text-title flex items-center gap-1.5 hover:text-gold-400 cursor-help" onMouseEnter={() => setShowTooltip('tva')} onMouseLeave={() => setShowTooltip(null)}>
                           TVA Nette <HelpCircle className="w-3 h-3 text-zinc-500" />
                         </span>
                         <span className="font-mono text-gold-400 font-bold">{formatCurrency(simTaxes.tvaAmount)}</span>
                       </div>
                       <p className="text-[10px] text-zinc-500">TVA à décaisser (18% de la marge HT)</p>
                       
                       <AnimatePresence>
                         {showTooltip === 'tva' && (
                           <motion.div initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 5}} className="absolute inset-0 bg-luxury-800/95 backdrop-blur-sm p-4 flex items-center justify-center text-[10px] text-zinc-300 z-10 text-center border border-gold-500/30 rounded-xl leading-snug">
                             Taxe sur la Valeur Ajoutée. C'est un impôt indirect sur la consommation. Le montant ici est une estimation calculée sur votre marge (Ventes HT - Achats HT).
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>

                    <div className="p-4 rounded-xl bg-luxury-900 border border-border-subtle relative overflow-hidden group hover:border-gold-500/50 transition-colors">
                       <div className="flex justify-between items-center mb-1">
                         <span className="text-sm font-bold text-text-title flex items-center gap-1.5 hover:text-gold-400 cursor-help" onMouseEnter={() => setShowTooltip('is')} onMouseLeave={() => setShowTooltip(null)}>
                           IS / Minimum <HelpCircle className="w-3 h-3 text-zinc-500" />
                         </span>
                         <span className="font-mono text-gold-400 font-bold">{formatCurrency(simTaxes.isAmount)}</span>
                       </div>
                       <p className="text-[10px] text-zinc-500">Impôt sur les Sociétés (27.5% du bénéfice) ou Minimum Forfaitaire (0.5% du CA)</p>
                       
                       <AnimatePresence>
                         {showTooltip === 'is' && (
                           <motion.div initial={{opacity: 0, y: 5}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: 5}} className="absolute inset-0 bg-luxury-800/95 backdrop-blur-sm p-4 flex items-center justify-center text-[10px] text-zinc-300 z-10 text-center border border-gold-500/30 rounded-xl leading-snug">
                             Impôt direct annuel. Si votre entreprise est en perte, vous paierez le Minimum Forfaitaire (0.5% du CA) au lieu de l'IS classique.
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
