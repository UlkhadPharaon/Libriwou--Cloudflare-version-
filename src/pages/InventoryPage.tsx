import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, AlertCircle, Tag, Trash2, ArrowUpRight, ArrowDownRight, Search, Filter, LayoutGrid, List as ListIcon, Edit2, Check, X, Calendar, FileText, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { localDb } from '../services/localDb';
import { cn } from '../lib/utils';

interface InventoryItem {
  userId?: string;
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lowStockAlert: number;
  sku?: string;
  category?: string;
  unit?: string;
}

const CATEGORIES = ['Électronique', 'Alimentation', 'Quincaillerie', 'Vêtements', 'Cosmétique', 'Autre'];
const UNITS = ['Unité', 'Carton', 'Kg', 'Litre', 'Pack', 'Palette'];

export function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // New Item State
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    name: '', quantity: 0, unitPrice: 0, lowStockAlert: 5, sku: '', category: 'Autre', unit: 'Unité'
  });

  // Movement State
  const [movementModalItem, setMovementModalItem] = useState<InventoryItem | null>(null);
  const [movementQty, setMovementQty] = useState<string>('');
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [movementDate, setMovementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [movementDesc, setMovementDesc] = useState<string>('');

  // History State
  const [historyModalItem, setHistoryModalItem] = useState<InventoryItem | null>(null);
  const [itemMovements, setItemMovements] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = localDb.subscribe('inventory', user.uid, (list) => {
      setItems(list as InventoryItem[]);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!historyModalItem || !user) {
      setItemMovements([]);
      return;
    }
    const unsub = localDb.subscribe('stock_movements', user.uid, (list) => {
      const filtered = list.filter((m: any) => m.itemId === historyModalItem.id);
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setItemMovements(filtered);
    });
    return () => unsub();
  }, [historyModalItem, user]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newItem.name) return;
    localDb.add('inventory', {
      userId: user.uid,
      name: newItem.name,
      quantity: Number(newItem.quantity) || 0,
      unitPrice: Number(newItem.unitPrice) || 0,
      lowStockAlert: Number(newItem.lowStockAlert) || 5,
      sku: newItem.sku || '',
      category: newItem.category || 'Autre',
      unit: newItem.unit || 'Unité'
    });
    setNewItem({ name: '', quantity: 0, unitPrice: 0, lowStockAlert: 5, sku: '', category: 'Autre', unit: 'Unité' });
    setIsAdding(false);
  };

  const deleteItem = async (id: string) => {
    if(confirm('Supprimer cet article définitivement ?')) {
      localDb.delete('inventory', id);
    }
  };

  const updateQuantity = async (id: string, current: number, delta: number) => {
    const newQ = Math.max(0, current + delta);
    localDb.update('inventory', id, { quantity: newQ });
    
    if (user) {
      const item = items.find(i => i.id === id);
      localDb.add('stock_movements', {
        userId: user.uid,
        itemId: id,
        itemName: item?.name || 'Unknown',
        type: delta > 0 ? 'IN' : 'OUT',
        quantity: Math.abs(delta),
        date: new Date().toISOString(),
        description: 'Ajustement rapide',
        previousQuantity: current,
        newQuantity: newQ,
        createdAt: new Date().toISOString()
      });
    }
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementModalItem || !movementQty || !user) return;
    
    const delta = Number(movementQty) * (movementType === 'IN' ? 1 : -1);
    const newQ = Math.max(0, movementModalItem.quantity + delta);
    localDb.update('inventory', movementModalItem.id, { quantity: newQ });
    
    localDb.add('stock_movements', {
      userId: user.uid,
      itemId: movementModalItem.id,
      itemName: movementModalItem.name,
      type: movementType,
      quantity: Number(movementQty),
      date: movementDate,
      description: movementDesc || (movementType === 'IN' ? 'Entrée de stock' : 'Sortie de stock'),
      previousQuantity: movementModalItem.quantity,
      newQuantity: newQ,
      createdAt: new Date().toISOString()
    });
    
    setMovementModalItem(null);
    setMovementQty('');
    setMovementDesc('');
    setMovementDate(new Date().toISOString().split('T')[0]);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const lowStockCount = items.filter(i => i.quantity <= i.lowStockAlert).length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER & KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-luxury-900/50 p-6 rounded-2xl border border-border-subtle">
        <div>
          <h1 className="text-3xl font-serif text-text-title tracking-tight mb-2 flex items-center gap-3">
            <Package className="w-8 h-8 text-gold-500" />
            Stock & Articles
          </h1>
          <p className="text-zinc-500 max-w-xl">
            Gérez votre catalogue, vos références, et suivez vos entrées/sorties en temps réel.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Valeur Totale du Stock</p>
            <p className="text-2xl font-mono text-gold-200">{totalValue.toLocaleString('fr-FR')} FCFA</p>
          </div>
          {lowStockCount > 0 && (
            <div className="text-right border-l border-zinc-700/50 pl-6">
              <p className="text-[10px] uppercase tracking-wider text-amber-500 flex items-center gap-1 justify-end"><AlertCircle className="w-3 h-3"/> Alertes Rupture</p>
              <p className="text-2xl font-mono text-amber-400">{lowStockCount} art.</p>
            </div>
          )}
          <button onClick={() => setIsAdding(!isAdding)} className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-[0_0_15px_rgba(212,175,55,0.2)] ml-auto">
            <Plus className="w-4 h-4" /> Nouvel Article
          </button>
        </div>
      </div>

      {/* ADD FORM */}
      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddItem} 
            className="bg-luxury-800 border border-gold-500/20 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 items-end shadow-xl overflow-hidden"
          >
            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Nom de l'article *</label>
              <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" placeholder="ex: Sac de ciment CimentG" />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">SKU/Réf</label>
              <input type="text" value={newItem.sku} onChange={e => setNewItem({...newItem, sku: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" placeholder="CIM-001" />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Catégorie</label>
              <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Unité</label>
              <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Quantité</label>
              <input type="number" min="0" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100" />
            </div>
            <div className="lg:col-span-1">
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Prix unitaire</label>
              <input type="number" min="0" required value={newItem.unitPrice} onChange={e => setNewItem({...newItem, unitPrice: Number(e.target.value)})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100" />
            </div>
            <div className="lg:col-span-1">
              <button type="submit" className="w-full h-[42px] bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-text-title rounded-lg font-medium transition-colors">
                Ajouter
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-luxury-800/30 p-2 border border-border-subtle rounded-xl">
        <div className="flex w-full sm:w-auto items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Rechercher (Nom, SKU)..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-luxury-900 border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <select 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full bg-luxury-900 border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-sm text-gold-100 focus:outline-none focus:border-gold-500/50 appearance-none"
            >
              <option value="ALL">Toutes Catégories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="flex bg-luxury-900 border border-border-subtle rounded-lg p-1">
          <button onClick={() => setViewMode('table')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'table' ? "bg-luxury-700 text-gold-400" : "text-zinc-500 hover:text-gold-200")}>
            <ListIcon className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('grid')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'grid' ? "bg-luxury-700 text-gold-400" : "text-zinc-500 hover:text-gold-200")}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {filteredItems.length === 0 ? (
        <div className="py-24 text-center text-zinc-500 border border-dashed border-border-subtle rounded-2xl bg-luxury-800/30">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun article trouvé.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto bg-luxury-800/50 rounded-2xl border border-border-subtle">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-luxury-900/50 border-b border-border-subtle">
              <tr>
                <th className="px-6 py-4 font-medium tracking-wider">Référence / Article</th>
                <th className="px-6 py-4 font-medium tracking-wider">Catégorie</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right">Prix Unitaire</th>
                <th className="px-6 py-4 font-medium tracking-wider text-center">En Stock</th>
                <th className="px-6 py-4 font-medium tracking-wider text-center">Mouvement</th>
                <th className="px-6 py-4 font-medium tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-luxury-800/80 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gold-100">{item.name}</div>
                    {item.sku && <div className="text-[10px] font-mono text-zinc-500">REF: {item.sku}</div>}
                  </td>
                  <td className="px-6 py-4 text-zinc-400">
                    <span className="bg-luxury-900 border border-border-subtle px-2 py-1 rounded text-xs">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-zinc-300">
                    {item.unitPrice.toLocaleString('fr-FR')} F
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <span className={cn("text-lg font-bold font-mono", item.quantity <= item.lowStockAlert ? "text-amber-500" : "text-emerald-400")}>
                        {item.quantity}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase">{item.unit || 'unit'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="p-1.5 bg-luxury-900 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 rounded" title="Entrée rapide (+1)"><ArrowUpRight className="w-3.5 h-3.5"/></button>
                      <button disabled={item.quantity === 0} onClick={() => updateQuantity(item.id, item.quantity, -1)} className="p-1.5 bg-luxury-900 text-red-400 border border-red-500/20 hover:bg-red-500/10 rounded disabled:opacity-30" title="Sortie rapide (-1)"><ArrowDownRight className="w-3.5 h-3.5"/></button>
                      <button onClick={() => { setMovementModalItem(item); setMovementType('IN'); setMovementQty(''); setMovementDesc(''); setMovementDate(new Date().toISOString().split('T')[0]); }} className="p-1.5 bg-luxury-900 text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 rounded text-[10px] font-bold" title="Enregistrer un mouvement">±N</button>
                      <button onClick={() => setHistoryModalItem(item)} className="p-1.5 bg-luxury-900 text-purple-400 border border-purple-500/20 hover:bg-purple-500/10 rounded text-[10px] font-bold" title="Historique"><History className="w-3.5 h-3.5"/></button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => deleteItem(item.id)} className="text-red-500/50 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map(item => (
            <motion.div key={item.id} layout className={cn("bg-luxury-800/80 border p-5 rounded-2xl flex flex-col gap-4 shadow-lg", item.quantity <= item.lowStockAlert ? "border-amber-500/50 shadow-amber-500/10" : "border-border-subtle")}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-gold-100 leading-tight mb-1">{item.name}</h3>
                  {item.sku && <p className="text-[10px] text-zinc-500 font-mono mb-1">REF: {item.sku}</p>}
                  <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono"><Tag className="w-3 h-3 text-gold-500"/> {item.unitPrice.toLocaleString('fr-FR')} F</p>
                </div>
                <button onClick={() => deleteItem(item.id)} className="text-red-500/50 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
              </div>
              
              <div className="flex items-center justify-between mt-auto bg-luxury-900/50 p-2.5 rounded-xl border border-border-subtle">
                <button disabled={item.quantity === 0} onClick={() => updateQuantity(item.id, item.quantity, -1)} className="p-2 bg-luxury-800 rounded-lg text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-colors"><ArrowDownRight className="w-4 h-4"/></button>
                <div className="text-center cursor-pointer" onClick={() => { setMovementModalItem(item); setMovementType('IN'); setMovementQty(''); setMovementDesc(''); setMovementDate(new Date().toISOString().split('T')[0]); }}>
                  <span className="text-2xl font-serif text-text-title px-4">{item.quantity}</span>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">{item.unit || 'en stock'}</span>
                </div>
                <button onClick={() => updateQuantity(item.id, item.quantity, 1)} className="p-2 bg-luxury-800 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors"><ArrowUpRight className="w-4 h-4"/></button>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => { setMovementModalItem(item); setMovementType('IN'); setMovementQty(''); setMovementDesc(''); setMovementDate(new Date().toISOString().split('T')[0]); }} className="flex-1 py-1.5 bg-luxury-900/50 hover:bg-luxury-800 border border-border-subtle text-xs text-blue-400 rounded-lg transition-colors">Mouvement</button>
                 <button onClick={() => setHistoryModalItem(item)} className="flex-1 py-1.5 bg-luxury-900/50 hover:bg-luxury-800 border border-border-subtle text-xs text-purple-400 rounded-lg transition-colors">Historique</button>
              </div>
              {item.quantity <= item.lowStockAlert && (
                <div className="text-[10px] text-amber-500 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1.5 rounded border border-amber-500/20 uppercase tracking-wider font-bold justify-center"><AlertCircle className="w-3 h-3"/> Alerte stock !</div>
              )}
            </motion.div>
          ))}
        </div>
      )}
      {/* MOVEMENT MODAL */}
      <AnimatePresence>
        {movementModalItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-luxury-800 border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-border-subtle flex justify-between items-center">
                <h3 className="text-xl font-serif text-gold-100">Enregistrer un mouvement</h3>
                <button onClick={() => setMovementModalItem(null)} className="text-zinc-500 hover:text-text-title transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleMovementSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Article</label>
                  <div className="text-gold-100 font-medium bg-luxury-900 border border-border-subtle p-2.5 rounded-lg flex justify-between items-center">
                    <span>{movementModalItem.name}</span> <span className="text-zinc-500 text-xs">({movementModalItem.quantity} en stock)</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Type de mouvement *</label>
                    <div className="flex bg-luxury-900 border border-border-subtle rounded-lg p-1">
                      <button type="button" onClick={() => setMovementType('IN')} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2", movementType === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-500 hover:bg-luxury-800')}>
                        <ArrowDownRight className="w-4 h-4"/> Entrée
                      </button>
                      <button type="button" onClick={() => setMovementType('OUT')} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2", movementType === 'OUT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-zinc-500 hover:bg-luxury-800')}>
                        <ArrowUpRight className="w-4 h-4"/> Sortie
                      </button>
                    </div>
                  </div>
                  <div className="w-1/3">
                    <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Quantité *</label>
                    <input autoFocus type="number" min="1" required value={movementQty} onChange={e => setMovementQty(e.target.value)} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Date *</label>
                  <input type="date" required value={movementDate} onChange={e => setMovementDate(e.target.value)} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100" style={{ colorScheme: 'dark' }} />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Description / Motif</label>
                  <textarea value={movementDesc} onChange={e => setMovementDesc(e.target.value)} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 resize-none h-20 placeholder-zinc-600 focus:outline-none focus:border-gold-500/50" placeholder="Ex: Achat fournisseur, retour client, perte..." />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setMovementModalItem(null)} className="px-5 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-luxury-700 transition-colors">Annuler</button>
                  <button type="submit" className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 hover:opacity-90 shadow-lg flex items-center gap-2">
                    <Check className="w-4 h-4"/> Valider {movementType === 'IN' ? "l'Entrée" : "la Sortie"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HISTORY MODAL */}
      <AnimatePresence>
        {historyModalItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-luxury-800 border border-border-subtle rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-border-subtle flex justify-between items-center bg-luxury-900/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-gold-100">Historique des mouvements</h3>
                    <p className="text-sm text-zinc-400">{historyModalItem.name} <span className="text-zinc-500 ml-1">({historyModalItem.sku || 'Sans REF'})</span></p>
                  </div>
                </div>
                <button onClick={() => setHistoryModalItem(null)} className="text-zinc-500 hover:text-text-title transition-colors p-2"><X className="w-5 h-5"/></button>
              </div>
              
              <div className="overflow-y-auto p-4 flex-1">
                {itemMovements.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Aucun mouvement enregistré pour cet article.</p>
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-zinc-800">
                    {itemMovements.map((mv) => (
                      <div key={mv.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* Icon marker */}
                        <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-luxury-800 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10", mv.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 'bg-red-500/20 text-red-400 border-red-500/20')}>
                          {mv.type === 'IN' ? <ArrowDownRight className="w-5 h-5"/> : <ArrowUpRight className="w-5 h-5"/>}
                        </div>
                        {/* Card */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-luxury-900 border border-border-subtle p-4 rounded-xl shadow-lg">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                             <div className="flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5 text-zinc-500"/>
                               <span className="text-xs font-mono text-zinc-400">{new Date(mv.date).toLocaleDateString('fr-FR')}</span>
                             </div>
                             <span className={cn("text-xs font-bold px-2 py-0.5 rounded", mv.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                               {mv.type === 'IN' ? '+' : '-'}{mv.quantity} {historyModalItem.unit}
                             </span>
                          </div>
                          {mv.description && <p className="text-sm text-gold-100/90 mb-3">{mv.description}</p>}
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono bg-luxury-800 p-2 rounded-lg border border-border-subtle mt-2">
                             <span className="flex-1 text-center line-through opacity-50">{mv.previousQuantity}</span>
                             <span className="text-gold-500">→</span>
                             <span className="flex-1 text-center font-bold text-gold-200">{mv.newQuantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

