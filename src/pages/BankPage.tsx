import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { localDb } from '../services/localDb';
import { UploadCloud, CheckCircle2, AlertCircle, ArrowRightLeft, FileSpreadsheet, Search, Filter, Wallet, ArrowUpRight, ArrowDownRight, Tag, Save, Check, X, Building2 } from 'lucide-react';
import Papa from 'papaparse';
import { ExtractedTransaction } from '../services/nim';
import { cn } from '../lib/utils';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number; // positive = credit, negative = debit
  status: 'reconciled' | 'pending';
  matchedWith?: ExtractedTransaction;
  systemCategoryId?: string;
  systemCategoryName?: string;
}

const BANK_CATEGORIES = [
  'Frais bancaires', 
  'Virements internes', 
  'Apport en capital', 
  'Retrait DAB', 
  'Dépôt espèces', 
  'Paiement Fournisseur', 
  'Encaissement Client', 
  'Autre'
];

export function BankPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [scannedTransactions, setScannedTransactions] = useState<ExtractedTransaction[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL'|'PENDING'|'RECONCILED'>('ALL');
  
  const [importCurrency, setImportCurrency] = useState('XOF');
  const [importExchangeRate, setImportExchangeRate] = useState(1);

  // Manual categorization state
  const [categorizingTx, setCategorizingTx] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Autre');

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Local-first transactions — instant & offline
    const unsub = localDb.subscribe('transactions', user.uid, (txs) => {
      setScannedTransactions(txs as ExtractedTransaction[]);
      if (bankTransactions.length > 0) {
        reconcileTransactions(bankTransactions, txs as ExtractedTransaction[], false);
      }
    });
    return () => unsub();
  }, [user]); // remove bankTransactions.length dep to avoid loop; reconciliation triggered via setScannedTransactions or import

  const handleCurrencyChange = (curr: string) => {
    setImportCurrency(curr);
    if (curr === 'EUR') setImportExchangeRate(655.957);
    else if (curr === 'USD') setImportExchangeRate(600);
    else setImportExchangeRate(1);
  };

  const reconcileTransactions = (bankTxs: BankTransaction[], scannedTxs: ExtractedTransaction[], isNewImport = false) => {
    const reconciled = bankTxs.map(btx => {
      // If it's already reconciled manually or has a matched system category, keep it
      if (!isNewImport && btx.status === 'reconciled') {
        // Just verify if the matched document still exists
        if (btx.matchedWith && !scannedTxs.find(s => s.id === btx.matchedWith?.id)) {
           return { ...btx, status: 'pending' as const, matchedWith: undefined }; 
        }
        return btx;
      }

      // Auto-match logic
      const possibleMatches = scannedTxs.filter(stx => {
        // Do not match if the scanned tx is already reconciled with another bank line (simple check: usually we'd track bankLineId in scannedTx)
        const stxAmount = Number(stx.amountInclTax) || Number(stx.amountExclTax) || 0;
        const btxAbs = Math.abs(btx.amount);
        
        // Exact match or very close (floating point)
        const amountMatches = Math.abs(btxAbs - stxAmount) < 2; 
        
        const bDate = new Date(btx.date);
        const sDate = new Date(stx.date);
        const diffDays = !isNaN(bDate.getTime()) && !isNaN(sDate.getTime()) 
          ? Math.ceil(Math.abs(bDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        return amountMatches && diffDays <= 7;
      });

      // Best match (closest date)
      const match = possibleMatches.length > 0 ? possibleMatches.sort((a,b) => {
        const d1 = Math.abs(new Date(btx.date).getTime() - new Date(a.date).getTime());
        const d2 = Math.abs(new Date(btx.date).getTime() - new Date(b.date).getTime());
        return d1 - d2;
      })[0] : null;

      return {
        ...btx,
        status: (match ? 'reconciled' : 'pending') as 'reconciled' | 'pending',
        matchedWith: match || undefined
      } as BankTransaction;
    });

    setBankTransactions(reconciled);
  };

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedTxs: BankTransaction[] = results.data.map((row: any, index: number) => {
          // Robust parsing for common bank CSV formats
          const date = row['Date'] || row['Date de valeur'] || row['date'] || Object.values(row)[0] as string;
          const description = row['Libellé'] || row['Description'] || row['Opération'] || row['libelle'] || Object.values(row)[1] as string;
          
          let cleanAmount = 0;
          if (row['Montant']) cleanAmount = parseFloat(row['Montant'].toString().replace(/[^\d,-]/g, '').replace(',', '.'));
          else if (row['Amount']) cleanAmount = parseFloat(row['Amount'].toString().replace(/[^\d,-]/g, '').replace(',', '.'));
          else {
            const debitStr = row['Débit'] || row['Debit'] || '';
            const creditStr = row['Crédit'] || row['Credit'] || '';
            if (debitStr) cleanAmount = -Math.abs(parseFloat(debitStr.toString().replace(/[^\d,-]/g, '').replace(',', '.')));
            if (creditStr) cleanAmount = Math.abs(parseFloat(creditStr.toString().replace(/[^\d,-]/g, '').replace(',', '.')));
            if (!debitStr && !creditStr) {
               // fallback to 3rd column
               cleanAmount = parseFloat(String(Object.values(row)[2] || '0').replace(/[^\d,-]/g, '').replace(',', '.'));
            }
          }
          
          const convertedAmount = cleanAmount * importExchangeRate;

          return {
            id: `bank-${Date.now()}-${index}`,
            date: date || new Date().toISOString().split('T')[0],
            description: description || 'Opération inconnue',
            amount: convertedAmount || 0,
            status: 'pending' as const
          } as BankTransaction;
        }).filter(tx => tx.amount !== 0); // Ignore pure empty lines

        reconcileTransactions(parsedTxs, scannedTransactions, true);
      }
    });
  };

  const saveManualCategorization = async (txId: string) => {
    const tx = bankTransactions.find(t => t.id === txId);
    if (!tx || !user) return;
    const payload = {
        userId: user.uid,
        date: tx.date || new Date().toISOString().split('T')[0],
        category: selectedCategory,
        vendorName: 'Banque - ' + tx.description,
        amountExclTax: Math.abs(tx.amount),
        amountInclTax: Math.abs(tx.amount),
        tvaAmount: 0,
        type: tx.amount > 0 ? 'INCOME' : 'EXPENSE',
        source: 'BANK_IMPORT',
        status: 'validated',
        fecValid: true,
        createdAt: new Date().toISOString()
      };
    try {
      const localId = localDb.add('transactions', payload);
      let firestoreId = localId;
      try { const docRef = await addDoc(collection(db, 'transactions'), payload); firestoreId = docRef.id; } catch(e){ console.warn('[Bank] Firestore sync failed (local preserved):', e); }
      setBankTransactions(prev => prev.map(t => 
        t.id === txId ? { ...t, status: 'reconciled', systemCategoryId: firestoreId, systemCategoryName: selectedCategory } : t
      ));
      setCategorizingTx(null);
    } catch(e) {
      console.error("Error creating bank transaction", e);
      alert("Erreur lors de la création de la transaction.");
    }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const filteredTransactions = bankTransactions.filter(tx => {
    const matchSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || tx.amount.toString().includes(searchTerm);
    const matchFilter = filterStatus === 'ALL' ? true : filterStatus === 'RECONCILED' ? tx.status === 'reconciled' : tx.status === 'pending';
    return matchSearch && matchFilter;
  });

  const reconciledCount = bankTransactions.filter(t => t.status === 'reconciled').length;
  const pendingCount = bankTransactions.length - reconciledCount;
  
  const totalIn = bankTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalOut = Math.abs(bankTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
  const soldeMouvement = totalIn - totalOut;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-luxury-900/50 p-6 rounded-2xl border border-border-subtle">
        <div>
          <h1 className="text-3xl font-serif text-text-title tracking-tight mb-2 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-gold-500" />
            Rapprochement Bancaire
          </h1>
          <p className="text-zinc-500 max-w-xl">
            Importez vos relevés pour vérifier vos justificatifs ou catégoriser directement les frais bancaires et mouvements.
          </p>
        </div>
        {bankTransactions.length > 0 && (
          <div className="flex bg-luxury-800 rounded-lg p-1 border border-border-subtle">
             <button onClick={() => setBankTransactions([])} className="px-4 py-2 text-sm text-gold-500 hover:text-gold-400 font-medium">Importer un nouveau fichier</button>
          </div>
        )}
      </header>

      {bankTransactions.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={cn("border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 backdrop-blur-sm",
            isDragging ? 'border-gold-500 bg-gold-500/10' : 'border-gold-500/20 hover:border-gold-500/50 hover:bg-gold-500/5'
          )}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        >
          <div className="w-20 h-20 rounded-2xl bg-gold-500/10 flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
            <FileSpreadsheet className="w-10 h-10 text-gold-400" />
          </div>
          <h3 className="text-2xl font-serif text-gold-100 mb-3">Importez votre relevé bancaire</h3>
          <p className="text-zinc-400 mb-8 max-w-md mx-auto">
            Glissez-déposez votre fichier <strong>CSV</strong>. Libriwouô analysera les flux et fera le lien avec vos factures automatiquement.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 bg-luxury-900/50 p-4 rounded-xl border border-border-subtle max-w-md mx-auto">
            <div className="flex items-center gap-3 w-full sm:w-auto mt-2">
              <label className="text-sm font-medium text-zinc-400">Devise</label>
              <select value={importCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} className="bg-luxury-800 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 text-sm focus:outline-none focus:border-gold-500/50 flex-1">
                <option value="XOF">XOF (FCFA)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            {importCurrency !== 'XOF' && (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-sm font-medium text-zinc-400">Taux</label>
                <input type="number" step="0.01" value={importExchangeRate} onChange={(e) => setImportExchangeRate(Number(e.target.value))} className="w-full sm:w-24 bg-luxury-800 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 text-sm focus:outline-none focus:border-gold-500/50" />
              </div>
            )}
          </div>

          <label className="inline-flex items-center justify-center bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 px-8 py-3.5 rounded-xl text-sm font-semibold cursor-pointer hover:opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <UploadCloud className="w-5 h-5 mr-2" />
            Parcourir les fichiers (.csv)
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
          </label>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* KPI Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="p-5 rounded-2xl bg-luxury-800/80 border border-border-subtle shadow-lg">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><ArrowDownRight className="w-3.5 h-3.5 text-emerald-400"/> Encaissements</p>
                <p className="text-xl md:text-2xl font-mono text-emerald-400">{totalIn.toLocaleString('fr-FR')} F</p>
             </div>
             <div className="p-5 rounded-2xl bg-luxury-800/80 border border-border-subtle shadow-lg">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><ArrowUpRight className="w-3.5 h-3.5 text-red-500"/> Décaissements</p>
                <p className="text-xl md:text-2xl font-mono text-red-400">{totalOut.toLocaleString('fr-FR')} F</p>
             </div>
             <div className="p-5 rounded-2xl bg-gold-900/10 border border-gold-500/20 shadow-lg">
                <p className="text-xs text-gold-500/70 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Lignes Rapprochées</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-2xl font-serif text-gold-300">{reconciledCount}</p>
                   <p className="text-xs text-gold-500/50">/ {bankTransactions.length}</p>
                </div>
             </div>
             <div className="p-5 rounded-2xl bg-luxury-800/80 border border-border-subtle shadow-lg">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Wallet className="w-3.5 h-3.5"/> Solde de la période</p>
                <p className={cn("text-xl md:text-2xl font-mono", soldeMouvement >= 0 ? 'text-emerald-400' : 'text-red-400')}>{Math.abs(soldeMouvement).toLocaleString('fr-FR')} F {soldeMouvement >= 0 ? '(+)' : '(-)'}</p>
             </div>
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-luxury-800/40 p-4 rounded-xl border border-border-subtle">
            <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" placeholder="Chercher un libellé..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-luxury-900 border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50"
                />
              </div>
              <div className="relative w-full sm:w-48">
                 <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                 <select 
                   value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                   className="w-full bg-luxury-900 border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 appearance-none"
                 >
                   <option value="ALL">Tous les statuts</option>
                   <option value="PENDING">À justifier</option>
                   <option value="RECONCILED">Rapprochées</option>
                 </select>
              </div>
            </div>
            {pendingCount === 0 && bankTransactions.length > 0 && (
               <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-sm flex items-center gap-2">
                 <CheckCircle2 className="w-4 h-4" /> Rapprochement terminé
               </div>
            )}
          </div>

          {/* TABLE */}
          <div className="bg-luxury-800/50 border border-border-subtle rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-500 bg-luxury-900/50 border-b border-border-subtle">
                  <tr>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Libellé Bancaire</th>
                    <th className="px-6 py-4 font-medium text-right">Montant</th>
                    <th className="px-6 py-4 font-medium text-center">Débit/Crédit</th>
                    <th className="px-6 py-4 font-medium">Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className={cn("hover:bg-luxury-700/30 transition-colors", tx.status === 'reconciled' ? 'bg-gold-500/5' : '')}>
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400 font-mono text-xs">{tx.date}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gold-100">{tx.description}</div>
                        {tx.status === 'pending' && <div className="text-[10px] text-zinc-500 mt-0.5">Aucun document détecté</div>}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-gold-100">
                        {Math.abs(tx.amount).toLocaleString('fr-FR')} F
                      </td>
                      <td className="px-6 py-4 text-center">
                         {tx.amount > 0 ? (
                           <span className="inline-flex text-emerald-400 items-center justify-center p-1 rounded-full bg-emerald-500/10"><ArrowDownRight className="w-4 h-4"/></span>
                         ) : (
                           <span className="inline-flex text-red-400 items-center justify-center p-1 rounded-full bg-red-500/10"><ArrowUpRight className="w-4 h-4"/></span>
                         )}
                      </td>
                      <td className="px-6 py-4 min-w-[280px]">
                        {tx.status === 'reconciled' ? (
                          <div className="flex items-center gap-3">
                             <div className="bg-money-500/10 text-money-400 border border-money-500/20 p-1.5 rounded-full"><CheckCircle2 className="w-4 h-4" /></div>
                             <div>
                                <p className="text-xs text-gold-200 font-medium">{tx.matchedWith ? (tx.matchedWith.vendorName || tx.matchedWith.category) : tx.systemCategoryName}</p>
                                <p className="text-[10px] text-emerald-400/80 tracking-wider uppercase">{tx.matchedWith ? 'Facture Associée' : 'Catégorisation Manuelle'}</p>
                             </div>
                          </div>
                        ) : categorizingTx === tx.id ? (
                           <form onSubmit={(e) => { e.preventDefault(); saveManualCategorization(tx.id); }} className="flex gap-2">
                             <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="bg-luxury-900 border border-blue-500/30 text-gold-100 rounded-md py-1 px-2 text-xs flex-1 outline-none">
                               {BANK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                             </select>
                             <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-md transition-colors"><Check className="w-3.5 h-3.5"/></button>
                             <button type="button" onClick={() => setCategorizingTx(null)} className="bg-luxury-700 hover:bg-luxury-600 text-zinc-400 p-1.5 rounded-md transition-colors"><X className="w-3.5 h-3.5"/></button>
                           </form>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20 whitespace-nowrap">
                              <AlertCircle className="w-3.5 h-3.5" /> À justifier
                            </span>
                            <button onClick={() => { setCategorizingTx(tx.id); setSelectedCategory('Frais bancaires'); }} className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-2 transition-colors">
                               Catégoriser sans facture
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                 <div className="p-12 text-center text-zinc-500">
                    Aucun résultat trouvé pour votre recherche.
                 </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
