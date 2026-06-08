'use server';

import { db } from '@/lib/firebase';
import { collection, doc, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { Personal } from '@/lib/types';

export async function savePersonalAction(data: Omit<Personal, 'id' | 'createdAt'>, id?: string) {
    try {
        if (id) {
            await setDoc(doc(db, 'personal', id), data, { merge: true });
        } else {
            const docData = {
                ...data,
                createdAt: new Date().toISOString(),
            };
            await addDoc(collection(db, 'personal'), docData);
        }
        revalidatePath('/dashboard/personal');
        return { success: true, message: id ? 'Ficha de personal actualizada con éxito.' : 'Personal registrado con éxito.' };
    } catch (error: any) {
        console.error('Error al guardar personal:', error);
        return { success: false, message: `Error al guardar personal: ${error.message}` };
    }
}

export async function deletePersonalAction(id: string) {
    try {
        await deleteDoc(doc(db, 'personal', id));
        revalidatePath('/dashboard/personal');
        return { success: true, message: 'Ficha de personal eliminada con éxito.' };
    } catch (error: any) {
        console.error('Error al eliminar personal:', error);
        return { success: false, message: `Error al eliminar personal: ${error.message}` };
    }
}
