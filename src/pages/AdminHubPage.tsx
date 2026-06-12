import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc, writeBatch, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bot, User, UserCircle, Clock, ShieldAlert, Trash2, Play, Table, ChevronRight, Building2, Receipt, MessageCircle, ArrowLeft, Search, Mail, ExternalLink, Activity } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { calculateTaxes, determineTaxRegime, TaxRegime } from '../lib/tax-rules';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserData {
  profile: any;
  transactions: any[];
  conversations: any[];
  lastActivity: string;
}

export function AdminHubPage() {
  const [usersMap, setUsersMap] = useState<Record<string, UserData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const adminEmail = 'ulrichtapsoba2009@gmail.com';

  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.email !== adminEmail) return;

    // We fetch everything to build the unified view
    const fetchData = async () => {
      setLoading(true);
      try {
        const [companiesSnap, transactionsSnap, conversationsSnap] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'transactions')),
          getDocs(query(collection(db, 'conversations'), orderBy('updatedAt', 'desc')))
        ]);

        const newMap: Record<string, UserData> = {};

        companiesSnap.forEach(d => {
          const data = d.data();
          newMap[d.id] = {
            profile: { id: d.id, ...data },
            transactions: [],
            conversations: [],
            lastActivity: new Date(0).toISOString()
          };
        });

        transactionsSnap.forEach(d => {
          const data = d.data();
          if (newMap[data.userId]) {
            newMap[data.userId].transactions.push({ id: d.id, ...data });
          }
        });

        conversationsSnap.forEach(d => {
          const data = d.data();
          if (newMap[data.userId]) {
            newMap[data.userId].conversations.push({ id: d.id, ...data });
            if (data.updatedAt > newMap[data.userId].lastActivity) {
              newMap[data.userId].lastActivity = data.updatedAt;
            }
          }
        });

        setUsersMap(newMap);
      } catch (err) {
        console.error("Fetch admin data failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up listeners for real-time updates if needed (optional for admin panel frequency)
    // For now we stick to manual refresh or periodic re-fetch for performance with large data
  }, []);

  const runTests = () => {
    const testCases = [
      { name: "Micro-Entreprise (Services)", revenue: 10_000_000, expenses: 2_000_000, isService: true, expectedRegime: 'CME' },
      { name: "Régime Simplifié (RSI)", revenue: 30_000_000, expenses: 10_000_000, isService: true, expectedRegime: 'RSI' },
      { name: "Régime Normal (RNI)", revenue: 100_000_000, expenses: 40_000_000, isService: false, expectedRegime: 'RNI' },
    ];
    const results = testCases.map(tc => {
      const regime = determineTaxRegime(tc.revenue);
      const calc = calculateTaxes(tc.revenue, tc.expenses, regime, tc.isService);
      return { ...tc, regime, calc, passed: regime === tc.expectedRegime };
    });
    setTestResults(results);
  };

  const resetAllData = async () => {
    if (!window.confirm("CRITIQUE: Voulez-vous vraiment supprimer TOUTES les données de tous les utilisateurs ?")) return;
    setIsResetting(true);
    try {
      const collections = ['companies', 'transactions', 'conversations', 'simulations', 'bug_reports'];
      for (const collName of collections) {
        const q = query(collection(db, collName));
        const snapshot = await getDocs(q);
        
        // Batch size limit is 500, but for beta tests we assume it's small or we do it sequentially
        const batch = writeBatch(db);
        snapshot.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      alert("Toutes les données ont été réinitialisées.");
      window.location.reload();
    } catch (error: any) {
      console.error("Reset failed", error);
      alert("Erreur: " + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  if (!auth.currentUser || auth.currentUser.email !== adminEmail) {
    return <Navigate to="/dashboard" />;
  }

  const users = Object.values(usersMap).filter(u => 
    u.profile.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.profile.ifu?.includes(searchTerm)
  ).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  const selectedUser = selectedUserId ? usersMap[selectedUserId] : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto text-gold-100 min-h-screen">
      <AnimatePresence mode="wait">
        {!selectedUserId ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
              <div>
                <h1 className="text-3xl font-serif text-gold-100">Supervision des Utilisateurs</h1>
                <p className="text-zinc-500 text-sm mt-1">Gérez et analysez l'activité des entreprises en temps réel.</p>
              </div>
              
              <div className="flex gap-3">
                <button onClick={resetAllData} className="px-4 py-2 border border-red-500/30 text-red-500 rounded-xl hover:bg-red-500/10 transition-colors text-sm font-medium flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> Réinitialisation Beta
                </button>
                <button onClick={runTests} className="px-4 py-2 bg-gold-500 text-zinc-900 rounded-xl hover:bg-gold-400 transition-colors text-sm font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4" /> Tests Auto
                </button>
              </div>
            </div>

            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Rechercher une entreprise ou un IFU..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-luxury-900/50 border border-border-subtle rounded-2xl py-4 pl-12 pr-6 text-gold-100 focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20 transition-all outline-none shadow-inner" 
              />
            </div>

            {/* Test Results Section */}
            <AnimatePresence>
              {testResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-gold-500 uppercase tracking-widest flex items-center gap-2">
                      <Table className="w-4 h-4" /> Résultats des Tests Unitaires
                    </h3>
                    <button onClick={() => setTestResults([])} className="text-xs text-zinc-500 hover:text-gold-500 transition-colors">Masquer</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {testResults.map((res, i) => (
                      <div key={i} className={cn(
                        "p-3 rounded-xl border flex flex-col gap-1",
                        res.passed ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                      )}>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-medium text-zinc-500">{res.name}</span>
                          <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded uppercase", res.passed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-500")}>
                            {res.passed ? 'Succès' : 'Échec'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-gold-100">Regime: {res.regime}</p>
                        <p className="text-[10px] text-zinc-400">Net: {Number(res.calc.netIncome).toLocaleString()} F</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map(u => (
                <div 
                  key={u.profile.id}
                  onClick={() => setSelectedUserId(u.profile.id)}
                  className="group relative p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle hover:border-gold-500/30 transition-all cursor-pointer overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-gold-500" />
                  </div>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-border-subtle flex items-center justify-center text-gold-500 group-hover:bg-gold-500 group-hover:text-zinc-900 transition-all duration-300">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg text-gold-100">{u.profile.companyName || 'Sans Nom'}</h3>
                      <p className="text-zinc-500 text-xs font-mono">IFU: {u.profile.ifu || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">Transactions</span>
                      <p className="text-sm font-medium text-gold-500 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" />
                        {u.transactions.length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">Chats</span>
                      <p className="text-sm font-medium text-gold-500 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {u.conversations.length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 flex items-center justify-between text-[10px] text-zinc-500 border-t border-border-subtle">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Actif {u.lastActivity !== new Date(0).toISOString() ? new Date(u.lastActivity).toLocaleDateString() : 'Jamais'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-gold-500/5 border border-border-subtle text-gold-500">
                      {u.profile.taxRegime}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 pb-20"
          >
            <button 
              onClick={() => setSelectedUserId(null)}
              className="flex items-center gap-2 text-gold-500 hover:text-gold-400 transition-colors mb-6 group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              Retour à la liste
            </button>

            {selectedUser && (
              <>
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-6">
                    <div className="p-8 rounded-3xl bg-luxury-800/60 border border-border-subtle backdrop-blur-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8">
                        <Activity className="w-32 h-32 text-gold-500/5 -mr-16 -mt-16" />
                      </div>
                      
                      <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                        <div className="space-y-4">
                          <h2 className="text-3xl font-serif text-gold-100">{selectedUser.profile.companyName}</h2>
                          <div className="flex flex-wrap gap-4">
                            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Mail className="w-3.5 h-3.5" /> {selectedUser.profile.email || 'Email non renseigné'}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Building2 className="w-3.5 h-3.5" /> IFU: {selectedUser.profile.ifu}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <span className="px-4 py-1.5 rounded-full bg-gold-500/10 border border-border-subtle text-gold-500 text-sm font-semibold">
                            {selectedUser.profile.taxRegime}
                          </span>
                          <span className="text-[10px] text-zinc-500 italic">Dernière activité: {new Date(selectedUser.lastActivity).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-10 pt-10 border-t border-border-subtle">
                        <ProfileStat label="Secteur" value={selectedUser.profile.sector || 'N/A'} />
                        <ProfileStat label="CA Estimé" value={`${(selectedUser.profile.estimatedRevenue || 0).toLocaleString()} FCFA`} />
                        <ProfileStat label="Transactions" value={selectedUser.transactions.length} />
                        <ProfileStat label="Conversations" value={selectedUser.conversations.length} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-luxury-800/40 p-6 rounded-2xl border border-border-subtle">
                        <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-gold-500" />
                          Transactions Récentes
                        </h3>
                        <div className="space-y-3">
                          {selectedUser.transactions.slice(0, 10).map(t => (
                            <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-bg-overlay border border-border-subtle">
                              <div>
                                <p className="text-sm font-medium text-gold-100">{t.vendorName || t.category}</p>
                                <p className="text-[10px] text-zinc-500">{new Date(t.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className={cn("text-sm font-semibold", t.type === 'INCOME' ? 'text-money-400' : 'text-zinc-400')}>
                                  {t.type === 'INCOME' ? '+' : '-'}{t.amountInclTax.toLocaleString()} F
                                </p>
                              </div>
                            </div>
                          ))}
                          {selectedUser.transactions.length === 0 && <p className="text-zinc-600 text-xs italic p-4 text-center">Aucune transaction.</p>}
                        </div>
                      </div>

                      <div className="bg-luxury-800/40 p-6 rounded-2xl border border-border-subtle">
                        <h3 className="text-lg font-serif mb-4 flex items-center gap-2">
                          <MessageCircle className="w-5 h-5 text-gold-500" />
                          Historique des Discussions
                        </h3>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {selectedUser.conversations.map(conv => (
                            <details key={conv.id} className="group p-3 rounded-xl bg-bg-overlay border border-border-subtle overflow-hidden transition-all">
                              <summary className="flex justify-between items-center cursor-pointer list-none">
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium text-gold-100 group-open:text-gold-500 transition-colors uppercase tracking-tight">{conv.title || 'Conversation'}</p>
                                  <p className="text-[10px] text-zinc-600">{new Date(conv.updatedAt).toLocaleString()}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-600 group-open:rotate-90 transition-transform" />
                              </summary>
                              <div className="mt-4 pt-4 border-t border-border-subtle space-y-4">
                                {conv.messages?.map((msg: any) => (
                                  <div key={msg.id} className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                                    <span className="text-[9px] uppercase tracking-widest text-zinc-600 px-1">{msg.role === 'user' ? 'Client' : 'Expert NEO'}</span>
                                    <div className={cn(
                                      "p-3 rounded-2xl text-sm max-w-[90%]",
                                      msg.role === 'user' ? "bg-gold-500/10 text-gold-100 border border-border-subtle" : "bg-luxury-900 text-zinc-300 border border-border-subtle"
                                    )}>
                                      {msg.text}
                                    </div>
                                    {msg.actions && (
                                       <div className="flex flex-wrap gap-2 mt-1">
                                         {msg.actions.map((a: any, i: number) => (
                                           <span key={i} className="text-[9px] px-2 py-0.5 rounded-lg bg-money-500/10 border border-money-500/20 text-money-400">
                                             Action: {a.name}
                                           </span>
                                         ))}
                                       </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          ))}
                          {selectedUser.conversations.length === 0 && <p className="text-zinc-600 text-xs italic p-4 text-center">Pas d'historique de chat.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string, value: string | number }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-base font-medium text-gold-100">{value}</p>
    </div>
  );
}
