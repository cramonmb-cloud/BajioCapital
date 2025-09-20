import { collection, getDocs, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Client, Loan, LoanPlan, Payment } from './types';

// Fetch all clients
export async function getClients(): Promise<Client[]> {
  const clientsCol = collection(db, 'clients');
  const clientSnapshot = await getDocs(clientsCol);
  const clientList = clientSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
  return clientList;
}

// Fetch a single client by ID
export async function getClient(id: string): Promise<Client | null> {
  const clientRef = doc(db, 'clients', id);
  const clientSnap = await getDoc(clientRef);
  if (clientSnap.exists()) {
    return { id: clientSnap.id, ...clientSnap.data() } as Client;
  } else {
    return null;
  }
}

// Fetch all loans
export async function getLoans(): Promise<Loan[]> {
  const loansCol = collection(db, 'loans');
  const loanSnapshot = await getDocs(loansCol);
  const loanList = loanSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
          id: doc.id,
          ...data,
          // Firestore timestamps need to be converted to strings
          startDate: data.startDate.toDate().toISOString(), 
          payments: data.payments || [],
      } as Loan;
  });
  return loanList;
}

// Fetch loans for a specific client
export async function getLoansByClientId(clientId: string): Promise<Loan[]> {
    const allLoans = await getLoans();
    return allLoans.filter(loan => loan.clientId === clientId);
}


// Fetch all loan plans
export async function getLoanPlans(): Promise<LoanPlan[]> {
  const plansCol = collection(db, 'loanPlans');
  const planSnapshot = await getDocs(plansCol);
  const planList = planSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoanPlan));
  return planList;
}

// Fetch a single loan plan by ID
export async function getLoanPlan(id: string): Promise<LoanPlan | null> {
  const planRef = doc(db, 'loanPlans', id);
  const planSnap = await getDoc(planRef);
  if (planSnap.exists()) {
    return { id: planSnap.id, ...planSnap.data() } as LoanPlan;
  } else {
    return null;
  }
}

// NOTE: The following functions are placeholders for creating/updating data.
// You'll need to adapt them to your specific logic, especially for handling subcollections like payments.

export async function createClient(clientData: Omit<Client, 'id' | 'avatarUrl'>) {
    const clientsCol = collection(db, 'clients');
    const docRef = await addDoc(clientsCol, {
        ...clientData,
        avatarUrl: `https://picsum.photos/seed/${Math.random()}/40/40`
    });
    return docRef.id;
}

export async function createLoan(loanData: Omit<Loan, 'id' | 'payments'>) {
    const loansCol = collection(db, 'loans');
    await addDoc(loansCol, {
        ...loanData,
        payments: [] // Initialize with empty payments
    });
}
