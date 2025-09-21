'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';

const formSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

const DUMMY_DOMAIN = 'credicontrol.app';

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { signIn } = useAuth();
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    const email = `${values.username.toLowerCase()}@${DUMMY_DOMAIN}`;

    try {
      await signIn(email, values.password);
      router.push('/dashboard');
    } catch (error: any) {
        let errorMessage = error.message;
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            errorMessage = 'Usuario o contraseña incorrectos. El registro de nuevos usuarios solo puede ser realizado por un administrador.';
        }
       toast({
          variant: 'destructive',
          title: 'Error de Inicio de Sesión',
          description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className='flex justify-center mb-4'>
                <Logo />
            </div>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>
            Introduce tus credenciales para acceder al sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Cristobal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Verificando...' : 'Acceder'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
