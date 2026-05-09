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

    const dayOfWeek = today.getUTCDay();
    const daysToSubtract = (dayOfWeek + 1) % 7;
    const saturday = new Date(today);
    saturday.setUTCDate(today.getUTCDate() - daysToSubtract);

    let clientId = input.client.id;

    if (!clientId) {
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
        startDate: saturday,
        status: 'Active' as const,
        payments: [],
    };
    
    await addDoc(collection(db, 'loans'), newLoan);

    revalidatePath('/dashboard/loans');
    revalidatePath('/dashboard/clients');
    
    return { success: true, message: 'Préstamo creado con éxito.' };
}

export async function updateLoanAction(loanId: string, data: { loanPlanId: string; amount: number; startDate: string; promotoraId: string }) {
    try {
        const loanRef = doc(db, 'loans', loanId);
        await updateDoc(loanRef, {
            loanPlanId: data.loanPlanId,
            amount: data.amount,
            startDate: new Date(data.startDate),
            promotoraId: data.promotoraId
        });

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/clients');
        return { success: true, message: 'Préstamo actualizado con éxito.' };
    } catch (error: any) {
        console.error('Error updating loan:', error);
        return { success: false, message: `Error al actualizar el préstamo: ${error.message}` };
    }
}

export async function deleteLoanAction(loanId: string) {
    try {
        await runTransaction(db, async (transaction) => {
            const loanRef = doc(db, 'loans', loanId);
            const loanSnap = await transaction.get(loanRef);

            if (!loanSnap.exists()) {
                throw new Error('Préstamo no encontrado');
            }

            const loan = loanSnap.data() as Loan;
            const totalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);

            if (totalPaid > 0) {
                const walletRef = doc(db, 'wallet', 'main');
                transaction.update(walletRef, { balance: increment(-totalPaid) });
            }

            transaction.delete(loanRef);
        });

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard/clients');

        return { success: true, message: 'Préstamo eliminado y saldo de cartera ajustado correctamente.' };
    } catch (error: any) {
        console.error('Error deleting loan:', error);
        return { success: false, message: `Error al eliminar el préstamo: ${error.message}` };
    }
}

export async function changeLoansDateAction(loanIds: string[], targetDateIso: string) {
    try {
        const batch = writeBatch(db);
        const targetDate = new Date(targetDateIso);
        
        loanIds.forEach(id => {
            const ref = doc(db, 'loans', id);
            batch.update(ref, { startDate: targetDate });
        });

        await batch.commit();
        revalidatePath('/dashboard/loans');
        return { success: true, message: `Se actualizó la fecha de inicio de ${loanIds.length} préstamos correctamente.` };
    } catch (error: any) {
        console.error('Error changing loans dates:', error);
        return { success: false, message: `Error al cambiar las fechas: ${error.message}` };
    }
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

            // Reemplazar o añadir el pago de la semana específica
            const allPayments = currentPayments.filter(p => p.weekNumber !== startingWeekNumber);
            allPayments.push({
                date: new Date().toISOString(),
                amount: amountPaid,
                weekNumber: startingWeekNumber
            });
            
            const today = new Date();
            const loanStartDate = parseFirestoreDate(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            const originalTotalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);
            const newTotalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);
            const walletAdjustment = newTotalPaid - originalTotalPaid;

            if (walletAdjustment !== 0) {
                const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                transaction.set(walletTransactionRef, {
                    type: walletAdjustment > 0 ? 'credit' : 'debit',
                    amount: Math.abs(walletAdjustment),
                    date: new Date(),
                    description: `Abono/Ajuste de ${client?.name || 'N/A'} (Semana ${startingWeekNumber}).`,
                    loanId: loanId,
                    clientId: loan.clientId,
                    userId: userId || null,
                });
                
                transaction.update(walletRef, { balance: increment(walletAdjustment) });
            }

            // Lógica de Penalización UNIFICADA
            const baseTerm = loanPlan.termInWeeks;
            const isExpired = rawCurrentLoanWeek > baseTerm;
            
            let missedCount = 0;
            for (let i = 1; i <= baseTerm; i++) {
                const p = allPayments.find(pay => pay.weekNumber === i);
                if (p) {
                    if (p.amount < weeklyPayment) missedCount++;
                } else if (i < rawCurrentLoanWeek) {
                    missedCount++;
                }
            }

            // REGLA UNIFICADA: 2+ fallos activa semana extra siempre (Vigente o Vencido)
            const hasPenalty = missedCount >= 2;
            const totalTerm = baseTerm + (hasPenalty ? 1 : 0);
            const totalExpected = totalTerm * weeklyPayment;
            
            // Saldo absoluto
            const balance = Math.max(0, totalExpected - newTotalPaid);

            let newStatus: Loan['status'] = loan.status;
            if (balance <= 0) {
                newStatus = (hasPenalty || rawCurrentLoanWeek > totalTerm) ? 'Pagado desde CV' : 'Paid Off';
            } else {
                newStatus = (isExpired || rawCurrentLoanWeek > totalTerm) ? 'Overdue' : 'Active';
            }

            transaction.update(loanRef, {
                payments: allPayments,
                status: newStatus
            });
        });

        revalidatePath('/dashboard', 'layout');
        
        return { success: true, message: 'Pago registrado con éxito.' };

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

            let missedCount = 0;
            for (let i = 1; i <= baseTerm; i++) {
                const p = currentPayments.find(pay => pay.weekNumber === i);
                if (p) {
                    if (p.amount < weeklyPayment) missedCount++;
                } else if (i < rawCurrentLoanWeek) {
                    missedCount++;
                }
            }

            // REGLA UNIFICADA: 2+ fallos activa semana extra siempre (Vigente o Vencido)
            const hasPenalty = missedCount >= 2;
            const totalTerm = baseTerm + (hasPenalty ? 1 : 0);
            
            const totalExpected = totalTerm * weeklyPayment;
            const totalPaid = currentPayments.reduce((acc, p) => acc + p.amount, 0);
            const settlementAmount = Math.max(0, totalExpected - totalPaid);
            
            const finalStatus: Loan['status'] = (hasPenalty || rawCurrentLoanWeek > totalTerm) ? 'Pagado desde CV' : 'Paid Off';

            if (settlementAmount <= 0) {
                transaction.update(loanRef, { status: finalStatus });
                return { success: true, message: "Este préstamo ya estaba liquidado." };
            }

            // Registrar el pago de liquidación final
            const newPayments = [...currentPayments, {
                date: new Date().toISOString(),
                amount: settlementAmount,
                weekNumber: -1, // Marca de liquidación total
            }];
            
            const walletRef = doc(db, 'wallet', 'main');
            const walletTransactionRef = doc(collection(db, 'walletTransactions'));
            transaction.set(walletTransactionRef, {
                type: 'credit',
                amount: settlementAmount,
                date: new Date(),
                description: `Liquidación total de préstamo de ${client?.name || 'N/A'}.`,
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

        revalidatePath('/dashboard', 'layout');

        return result;

    } catch (error: any) {
        console.error('Error paying off loan:', error);
        return { success: false, message: `Error al liquidar el préstamo: ${error.message}` };
    }
}
