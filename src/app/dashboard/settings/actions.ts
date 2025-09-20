'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

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
        
        // Reset wallet
        const walletRef = doc(db, 'wallet', 'main');
        const batch = writeBatch(db);
        batch.set(walletRef, { balance: 0 });
        await batch.commit();

        revalidatePath('/dashboard', 'layout');

        return { success: true, message: 'Todos los datos han sido eliminados exitosamente.' };
    } catch (error: any) {
        console.error('Error deleting all data:', error);
        return { success: false, message: `Error al eliminar los datos: ${error.message}` };
    }
}
