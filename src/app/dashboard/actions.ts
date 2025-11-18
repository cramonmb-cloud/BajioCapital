'use server';

import type { Client, Loan, LoanPlan } from '@/lib/types';
import { collection, doc, addDoc, serverTimestamp, updateDoc, runTransaction, increment, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import { getLoanPlan, getClient, getLoan } from '@/lib/firestore-data';

export type CreateLoanInput = {
    groupId: string;
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
        groupId: input.groupId,
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
            let remainingAmountToDistribute = amountPaid;
            
            const allPayments = [...loan.payments];
            const weeksPaidInTx: number[] = [];
            
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            // Determine if penalty should apply based on missed payments *before* this transaction
            let missedWeeksForPenalty = 0;
             for (let i = 1; i < currentLoanWeek; i++) {
                const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
                const paidForWeek = paymentForWeek?.amount || 0;
                if (paidForWeek < weeklyPayment) {
                    missedWeeksForPenalty++;
                }
            }
            const hasPenalty = missedWeeksForPenalty >= 2;
            const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);

            // --- Distribution Logic ---

            // 1. Apply payment to the starting week if it's not fully paid
            if (remainingAmountToDistribute > 0) {
                 let paymentForStartingWeek = allPayments.find(p => p.weekNumber === startingWeekNumber);
                 const paidForStartingWeek = paymentForStartingWeek?.amount || 0;
                 if (paidForStartingWeek < weeklyPayment) {
                     const amountNeeded = weeklyPayment - paidForStartingWeek;
                     const amountToApply = Math.min(remainingAmountToDistribute, amountNeeded);
                     if (paymentForStartingWeek) {
                         paymentForStartingWeek.amount += amountToApply;
                     } else {
                         allPayments.push({ date: new Date().toISOString(), amount: amountToApply, weekNumber: startingWeekNumber });
                     }
                     remainingAmountToDistribute -= amountToApply;
                     if (!weeksPaidInTx.includes(startingWeekNumber)) {
                        weeksPaidInTx.push(startingWeekNumber);
                     }
                 }
            }
            
            // 2. Apply remaining amount to past dues, backwards from the week *before* the starting one
            if (remainingAmountToDistribute > 0) {
                for (let week = startingWeekNumber - 1; week >= 1; week--) {
                    if (remainingAmountToDistribute <= 0) break;

                    let paymentForWeek = allPayments.find(p => p.weekNumber === week);
                    const paidForWeek = paymentForWeek?.amount || 0;

                    if (paidForWeek < weeklyPayment) {
                        const amountNeeded = weeklyPayment - paidForWeek;
                        const amountToApply = Math.min(remainingAmountToDistribute, amountNeeded);
                        if (paymentForWeek) {
                            paymentForWeek.amount += amountToApply;
                        } else {
                            allPayments.push({ date: new Date().toISOString(), amount: amountToApply, weekNumber: week });
                        }
                        remainingAmountToDistribute -= amountToApply;
                         if (!weeksPaidInTx.includes(week)) {
                            weeksPaidInTx.push(week);
                        }
                    }
                }
            }

            // 3. Apply any final remaining amount forwards from the week *after* the starting one
            if (remainingAmountToDistribute > 0) {
                let weekToPay = startingWeekNumber + 1;
                while (remainingAmountToDistribute > 0 && weekToPay <= termInWeeks) {
                    let paymentForWeek = allPayments.find(p => p.weekNumber === weekToPay);
                    const paidForWeek = paymentForWeek?.amount || 0;

                     if (paidForWeek < weeklyPayment) {
                        const amountNeeded = weeklyPayment - paidForWeek;
                        const amountToApply = Math.min(remainingAmountToDistribute, amountNeeded);
                        if (paymentForWeek) {
                            paymentForWeek.amount += amountToApply;
                        } else {
                             allPayments.push({ date: new Date().toISOString(), amount: amountToApply, weekNumber: weekToPay });
                        }
                        remainingAmountToDistribute -= amountToApply;
                         if (!weeksPaidInTx.includes(weekToPay)) {
                            weeksPaidInTx.push(weekToPay);
                        }
                    }
                    weekToPay++;
                }
            }

            // --- Wallet and Transaction Logic ---
            if (amountPaid > 0) {
                const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                let weeksDescription = '';
                if (weeksPaidInTx.length > 1) {
                    weeksDescription = `Semanas ${weeksPaidInTx.sort((a,b)=> a-b).join(', ')}`;
                } else if (weeksPaidInTx.length === 1) {
                    weeksDescription = `Semana ${weeksPaidInTx[0]}`;
                } else {
                     weeksDescription = `Abono general`;
                }

                transaction.set(walletTransactionRef, {
                    type: 'credit',
                    amount: amountPaid,
                    date: new Date(),
                    description: `Abono de ${client?.name || 'N/A'} para préstamo (${weeksDescription}).`,
                    loanId: loanId,
                    clientId: loan.clientId,
                });
                transaction.update(walletRef, { balance: increment(amountPaid) });
            }
            // --- End Wallet Logic ---

            const totalPaid = allPayments.reduce((acc, p) => acc + p.amount, 0);
            const totalLoanAmount = weeklyPayment * termInWeeks;

            let newStatus: Loan['status'] = loan.status;

            if (totalPaid >= totalLoanAmount) {
                newStatus = wasOverdue ? 'Pagado desde CV' : 'Paid Off';
            } else {
                // Re-check current week status after payment distribution
                const updatedCurrentTimeDiff = today.getTime() - loanStartDate.getTime();
                const updatedCurrentLoanWeek = Math.max(1, Math.floor(updatedCurrentTimeDiff / (1000 * 3600 * 24 * 7)) + 1);

                let isUpToDate = true;
                for (let i = 1; i < updatedCurrentLoanWeek; i++) {
                    const paymentForWeek = allPayments.find(p => p.weekNumber === i);
                    const paidForWeek = paymentForWeek?.amount || 0;
                    if (paidForWeek < weeklyPayment) {
                        isUpToDate = false;
                        break;
                    }
                }

                if (isUpToDate) {
                    newStatus = 'Active';
                } else {
                    newStatus = 'Overdue';
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
        return { success: true, message: 'Pago registrado con éxito y añadido a la cartera.' };

    } catch (error: any) {
        console.error('Error registering payment:', error);
        return { success: false, message: `Error al registrar el pago: ${error.message}` };
    }
}

export async function payOffLoanAction(loanId: string) {
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


export async function accumulateAssumedPaymentsAction(loans: Loan[], loanPlans: LoanPlan[], clients: Client[]) {
    const today = new Date();
    const batch = writeBatch(db);
    const walletRef = doc(db, 'wallet', 'main');
    let totalAccumulatedAmount = 0;
    let paymentsAccumulated = 0;

    for (const loan of loans) {
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        if (!loanPlan || loan.status === 'Paid Off') continue;

        const timeDiff = today.getTime() - new Date(loan.startDate).getTime();
        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;

        if (currentLoanWeek <= 0 || currentLoanWeek > loanPlan.termInWeeks) continue;
        
        const paymentExists = loan.payments.some(p => p.weekNumber === currentLoanWeek);

        if (!paymentExists) {
            // This is an "assumed payment" that needs to be registered.
            const weeklyPaymentAmount = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const loanRef = doc(db, 'loans', loan.id);
            const client = clients.find(c => c.id === loan.clientId);
            
            const newPayment = {
                date: new Date().toISOString(),
                amount: weeklyPaymentAmount,
                weekNumber: currentLoanWeek,
            };

            const updatedPayments = [...loan.payments, newPayment];
            
            // Check if this payment makes the loan paid off
            const totalPaid = updatedPayments.reduce((acc, p) => acc + p.amount, 0);
            const totalLoanAmount = weeklyPaymentAmount * loanPlan.termInWeeks;
            let newStatus = loan.status;
            if (totalPaid >= totalLoanAmount) {
                newStatus = loan.status === 'Overdue' ? 'Pagado desde CV' : 'Paid Off';
            }

            batch.update(loanRef, { payments: updatedPayments, status: newStatus });
            
            // Add to wallet transaction
            const walletTransactionRef = doc(collection(db, 'walletTransactions'));
            batch.set(walletTransactionRef, {
                type: 'credit',
                amount: weeklyPaymentAmount,
                date: new Date(),
                description: `Abono (acumulado) de ${client?.name || 'N/A'} para préstamo (Semana ${currentLoanWeek}).`,
                loanId: loan.id,
                clientId: loan.clientId,
            });

            totalAccumulatedAmount += weeklyPaymentAmount;
            paymentsAccumulated++;
        }
    }

    if (paymentsAccumulated === 0) {
        return { success: true, message: 'No había pagos asumidos para acumular.' };
    }

    try {
        batch.update(walletRef, { balance: increment(totalAccumulatedAmount) });
        await batch.commit();

        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard');
        
        return { success: true, message: `Se acumularon ${paymentsAccumulated} pagos por un total de ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalAccumulatedAmount)}.` };
    } catch (error: any) {
        console.error('Error accumulating payments:', error);
        return { success: false, message: `Error al acumular pagos: ${error.message}` };
    }
}
