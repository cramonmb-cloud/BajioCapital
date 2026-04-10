'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Users, Trash, Edit, ShieldCheck, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { AppUser, UserPermissions } from '@/lib/types';
import { deleteUserAction, saveUserAction } from '@/app/dashboard/settings/actions';
import { Badge } from './ui/badge';

const permissionsSchema = z.object({
  dashboard: z.boolean().default(false),
  clients: z.boolean().default(false),
  consultarCliente: z.boolean().default(false),
  loans: z.boolean().default(false),
  overduePortfolio: z.boolean().default(false),
  carteraVencida: z.boolean().default(false),
  wallet: z.boolean().default(false),
  plans: z.boolean().default(false),
  settings: z.boolean().default(false),
  editClients: z.boolean().default(false),
  control: z.boolean().default(false),
});

const addUserFormSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  role: z.enum(['admin', 'supervisor'], { required_error: 'Debes seleccionar un rol.' }),
  permissions: permissionsSchema,
});

const editUserFormSchema = z.object({
  role: z.enum(['admin', 'supervisor'], { required_error: 'Debes seleccionar un rol.' }),
  permissions: permissionsSchema,
});

type AddUserFormValues = z.infer<typeof addUserFormSchema>;
type EditUserFormValues = z.infer<typeof editUserFormSchema>;


const DUMMY_DOMAIN = 'credicontrol.app';

const permissionLabels: { id: keyof UserPermissions; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'clients', label: 'Clientes' },
    { id: 'consultarCliente', label: 'Consultar Cliente' },
    { id: 'loans', label: 'Préstamos' },
    { id: 'overduePortfolio', label: 'Pagos Pendientes'},
    { id: 'carteraVencida', label: 'Cartera Vencida'},
    { id: 'wallet', label: 'Cartera' },
    { id: 'control', label: 'Control' },
    { id: 'plans', label: 'Planes' },
    { id: 'settings', label: 'Ajustes' },
    { id: 'editClients', label: 'Editar Clientes' },
];

interface UserManagementProps {
    users: AppUser[];
}

export function UserManagement({ users }: UserManagementProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { signUp } = useAuth();

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'supervisor',
      permissions: {
        dashboard: true,
        clients: true,
        consultarCliente: true,
        loans: true,
        overduePortfolio: true,
        carteraVencida: true,
        wallet: true,
        plans: false,
        settings: false,
        editClients: false,
        control: true,
      },
    },
  });

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
  });

  useEffect(() => {
    if (selectedUser) {
      editUserForm.reset({
        role: selectedUser.role,
        permissions: { ...permissionsSchema.parse({}), ...selectedUser.permissions },
      });
    }
  }, [selectedUser, editUserForm]);


  const onAddUserSubmit = async (values: AddUserFormValues) => {
    setIsSaving(true);
    const email = `${values.username.toLowerCase()}@${DUMMY_DOMAIN}`;
    try {
        const userCredential = await signUp(email, values.password, values.role, values.username, values.permissions);
        
        toast({
            title: 'Usuario Creado',
            description: `El usuario "${values.username}" ha sido registrado.`,
        });
        
        addUserForm.reset();
        router.refresh(); 
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
             try {
                const tempUid = `sync-needed-${values.username}`;
                await saveUserAction(tempUid, { username: values.username, role: values.role, permissions: values.permissions });
                
                toast({
                    title: 'Usuario Sincronizado',
                    description: `El usuario "${values.username}" ya existía y ha sido añadido a la lista.`,
                });

                addUserForm.reset();
                router.refresh();

            } catch (syncError: any) {
                 toast({
                    variant: 'destructive',
                    title: 'Error de Sincronización',
                    description: `El usuario ya existe, pero ocurrió un error al intentar sincronizarlo: ${syncError.message}`,
                });
            }
        } else {
             toast({
                variant: 'destructive',
                title: 'Error al Crear Usuario',
                description: error.message,
            });
        }
    } finally {
      setIsSaving(false);
    }
  };

  const onEditUserSubmit = async (values: EditUserFormValues) => {
    if (!selectedUser) return;
    setIsEditing(true);

    try {
        const userDataToUpdate = {
            username: selectedUser.username,
            role: values.role,
            permissions: values.permissions,
        };
        const result = await saveUserAction(selectedUser.id, userDataToUpdate);
        if (result.success) {
            toast({ title: 'Usuario Actualizado', description: `Los datos de "${selectedUser.username}" han sido actualizados.`});
            setEditDialogOpen(false);
            router.refresh();
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error al Actualizar', description: error.message });
    } finally {
        setIsEditing(false);
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

  const openEditDialog = (user: AppUser) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const translateRole = (role: 'admin' | 'supervisor') => {
    return role === 'admin' ? 'Administrador' : 'Supervisor';
  };

  return (
    <div className="grid gap-6">
        <Card className="border-t-4 border-t-primary">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Registrar Nuevo Usuario
                </CardTitle>
                <CardDescription>
                    Crea cuentas para supervisores y asigna permisos específicos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...addUserForm}>
                    <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                            <FormField
                                control={addUserForm.control}
                                name="username"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Usuario</FormLabel>
                                    <FormControl>
                                    <Input placeholder="Ej: JUAN_P" {...field} className="uppercase" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={addUserForm.control}
                                name="password"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contraseña Inicial</FormLabel>
                                    <FormControl>
                                    <Input type="password" placeholder="Min. 6 caracteres" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={addUserForm.control}
                                name="role"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol de Sistema</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
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

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Lock className="h-4 w-4 text-muted-foreground" />
                                <h4 className="text-sm font-bold uppercase tracking-tight">Permisos de Acceso</h4>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {permissionLabels.map((item) => (
                                <FormField
                                    key={item.id}
                                    control={addUserForm.control}
                                    name={`permissions.${item.id}`}
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal cursor-pointer">{item.label}</FormLabel>
                                    </FormItem>
                                    )}
                                />
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Registrar Usuario
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg">Personal Activo</CardTitle>
                <CardDescription>Listado de usuarios registrados y sus niveles de acceso.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="pl-6">Usuario</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead className="hidden md:table-cell">Permisos</TableHead>
                            <TableHead className="text-right pr-6">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell className="font-medium pl-6 uppercase">{user.username}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                        {translateRole(user.role)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate hidden md:table-cell">
                                   {user.role === 'admin' ? 'ACCESO TOTAL' : user.permissions ? Object.entries(user.permissions)
                                        .filter(([, value]) => value)
                                        .map(([key]) => permissionLabels.find(p => p.id === key)?.label || key)
                                        .join(', ') : 'SIN PERMISOS'}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                                            <Edit className="h-4 w-4 text-blue-600"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)}>
                                            <Trash className="h-4 w-4 text-destructive"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                         {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">No hay usuarios registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-2xl">
                <Form {...editUserForm}>
                    <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-6">
                        <DialogHeader>
                            <DialogTitle className="uppercase">Editar Usuario: {selectedUser?.username}</DialogTitle>
                            <DialogDescription>
                                Modifica el rol y las áreas permitidas de navegación.
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6 py-2">
                            <FormField
                                control={editUserForm.control}
                                name="role"
                                render={({ field }) => (
                                <FormItem className="max-w-[200px]">
                                    <FormLabel>Rol de Sistema</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar" />
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
                            
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold uppercase tracking-tight">Permisos de Acceso</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {permissionLabels.map((item) => (
                                    <FormField
                                        key={item.id}
                                        control={editUserForm.control}
                                        name={`permissions.${item.id}`}
                                        render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50">
                                            <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                            </FormControl>
                                            <FormLabel className="font-normal cursor-pointer">{item.label}</FormLabel>
                                        </FormItem>
                                        )}
                                    />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isEditing}>
                                {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </div>
  );
}
