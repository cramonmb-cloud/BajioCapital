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
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
} from '@/components/ui/dialog';
import { PlusCircle, Loader2, Trash, Edit, ShieldCheck, Lock, UserPlus, Users, LayoutDashboard, Landmark, FileWarning, Wallet, History, Activity, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { AppUser, UserPermissions } from '@/lib/types';
import { deleteUserAction, saveUserAction } from '@/app/dashboard/settings/actions';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

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

const permissionLabels: { id: keyof UserPermissions; label: string; description: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', description: 'Vista general de métricas', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', description: 'Listado y registro de clientes', icon: Users },
    { id: 'consultarCliente', label: 'Consultar Cliente', description: 'Búsqueda rápida de perfiles', icon: Search },
    { id: 'loans', label: 'Préstamos', description: 'Hojas de cobranza semanal', icon: Landmark },
    { id: 'overduePortfolio', label: 'Pagos Pendientes', description: 'Clientes con fallos vigentes', icon: FileWarning },
    { id: 'carteraVencida', label: 'Cartera Vencida', description: 'Cuentas incobrables post-vencimiento', icon: History },
    { id: 'wallet', label: 'Cartera', description: 'Flujo de caja y movimientos', icon: Wallet },
    { id: 'control', label: 'Control', description: 'Capital en calle y proyecciones', icon: Activity },
    { id: 'plans', label: 'Planes', description: 'Creación de tipos de préstamo', icon: Lock },
    { id: 'settings', label: 'Ajustes', description: 'Configuraciones críticas del sistema', icon: ShieldCheck },
    { id: 'editClients', label: 'Editar Clientes', description: 'Modificar datos de clientes existentes', icon: Edit },
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
  const { signUp, appUser } = useAuth();

  const isCristobal = appUser?.username.toUpperCase() === 'CRISTOBAL';

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
        permissions: { 
            dashboard: selectedUser.permissions?.dashboard ?? false,
            clients: selectedUser.permissions?.clients ?? false,
            consultarCliente: selectedUser.permissions?.consultarCliente ?? false,
            loans: selectedUser.permissions?.loans ?? false,
            overduePortfolio: selectedUser.permissions?.overduePortfolio ?? false,
            carteraVencida: selectedUser.permissions?.carteraVencida ?? false,
            wallet: selectedUser.permissions?.wallet ?? false,
            plans: selectedUser.permissions?.plans ?? false,
            settings: selectedUser.permissions?.settings ?? false,
            editClients: selectedUser.permissions?.editClients ?? false,
            control: selectedUser.permissions?.control ?? false,
        },
      });
    }
  }, [selectedUser, editUserForm]);

  const onAddUserSubmit = async (values: AddUserFormValues) => {
    setIsSaving(true);
    const email = `${values.username.toLowerCase()}@${DUMMY_DOMAIN}`;
    try {
        await signUp(email, values.password, values.role, values.username, values.permissions);
        toast({ title: 'Usuario Creado', description: `El usuario "${values.username}" ha sido registrado.` });
        addUserForm.reset();
        router.refresh(); 
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
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
            password: selectedUser.password || ''
        };
        const result = await saveUserAction(selectedUser.id, userDataToUpdate);
        if (result.success) {
            toast({ title: 'Éxito', description: 'Usuario actualizado correctamente.'});
            setEditDialogOpen(false);
            router.refresh();
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsEditing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
     try {
        const result = await deleteUserAction(userId);
        if (result.success) {
            toast({ title: 'Éxito', description: 'Usuario eliminado.' });
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

  return (
    <div className="grid gap-8">
        <Card className="shadow-lg border-primary/10 overflow-hidden">
            <CardHeader className="bg-primary/5 pb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-lg">
                        <UserPlus className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold">Registro de Personal</CardTitle>
                        <CardDescription>Crea cuentas para supervisores y define sus niveles de acceso.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8">
                <Form {...addUserForm}>
                    <form onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField
                                control={addUserForm.control}
                                name="username"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold">Nombre de Usuario</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: CRISTOBAL_M" {...field} className="uppercase bg-muted/30 focus:bg-background transition-all" />
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
                                    <FormLabel className="font-bold">Contraseña</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Mínimo 6 caracteres" {...field} className="bg-muted/30 focus:bg-background transition-all" />
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
                                    <FormLabel className="font-bold">Rol Operativo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-muted/30 focus:bg-background transition-all">
                                                <SelectValue placeholder="Seleccionar rol" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="admin">Administrador (Acceso Total)</SelectItem>
                                            <SelectItem value="supervisor">Supervisor (Accesos Limitados)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Lock className="h-4 w-4 text-primary" />
                                <h4 className="text-sm font-bold uppercase tracking-wider">Permisos de Acceso al Módulo</h4>
                            </div>
                            
                            {addUserForm.watch('role') === 'admin' && (
                                <Alert className="bg-primary/10 border-primary/20 text-primary-foreground mb-4">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className='font-bold'>Modo Administrador Activo</AlertTitle>
                                    <AlertDescription>
                                        Los administradores tienen acceso total por defecto. Los permisos individuales se ignorarán.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className={cn(
                                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity",
                                addUserForm.watch('role') === 'admin' && "opacity-50 pointer-events-none"
                            )}>
                                {permissionLabels.map((item) => (
                                <FormField
                                    key={item.id}
                                    control={addUserForm.control}
                                    name={`permissions.${item.id}`}
                                    render={({ field }) => (
                                    <FormItem className={cn(
                                        "flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 hover:border-primary/50 transition-all cursor-pointer",
                                        field.value ? "bg-primary/5 border-primary/20" : "bg-background"
                                    )}>
                                        <FormControl>
                                            <Checkbox
                                                checked={addUserForm.watch('role') === 'admin' ? true : field.value}
                                                onCheckedChange={field.onChange}
                                                className="mt-1"
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-sm font-bold cursor-pointer">{item.label}</FormLabel>
                                            <p className="text-xs text-muted-foreground">{item.description}</p>
                                        </div>
                                    </FormItem>
                                    )}
                                />
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" size="lg" disabled={isSaving} className="px-8 font-bold">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Registrar Personal
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
        
        <Card className="shadow-lg border-primary/10 overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Directorio de Personal Activo
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="pl-8 py-4 font-bold">Usuario</TableHead>
                            <TableHead className="font-bold">Rol de Acceso</TableHead>
                            {isCristobal && <TableHead className="font-bold">Contraseña</TableHead>}
                            <TableHead className="hidden md:table-cell font-bold">Privilegios</TableHead>
                            <TableHead className="text-right pr-8 font-bold">Gestión</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id} className="hover:bg-muted/20">
                                <TableCell className="pl-8 font-medium py-4 uppercase">{user.username}</TableCell>
                                <TableCell>
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="font-bold px-3">
                                        {user.role === 'admin' ? 'ADMINISTRADOR' : 'SUPERVISOR'}
                                    </Badge>
                                </TableCell>
                                {isCristobal && (
                                    <TableCell className="font-mono text-xs font-bold text-primary">
                                        {user.password || '---'}
                                    </TableCell>
                                )}
                                <TableCell className="text-xs text-muted-foreground max-w-[400px] hidden md:table-cell">
                                   <div className='flex flex-wrap gap-1'>
                                        {user.role === 'admin' ? 
                                            <span className="text-primary font-bold">ACCESO TOTAL (POR ROL)</span> : 
                                            permissionLabels
                                                .filter(p => user.permissions?.[p.id])
                                                .map(p => <Badge key={p.id} variant="outline" className='text-[9px] h-4'>{p.label}</Badge>)
                                        }
                                   </div>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="icon" onClick={() => openEditDialog(user)} className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                            <Edit className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => handleDeleteUser(user.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors">
                                            <Trash className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
                <Form {...editUserForm}>
                    <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-8">
                        <DialogHeader className="border-b pb-4">
                            <DialogTitle className="text-2xl font-bold uppercase flex items-center gap-2">
                                <ShieldCheck className="h-6 w-6 text-primary" />
                                Gestionar: {selectedUser?.username}
                            </DialogTitle>
                            <DialogDescription>Ajusta el rol y los privilegios de navegación para este usuario.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-8 py-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <FormField
                                    control={editUserForm.control}
                                    name="role"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Rol de Sistema</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12 border-2">
                                                    <SelectValue placeholder="Seleccionar rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="admin">Administrador (Acceso Total)</SelectItem>
                                                <SelectItem value="supervisor">Supervisor (Accesos Limitados)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            El rol de Administrador anula cualquier restricción de permisos.
                                        </FormDescription>
                                    </FormItem>
                                    )}
                                />
                                
                                {editUserForm.watch('role') === 'admin' && (
                                    <div className="animate-in fade-in zoom-in-95 duration-300">
                                        <Alert variant="destructive" className="bg-blue-50 border-blue-200 text-blue-800">
                                            <AlertCircle className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="font-bold">Privilegios de Administrador</AlertTitle>
                                            <AlertDescription className="text-xs">
                                                Consuelo seguirá teniendo ACCESO TOTAL mientras el rol sea Administrador. Cámbialo a Supervisor para aplicar restricciones.
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Configurar Permisos Específicos
                                </h4>
                                <div className={cn(
                                    "grid grid-cols-1 sm:grid-cols-2 gap-3 transition-all",
                                    editUserForm.watch('role') === 'admin' && "opacity-40 grayscale pointer-events-none"
                                )}>
                                    {permissionLabels.map((item) => (
                                    <FormField
                                        key={item.id}
                                        control={editUserForm.control}
                                        name={`permissions.${item.id}`}
                                        render={({ field }) => (
                                        <FormItem className={cn(
                                            "flex flex-row items-center space-x-3 space-y-0 rounded-xl border p-3 hover:bg-muted/50 transition-all",
                                            field.value || editUserForm.watch('role') === 'admin' ? "bg-primary/5 border-primary/20" : "bg-background"
                                        )}>
                                            <FormControl>
                                                <Checkbox 
                                                    checked={editUserForm.watch('role') === 'admin' ? true : field.value} 
                                                    onCheckedChange={field.onChange} 
                                                />
                                            </FormControl>
                                            <FormLabel className="text-sm font-medium cursor-pointer">{item.label}</FormLabel>
                                        </FormItem>
                                        )}
                                    />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="border-t pt-6 gap-2">
                            <Button type="button" variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isEditing} className="px-10 font-bold h-12">
                                {isEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Guardar Cambios en Perfil
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </div>
  );
}