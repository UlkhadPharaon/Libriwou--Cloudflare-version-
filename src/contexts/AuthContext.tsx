import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { isBetaEmail } from '../lib/betaConfig';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasProfile: boolean | null;
  isBeta: boolean;
  refreshProfile: () => Promise<void>;
  setHasProfile: (value: boolean | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const isBeta = isBetaEmail(user?.email);

  const checkHasProfile = async (uid: string): Promise<boolean> => {
    const path = `companies/${uid}`;
    try {
      const profileDoc = await getDoc(doc(db, 'companies', uid));
      if (profileDoc.exists()) return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      // fall through to localDb fallback
    }
    // Offline / not yet synced fallback — localDb has the beta seed immediately
    try {
      const { localDb } = await import('../services/localDb');
      const local = localDb.get('companies', uid);
      if (local) return true;
    } catch {}
    return false;
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const exists = await checkHasProfile(auth.currentUser.uid);
      setHasProfile(exists);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log("Auth State Changed. User:", currentUser?.uid);
      if (currentUser) {
        const exists = await checkHasProfile(currentUser.uid);
        setHasProfile(exists);
      } else {
        setHasProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, hasProfile, isBeta, refreshProfile, setHasProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
