'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Group, Supervisor } from '@/lib/types';

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
        await deleteCollection('groups');
        await deleteCollection('supervisors');
        
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

// Supervisor Actions
export async function saveSupervisorAction(name: string) {
    try {
        await addDoc(collection(db, 'supervisors'), { name });
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Supervisor guardado con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar supervisor: ${error.message}` };
    }
}

// Group Actions
export async function saveGroupAction(groupData: Omit<Group, 'id'>) {
    try {
        await addDoc(collection(db, 'groups'), groupData);
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Grupo guardado con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al guardar grupo: ${error.message}` };
    }
}

export async function deleteGroupAction(groupId: string) {
    try {
        await deleteDoc(doc(db, 'groups', groupId));
        revalidatePath('/dashboard/settings');
        return { success: true, message: 'Grupo eliminado con éxito.' };
    } catch (error: any) {
        return { success: false, message: `Error al eliminar grupo: ${error.message}` };
    }
}
