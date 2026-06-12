import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Save, CheckCircle2, Download, FileEdit } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { calculatePayroll, PayrollCalculation } from '../lib/tax-rules';
import { generatePayrollSlipDOCX } from '../lib/docx-generator';

export function PayrollSlipPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const slipData = location.state?.slipData;

  const [employeeName, setEmployeeName] = useState(slipData?.employeeName || '');
  const [role, setRole] = useState(slipData?.role || '');
  const [grossSalary, setGrossSalary] = useState<number>(slipData?.grossSalary || 0);
  const [netSalaryInput, setNetSalaryInput] = useState<number>(slipData?.netSalary || 0);
  const [useNetToGross, setUseNetToGross] = useState(!slipData?.grossSalary && slipData?.netSalary > 0);
  
  const [calc, setCalc] = useState<PayrollCalculation | null>(null);
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    async function fetchCompany() {
      if (user) {
        const snap = await getDoc(doc(db, 'companies', user.uid));
        if (snap.exists()) setCompany(snap.data());
      }
    }
    fetchCompany();
  }, [user]);

  // Naive Net to Gross approximation for immediate feedback if they typed net only
  useEffect(() => {
    if (useNetToGross && netSalaryInput > 0) {
      // Approximation brute -> net roughly 80%.
      let estimatedGross = netSalaryInput / 0.8;
      // Refine with actual calculation 
      for(let i=0; i<10; i++) {
         const currentNet = calculatePayroll(estimatedGross).netSalary;
         const diff = netSalaryInput - currentNet;
         if (Math.abs(diff) < 1) break;
         estimatedGross += diff * 1.25; // 1.25 factor to step up
      }
      setGrossSalary(Math.round(estimatedGross));
    }
  }, [netSalaryInput, useNetToGross]);

  useEffect(() => {
    if (grossSalary >= 0) {
      setCalc(calculatePayroll(grossSalary));
    }
  }, [grossSalary]);

  const handleSave = async () => {
    if (!user || !calc || !employeeName) return;
    
    // Create transaction of type 'PAYROLL'
    try {
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        type: 'PAYROLL',
        amountExclTax: calc.totalEmployerCost,
        vatAmount: 0,
        amountInclTax: calc.totalEmployerCost,
        date: new Date().toISOString().split('T')[0],
        category: 'Salaires & Charges',
        syscohadaCode: '66',
        vendorName: employeeName,
        fecValid: true,
        payrollDetails: {
          grossSalary: calc.grossSalary,
          netSalary: calc.netSalary,
          cnssEmployee: calc.cnssEmployee,
          cnssEmployer: calc.cnssEmployer,
          iuts: calc.iuts
        },
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }

    setSaved(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 2000);
  };

  const handleGenerateDOCX = async () => {
    if (!calc || !employeeName || !company) return;
    setIsGenerating(true);
    try {
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const now = new Date();
        const period = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        
        await generatePayrollSlipDOCX({
            company,
            employee: { name: employeeName, role },
            calc,
            period
        });
    } catch (error) {
        console.error("Error generating payroll docx:", error);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-serif text-text-title tracking-tight mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          Fiche de Paie (BF 2025)
        </h1>
        <p className="text-zinc-500 max-w-xl">
          Générez un bulletin de paie conforme à la réglementation et intégrez la charge totale à votre comptabilité.
        </p>
      </header>

      {saved ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 md:p-8 rounded-2xl flex flex-col items-center justify-center text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
          <h2 className="text-2xl font-serif text-emerald-100 mb-2">Bulletin validé !</h2>
          <p className="text-emerald-400/80">La charge salariale a été intégrée au registre des transactions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-luxury-800/50 border border-border-subtle p-6 rounded-2xl">
              <h2 className="text-lg font-medium text-gold-100 mb-4">Informations de l'Employé</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase text-zinc-500 mb-1">Nom Complet</label>
                  <input type="text" value={employeeName} onChange={e => setEmployeeName(e.target.value)} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs uppercase text-zinc-500 mb-1">Poste</label>
                  <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-luxury-800/50 border border-border-subtle p-6 rounded-2xl">
              <h2 className="text-lg font-medium text-gold-100 mb-4">Calcul du Salaire</h2>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="calcMode" checked={!useNetToGross} onChange={() => setUseNetToGross(false)} className="accent-blue-500" />
                  <span className="text-sm text-zinc-300">Saisie Brut</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="calcMode" checked={useNetToGross} onChange={() => setUseNetToGross(true)} className="accent-blue-500" />
                  <span className="text-sm text-zinc-300">Saisie Net (approx. vers Brut)</span>
                </label>
              </div>

              {useNetToGross ? (
                <div>
                  <label className="block text-xs uppercase text-zinc-500 mb-1">Salaire Net Souhaité</label>
                  <input type="number" value={netSalaryInput} onChange={e => setNetSalaryInput(Number(e.target.value))} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 focus:outline-none focus:border-blue-500" />
                </div>
              ) : (
                <div>
                  <label className="block text-xs uppercase text-zinc-500 mb-1">Salaire Brut</label>
                  <input type="number" value={grossSalary} onChange={e => setGrossSalary(Number(e.target.value))} className="w-full bg-luxury-900 border border-border-subtle rounded-lg px-4 py-2 text-gold-100 focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-luxury-900 border border-border-subtle p-6 rounded-2xl sticky top-6 shadow-xl">
              <h2 className="text-lg font-medium text-gold-100 mb-4 flex items-center justify-between border-b border-border-subtle pb-2">
                <span>Aperçu du Bulletin</span>
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">CGI 2025</span>
              </h2>
              
              {calc && (
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between text-zinc-300">
                    <span>Salaire Brut</span>
                    <span>{calc.grossSalary.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  
                  <div className="pt-2 border-t border-border-subtle/50 text-zinc-400">
                    <p className="text-[10px] uppercase tracking-wider mb-2 text-zinc-500">Retenues Salariales</p>
                    <div className="flex justify-between items-center mb-1">
                      <span>CNSS (5.5%)</span>
                      <span className="text-red-400">-{Math.round(calc.cnssEmployee).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span>IUTS (Progressif)</span>
                      <span className="text-red-400">-{Math.round(calc.iuts).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center text-lg font-serif">
                    <span className="text-gold-100">Salaire Net</span>
                    <span className="text-emerald-400">{Math.round(calc.netSalary).toLocaleString('fr-FR')} FCFA</span>
                  </div>

                  <div className="pt-4 border-t border-border-subtle/50 text-zinc-400">
                    <p className="text-[10px] uppercase tracking-wider mb-2 text-zinc-500">Charges Patronales</p>
                    <div className="flex justify-between items-center mb-1">
                      <span>CNSS Employeur + PF (19.5%)</span>
                      <span className="text-amber-400">+{Math.round(calc.cnssEmployer).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border-subtle flex justify-between items-center font-medium bg-luxury-800 p-3 rounded-lg">
                    <span className="text-zinc-300">Coût Total Entreprise</span>
                    <span className="text-blue-400">{Math.round(calc.totalEmployerCost).toLocaleString('fr-FR')} FCFA</span>
                  </div>

                  <button 
                    onClick={handleSave}
                    disabled={calc.grossSalary <= 0 || !employeeName || saved}
                    className="w-full mt-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    <Save className="w-5 h-5"/> Enregistrer la Charge
                  </button>

                  <button 
                    onClick={handleGenerateDOCX}
                    disabled={calc.grossSalary <= 0 || !employeeName || isGenerating}
                    className="w-full mt-3 py-3 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold hover:bg-blue-500/10 transition-all flex justify-center items-center gap-2"
                  >
                    <FileEdit className="w-5 h-5"/> Générer format Word (.docx)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
