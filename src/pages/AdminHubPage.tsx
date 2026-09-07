import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, deleteDoc, doc, writeBatch, where, updateDoc, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Bot, User, UserCircle, Clock, ShieldAlert, Trash2, Play, Table, ChevronRight, Building2, Receipt, MessageCircle, ArrowLeft, Search, Mail, ExternalLink, Activity, Bug, Lightbulb, HelpCircle, Sparkles, FlaskConical, Filter, CheckCircle2, Eye, Archive, Trash, Inbox, CalendarDays } from 'lucide-react';
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

type Feedback = {
  id: string;
  userId: string;
  userEmail?: string | null;
  companyName?: string | null;
  message: string;
  category: 'bug' | 'idea' | 'question' | 'other';
  page: string;
  url?: string;
  userAgent?: string | null;
  viewport?: string | null;
  isBeta?: boolean;
  status: 'new' | 'reviewed' | 'resolved' | 'archived';
  createdAt?: any;
  createdAtClient?: string;
  adminNote?: string;
  priority?: string;
  resolvedAt?: any;
};

export function AdminHubPage() {
  const [usersMap, setUsersMap] = useState<Record<string, UserData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');
  
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const adminEmail = 'ulrichtapsoba2009@gmail.com';

  // Feedback hub state
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [fbSearch, setFbSearch] = useState('');
  const [fbStatus, setFbStatus] = useState<'all' | Feedback['status']>('all');
  const [fbCategory, setFbCategory] = useState<'all' | Feedback['category']>('all');
  const [fbBeta, setFbBeta] = useState<'all' | 'beta' | 'normal'>('all');
  const [expandedFb, setExpandedFb] = useState<string | null>(null);

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

  // Feedback realtime listener — organised store for admin
  useEffect(() => {
    if (!auth.currentUser || auth.currentUser.email !== adminEmail) return;
    setFeedbackLoading(true);
    // Try ordered by serverTimestamp; fallback to client timestamp if missing
    const q = query(collection(db, 'bug_reports'), orderBy('createdAt', 'desc'), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      const items: Feedback[] = snap.docs.map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          userId: data.userId,
          userEmail: data.userEmail || null,
          companyName: data.companyName || null,
          message: data.message,
          category: (data.category as any) || 'other',
          page: data.page || '/',
          url: data.url || null,
          userAgent: data.userAgent || null,
          viewport: data.viewport || null,
          isBeta: !!data.isBeta,
          status: (data.status as any) || 'new',
          createdAt: data.createdAt,
          createdAtClient: data.createdAtClient || null,
          adminNote: data.adminNote || null,
          priority: data.priority || null,
        };
      });
      setFeedbacks(items);
      setFeedbackLoading(false);
    }, (err) => {
      console.error('Feedback listener failed', err);
      // fallback to getDocs without orderBy
      getDocs(collection(db, 'bug_reports')).then(snap => {
        const items: Feedback[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        // sort by client time desc
        items.sort((a: any, b: any) => (b.createdAtClient || '').localeCompare(a.createdAtClient || ''));
        setFeedbacks(items as any);
        setFeedbackLoading(false);
      });
    });
    return () => unsub();
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

  // —— Feedback helpers —— //
  const formatFbDate = (fb: Feedback) => {
    const ts: any = fb.createdAt;
    let d: Date | null = null;
    if (ts?.toDate) d = ts.toDate();
    else if (ts?.seconds) d = new Date(ts.seconds * 1000);
    else if (fb.createdAtClient) d = new Date(fb.createdAtClient);
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const getCategoryMeta = (c: Feedback['category']) => {
    switch (c) {
      case 'bug': return { label: 'Bug', icon: Bug, cls: 'bg-red-500/10 text-red-300 border-red-500/20' };
      case 'idea': return { label: 'Idée', icon: Lightbulb, cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
      case 'question': return { label: 'Question', icon: HelpCircle, cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20' };
      default: return { label: 'Autre', icon: Sparkles, cls: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20' };
    }
  };
  const getStatusMeta = (s: Feedback['status']) => {
    switch (s) {
      case 'new': return { label: 'Nouveau', cls: 'bg-red-500/15 text-red-300 border-red-500/25' };
      case 'reviewed': return { label: 'En cours', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
      case 'resolved': return { label: 'Résolu', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
      case 'archived': return { label: 'Archivé', cls: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30' };
      default: return { label: s, cls: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30' };
    }
  };
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(fb => {
      if (fbStatus !== 'all' && fb.status !== fbStatus) return false;
      if (fbCategory !== 'all' && fb.category !== fbCategory) return false;
      if (fbBeta === 'beta' && !fb.isBeta) return false;
      if (fbBeta === 'normal' && fb.isBeta) return false;
      if (fbSearch.trim()) {
        const q = fbSearch.toLowerCase();
        const hay = `${fb.message} ${fb.companyName || ''} ${fb.userEmail || ''} ${fb.page} ${fb.userId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [feedbacks, fbStatus, fbCategory, fbBeta, fbSearch]);

  const fbStats = useMemo(() => {
    const total = feedbacks.length;
    const newC = feedbacks.filter(f => f.status === 'new').length;
    const reviewed = feedbacks.filter(f => f.status === 'reviewed').length;
    const resolved = feedbacks.filter(f => f.status === 'resolved').length;
    const beta = feedbacks.filter(f => f.isBeta).length;
    const bugs = feedbacks.filter(f => f.category === 'bug').length;
    return { total, newC, reviewed, resolved, beta, bugs };
  }, [feedbacks]);

  const updateFeedbackStatus = async (id: string, status: Feedback['status']) => {
    try {
      await updateDoc(doc(db, 'bug_reports', id), { status, ...(status === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}) });
    } catch (e) { console.error('update status failed', e); alert('Erreur mise à jour statut'); }
  };
  const deleteFeedback = async (id: string) => {
    if (!confirm('Supprimer ce retour définitivement ?')) return;
    try { await deleteDoc(doc(db, 'bug_reports', id)); } catch (e) { console.error(e); alert('Suppression échouée'); }
  };

  const users = Object.values(usersMap).filter(u => 
    u.profile.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.profile.ifu?.includes(searchTerm)
  ).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  const selectedUser = selectedUserId ? usersMap[selectedUserId] : null;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto text-gold-100 min-h-screen">
      {/* Admin tabs */}
      <div className="flex items-center gap-2 mb-8 p-1.5 rounded-2xl bg-luxury-900/60 border border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-gold-500 text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          <Building2 className="w-4 h-4" /> Utilisateurs <span className="ml-1 px-1.5 py-0.5 rounded bg-black/10 text-xs">{Object.keys(usersMap).length}</span>
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'feedback' ? 'bg-white text-zinc-900 shadow' : 'text-zinc-400 hover:text-white'}`}
        >
          <Inbox className="w-4 h-4" /> Retours & Bugs
          {fbStats.newC > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-black">{fbStats.newC}</span>}
          <span className="px-1.5 py-0.5 rounded bg-black/10 text-xs">{fbStats.total}</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'feedback' ? (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-luxury-800/40 border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">Total retours</p>
                <p className="text-2xl font-bold text-white mt-1">{fbStats.total}</p>
              </div>
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                <p className="text-[10px] uppercase tracking-widest text-red-400">Nouveaux</p>
                <p className="text-2xl font-bold text-red-300 mt-1">{fbStats.newC}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] uppercase tracking-widest text-amber-400">En cours</p>
                <p className="text-2xl font-bold text-amber-300 mt-1">{fbStats.reviewed}</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] uppercase tracking-widest text-emerald-400">Résolus</p>
                <p className="text-2xl font-bold text-emerald-300 mt-1">{fbStats.resolved}</p>
              </div>
              <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20">
                <p className="text-[10px] uppercase tracking-widest text-sky-400">Bêta-testeurs</p>
                <p className="text-2xl font-bold text-sky-300 mt-1 flex items-center gap-1.5"><FlaskConical className="w-4 h-4" /> {fbStats.beta}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 rounded-2xl bg-luxury-800/40 border border-white/5 space-y-3">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    value={fbSearch}
                    onChange={e => setFbSearch(e.target.value)}
                    placeholder="Rechercher message, entreprise, email, page, userId..."
                    className="w-full bg-black/30 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={fbStatus} onChange={e => setFbStatus(e.target.value as any)} className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/5 text-sm text-zinc-200">
                    <option value="all">Tous statuts</option>
                    <option value="new">Nouveau</option>
                    <option value="reviewed">En cours</option>
                    <option value="resolved">Résolu</option>
                    <option value="archived">Archivé</option>
                  </select>
                  <select value={fbCategory} onChange={e => setFbCategory(e.target.value as any)} className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/5 text-sm text-zinc-200">
                    <option value="all">Toutes catégories</option>
                    <option value="bug">Bug</option>
                    <option value="idea">Idée</option>
                    <option value="question">Question</option>
                    <option value="other">Autre</option>
                  </select>
                  <select value={fbBeta} onChange={e => setFbBeta(e.target.value as any)} className="px-3 py-2.5 rounded-xl bg-black/30 border border-white/5 text-sm text-zinc-200">
                    <option value="all">Tous testeurs</option>
                    <option value="beta">Bêta uniquement</option>
                    <option value="normal">Normaux</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                {feedbackLoading ? 'Chargement…' : `${filteredFeedbacks.length} retour(s) affiché(s) sur ${feedbacks.length} • Temps réel • Tri du plus récent au plus ancien`}
              </p>
            </div>

            {/* Feedback list — organised */}
            <div className="space-y-3">
              {filteredFeedbacks.length === 0 && !feedbackLoading && (
                <div className="p-12 text-center rounded-2xl bg-luxury-800/20 border border-dashed border-white/10">
                  <Inbox className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">Aucun retour ne correspond aux filtres.</p>
                  <p className="text-zinc-600 text-xs mt-1">Les messages du bouton flottant “Retour” arrivent ici instantanément.</p>
                </div>
              )}
              {filteredFeedbacks.map(fb => {
                const catMeta = getCategoryMeta(fb.category);
                const stMeta = getStatusMeta(fb.status);
                const CatIcon = catMeta.icon;
                const isExpanded = expandedFb === fb.id;
                const companyRef = usersMap[fb.userId]?.profile;
                return (
                  <div key={fb.id} className="p-4 sm:p-5 rounded-2xl bg-luxury-800/50 border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${catMeta.cls}`}>
                          <CatIcon className="w-3.5 h-3.5" /> {catMeta.label}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${stMeta.cls}`}>{stMeta.label}</span>
                        {fb.isBeta && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-xs font-black"><FlaskConical className="w-3 h-3" /> BÊTA</span>}
                        <span className="text-xs text-zinc-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {formatFbDate(fb)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={fb.status}
                          onChange={e => updateFeedbackStatus(fb.id, e.target.value as any)}
                          className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-zinc-200"
                          title="Changer le statut"
                        >
                          <option value="new">Nouveau</option>
                          <option value="reviewed">En cours</option>
                          <option value="resolved">Résolu</option>
                          <option value="archived">Archivé</option>
                        </select>
                        <button onClick={() => setExpandedFb(isExpanded ? null : fb.id)} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => deleteFeedback(fb.id)} className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"><Trash className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <p className="mt-3 text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">{fb.message}</p>

                    {/* References row */}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> {fb.companyName || companyRef?.companyName || '—'} <span className="text-zinc-600">•</span> <span className="font-mono">{fb.userId.slice(0, 8)}…</span>
                      </span>
                      {fb.userEmail && <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {fb.userEmail}</span>}
                      <span className="px-2.5 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-300">Page: {fb.page}</span>
                      {fb.viewport && <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-500">{fb.viewport}</span>}
                      {companyRef && <button onClick={() => { setSelectedUserId(fb.userId); setActiveTab('users'); }} className="px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 hover:bg-sky-500/20">Voir utilisateur →</button>}
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-4 p-3 rounded-xl bg-black/30 border border-white/5 space-y-2 text-xs">
                            <div className="grid sm:grid-cols-2 gap-2">
                              <div><span className="text-zinc-500">URL complète:</span> <a href={fb.url || '#'} target="_blank" rel="noreferrer" className="text-gold-400 hover:underline break-all">{fb.url || '—'}</a></div>
                              <div><span className="text-zinc-500">User ID complet:</span> <span className="font-mono text-zinc-300">{fb.userId}</span></div>
                              <div><span className="text-zinc-500">IFU / Entreprise (ref):</span> <span className="text-zinc-300">{companyRef?.ifu || '—'} {companyRef?.companyName ? `— ${companyRef.companyName}` : ''}</span></div>
                              <div><span className="text-zinc-500">Heure précise:</span> <span className="text-zinc-300">{formatFbDate(fb)} • {fb.createdAtClient || ''}</span></div>
                              <div className="sm:col-span-2"><span className="text-zinc-500">User-Agent:</span> <span className="text-zinc-400 break-all">{fb.userAgent || '—'}</span></div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : !selectedUserId ? (
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
