'use server';

import fs from 'fs';
import path from 'path';

export async function saveFirebaseConfig(rawText: string) {
  try {
    let config: any = null;
    const cleanText = rawText.trim();
    
    try {
      config = JSON.parse(cleanText);
    } catch (e) {
      const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
      const extracted: Record<string, string> = {};
      
      for (const key of keys) {
        const regex = new RegExp(`(?:['"]?${key}['"]?\\s*:\\s*['"]([^'"]+)['"])`);
        const match = cleanText.match(regex);
        if (match && match[1]) {
          extracted[key] = match[1];
        }
      }
      
      if (extracted.apiKey && extracted.projectId) {
        config = extracted;
      }
    }

    if (!config || !config.apiKey || !config.projectId) {
      return { success: false, error: 'No se pudo extraer una configuración de Firebase válida. Asegúrate de incluir al menos apiKey y projectId.' };
    }

    const configPath = path.join(process.cwd(), 'src', 'firebase-config.json');
    
    const cleanConfig = {
      apiKey: config.apiKey || "",
      authDomain: config.authDomain || "",
      projectId: config.projectId || "",
      storageBucket: config.storageBucket || "",
      messagingSenderId: config.messagingSenderId || "",
      appId: config.appId || "",
      measurementId: config.measurementId || ""
    };

    fs.writeFileSync(configPath, JSON.stringify(cleanConfig, null, 2), 'utf-8');

    return { success: true };
  } catch (error: any) {
    console.error('Error saving firebase config:', error);
    return { success: false, error: error.message || 'Error interno al guardar la configuración.' };
  }
}
