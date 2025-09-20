'use server';

import type { Client } from '@/lib/types';

export type CreateLoanInput = {
    loanPlanId: string;
    amount: number;
    client: Omit<Client, 'id' | 'avatarUrl'> & { id?: string };
};

export async function createLoanAction(input: CreateLoanInput) {
    // This is where you would typically handle the form submission,
    // e.g., by calling an API to save the loan and client.
    // For now, we'll just log the data.
    console.log('Creating loan with input:', input);
    
    // In a real app, you would get the new loan and client data back from the API
    // and then potentially revalidate the data on the client.
    
    return { success: true, message: 'Préstamo creado con éxito.' };
}
