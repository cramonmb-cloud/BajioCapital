import { collection, getDocs, doc, getDoc, addDoc, updateDoc, writeBatch, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora, Wallet, WalletTransaction, AppUser } from './types';

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

// Fetch a single loan by ID
export async function getLoan(id: string): Promise<Loan | null> {
  const loanRef = doc(db, 'loans', id);
  const loanSnap = await getDoc(loanRef);
  if (loanSnap.exists()) {
    const data = loanSnap.data();
    const startDate = data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : data.startDate;
    return { id: loanSnap.id, ...data, startDate } as Loan;
  } else {
    return null;
  }
}


// Fetch all loans
export async function getLoans(): Promise<Loan[]> {
  const loansCol = collection(db, 'loans');
  const loanSnapshot = await getDocs(loansCol);
  const loanPlans = await getLoanPlans(); // Fetch plans once

  const loanList = loanSnapshot.docs.map(doc => {
      const data = doc.data();
      // Firestore Timestamps to ISO strings
      const startDate = data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : data.startDate;
      const payments = (data.payments || []).map((p: any) => ({
          ...p,
          date: p.date instanceof Timestamp ? p.date.toDate().toISOString() : p.date,
      }));
      
      let status = data.status;
      const loanPlan = loanPlans.find(p => p.id === data.loanPlanId);

      if (status === 'Active' && loanPlan) {
          const loanStartDate = new Date(startDate);
          
          // Calculate total owed based on plan
          const weeklyPayment = (data.amount / 1000) * loanPlan.weeklyPaymentRate;
          const totalOwed = weeklyPayment * loanPlan.termInWeeks;
          const totalPaid = payments.reduce((acc: number, p: { amount: number }) => acc + p.amount, 0);
          
          // Calculate when the loan should have ended
          const endDate = new Date(loanStartDate);
          endDate.setUTCDate(loanStartDate.getUTCDate() + loanPlan.termInWeeks * 7);

          // If today is past the end date and it's not fully paid, it's overdue
          if (new Date() > endDate && totalPaid < totalOwed) {
              status = 'Overdue';
          }
      }

      return {
          id: doc.id,
          ...data,
          startDate,
          payments,
          status,
      } as Loan;
  });
  return loanList;
}


// Fetch loans for a specific client
export async function getLoansByClientId(clientId: string): Promise<Loan[]> {
    const loansCol = collection(db, 'loans');
    const q = query(loansCol, where("clientId", "==", clientId));
    const loanSnapshot = await getDocs(q);
    const loanList = loanSnapshot.docs.map(doc => {
      const data = doc.data();
       const startDate = data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : data.startDate;
       const payments = Array.isArray(data.payments) ? data.payments : [];
      return {
          id: doc.id,
          ...data,
          startDate,
          payments,
      } as Loan;
  });
  return loanList;
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

// Fetch wallet
export async function getWallet(): Promise<Wallet> {
    const walletRef = doc(db, 'wallet', 'main');
    const walletSnap = await getDoc(walletRef);
    if(walletSnap.exists()) {
        return { id: walletSnap.id, ...walletSnap.data() } as Wallet;
    }
    // If wallet doesn't exist, create it
    await writeBatch(db).set(walletRef, { balance: 0 }).commit();
    return { id: 'main', balance: 0 };
}

// Fetch all wallet transactions
export async function getWalletTransactions(): Promise<WalletTransaction[]> {
    const transactionsCol = collection(db, 'walletTransactions');
    const q = query(transactionsCol, orderBy('date', 'desc'));
    const transactionSnapshot = await getDocs(q);
    const transactionList = transactionSnapshot.docs.map(doc => {
        const data = doc.data();
        const date = data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date;
        return {
            id: doc.id,
            ...data,
            date,
        } as WalletTransaction;
    });
    return transactionList;
}

// Fetch all plazas
export async function getPlazas(): Promise<Plaza[]> {
  const col = collection(db, 'plazas');
  const snapshot = await getDocs(col);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plaza));
}

// Fetch all localidades
export async function getLocalidades(): Promise<Localidad[]> {
  const col = collection(db, 'localidades');
  const snapshot = await getDocs(col);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Localidad));
}

// Fetch all promotoras
export async function getPromotoras(): Promise<Promotora[]> {
  const col = collection(db, 'promotoras');
  const snapshot = await getDocs(col);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Promotora));
}

// Fetch all users
export async function getUsers(): Promise<AppUser[]> {
    const usersCol = collection(db, 'users');
    const userSnapshot = await getDocs(usersCol);
    return userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
}


export async function seedDatabase(clients: Client[], loanPlans: LoanPlan[], loans: Loan[]) {
  const batch = writeBatch(db);

  // Seed clients
  const clientsCol = collection(db, 'clients');
  clients.forEach((client) => {
    const { id, ...clientData } = client;
    const docRef = doc(clientsCol, id);
    batch.set(docRef, clientData);
  });

  // Seed loan plans
  const plansCol = collection(db, 'loanPlans');
  loanPlans.forEach((plan) => {
    const { id, ...planData } = plan;
    const docRef = doc(plansCol, id);
    batch.set(docRef, planData);
  });

  // Seed loans
  const loansCol = collection(db, 'loans');
  loans.forEach((loan) => {
    const { id, startDate, ...loanData } = loan;
    const docRef = doc(loansCol, id);
     batch.set(docRef, {
      ...loanData,
      startDate: new Date(startDate) // Store as Firestore Timestamp
    });
  });

  await batch.commit();
}
