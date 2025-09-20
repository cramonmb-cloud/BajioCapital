'use server';

import type { Client, Loan, LoanPlan, Payment } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, setDoc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { getLoanPlan } from '@/lib/firestore-data';

export type CreateLoanInput = {
    loanPlanId: string;
    amount: number;
    client: Omit<Client, 'id' | 'avatarUrl'> & { id?: string };
};

export async function createLoanAction(input: CreateLoanInput) {
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // Sunday = 0, Saturday = 6
    // If today is Sunday (0), we want the Saturday of the *previous* week.
    // For any other day (Mon-Sat), we calculate days until the upcoming Saturday.
    const daysToAdd = dayOfWeek === 0 ? -1 : 6 - dayOfWeek;
    
    const saturday = new Date(today);
    saturday.setUTCDate(today.getUTCDate() + daysToAdd);
    saturday.setUTCHours(0, 0, 0, 0);

    let clientId = input.client.id;

    if (!clientId) {
        // Create a new client
        const newClientData = {
            ...input.client,
            avatarUrl: `https://picsum.photos/seed/${Math.random()}/40/40`
        };
        const docRef = await addDoc(collection(db, 'clients'), newClientData);
        clientId = docRef.id;
    }

    const newLoan = {
        clientId: clientId,
        loanPlanId: input.loanPlanId,
        amount: input.amount,
        startDate: saturday, // Use the Date object directly, Firestore will convert it
        status: 'Active' as const,
        payments: [],
    };
    
    await addDoc(collection(db, 'loans'), newLoan);

    revalidatePath('/dashboard/loans');
    revalidatePath('/dashboard/clients');
    
    return { success: true, message: 'Préstamo creado con éxito.' };
}


export async function registerPaymentAction(loanId: string, paymentStartDate: Date, amountPaid: number) {
    try {
        const loanRef = doc(db, 'loans', loanId);
        const loanSnap = await getDoc(loanRef);

        if(!loanSnap.exists()) {
            throw new Error('Préstamo no encontrado');
        }

        const loan = loanSnap.data() as Loan;
        const loanPlan = await getLoanPlan(loan.loanPlanId);

        if (!loanPlan) {
            throw new Error('Plan de préstamo no encontrado');
        }
        
        const weeklyPayment = loanPlan.weeklyPayment;
        let remainingAmountToDistribute = amountPaid;
        let currentWeekStartDate = new Date(paymentStartDate);
        
        const newPayments = [];

        // Distribute full weekly payments
        while (remainingAmountToDistribute >= weeklyPayment) {
            newPayments.push({
                date: currentWeekStartDate.toISOString(),
                amount: weeklyPayment,
            });
            remainingAmountToDistribute -= weeklyPayment;
            // Move to the next week
            currentWeekStartDate.setUTCDate(currentWeekStartDate.getUTCDate() + 7);
        }

        // Distribute any remaining amount as a partial payment
        if (remainingAmountToDistribute > 0) {
            newPayments.push({
                date: currentWeekStartDate.toISOString(),
                amount: remainingAmountToDistribute,
            });
        }
        
        const updatedPayments = [...loan.payments, ...newPayments];
        const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
        
        let newStatus = loan.status;
        if (totalPaid >= loan.amount) {
            newStatus = 'Paid Off';
        }

        // Using updateDoc with arrayUnion to add all new payments at once
        await updateDoc(loanRef, {
            payments: arrayUnion(...newPayments),
            status: newStatus
        });

        revalidatePath('/dashboard/loans');
        return { success: true, message: 'Pago registrado con éxito. Los abonos han sido distribuidos.' };

    } catch (error: any) {
        console.error('Error registering payment:', error);
        return { success: false, message: `Error al registrar el pago: ${error.message}` };
    }
}
