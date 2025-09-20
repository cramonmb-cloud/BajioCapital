'use server';

import type { Client, Loan, LoanPlan, Payment } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, setDoc, updateDoc, arrayUnion, getDoc, arrayRemove, runTransaction } from 'firebase/firestore';
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
        await runTransaction(db, async (transaction) => {
            const loanRef = doc(db, 'loans', loanId);
            const loanSnap = await transaction.get(loanRef);

            if (!loanSnap.exists()) {
                throw new Error('Préstamo no encontrado');
            }

            const loan = loanSnap.data() as Loan;
            const loanPlan = await getLoanPlan(loan.loanPlanId);

            if (!loanPlan) {
                throw new Error('Plan de préstamo no encontrado');
            }

            const weeklyPayment = loanPlan.weeklyPayment;
            let remainingAmountToDistribute = amountPaid;
            
            // Start from the provided week's start date
            let currentWeekStartDate = new Date(paymentStartDate);

            const allPayments = [...loan.payments];

            // This loop will handle both new payments and adding to existing partial payments
            while (remainingAmountToDistribute > 0) {
                const weekStartISO = currentWeekStartDate.toISOString();

                // Find if there's already a partial payment for this week
                const existingPaymentIndex = allPayments.findIndex(p => p.date === weekStartISO);

                let amountForThisWeek = 0;
                let existingPartialAmount = 0;

                if (existingPaymentIndex !== -1) {
                    existingPartialAmount = allPayments[existingPaymentIndex].amount;
                }
                
                const amountNeeded = weeklyPayment - existingPartialAmount;
                const amountToApply = Math.min(remainingAmountToDistribute, amountNeeded);

                if (amountToApply > 0) {
                     if (existingPaymentIndex !== -1) {
                        allPayments[existingPaymentIndex].amount += amountToApply;
                    } else {
                        allPayments.push({
                            date: weekStartISO,
                            amount: amountToApply,
                        });
                    }
                }
               
                remainingAmountToDistribute -= amountToApply;
                
                // Move to the next week only if we have more money to distribute
                if (remainingAmountToDistribute > 0) {
                    currentWeekStartDate.setUTCDate(currentWeekStartDate.getUTCDate() + 7);
                }
            }

            const totalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);

            let newStatus = loan.status;
            if (totalPaid >= loan.amount) {
                newStatus = 'Paid Off';
            }

            transaction.update(loanRef, {
                payments: allPayments,
                status: newStatus
            });
        });

        revalidatePath('/dashboard/loans');
        return { success: true, message: 'Pago registrado con éxito. Los abonos han sido distribuidos.' };

    } catch (error: any) {
        console.error('Error registering payment:', error);
        return { success: false, message: `Error al registrar el pago: ${error.message}` };
    }
}
