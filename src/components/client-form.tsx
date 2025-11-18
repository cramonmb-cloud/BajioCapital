'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { saveClientAction } from '@/app/dashboard/clients/actions';

const formSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  phone: z.string().min(7, 'El teléfono es requerido.'),
  street: z.string().min(5, 'La calle y número son requeridos.'),
  neighborhood: z.string().min(3, 'La colonia es requerida.'),
  postalCode: z.string().min(5, 'El código postal es requerido.'),
  city: z.string().min(3, 'La ciudad es requerida.'),
  guarantee: z.string().min(3, 'La garantía es requerida.'),
  endorsement: z.string().min(3, 'El nombre del aval es requerido.'),
});

type ClientFormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  client: Client;
}

export function ClientForm({ client }: ClientFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client.name || '',
      phone: client.phone || '',
      street: client.street || '',
      neighborhood: client.neighborhood || '',
      postalCode: client.postalCode || '',
      city: client.city || '',
      guarantee: client.guarantee || '',
      endorsement: client.endorsement || '',
    },
  });

  const onSubmit = async (values: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const clientDataToSave = {
        ...values,
        // email and avatarUrl are not editable in this form
        email: client.email,
        avatarUrl: client.avatarUrl,
      };

      const result = await saveClientAction(client.id, clientDataToSave);

      if (result.success) {
        toast({
          title: 'Cliente Actualizado',
          description: `Los datos de ${values.name} han sido actualizados.`,
        });
        router.push(`/dashboard/clients/${client.id}`);
        router.refresh();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Hubo un error al guardar los datos del cliente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card>
            <CardContent className="space-y-4 pt-6">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                            <Input placeholder="Nombre del cliente" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: 555-0101" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Calle y Número</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: Av. Siempreviva 742" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="neighborhood"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Colonia</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Springfield" {...field} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>C.P.</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: 12345" {...field} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Ciudad</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Springfield" {...field} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                 <FormField
                    control={form.control}
                    name="guarantee"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Garantías</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe las garantías del cliente (nómina, propiedad, etc.)" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <FormField
                    control={form.control}
                    name="endorsement"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Aval</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Datos completos del aval" {...field} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Cambios
                </Button>
            </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
