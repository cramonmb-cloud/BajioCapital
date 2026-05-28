// This is a server-side file.
'use server';

/**
 * @fileOverview Provides personalized outreach suggestions for loan clients based on their payment history and loan status.
 *
 * - `getClientOutreachSuggestion`: A function that generates outreach suggestions for a given client.
 * - `ClientOutreachInput`: The input type for the `getClientOutreachSuggestion` function, including client details and loan information.
 * - `ClientOutreachOutput`: The output type for the `getClientOutreachSuggestion` function, providing suggested outreach strategies.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const ClientOutreachInputSchema = z.object({
  clientId: z.string().describe('Unique identifier for the client.'),
  clientName: z.string().describe('Name of the client.'),
  loanAmount: z.number().describe('The amount of the loan.'),
  loanStatus: z.string().describe('Current status of the loan (e.g., active, overdue, paid).'),
  paymentHistory: z.string().describe('A summary of the client payment history.'),
  missedPayments: z.number().describe('Number of missed payments.'),
});
export type ClientOutreachInput = z.infer<typeof ClientOutreachInputSchema>;

const ClientOutreachOutputSchema = z.object({
  outreachSuggestion: z.string().describe('A personalized outreach suggestion for the client.'),
});
export type ClientOutreachOutput = z.infer<typeof ClientOutreachOutputSchema>;

export async function getClientOutreachSuggestion(
  input: ClientOutreachInput
): Promise<ClientOutreachOutput> {
  return clientOutreachFlow(input);
}

const clientOutreachPrompt = ai.definePrompt({
  name: 'clientOutreachPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: {schema: ClientOutreachInputSchema},
  output: {schema: ClientOutreachOutputSchema},
  prompt: `You are a helpful AI assistant that provides personalized outreach suggestions for loan clients.

  Based on the client's information, payment history, and loan status, suggest a strategy for outreach.
  Consider the client's name, loan amount, loan status, payment history, and number of missed payments when formulating your suggestion.
  The suggestion should be empathetic, professional, and aimed at improving loan repayment rates and client relationships.

  Client ID: {{{clientId}}}
  Client Name: {{{clientName}}}
  Loan Amount: {{{loanAmount}}}
  Loan Status: {{{loanStatus}}}
  Payment History: {{{paymentHistory}}}
  Missed Payments: {{{missedPayments}}}

  Outreach Suggestion:`,
});

const clientOutreachFlow = ai.defineFlow(
  {
    name: 'clientOutreachFlow',
    inputSchema: ClientOutreachInputSchema,
    outputSchema: ClientOutreachOutputSchema,
  },
  async input => {
    const {output} = await clientOutreachPrompt(input);
    return output!;
  }
);
