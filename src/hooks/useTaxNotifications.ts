import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface TaxDeadline {
  id: string;
  title: string;
  date: Date;
  daysRemaining: number;
}

export function useTaxNotifications() {
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([]);
  const [daysBefore, setDaysBefore] = useState<number>(7);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) return;

      const unsubscribeCompany = onSnapshot(doc(db, 'companies', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const compData = docSnap.data();
          const settings = compData.notificationSettings || { daysBefore: 7 };
          setDaysBefore(settings.daysBefore);
          
          const regime = compData.taxRegime;
          
          // Using logic similar to CalendarPage
          const today = new Date();
          const year = today.getFullYear();
          const month = today.getMonth();
          
          const generatedDeadlines: TaxDeadline[] = [];
          
          // Logic to generate upcoming deadlines (simplified copy from CalendarPage)
          if (regime === 'RSI' || regime === 'RNI') {
            generatedDeadlines.push({ id: 'tva_current', title: 'Déclaration TVA (G50)', date: new Date(year, month, 20), daysRemaining: 0 });
            generatedDeadlines.push({ id: 'tva_next', title: 'Déclaration TVA (G50)', date: new Date(year, month + 1, 20), daysRemaining: 0 });
          } else if (regime === 'CME') {
            generatedDeadlines.push({ id: 'cme_current', title: 'Paiement CME', date: new Date(year, month, 10), daysRemaining: 0 });
            generatedDeadlines.push({ id: 'cme_next', title: 'Paiement CME', date: new Date(year, month + 1, 10), daysRemaining: 0 });
          }

          const upcoming = generatedDeadlines
            .map(d => ({
              ...d,
              daysRemaining: Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 3600 * 24))
            }))
            .filter(d => d.daysRemaining >= 0 && d.daysRemaining <= settings.daysBefore);
            
          setDeadlines(upcoming);
        }
      });
      
      return () => unsubscribeCompany();
    });
    
    return () => unsubscribeAuth();
  }, []);

  return { deadlines };
}
