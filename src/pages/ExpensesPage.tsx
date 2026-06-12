import { useState, useEffect } from 'react';
import { ShoppingCart, Info, ArrowUpRight, ArrowDownRight, Plus, X, Pencil } from 'lucide-react';
import { db } from '../firebase';
import { localDb } from '../services/localDb';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ExtractedTransaction } from '../services/nim';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

export function ExpensesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'EXPENSE' | 'INCOME'>('ALL');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<ExtractedTransaction | null>(null);
  const [newTxType, setNewTxType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newTxDate, setNewTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTxVendor, setNewTxVendor] = useState('');
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxCategory, setNewTxCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = localDb.subscribe('transactions', user.uid, (list) => {
      const validData = list.filter(t => t.type === 'EXPENSE' || t.type === 'INCOME');
      validData.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(validData as ExtractedTransaction[]);
    });
    return () => unsub();
  }, [user]);

  const openNewModal = () => {
    setEditingTx(null);
    setNewTxType('EXPENSE');
    setNewTxDate(new Date().toISOString().split('T')[0]);
    setNewTxVendor('');
    setNewTxDesc('');
    setNewTxAmount('');
    setNewTxCategory('');
    setShowModal(true);
  };

  const openEditModal = (tx: ExtractedTransaction) => {
    setEditingTx(tx);
    setNewTxType(tx.type as 'INCOME' | 'EXPENSE');
    setNewTxDate(tx.date || new Date().toISOString().split('T')[0]);
    setNewTxVendor(tx.vendorName || '');
    setNewTxDesc(tx.description || '');
    setNewTxAmount(String(tx.amountExclTax || ''));
    setNewTxCategory(tx.category || '');
    setShowModal(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTxAmount || !newTxVendor) return;
    
    setIsSubmitting(true);
    try {
      const amountExclTax = Number(newTxAmount);
      
      if (editingTx && editingTx.id) {
        localDb.update('transactions', editingTx.id, {
          type: newTxType,
          date: newTxDate,
          vendorName: newTxVendor,
          description: newTxDesc,
          amountExclTax,
          amountInclTax: amountExclTax,
          category: newTxCategory || (newTxType === 'INCOME' ? 'Vente de services/produits' : 'Dépense diverse'),
          syscohadaCode: newTxType === 'INCOME' ? '701' : '605',
        });
      } else {
        const txData = {
          userId: user.uid,
          type: newTxType,
          date: newTxDate,
          vendorName: newTxVendor,
          description: newTxDesc,
          amountExclTax,
          amountInclTax: amountExclTax, // simplified, assuming no VAT for manual quick entry
          tvaAmount: 0,
          category: newTxCategory || (newTxType === 'INCOME' ? 'Vente de services/produits' : 'Dépense diverse'),
          createdAt: new Date().toISOString(),
          paymentMethod: 'Cash', // Default
          syscohadaCode: newTxType === 'INCOME' ? '701' : '605',
          fecFingerprint: 'MANUAL-' + Date.now() // Dummy ref
        };
        localDb.add('transactions', txData);
      }
      
      setShowModal(false);
      setEditingTx(null);
    } catch (error) {
      console.error("Error saving manual transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTransactions = transactions.filter(t => activeTab === 'ALL' || t.type === activeTab);

  const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + (Number(curr.amountExclTax) || 0), 0);
  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + (Number(curr.amountExclTax) || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto relative">
      <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-serif text-text-title tracking-tight mb-2 flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-gold-500" />
            Mes Dépenses (et Recettes)
          </h1>
          <p className="text-zinc-500 max-w-xl">
            Toutes vos entrées et sorties d'argent, avec l'historique complet de vos factures et reçus.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => openNewModal()}
            className="px-4 py-2 bg-luxury-900 border border-gold-500/30 text-gold-400 rounded-lg text-sm font-semibold hover:bg-gold-500/10 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Saisie Manuelle
          </button>
          <Link to="/invoices" className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-lg shadow-emerald-500/20">
            Faire une Facture
          </Link>
          <Link to="/scan" className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-lg shadow-rose-500/20">
            Scanner un reçu
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-emerald-400/80 mb-1">Total Ventes (Entrées)</p>
            <ArrowUpRight className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-serif text-emerald-100">{totalIncome.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-rose-400/80 mb-1">Total Achats (Sorties)</p>
            <ArrowDownRight className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-3xl font-serif text-rose-100">{totalExpenses.toLocaleString('fr-FR')} FCFA</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-luxury-700 text-gold-100 border border-gold-500/30' : 'bg-luxury-900 border border-border-subtle text-zinc-400 hover:text-zinc-300'}`}
        >
          Tout voir
        </button>
        <button 
          onClick={() => setActiveTab('INCOME')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'INCOME' ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30' : 'bg-luxury-900 border border-border-subtle text-zinc-400 hover:text-zinc-300'}`}
        >
          Seulement les Ventes
        </button>
        <button 
          onClick={() => setActiveTab('EXPENSE')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'EXPENSE' ? 'bg-rose-500/20 text-rose-100 border border-rose-500/30' : 'bg-luxury-900 border border-border-subtle text-zinc-400 hover:text-zinc-300'}`}
        >
          Seulement les Achats
        </button>
      </div>

      <div className="bg-luxury-800/50 border border-border-subtle rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-luxury-900 border-b border-border-subtle text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Description / Tiers</th>
              <th className="px-6 py-4 font-medium">Catégorie</th>
              <th className="px-6 py-4 font-medium text-right">Montant HT</th>
              <th className="px-6 py-4 font-medium text-right shadow-sm">Plan Comptable</th>
              <th className="px-6 py-4 font-medium text-right shadow-sm">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filteredTransactions.map(exp => (
              <tr key={exp.id} className="hover:bg-luxury-800/80 transition-colors">
                <td className="px-6 py-4">
                  {exp.type === 'INCOME' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ArrowUpRight className="w-3 h-3" /> Vente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <ArrowDownRight className="w-3 h-3" /> Achat
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">{new Date(exp.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4">
                  <div className="font-medium text-gold-100">{exp.vendorName || (exp.type === 'INCOME' ? 'Client Divers' : 'Fournisseur Divers')}</div>
                  {exp.description && <div className="text-xs text-zinc-500 mt-1 line-clamp-1">{exp.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-medium bg-luxury-900 border border-border-subtle text-zinc-300">
                    {exp.category}
                  </span>
                </td>
                <td className={`px-6 py-4 text-right font-medium ${exp.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {exp.type === 'INCOME' ? '+' : '-'}{Number(exp.amountExclTax).toLocaleString('fr-FR')} FCFA
                </td>
                <td className="px-6 py-4 text-right">
                  {exp.syscohadaCode ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20 font-mono">
                      <Info className="w-3 h-3"/> SYSCOHADA {exp.syscohadaCode}
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-xs text-right block">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openEditModal(exp)} className="text-zinc-400 hover:text-gold-400 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 font-serif italic text-lg">
                  Aucune transaction trouvée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-luxury-800 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <h2 className="text-lg font-serif text-gold-100">{editingTx ? 'Modifier la transaction' : 'Saisie Rapide'}</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualSubmit} className="p-4 space-y-4">
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setNewTxType('INCOME')}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${newTxType === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-black/20 text-zinc-400 border border-border-subtle hover:bg-black/40'}`}
                  >
                    Vente (Entrée)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setNewTxType('EXPENSE')}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${newTxType === 'EXPENSE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-black/20 text-zinc-400 border border-border-subtle hover:bg-black/40'}`}
                  >
                    Achat (Sortie)
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Date</label>
                  <input type="date" required value={newTxDate} onChange={(e) => setNewTxDate(e.target.value)} className="w-full bg-black/30 border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">{newTxType === 'INCOME' ? 'Nom du Client' : 'Nom du Fournisseur'} *</label>
                  <input type="text" required value={newTxVendor} onChange={(e) => setNewTxVendor(e.target.value)} className="w-full bg-black/30 border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Ex: Boutique SITARA" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Montant (FCFA) *</label>
                  <input type="number" required min="0" value={newTxAmount} onChange={(e) => setNewTxAmount(e.target.value)} className="w-full bg-black/30 border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="0" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Description (Optionnel)</label>
                  <input type="text" value={newTxDesc} onChange={(e) => setNewTxDesc(e.target.value)} className="w-full bg-black/30 border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Détails de l'opération..." />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Catégorie</label>
                  <input type="text" value={newTxCategory} onChange={(e) => setNewTxCategory(e.target.value)} className="w-full bg-black/30 border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Ex: Vente de marchandise..." />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Enregistrement...' : (editingTx ? 'Mettre à jour' : 'Enregistrer')}
                  </button>
                  <p className="text-center text-[10px] text-zinc-500 mt-2">
                    Cette opération sera automatiquement inscrite au journal et un justificatif simulé sera ajouté au coffre-fort numérique.
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
