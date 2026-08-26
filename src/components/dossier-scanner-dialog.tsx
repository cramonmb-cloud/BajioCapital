'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Sparkles, X, Check, Image as ImageIcon, FileText, User, Users, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractDossierData, type DossierDataOutput } from '@/ai/flows/extract-dossier-flow';

interface DossierScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyData: (data: DossierDataOutput) => void;
}

// Helper to resize images to max dimension to optimize transfer speed & memory
async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDimension = 2000;
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DossierScannerDialog({ isOpen, onOpenChange, onApplyData }: DossierScannerDialogProps) {
  const [photo1, setPhoto1] = useState<string | null>(null);
  const [photo2, setPhoto2] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedResult, setExtractedResult] = useState<DossierDataOutput | null>(null);

  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUri = await processImageFile(file);
      if (slot === 1) {
        setPhoto1(dataUri);
      } else {
        setPhoto2(dataUri);
      }
      setExtractedResult(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar imagen',
        description: err.message || 'No se pudo procesar el archivo seleccionado.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!photo1) {
      toast({
        variant: 'destructive',
        title: 'Foto requerida',
        description: 'Debes subir al menos la Foto 1 (Expediente del Cliente).',
      });
      return;
    }

    setIsAnalyzing(true);
    setExtractedResult(null);

    try {
      const result = await extractDossierData({
        photo1DataUri: photo1,
        photo2DataUri: photo2 || undefined,
      });

      setExtractedResult(result);
      toast({
        title: 'Expediente Analizado',
        description: 'La información fue extraída exitosamente con Gemini 2.5 Flash.',
      });
    } catch (error: any) {
      console.error('Error analyzing dossier:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Análisis IA',
        description: error.message || 'Hubo un error al procesar el expediente con IA.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = () => {
    if (!extractedResult) return;
    onApplyData(extractedResult);
    onOpenChange(false);
    toast({
      title: 'Datos Aplicados',
      description: 'La información del expediente se cargó en el formulario de préstamo.',
    });
  };

  const handleRemoveGuarantee = (index: number) => {
    if (!extractedResult) return;
    setExtractedResult({
      ...extractedResult,
      guarantees: extractedResult.guarantees.filter((_, i) => i !== index),
    });
  };

  const handleRemoveEndorsementGuarantee = (index: number) => {
    if (!extractedResult) return;
    setExtractedResult({
      ...extractedResult,
      endorsementGuarantees: (extractedResult.endorsementGuarantees || []).filter((_, i) => i !== index),
    });
  };

  const handleReset = () => {
    setPhoto1(null);
    setPhoto2(null);
    setExtractedResult(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[780px] max-h-[92vh] overflow-y-auto p-6"
        onPointerDownOutside={(e) => isAnalyzing && e.preventDefault()}
      >
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-base font-black tracking-tight uppercase">
            LLENAR DATOS ANALIZANDO FOTO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Slots de Fotos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ranura 1: Titular / Cliente */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-600" />
                  Foto 1: Expediente Cliente <span className="text-red-500 font-bold">*</span>
                </label>
                <Badge variant="outline" className="text-[9px] font-black border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/40">
                  CFE + INE + Pagaré + Garantías
                </Badge>
              </div>

              <input
                ref={fileInputRef1}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 1)}
              />

              {photo1 ? (
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-blue-500/40 bg-zinc-950 shadow-sm group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo1}
                    alt="Expediente Cliente"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef1.current?.click()}
                      disabled={isAnalyzing}
                      className="font-bold text-xs h-8"
                    >
                      Cambiar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setPhoto1(null);
                        setExtractedResult(null);
                      }}
                      disabled={isAnalyzing}
                      className="font-bold text-xs h-8 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isAnalyzing && fileInputRef1.current?.click()}
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 bg-zinc-50/70 dark:bg-zinc-900/40 hover:bg-blue-50/30 transition-all flex flex-col items-center justify-center cursor-pointer p-4 text-center group"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                    Subir foto del expediente
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 max-w-[220px]">
                    Captura o selecciona la foto que contiene el recibo CFE, INE, pagaré y garantías
                  </span>
                </div>
              )}
            </div>

            {/* Ranura 2: Aval (Opcional) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  Foto 2: Expediente Aval
                </label>
                <Badge variant="outline" className="text-[9px] font-bold border-zinc-200 text-zinc-500">
                  Opcional (CFE + INE)
                </Badge>
              </div>

              <input
                ref={fileInputRef2}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 2)}
              />

              {photo2 ? (
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-indigo-500/40 bg-zinc-950 shadow-sm group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo2}
                    alt="Expediente Aval"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef2.current?.click()}
                      disabled={isAnalyzing}
                      className="font-bold text-xs h-8"
                    >
                      Cambiar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setPhoto2(null);
                        setExtractedResult(null);
                      }}
                      disabled={isAnalyzing}
                      className="font-bold text-xs h-8 px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !isAnalyzing && fileInputRef2.current?.click()}
                  className="aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-zinc-50/70 dark:bg-zinc-900/40 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center cursor-pointer p-4 text-center group"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
                    Subir foto del aval
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-1 max-w-[220px]">
                    Opcional si tienes foto separada del CFE e INE del aval
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botón de Análisis */}
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !photo1}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs h-11 px-8 rounded-xl shadow-lg shadow-blue-500/20"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizando con Gemini 2.5 Flash...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analizar Expediente con IA
                </>
              )}
            </Button>
          </div>

          {/* Resumen de Datos Detectados */}
          {extractedResult && (
            <Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 shadow-md animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="pb-3 border-b border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40">
                <CardTitle className="text-xs font-black uppercase tracking-tight flex items-center justify-between text-blue-950 dark:text-blue-200">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Datos Detectados en el Expediente
                  </span>
                  {extractedResult.amount && (
                    <Badge className="bg-emerald-600 text-white font-black text-xs px-2.5">
                      ${new Intl.NumberFormat('es-MX').format(extractedResult.amount)} MXN
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                {/* Sección Cliente */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-300 block">
                    Cliente (Titular)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/70 dark:bg-zinc-900/70 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Nombre:</span>
                      <span className="font-black text-zinc-900 dark:text-zinc-100">
                        {extractedResult.clientName || '—'}
                      </span>
                    </div>
                    {extractedResult.curp && (
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">CURP:</span>
                        <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {extractedResult.curp}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Teléfono:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {extractedResult.phone || '—'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Dirección (Prioridad CFE):</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {[
                          extractedResult.street,
                          extractedResult.neighborhood ? `Col. ${extractedResult.neighborhood}` : '',
                          extractedResult.postalCode ? `C.P. ${extractedResult.postalCode}` : '',
                          extractedResult.city,
                        ].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                    {extractedResult.guarantees.length > 0 && (
                      <div className="sm:col-span-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1.5">
                          Garantías del Cliente ({extractedResult.guarantees.length}):
                        </span>
                        <div className="space-y-1.5">
                          {extractedResult.guarantees.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-zinc-800 border rounded-md text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                              <span>{idx + 1}.- {item}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGuarantee(idx)}
                                className="text-zinc-400 hover:text-red-600 p-0.5 rounded transition-colors"
                                title="Quitar garantía"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sección Aval */}
                {(extractedResult.endorsementName || extractedResult.endorsementPhone || extractedResult.endorsementStreet || (extractedResult.endorsementGuarantees && extractedResult.endorsementGuarantees.length > 0)) && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 block">
                      Aval (Garante)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/70 dark:bg-zinc-900/70 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Nombre Aval:</span>
                        <span className="font-black text-zinc-900 dark:text-zinc-100">
                          {extractedResult.endorsementName || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Teléfono:</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {extractedResult.endorsementPhone || '—'}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Dirección:</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {[
                            extractedResult.endorsementStreet,
                            extractedResult.endorsementNeighborhood ? `Col. ${extractedResult.endorsementNeighborhood}` : '',
                            extractedResult.endorsementPostalCode ? `C.P. ${extractedResult.endorsementPostalCode}` : '',
                            extractedResult.endorsementCity,
                          ].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                      {extractedResult.endorsementGuarantees && extractedResult.endorsementGuarantees.length > 0 && (
                        <div className="sm:col-span-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase block mb-1.5">
                            Garantías del Aval ({extractedResult.endorsementGuarantees.length}):
                          </span>
                          <div className="space-y-1.5">
                            {extractedResult.endorsementGuarantees.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-white dark:bg-zinc-800 border rounded-md text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                                <span>{idx + 1}.- {item}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEndorsementGuarantee(idx)}
                                  className="text-zinc-400 hover:text-red-600 p-0.5 rounded transition-colors"
                                  title="Quitar garantía"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAnalyzing}
            className="font-bold text-xs"
          >
            Cerrar
          </Button>
          {extractedResult && (
            <Button
              type="button"
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-xs h-10 px-6 shadow-md"
            >
              <Check className="mr-2 h-4 w-4" />
              Aplicar Datos al Préstamo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
