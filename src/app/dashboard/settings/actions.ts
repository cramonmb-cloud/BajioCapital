'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, addDoc, deleteDoc, setDoc, increment, Timestamp, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Plaza, Localidad, Promotora, AppUser, AppConfig, Loan, LoanPlan, Client } from '@/lib/types';

// Helper to handle Firestore dates consistently in server actions
const parseFirestoreDate = (date: any): Date => {
    if (!date) return new Date();
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date === 'string') return new Date(date);
    if (date instanceof Date) return date;
    return new Date();
};

async function deleteCollection(collectionPath: string) {
    const collectionRef = collection(db, collectionPath);
    const snapshot = await getDocs(collectionRef);
    if (snapshot.empty) {
        return;
    }
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
}


export async function deleteAllDataAction() {
    try {
        await deleteCollection('clients');
        await deleteCollection('loans');
        await deleteCollection('loanPlans');
        await deleteCollection('walletTransactions');
        await deleteCollection('plazas');
        await deleteCollection('localidades');
        await deleteCollection('promotoras');
        await deleteCollection('users');
        await deleteCollection('config');
        
        // Reset wallet
        const walletRef = doc(db, 'wallet', 'main');
        const batch = writeBatch(db);
        batch.set(walletRef, { balance: 0 });
        await batch.commit();

        revalidatePath('/dashboard');
        revalidatePath('/dashboard/wallet');
        revalidatePath('/dashboard/clients');
        revalidatePath('/dashboard/loans');
        revalidatePath('/dashboard/plans');
        revalidatePath('/dashboard/control');
        revalidatePath('/dashboard/settings');


        return { success: true, message: 'Todos los datos han sido eliminados exitosamente.' };
    } catch (error: any) {
        console.error('Error deleting all data:', error);
        return { success: false, message: `Error al eliminar los datos: ${error.message}` };
    }
}

// Global Payment Accumulation
export async function accumulateAllSystemPaymentsAction(userId?: string) {
    try {
        const [loansSnap, plansSnap, clientsSnap] = await Promise.all([
            getDocs(collection(db, 'loans')),
            getDocs(collection(db, 'loanPlans')),
            getDocs(collection(db, 'clients'))
        ]);

        const loanPlans = plansSnap.docs.map(d => ({ id: d.id, ...d.data() } as LoanPlan));
        const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        const loans = loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // Note: Filter correctly including those that should be closed
        const activeLoans = loans.filter(l => l.status !== 'Paid Off' && l.status !== 'Pagado desde CV');
        
        if (activeLoans.length === 0) {
            return { success: true, message: 'No hay préstamos activos para procesar.' };
        }

        const today = new Date();
        let totalAccumulatedAmount = 0;
        let paymentsAccumulatedCount = 0;
        
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const loan of activeLoans) {
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan) continue;

            const loanStartDate = parseFirestoreDate(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            const weeklyPaymentAmount = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const client = clients.find(c => c.id === loan.clientId);
            
            // Penalty check
            let missedWeeksCount = 0;
            const currentPayments = (loan.payments || []).map((p: any) => ({
                ...p,
                date: parseFirestoreDate(p.date).toISOString()
            }));

            for (let i = 1; i < rawCurrentLoanWeek; i++) {
                const p = currentPayments.find((pay: any) => pay.weekNumber === i);
                if (p && p.amount < weeklyPaymentAmount) missedWeeksCount++;
            }
            const termInWeeks = loanPlan.termInWeeks + (missedWeeksCount >= 2 ? 1 : 0);

            let updatedPayments = [...currentPayments];
            let loanChanged = false;

            // Check every past week up to current (capped at term)
            for (let weekNumber = 1; weekNumber <= Math.min(rawCurrentLoanWeek, termInWeeks); weekNumber++) {
                if (weekNumber <= 0) continue;

                const paymentExists = updatedPayments.some((p: any) => p.weekNumber === weekNumber);

                if (!paymentExists) {
                    updatedPayments.push({
                        date: new Date().toISOString(),
                        amount: weeklyPaymentAmount,
                        weekNumber: weekNumber,
                    });
                    
                    const walletTransactionRef = doc(collection(db, 'walletTransactions'));
                    batch.set(walletTransactionRef, {
                        type: 'credit',
                        amount: weeklyPaymentAmount,
                        date: new Date(),
                        description: `Abono (sincronización masiva) de ${client?.name || 'N/A'} - Semana ${weekNumber}.`,
                        loanId: loan.id,
                        clientId: loan.clientId,
                        userId: userId || null,
                    });

                    totalAccumulatedAmount += weeklyPaymentAmount;
                    paymentsAccumulatedCount++;
                    batchCount++;
                    loanChanged = true;
                }
            }

            if (loanChanged) {
                // Closing logic
                let effectivePaid = 0;
                for (let i = 1; i <= termInWeeks; i++) {
                    const p = updatedPayments.find((pay: any) => pay.weekNumber === i);
                    if (p) effectivePaid += p.amount;
                    else if (i < rawCurrentLoanWeek) effectivePaid += weeklyPaymentAmount;
                }

                const totalLoanAmount = weeklyPaymentAmount * termInWeeks;
                let newStatus = loan.status;
                if (effectivePaid >= totalLoanAmount) {
                    newStatus = (loan.status === 'Overdue' || rawCurrentLoanWeek > termInWeeks) ? 'Pagado desde CV' : 'Paid Off';
                }

                batch.update(doc(db, 'loans', loan.id), { payments: updatedPayments, status: newStatus });
                batchCount++;
            }

            if (batchCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        if (paymentsAccumulatedCount > 0) {
            const walletRef = doc(db, 'wallet', 'main');
            batch.update(walletRef, { balance: increment(totalAccumulatedAmount) });
            await batch.commit();
        }

        revalidatePath('/dashboard', 'layout');
        
        return { 
            success: true, 
            message: `Se sincronizaron ${paymentsAccumulatedCount} abonos por un total de ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalAccumulatedAmount)}.` 
        };
    } catch (error: any) {
        console.error('Error in global accumulation:', error);
        return { success: false, message: `Error al sincronizar abonos: ${error.message}` };
    }
}

// User Actions
export async function saveUserAction(uid: string, userData: Omit<AppUser, 'id'>) {
    try {
        await setDoc(doc(db, 'users', uid), userData);
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Usuario guardado en Firestore.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar usuario en Firestore: ${error.message}` };
    }
}

export async function deleteUserAction(uid: string) {
    try {
        await deleteDoc(doc(db, 'users', uid));
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Usuario eliminado de Firestore.' };
    } catch (error: any) {
        // Note: This does not delete the user from Firebase Auth
        return { success: false, message: `Error al eliminar usuario: ${error.message}` };
    }
}

// Plaza Actions
export async function savePlazaAction(name: string) {
    try {
        await addDoc(collection(db, 'plazas'), { name });
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Plaza guardada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar plaza: ${error.message}` };
    }
}

export async function deletePlazaAction(id: string) {
    try {
        await deleteDoc(doc(db, 'plazas', id));
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Plaza eliminada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al eliminar plaza: ${error.message}` };
    }
}

// Localidad Actions
export async function saveLocalidadAction(data: Omit<Localidad, 'id'>) {
    try {
        await addDoc(collection(db, 'localidades'), data);
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Localidad guardada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar localidad: ${error.message}` };
    }
}

export async function deleteLocalidadAction(id: string) {
    try {
        await deleteDoc(doc(db, 'localidades', id));
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Localidad eliminada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al eliminar localidad: ${error.message}` };
    }
}

// Promotora Actions
export async function savePromotoraAction(data: Omit<Promotora, 'id'>) {
    try {
        await addDoc(collection(db, 'promotoras'), data);
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Promotora guardada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar promotora: ${error.message}` };
    }
}

export async function deletePromotoraAction(id: string) {
    try {
        await deleteDoc(doc(db, 'promotoras', id));
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Promotora eliminada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al eliminar promotora: ${error.message}` };
    }
}


// App Config Actions
export async function saveLogoAction(logoUrl: string) {
    try {
        const configRef = doc(db, 'config', 'main');
        await setDoc(configRef, { logoUrl }, { merge: true });
        revalidatePath('/dashboard', 'layout');
        return { success: true, message: 'Logo actualizado con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar el logo: ${error.message}` };
    }
}

export async function saveAppNameAction(appName: string) {
    try {
        const configRef = doc(db, 'config', 'main');
        await setDoc(configRef, { appName }, { merge: true });
        revalidatePath('/dashboard', 'layout');
        return { success: true, message: 'Nombre de la aplicación actualizado con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar el nombre de la aplicación: ${error.message}` };
    }
}

export async function saveWhatsAppTemplateAction(template: string) {
    try {
        const configRef = doc(db, 'config', 'main');
        await setDoc(configRef, { whatsappTemplate: template }, { merge: true });
        revalidatePath('/dashboard', 'layout');
        return { success: true, message: 'Plantilla de WhatsApp guardada con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar la plantilla: ${error.message}` };
    }
}

/**
 * Migrates a Localidad from its current Plaza to a target Plaza.
 * This effectively moves all linked Promotoras and Loans since the hierarchy is relational.
 */
export async function migrateLocalidadAction(localidadId: string, targetPlazaId: string) {
    try {
        const localidadRef = doc(db, 'localidades', localidadId);
        await updateDoc(localidadRef, { plazaId: targetPlazaId });
        
        revalidatePath('/dashboard', 'layout');
        
        return { 
            success: true, 
            message: 'La localidad y todos sus activos han sido migrados a la nueva plaza.' 
        };
    } catch (error: any) {
        console.error('Error migrating locality:', error);
        return { success: false, message: `Error al migrar localidad: ${error.message}` };
    }
}
