'use server';

import type { Client, Loan, LoanPlan, AppUser } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, updateDoc, runTransaction, increment, writeBatch, getDoc, getDocs, query, where, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { getLoanPlan, getClient, getLoan } from '@/lib/firestore-data';

// Helper to handle Firestore dates consistently in server actions
const parseFirestoreDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return new Date();
};

export type CreateLoanInput = {
    promotoraId: string;
    loanPlanId: string;
    amount: number;
    client: Omit<Client, 'id' | 'avatarUrl'> & { id?: string };
};

export async function createLoanAction(input: CreateLoanInput) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get day of week (Sunday is 0, Saturday is 6)
    const dayOfWeek = today.getUTCDay();

    // Calculate days to subtract to get to the previous Saturday.
    const daysToSubtract = (dayOfWeek + 1) % 7;

    const saturday = new Date(today);
    saturday.setUTCDate(today.getUTCDate() - daysToSubtract);

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
        promotoraId: input.promotoraId,
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


export async function registerPaymentAction(loanId: string, paymentStartDate: Date, amountPaid: number, startingWeekNumber: number, userId?: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const loanRef = doc(db, 'loans', loanId);
            const loanSnap = await transaction.get(loanRef);

            if (!loanSnap.exists()) {
                throw new Error('Préstamo no encontrado');
            }

            const loan = loanSnap.data() as Loan;
            const wasOverdue = loan.status === 'Overdue';
            const client = await getClient(loan.clientId);
            const loanPlan = await getLoanPlan(loan.loanPlanId);
            const walletRef = doc(db, 'wallet', 'main');

            if (!loanPlan) {
                throw new Error('Plan de préstamo no encontrado');
            }
            
            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            
            const currentPayments = (loan.payments || []).map(p => ({
                ...p,
                date: parseFirestoreDate(p.date).toISOString()
            }));

            // Overwrite logic: Remove any existing payment for the starting week
            const allPayments = currentPayments.filter(p => p.weekNumber !== startingWeekNumber);
            
            // Add the new payment for the starting week.
            allPayments.push({
                date: new Date().toISOString(),
                amount: amountPaid,
                weekNumber: startingWeekNumber
            });
            
            const today = new Date();
            const loanStartDate = parseFirestoreDate(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            // --- Wallet and Transaction Logic ---
            const originalTotalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const newTotalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);
            const walletAdjustment = newTotalPaid - originalTotalPaid;

            if (walletAdjustment !== 0) {
                const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                transaction.set(walletTransactionRef, {
                    type: walletAdjustment > 0 ? 'credit' : 'debit',
                    amount: Math.abs(walletAdjustment),
                    date: new Date(),
                    description: `Abono/Ajuste de ${client?.name || 'N/A'} para préstamo (Semana ${startingWeekNumber}).`,
                    loanId: loanId,
                    clientId: loan.clientId,
                    userId: userId || null,
                });
                
                transaction.update(walletRef, { balance: increment(walletAdjustment) });
            }

            // RE-CALCULAR FALLOS (Solo dentro del plazo base de 12 semanas)
            let missedWeeksCount = 0;
            const baseTerm = loanPlan.termInWeeks;
            for (let i = 1; i <= baseTerm; i++) {
                if (i >= rawCurrentLoanWeek) break; // Todavía no llega esa fecha
                const p = allPayments.find(pay => pay.weekNumber === i);
                const amount = p ? p.amount : 0;
                if (amount < weeklyPayment) missedWeeksCount++;
            }

            const hasPenalty = missedWeeksCount >= 2;
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
            
            const totalExpected = weeklyPayment * termInWeeks;
            const totalPaidReal = allPayments.reduce((sum, p) => sum + p.amount, 0);

            let newStatus: Loan['status'] = loan.status;

            if (totalPaidReal >= totalExpected) {
                newStatus = (wasOverdue || rawCurrentLoanWeek > termInWeeks) ? 'Pagado desde CV' : 'Paid Off';
            } else {
                if (missedWeeksCount >= 2) {
                    newStatus = 'Overdue';
                } else {
                    newStatus = 'Active';
                }
            }

            transaction.update(loanRef, {
                payments: allPayments,
                status: newStatus
            });
        });

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/overdue-portfolio');
        
        const message = amountPaid > 0 
            ? 'Pago registrado con éxito.'
            : 'Fallo registrado con éxito.';
            
        return { success: true, message: message };

    } catch (error: any) {
        console.error('Error registering payment:', error);
        return { success: false, message: `Error al registrar el pago: ${error.message}` };
    }
}

export async function payOffLoanAction(loanId: string, userId?: string) {
    try {
        const result = await runTransaction(db, async (transaction) => {
            const loanRef = doc(db, "loans", loanId);
            const loanDoc = await transaction.get(loanRef);
            
            if (!loanDoc.exists()) {
                throw new Error("Préstamo no encontrado.");
            }

            const loan = loanDoc.data() as Loan;
            const wasOverdue = loan.status === 'Overdue';
            const client = await getClient(loan.clientId);
            const loanPlan = await getLoanPlan(loan.loanPlanId);
            
            if (!loanPlan) {
                throw new Error("Plan de préstamo no encontrado.");
            }

            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const today = new Date();
            const loanStartDate = parseFirestoreDate(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            const baseTerm = loanPlan.termInWeeks;
            const currentPayments = (loan.payments || []).map(p => ({
                ...p,
                date: parseFirestoreDate(p.date).toISOString()
            }));

            // Calcular fallos para penalización
            let missedWeeksCount = 0;
            for (let i = 1; i <= baseTerm; i++) {
                if (i >= rawCurrentLoanWeek) break;
                const p = currentPayments.find(pay => pay.weekNumber === i);
                const amount = p ? p.amount : 0;
                if (amount < weeklyPayment) missedWeeksCount++;
            }

            const hasPenalty = missedWeeksCount >= 2;
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
            
            const totalExpected = weeklyPayment * termInWeeks;
            const totalPaidReal = currentPayments.reduce((sum, p) => sum + p.amount, 0);
            const settlementAmount = Math.max(0, totalExpected - totalPaidReal);

            const finalStatus: Loan['status'] = (wasOverdue || rawCurrentLoanWeek > termInWeeks) ? 'Pagado desde CV' : 'Paid Off';

            if (settlementAmount <= 0) {
                transaction.update(loanRef, { status: finalStatus });
                return { success: true, message: "Este préstamo ya estaba liquidado." };
            }

            const newPayments = [...currentPayments, {
                date: new Date().toISOString(),
                amount: settlementAmount,
                weekNumber: -1, // Liquidación Manual
            }];
            
            const walletRef = doc(db, 'wallet', 'main');
            const walletTransactionRef = doc(collection(db, 'walletTransactions'));
            transaction.set(walletTransactionRef, {
                type: 'credit',
                amount: settlementAmount,
                date: new Date(),
                description: `Liquidación de préstamo de ${client?.name || 'N/A'}.`,
                loanId: loanId,
                clientId: loan.clientId,
                userId: userId || null,
            });
            transaction.update(walletRef, { balance: increment(settlementAmount) });

            transaction.update(loanRef, {
                payments: newPayments,
                status: finalStatus,
            });
            
            return { success: true, message: "Préstamo liquidado con éxito." };
        });

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/clients');

        return result;

    } catch (error: any) {
        console.error('Error paying off loan:', error);
        return { success: false, message: `Error al liquidar el préstamo: ${error.message}` };
    }
}


export async function accumulateAssumedPaymentsAction(loanIds: string[], userId?: string) {
    if (!loanIds || loanIds.length === 0) {
        return { success: false, message: 'No hay préstamos seleccionados.' };
    }

    try {
        const batch = writeBatch(db);
        const walletRef = doc(db, 'wallet', 'main');
        
        const [loansSnap, plansSnap, clientsSnap] = await Promise.all([
            getDocs(query(collection(db, 'loans'), where('__name__', 'in', loanIds.slice(0, 30)))),
            getDocs(collection(db, 'loanPlans')),
            getDocs(collection(db, 'clients'))
        ]);

        const loanPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoanPlan));
        const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        const loans = loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const today = new Date();
        let totalAccumulatedAmount = 0;
        let paymentsAccumulatedCount = 0;

        for (const loan of loans) {
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan || loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') continue;

            const loanStartDate = parseFirestoreDate(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            const weeklyPaymentAmount = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const currentPayments = (loan.payments || []).map((p: any) => ({
                ...p,
                date: parseFirestoreDate(p.date).toISOString()
            }));

            // Calcular fallos (tope base term)
            let missedWeeksCount = 0;
            const baseTerm = loanPlan.termInWeeks;
            for (let i = 1; i <= baseTerm; i++) {
                if (i >= rawCurrentLoanWeek) break;
                const p = currentPayments.find((pay: any) => pay.weekNumber === i);
                if (p && p.amount < weeklyPaymentAmount) missedWeeksCount++;
            }
            const hasPenalty = missedWeeksCount >= 2;
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);

            let updatedPayments = [...currentPayments];
            let loanChanged = false;

            // Recorrer hasta la semana actual (tope total term)
            for (let weekNumber = 1; weekNumber <= Math.min(rawCurrentLoanWeek, termInWeeks); weekNumber++) {
                const paymentExists = updatedPayments.some((p: any) => p.weekNumber === weekNumber);

                if (!paymentExists) {
                    const client = clients.find(c => c.id === loan.clientId);
                    
                    const newPayment = {
                        date: new Date().toISOString(),
                        amount: weeklyPaymentAmount,
                        weekNumber: weekNumber,
                    };

                    updatedPayments.push(newPayment);
                    
                    const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                    batch.set(walletTransactionRef, {
                        type: 'credit',
                        amount: weeklyPaymentAmount,
                        date: new Date(),
                        description: `Abono (acumulado) de ${client?.name || 'N/A'} - Semana ${weekNumber}.`,
                        loanId: loan.id,
                        clientId: loan.clientId,
                        userId: userId || null,
                    });

                    totalAccumulatedAmount += weeklyPaymentAmount;
                    paymentsAccumulatedCount++;
                    loanChanged = true;
                }
            }

            if (loanChanged) {
                const totalExpected = weeklyPaymentAmount * termInWeeks;
                const totalPaidReal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);

                let newStatus = loan.status;
                if (totalPaidReal >= totalExpected) {
                    newStatus = (loan.status === 'Overdue' || rawCurrentLoanWeek > termInWeeks) ? 'Pagado desde CV' : 'Paid Off';
                }

                batch.update(doc(db, 'loans', loan.id), { payments: updatedPayments, status: newStatus });
            }
        }

        if (paymentsAccumulatedCount === 0) {
            return { success: true, message: 'No había pagos asumidos para acumular.' };
        }

        batch.update(walletRef, { balance: increment(totalAccumulatedAmount) });
        await batch.commit();

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');
        
        return { 
            success: true, 
            message: `Se acumularon ${paymentsAccumulatedCount} pagos exitosamente.` 
        };
    } catch (error: any) {
        console.error('Error accumulating payments:', error);
        return { success: false, message: `Error al acumular pagos: ${error.message}` };
    }
}
