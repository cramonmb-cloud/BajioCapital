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
import { Trash2, Loader2, Database, Image as ImageIcon, Pencil, History, ShieldAlert, Sparkles, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction, saveLogoAction, saveAppNameAction, accumulateAllSystemPaymentsAction } from "@/app/dashboard/settings/actions";
import { seedDatabaseAction } from "@/app/dashboard/seed-actions";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/lib/types";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/use-auth";

const appNameSchema = z.object({
  appName: z.string().min(3, 'Mínimo 3 caracteres.'),
});
const logoFormSchema = z.object({
  logoUrl: z.string().url('URL no válida.').or(z.literal('')),
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
        defaultValues: { appName: initialConfig?.appName || '' },
    });

    const logoForm = useForm<LogoFormValues>({
        resolver: zodResolver(logoFormSchema),
        defaultValues: { logoUrl: initialConfig?.logoUrl || '' },
    });

    const handleSeedDatabase = async () => {
        setIsSeeding(true);
        try {
            const result = await seedDatabaseAction();
            if (result.success) {
                toast({ title: "Éxito", description: result.message });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDeleteAllData = async () => {
        setIsDeleting(true);
        try {
            const result = await deleteAllDataAction();
            if (result.success) {
                toast({ title: "Datos eliminados", description: result.message });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAccumulateAll = async () => {
        setIsAccumulating(true);
        try {
            const result = await accumulateAllSystemPaymentsAction(appUser?.id);
            if (result.success) {
                toast({ title: "Sincronización Exitosa", description: result.message });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsAccumulating(false);
        }
    };

    const onSaveAppNameSubmit = async (values: AppNameFormValues) => {
        setIsSaving(true);
        try {
            const result = await saveAppNameAction(values.appName);
            if (result.success) {
                toast({ title: 'Actualizado', description: 'Nombre guardado.' });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const onSaveLogoSubmit = async (values: LogoFormValues) => {
        setIsSaving(true);
        try {
            const result = await saveLogoAction(values.logoUrl);
            if (result.success) {
                toast({ title: 'Actualizado', description: 'Logo guardado.' });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    if (mode === 'system') {
        return (
            <div className="grid gap-8 lg:grid-cols-2">
                <Card className="shadow-lg border-primary/10">
                    <CardHeader className="bg-primary/5 border-b mb-6">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Building2 className="h-5 w-5 text-primary" /> Identidad Visual
                        </CardTitle>
                        <CardDescription>Personaliza la marca de tu negocio en la plataforma.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <Form {...appNameForm}>
                            <form onSubmit={appNameForm.handleSubmit(onSaveAppNameSubmit)} className="space-y-4">
                                <FormField control={appNameForm.control} name="appName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Nombre del Negocio</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl><Input placeholder="EJ: CREDI-CONTROL" {...field} /></FormControl>
                                            <Button type="submit" disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                        
                        <Separator />

                        <Form {...logoForm}>
                            <form onSubmit={logoForm.handleSubmit(onSaveLogoSubmit)} className="space-y-4">
                                <FormField control={logoForm.control} name="logoUrl" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">URL del Logo Corporativo</FormLabel>
                                        <div className="flex gap-2">
                                            <div className="relative flex-grow">
                                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl><Input placeholder="https://..." {...field} className="pl-10" /></FormControl>
                                            </div>
                                            <Button type="submit" disabled={isSaving}>
                                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-amber-200">
                    <CardHeader className="bg-amber-50 border-b mb-6">
                        <CardTitle className="flex items-center gap-2 text-xl text-amber-700">
                            <Sparkles className="h-5 w-5" /> Entorno de Pruebas
                        </CardTitle>
                        <CardDescription>Genera datos ficticios para demostraciones o capacitación.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="p-6 border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50/30 flex flex-col items-center text-center gap-4">
                            <div className="p-4 bg-amber-100 rounded-full">
                                <Database className="h-8 w-8 text-amber-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-lg">Población de Datos</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Insertará clientes, préstamos y planes de prueba para explorar la plataforma.</p>
                            </div>
                            <Button variant="outline" onClick={handleSeedDatabase} disabled={isSeeding} className="border-amber-600 text-amber-700 hover:bg-amber-100 font-bold px-8">
                                {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                                Generar Datos de Ejemplo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid gap-8">
            <Card className="shadow-lg border-blue-200 overflow-hidden">
                <CardHeader className="bg-blue-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                        <History className="h-5 w-5" /> Procesos Contables Masivos
                    </CardTitle>
                    <CardDescription>Operaciones para mantener la integridad financiera de la cartera global.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 border-2 border-blue-100 rounded-3xl bg-blue-50/20">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-xl font-bold text-blue-900">Sincronización de Cartera</h3>
                            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                                Este proceso analiza todos los préstamos y formaliza los "Pagos Asumidos" en registros reales. Al ejecutarse, el capital se sumará formalmente a tu Cartera Global y se cerrarán los préstamos que ya no tengan adeudo.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 px-8 rounded-xl shadow-lg shadow-blue-200 transition-all" disabled={isAccumulating}>
                                    <History className="mr-2 h-5 w-5" />
                                    Ejecutar Sincronización Global
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl p-8">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-bold">¿Deseas formalizar la cartera?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base py-4">
                                        Esta acción registrará abonos permanentes en la base de datos para todas las semanas vencidas sin registro. El saldo de tu caja aumentará según el total acumulado. Esta operación no se puede revertir.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleAccumulateAll} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8">
                                        Sí, Ejecutar Sincronización
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-destructive/20 overflow-hidden">
                <CardHeader className="bg-destructive/5 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl text-destructive">
                        <ShieldAlert className="h-5 w-5" /> Zona Crítica de Emergencia
                    </CardTitle>
                    <CardDescription>Acciones destructivas que afectan la totalidad del sistema.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 border-2 border-destructive/10 rounded-3xl bg-destructive/5">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-xl font-bold text-destructive">Restauración de Fábrica</h3>
                            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                                Elimina permanentemente toda la información: clientes, préstamos, transacciones, rutas y configuraciones personalizadas. La aplicación volverá a su estado inicial.
                            </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="font-bold h-14 px-8 rounded-xl shadow-lg shadow-destructive/20 transition-all">
                                <Trash2 className="mr-2 h-5 w-5" />
                                Borrar Todo el Sistema
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl p-8">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-2xl font-bold text-destructive">¿Estás absolutamente seguro?</AlertDialogTitle>
                              <AlertDialogDescription className="text-base py-4 text-red-600 font-medium">
                                Esta acción es IRREVERSIBLE. Se perderán todos los datos contables y registros de clientes del negocio para siempre.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteAllData}
                                disabled={isDeleting}
                                className="bg-destructive hover:bg-destructive/90 rounded-xl h-12 px-8"
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
