import { useState, useEffect } from 'react';
import { localDb } from '../services/localDb';
import { useAuth } from '../contexts/AuthContext';

/**
 * Local-first collection hook.
 *
 * Wraps `localDb.subscribe` (which was Firestore's `onSnapshot`). Reads are local
 * and instant; writes go to IndexedDB and are mirrored to any registered backend
 * by `services/repo.ts`, so this hook needs no change when a database arrives.
 */
export function useLocalCollection<T = any>(collectionName: string) {
  const { userId } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    const unsubscribe = localDb.subscribe(collectionName, userId, (list) => {
      setData(list as T[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, userId]);

  const addDoc = async (docData: any) => {
    if (!userId) throw new Error('Aucun profil local actif');
    return localDb.add(collectionName, {
      ...docData,
      userId,
    });
  };

  const updateDoc = async (docId: string, docData: any) => {
    localDb.update(collectionName, docId, docData);
  };

  const deleteDoc = async (docId: string) => {
    localDb.delete(collectionName, docId);
  };

  return { data, loading, addDoc, updateDoc, deleteDoc };
}
