'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { LoanPlan } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  interestRate: z.coerce.number().min(0, 'La tasa de interés no puede ser negativa.'),
  termInWeeks: z.coerce.number().int().min(1, 'El plazo debe ser de al menos 1 semana.'),
});

type PlanFormValues = z.infer<typeof formSchema>;

interface PlanFormProps {
  plan?: LoanPlan;
}

export function PlanForm({ plan }: PlanFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          description: plan.description,
          interestRate: plan.interestRate * 100, // Display as percentage
          termInWeeks: plan.termInWeeks,
        }
      : {
          name: '',
          description: '',
          interestRate: 0,
          termInWeeks: 1,
        },
  });

  function onSubmit(values: PlanFormValues) {
    // Here you would typically handle the form submission,
    // e.g., by calling an API to save the plan.
    console.log({
      ...values,
      interestRate: values.interestRate / 100, // Store as decimal
    });
    
    toast({
      title: plan ? 'Plan actualizado' : 'Plan creado',
      description: `El plan "${values.name}" ha sido ${plan ? 'actualizado' : 'creado'} correctamente.`,
    });
    
    // In a real app, you would wait for the API response before navigating.
    router.push('/dashboard/plans');
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Plan</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Plan Semanal Básico" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: 110 semanales por cada 1000 prestados por 12 semanas"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tasa de Interés (%)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="10" {...field} />
                    </FormControl>
                    <FormDescription>
                        Ingresa el porcentaje sin el símbolo %.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="termInWeeks"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Plazo (en semanas)</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="12" {...field} />
                    </FormControl>
                     <FormDescription>
                        El número total de semanas para el plan.
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit">{plan ? 'Guardar Cambios' : 'Crear Plan'}</Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
