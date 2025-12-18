'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { extractIdData, type IdDataOutput } from '@/ai/flows/extract-id-data-flow';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface IdScannerProps {
  onDataExtracted: (data: Partial<IdDataOutput>) => void;
  disabled?: boolean;
}

export function IdScanner({ onDataExtracted, disabled }: IdScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  const openCamera = useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Error de Cámara',
          description: 'No se pudo acceder a la cámara. Revisa los permisos en tu navegador.',
        });
        setIsOpen(false);
      }
    } else {
      setHasCameraPermission(false);
       toast({
          variant: 'destructive',
          title: 'Error de Cámara',
          description: 'Tu navegador no soporta el acceso a la cámara.',
        });
      setIsOpen(false);
    }
  }, [toast]);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      openCamera();
    } else {
      closeCamera();
    }
    // Cleanup function to ensure camera is off when component unmounts or dialog closes
    return () => {
      closeCamera();
    };
  }, [isOpen, openCamera, closeCamera]);
  

  const handleScan = async () => {
    if (!videoRef.current) return;
    setIsScanning(true);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo procesar la imagen.' });
        setIsScanning(false);
        return;
    }
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const photoDataUri = canvas.toDataURL('image/jpeg');

    try {
      const result = await extractIdData({ photoDataUri });
      toast({
        title: 'Datos Extraídos',
        description: 'La información del INE ha sido procesada.',
      });
      onDataExtracted(result);
      setIsOpen(false);
    } catch (error) {
      console.error("Error extracting ID data:", error);
      toast({
        variant: 'destructive',
        title: 'Error de Extracción',
        description: 'No se pudo leer la información de la imagen. Intenta de nuevo con mejor iluminación.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setIsOpen(true)} disabled={disabled}>
        <Camera className="h-4 w-4" />
        <span className="sr-only">Escanear INE</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Escanear Identificación (INE)</DialogTitle>
            <DialogDescription>
              Apunta la cámara a la parte frontal de la credencial. Asegúrate de que haya buena iluminación y el texto sea legible.
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
            {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <Alert variant="destructive">
                        <AlertTitle>Acceso a Cámara Denegado</AlertTitle>
                        <AlertDescription>
                            Por favor, habilita los permisos de cámara en tu navegador para usar esta función.
                        </AlertDescription>
                    </Alert>
                </div>
            )}
            {hasCameraPermission === null && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancelar
            </Button>
            <Button type="button" onClick={handleScan} disabled={isScanning || !hasCameraPermission}>
              {isScanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {isScanning ? 'Escaneando...' : 'Escanear ID'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
