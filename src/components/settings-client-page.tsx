
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
import { Trash2, Loader2, Database, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction, saveLogoAction } from "@/app/dashboard/settings/actions";
import { seedDatabaseAction } from "@/app/dashboard/seed-actions";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/lib/types";

const logoFormSchema = z.object({
  logoUrl: z.string().url('Por favor, introduce una URL válida.').or(z.literal('')),
});

type LogoFormValues = z.infer<typeof logoFormSchema>;

interface SettingsClientPageProps {
    initialConfig: AppConfig | null;
}

export function SettingsClientPage({ initialConfig }: SettingsClientPageProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSavingLogo, setIsSavingLogo] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

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

    const onSaveLogoSubmit = async (values: LogoFormValues) => {
        setIsSavingLogo(true);
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
            setIsSavingLogo(false);
        }
    };

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Personalización</CardTitle>
                    <CardDescription>
                       Ajusta la apariencia de tu aplicación.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...logoForm}>
                        <form onSubmit={logoForm.handleSubmit(onSaveLogoSubmit)} className="space-y-4">
                             <FormField
                                control={logoForm.control}
                                name="logoUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL del Logo</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2">
                                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                                <Input placeholder="https://ejemplo.com/logo.png" {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                                <Button type="submit" disabled={isSavingLogo}>
                                    {isSavingLogo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Logo
                                </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Datos de Ejemplo</CardTitle>
                    <CardDescription>
                        Carga un conjunto de datos de ejemplo para probar la aplicación. Esta acción es útil para demostraciones.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={handleSeedDatabase}>
                        <Button variant="outline" type="submit" disabled={isSeeding}>
                            {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                            {isSeeding ? 'Cargando...' : 'Cargar Datos de Ejemplo'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

             <Card className="border-destructive">
                <CardHeader>
                    <CardTitle>Zona de Peligro</CardTitle>
                    <CardDescription>
                        Estas acciones son destructivas y no se pueden deshacer.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                        <div>
                            <h3 className="font-semibold">Eliminar todos los datos</h3>
                            <p className="text-sm text-muted-foreground">
                                Esto borrará permanentemente todos los clientes, préstamos, planes y transacciones.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar todos los datos
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Esto eliminará permanentemente todos los datos de la aplicación.
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
                                Sí, eliminar todo
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
