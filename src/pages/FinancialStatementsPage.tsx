import { useState, useEffect } from 'react';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { BookOpen, FileText, Download, Building2, BarChart3, Presentation, Filter, Table2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface JournalEntry {
  id: string;
  date: string;
  accountNumber: string;
  description: string;
  debit: number | null;
  credit: number | null;
  timestamp: Date;
  ref: string;
}

export function FinancialStatementsPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grand-livre' | 'bilan' | 'resultat'>('grand-livre');
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch company info for headers
    const unsubscribeCompany = onSnapshot(doc(db, 'companies', auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) setCompany(docSnap.data());
    });

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const generatedEntries: JournalEntry[] = [];
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const dateObj = new Date(data.date);
        const ref = data.fecFingerprint ? data.fecFingerprint.substring(0, 8).toUpperCase() : doc.id.substring(0, 8).toUpperCase();
        
        let desc = data.description || '';
        let vendor = data.vendorName || 'Tiers inconnu';
        
        const amountExclTax = Number(data.amountExclTax) || 0;
        const amountInclTax = Number(data.amountInclTax) || amountExclTax;
        const fullDesc = `${vendor} - ${desc} (Ref: ${ref})`;

        if (data.type === 'INCOME') {
          generatedEntries.push({
            id: `${doc.id}-debit`, date: data.date, accountNumber: '521', description: fullDesc, debit: amountInclTax, credit: null, timestamp: dateObj, ref
          });
          generatedEntries.push({
            id: `${doc.id}-credit`, date: data.date, accountNumber: '701', description: fullDesc, debit: null, credit: amountInclTax, timestamp: dateObj, ref
          });
        } else if (data.type === 'EXPENSE') {
          let chargeAccount = '605';
          if (data.category?.includes('Salaires')) chargeAccount = '661';
          else if (data.category?.includes('Loyer')) chargeAccount = '622';
          else if (data.category?.includes('Impôts')) chargeAccount = '641';
          
          generatedEntries.push({
            id: `${doc.id}-debit`, date: data.date, accountNumber: chargeAccount, description: fullDesc, debit: amountInclTax, credit: null, timestamp: dateObj, ref
          });

          let creditAccount = '401';
          if (data.paymentMethod === 'Bank') creditAccount = '521';
          else if (data.paymentMethod === 'Cash') creditAccount = '571';
          
          generatedEntries.push({
            id: `${doc.id}-credit`, date: data.date, accountNumber: creditAccount, description: fullDesc, debit: null, credit: amountInclTax, timestamp: dateObj, ref
          });
        }
      });
      
      generatedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      setEntries(generatedEntries);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeCompany();
    };
  }, []);

  // ====== CALCULATIONS ======
  // Grand Livre: group entries by account number
  const grandLivre = entries.reduce((acc, entry) => {
    if (!acc[entry.accountNumber]) {
      acc[entry.accountNumber] = {
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        balance: 0
      };
    }
    acc[entry.accountNumber].entries.push(entry);
    acc[entry.accountNumber].totalDebit += entry.debit || 0;
    acc[entry.accountNumber].totalCredit += entry.credit || 0;
    return acc;
  }, {} as Record<string, { entries: JournalEntry[], totalDebit: number, totalCredit: number, balance: number }>);

  // Compute balances
  Object.keys(grandLivre).forEach(accNo => {
    const isActif = accNo.startsWith('2') || accNo.startsWith('3') || accNo.startsWith('4') || accNo.startsWith('5') || accNo.startsWith('6');
    // simplified balance computation
    const debit = grandLivre[accNo].totalDebit;
    const credit = grandLivre[accNo].totalCredit;
    grandLivre[accNo].balance = isActif ? debit - credit : credit - debit; 
  });

  // Bilan (Simplified SYSCOHADA)
  // Actifs: Class 2 (Immobilisations) + Class 3 (Stocks) + Class 4 (Créances) + Class 5 (Trésorerie Actif)
  // Passifs: Class 1 (Capitaux propres) + Class 4 (Dettes) + Class 5 (Trésorerie Passif)
  const bilan = {
    actif: {
      immobilise: 0, // class 2
      circulant: 0,  // class 3 + 4 (actif)
      tresorerie: 0  // class 5 (debit)
    },
    passif: {
      capitauxPropres: 0, // class 1
      dettes: 0,          // class 4 (passif)
      tresorerie: 0       // class 5 (credit)
    }
  };

  Object.keys(grandLivre).forEach(accNo => {
    const bal = grandLivre[accNo].balance;
    if (accNo.startsWith('2')) bilan.actif.immobilise += Math.abs(bal); // simplified mapping
    if (accNo.startsWith('3') || (accNo.startsWith('4') && accNo !== '401')) bilan.actif.circulant += Math.abs(bal);
    if (accNo.startsWith('5') && bal > 0) bilan.actif.tresorerie += bal;
    
    if (accNo.startsWith('1')) bilan.passif.capitauxPropres += Math.abs(bal);
    if (accNo === '401') bilan.passif.dettes += Math.abs(bal);
    if (accNo.startsWith('5') && bal < 0) bilan.passif.tresorerie += Math.abs(bal);
  });

  // Compte de résultat (Class 6 vs Class 7)
  let totalProduits = 0;
  let totalCharges = 0;
  
  Object.keys(grandLivre).forEach(accNo => {
    const debit = grandLivre[accNo].totalDebit;
    const credit = grandLivre[accNo].totalCredit;
    if (accNo.startsWith('6')) totalCharges += (debit - credit);
    if (accNo.startsWith('7')) totalProduits += (credit - debit);
  });

  // Equilibrate bilan with result
  const resultatNet = totalProduits - totalCharges;
  bilan.passif.capitauxPropres += Math.abs(resultatNet); // Simplified, assume added to reserves

  const totalActif = bilan.actif.immobilise + bilan.actif.circulant + bilan.actif.tresorerie;
  const totalPassif = bilan.passif.capitauxPropres + bilan.passif.dettes + bilan.passif.tresorerie;

  // ====== DOCX EXPORT ======
  const generateDocx = async (type: 'GL' | 'BILAN' | 'RESULTAT') => {
    let sections: any[] = [];
    
    const createHeader = (title: string) => {
      return [
        new Paragraph({ children: [new TextRun({ text: "ÉTATS FINANCIERS - SYSCOHADA", font: "Arial", size: 24, bold: true })], alignment: AlignmentType.CENTER }),
        new Paragraph({ children: [new TextRun({ text: title, font: "Arial", size: 28, bold: true, color: "111111" })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
        new Paragraph({ children: [new TextRun({ text: `Entreprise: ${company?.companyName || 'Non défini'}`, font: "Arial", size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: `Date d'édition: ${new Date().toLocaleDateString('fr-FR')}`, font: "Arial", size: 20 })], spacing: { after: 400 } }),
      ];
    };

    if (type === 'GL') {
      const rows = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Compte", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Débit", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Crédit", bold: true })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Solde", bold: true })] })] }),
          ]
        })
      ];

      Object.entries(grandLivre).sort(([a],[b]) => a.localeCompare(b)).forEach(([acc, data]) => {
         rows.push(
           new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(acc)] }),
                new TableCell({ children: [new Paragraph(data.totalDebit.toLocaleString() + ' F')] }),
                new TableCell({ children: [new Paragraph(data.totalCredit.toLocaleString() + ' F')] }),
                new TableCell({ children: [new Paragraph(data.balance > 0 ? `Débiteur: ${data.balance.toLocaleString()} F` : data.balance < 0 ? `Créditeur: ${Math.abs(data.balance).toLocaleString()} F` : 'Zéro')] }),
              ]
           })
         );
      });

      sections = [{
        properties: {},
        children: [
          ...createHeader("GRAND LIVRE"),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
        ]
      }];
    } else if (type === 'BILAN') {
       sections = [{
        properties: {},
        children: [
          ...createHeader("BILAN"),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ACTIF", bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "PASSIF", bold: true })] })] }) ] }),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph(`Actif Immobilisé: ${bilan.actif.immobilise.toLocaleString()} F\nActif Circulant: ${bilan.actif.circulant.toLocaleString()} F\nTrésorerie-Actif: ${bilan.actif.tresorerie.toLocaleString()} F`)] }),
              new TableCell({ children: [new Paragraph(`Capitaux Propres: ${bilan.passif.capitauxPropres.toLocaleString()} F\nDettes: ${bilan.passif.dettes.toLocaleString()} F\nTrésorerie-Passif: ${bilan.passif.tresorerie.toLocaleString()} F`)] }),
            ] }),
            new TableRow({ children: [
               new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Total Actif: ${totalActif.toLocaleString()} FCFA`, bold: true })] })] }),
               new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Total Passif: ${totalPassif.toLocaleString()} FCFA`, bold: true })] })] })
            ]})
          ] })
        ]
      }];
    } else if (type === 'RESULTAT') {
      sections = [{
        properties: {},
        children: [
          ...createHeader("COMPTE DE RÉSULTAT"),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Produits (Classe 7)", bold: true })] })] }), new TableCell({ children: [new Paragraph(`${totalProduits.toLocaleString()} FCFA`)] }) ] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Charges (Classe 6)", bold: true })] })] }), new TableCell({ children: [new Paragraph(`${totalCharges.toLocaleString()} FCFA`)] }) ] }),
            new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Résultat Net", bold: true })] })] }), new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${resultatNet.toLocaleString()} FCFA`, bold: true })] })] }) ] })
          ] })
        ]
      }];
    }

    const doc = new Document({ sections });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Etat-Financier_${type}_${new Date().toISOString().substring(0,10)}.docx`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 text-gold-500 border border-gold-500/20 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            SYSTÈME COMPTABLE SYSCOHADA
          </div>
          <h1 className="text-3xl md:text-5xl font-serif tracking-tight mb-2 text-text-title flex items-center gap-4">
            <Presentation className="w-10 h-10 text-gold-500" />
            Mes Rapports Simples
          </h1>
          <p className="text-zinc-400 font-sans max-w-2xl">
            Résumés de votre activité générés automatiquement pour comprendre votre rentabilité et ce que vous possédez.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold-500/20 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex bg-luxury-900 border border-border-subtle rounded-xl p-1 gap-1 overflow-x-auto">
            {[
              { id: 'grand-livre', label: 'Grand Livre', icon: Table2 },
              { id: 'bilan', label: 'Bilan', icon: Building2 },
              { id: 'resultat', label: 'Compte de Résultat', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-gold-500/10 text-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.1)] border border-gold-500/20"
                    : "text-zinc-400 hover:bg-luxury-800 hover:text-zinc-300"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-luxury-800/40 backdrop-blur-md border border-border-subtle rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between">
              <h2 className="text-xl font-serif text-text-title">
                {activeTab === 'grand-livre' && 'Extrait du Grand Livre'}
                {activeTab === 'bilan' && 'Bilan Actif / Passif'}
                {activeTab === 'resultat' && 'Compte de Résultat'}
              </h2>
              <button 
                onClick={() => generateDocx(activeTab === 'grand-livre' ? 'GL' : activeTab === 'bilan' ? 'BILAN' : 'RESULTAT')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-600 to-gold-500 text-zinc-900 hover:opacity-90 transition-opacity rounded-xl text-sm font-bold shadow-lg shadow-gold-500/20"
              >
                <Download className="w-4 h-4" />
                Générer Document
              </button>
            </div>

            {/* TAB CONTENT: GRAND LIVRE */}
            {activeTab === 'grand-livre' && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-luxury-900/80 text-gold-500 uppercase font-sans text-[10px] tracking-wider border-b border-border-subtle">
                    <tr>
                      <th className="px-6 py-4 font-bold">N° Compte</th>
                      <th className="px-6 py-4 font-bold text-right">Total Débit</th>
                      <th className="px-6 py-4 font-bold text-right">Total Crédit</th>
                      <th className="px-6 py-4 font-bold text-right">Solde Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {Object.entries(grandLivre).sort(([a],[b]) => a.localeCompare(b)).map(([accNo, data]) => (
                      <tr key={accNo} className="hover:bg-bg-overlay/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-gold-400 font-bold text-base">
                          {accNo}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-300">
                          {data.totalDebit.toLocaleString()} F
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-300">
                          {data.totalCredit.toLocaleString()} F
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                           {data.balance > 0 ? (
                             <span className="text-blue-400">Débiteur: {data.balance.toLocaleString()} F</span>
                           ) : data.balance < 0 ? (
                             <span className="text-orange-400">Créditeur: {Math.abs(data.balance).toLocaleString()} F</span>
                           ) : (
                             <span className="text-zinc-500">Zéro</span>
                           )}
                        </td>
                      </tr>
                    ))}
                    {Object.keys(grandLivre).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                           <Table2 className="w-8 h-8 opacity-50 mx-auto mb-3" />
                           Le Grand Livre est vide.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: BILAN */}
            {activeTab === 'bilan' && (
              <div className="p-6 grid md:grid-cols-2 gap-6">
                 {/* Actif */}
                 <div className="bg-luxury-900 border border-border-subtle rounded-2xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4">
                     <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold uppercase">Emplois</span>
                   </div>
                   <h3 className="text-xl font-serif text-text-title mb-6 border-b border-border-subtle pb-4">ACTIF</h3>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Actif Immobilisé (Cl 2)</span>
                       <span className="text-text-title font-mono">{bilan.actif.immobilise.toLocaleString()} F</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Actif Circulant (Cl 3, 4)</span>
                       <span className="text-text-title font-mono">{bilan.actif.circulant.toLocaleString()} F</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Trésorerie Actif (Cl 5)</span>
                       <span className="text-text-title font-mono">{bilan.actif.tresorerie.toLocaleString()} F</span>
                     </div>
                   </div>
                   <div className="mt-8 pt-4 border-t border-border-subtle flex justify-between items-center">
                     <span className="text-gold-500 font-bold uppercase tracking-wider text-sm">Total Actif</span>
                     <span className="text-gold-400 font-mono text-xl">{totalActif.toLocaleString()} F</span>
                   </div>
                 </div>

                 {/* Passif */}
                 <div className="bg-luxury-900 border border-border-subtle rounded-2xl p-6 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4">
                     <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-xs font-bold uppercase">Ressources</span>
                   </div>
                   <h3 className="text-xl font-serif text-text-title mb-6 border-b border-border-subtle pb-4">PASSIF</h3>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Capitaux Propres & Résultat (Cl 1)</span>
                       <span className="text-text-title font-mono">{bilan.passif.capitauxPropres.toLocaleString()} F</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Dettes (Cl 4)</span>
                       <span className="text-text-title font-mono">{bilan.passif.dettes.toLocaleString()} F</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-zinc-400">Trésorerie Passif (Cl 5)</span>
                       <span className="text-text-title font-mono">{bilan.passif.tresorerie.toLocaleString()} F</span>
                     </div>
                   </div>
                   <div className="mt-8 pt-4 border-t border-border-subtle flex justify-between items-center">
                     <span className="text-gold-500 font-bold uppercase tracking-wider text-sm">Total Passif</span>
                     <span className="text-gold-400 font-mono text-xl">{totalPassif.toLocaleString()} F</span>
                   </div>
                 </div>
              </div>
            )}

            {/* TAB CONTENT: COMPTE RESULTAT */}
            {activeTab === 'resultat' && (
              <div className="p-6">
                <div className="max-w-2xl mx-auto bg-luxury-900 border border-border-subtle rounded-2xl p-6 md:p-8">
                  <h3 className="text-center text-xl font-serif text-text-title mb-8 border-b border-border-subtle pb-4">Formation du Résultat</h3>
                  
                  <div className="space-y-6">
                    <div className="flex justify-between items-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div>
                        <div className="text-emerald-400 font-bold uppercase tracking-wider text-xs mb-1">PRODUITS (Classe 7)</div>
                        <div className="text-zinc-400 text-xs">Ventes, prestations, subventions</div>
                      </div>
                      <div className="text-xl font-mono text-emerald-400">{totalProduits.toLocaleString()} F</div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                      <div>
                        <div className="text-rose-400 font-bold uppercase tracking-wider text-xs mb-1">CHARGES (Classe 6)</div>
                        <div className="text-zinc-400 text-xs">Achats, services extérieurs, salaires</div>
                      </div>
                      <div className="text-xl font-mono text-rose-400">{totalCharges.toLocaleString()} F</div>
                    </div>

                    <div className="pt-6 border-t border-border-subtle flex justify-between items-end">
                       <div>
                         <div className="text-gold-500 font-bold uppercase tracking-wider text-sm mb-1">RÉSULTAT NET</div>
                         <div className="text-zinc-400 text-xs text-balance">Différence entre les Produits et les Charges (Bénéfice ou Perte)</div>
                       </div>
                       <div className={cn(
                          "text-3xl font-mono tracking-tighter",
                          resultatNet > 0 ? "text-emerald-400" : resultatNet < 0 ? "text-rose-400" : "text-zinc-400"
                       )}>
                         {resultatNet > 0 ? '+' : ''}{resultatNet.toLocaleString()} F
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
