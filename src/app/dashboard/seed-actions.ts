'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/firebase';
import { clients, loanPlans, loans } from '@/lib/data';
import { writeBatch, doc, collection } from 'firebase/firestore';

export async function seedDatabaseAction() {
  try {
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
    
    // Revalidate all dashboard paths
    revalidatePath('/dashboard', 'layout');

    return { success: true, message: 'La base de datos ha sido poblada con éxito.' };
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return { success: false, message: `Error al poblar la base de datos: ${error.message}` };
  }
}
