'use client';

import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadButtonProps {
  apiKey?: string;
  onUploadSuccess: (url: string) => void;
  disabled?: boolean;
}

export function ImageUploadButton({ apiKey, onUploadSuccess, disabled }: ImageUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleButtonClick = () => {
    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "API Key de ImgBB requerida",
        description: "Por favor, configure la API Key de ImgBB en Ajustes > Personalización > Identidad y Diseño.",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate if it is actually an image
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Archivo no admitido",
        description: "Solo se permite subir archivos de tipo imagen.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen a ImgBB.');
      }

      const data = await response.json();
      if (data.success && data.data?.url) {
        onUploadSuccess(data.data.url);
        toast({
          title: "Imagen subida con éxito",
          description: "La imagen ha sido cargada y la URL se autocompletó.",
        });
      } else {
        throw new Error(data.error?.message || 'Error en la respuesta de ImgBB.');
      }
    } catch (error: any) {
      console.error("Error uploading to ImgBB:", error);
      toast({
        variant: "destructive",
        title: "Error de carga",
        description: error.message || "Ocurrió un error al subir la imagen a ImgBB.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading || disabled}
        onClick={handleButtonClick}
        className="h-9 gap-1.5 text-xs font-bold shrink-0 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Subiendo...</span>
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5 text-primary/80" />
            <span>Subir imagen</span>
          </>
        )}
      </Button>
    </>
  );
}
