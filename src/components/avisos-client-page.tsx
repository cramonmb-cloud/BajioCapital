'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Aviso } from '@/lib/types';
import { Megaphone, Trash, Plus, CheckCircle2, Eye, EyeOff, Calendar, User, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function AvisosClientPage() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync announcements
  useEffect(() => {
    const q = collection(db, 'avisos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as Aviso);
      
      // Sort by creation date desc
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setAvisos(list);
      setLoading(false);
    }, (error) => {
      console.error("Error syncing avisos:", error);
      toast({
        variant: "destructive",
        title: "Error de sincronización",
        description: "No se pudieron cargar los avisos en tiempo real.",
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Handle form submission
  const handleCreateAviso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "El título y la descripción son obligatorios.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'avisos'), {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || '',
        createdAt: new Date().toISOString(),
        createdBy: appUser?.username || 'Admin',
        readBy: [],
        active: true
      });

      toast({
        title: "Aviso publicado",
        description: "El comunicado se encuentra activo y visible para los usuarios.",
      });

      // Reset form
      setTitle('');
      setDescription('');
      setImageUrl('');
    } catch (error: any) {
      console.error("Error creating aviso:", error);
      toast({
        variant: "destructive",
        title: "Error al publicar",
        description: error.message || "Ocurrió un error al guardar en la base de datos.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (avisoId: string, currentStatus: boolean) => {
    try {
      const docRef = doc(db, 'avisos', avisoId);
      await updateDoc(docRef, { active: !currentStatus });
      toast({
        title: !currentStatus ? "Aviso activado" : "Aviso archivado",
        description: !currentStatus ? "El comunicado ahora es visible." : "El comunicado ya no se mostrará.",
      });
    } catch (error: any) {
      console.error("Error toggling active status:", error);
      toast({
        variant: "destructive",
        title: "Error al cambiar estado",
        description: error.message || "No se pudo actualizar el aviso.",
      });
    }
  };

  // Delete notice
  const handleDeleteAviso = async (avisoId: string) => {
    try {
      const docRef = doc(db, 'avisos', avisoId);
      await deleteDoc(docRef);
      toast({
        title: "Aviso eliminado",
        description: "El comunicado ha sido borrado de forma permanente.",
      });
    } catch (error: any) {
      console.error("Error deleting aviso:", error);
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: error.message || "No se pudo borrar el aviso.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-2">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent inline-block" />
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Cargando módulo de avisos...</p>
        </div>
      </div>
    );
  }

  // Access check
  const hasAccess = appUser?.role === 'admin' || appUser?.permissions?.manageAvisos;
  if (!hasAccess) {
    return (
      <div className="flex h-[60vh] items-center justify-center p-4">
        <Card className="max-w-[420px] w-full text-center border-red-200 shadow-lg shadow-red-500/5">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2 animate-bounce">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-black uppercase text-red-600">Acceso Restringido</CardTitle>
            <CardDescription className="text-xs text-red-700/80">
              No tienes los permisos necesarios para gestionar los avisos del sistema. Contacta al administrador principal.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
            Gestión de Avisos
          </h1>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Publica y administra los comunicados y alertas globales en tiempo real.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-md border-border/40 rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/10 border-b border-border/10">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Plus className="h-4.5 w-4.5 stroke-[3]" />
                Publicar Comunicado
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                Rellena los campos para notificar al personal
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateAviso} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Título del Aviso
                  </label>
                  <Input
                    id="title"
                    placeholder="Ej: Mantenimiento del Sistema"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={60}
                    className="h-11 border-2 focus:ring-primary rounded-xl font-semibold uppercase text-xs"
                    required
                  />
                  <div className="flex justify-end">
                    <span className="text-[9px] text-muted-foreground font-bold">{title.length}/60 caracteres</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Descripción del Comunicado
                  </label>
                  <Textarea
                    id="description"
                    placeholder="Escribe el cuerpo del mensaje detalladamente..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[120px] border-2 focus:ring-primary rounded-xl text-xs font-semibold"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="imageUrl" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    URL de la Imagen (Opcional)
                  </label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://ejemplo.com/imagen.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-11 border-2 focus:ring-primary rounded-xl text-xs font-semibold"
                  />
                </div>

                {imageUrl.trim() && (
                  <div className="space-y-1 bg-muted/30 p-3 rounded-2xl border border-border/10">
                    <span className="text-[9px] font-black uppercase text-muted-foreground">Vista Previa de Imagen</span>
                    <div className="relative rounded-xl overflow-hidden border border-border/20 shadow-sm max-h-[140px] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={imageUrl.trim()} 
                        alt="Preview"
                        className="w-full h-auto object-cover max-h-[140px]"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-xl font-black text-xs uppercase tracking-widest gap-2"
                >
                  {isSubmitting ? "Publicando..." : (
                    <>
                      <Megaphone className="h-4 w-4" />
                      Publicar Aviso
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* List Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-md border-border/40 rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-muted/10 border-b border-border/10">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Calendar className="h-4.5 w-4.5" />
                Historial de Avisos
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                Total publicados: {avisos.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 px-4">
              <ScrollArea className="h-[650px] pr-2">
                {avisos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-2xl border-border/60 bg-muted/10">
                    <Megaphone className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-xs font-black uppercase text-muted-foreground">Sin Avisos Publicados</p>
                    <p className="text-[10px] text-muted-foreground/70 font-semibold max-w-[240px]">
                      Usa el panel de la izquierda para registrar el primer comunicado del sistema.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {avisos.map((aviso) => (
                      <Card 
                        key={aviso.id} 
                        className={cn(
                          "border rounded-2xl shadow-sm transition-all overflow-hidden bg-white",
                          aviso.active ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-muted-foreground/30 opacity-75"
                        )}
                      >
                        <div className="p-4 space-y-3">
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-bold text-sm text-foreground uppercase leading-tight">
                                {aviso.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground font-semibold">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {aviso.createdBy}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(aviso.createdAt).toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            
                            {/* Switch & Action */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1.5">
                                {aviso.active ? (
                                  <Eye className="h-3.5 w-3.5 text-blue-500" />
                                ) : (
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                                )}
                                <Switch
                                  checked={aviso.active}
                                  onCheckedChange={() => handleToggleActive(aviso.id, aviso.active)}
                                />
                              </div>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl">
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black uppercase text-base">¿Eliminar Comunicado?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs">
                                      Esta acción borrará el aviso <strong>"{aviso.title}"</strong> y todo su historial de confirmaciones de lectura permanentemente. No se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl text-xs font-bold">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteAviso(aviso.id)}
                                      className="rounded-xl text-xs font-black bg-destructive hover:bg-destructive/90 text-white"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {/* Body / Description */}
                          <div className="flex gap-4 items-start">
                            {aviso.imageUrl && (
                              <div className="relative rounded-xl overflow-hidden border border-border/10 shrink-0 h-16 w-16 bg-muted/20">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={aviso.imageUrl} 
                                  alt="Preview"
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground font-medium leading-normal whitespace-pre-line flex-1">
                              {aviso.description}
                            </p>
                          </div>

                          {/* Confirmations section */}
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                Confirmados ({aviso.readBy?.length || 0})
                              </span>
                            </div>
                            
                            {aviso.readBy && aviso.readBy.length > 0 ? (
                              <div className="flex flex-wrap gap-1 bg-muted/20 p-2.5 rounded-xl border border-border/5">
                                {aviso.readBy.map((username) => (
                                  <Badge 
                                    key={username} 
                                    variant="secondary"
                                    className="text-[9px] font-black uppercase tracking-tight bg-white shadow-sm ring-1 ring-border/20 text-foreground/80 px-2 py-0.5"
                                  >
                                    {username}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] italic text-muted-foreground/75 font-medium pl-6">
                                Nadie ha visto este aviso aún.
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
