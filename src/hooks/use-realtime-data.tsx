'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, QuerySnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan, Client, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';

interface RealtimeData {
    loans: Loan[];
    clients: Client[];
    loanPlans: LoanPlan[];
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
}

function processSnapshot<T>(snapshot: QuerySnapshot<DocumentData, DocumentData>): T[] {
    return snapshot.docs.map(doc => {
        const data = doc.data();
        // Convert any Timestamps to ISO strings for serializability
        for (const key in data) {
            if (data[key] instanceof Timestamp) {
                data[key] = (data[key] as Timestamp).toDate().toISOString();
            }
            // Also check for nested timestamps in payments array
            if (key === 'payments' && Array.isArray(data[key])) {
                data[key] = data[key].map((p: any) => {
                    if (p.date instanceof Timestamp) {
                        return { ...p, date: p.date.toDate().toISOString() };
                    }
                    return p;
                });
            }
        }
        return { id: doc.id, ...data } as T;
    });
}

export function useRealtimeData() {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const collections = {
        loans: collection(db, 'loans'),
        clients: collection(db, 'clients'),
        loanPlans: collection(db, 'loanPlans'),
        plazas: collection(db, 'plazas'),
        localidades: collection(db, 'localidades'),
        promotoras: collection(db, 'promotoras'),
    };

    const unsubscribers = Object.entries(collections).map(([key, collRef]) => {
      return onSnapshot(collRef, 
        (snapshot) => {
            setData(prevData => ({
                ...prevData,
                loans: key === 'loans' ? processSnapshot<Loan>(snapshot) : prevData?.loans || [],
                clients: key === 'clients' ? processSnapshot<Client>(snapshot) : prevData?.clients || [],
                loanPlans: key === 'loanPlans' ? processSnapshot<LoanPlan>(snapshot) : prevData?.loanPlans || [],
                plazas: key === 'plazas' ? processSnapshot<Plaza>(snapshot) : prevData?.plazas || [],
                localidades: key === 'localidades' ? processSnapshot<Localidad>(snapshot) : prevData?.localidades || [],
                promotoras: key === 'promotoras' ? processSnapshot<Promotora>(snapshot) : prevData?.promotoras || [],
            }));
            setLoading(false);
        },
        (err) => {
          console.error(`Error fetching ${key}:`, err);
          setError(err);
          setLoading(false);
        }
      );
    });

    // Cleanup function to unsubscribe from all listeners on component unmount
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return { data, loading, error };
}
