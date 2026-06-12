import { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { localDb } from '../services/localDb';
import { BookOpen, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Papa from 'papaparse';

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

export function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = localDb.subscribe('transactions', auth.currentUser.uid, (transactionsList) => {
      const generatedEntries: JournalEntry[] = [];
      
      transactionsList.forEach((data) => {
        const dateObj = new Date(data.date);
        const ref = data.fecFingerprint ? data.fecFingerprint.substring(0, 8).toUpperCase() : (data.id || '').substring(0, 8).toUpperCase();
        
        let desc = data.description || '';
        let vendor = data.vendorName || 'Tiers inconnu';
        
        const amountExclTax = Number(data.amountExclTax) || 0;
        const amountInclTax = Number(data.amountInclTax) || amountExclTax;
        const fullDesc = `${vendor} - ${desc} (Ref: ${ref})`;

        if (data.type === 'INCOME') {
          // Trésorerie Débit (usually 521 for Banque or 571 for Caisse, let's use 521 default)
          generatedEntries.push({
            id: `${data.id || Math.random()}-debit`,
            date: data.date,
            accountNumber: '521',
            description: fullDesc,
            debit: amountInclTax,
            credit: null,
            timestamp: dateObj,
            ref
          });

          // Produit Crédit (usually 701)
          generatedEntries.push({
            id: `${data.id || Math.random()}-credit`,
            date: data.date,
            accountNumber: '701',
            description: fullDesc,
            debit: null,
            credit: amountInclTax,
            timestamp: dateObj,
            ref
          });
        } else if (data.type === 'EXPENSE') {
          // Charge Débit (605 or map category)
          // Rough mapping based on common categories or default to 605
          let chargeAccount = '605';
          if (data.category?.includes('Salaires')) chargeAccount = '661';
          else if (data.category?.includes('Loyer')) chargeAccount = '622';
          else if (data.category?.includes('Impôts')) chargeAccount = '641';
          
          generatedEntries.push({
            id: `${data.id || Math.random()}-debit`,
            date: data.date,
            accountNumber: chargeAccount,
            description: fullDesc,
            debit: amountInclTax,
            credit: null,
            timestamp: dateObj,
            ref
          });

          // Trésorerie / Fournisseur Crédit
          let creditAccount = '401';
          if (data.paymentMethod === 'Bank') creditAccount = '521';
          else if (data.paymentMethod === 'Cash') creditAccount = '571';
          
          generatedEntries.push({
            id: `${data.id || Math.random()}-credit`,
            date: data.date,
            accountNumber: creditAccount,
            description: fullDesc,
            debit: null,
            credit: amountInclTax,
            timestamp: dateObj,
            ref
          });
        }
      });

      // Sort by date chronological
      generatedEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      setEntries(generatedEntries);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalDebit = entries.reduce((acc, curr) => acc + (curr.debit || 0), 0);
  const totalCredit = entries.reduce((acc, curr) => acc + (curr.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit;

  const exportCSV = () => {
    const csvData = entries.map(e => ({
      Date: format(new Date(e.date), 'dd/MM/yyyy'),
      'N° Compte': e.accountNumber,
      'Libellé de l\'opération': e.description,
      Débit: e.debit || '',
      Crédit: e.credit || ''
    }));

    const csvContent = Papa.unparse(csvData, { delimiter: ';' });
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Livre_Journal_${format(new Date(), 'yyyy_MM_dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif tracking-tight mb-2 text-gold-100 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-gold-500" />
            Mon Historique
          </h1>
          <p className="text-zinc-400 font-sans max-w-3xl">
            Retrouvez ici tous les mouvements (recettes, dépenses) traduits automatiquement dans le bon format pour l'administration.
          </p>
        </div>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-luxury-900 border border-border-subtle hover:bg-bg-overlay px-4 py-2 rounded-xl text-gold-300 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Exporter CSV</span>
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-gold-500/20 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-luxury-800/50 backdrop-blur-md border border-border-subtle rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-luxury-900/80 text-gold-500 uppercase font-sans text-xs border-b border-border-subtle">
                <tr>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">N° Compte</th>
                  <th className="px-6 py-4 font-semibold">Libellé de l'opération (Tiers/Ref)</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Débit (FCFA)</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Crédit (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle border-b border-border-subtle">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                      <FileText className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
                      Aucune écriture comptable trouvée.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry, index) => {
                    const isDebit = entry.debit !== null;
                    // Slightly indent credit descriptions to mimic standard journal visual style
                    return (
                      <tr key={index} className="hover:bg-bg-overlay/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-300">
                          {format(new Date(entry.date), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-6 py-4 font-mono text-gold-400">
                          {entry.accountNumber}
                        </td>
                        <td className="px-6 py-4 text-zinc-300">
                          <div className={!isDebit ? "pl-8" : ""}>
                            {entry.description}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-200">
                          {entry.debit ? new Intl.NumberFormat('fr-BF').format(entry.debit) : ''}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-200">
                          {entry.credit ? new Intl.NumberFormat('fr-BF').format(entry.credit) : ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-luxury-900 border-t-2 border-border-subtle font-semibold">
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-right text-gold-500">
                    TOTAUX
                  </td>
                  <td className="px-6 py-4 text-right text-gold-300">
                    {new Intl.NumberFormat('fr-BF').format(totalDebit)}
                  </td>
                  <td className="px-6 py-4 text-right text-gold-300">
                    {new Intl.NumberFormat('fr-BF').format(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="p-4 bg-bg-overlay border-t border-border-subtle flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              * Ce journal est généré automatiquement selon la réglementation SYSCOHADA Révisé.
            </span>
            {isBalanced ? (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                La partie double est équilibrée (Débit = Crédit).
              </span>
            ) : (
              <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                Attention : Le journal est déséquilibré !
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
