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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusCircle, Loader2, Users, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { AppUser } from '@/lib/types';
import { deleteUserAction, saveUserAction } from '@/app/dashboard/settings/actions';

const permissionsSchema = z.object({
  dashboard: z.boolean().default(false),
  clients: z.boolean().default(false),
  loans: z.boolean().default(false),
  wallet: z.boolean().default(false),
  plans: z.boolean().default(false),
  settings: z.boolean().default(false),
});

const formSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  role: z.enum(['admin', 'supervisor'], { required_error: 'Debes seleccionar un rol.' }),
  permissions: permissionsSchema,
});

type UserFormValues = z.infer<typeof formSchema>;

const DUMMY_DOMAIN = 'credicontrol.app';

const permissionLabels: { id: keyof AppUser['permissions']; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'clients', label: 'Clientes' },
    { id: 'loans', label: 'Préstamos' },
    { id: 'wallet', label: 'Cartera' },
    { id: 'plans', label: 'Planes' },
    { id: 'settings', label: 'Ajustes' },
];

interface UserManagementProps {
    users: AppUser[];
}

export function UserManagement({ users }: UserManagementProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { signUp } = useAuth();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'supervisor',
      permissions: {
        dashboard: true,
        clients: false,
        loans: false,
        wallet: false,
        plans: false,
        settings: false,
      },
    },
  });

  const onSubmit = async (values: UserFormValues) => {
    setIsSaving(true);
    const email = `${values.username.toLowerCase()}@${DUMMY_DOMAIN}`;
    try {
        const userCredential = await signUp(email, values.password, values.role, values.username, values.permissions);
        
        toast({
            title: 'Usuario Creado',
            description: `El usuario "${values.username}" ha sido registrado.`,
        });
        
        form.reset();
        router.refresh(); 
    } catch (error: any) {
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
             try {
                const tempUid = `sync-needed-${values.username}`;
                await saveUserAction(tempUid, { username: values.username, role: values.role, permissions: values.permissions });
                
                toast({
                    title: 'Usuario Sincronizado',
                    description: `El usuario "${values.username}" ya existía y ha sido añadido a la lista.`,
                });

                form.reset();
                router.refresh();

            } catch (syncError: any) {
                 toast({
                    variant: 'destructive',
                    title: 'Error de Sincronización',
                    description: `El usuario ya existe, pero ocurrió un error al intentar sincronizarlo en la base de datos: ${syncError.message}`,
                });
            }
        } else {
             toast({
                variant: 'destructive',
                title: 'Error al Crear Usuario',
                description: errorMessage,
            });
        }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
     try {
        const result = await deleteUserAction(userId);
        if (result.success) {
            toast({ title: 'Éxito', description: 'Usuario eliminado de la lista.' });
            router.refresh();
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const translateRole = (role: 'admin' | 'supervisor') => {
    return role === 'admin' ? 'Administrador' : 'Supervisor';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users />
          Gestión de Usuarios
        </CardTitle>
        <CardDescription>
          Añade nuevos usuarios, asígnales roles y permisos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: supervisor1" {...field} />
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
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Permisos de Navegación</FormLabel>
                    <FormDescription>
                      Selecciona las secciones a las que el usuario tendrá acceso.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                    {permissionLabels.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name={`permissions.${item.id}`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>{item.label}</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {isSaving ? 'Guardando...' : 'Añadir Usuario'}
                </Button>
            </div>
          </form>
        </Form>
        
        <div className="mt-6 border-t pt-4">
             <h4 className="text-sm font-medium mb-2">Usuarios Existentes</h4>
              <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre de Usuario</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Permisos</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{translateRole(user.role)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                   {user.permissions ? Object.entries(user.permissions)
                                        .filter(([, value]) => value)
                                        .map(([key]) => permissionLabels.find(p => p.id === key)?.label || key)
                                        .join(', ') : 'Ninguno'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                                        <Trash className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                         {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center">No hay usuarios registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
        </div>
      </CardContent>
    </Card>
  );
}
