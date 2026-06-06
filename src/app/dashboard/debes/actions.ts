'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { PromotoraSettlement } from '@/lib/types';

export async function saveSettlementAction(settlement: PromotoraSettlement) {
    try {
        const docRef = doc(db, 'promotoraSettlements', settlement.id);
        
        await setDoc(docRef, {
            ...settlement,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        revalidatePath('/dashboard/debes');
        return { success: true, message: 'Liquidación guardada correctamente.' };
    } catch (err: any) {
        console.error('Error saving promotora settlement:', err);
        return { success: false, message: err.message || 'Error al guardar la liquidación.' };
    }
}
