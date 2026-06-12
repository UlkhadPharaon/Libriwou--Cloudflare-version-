import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  PenTool, 
  Camera, 
  Plus, 
  Trash2, 
  Wifi, 
  WifiOff, 
  Check, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { extractTransactionFromFile, ExtractedTransaction } from '../services/nim';
import { auth, db } from '../firebase';
import { localDb } from '../services/localDb';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { ErrorReporter } from '../components/ErrorReporter';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { cn } from '../lib/utils';

interface ManualItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function ScanPage() {
  // Connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');

  // Scanner States
  const [files, setFiles] = useState<File[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedTransaction | null>(null);
  const [processedResults, setProcessedResults] = useState<Array<{file: File, data: ExtractedTransaction, saved: boolean}>>([]);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('XOF');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [updateInventory, setUpdateInventory] = useState(true);

  // Manual Input States
  const [manualType, setManualType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [manualVendor, setManualVendor] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [manualCategory, setManualCategory] = useState('Fournitures et bureau');
  const [manualInclTax, setManualInclTax] = useState<number | string>('');
  const [manualHasVat, setManualHasVat] = useState(false);
  const [manualVat, setManualVat] = useState<number>(0);
  const [manualExclTax, setManualExclTax] = useState<number>(0);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);

  // Listen for connection changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Simple auto-calculation of pre-tax (HT) & TVA (18%)
  useEffect(() => {
    const amountTTC = Number(manualInclTax) || 0;
    if (manualHasVat) {
      // 18% standard rate
      const calculatedHT = Math.round((amountTTC / 1.18) * 100) / 100;
      const calculatedTVA = Math.round((amountTTC - calculatedHT) * 100) / 100;
      setManualExclTax(calculatedHT);
      setManualVat(calculatedTVA);
    } else {
      setManualExclTax(amountTTC);
      setManualVat(0);
    }
  }, [manualInclTax, manualHasVat]);

  // Handle auto-calculating total when line items change (optional)
  const handleRecalculateFromItems = () => {
    if (manualItems.length === 0) return;
    const totalHT = manualItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const totalTVA = manualHasVat ? Math.round((totalHT * 0.18) * 100) / 100 : 0;
    const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;
    
    setManualInclTax(totalTTC);
    setManualExclTax(totalHT);
    setManualVat(totalTVA);
  };

  // Map category to a typical SYSCOHADA code behind-the-scenes
  const getSyscohadaCode = (categoryName: string, type: 'INCOME' | 'EXPENSE'): string => {
    if (type === 'INCOME') {
      if (categoryName.includes('Vente')) return '701';
      return '706'; // Services
    } else {
      if (categoryName.includes('Achat de marchandises')) return '601';
      if (categoryName.includes('Fournitures')) return '605';
      if (categoryName.includes('Transport')) return '616';
      if (categoryName.includes('Loyers')) return '622';
      if (categoryName.includes('Salaires')) return '66';
      return '63'; // Autres charges externes
    }
  };

  const analyzeFile = async (selectedFile: File) => {
    setIsAnalyzing(true);
    setExtractedData(null);
    setError(null);

    try {
      if (!navigator.onLine) {
        throw new Error("L'appareil semble hors-ligne. L'analyse photo requiert internet.");
      }
      const data = await extractTransactionFromFile(selectedFile);
      setExtractedData(data);
      const extractedCurrency = data.currency || 'XOF';
      setCurrency(extractedCurrency);
      if (extractedCurrency === 'EUR') setExchangeRate(655.957);
      else if (extractedCurrency === 'USD') setExchangeRate(600);
      else setExchangeRate(1);
    } catch (error: any) {
      console.error("Error analyzing file:", error);
      const errMsg = error.message?.includes("hors-ligne") 
        ? "L'analyse automatique par photo n'est pas disponible hors-ligne. Veuillez utiliser la saisie manuelle."
        : `Impossible d'analyser le document ${selectedFile.name}. Vérifiez qu'il est bien lisible.`;
      setError(errMsg);
      ErrorReporter.report(errMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setFiles(acceptedFiles);
    setCurrentIndex(0);
    setProcessedResults([]);
    await analyzeFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    }
  });

  // Save parsed transaction (AI scanner path)
  const handleSave = async () => {
    if (!extractedData || !auth.currentUser || currentIndex >= files.length) return;

    try {
      const originalAmountExclTax = Number(extractedData.amountExclTax) || 0;
      const originalVatAmount = Number(extractedData.vatAmount) || 0;
      const originalAmountInclTax = Number(extractedData.amountInclTax) || 0;

      // Local Database Saving (100% private, never leaves device)
      localDb.add('transactions', {
        ...extractedData,
        currency,
        exchangeRate,
        originalAmountExclTax,
        originalAmountInclTax,
        amountExclTax: originalAmountExclTax * exchangeRate,
        vatAmount: originalVatAmount * exchangeRate,
        amountInclTax: originalAmountInclTax * exchangeRate,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });

      // Update Inventory
      if (updateInventory && extractedData.lineItems && extractedData.lineItems.length > 0) {
        for (const item of extractedData.lineItems) {
          if (!item.description || !item.quantity) continue;
          
          const allInv = localDb.getAll('inventory', auth.currentUser.uid);
          const matchedItem = allInv.find(inv => inv.name === item.description);
          
          const unitPriceXOF = Number(item.unitPrice) * exchangeRate;
          const qty = Number(item.quantity) || 1;

          let itemId = '';
          let previousQty = 0;
          let newQty = qty;

          if (matchedItem) {
            itemId = matchedItem.id;
            previousQty = matchedItem.quantity || 0;
            newQty = previousQty + qty;

            localDb.update('inventory', itemId, {
               quantity: newQty,
               unitPrice: unitPriceXOF 
            });
          } else {
            itemId = localDb.add('inventory', {
              userId: auth.currentUser.uid,
              name: item.description,
              quantity: qty,
              unitPrice: unitPriceXOF,
              lowStockAlert: 5,
              category: 'Autre',
              unit: 'Unité'
            });
          }

          localDb.add('stock_movements', {
            userId: auth.currentUser.uid,
            itemId: itemId,
            itemName: item.description,
            type: 'IN',
            quantity: qty,
            date: new Date().toISOString().split('T')[0],
            description: `Achat fournisseur (Photo): ${extractedData.vendorName || 'Inconnu'}`,
            previousQuantity: previousQty,
            newQuantity: newQty,
            createdAt: new Date().toISOString()
          });
        }
      }

      const currentFile = files[currentIndex];
      setProcessedResults(prev => [...prev, { file: currentFile, data: extractedData, saved: true }]);
      
      const nextIndex = currentIndex + 1;
      if (nextIndex < files.length) {
        setCurrentIndex(nextIndex);
        await analyzeFile(files[nextIndex]);
      } else {
        setExtractedData(null);
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      const errMsg = "Erreur lors de l'enregistrement.";
      setError(errMsg);
      ErrorReporter.report(errMsg);
    }
  };

  // Save manual entry transaction (offline/online friendly)
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (!manualVendor.trim()) {
      setError("Veuillez indiquer le commerçant ou le client.");
      return;
    }
    const amountVal = Number(manualInclTax);
    if (!amountVal || amountVal <= 0) {
      setError("Veuillez entrer un montant valide supérieur à 0.");
      return;
    }

    setIsSavingManual(true);
    setError(null);
    setManualSuccessMsg(null);

    try {
      const computedSyscohada = getSyscohadaCode(manualCategory, manualType);
      
      const payload: ExtractedTransaction = {
        type: manualType,
        syscohadaCode: computedSyscohada,
        vendorName: manualVendor,
        description: manualDescription || `${manualType === 'EXPENSE' ? 'Achat' : 'Vente'} - ${manualCategory}`,
        date: manualDate,
        category: manualCategory,
        fecValid: true,
        currency: 'XOF',
        exchangeRate: 1,
        amountInclTax: amountVal,
        amountExclTax: manualExclTax,
        vatAmount: manualVat,
        originalAmountInclTax: amountVal,
        originalAmountExclTax: manualExclTax,
        lineItems: manualItems.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amountExclTax: it.quantity * it.unitPrice
        }))
      };

      // Add to Local Database (100% private, never leaves device)
      localDb.add('transactions', {
        ...payload,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });

      // Update Stock (analogous lock)
      if (updateInventory && manualItems.length > 0) {
        for (const item of manualItems) {
          const allInv = localDb.getAll('inventory', auth.currentUser.uid);
          const matchedItem = allInv.find(inv => inv.name === item.description);
          
          let itemId = '';
          let prevQty = 0;
          let finalQty = item.quantity;
          const movementType = manualType === 'EXPENSE' ? 'IN' : 'OUT';

          if (matchedItem) {
            itemId = matchedItem.id;
            prevQty = matchedItem.quantity || 0;
            // Expense adds products, Income sells products (reduces)
            finalQty = movementType === 'IN' ? (prevQty + item.quantity) : (prevQty - item.quantity);
            
            localDb.update('inventory', itemId, {
              quantity: finalQty,
              unitPrice: item.unitPrice
            });
          } else {
            itemId = localDb.add('inventory', {
              userId: auth.currentUser.uid,
              name: item.description,
              quantity: finalQty,
              unitPrice: item.unitPrice,
              lowStockAlert: 5,
              category: manualCategory,
              unit: 'Unité'
            });
          }

          localDb.add('stock_movements', {
            userId: auth.currentUser.uid,
            itemId,
            itemName: item.description,
            type: movementType,
            quantity: item.quantity,
            date: manualDate,
            description: manualType === 'EXPENSE' ? `Achat fournisseur (Manuel): ${manualVendor}` : `Vente client (Manuel): ${manualVendor}`,
            previousQuantity: prevQty,
            newQuantity: finalQty,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Clear form
      setManualVendor('');
      setManualDescription('');
      setManualInclTax('');
      setManualItems([]);
      
      const successMessage = "Reçu enregistré avec succès ! Données stockées localement en toute sécurité sur votre appareil.";
      setManualSuccessMsg(successMessage);
    } catch (manualErr: any) {
      console.error("Manual save failed:", manualErr);
      setError("Erreur d'enregistrement manuel.");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleAddManualItem = () => {
    setManualItems(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveManualItem = (index: number) => {
    setManualItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateManualItem = (index: number, field: keyof ManualItem, val: string | number) => {
    setManualItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          [field]: field === 'description' ? val : Number(val) || 0
        };
      }
      return item;
    }));
  };

  const currentFile = files[currentIndex];
  const allSaved = files.length > 0 && processedResults.length === files.length;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto font-sans">
      
      {/* Network / Synchronization Reassurance Pill */}
      <div className={cn(
        "mb-6 px-4 py-3 rounded-2xl flex items-center justify-between transition-all",
        isOnline 
          ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/10" 
          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
      )}>
        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
          ) : (
            <WifiOff className="w-5 h-5 shrink-0" />
          )}
          <div className="text-xs">
            <span className="font-bold flex items-center gap-1.5 text-emerald-400">
              Mode Local-First Actif 🔒
            </span>
            <p className="text-zinc-400 mt-0.5">
              Vos données fiscales et comptables restent à 100% sur cet appareil et ne sont jamais envoyées sur internet. Seul l'abonnement est vérifié en toute sécurité.
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10">
          UEMOA • SYSCOHADA
        </span>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100">Enregistrer une facture ou un reçu</h1>
        <p className="text-zinc-400 text-sm">Choisissez la méthode la plus simple pour vous aujourd'hui.</p>
      </header>

      {/* Tabs Menu */}
      <div className="grid grid-cols-2 bg-luxury-900 p-1.5 rounded-2xl border border-white/5 mb-8">
        <button
          onClick={() => { setActiveTab('scan'); setError(null); setManualSuccessMsg(null); }}
          className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all",
            activeTab === 'scan' ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
          )}
        >
          <Camera className="w-4 h-4" />
          Prendre en photo / Scanner
        </button>
        <button
          onClick={() => { setActiveTab('manual'); setError(null); setManualSuccessMsg(null); }}
          className={cn(
            "flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all",
            activeTab === 'manual' ? "bg-white text-zinc-950 shadow" : "text-zinc-400 hover:text-white"
          )}
        >
          <PenTool className="w-4 h-4" />
          Saisie manuelle rapide
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {manualSuccessMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p>{manualSuccessMsg}</p>
        </div>
      )}

      {/* SCANNER TAB */}
      {activeTab === 'scan' && (
        <>
          {files.length === 0 && (
            <div 
              {...getRootProps()} 
              className={`
                border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all duration-300 backdrop-blur-sm
                ${isDragActive ? 'border-gold-500 bg-gold-500/5 glow-gold' : 'border-gold-500/20 hover:border-gold-500/50 hover:bg-gold-500/5'}
              `}
            >
              <input {...getInputProps()} />
              <div className="w-16 h-16 mx-auto rounded-full bg-gold-500/10 flex items-center justify-center mb-5 border border-gold-500/20">
                <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-gold-400' : 'text-gold-500/70'}`} />
              </div>
              <h3 className="text-lg font-serif text-gold-100 mb-1">Glissez-déposez vos reçus ou photos ici</h3>
              <p className="text-gold-500/60 text-xs mb-4">Sélectionnez une ou plusieurs images (JPG, PNG) ou fichiers PDF</p>
              
              {!isOnline && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-[10px] font-medium mx-auto justify-center mt-2">
                  <WifiOff className="w-3 h-3" />
                  Note : L'analyse IA nécessite Internet. Utilisez la Saisie Manuelle si vous êtes déconnecté.
                </div>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {files.map((f, i) => {
                const isProcessed = processedResults.some(r => r.file === f);
                const isCurrent = i === currentIndex && !allSaved;
                return (
                  <div 
                    key={i}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-medium flex items-center gap-2 border transition-all",
                      isCurrent ? "bg-gold-500/20 border-gold-500 text-gold-300" :
                      isProcessed ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                      "bg-luxury-800 border-white/5 text-zinc-500"
                    )}
                  >
                    {isProcessed ? <CheckCircle2 className="w-3 h-3" /> : (isCurrent ? <Loader2 className="w-3 h-3 animate-spin"/> : <FileText className="w-3 h-3"/>)}
                    {f.name}
                  </div>
                );
              })}
              {allSaved && (
                 <button 
                   onClick={() => { setFiles([]); setProcessedResults([]); setCurrentIndex(0); setExtractedData(null); }}
                   className="ml-auto text-xs text-gold-400 hover:text-gold-300 underline"
                 >
                   Scanner d'autres documents
                 </button>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentFile && !allSaved && (
              <motion.div 
                key={currentFile.name}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-luxury-800 border border-white/5 rounded-3xl p-6 shadow-xl"
              >
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center border border-gold-500/20">
                      <FileText className="w-4 h-4 text-gold-400" />
                    </div>
                    <div>
                       <p className="text-[9px] text-zinc-500 uppercase tracking-widest">Analyse photo en cours ({currentIndex + 1} / {files.length})</p>
                       <h4 className="font-medium text-gold-100 truncate max-w-[200px] text-sm">{currentFile.name}</h4>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => { setFiles([]); setProcessedResults([]); setExtractedData(null); }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 uppercase font-semibold"
                  >
                    Tout annuler
                  </button>
                </div>

                {isAnalyzing ? (
                  <div className="py-16 flex flex-col items-center justify-center text-zinc-400">
                    <Loader2 className="w-9 h-9 animate-spin mb-3 text-gold-400" />
                    <p className="font-serif text-lg text-white">L'assistant étudie votre photo...</p>
                    <p className="text-xs mt-1 text-zinc-500">Extraction automatique de la date et des prix en cours</p>
                  </div>
                ) : extractedData ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Type input */}
                      <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl">
                        <label className="block text-[10px] text-zinc-500 uppercase mb-1">Catégorie d'activité</label>
                        <select 
                           value={extractedData.type}
                           onChange={(e) => setExtractedData({...extractedData, type: e.target.value as 'INCOME' | 'EXPENSE'})}
                           className="w-full bg-transparent border-none focus:outline-none text-sm text-white font-medium py-1"
                        >
                           <option value="EXPENSE" className="text-black text-sm">Dépense (Achat de marchandises / Charges)</option>
                           <option value="INCOME" className="text-black text-sm">Recette / Vente (Entrée de caisse)</option>
                        </select>
                      </div>

                      <DataField label="Nom du Commercant / Client" value={extractedData.vendorName || ''} onChange={(val) => setExtractedData({ ...extractedData, vendorName: val })} />
                      <DataField label="Date" value={extractedData.date} onChange={(val) => setExtractedData({ ...extractedData, date: val })} type="date" />
                      <DataField label="Catégorie" value={extractedData.category} onChange={(val) => setExtractedData({ ...extractedData, category: val })} />
                      
                      <div className="md:col-span-2 grid grid-cols-2 gap-4 p-3 rounded-xl bg-luxury-900/50 border border-white/5">
                        <div>
                          <label className="block text-[10px] text-zinc-500 mb-1 uppercase text-left">Devise</label>
                          <input 
                            type="text" 
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                          />
                        </div>
                        {currency !== 'XOF' && currency !== 'CFA' && currency !== 'FCFA' && (
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-1 uppercase text-left">Taux F CFA</label>
                            <input 
                              type="number" 
                              step="0.01"
                              value={exchangeRate}
                              onChange={(e) => setExchangeRate(Number(e.target.value))}
                              className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <DataField label={`Montant HT (${currency})`} value={extractedData.amountExclTax} onChange={(val) => setExtractedData({ ...extractedData, amountExclTax: Number(val) })} type="number" highlight />
                      <DataField label={`Montant de la TVA (${currency})`} value={extractedData.vatAmount} onChange={(val) => setExtractedData({ ...extractedData, vatAmount: Number(val) })} type="number" />
                      <DataField label={`Montant Total TTC (${currency})`} value={extractedData.amountInclTax} onChange={(val) => setExtractedData({ ...extractedData, amountInclTax: Number(val) })} type="number" />
                      
                      {/* Sub-label for auto stock */}
                      <div className="md:col-span-2 flex items-center gap-3 py-2">
                        <input 
                          type="checkbox" 
                          id="updateInventoryScan" 
                          checked={updateInventory}
                          onChange={(e) => setUpdateInventory(e.target.checked)}
                          className="rounded border-zinc-700 bg-zinc-800 text-gold-500 focus:ring-gold-500"
                        />
                        <label htmlFor="updateInventoryScan" className="text-xs text-zinc-400 select-none cursor-pointer">
                          Ajouter automatiquement les produits détectés au stock
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-white/5">
                      <button 
                        onClick={handleSave}
                        className="bg-gold-500 text-zinc-950 px-6 py-3 rounded-xl text-xs font-bold hover:bg-gold-400 transition-all flex items-center gap-2"
                      >
                        Enregistrer & Continuer
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </motion.div>
            )}

            {allSaved && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-10 flex flex-col items-center justify-center text-emerald-400 bg-luxury-900 rounded-3xl border border-emerald-500/10">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-serif text-white mb-1">Tous les reçus ont été enregistrés ({files.length})</h3>
                <p className="text-zinc-500 text-xs mb-5">Votre livre de comptes a été ajusté de manière transparente.</p>
                <button 
                  onClick={() => { setFiles([]); setProcessedResults([]); setCurrentIndex(0); setExtractedData(null); }}
                  className="px-5 py-2 bg-white text-zinc-950 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
                >
                  Scanner d'autres photos
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* MANUAL ENTRY TAB (100% OFFLINE CAPABLE) */}
      {activeTab === 'manual' && (
        <motion.form 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSaveManual}
          className="bg-luxury-800 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-white/5">
             <div className="w-10 h-10 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center text-gold-400">
               <PenTool className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-lg font-serif text-white">Saisie Libre & Rapide</h2>
                <p className="text-xs text-zinc-400">Entrepreneurs d'Afrique de l'Ouest : remplissez ce formulaire simplifié.</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Income or Expense */}
            <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl">
              <label className="block text-[10px] text-zinc-500 uppercase mb-1.5 text-left">Nature du mouvement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setManualType('EXPENSE')}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs font-bold border transition-all",
                    manualType === 'EXPENSE' 
                      ? "bg-red-500/10 border-red-500/30 text-red-400" 
                      : "bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Dépense (Achat / Sortie)
                </button>
                <button
                  type="button"
                  onClick={() => setManualType('INCOME')}
                  className={cn(
                    "py-2 px-3 rounded-lg text-xs font-bold border transition-all",
                    manualType === 'INCOME' 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : "bg-black/20 border-white/5 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Recette (Vente / Entrée)
                </button>
              </div>
            </div>

            {/* Date */}
            <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl">
              <label className="block text-[10px] text-zinc-500 uppercase mb-1 text-left">Date</label>
              <input 
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none font-medium py-1.5"
                required
              />
            </div>

            {/* Vendor / Client */}
            <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl">
              <label className="block text-[10px] text-zinc-500 uppercase mb-1 text-left">
                {manualType === 'EXPENSE' ? 'Nom du Fournisseur / Commerçant' : 'Nom du Client'}
              </label>
              <input 
                type="text"
                value={manualVendor}
                onChange={(e) => setManualVendor(e.target.value)}
                placeholder={manualType === 'EXPENSE' ? "Ex: Quincaillerie Centrale, Station Shell" : "Ex: Client Tapsoba Adama"}
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none font-medium py-1.5 placeholder:text-zinc-600"
                required
              />
            </div>

            {/* Category selection */}
            <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl">
              <label className="block text-[10px] text-zinc-500 uppercase mb-1 text-left">Catégorie simplifiée de marchandise</label>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none font-medium py-1"
              >
                {manualType === 'EXPENSE' ? (
                  <>
                    <option value="Achat de marchandises" className="text-black">Achat de marchandises (pour revendre)</option>
                    <option value="Fournitures et bureau" className="text-black">Fournitures, outils et petits matériels de bureau</option>
                    <option value="Transport" className="text-black">Transport et déplacements</option>
                    <option value="Loyers et charges" className="text-black">Loyers, Eau et Électricité</option>
                    <option value="Salaires" className="text-black">Rémunération et petits salaires</option>
                    <option value="Autre charge" className="text-black">Autre chose</option>
                  </>
                ) : (
                  <>
                    <option value="Vente de marchandises" className="text-black">Vente de stock ou produits finis</option>
                    <option value="Prestation de services" className="text-black">Service rendu ou main d'œuvre</option>
                    <option value="Autre produit" className="text-black font-sans">Autre recette</option>
                  </>
                )}
              </select>
            </div>

            {/* Simple Description */}
            <div className="md:col-span-2 p-3 bg-luxury-900 border border-white/5 rounded-xl">
              <label className="block text-[10px] text-zinc-500 uppercase mb-1 text-left">Notes libre / Description courte</label>
              <input 
                type="text"
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                placeholder="Ex: Achat de 2 sacs de ciment pour le chantier"
                className="w-full bg-transparent border-none text-white text-sm focus:outline-none font-medium py-1.5 placeholder:text-zinc-600"
              />
            </div>

            {/* Total TTC (the base payment) */}
            <div className="p-3 bg-gold-500/5 border border-gold-500/20 rounded-xl relative">
              <label className="block text-[10px] text-gold-400 uppercase mb-1 text-left">Montant total payé TTC (F CFA)</label>
              <input 
                type="number"
                value={manualInclTax}
                onChange={(e) => setManualInclTax(e.target.value !== '' ? Number(e.target.value) : '')}
                placeholder="Ex: 25000"
                className="w-full bg-transparent border-none text-gold-200 text-lg font-serif focus:outline-none py-1 placeholder:text-zinc-600"
                min="1"
                required
              />
            </div>

            {/* VAT Checkbox & Details */}
            <div className="p-3 bg-luxury-900 border border-white/5 rounded-xl flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  id="manualHasVat"
                  checked={manualHasVat}
                  onChange={(e) => setManualHasVat(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-gold-500 focus:ring-gold-500"
                />
                <label htmlFor="manualHasVat" className="text-xs text-zinc-300 font-medium cursor-pointer select-none">
                  Cette facture contient de la TVA (18%)
                </label>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">Calcule les montants HT et TVA automatiquement pour vous.</p>
            </div>

            {/* Precalculated Preview */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4 p-4 rounded-xl bg-black/30 border border-white/5 text-xs text-zinc-400">
               <div>
                  <span className="block text-[10px] text-zinc-500 mb-1 uppercase text-left">Montant pré-calculé Sans Taxe (HT)</span>
                  <p className="text-sm text-zinc-200 font-medium font-mono">{manualExclTax.toLocaleString()} F CFA</p>
               </div>
               <div>
                  <span className="block text-[10px] text-zinc-500 mb-1 uppercase text-left">Montant de la TVA (18%)</span>
                  <p className="text-sm text-zinc-200 font-medium font-mono">{manualVat.toLocaleString()} F CFA</p>
               </div>
            </div>
          </div>

          {/* Line Items stock list (Optional) */}
          <div className="pt-4 border-t border-white/5 space-y-4">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-sm font-semibold text-white">Détail des articles vendus ou achetés (Optionnel)</h3>
                   <p className="text-[11px] text-zinc-500 font-sans">Ajoutez les produits si vous souhaitez mettre à jour automatiquement votre stock.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="group flex items-center gap-1.5 px-3 py-1.5 bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 rounded-lg text-xs font-semibold transition-all border border-gold-500/20"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  Ajouter un produit
                </button>
             </div>

             {manualItems.length > 0 && (
                <div className="space-y-3">
                   {manualItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-xl bg-luxury-900/50 border border-white/5">
                         <div className="md:col-span-5">
                            <label className="block text-[9px] text-zinc-500 mb-1 uppercase text-left">Nom de l'article</label>
                            <input 
                              type="text"
                              required
                              value={item.description}
                              onChange={(e) => handleUpdateManualItem(idx, 'description', e.target.value)}
                              placeholder="Fils électriques, Sac de ciment, etc."
                              className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500/50 placeholder:text-zinc-650"
                            />
                         </div>
                         <div className="md:col-span-2">
                            <label className="block text-[9px] text-zinc-500 mb-1 uppercase text-left">Quantité</label>
                            <input 
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateManualItem(idx, 'quantity', e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold-500/50"
                            />
                         </div>
                         <div className="md:col-span-3">
                            <label className="block text-[9px] text-zinc-500 mb-1 uppercase text-left">Prix unitaire HT</label>
                            <input 
                              type="number"
                              required
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateManualItem(idx, 'unitPrice', e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            />
                         </div>
                         <div className="md:col-span-2 flex justify-end pt-3 md:pt-0">
                            <button
                              type="button"
                              onClick={() => handleRemoveManualItem(idx)}
                              className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all border border-red-500/25"
                              title="Retirer l'article"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                   ))}

                   <div className="text-right">
                      <button
                        type="button"
                        onClick={handleRecalculateFromItems}
                        className="text-xs text-gold-400 hover:text-gold-300 font-semibold"
                      >
                        Calculer le montant total TTC à partir de ces articles
                      </button>
                   </div>
                </div>
             )}

             {manualItems.length > 0 && (
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="updateInventoryManual" 
                    checked={updateInventory}
                    onChange={(e) => setUpdateInventory(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-gold-500 focus:ring-gold-500"
                  />
                  <label htmlFor="updateInventoryManual" className="text-xs text-zinc-400 select-none cursor-pointer">
                    Mettre à jour automatiquement l'état des stocks à l'enregistrement
                  </label>
                </div>
             )}
          </div>

          <div className="pt-6 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-zinc-400">
               {isOnline ? "Enregistrement rapide en direct" : "Enregistrement autonome sécurisé"}
            </span>
            <button
              type="submit"
              disabled={isSavingManual}
              className="bg-gold-500 text-zinc-950 px-8 py-3.5 rounded-xl text-xs font-black tracking-wide uppercase hover:bg-gold-400 transition-all flex items-center gap-2"
            >
              {isSavingManual ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde progressive ...
                </>
              ) : (
                <>
                  Enregistrer dans mon cahier
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.form>
      )}
    </div>
  );
}

function DataField({ label, value, onChange, highlight = false, type = "text" }: { label: string, value: string | number, onChange?: (val: string) => void, highlight?: boolean, type?: string }) {
  return (
    <div className={`p-3 rounded-xl border transition-all duration-300 ${highlight ? 'bg-gold-500/5 border-gold-500/30' : 'bg-luxury-900/50 border-white/5'}`}>
      <p className={`text-[10px] mb-1 uppercase ${highlight ? 'text-gold-400' : 'text-zinc-500'}`}>{label}</p>
      {onChange ? (
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full bg-transparent border-none focus:outline-none transition-colors ${highlight ? 'text-lg font-serif text-gold-300' : 'text-xs text-white font-medium'} py-0`}
        />
      ) : (
        <p className={`font-medium ${highlight ? 'text-lg font-serif text-gold-300' : 'text-xs text-white'}`}>{value}</p>
      )}
    </div>
  );
}
