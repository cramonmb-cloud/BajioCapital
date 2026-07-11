'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

const DUMMY_DOMAIN = 'credicontrol.app';

interface LoginFormProps {
  hasNoUsers: boolean;
}

export function LoginForm({ hasNoUsers }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(hasNoUsers);
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();
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
      if (isRegistering) {
        const defaultAdminPermissions = {
          dashboard: true,
          clients: true,
          consultarCliente: true,
          loans: true,
          overduePortfolio: true,
          carteraVencida: true,
          wallet: true,
          plans: true,
          settings: true,
          editClients: true,
          control: true,
          debes: true,
          imprenta: true,
          avales: true,
          manageUsers: true,
          manageZones: true,
          manageMigration: true,
          managePlans: true,
          manageSystem: true,
          manageMaintenance: true,
          manageAvisos: true,
          managePersonal: true,
          showMobileNavBar: true,
          mobileSections: ['dashboard', 'loans', 'overduePortfolio', 'wallet', 'consultarCliente']
        };
        await signUp(email, values.password, 'admin', values.username, defaultAdminPermissions);
        toast({
          title: 'Administrador Registrado',
          description: 'El administrador principal ha sido creado exitosamente.',
        });
      } else {
        await signIn(email, values.password);
      }
      router.push('/dashboard');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Usuario o contraseña incorrectos.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Inténtalo de nuevo más tarde.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'El usuario ya está registrado.';
      }
      toast({
        variant: 'destructive',
        title: isRegistering ? 'Error al Registrar' : 'Error de Inicio de Sesión',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {hasNoUsers && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl text-center">
            <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 leading-normal">
              No hay usuarios en el sistema. Registra el Administrador principal para comenzar.
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                Usuario
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Ej: CRISTOBAL"
                  {...field}
                  className="uppercase h-11 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/10 focus-visible:ring-blue-500/10 focus-visible:ring-offset-0 focus:bg-white transition-all shadow-sm font-medium text-sm border-[1px]"
                />
              </FormControl>
              <FormMessage className="text-[11px] font-semibold text-red-500/90" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">
                Contraseña
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...field}
                  className="h-11 bg-white/80 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/10 focus-visible:ring-blue-500/10 focus-visible:ring-offset-0 focus:bg-white transition-all shadow-sm text-sm border-[1px]"
                />
              </FormControl>
              <FormMessage className="text-[11px] font-semibold text-red-500/90" />
            </FormItem>
          )}
        />

        <div className="space-y-2.5 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold tracking-wide shadow-[0_6px_20px_rgba(37,99,235,0.18)] hover:shadow-[0_10px_25px_rgba(37,99,235,0.35)] rounded-xl transition-all duration-300 h-11 active:scale-[0.97] border-0"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
            ) : isRegistering ? (
              <UserPlus className="mr-2 h-4 w-4" />
            ) : (
              <LogIn className="mr-2 h-4 w-4" />
            )}
            {isSubmitting
              ? 'Procesando...'
              : isRegistering
              ? 'Registrar Administrador'
              : 'Acceder'}
          </Button>

          {hasNoUsers && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold"
            >
              {isRegistering ? 'Volver al Login' : 'Modo Registro Administrador'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
