import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';



export interface IntelligenceNews {
  id?: string;
  title: string;
  excerpt: string;
  category: 'FISCAL' | 'OPPORTUNITY' | 'MARKET' | 'TECH';
  date: string;
  url?: string;
  targetSectors: string[]; // 'GLOBAL' for all, or specific sectors like 'BTP', 'Commerce'
  createdAt?: any;
}

// In a real production environment, this function would run on a daily Cloud Function (CRON).
// For this architecture demo, we trigger it client-side but check Firestore first to mimic a database-first approach.
export async function fetchDailyIntelligence(sector: string = 'Général', force: boolean = false): Promise<IntelligenceNews[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Database-First Approach: Check if we already computed news today for this sector (or global)
    if (!force) {
      const intelRef = collection(db, 'intelligence_feed');
      const qCount = query(intelRef, where("date", "==", today));
      const querySnapshot = await getDocs(qCount);
      
      let allNews: IntelligenceNews[] = [];
      querySnapshot.forEach((doc) => {
        allNews.push({ id: doc.id, ...doc.data() } as IntelligenceNews);
      });

      // Filter news for the specific user's sector OR global fiscal news
      const userRelevantNews = allNews.filter(news => 
        news.targetSectors.includes('GLOBAL') || 
        news.targetSectors.includes(sector)
      );

      // If we have enough relevant news in the database today, return it immediately (Cost = 0$ in AI tokens)
      if (userRelevantNews.length > 0) {
        return userRelevantNews;
      }
    }

    // 2. CRON Simulation: Data doesn't exist yet for today. We fetch it via our backend API.
    const intelRef = collection(db, 'intelligence_feed');
    const response = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector, date: today })
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errData: any = {};
        try {
            errData = JSON.parse(errorText);
        } catch(e) {
            console.error("Non-JSON error response from backend:", errorText);
            throw new Error(`Erreur API backend intelligence (Status: ${response.status})`);
        }
        
        console.error("Backend error details:", errData);
        throw new Error(errData.details || errData.error || 'Erreur API backend intelligence');
    }

    const responseText = await response.text();
    let generatedNews;
    try {
        const data = JSON.parse(responseText);
        generatedNews = data.news;
    } catch(e) {
        console.error("Intelligence JSON parse failed in frontend. Raw response:", responseText);
        throw new Error("L'IA a renvoyé une réponse invalide ou la connexion a échoué.");
    }
    
    if (!generatedNews || !Array.isArray(generatedNews)) return [];

    // 3. Save the results to Firestore (so the next 999 users won't pay for the AI call today)
    const promises = generatedNews.map(async (item) => {
      const docRef = await addDoc(intelRef, {
        ...item,
        createdAt: Timestamp.now()
      });
      return { ...item, id: docRef.id };
    });

    return await Promise.all(promises);

  } catch (error) {
    if (error instanceof Error) {
        console.warn("Intelligence fetch warning:", error.message);
    } else {
        console.warn("Intelligence fetch warning:", error);
    }
    
    // Return gracefully empty array rather than failing loudly (UI will simply show no news or fallbacks)
    return [];
  }
}
