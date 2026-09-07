import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, getDocFromServer, setDoc, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { BETA_EMAIL, BETA_PASSWORD, BETA_COMPANY_TEMPLATE, BETA_SEED_META } from './lib/betaConfig';
import { determineTaxRegime } from './lib/tax-rules';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, (firebaseConfig as any).firestoreDatabaseId || '(default)');

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.error("Firebase connection test failed:", error);
  }
}
testConnection();

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

/**
 * One-click beta tester login.
 * Signs into the shared pre-configured demo account (email/password, hidden from user).
 * No email, no Google, no form — just one button.
 * Auto-seeds the company profile if it does not exist so onboarding is skipped.
 */
export const loginAsBetaTesteur = async () => {
  try {
    const cred = await signInWithEmailAndPassword(auth, BETA_EMAIL, BETA_PASSWORD);
    await ensureBetaCompanySeed(cred.user.uid);
    return cred;
  } catch (error: any) {
    // Provide actionable message for the common first-setup case: Firebase user not yet created.
    if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
      console.error("[Beta Login] Demo account not found. Create it in Firebase Console:", BETA_EMAIL);
      throw new Error(
        `Compte démo Bêta introuvable (${BETA_EMAIL}). ` +
        `Crée ce compte dans Firebase Console > Authentication > Add user, puis réessaie. ` +
        `Vérifie aussi VITE_BETA_EMAIL / VITE_BETA_PASSWORD.`
      );
    }
    console.error("Error signing in as beta testeur", error);
    throw error;
  }
};

// Ensures companies/{uid} exists for the beta demo user. Idempotent.
async function ensureBetaCompanySeed(uid: string) {
  try {
    const ref = doc(db, 'companies', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    const revenue = parseFloat(BETA_COMPANY_TEMPLATE.estimatedRevenue) || 0;
    const taxRegime = determineTaxRegime(revenue);

    const payload: any = {
      userId: uid,
      companyName: BETA_COMPANY_TEMPLATE.companyName,
      ifu: BETA_COMPANY_TEMPLATE.ifu,
      rccm: BETA_COMPANY_TEMPLATE.rccm,
      phone: BETA_COMPANY_TEMPLATE.phone,
      email: BETA_COMPANY_TEMPLATE.email,
      address: BETA_COMPANY_TEMPLATE.address,
      legalStatus: BETA_COMPANY_TEMPLATE.legalStatus,
      sector: BETA_COMPANY_TEMPLATE.sector,
      estimatedRevenue: BETA_COMPANY_TEMPLATE.estimatedRevenue,
      taxRegime,
      notificationSettings: BETA_COMPANY_TEMPLATE.notificationSettings,
      createdAt: new Date().toISOString(),
      ...BETA_SEED_META,
    };

    // Local-first for instant offline availability
    try {
      const { localDb } = await import('./services/localDb');
      localDb.add('companies', { id: uid, ...payload });
    } catch (e) {
      console.warn("[Beta Seed] localDb save failed", e);
    }

    await setDoc(ref, payload);
    console.log("[Beta Seed] Seeded beta company for", uid);
  } catch (e) {
    console.warn("[Beta Seed] Failed to seed beta company", e);
    // Do not throw — the user is already authenticated; onboarding can still be completed manually.
  }
}

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
