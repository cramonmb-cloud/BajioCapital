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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Loader2, Image as ImageIcon, Pencil, History, ShieldAlert, Building2, MessageSquare, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction, saveLogoAction, saveAppNameAction, accumulateAllSystemPaymentsAction, saveWhatsAppTemplateAction } from "@/app/dashboard/settings/actions";
import { useRouter } from "next/navigation";
import type { AppConfig } from "@/lib/types";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "./ui/badge";

const appNameSchema = z.object({
  appName: z.string().min(3, 'Mínimo 3 caracteres.'),
});
const logoFormSchema = z.object({
  logoUrl: z.string().url('URL no válida.').or(z.literal('')),
});
const whatsappTemplateSchema = z.object({
  template: z.string().min(1, 'La plantilla no puede estar vacía.'),
});

type AppNameFormValues = z.infer<typeof appNameSchema>;
type LogoFormValues = z.infer<typeof logoFormSchema>;
type WhatsappTemplateFormValues = z.infer<typeof whatsappTemplateSchema>;

interface SettingsClientPageProps {
    initialConfig: AppConfig | null;
    mode?: 'system' | 'maintenance';
}

const AVAILABLE_TAGS = [
    { tag: '{{nombre_cliente}}', desc: 'Nombre completo del titular' },
    { tag: '{{domicilio_cliente}}', desc: 'Dirección del cliente' },
    { tag: '{{telefono_cliente}}', desc: 'Teléfono del cliente' },
    { tag: '{{nombre_aval}}', desc: 'Nombre del aval registrado' },
    { tag: '{{domicilio_aval}}', desc: 'Dirección del aval' },
    { tag: '{{telefono_aval}}', desc: 'Teléfono del aval' },
    { tag: '{{monto_prestamo}}', desc: 'Monto original solicitado' },
    { tag: '{{saldo_pendiente}}', desc: 'Monto total que debe a la fecha' },
    { tag: '{{fallos_registrados}}', desc: 'Número de pagos incompletos' },
    { tag: '{{nombre_negocio}}', desc: 'Nombre de tu empresa' },
];

export function SettingsClientPage({ initialConfig, mode = 'system' }: SettingsClientPageProps) {
    const [isDeleting, setIsDeleting] = useState(false);
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

    const whatsappForm = useForm<WhatsappTemplateFormValues>({
        resolver: zodResolver(whatsappTemplateSchema),
        defaultValues: { template: initialConfig?.whatsappTemplate || 'Hola {{nombre_cliente}}, te contactamos de {{nombre_negocio}} para recordarte sobre tu préstamo pendiente de {{saldo_pendiente}}.' },
    });

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

    const onSaveWhatsappSubmit = async (values: WhatsappTemplateFormValues) => {
        setIsSaving(true);
        try {
            const result = await saveWhatsAppTemplateAction(values.template);
            if (result.success) {
                toast({ title: 'Configuración Guardada', description: 'La plantilla de WhatsApp ha sido actualizada.' });
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
            <div className="grid gap-8 max-w-3xl">
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

                <Card className="shadow-lg border-green-200 overflow-hidden">
                    <CardHeader className="bg-green-50 border-b mb-6">
                        <CardTitle className="flex items-center gap-2 text-xl text-green-800">
                            <MessageSquare className="h-5 w-5" /> Configuración de Mensajes WhatsApp
                        </CardTitle>
                        <CardDescription>Define el mensaje predeterminado que se enviará a los clientes en mora.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="h-4 w-4 text-yellow-500" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Etiquetas Disponibles</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {AVAILABLE_TAGS.map(t => (
                                    <div key={t.tag} className="flex flex-col gap-0.5">
                                        <code className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">{t.tag}</code>
                                        <span className="text-[9px] text-muted-foreground leading-none">{t.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Form {...whatsappForm}>
                            <form onSubmit={whatsappForm.handleSubmit(onSaveWhatsappSubmit)} className="space-y-4">
                                <FormField control={whatsappForm.control} name="template" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Contenido del Mensaje</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Escribe el mensaje aquí..." 
                                                className="min-h-[150px] resize-none border-2 focus:ring-green-500" 
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">
                                            Usa las etiquetas de arriba exactamente como aparecen para que el sistema las reemplace.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-10 rounded-xl">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                        Guardar Plantilla
                                    </Button>
                                </div>
                            </form>
                        </Form>
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
