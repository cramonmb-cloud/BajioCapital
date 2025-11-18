'use server';

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import type { Client } from '@/lib/types';

export async function saveClientAction(clientId: string, clientData: Omit<Client, 'id'>) {
    if (!clientId) {
        return { success: false, message: 'ID de cliente no proporcionado.' };
    }

    try {
        const clientRef = doc(db, 'clients', clientId);
        // We need to remove the fields that are not part of the core client data from the form
        const { id, ...dataToSave } = clientData as Client;
        await updateDoc(clientRef, dataToSave);

        revalidatePath('/dashboard/clients');
        revalidatePath(`/dashboard/clients/${clientId}`);
        revalidatePath(`/dashboard/clients/${clientId}/edit`);

        return { success: true, message: 'Cliente actualizado con éxito.' };
    } catch (error: any) {
        console.error('Error saving client:', error);
        return { success: false, message: `Error al guardar el cliente: ${error.message}` };
    }
}
