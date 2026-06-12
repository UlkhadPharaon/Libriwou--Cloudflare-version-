import { useState, useEffect } from 'react';
import { localDb } from '../services/localDb';
import { useAuth } from '../contexts/AuthContext';

export function useLocalCollection<T = any>(collectionName: string) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    const unsubscribe = localDb.subscribe(collectionName, user.uid, (list) => {
      setData(list as T[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, user?.uid]);

  const addDoc = async (docData: any) => {
    if (!user) throw new Error('Utilisateur non connecté');
    return localDb.add(collectionName, {
      ...docData,
      userId: user.uid
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
