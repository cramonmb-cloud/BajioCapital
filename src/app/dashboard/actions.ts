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
    
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday = 0, Saturday = 6
    const daysUntilSaturday = 6 - dayOfWeek;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);

    const newLoan = {
        ...input,
        startDate: saturday.toISOString().split('T')[0], // Format as YYYY-MM-DD
    };

    console.log('Creating loan with input:', newLoan);
    
    // In a real app, you would get the new loan and client data back from the API
    // and then potentially revalidate the data on the client.
    
    return { success: true, message: 'Préstamo creado con éxito.' };
}
