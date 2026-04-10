'use client';

import { useState } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Trash2, Loader2, Database, Image as ImageIcon, Pencil, History, ShieldAlert, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction, saveLogoAction, saveAppNameAction, accumulateAllSystemPaymentsAction } from "@/app/dashboard/settings/actions";
import { seedDatabaseAction } from "@/app/dashboard/seed-actions";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/lib/types";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/use-auth";

const appNameSchema = z.object({
  appName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
const logoFormSchema = z.object({
  logoUrl: z.string().url('Por favor, introduce una URL válida.').or(z.literal('')),
});

type AppNameFormValues = z.infer<typeof appNameSchema>;
type LogoFormValues = z.infer<typeof logoFormSchema>;

interface SettingsClientPageProps {
    initialConfig: AppConfig | null;
    mode?: 'system' | 'maintenance';
}

export function SettingsClientPage({ initialConfig, mode = 'system' }: SettingsClientPageProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAccumulating, setIsAccumulating] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { appUser } = useAuth();

    const appNameForm = useForm<AppNameFormValues>({
        resolver: zodResolver(appNameSchema),
        defaultValues: {
            appName: initialConfig?.appName || '',
        },
    });

    const logoForm = useForm<LogoFormValues>({
        resolver: zodResolver(logoFormSchema),
        defaultValues: {
            logoUrl: initialConfig?.logoUrl || '',
        },
    });

    const handleSeedDatabase = async () => {
        setIsSeeding(true);
        try {
            const result = await seedDatabaseAction();
             if (result.success) {
                toast({
                    title: "Base de Datos Poblada",
                    description: result.message,
                });
                router.refresh();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: "Error",
                description: error.message || "No se pudo poblar la base de datos.",
            });
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDeleteAllData = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAllDataAction();
            if (result.success) {
                toast({
                    title: "Datos eliminados",
                    description: result.message,
                });
                router.refresh();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: "Error",
                description: error.message || "No se pudieron eliminar los datos.",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAccumulateAll = async () => {
        setIsAccumulating(true);
        try {
            const result = await accumulateAllSystemPaymentsAction(appUser?.id);
            if (result.success) {
                toast({
                    title: "Sincronización Exitosa",
                    description: result.message,
                });
                router.refresh();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: "Error en Sincronización",
                description: error.message || "No se pudieron acumular los pagos.",
            });
        } finally {
            setIsAccumulating(false);
        }
    };

    const onSaveAppNameSubmit = async (values: AppNameFormValues) => {
        setIsSaving(true);
        try {
            const result = await saveAppNameAction(values.appName);
            if (result.success) {
                toast({
                    title: 'Nombre Actualizado',
                    description: 'El nombre de la aplicación ha sido actualizado.',
                });
                router.refresh();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error al Guardar', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const onSaveLogoSubmit = async (values: LogoFormValues) => {
        setIsSaving(true);
        try {
            const result = await saveLogoAction(values.logoUrl);
            if (result.success) {
                toast({
                    title: 'Logo Actualizado',
                    description: 'El logo de la aplicación ha sido actualizado.',
                });
                router.refresh();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Guardar',
                description: error.message || 'No se pudo guardar el logo.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (mode === 'system') {
        return (
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Pencil className="h-5 w-5 text-primary" />
                            Identidad Visual
                        </CardTitle>
                        <CardDescription>
                            Define cómo se ve tu aplicación para todos los usuarios.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Form {...appNameForm}>
                            <form onSubmit={appNameForm.handleSubmit(onSaveAppNameSubmit)} className="space-y-4">
                                <FormField
                                    control={appNameForm.control}
                                    name="appName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Aplicación</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Mi Negocio de Préstamos" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Actualizar Nombre
                                </Button>
                            </form>
                        </Form>
                        
                        <Separator />

                        <Form {...logoForm}>
                            <form onSubmit={logoForm.handleSubmit(onSaveLogoSubmit)} className="space-y-4">
                                <FormField
                                    control={logoForm.control}
                                    name="logoUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL del Logotipo (PNG/JPG)</FormLabel>
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                                    <Input placeholder="https://tu-servidor.com/logo.png" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Actualizar Logo
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            Asistente de Configuración
                        </CardTitle>
                        <CardDescription>
                            Herramientas para iniciar rápidamente con datos de prueba.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900">
                            <div className="space-y-1">
                                <p className="font-medium">Cargar Datos de Demostración</p>
                                <p className="text-sm text-muted-foreground">Poblará el sistema con clientes, préstamos y planes de ejemplo.</p>
                            </div>
                            <Button variant="outline" onClick={handleSeedDatabase} disabled={isSeeding}>
                                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                Cargar Ejemplo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                        <History className="h-5 w-5" />
                        Procesos Contables
                    </CardTitle>
                    <CardDescription>
                        Herramientas para la integridad de los datos financieros.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900">
                        <div className="space-y-1">
                            <h3 className="font-semibold">Sincronización de Pagos Asumidos</h3>
                            <p className="text-sm text-muted-foreground max-w-xl">
                                Convierte formalmente todos los abonos de semanas anteriores que no tienen registro en pagos pagados. Esto formaliza tu cartera y actualiza el saldo real.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="default" className="bg-blue-600 hover:bg-blue-700" disabled={isAccumulating}>
                                    <History className="mr-2 h-4 w-4" />
                                    Ejecutar Sincronización
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar sincronización masiva?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción registrará pagos para todas las semanas vencidas sin registro en el sistema. El dinero se sumará a la Cartera Global. Esta operación es irreversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleAccumulateAll} className="bg-blue-600 hover:bg-blue-700">
                                        Confirmar y Ejecutar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader className="bg-destructive/5">
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" />
                        Acciones de Emergencia
                    </CardTitle>
                    <CardDescription>
                        Herramientas destructivas para el reinicio total del sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg">
                        <div className="space-y-1">
                            <h3 className="font-semibold">Reinicio de Base de Datos</h3>
                            <p className="text-sm text-muted-foreground">
                                Borra permanentemente todos los clientes, préstamos, transacciones, rutas y configuraciones.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Borrar Todo el Sistema
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-destructive">¿Estás ABSOLUTAMENTE seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará permanentemente TODOS los datos de la aplicación. No hay forma de recuperar la información una vez procesada.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteAllData}
                                disabled={isDeleting}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Sí, eliminar permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
