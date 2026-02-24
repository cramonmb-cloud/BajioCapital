'use server';

import type { Client, Loan, LoanPlan, AppUser } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, updateDoc, runTransaction, increment, writeBatch, getDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { getLoanPlan, getClient, getLoan } from '@/lib/firestore-data';

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
            
            const getWeeklyPaymentAmount = (loan: Loan) => {
              if (!loanPlan) return 0;
              return (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            };

            const weeklyPayment = getWeeklyPaymentAmount(loan);
            
            // Overwrite logic: Remove any existing payment for the starting week
            const allPayments = loan.payments.filter(p => p.weekNumber !== startingWeekNumber);
            
            // Add the new payment for the starting week. This handles overwrites and new payments.
            allPayments.push({
                date: new Date().toISOString(),
                amount: amountPaid,
                weekNumber: startingWeekNumber
            });
            
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            // --- Wallet and Transaction Logic ---
            // Calculate total change in paid amount to adjust wallet correctly
            const originalTotalPaid = loan.payments.reduce((acc, p) => acc + p.amount, 0);
            const newTotalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);
            const walletAdjustment = newTotalPaid - originalTotalPaid;

            if (walletAdjustment !== 0) {
                // Register a transaction for the audit trail
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

            const totalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);
            
            // Re-calculate penalties for status
            let missedWeeksCount = 0;
            for (let i = 1; i < currentLoanWeek; i++) {
                const paymentForWeek = allPayments.find(p => p.weekNumber === i);
                const paidForWeek = paymentForWeek?.amount || 0;
                if (paidForWeek < weeklyPayment) {
                    missedWeeksCount++;
                }
            }
            const hasPenalty = missedWeeksCount >= 2;
            const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);
            const totalLoanAmount = weeklyPayment * termInWeeks;

            let newStatus: Loan['status'] = loan.status;

            if (totalPaid >= totalLoanAmount) {
                newStatus = wasOverdue ? 'Pagado desde CV' : 'Paid Off';
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
            ? 'Pago registrado con éxito y añadido a la cartera.'
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
            const totalLoanAmount = weeklyPayment * loanPlan.termInWeeks;
            const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
            const settlementAmount = totalLoanAmount - totalPaid;

            const finalStatus: Loan['status'] = wasOverdue ? 'Pagado desde CV' : 'Paid Off';

            if (settlementAmount <= 0) {
                // If already paid off, just update status and return
                transaction.update(loanRef, { status: finalStatus });
                return { success: true, message: "Este préstamo ya estaba liquidado." };
            }

            // Record the final payment
            const newPayments = [...loan.payments, {
                date: new Date().toISOString(),
                amount: settlementAmount,
                weekNumber: -1, // Indicates a settlement payment
            }];
            
            // Add to wallet
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

            // Update loan status
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


export async function accumulateAssumedPaymentsAction(loans: Loan[], loanPlans: LoanPlan[], clients: Client[], userId?: string) {
    const today = new Date();
    const batch = writeBatch(db);
    const walletRef = doc(db, 'wallet', 'main');
    let totalAccumulatedAmount = 0;
    let paymentsAccumulatedCount = 0;

    for (const loan of loans) {
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        if (!loanPlan || loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') continue;

        const timeDiff = today.getTime() - new Date(loan.startDate).getTime();
        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
        
        for (let weekNumber = 1; weekNumber <= currentLoanWeek; weekNumber++) {
            if (weekNumber <= 0 || weekNumber > loanPlan.termInWeeks) continue;

            const paymentExists = loan.payments.some(p => p.weekNumber === weekNumber);

            if (!paymentExists) {
                const weeklyPaymentAmount = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
                const loanRef = doc(db, 'loans', loan.id);
                const client = clients.find(c => c.id === loan.clientId);
                
                const newPayment = {
                    date: new Date().toISOString(),
                    amount: weeklyPaymentAmount,
                    weekNumber: weekNumber,
                };

                const updatedPayments = [...loan.payments, newPayment];
                loan.payments.push(newPayment);

                const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
                const totalLoanAmount = weeklyPaymentAmount * loanPlan.termInWeeks;
                let newStatus = loan.status;
                if (totalPaid >= totalLoanAmount) {
                    newStatus = loan.status === 'Overdue' ? 'Pagado desde CV' : 'Paid Off';
                }

                batch.update(loanRef, { payments: updatedPayments, status: newStatus });
                
                const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                batch.set(walletTransactionRef, {
                    type: 'credit',
                    amount: weeklyPaymentAmount,
                    date: new Date(),
                    description: `Abono (acumulado) de ${client?.name || 'N/A'} para préstamo (Semana ${weekNumber}).`,
                    loanId: loan.id,
                    clientId: loan.clientId,
                    userId: userId || null,
                });

                totalAccumulatedAmount += weeklyPaymentAmount;
                paymentsAccumulatedCount++;
            }
        }
    }

    if (paymentsAccumulatedCount === 0) {
        return { success: true, message: 'No había pagos asumidos para acumular.' };
    }

    try {
        batch.update(walletRef, { balance: increment(totalAccumulatedAmount) });
        await batch.commit();

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        
        return { success: true, message: `Se acumularon ${paymentsAccumulatedCount} pagos por un total de ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalAccumulatedAmount)}.` };
    } catch (error: any) {
        console.error('Error accumulating payments:', error);
        return { success: false, message: `Error al acumular pagos: ${error.message}` };
    }
}


export async function changeLoansDateAction(loanIds: string[], newStartDate: string) {
  try {
    const batch = writeBatch(db);
    const newDate = new Date(newStartDate);

    loanIds.forEach(loanId => {
      const loanRef = doc(db, 'loans', loanId);
      batch.update(loanRef, { startDate: newDate });
    });

    await batch.commit();
    
    revalidatePath('/dashboard/loans');
    revalidatePath('/dashboard/clients');

    return { success: true, message: `${loanIds.length} préstamos han sido movidos de fecha exitosamente.` };
  } catch (error: any) {
    console.error('Error changing loan dates:', error);
    return { success: false, message: `Error al cambiar las fechas de los préstamos: ${error.message}` };
  }
}

export type UpdateLoanData = {
    loanPlanId: string;
    amount: number;
    startDate: string;
    promotoraId: string;
};

export async function updateLoanAction(loanId: string, data: UpdateLoanData) {
    try {
        const loanRef = doc(db, 'loans', loanId);
        await updateDoc(loanRef, {
            loanPlanId: data.loanPlanId,
            amount: data.amount,
            startDate: new Date(data.startDate),
            promotoraId: data.promotoraId,
        });

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/clients');
        const updatedDoc = await getDoc(loanRef);
        revalidatePath(`/dashboard/clients/${updatedDoc.data()?.clientId}`);

        return { success: true, message: 'Préstamo actualizado con éxito.' };
    } catch (error: any) {
        console.error('Error updating loan:', error);
        return { success: false, message: `Error al actualizar el préstamo: ${error.message}` };
    }
}

export async function deleteLoanAction(loanId: string) {
    try {
        // 1. Get loan data to know how much to subtract from wallet
        const loanRef = doc(db, 'loans', loanId);
        const loanSnap = await getDoc(loanRef);
        if (!loanSnap.exists()) throw new Error('Préstamo no encontrado');
        const loan = loanSnap.data() as Loan;
        const totalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const clientId = loan.clientId;

        // 2. Find associated wallet transactions
        const transactionsQuery = query(collection(db, 'walletTransactions'), where('loanId', '==', loanId));
        const transactionsSnap = await getDocs(transactionsQuery);

        // 3. Execute all deletions and balance update in a batch
        const batch = writeBatch(db);
        
        // Update wallet balance (reverting the income)
        if (totalPaid > 0) {
            const walletRef = doc(db, 'wallet', 'main');
            batch.update(walletRef, { balance: increment(-totalPaid) });
        }

        // Delete wallet transactions
        transactionsSnap.docs.forEach(txDoc => batch.delete(txDoc.ref));

        // Delete loan
        batch.delete(loanRef);

        await batch.commit();

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard/clients');
        revalidatePath(`/dashboard/clients/${clientId}`);

        return { success: true, message: 'Préstamo y sus movimientos eliminados exitosamente.' };
    } catch (error: any) {
        console.error('Error deleting loan:', error);
        return { success: false, message: `Error al eliminar el préstamo: ${error.message}` };
    }
}
