import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  hasProfile: boolean | null;
  refreshProfile: () => Promise<void>;
  setHasProfile: (value: boolean | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      const path = `companies/${auth.currentUser.uid}`;
      try {
        console.log("Fetching profile for:", auth.currentUser.uid);
        const profileDoc = await getDoc(doc(db, 'companies', auth.currentUser.uid));
        console.log("Profile exists:", profileDoc.exists());
        setHasProfile(profileDoc.exists());
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
        setHasProfile(false);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      console.log("Auth State Changed. User:", currentUser?.uid);
      if (currentUser) {
        const path = `companies/${currentUser.uid}`;
        try {
          console.log("Checking profile for:", currentUser.uid);
          const profileDoc = await getDoc(doc(db, 'companies', currentUser.uid));
          console.log("Profile exists:", profileDoc.exists());
          setHasProfile(profileDoc.exists());
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
          setHasProfile(false);
        }
      } else {
        setHasProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, hasProfile, refreshProfile, setHasProfile }}>
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
