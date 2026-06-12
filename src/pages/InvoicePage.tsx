import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  Plus, 
  CheckCircle2, 
  Trash2, 
  FileEdit,
  Download
} from 'lucide-react';
import { generateInvoiceDOCX } from '../lib/docx-generator';

async function generateFECFingerprint(companyId: string, amount: number, timestamp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${companyId}-${amount}-${timestamp}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface InvoiceElement {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number; // percentage
}

export function InvoicePage() {
  const location = useLocation();
  const [company, setCompany] = useState<any>(null);
  const [invoiceType, setInvoiceType] = useState<'FACTURE' | 'PROFORMA'>('PROFORMA');
  
  // Client info
  const [clientName, setClientName] = useState(location.state?.predefinedInvoice?.clientName || 'SITARA');
  const [clientIfu, setClientIfu] = useState('000012345G');
  const [clientRccm, setClientRccm] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Invoice terms
  const [dueDate, setDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  // Elements
  const [elements, setElements] = useState<InvoiceElement[]>([
    { 
      id: '1', 
      description: location.state?.predefinedInvoice?.description || 'Audit des comptes annuels', 
      quantity: 1, 
      unit: 'Forfait',
      unitPrice: location.state?.predefinedInvoice?.amountExclTax || 250000,
      discount: 0
    }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setCompany(docSnap.data());
        }
      });
      return () => unsubscribeCompany();
    });
    return () => unsubscribeAuth();
  }, []);

  const addElement = () => {
    setElements([...elements, { id: Math.random().toString(), description: '', quantity: 1, unit: 'U', unitPrice: 0, discount: 0 }]);
  };

  const removeElement = (id: string) => {
    if (elements.length > 1) {
      setElements(elements.filter(e => e.id !== id));
    }
  };

  const updateElement = (id: string, field: keyof InvoiceElement, value: any) => {
    setElements(elements.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const tvaRate = (company?.taxRegime === 'RSI' || company?.taxRegime === 'RNI') ? 0.18 : 0;
  
  // Calculations
  const calculateLineTotalHT = (el: InvoiceElement) => {
    const base = el.quantity * el.unitPrice;
    return base - (base * (el.discount / 100));
  };

  const numAmountHT = elements.reduce((acc, curr) => acc + calculateLineTotalHT(curr), 0);
  const tvaAmount = numAmountHT * tvaRate;
  const amountTTC = numAmountHT + tvaAmount;

  const handleGenerateDOCX = async () => {
    if (!company || elements.length === 0) return;
    setIsGenerating(true);
    try {
        const num = `F-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2, '0')}-${String(Math.floor(Math.random()*1000)).padStart(3, '0')}`;
        await generateInvoiceDOCX({
            company,
            client: {
                name: clientName,
                ifu: clientIfu,
                rccm: clientRccm,
                address: clientAddress,
                email: clientEmail,
                phone: clientPhone
            },
            invoiceType,
            invoiceNum: num,
            date: new Date().toLocaleDateString('fr-BF'),
            elements,
            totals: {
                ht: numAmountHT,
                tva: tvaAmount,
                ttc: amountTTC,
                tvaRate
            },
            terms: {
                dueDate,
                paymentMethod
            }
        });
        setSuccessMessage('Document Word généré avec succès.');
        setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
        console.error("Error generating DOCX:", error);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !auth.currentUser || elements.length === 0) return;
    setIsGenerating(true);

    try {
      // Generate Word instead of PDF
      await handleGenerateDOCX();

      if (invoiceType === 'FACTURE') {
        const timestampStr = new Date().toISOString();
        const fingerprint = await generateFECFingerprint(auth.currentUser.uid, numAmountHT, timestampStr);

        await addDoc(collection(db, 'transactions'), {
          userId: auth.currentUser.uid,
          type: 'INCOME',
          date: timestampStr.split('T')[0],
          amountExclTax: numAmountHT,
          amountInclTax: amountTTC,
          tvaAmount: tvaAmount,
          vendorName: clientName,
          category: 'Vente de services/produits',
          description: elements.map(e => `${e.quantity}x ${e.description}`).join(', '),
          fecFingerprint: fingerprint,
          createdAt: timestampStr,
          invoiceData: {
            clientName,
            clientIfu,
            clientRccm,
            clientAddress,
            clientEmail,
            clientPhone,
            dueDate,
            paymentMethod,
            elements
          }
        });

        setSuccessMessage('Facture générée. Enregistrée dans le coffre-fort numérique avec signature FEC.');
      } else {
        setSuccessMessage('Facture Proforma générée avec succès (non enregistrée en comptabilité).');
      }
      setTimeout(() => setSuccessMessage(''), 5000);

    } catch (error) {
      console.error("Error generating invoice:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100">Facturation</h1>
          <p className="text-zinc-400 font-sans">Créez des factures complètes (grossistes, prestataires...) et archivez-les dans le coffre-fort numérique.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full self-start md:self-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Prêt pour la FEC 2026</span>
        </div>
      </header>

      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 rounded-xl bg-money-500/10 border border-money-500/20 flex items-center gap-3 text-money-400 glow-green"
        >
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">{successMessage}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleGenerateInvoice} className="p-6 rounded-2xl bg-luxury-800/50 backdrop-blur-md border border-border-subtle space-y-8">
            
            {/* Type Document */}
            <div>
              <label className="block text-sm font-medium text-gold-500/70 mb-3">Type de document</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-border-subtle bg-bg-overlay/50 hover:bg-bg-overlay transition-colors">
                  <input type="radio" name="invoiceType" value="FACTURE" checked={invoiceType === 'FACTURE'} onChange={() => setInvoiceType('FACTURE')} className="text-gold-500 focus:ring-gold-500/40" />
                  <span className="text-gold-100 font-medium">Facture Définitive</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl border border-border-subtle bg-bg-overlay/50 hover:bg-bg-overlay transition-colors">
                  <input type="radio" name="invoiceType" value="PROFORMA" checked={invoiceType === 'PROFORMA'} onChange={() => setInvoiceType('PROFORMA')} className="text-gold-500 focus:ring-gold-500/40" />
                  <span className="text-gold-100 font-medium">Facture Proforma</span>
                </label>
              </div>
            </div>

            <div className="w-full h-px bg-border-subtle" />

            {/* Infos Client */}
            <div>
              <h3 className="text-lg font-serif text-gold-100 mb-4">Informations du Client</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Nom du Client / Entreprise *</label>
                  <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Ex: SITARA" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">IFU du Client *</label>
                  <input type="text" value={clientIfu} required onChange={(e) => setClientIfu(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="000012345G" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">RCCM</label>
                  <input type="text" value={clientRccm} onChange={(e) => setClientRccm(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="BF OUA 2020 B 1234" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Email</label>
                  <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="contact@sitara.bf" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Adresse Complète</label>
                  <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Secteur 12, Ouagadougou, Burkina Faso" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Téléphone</label>
                  <input type="text" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="+226 70 00 00 00" />
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-border-subtle" />

            {/* Elements */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-serif text-gold-100">Éléments facturés</h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Adapté pour grossistes / prestataires (unités, remises)</p>
                </div>
                <button type="button" onClick={addElement} className="text-xs flex items-center gap-1 bg-gold-500/10 text-gold-400 px-3 py-1.5 rounded-lg hover:bg-gold-500/20 transition-colors">
                  <Plus className="w-3 h-3" /> Ligne
                </button>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                  {elements.map((el, index) => (
                    <motion.div 
                      key={el.id} 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }} 
                      className="grid grid-cols-12 gap-2 items-start bg-bg-overlay/20 p-3 rounded-xl border border-border-subtle"
                    >
                      <div className="col-span-12 md:col-span-4">
                        <label className="block text-[10px] uppercase tracking-wider text-gold-500/50 mb-1">Description *</label>
                        <textarea 
                          required value={el.description} onChange={(e) => updateElement(el.id, 'description', e.target.value)} 
                          className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-gold-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 min-h-[40px]" 
                          placeholder="Ex: Audit de comptes" 
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider text-gold-500/50 mb-1">Unité</label>
                        <select
                          value={el.unit} onChange={(e) => updateElement(el.id, 'unit', e.target.value)}
                          className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
                        >
                          <option value="U">Unité (U)</option>
                          <option value="Kg">Kg</option>
                          <option value="T">Tonne (T)</option>
                          <option value="Heures">Heures</option>
                          <option value="Jours">Jours</option>
                          <option value="Forfait">Forfait</option>
                        </select>
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <label className="block text-[10px] uppercase tracking-wider text-gold-500/50 mb-1">Qté</label>
                        <input type="number" required min="0.1" step="0.1" value={el.quantity} onChange={(e) => updateElement(el.id, 'quantity', Number(e.target.value))} className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider text-gold-500/50 mb-1">P.U (HT)</label>
                        <input type="number" required min="0" value={el.unitPrice} onChange={(e) => updateElement(el.id, 'unitPrice', Number(e.target.value))} className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" />
                      </div>
                      <div className="col-span-10 md:col-span-2">
                        <label className="block text-[10px] uppercase tracking-wider text-gold-500/50 mb-1">Remise (%)</label>
                        <input type="number" min="0" max="100" value={el.discount} onChange={(e) => updateElement(el.id, 'discount', Number(e.target.value))} className="w-full bg-bg-overlay border border-border-subtle rounded-lg px-2 py-1.5 text-sm text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="0" />
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-end mt-4">
                        <button type="button" onClick={() => removeElement(el.id)} disabled={elements.length === 1} className="p-2 w-full flex justify-center text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="w-full h-px bg-border-subtle" />

            {/* Modalités */}
            <div>
              <h3 className="text-lg font-serif text-gold-100 mb-4">Modalités</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Date d'échéance</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gold-500/70 mb-1">Mode de Paiement</label>
                  <input type="text" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-bg-overlay border border-border-subtle rounded-xl px-4 py-2 text-gold-100 focus:outline-none focus:ring-2 focus:ring-gold-500/40" placeholder="Ex: Virement Bancaire, Mobile Money..." />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isGenerating || !clientName}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 text-zinc-900 font-semibold hover:from-gold-400 hover:to-gold-300 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(212,175,55,0.2)]"
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-luxury-900/20 border-t-luxury-900 rounded-full animate-spin" />
              ) : (
                <>
                  <FileEdit className="w-5 h-5" />
                  Générer en Word (.docx) et {invoiceType === 'FACTURE' ? "Archiver au Coffre" : 'Aperçu Proforma'}
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-luxury-800 to-luxury-700 border border-border-subtle sticky top-6 shadow-[0_0_20px_rgba(212,175,55,0.05)]">
            <h3 className="text-lg font-serif text-gold-100 mb-6">Aperçu des montants</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-gold-500/70">Montant HT (après remises)</span>
                <span className="font-medium text-gold-100">{new Intl.NumberFormat('fr-BF', { style: 'currency', currency: 'XOF' }).format(numAmountHT)}</span>
              </div>
              
              {tvaRate > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                  <span className="text-gold-500/70">TVA ({tvaRate * 100}%)</span>
                  <span className="font-medium text-gold-100">{new Intl.NumberFormat('fr-BF', { style: 'currency', currency: 'XOF' }).format(tvaAmount)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2 pt-4">
                <span className="text-lg font-serif text-gold-100">{tvaRate > 0 ? "Total TTC" : "Total à payer"}</span>
                <span className="text-xl font-bold text-money-400 glow-green">{new Intl.NumberFormat('fr-BF', { style: 'currency', currency: 'XOF' }).format(amountTTC)}</span>
              </div>
            </div>

            <div className="mt-8 p-4 bg-luxury-900 border border-border-subtle rounded-xl flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500/70" />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="text-emerald-400/80 font-medium block mb-1">Coffre-fort Numérique</span>
                La facture (PDF) sera automatiquement indexée et stockée dans votre coffre-fort fiscal pour un export rapide sous un format pro en fin de mois.
              </p>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-gold-500/5 border border-border-subtle text-sm text-zinc-400">
              <p className="mb-3">Mise en page dynamique. Format Word modifiable pour vos besoins.</p>
              <button 
                type="button" 
                onClick={handleGenerateDOCX}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gold-500 text-black rounded-lg hover:opacity-90 transition-opacity font-medium"
                disabled={isGenerating}
              >
                <FileEdit className="w-4 h-4" />
                Générer format Word (.docx)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

