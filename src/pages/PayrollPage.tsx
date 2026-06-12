import { useState, useEffect } from 'react';
import { Users, Plus, DollarSign, User, Phone, Mail, Calendar, Briefcase, FileText, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number; // Net Salary usually
  contractType?: string;
  department?: string;
  phone?: string;
  email?: string;
  status?: string;
  joinDate?: string;
}

const DEPARTMENTS = ['Direction', 'Commercial', 'Technique', 'Opérations', 'RH', 'Finance', 'Marketing', 'Autre'];
const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Prestation / Freelance', 'Apprenti'];
const STATUSES = ['Actif', 'En congé', 'Ancien'];

export function PayrollPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Employee>>({
    name: '', role: '', salary: 0, contractType: 'CDI', department: 'Autre', status: 'Actif', joinDate: new Date().toISOString().split('T')[0], phone: '', email: ''
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'employees'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });
    return () => unsub();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name) return;

    if (editingId) {
      await updateDoc(doc(db, 'employees', editingId), { ...formData, salary: Number(formData.salary) || 0 });
    } else {
      await addDoc(collection(db, 'employees'), {
        userId: user.uid,
        ...formData,
        salary: Number(formData.salary) || 0
      });
    }
    closeForm();
  };

  const closeForm = () => {
    setFormData({ name: '', role: '', salary: 0, contractType: 'CDI', department: 'Autre', status: 'Actif', joinDate: new Date().toISOString().split('T')[0], phone: '', email: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const openEdit = (emp: Employee) => {
    setFormData(emp);
    setEditingId(emp.id);
    setIsAdding(true);
  };

  const deleteEmp = async (id: string) => {
    if (confirm('Souhaitez-vous vraiment retirer ce collaborateur ?')) {
      await deleteDoc(doc(db, 'employees', id));
    }
  };

  const payEmployee = async (emp: Employee) => {
    if (!user) return;
    if (confirm(`Enregistrer le paiement du salaire de ${emp.name} (${emp.salary.toLocaleString('fr-FR')} FCFA) pour ce mois ?`)) {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'EXPENSE',
        amountExclTax: emp.salary,
        vatAmount: 0,
        amountInclTax: emp.salary,
        date: new Date().toISOString().split('T')[0],
        category: 'Salaires & Charges',
        syscohadaCode: '661',
        vendorName: emp.name,
        fecValid: true,
        createdAt: new Date().toISOString()
      });
      alert(`Salaire enregistré dans vos dépenses comptables (661 Charges de personnel) !`);
    }
  };

  const goToSlip = (emp: Employee) => {
    navigate('/payroll-slip', { state: { slipData: { employeeName: emp.name, role: emp.role, netSalary: emp.salary } } });
  };

  const totalPayroll = employees.reduce((acc, e) => acc + (Number(e.salary) || 0), 0);
  const activeCount = employees.filter(e => e.status !== 'Ancien').length;
  const cdiCount = employees.filter(e => e.contractType === 'CDI' && e.status !== 'Ancien').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* HEADER & KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-luxury-900/50 p-6 rounded-2xl border border-border-subtle">
        <div>
          <h1 className="text-3xl font-serif text-text-title tracking-tight mb-2 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            Équipe & Paie
          </h1>
          <p className="text-zinc-500 max-w-xl">
            Gérez vos collaborateurs, les contrats et générez vos fiches de paie.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Masse Salariale Mensuelle</p>
            <p className="text-2xl font-mono text-blue-400">{totalPayroll.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="text-right border-l border-zinc-700/50 pl-6">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Effectif Actif</p>
            <p className="text-2xl font-mono text-gold-100">{activeCount} <span className="text-sm text-zinc-500">dont {cdiCount} CDI</span></p>
          </div>
          <button onClick={() => { closeForm(); setIsAdding(true); }} className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] ml-auto">
            <Plus className="w-4 h-4" /> Nouveau Profil
          </button>
        </div>
      </div>

      {/* FORM */}
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSave} className="bg-luxury-800 border border-blue-500/20 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 shadow-xl relative">
              <button type="button" onClick={closeForm} className="absolute top-4 right-4 text-zinc-500 hover:text-text-title">✕</button>
              <h2 className="col-span-full text-lg font-serif text-gold-100 border-b border-border-subtle pb-2 mb-2">
                {editingId ? 'Modifier Profil' : 'Nouveau Profil Collaborateur'}
              </h2>
              
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Prénom & Nom *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Rôle / Poste</label>
                <input type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" placeholder="Ex: Développeur Senior" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Département</label>
                <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100">
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Type de contrat</label>
                <select value={formData.contractType} onChange={e => setFormData({...formData, contractType: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100">
                  {CONTRACTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Statut</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100">
                  {STATUSES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Date d'embauche</label>
                <input type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100" style={{ colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Téléphone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 placeholder-zinc-600" />
              </div>

              <div className="col-span-full border-t border-border-subtle mt-2 pt-4 flex gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Salaire Mensuel net HT *</label>
                  <input type="number" required min="0" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="w-full md:w-1/2 bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 font-mono" placeholder="0 FCFA" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-lg px-8 py-2.5 font-medium transition-colors">
                    {editingId ? 'Sauvegarder les modifications' : 'Créer le profil'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LISTING */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(emp => (
          <motion.div layout key={emp.id} className={cn("bg-luxury-800/80 border border-border-subtle p-6 rounded-2xl flex flex-col gap-5 shadow-lg", emp.status === 'Ancien' && "opacity-60")}>
            
            {/* CARD HEADER */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full hidden sm:flex bg-luxury-900 border border-border-subtle items-center justify-center">
                  <User className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gold-100 leading-tight">{emp.name}</h3>
                  <p className="text-sm text-blue-400">{emp.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(emp)} className="text-zinc-500 hover:text-gold-200 p-1 transition-colors"><Edit2 className="w-4 h-4"/></button>
                <button onClick={() => deleteEmp(emp.id)} className="text-zinc-500 hover:text-red-500 p-1 transition-colors"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
            
            {/* CARD DETAILS */}
            <div className="space-y-2 text-sm text-zinc-400 bg-luxury-900/30 p-3 rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2">
                 <Briefcase className="w-4 h-4 text-zinc-500" />
                 <span className="flex-1">{emp.department || 'Non assigné'}</span>
                 <span className="text-[10px] bg-luxury-800 border border-border-subtle px-2 py-0.5 rounded uppercase tracking-wider">{emp.contractType || 'CDI'}</span>
              </div>
              {(emp.phone || emp.email) && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-zinc-500" />
                  <span className="flex-1 truncate">{emp.phone || emp.email}</span>
                </div>
              )}
              {emp.joinDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <span>Depuis le {new Date(emp.joinDate).toLocaleDateString('fr-FR')}</span>
                  {emp.status && (
                    <span className={cn("ml-auto text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider", 
                      emp.status === 'Actif' ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" : 
                      emp.status === 'En congé' ? "text-amber-400 border-amber-500/20 bg-amber-500/10" : 
                      "text-zinc-400 border-zinc-500/20 bg-zinc-500/10"
                    )}>{emp.status}</span>
                  )}
                </div>
              )}
            </div>
            
            {/* PAYROLL ACTIONS */}
            <div className="mt-auto space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-500">Salaire Mensuel</span>
                <span className="font-mono font-medium text-gold-200">{(Number(emp.salary) || 0).toLocaleString('fr-FR')} F</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle/50">
                <button 
                  onClick={() => payEmployee(emp)} 
                  disabled={emp.status === 'Ancien'}
                  className="flex flex-col items-center justify-center gap-1 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-50 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-all"
                >
                  <DollarSign className="w-4 h-4"/>
                  Payer
                </button>
                <button 
                  onClick={() => goToSlip(emp)}
                  disabled={emp.status === 'Ancien'}
                  className="flex flex-col items-center justify-center gap-1 py-2 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-all"
                >
                  <FileText className="w-4 h-4"/>
                  Bulletin
                </button>
              </div>
            </div>

          </motion.div>
        ))}
        
        {employees.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center text-zinc-500 border border-dashed border-border-subtle rounded-2xl bg-luxury-800/30">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            Aucun collaborateur enregistré dans l'entreprise. <br/> Cliquez sur "Nouveau Profil" pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}

