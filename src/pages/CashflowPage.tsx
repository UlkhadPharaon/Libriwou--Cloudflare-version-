import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { TrendingUp, TrendingDown, Activity, AlertCircle, Sparkles } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function CashflowPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;
      const q = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const unsubscribeTx = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
      return () => unsubscribeTx();
    });
    return () => unsubscribeAuth();
  }, []);

  const chartData = useMemo(() => {
    if (!transactions.length) return [];
    
    // Group by month
    const monthlyMap = new Map<string, { income: number, expense: number }>();
    transactions.forEach(tx => {
      const d = new Date(tx.date);
      const m = d.toLocaleString('fr-FR', { month: 'short' });
      const current = monthlyMap.get(m) || { income: 0, expense: 0 };
      if (tx.type === 'INCOME') current.income += tx.amountExclTax;
      if (tx.type === 'EXPENSE') current.expense += tx.amountExclTax;
      monthlyMap.set(m, current);
    });

    const historical = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      solde: data.income - data.expense,
      isProjection: false
    }));

    // calculate averages
    const avgIncome = historical.reduce((acc, curr) => acc + (monthlyMap.get(curr.month)?.income || 0), 0) / (historical.length || 1);
    const avgExpense = historical.reduce((acc, curr) => acc + (monthlyMap.get(curr.month)?.expense || 0), 0) / (historical.length || 1);
    
    // add 3 months of projection based on averages
    const now = new Date();
    const projections = [];
    for(let i=1; i<=3; i++) {
        const nextDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        projections.push({
            month: nextDate.toLocaleString('fr-FR', { month: 'short' }) + ' (Prév)',
            solde: avgIncome - avgExpense,
            isProjection: true
        });
    }

    return [...historical, ...projections];
  }, [transactions]);

  const threeMonthForecast = chartData.filter(d => d.isProjection).reduce((acc, curr) => acc + curr.solde, 0);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-serif text-gold-100 flex items-center gap-3">
          <Activity className="w-8 h-8 text-gold-500" />
          Mon Argent (Prévisions)
        </h1>
        <p className="text-zinc-400 mt-2 font-sans">Découvrez combien d'argent vous aurez sur votre compte dans les prochains mois.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl">
            <h3 className="text-gold-200 text-sm font-medium mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-money-400" /> Solde Prévisionnel (3 mois)</h3>
            <div className="text-3xl font-serif font-bold text-text-title">
               {new Intl.NumberFormat('fr-BF', { style: 'currency', currency: 'XOF' }).format(threeMonthForecast)}
            </div>
            {threeMonthForecast > 0 ? (
                <p className="text-money-400 text-sm mt-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Tendance à la hausse</p>
            ) : (
                <p className="text-red-400 text-sm mt-2 flex items-center gap-1"><TrendingDown className="w-4 h-4" /> Risque de découvert</p>
            )}
         </div>
         <div className="md:col-span-2 p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl">
             <div className="flex items-start gap-4 h-full">
                <div className="p-3 bg-gold-500/10 rounded-xl text-gold-500">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-gold-100 font-medium font-serif text-lg mb-2">Conseil de votre Assistant IA</h3>
                   {threeMonthForecast > 0 ? (
                       <p className="text-zinc-400 text-sm">Vos projections pour le prochain trimestre sont positives compte tenu de vos charges fixes. Envisagez de placer votre excédent ou d'investir dans l'optimisation de vos processus (matériel, outil tech).</p>
                   ) : (
                       <p className="text-zinc-400 text-sm">Attention, à ce rythme de dépenses fixes, votre trésorerie risque d'être négative. Il serait pertinent de différer certains achats prévus ou relancer vos factures en attente avant la fin du mois.</p>
                   )}
                </div>
             </div>
         </div>
      </div>

      <div className="p-4 md:p-6 rounded-2xl md:rounded-[2rem] bg-luxury-800/40 border border-border-subtle shadow-xl h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="50%" stopColor="#4ade80" stopOpacity={0.3}/>
                <stop offset="50%" stopColor="#f87171" stopOpacity={0.3}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgb(24, 24, 27)', borderColor: 'rgb(63, 63, 70)', borderRadius: '12px' }}
              itemStyle={{ color: '#d4af37' }}
              formatter={(val: number) => new Intl.NumberFormat('fr-BF', { style: 'currency', currency: 'XOF' }).format(val)}
            />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="solde" stroke="#d4af37" strokeWidth={3} fill="url(#splitColor)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
