'use server';

import type { Client, Loan } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, updateDoc, runTransaction, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { getLoanPlan, getClient } from '@/lib/firestore-data';

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


export async function registerPaymentAction(loanId: string, paymentStartDate: Date, amountPaid: number, startingWeekNumber: number) {
    try {
        await runTransaction(db, async (transaction) => {
            const loanRef = doc(db, 'loans', loanId);
            const loanSnap = await transaction.get(loanRef);

            if (!loanSnap.exists()) {
                throw new Error('Préstamo no encontrado');
            }

            const loan = loanSnap.data() as Loan;
            const client = await getClient(loan.clientId);
            const loanPlan = await getLoanPlan(loan.loanPlanId);
            const walletRef = doc(db, 'wallet', 'main');

            if (!loanPlan) {
                throw new Error('Plan de préstamo no encontrado');
            }
            
            const getWeeklyPaymentAmount = (loan: Loan) => {
              if (!loanPlan) return 0;
              return (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            };

            const weeklyPayment = getWeeklyPaymentAmount(loan);
            let remainingAmountToDistribute = amountPaid;
            
            let tempCurrentWeekNumber = startingWeekNumber;
            const weeksPaidInTx: number[] = [];
            const allPayments = [...loan.payments];

            // --- Main Payment Distribution Logic ---
            while (remainingAmountToDistribute > 0 && tempCurrentWeekNumber <= loanPlan.termInWeeks) {
                // Find existing payment for the target week.
                // A payment's week number is encoded in its description if it's a multi-week payment, or we can calculate it.
                const paymentForWeekIndex = allPayments.findIndex(p => p.weekNumber === tempCurrentWeekNumber);
                
                let existingPartialAmount = 0;
                 if (paymentForWeekIndex !== -1) {
                    existingPartialAmount = allPayments[paymentForWeekIndex].amount;
                 }
                
                const amountNeeded = weeklyPayment - existingPartialAmount;
                const amountToApply = Math.min(remainingAmountToDistribute, amountNeeded);

                if (amountToApply > 0) {
                   if (!weeksPaidInTx.includes(tempCurrentWeekNumber)) {
                       weeksPaidInTx.push(tempCurrentWeekNumber);
                   }
                   
                    if (paymentForWeekIndex !== -1) {
                        allPayments[paymentForWeekIndex].amount += amountToApply;
                    } else {
                        // Create a new payment record for this week.
                        allPayments.push({
                            date: new Date().toISOString(),
                            amount: amountToApply,
                            weekNumber: tempCurrentWeekNumber
                        });
                    }
                }
               
                remainingAmountToDistribute -= amountToApply;
                
                if (remainingAmountToDistribute > 0) {
                    tempCurrentWeekNumber++;
                }
            }
            
            // --- Wallet and Transaction Logic ---
            const walletTransactionRef = doc(collection(db, 'walletTransactions'));
            let weeksDescription = '';
            if (weeksPaidInTx.length > 1) {
                weeksDescription = `Semanas ${weeksPaidInTx.join(', ')}`;
            } else if (weeksPaidInTx.length === 1) {
                weeksDescription = `Semana ${weeksPaidInTx[0]}`;
            } else {
                weeksDescription = `Semana ${startingWeekNumber}`;
            }

            transaction.set(walletTransactionRef, {
                type: 'credit',
                amount: amountPaid,
                date: new Date(),
                description: `Abono de ${client?.name || 'N/A'} para préstamo (${weeksDescription}).`,
                loanId: loanId,
                clientId: loan.clientId,
            });
            transaction.set(walletRef, { balance: increment(amountPaid) }, { merge: true });
            // --- End Wallet Logic ---

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
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');
        return { success: true, message: 'Pago registrado con éxito y añadido a la cartera.' };

    } catch (error: any) {
        console.error('Error registering payment:', error);
        return { success: false, message: `Error al registrar el pago: ${error.message}` };
    }
}
