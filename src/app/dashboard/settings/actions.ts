'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Plaza, Localidad, Promotora, AppUser } from '@/lib/types';

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
