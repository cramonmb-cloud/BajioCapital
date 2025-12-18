'use server';
/**
 * @fileOverview Extracts structured data from an image of an official ID card.
 *
 * - extractIdData - A function that handles the ID data extraction process.
 * - IdDataInput - The input type for the extractIdData function.
 * - IdDataOutput - The return type for the extractIdData function.
 */

import {ai} from '@/ai/genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {z} from 'genkit';

const IdDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an ID card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdDataInput = z.infer<typeof IdDataInputSchema>;

const IdDataOutputSchema = z.object({
    name: z.string().describe("The full name of the person, formatted as 'NAME LASTNAME1 LASTNAME2'."),
    street: z.string().describe("The street name and number from the address."),
    neighborhood: z.string().describe("The neighborhood (colonia) from the address."),
    postalCode: z.string().describe("The postal code from the address."),
    city: z.string().describe("The city and state from the address (e.g., 'CITY, STATE')."),
});
export type IdDataOutput = z.infer<typeof IdDataOutputSchema>;

export async function extractIdData(input: IdDataInput): Promise<IdDataOutput> {
  return extractIdDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractIdDataPrompt',
  model: googleAI('gemini-pro-vision'),
  input: {schema: IdDataInputSchema},
  output: {schema: IdDataOutputSchema},
  prompt: `You are an expert OCR system for official ID cards from Mexico (INE). Your task is to extract the person's full name and address details from the provided image.

  The name is usually under the "NOMBRE/NAME" label. It consists of last names and given names. Combine them into a single string, with names first, then last names. For example, if you see "GOMEZ VELAZQUEZ MARGARITA", the output should be "MARGARITA GOMEZ VELAZQUEZ".

  The address is under the "DOMICILIO/ADDRESS" label. From the address line, extract the street (including number), neighborhood (colonia), postal code, and city/state. Be careful, sometimes the address is spread over multiple lines.

  Example INE Address: "CALLE FALSA 123, COL. CENTRO, 12345, SPRINGFIELD, EDO"
  - street: "CALLE FALSA 123"
  - neighborhood: "COL. CENTRO"
  - postalCode: "12345"
  - city: "SPRINGFIELD, EDO"

  Extract the data from the following image:
  Photo: {{media url=photoDataUri}}`,
});

const extractIdDataFlow = ai.defineFlow(
  {
    name: 'extractIdDataFlow',
    inputSchema: IdDataInputSchema,
    outputSchema: IdDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
