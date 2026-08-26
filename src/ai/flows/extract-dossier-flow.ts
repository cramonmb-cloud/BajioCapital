'use server';

import { getGeminiApiKey } from '@/app/dashboard/ajustes/actions';

export interface DossierDataInput {
  photo1DataUri: string; // Cliente: CFE + INE + Pagaré + Formato de Garantías
  photo2DataUri?: string; // Aval (Opcional): CFE + INE
}

export interface DossierDataOutput {
  // CLIENTE
  clientName: string;
  curp?: string;
  amount?: number;
  phone?: string;
  street?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  guarantees: string[];

  // AVAL
  endorsementName?: string;
  endorsementPhone?: string;
  endorsementStreet?: string;
  endorsementNeighborhood?: string;
  endorsementPostalCode?: string;
  endorsementCity?: string;
  endorsementGuarantees?: string[];
}

function parseDataUri(dataUri: string): { mimeType: string; base64Data: string } {
  const match = dataUri.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      base64Data: match[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    base64Data: dataUri,
  };
}

async function callGeminiVision(apiKey: string, parts: any[]): Promise<any> {
  const candidateModels = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.7-flash'];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            parts,
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.0,
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseJson = await response.json();
        const rawText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          try {
            return JSON.parse(rawText);
          } catch {
            const match = rawText.match(/\{[\s\S]*\}/);
            if (match) {
              return JSON.parse(match[0]);
            }
          }
        }
      } else {
        const errText = await response.text();
        console.warn(`Model ${model} returned ${response.status}: ${errText}`);
        lastError = new Error(`Error en modelo ${model} (${response.status}): ${errText}`);
        if (response.status === 404) {
          continue;
        }
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error?.message) {
            throw new Error(parsed.error.message);
          }
        } catch (_) {}
        throw lastError;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('404')) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo procesar la solicitud con los modelos de Gemini disponibles.');
}

export async function extractDossierData(input: DossierDataInput): Promise<DossierDataOutput> {
  const apiKey = await getGeminiApiKey();

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'No se ha configurado la API Key de Google Gemini. Por favor ve a Ajustes > Personalización > Inteligencia Artificial e ingresa tu API Key.'
    );
  }

  if (!input.photo1DataUri) {
    throw new Error('La Foto 1 (Expediente del Cliente) es obligatoria.');
  }

  const { mimeType: mimeType1, base64Data: base64Data1 } = parseDataUri(input.photo1DataUri);

  const parts: any[] = [
    {
      text: `Eres un auditor forense y transcriptor OCR estricto de documentos crediticios en México.
Tu tarea es transcribir con 100% de fidelidad y CERO ALUCINACIONES únicamente lo que está visible y escrito en los documentos.

IMPORTANTE: ESTÁ ESTRICTAMENTE PROHIBIDO INVENTAR INFORMACIÓN O ASUMIR ARTÍCULOS QUE NO ESTÉN ESCRITOS.

DOCUMENTOS EN LA IMAGEN:
- Credencial de Elector (INE)
- Recibo de luz (CFE)
- Pagaré / Solicitud de Crédito
- Hoja de Formato de Garantías (dividida en dos columnas: izquierda para Cliente, derecha para Aval)

REGLAS DE EXTRACCIÓN CRÍTICAS:

1. GARANTÍAS DEL CLIENTE (guarantees):
- Busca la columna o sección correspondiente al Acreditado / Cliente en la hoja de garantías.
- Revisa cada renglón numerado.
- CONDICIÓN INDISPENSABLE: ÚNICAMENTE extrae el texto que haya sido escrito a mano con pluma o bolígrafo.
- Si un renglón impreso está vacío, tiene una línea o no tiene texto manuscrito, NO lo incluyas.
- Si solo hay 1 renglón escrito, devuelve un array de 1 elemento. Si hay 2, devuelve 2. Si hay 3, devuelve 3.
- NUNCA inventes nombres de electrodomésticos, muebles o vehículos. Si no está escrito en la hoja, NO existe.
- Elimina los números de lista iniciales (ej. "1.-", "2.-") del texto.

2. GARANTÍAS DEL AVAL (endorsementGuarantees):
- Busca la columna o sección correspondiente al Aval en la hoja de garantías.
- Aplica la misma regla estricta: solo extrae lo escrito a mano con tinta en la columna del aval.
- Si la columna del aval está vacía o sin texto manuscrito, devuelve obligatoriamente una lista vacía [].
- NUNCA copies las garantías del cliente al aval.

3. DATOS DEL CLIENTE (TITULAR):
- clientName: Nombre oficial en orden "NOMBRE(S) PRIMER_APELLIDO SEGUNDO_APELLIDO" en MAYÚSCULAS.
- curp: CURP oficial de 18 caracteres de la credencial INE si es visible.
- amount: Monto numérico del crédito solicitado (ej. si dice "$3000", el valor es 3000).
- phone: Teléfono de 10 dígitos escrito en la solicitud o pagaré.
- street, neighborhood, postalCode, city: Domicilio del cliente.
  * PRIORIDAD ALTA al Recibo de CFE (luz) si está visible. Si no, usa el domicilio del INE.
  * street: Calle y número exterior/interior.
  * neighborhood: Colonia.
  * postalCode: Código Postal (5 dígitos).
  * city: Ciudad / Municipio y Estado.

4. DATOS DEL AVAL:
- endorsementName: Nombre completo del aval en orden estándar ("NOMBRE(S) PRIMER_APELLIDO SEGUNDO_APELLIDO" en MAYÚSCULAS) tomado de la hoja de garantías o de la Foto 2.
- endorsementPhone: Teléfono de 10 dígitos del aval.
- endorsementStreet, endorsementNeighborhood, endorsementPostalCode, endorsementCity: Domicilio del aval.

SALIDA OBLIGATORIA (JSON puro):
{
  "clientName": "...",
  "curp": "...",
  "amount": 0,
  "phone": "...",
  "street": "...",
  "neighborhood": "...",
  "postalCode": "...",
  "city": "...",
  "guarantees": [],
  "endorsementName": "...",
  "endorsementPhone": "...",
  "endorsementStreet": "...",
  "endorsementNeighborhood": "...",
  "endorsementPostalCode": "...",
  "endorsementCity": "...",
  "endorsementGuarantees": []
}`,
    },
    {
      text: 'Foto 1 (Expediente del Cliente - CFE, INE, Pagaré, Formato de Garantías):',
    },
    {
      inlineData: {
        mimeType: mimeType1,
        data: base64Data1,
      },
    },
  ];

  if (input.photo2DataUri) {
    const { mimeType: mimeType2, base64Data: base64Data2 } = parseDataUri(input.photo2DataUri);
    parts.push({
      text: 'Foto 2 (Expediente del Aval - CFE, INE del Aval):',
    });
    parts.push({
      inlineData: {
        mimeType: mimeType2,
        data: base64Data2,
      },
    });
  }

  const extractedData = await callGeminiVision(apiKey, parts);

  // Normalization & Validation: Clean guarantees and filter out empty or invalid items
  const guaranteesClean = Array.isArray(extractedData.guarantees)
    ? extractedData.guarantees
        .map((g: any) => String(g).replace(/^\d+\.?[-–—\s)\]]*/, '').trim().toUpperCase())
        .filter((g: string) => g.length > 1 && !/^[-–—\s._]+$/.test(g) && !/^(NINGUNA|SIN GARANTIA|VACIO|N\/A)$/i.test(g))
    : [];

  const endorsementGuaranteesClean = Array.isArray(extractedData.endorsementGuarantees)
    ? extractedData.endorsementGuarantees
        .map((g: any) => String(g).replace(/^\d+\.?[-–—\s)\]]*/, '').trim().toUpperCase())
        .filter((g: string) => g.length > 1 && !/^[-–—\s._]+$/.test(g) && !/^(NINGUNA|SIN GARANTIA|VACIO|N\/A)$/i.test(g))
    : [];

  const result: DossierDataOutput = {
    clientName: (extractedData.clientName || '').trim().toUpperCase(),
    curp: (extractedData.curp || '').trim().toUpperCase() || undefined,
    amount: typeof extractedData.amount === 'number' && !isNaN(extractedData.amount) ? extractedData.amount : (Number(extractedData.amount) || undefined),
    phone: (extractedData.phone || '').toString().trim() || undefined,
    street: (extractedData.street || '').trim().toUpperCase() || undefined,
    neighborhood: (extractedData.neighborhood || '').trim().toUpperCase() || undefined,
    postalCode: (extractedData.postalCode || '').toString().trim().toUpperCase() || undefined,
    city: (extractedData.city || '').trim().toUpperCase() || undefined,
    guarantees: guaranteesClean,

    endorsementName: (extractedData.endorsementName || '').trim().toUpperCase() || undefined,
    endorsementPhone: (extractedData.endorsementPhone || '').toString().trim() || undefined,
    endorsementStreet: (extractedData.endorsementStreet || '').trim().toUpperCase() || undefined,
    endorsementNeighborhood: (extractedData.endorsementNeighborhood || '').trim().toUpperCase() || undefined,
    endorsementPostalCode: (extractedData.endorsementPostalCode || '').toString().trim().toUpperCase() || undefined,
    endorsementCity: (extractedData.endorsementCity || '').trim().toUpperCase() || undefined,
    endorsementGuarantees: endorsementGuaranteesClean,
  };

  return result;
}
