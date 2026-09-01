import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { collection, query, doc, onSnapshot, orderBy, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { FileCheck, Download, Plus, Clock, CheckCircle2, AlertCircle, Calendar as CalendarIcon, FileSpreadsheet, Sparkles, Loader2, ArrowLeft, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { sendChatMessage, UserContext } from '../services/nim';
import { localDb } from '../services/localDb';
import { ErrorReporter } from '../components/ErrorReporter';

interface TaxDeclaration {
  id: string;
  type: 'TVA' | 'IUTS' | 'IRF' | 'AIB' | 'IMF_IS';
  period: string;
  status: 'PENDING' | 'GENERATED' | 'VALIDATED' | 'SUBMITTED';
  dueDate: string;
  amount?: number;
  data?: any;
}

export function DeclarationsPage() {
  const [declarations, setDeclarations] = useState<TaxDeclaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [revenue, setRevenue] = useState(0);

  // Optimizer state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<string | null>(null);

  // Editing state
  const [editingDeclaration, setEditingDeclaration] = useState<TaxDeclaration | null>(null);
  const [formData, setFormData] = useState<{ ca?: number; tvaCollected?: number; tvaDeductible?: number }>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      const unsubAuth = auth.onAuthStateChanged((u) => { if (u) window.location.reload(); });
      return () => unsubAuth();
    }
    // Listen to company via localDb (with Firestore fallback)
    const unsubscribeCompany = localDb.subscribe('companies', user.uid, (list: any[]) => {
          if (list.length > 0) setCompany(list[0] as any);
          else {
            import('firebase/firestore').then(({ doc: fdoc, getDoc }) => {
              getDoc(fdoc(db, 'companies', user.uid)).then(s => { if (s.exists()) setCompany(s.data() as any); });
            });
          }
        });

    // Fetch basic transaction stats for the optimizer via localDb
    const unsubscribeTransactions = localDb.subscribe('transactions', user.uid, (txs: any[]) => {
          let totalRev = 0;
          txs.forEach((data: any) => {
            if (data.type === 'INCOME' || data.type === 'income') {
              totalRev += Number(data.amountInclTax ?? data.amountExclTax ?? data.amount ?? 0);
            }
          });
          setRevenue(totalRev);
        });

      // Listen to declarations (Mocking for now, we'll auto-generate a list based on current month)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      // Generate some standard declarations for the dashboard
      const mockDeclarations: TaxDeclaration[] = [
        {
          id: '1',
          type: 'TVA',
          period: currentMonth,
          status: 'PENDING',
          dueDate: `${currentMonth}-20`, // TVA due on 20th
        },
        {
          id: '2',
          type: 'IUTS',
          period: currentMonth,
          status: 'PENDING',
          dueDate: `${currentMonth}-10`, // IUTS due on 10th
        },
        {
          id: '3',
          type: 'TVA',
          period: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7),
          status: 'SUBMITTED',
          dueDate: `${new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)}-20`,
          amount: 450000
        }
      ];
      
      setDeclarations(mockDeclarations);
      setLoading(false);

      return () => {
        try { unsubscribeCompany(); } catch {}
        try { unsubscribeTransactions(); } catch {}
      };
  }, []);

  const handleOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationResult(null);

    const actualCA = revenue > 0 ? revenue : 50000000; // fallback if no data

    const prompt = `Agis comme un auditeur fiscal de l'espace OHADA très expérimenté. 
Mon entreprise: 
- CA estimé à date: ${actualCA.toLocaleString()} FCFA
- Statut Actuel: ${company?.taxRegime || 'CME'}
- Secteur: ${company?.sector || 'Divers'}

Analyse mon profil et propose une (1) optimisation proactive percutante (ex: changement de régime si on dépasse le seuil, optimisation des charges récurrentes vu mon secteur, ou crédit d'impôt applicable). Sois concis et professionnel. Formate le retour en 3 ou 4 puces.`;

    try {
      const dbContext: UserContext = {
        revenue: actualCA, 
        expenses: actualCA * 0.4, // estimation for context
        taxRegime: company?.taxRegime || 'CME',
        sector: company?.sector || 'unknown',
        taxes: null
      };

      const handler = async () => { return { status: "Done" }; };
      const response = await sendChatMessage([], prompt, undefined, undefined, dbContext, handler);
      setOptimizationResult(response?.text || "L'audit n'a pas pu être généré.");

    } catch (e) {
      console.error(e);
      ErrorReporter.report("Le scan fiscal IA a été interrompu.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'GENERATED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'VALIDATED': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'SUBMITTED': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING': return 'À préparer';
      case 'GENERATED': return 'Générée';
      case 'VALIDATED': return 'Validée';
      case 'SUBMITTED': return 'Télé-déclarée';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'TVA': return 'Taxe sur la Valeur Ajoutée (TVA)';
      case 'IUTS': return 'Impôt Unique sur les Traitements et Salaires (IUTS)';
      case 'IRF': return 'Impôt sur le Revenu Foncier (IRF)';
      case 'IMF_IS': return 'Impôt Minimum Forfaitaire / Impôt sur les Sociétés';
      case 'AIB': return 'Acompte sur Impôt sur les Bénéfices (AIB)';
      default: return type;
    }
  };

  const generateDeclarationDoc = async (decl: TaxDeclaration, data: typeof formData) => {
    const netTVA = (data.tvaCollected || 0) - (data.tvaDeductible || 0);
    const amountToPay = netTVA > 0 ? netTVA : 0;
    
    // Generate a beautiful docx for the declaration
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "RÉPUBLIQUE DU BURKINA FASO", font: "Times New Roman", size: 24, bold: true }),
            ],
            alignment: "center",
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", font: "Times New Roman", size: 20 }),
            ],
            alignment: "center",
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "DIRECTION GÉNÉRALE DES IMPÔTS", font: "Times New Roman", size: 20 }),
            ],
            alignment: "center",
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `PROFORMA DÉCLARATION - ${getTypeLabel(decl.type)}`, font: "Arial", size: 28, bold: true }),
            ],
            alignment: "center",
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Période: ${decl.period}`, font: "Arial", size: 24, bold: true }),
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Raison Sociale: ${company?.companyName || 'Non renseigné'}`, font: "Arial", size: 22 }),
            ],
            spacing: { after: 100 }
          }),
           new Paragraph({
            children: [
              new TextRun({ text: `IFU: ${company?.ifu || 'Non renseigné'}`, font: "Arial", size: 22 }),
            ],
            spacing: { after: 400 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Libellé", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Montant (FCFA)", bold: true })] })] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Chiffre d'Affaires Taxable" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.ca?.toLocaleString() || "À RENSEIGNER" })] })] }),
                ]
              }),
               new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TVA Collectée (18%)" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.tvaCollected?.toLocaleString() || "À RENSEIGNER" })] })] }),
                ]
              }),
               new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TVA Déductible" })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: data.tvaDeductible?.toLocaleString() || "À RENSEIGNER" })] })] }),
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "TVA Nette à Payer", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: amountToPay.toLocaleString(), bold: true })] })] }),
                ]
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Document généré par Libriwouô IA. Les montants doivent être reportés sur e-SINTAX.", font: "Arial", size: 18, color: "666666", italics: true }),
            ],
            spacing: { before: 400 }
          })
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Declaration_${decl.type}_${decl.period}.docx`);
    
    // Update local state temporarily to show it was generated
    setDeclarations(declarations.map(d => d.id === decl.id ? { ...d, status: 'GENERATED', amount: amountToPay, data: formData } : d));
    setEditingDeclaration(null);
  };

  const createNewDeclaration = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newDecl: TaxDeclaration = {
      id: Math.random().toString(),
      type: 'TVA',
      period: currentMonth,
      status: 'PENDING',
      dueDate: `${currentMonth}-20`,
    };
    // Don't add to list yet, just open in edit mode
    setEditingDeclaration(newDecl);
    setFormData({
      ca: revenue || 0,
      tvaCollected: Math.round((revenue || 0) * 0.18),
      tvaDeductible: 0
    });
  };

  const editDeclaration = (decl: TaxDeclaration) => {
    setEditingDeclaration(decl);
    setFormData(decl.data || {
      ca: revenue || 0,
      tvaCollected: Math.round((revenue || 0) * 0.18),
      tvaDeductible: 0
    });
  };

  const saveEditedDeclaration = () => {
    if (!editingDeclaration) return;
    
    // If it's a new one (not in the list), prepend it
    if (!declarations.find(d => d.id === editingDeclaration.id)) {
      setDeclarations([{...editingDeclaration, data: formData}, ...declarations]);
    } else {
      setDeclarations(declarations.map(d => d.id === editingDeclaration.id ? { ...d, data: formData } : d));
    }
    
    generateDeclarationDoc(editingDeclaration, formData);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {editingDeclaration ? (
          <motion.div 
            key="editing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-6"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setEditingDeclaration(null)}
                className="flex items-center gap-2 text-zinc-400 hover:text-text-title transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Retour aux déclarations
              </button>
              <h2 className="text-2xl font-serif text-text-title">Éditer la déclaration {editingDeclaration.type}</h2>
            </div>
            
            <div className="bg-luxury-800/40 border border-border-subtle rounded-3xl p-6 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Période</label>
                  <input 
                    type="month"
                    value={editingDeclaration.period}
                    onChange={(e) => setEditingDeclaration({...editingDeclaration, period: e.target.value})}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-text-title focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Type d'impôt</label>
                  <select 
                    value={editingDeclaration.type}
                    onChange={(e) => setEditingDeclaration({...editingDeclaration, type: e.target.value as any})}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-text-title focus:outline-none focus:border-gold-500/50"
                  >
                    <option value="TVA">TVA - Taxe sur la Valeur Ajoutée</option>
                    <option value="IUTS">IUTS - Impôt sur les salaires</option>
                    <option value="IRF">IRF - Impôt sur les revenus fonciers</option>
                    <option value="IMF_IS">IMF / IS - Bénéfices</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Chiffre d'Affaires Taxable (FCFA)</label>
                  <input 
                    type="number"
                    value={formData.ca || ''}
                    onChange={(e) => setFormData({...formData, ca: parseInt(e.target.value) || 0})}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-text-title focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">TVA Collectée (FCFA)</label>
                  <input 
                    type="number"
                    value={formData.tvaCollected || ''}
                    onChange={(e) => setFormData({...formData, tvaCollected: parseInt(e.target.value) || 0})}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-text-title focus:outline-none focus:border-gold-500/50"
                  />
                  <p className="mt-2 text-xs text-zinc-500">Généralement 18% du Chiffre d'Affaires Taxable.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">TVA Déductible (Sur Factures Fournisseurs) (FCFA)</label>
                  <input 
                    type="number"
                    value={formData.tvaDeductible || ''}
                    onChange={(e) => setFormData({...formData, tvaDeductible: parseInt(e.target.value) || 0})}
                    className="w-full bg-luxury-900 border border-border-subtle rounded-xl px-4 py-3 text-text-title focus:outline-none focus:border-gold-500/50"
                  />
                </div>
                
                <div className="pt-6 border-t border-border-subtle">
                  <div className="flex justify-between items-center bg-luxury-900 p-4 rounded-xl border border-gold-500/20">
                    <span className="text-zinc-300 font-medium">TVA Nette à Payer :</span>
                    <span className="text-2xl font-mono text-gold-400 font-bold">
                      {Math.max(0, (formData.tvaCollected || 0) - (formData.tvaDeductible || 0)).toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-4">
                <button 
                  onClick={() => setEditingDeclaration(null)}
                  className="px-6 py-3 rounded-xl font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  onClick={saveEditedDeclaration}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
                >
                  <Save className="w-5 h-5" />
                  Générer le document
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 text-gold-500 border border-gold-500/20 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
                  Conformité SYSCOHADA
                </div>
                <h1 className="text-3xl md:text-5xl font-serif tracking-tight mb-2 text-text-title flex items-center gap-4">
                  <FileSpreadsheet className="w-10 h-10 text-gold-500" />
                  Mes Impôts (Déclarations)
                </h1>
                <p className="text-zinc-400 font-sans max-w-2xl">
                  Déclarez simplement vos impôts. Les montants sont calculés automatiquement à partir de vos recettes et dépenses.
                </p>
              </div>
              
              <button 
                onClick={createNewDeclaration}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all shrink-0"
              >
                <Plus className="w-5 h-5" />
                Nouvelle Déclaration
              </button>
            </header>

            <div className="grid lg:grid-cols-3 gap-6 mb-8">
               <div className="p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-serif text-text-title mb-1">
                     {declarations.filter(d => d.status === 'PENDING').length}
                  </h3>
                  <p className="text-sm text-zinc-400 font-medium">Déclarations en attente</p>
               </div>
               <div className="p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle backdrop-blur-md">
                   <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-serif text-text-title mb-1">
                     {declarations.filter(d => d.status === 'GENERATED').length}
                  </h3>
                  <p className="text-sm text-zinc-400 font-medium">Brouillons générés</p>
               </div>
               <div className="p-6 rounded-2xl bg-luxury-800/40 border border-border-subtle backdrop-blur-md">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-serif text-text-title mb-1">
                     {declarations.filter(d => d.status === 'SUBMITTED').length}
                  </h3>
                  <p className="text-sm text-zinc-400 font-medium">Déclarations soumises</p>
               </div>
            </div>

            {/* AI Tax Optimization Module */}
            <div className="bg-gradient-to-r from-luxury-800 to-luxury-900 border border-gold-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden mb-8">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="w-32 h-32 text-gold-500" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                 <div>
                    <h2 className="text-lg font-serif text-gold-100 mb-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-gold-500" /> Optimi-Taxe Proactif (IA)
                    </h2>
                    <p className="text-sm text-zinc-400 max-w-2xl">
                      Un audit fiscal instantané de votre profil pour détecter les changements de régime avantageux,
                      les économies potentielles ou les crédits d'impôt inexploités en fonction de votre activité récente.
                    </p>
                 </div>
                 
                 <button 
                   onClick={handleOptimization}
                   disabled={isOptimizing}
                   className="bg-gold-500 text-zinc-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gold-400 disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap"
                 >
                    {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lancer l\'audit IA'}
                 </button>
              </div>

              {optimizationResult && (
                <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="mt-6 p-4 bg-gold-500/10 border border-gold-500/20 rounded-xl">
                   <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-gold-100 leading-relaxed font-sans w-full">
                         <div className="markdown-body prose prose-invert prose-gold max-w-none">
                           <Markdown>{optimizationResult}</Markdown>
                         </div>
                      </div>
                   </div>
                </motion.div>
              )}
            </div>

            <div className="bg-luxury-800/40 border border-border-subtle rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="p-6 border-b border-border-subtle flex items-center justify-between">
                <h2 className="text-lg font-serif text-text-title">Vos Déclarations Récentes</h2>
              </div>
              
              <div className="divide-y divide-border-subtle overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-luxury-900/50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Période</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Type d'Impôt</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Échéance</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {declarations.map((decl) => (
                      <tr key={decl.id} className="hover:bg-luxury-800/60 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-title">{new Date(decl.period + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                             <span className="text-sm font-medium text-zinc-200">{decl.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <CalendarIcon className="w-4 h-4" />
                            {new Date(decl.dueDate).toLocaleDateString('fr-FR')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border", getStatusColor(decl.status))}>
                            {getStatusLabel(decl.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {decl.amount ? (
                            <span className="font-mono text-text-title">{decl.amount.toLocaleString()} FCFA</span>
                          ) : (
                            <span className="text-zinc-500 font-mono">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {decl.status === 'PENDING' ? (
                            <button 
                               onClick={() => editDeclaration(decl)}
                               className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 border border-gold-500/20 rounded-lg text-xs font-bold transition-colors"
                            >
                              Éditer & Générer
                            </button>
                          ) : (
                             <button 
                               onClick={() => generateDeclarationDoc(decl, decl.data || {})}
                               className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-bold transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              Télécharger
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    
                    {declarations.length === 0 && (
                       <tr>
                         <td colSpan={6} className="px-6 py-12 text-center">
                           <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                           <p className="text-zinc-400 text-sm">Aucune déclaration trouvée.</p>
                         </td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-luxury-800/80 border border-gold-500/20 shadow-[0_0_15px_rgba(212,175,55,0.1)] flex gap-4">
                <AlertCircle className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                <p className="text-sm font-sans text-gold-500/80 leading-relaxed">
                  <strong className="text-gold-300">Conformité Juridique :</strong> Les documents générés par Libriwouô sont des proformas analytiques (brouillons).
                  La validation et télédéclaration finales doivent s'effectuer officiellement sur la plateforme <strong>e-SINTAX</strong> de la DGI du Burkina Faso. 
                  NEO calcule vos montants à partir du livre-journal pour minimiser vos erreurs de saisie.
                </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
