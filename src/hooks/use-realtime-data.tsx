'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, QuerySnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Loan, Client, LoanPlan, Plaza, Localidad, Promotora, AppUser, AppConfig } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

interface RealtimeData {
    loans: Loan[];
    clients: Client[];
    loanPlans: LoanPlan[];
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
    users: AppUser[];
    config: AppConfig | null;
}

function processSnapshot<T>(snapshot: QuerySnapshot<DocumentData, DocumentData>): T[] {
    return snapshot.docs.map(doc => {
        const data = doc.data();
        for (const key in data) {
            if (data[key] instanceof Timestamp) {
                data[key] = (data[key] as Timestamp).toDate().toISOString();
            }
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

const initialData: RealtimeData = {
    loans: [],
    clients: [],
    loanPlans: [],
    plazas: [],
    localidades: [],
    promotoras: [],
    users: [],
    config: null,
};

export function useRealtimeData() {
  const [data, setData] = useState<RealtimeData>(initialData);
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
        users: collection(db, 'users'),
        config: collection(db, 'config'),
    };

    const unsubscribers = Object.entries(collections).map(([key, collRef]) => {
      return onSnapshot(collRef, 
        (snapshot) => {
            setData(prevData => {
                const newData = { ...prevData };
                if (key === 'loans') newData.loans = processSnapshot<Loan>(snapshot);
                if (key === 'clients') newData.clients = processSnapshot<Client>(snapshot);
                if (key === 'loanPlans') newData.loanPlans = processSnapshot<LoanPlan>(snapshot);
                if (key === 'plazas') newData.plazas = processSnapshot<Plaza>(snapshot);
                if (key === 'localidades') newData.localidades = processSnapshot<Localidad>(snapshot);
                if (key === 'promotoras') newData.promotoras = processSnapshot<Promotora>(snapshot);
                if (key === 'users') newData.users = processSnapshot<AppUser>(snapshot);
                if (key === 'config') {
                    const configDoc = snapshot.docs.find(doc => doc.id === 'main');
                    newData.config = configDoc ? configDoc.data() as AppConfig : null;
                }
                return newData;
            });
            setLoading(false);
        },
        async (err) => {
          const permissionError = new FirestorePermissionError({
            path: collRef.path,
            operation: 'list',
          } satisfies SecurityRuleContext);
          
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  return { data, loading, error };
}
