'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Aviso } from '@/lib/types';
import { Megaphone, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function FloatingAviso() {
  const { appUser } = useAuth();
  const { toast } = useToast();
  const [pendingAvisos, setPendingAvisos] = useState<Aviso[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync active notices in real time
  useEffect(() => {
    if (!appUser?.username) return;

    const q = query(
      collection(db, 'avisos'),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }) as Aviso);
      
      // Filter out those notices that the current user has already marked as read
      const filtered = activeList.filter(
        (aviso) => !aviso.readBy?.includes(appUser.username)
      );

      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setPendingAvisos(filtered);
    }, (error) => {
      console.error('Error fetching realtime avisos:', error);
    });

    return () => unsubscribe();
  }, [appUser]);

  if (pendingAvisos.length === 0 || !appUser) return null;

  const currentAviso = pendingAvisos[0];

  const handleMarkAsRead = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const docRef = doc(db, 'avisos', currentAviso.id);
      await updateDoc(docRef, {
        readBy: arrayUnion(appUser.username)
      });
      
      toast({
        title: "Aviso marcado como leído",
        description: "Confirmación registrada correctamente.",
      });
      setIsOpen(false);
    } catch (error: any) {
      console.error('Error updating read status:', error);
      toast({
        variant: "destructive",
        title: "Error al registrar confirmación",
        description: error.message || "Por favor, intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating pulsing button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed z-[49] flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 active:scale-90 hover:scale-110",
          "bottom-28 right-6 md:bottom-8 md:right-8", // Prevent overlap with MobileNavBar
          "h-14 w-14 bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 text-white animate-bounce",
          "ring-4 ring-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.6)]"
        )}
      >
        <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white border-2 border-background animate-pulse shadow-md">
          {pendingAvisos.length}
        </span>
        <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-ping opacity-75 -z-10" />
        <Megaphone className="h-6 w-6 animate-wiggle" />
      </button>

      {/* Professional Announcement Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl overflow-hidden border-border/40 p-6 bg-background/95 backdrop-blur-md shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full w-fit">
              <AlertCircle className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Aviso Importante</span>
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground leading-tight">
              {currentAviso.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Publicado el {new Date(currentAviso.createdAt).toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })} por <span className="font-bold text-foreground/80">{currentAviso.createdBy}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Announcement content */}
          <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-1">
            {currentAviso.imageUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-border/20 shadow-md bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={currentAviso.imageUrl} 
                  alt={currentAviso.title}
                  className="w-full h-auto object-cover max-h-[220px]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line bg-muted/20 p-4 rounded-2xl border border-border/10 font-medium">
              {currentAviso.description}
            </p>
          </div>

          <DialogFooter className="pt-2 sm:justify-center">
            <Button
              onClick={handleMarkAsRead}
              disabled={isSubmitting}
              className="w-full h-12 rounded-2xl font-black text-sm tracking-wide gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg active:scale-98 transition-all"
            >
              {isSubmitting ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <Check className="h-5 w-5 stroke-[3]" />
                  Enterado/a
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
