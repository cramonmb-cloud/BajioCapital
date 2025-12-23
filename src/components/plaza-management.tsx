'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Trash, Loader2, Building, MapPin, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Plaza, Localidad, Promotora } from '@/lib/types';
import { savePlazaAction, deletePlazaAction, saveLocalidadAction, deleteLocalidadAction, savePromotoraAction, deletePromotoraAction } from '@/app/dashboard/settings/actions';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { Skeleton } from './ui/skeleton';

const plazaSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
const localidadSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  plazaId: z.string().min(1, 'Debes seleccionar una plaza.'),
});
const promotoraSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  localidadId: z.string().min(1, 'Debes seleccionar una localidad.'),
});

type PlazaFormValues = z.infer<typeof plazaSchema>;
type LocalidadFormValues = z.infer<typeof localidadSchema>;
type PromotoraFormValues = z.infer<typeof promotoraSchema>;

interface PlazaManagementProps {
  initialPlazas: Plaza[];
  initialLocalidades: Localidad[];
  initialPromotoras: Promotora[];
}

export function PlazaManagement({ initialPlazas, initialLocalidades, initialPromotoras }: PlazaManagementProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { data, loading } = useRealtimeData();
  const { toast } = useToast();
  const router = useRouter();

  const plazas = data?.plazas ?? initialPlazas;
  const localidades = data?.localidades ?? initialLocalidades;
  const promotoras = data?.promotoras ?? initialPromotoras;

  const getPlazaName = (plazaId: string) => plazas.find(p => p.id === plazaId)?.name || 'N/A';
  const getLocalidadName = (localidadId: string) => localidades.find(l => l.id === localidadId)?.name || 'N/A';

  const plazaForm = useForm<PlazaFormValues>({ resolver: zodResolver(plazaSchema), defaultValues: { name: '' } });
  const localidadForm = useForm<LocalidadFormValues>({ resolver: zodResolver(localidadSchema), defaultValues: { name: '', plazaId: '' } });
  const promotoraForm = useForm<PromotoraFormValues>({ resolver: zodResolver(promotoraSchema), defaultValues: { name: '', localidadId: '' } });

  const handleAction = async (action: Promise<{success: boolean, message: string}>, formToReset?: any) => {
    setIsSaving(true);
    try {
      const result = await action;
      if (result.success) {
        toast({ title: 'Éxito', description: result.message });
        formToReset?.reset();
        // No need for router.refresh() as real-time updates will handle it
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card><CardHeader><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-6 w-24" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Plazas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building /> Plazas</CardTitle>
          <CardDescription>Gestiona las plazas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...plazaForm}>
            <form onSubmit={plazaForm.handleSubmit((v) => handleAction(savePlazaAction(v.name), plazaForm))} className="flex items-end gap-2 mb-4">
              <FormField control={plazaForm.control} name="name" render={({ field }) => (
                <FormItem className="flex-grow"><FormLabel>Nueva Plaza</FormLabel><FormControl><Input placeholder="Nombre de la plaza" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}</Button>
            </form>
          </Form>
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
            <TableBody>
              {plazas.map(p => (<TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleAction(deletePlazaAction(p.id))}><Trash className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Localidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin /> Localidades</CardTitle>
          <CardDescription>Gestiona las localidades por plaza.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...localidadForm}>
            <form onSubmit={localidadForm.handleSubmit((v) => handleAction(saveLocalidadAction(v), localidadForm))} className="space-y-4 mb-4">
               <FormField control={localidadForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nueva Localidad</FormLabel><FormControl><Input placeholder="Nombre de la localidad" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField control={localidadForm.control} name="plazaId" render={({ field }) => (
                <FormItem><FormLabel>Plaza</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Asignar a plaza" /></SelectTrigger></FormControl><SelectContent>{plazas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}Añadir Localidad</Button>
            </form>
          </Form>
          <Table>
             <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Plaza</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
            <TableBody>
                {localidades.map(l => (<TableRow key={l.id}><TableCell>{l.name}</TableCell><TableCell>{getPlazaName(l.plazaId)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleAction(deleteLocalidadAction(l.id))}><Trash className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Promotoras */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User /> Promotoras</CardTitle>
          <CardDescription>Gestiona las promotoras por localidad.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...promotoraForm}>
            <form onSubmit={promotoraForm.handleSubmit((v) => handleAction(savePromotoraAction(v), promotoraForm))} className="space-y-4 mb-4">
               <FormField control={promotoraForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nueva Promotora</FormLabel><FormControl><Input placeholder="Nombre de la promotora" {...field} className="uppercase" /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField control={promotoraForm.control} name="localidadId" render={({ field }) => (
                <FormItem><FormLabel>Localidad</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Asignar a localidad" /></SelectTrigger></FormControl><SelectContent>{localidades.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({getPlazaName(l.plazaId)})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}Añadir Promotora</Button>
            </form>
          </Form>
          <Table>
             <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Localidad</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
            <TableBody>
                {promotoras.map(p => (<TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{getLocalidadName(p.localidadId)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleAction(deletePromotoraAction(p.id))}><Trash className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
