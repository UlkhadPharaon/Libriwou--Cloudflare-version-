import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribe } from '../services/repo';
import { useAuth } from '../contexts/AuthContext';

export interface TaxDeadline {
  id: string;
  title: string;
  date: Date;
  daysRemaining: number;
}

/**
 * Upcoming fiscal deadlines for the signed-in company.
 *
 * Reads the company profile from the local repository (was a Firestore
 * `onSnapshot` on `companies/{uid}`). With no backend, this is a pure local read.
 */
export function useTaxNotifications() {
  const { userId } = useAuth();
  const [deadlines, setDeadlines] = useState<TaxDeadline[]>([]);
  const [daysBefore, setDaysBefore] = useState<number>(7);

  useEffect(() => {
    if (!userId) {
      setDeadlines([]);
      return;
    }

    const buildDeadlines = (profile: any) => {
      if (!profile) {
        setDeadlines([]);
        return;
      }

      const settings = profile.notificationSettings || { daysBefore: 7 };
      setDaysBefore(settings.daysBefore);

      const regime = profile.taxRegime;
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();

      const generated: TaxDeadline[] = [];
      if (regime === 'RSI' || regime === 'RNI') {
        generated.push({ id: 'tva_current', title: 'Déclaration TVA (G50)', date: new Date(year, month, 20), daysRemaining: 0 });
        generated.push({ id: 'tva_next', title: 'Déclaration TVA (G50)', date: new Date(year, month + 1, 20), daysRemaining: 0 });
      } else if (regime === 'CME') {
        generated.push({ id: 'cme_current', title: 'Paiement CME', date: new Date(year, month, 10), daysRemaining: 0 });
        generated.push({ id: 'cme_next', title: 'Paiement CME', date: new Date(year, month + 1, 10), daysRemaining: 0 });
      }

      const upcoming = generated
        .map((d) => ({ ...d, daysRemaining: Math.ceil((d.date.getTime() - today.getTime()) / (1000 * 3600 * 24)) }))
        .filter((d) => d.daysRemaining >= 0 && d.daysRemaining <= settings.daysBefore);

      setDeadlines(upcoming);
    };

    // Initial + live updates from the local repository.
    return subscribe<any>('companies', (rows) => buildDeadlines(rows[0] ?? null));
  }, [userId]);

  return { deadlines };
}
