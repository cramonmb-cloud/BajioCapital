
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
import { PlusCircle, Trash, Loader2, Building, MapPin, User, Pencil, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Plaza, Localidad, Promotora } from '@/lib/types';
import { savePlazaAction, deletePlazaAction, saveLocalidadAction, deleteLocalidadAction, savePromotoraAction, deletePromotoraAction } from '@/app/dashboard/settings/actions';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { Skeleton } from './ui/skeleton';

const plazaSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres.'),
});
const localidadSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres.'),
  plazaId: z.string().min(1, 'Selecciona una plaza.'),
});
const promotoraSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres.'),
  localidadId: z.string().min(1, 'Selecciona una localidad.'),
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
  const [editingPlazaId, setEditingPlazaId] = useState<string | null>(null);
  const [editingLocalidadId, setEditingLocalidadId] = useState<string | null>(null);
  const [editingPromotoraId, setEditingPromotoraId] = useState<string | null>(null);

  const { data, loading } = useRealtimeData();
  const { toast } = useToast();

  const plazas = data?.plazas ?? initialPlazas;
  const localidades = data?.localidades ?? initialLocalidades;
  const promotoras = data?.promotoras ?? initialPromotoras;

  const plazaForm = useForm<PlazaFormValues>({ resolver: zodResolver(plazaSchema), defaultValues: { name: '' } });
  const localidadForm = useForm<LocalidadFormValues>({ resolver: zodResolver(localidadSchema), defaultValues: { name: '', plazaId: '' } });
  const promotoraForm = useForm<PromotoraFormValues>({ resolver: zodResolver(promotoraSchema), defaultValues: { name: '', localidadId: '' } });

  const handleAction = async (action: Promise<{success: boolean, message: string}>, formToReset?: any, entity?: 'plaza' | 'localidad' | 'promotora') => {
    setIsSaving(true);
    try {
      const result = await action;
      if (result.success) {
        toast({ title: 'Completado', description: result.message });
        formToReset?.reset();
        if (entity === 'plaza') setEditingPlazaId(null);
        if (entity === 'localidad') setEditingLocalidadId(null);
        if (entity === 'promotora') setEditingPromotoraId(null);
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
            {[1, 2, 3].map(i => (
                <Card key={i}><CardHeader><Skeleton className="h-6 w-24 mb-2" /><Skeleton className="h-4 w-48" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
            ))}
        </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      {/* Plazas */}
      <Card className="shadow-md border-primary/10">
        <CardHeader className="bg-primary/5 border-b mb-6">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building className="h-5 w-5 text-primary" /> Plazas
          </CardTitle>
          <CardDescription>Sedes regionales de operación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...plazaForm}>
            <form onSubmit={plazaForm.handleSubmit((v) => handleAction(savePlazaAction(v.name, editingPlazaId || undefined), plazaForm, 'plaza'))} className="space-y-3">
              <FormField control={plazaForm.control} name="name" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">{editingPlazaId ? 'Editando Plaza' : 'Nombre de Plaza'}</FormLabel>
                    <div className="flex gap-2">
                        <FormControl><Input placeholder="EJ: MATRIZ" {...field} className="uppercase h-9" /></FormControl>
                        <Button type="submit" size="sm" disabled={isSaving} className="h-9 px-3">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPlazaId ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                        </Button>
                        {editingPlazaId && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingPlazaId(null); plazaForm.reset(); }} className="h-9 px-2">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
          <div className="rounded-md border">
            <Table>
                <TableBody>
                {plazas.map(p => (
                    <TableRow key={p.id} className="h-10">
                        <TableCell className="font-medium uppercase py-2">{p.name}</TableCell>
                        <TableCell className="text-right py-2 flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                                setEditingPlazaId(p.id);
                                plazaForm.reset({ name: p.name });
                            }}>
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAction(deletePlazaAction(p.id))}>
                                <Trash className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Localidades */}
      <Card className="shadow-md border-primary/10">
        <CardHeader className="bg-primary/5 border-b mb-6">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" /> Localidades
          </CardTitle>
          <CardDescription>Zonas específicas dentro de cada plaza.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...localidadForm}>
            <form onSubmit={localidadForm.handleSubmit((v) => handleAction(saveLocalidadAction(v, editingLocalidadId || undefined), localidadForm, 'localidad'))} className="space-y-4">
               <FormField control={localidadForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">{editingLocalidadId ? 'Editando Localidad' : 'Nombre Localidad'}</FormLabel><FormControl><Input placeholder="ZONA CENTRO" {...field} className="uppercase h-9" /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField control={localidadForm.control} name="plazaId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Asignar a Plaza</FormLabel>
                    <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Plaza..." /></SelectTrigger></FormControl>
                            <SelectContent>{plazas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="submit" size="sm" disabled={isSaving} className="h-9 px-3">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLocalidadId ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                        </Button>
                        {editingLocalidadId && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingLocalidadId(null); localidadForm.reset(); }} className="h-9 px-2">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
          <div className="rounded-md border">
            <Table>
                <TableBody>
                    {localidades.map(l => (
                        <TableRow key={l.id} className="h-10">
                            <TableCell className="py-2">
                                <div className="flex flex-col">
                                    <span className="font-medium uppercase">{l.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{plazas.find(p => p.id === l.plazaId)?.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right py-2 flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                                    setEditingLocalidadId(l.id);
                                    localidadForm.reset({ name: l.name, plazaId: l.plazaId });
                                }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAction(deleteLocalidadAction(l.id))}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Promotoras */}
      <Card className="shadow-md border-primary/10">
        <CardHeader className="bg-primary/5 border-b mb-6">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" /> Promotoras
          </CardTitle>
          <CardDescription>Personal encargado de las rutas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...promotoraForm}>
            <form onSubmit={promotoraForm.handleSubmit((v) => handleAction(savePromotoraAction(v, editingPromotoraId || undefined), promotoraForm, 'promotora'))} className="space-y-4">
               <FormField control={promotoraForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel className="text-xs font-bold uppercase">{editingPromotoraId ? 'Editando Promotora' : 'Nombre Promotora'}</FormLabel><FormControl><Input placeholder="EJ: MARIA G." {...field} className="uppercase h-9" /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField control={promotoraForm.control} name="localidadId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="text-xs font-bold uppercase">Asignar a Localidad</FormLabel>
                    <div className="flex gap-2">
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Localidad..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                {localidades.map(l => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name} ({plazas.find(p => p.id === l.plazaId)?.name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="submit" size="sm" disabled={isSaving} className="h-9 px-3">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPromotoraId ? <Check className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                        </Button>
                        {editingPromotoraId && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingPromotoraId(null); promotoraForm.reset(); }} className="h-9 px-2">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <FormMessage />
                </FormItem>
              )} />
            </form>
          </Form>
          <div className="rounded-md border">
            <Table>
                <TableBody>
                    {promotoras.map(p => (
                        <TableRow key={p.id} className="h-10">
                            <TableCell className="py-2">
                                <div className="flex flex-col">
                                    <span className="font-medium uppercase">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase">{localidades.find(l => l.id === p.localidadId)?.name}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right py-2 flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => {
                                    setEditingPromotoraId(p.id);
                                    promotoraForm.reset({ name: p.name, localidadId: p.localidadId });
                                }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleAction(deletePromotoraAction(p.id))}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
