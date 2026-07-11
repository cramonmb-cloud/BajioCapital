'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { saveFirebaseConfig } from './actions';
import { CheckCircle2, AlertTriangle, KeyRound, Server, Loader2, Code, Keyboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function NewInstallationPage() {
  const [rawText, setRawText] = useState('');
  const [activeTab, setActiveTab] = useState('paste');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Manual fields state
  const [manualConfig, setManualConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
  });

  const [parsedConfig, setParsedConfig] = useState<any>(null);
  const router = useRouter();
  const { toast } = useToast();

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setManualConfig(prev => {
      const updated = { ...prev, [name]: value.trim() };
      if (updated.apiKey && updated.projectId) {
        setParsedConfig(updated);
      } else {
        setParsedConfig(null);
      }
      return updated;
    });
  };

  // Robust parsing function
  const parseFirebaseCode = (text: string) => {
    try {
      if (!text.trim()) {
        return null;
      }

      // 1. Try direct JSON parsing
      try {
        const json = JSON.parse(text.trim());
        if (json.apiKey && json.projectId) {
          return json;
        }
      } catch (err) {
        // Not valid JSON, continue to regex
      }

      // 2. Regex parsing (supports single, double, backtick quotes and spaces)
      const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
      const extracted: Record<string, string> = {};
      
      for (const key of keys) {
        // Match key: "value", key: 'value', "key": `value`, etc.
        const regex = new RegExp(`(?:['"\`]?${key}['"\`]?\\s*:\\s*['"\`]([^'"\`]+)['"\`])`);
        const match = text.match(regex);
        if (match && match[1]) {
          extracted[key] = match[1].trim();
        }
      }

      if (extracted.apiKey && extracted.projectId) {
        return extracted;
      }
      return null;
    } catch (err) {
      return null;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    const config = parseFirebaseCode(text);
    setParsedConfig(config);
  };

  const handleSave = async () => {
    if (!parsedConfig || !parsedConfig.apiKey || !parsedConfig.projectId) {
      setError('Asegúrate de configurar al menos apiKey y projectId.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Format config string as JSON for action
    const configString = JSON.stringify(parsedConfig);
    const result = await saveFirebaseConfig(configString);

    if (result.success) {
      toast({
        title: "¡Configuración guardada!",
        description: "El proyecto de Firebase ha sido actualizado. Redirigiendo...",
        duration: 5000,
      });
      
      setTimeout(() => {
        // Redirect and reload page completely to reset client state
        window.location.href = '/login';
      }, 2000);
    } else {
      setError(result.error || 'Error al guardar la configuración.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 md:p-8">
      <Card className="w-full max-w-2xl border-slate-700/50 bg-slate-900/80 backdrop-blur-md text-white shadow-2xl">
        <CardHeader className="space-y-2 border-b border-slate-800/80 pb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Server className="h-6 w-6 text-indigo-400" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Configurar Nueva Instancia
            </CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">
            Configura el nuevo proyecto de Firebase para conectar esta aplicación de manera independiente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setParsedConfig(v === 'paste' ? parseFirebaseCode(rawText) : (manualConfig.apiKey && manualConfig.projectId ? manualConfig : null)); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-950 border border-slate-800/60 p-1 rounded-xl">
              <TabsTrigger value="paste" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white flex items-center gap-2">
                <Code className="h-4 w-4" />
                Pegar Código SDK
              </TabsTrigger>
              <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Ingreso Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">
                  Código de Firebase
                </label>
                <Textarea
                  placeholder={`// Pega el código de configuración de Firebase console aquí...\nconst firebaseConfig = {\n  apiKey: "...",\n  projectId: "...",\n  ...\n};`}
                  className="font-mono text-xs bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500 h-48 resize-none placeholder:text-slate-600 rounded-lg"
                  value={rawText}
                  onChange={handleTextChange}
                />
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">API Key *</label>
                  <Input
                    name="apiKey"
                    placeholder="AIzaSy..."
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.apiKey}
                    onChange={handleManualChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Project ID *</label>
                  <Input
                    name="projectId"
                    placeholder="mi-proyecto-123"
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.projectId}
                    onChange={handleManualChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Auth Domain</label>
                  <Input
                    name="authDomain"
                    placeholder="mi-proyecto-123.firebaseapp.com"
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.authDomain}
                    onChange={handleManualChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">App ID</label>
                  <Input
                    name="appId"
                    placeholder="1:123456:web:abcd"
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.appId}
                    onChange={handleManualChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Storage Bucket</label>
                  <Input
                    name="storageBucket"
                    placeholder="mi-proyecto-123.firebasestorage.app"
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.storageBucket}
                    onChange={handleManualChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Messaging Sender ID</label>
                  <Input
                    name="messagingSenderId"
                    placeholder="123456789"
                    className="bg-slate-950/80 border-slate-800 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                    value={manualConfig.messagingSenderId}
                    onChange={handleManualChange}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error de Configuración</AlertTitle>
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {parsedConfig && (
            <div className="space-y-3 bg-slate-950/45 p-4 rounded-lg border border-slate-800/80">
              <div className="flex items-center text-xs font-semibold text-indigo-400 space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Configuración de Firebase detectada:</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Project ID:</span>
                  <p className="text-slate-300 truncate">{parsedConfig.projectId}</p>
                </div>
                <div>
                  <span className="text-slate-500">API Key:</span>
                  <p className="text-slate-300 truncate">{parsedConfig.apiKey ? '••••••••••••••••' : 'No detectada'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Auth Domain:</span>
                  <p className="text-slate-300 truncate">{parsedConfig.authDomain || 'No detectado'}</p>
                </div>
                <div>
                  <span className="text-slate-500">App ID:</span>
                  <p className="text-slate-300 truncate">{parsedConfig.appId || 'No detectado'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-amber-500/80 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 flex items-start space-x-2 leading-relaxed">
            <KeyRound className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Importante:</strong> Al guardar, la aplicación se desconectará del proyecto actual de Firebase y comenzará a comunicarse con esta nueva base de datos. Los datos anteriores no serán alterados ni borrados.
            </span>
          </div>
        </CardContent>

        <CardFooter className="border-t border-slate-800/80 pt-6 flex justify-end">
          <Button
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium shadow-lg hover:shadow-indigo-500/20 transition-all rounded-lg"
            disabled={!parsedConfig || isLoading}
            onClick={handleSave}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando configuración...
              </>
            ) : (
              'Guardar y Conectar Nueva BD'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
