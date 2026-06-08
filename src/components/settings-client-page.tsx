'use client';

import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Card,
    CardContent,
    CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Loader2, Image as ImageIcon, Pencil, History, ShieldAlert, Building2, MessageSquare, Sparkles, RefreshCcw, AlertTriangle, Download, Upload, FileJson, User, UserCheck, MapPin, Route, Building, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction, saveLogoAction, saveAppNameAction, accumulateAllSystemPaymentsAction, saveWhatsAppTemplateAction, revertExtraWeekPaymentsAction, importBackupAction, savePlazaWhatsAppTemplatesAction, saveMenuConfigAction, saveMenuColorsAction, saveStaffTypesAction } from "@/app/dashboard/ajustes/actions";
import { useRouter } from "next/navigation";
import type { AppConfig, WhatsAppTemplates } from "@/lib/types";
import { Separator } from "./ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { allLinks } from "./main-nav";
import { cn } from "@/lib/utils";

const appNameSchema = z.object({
  appName: z.string().min(3, 'Mínimo 3 caracteres.'),
});
const logoFormSchema = z.object({
  logoUrl: z.string().url('URL no válida.').or(z.literal('')),
  pwaLogoUrl: z.string().url('URL no válida.').or(z.literal('')),
  logoFormat: z.enum(['square', 'horizontal']).default('square'),
  logoHeightHeader: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(200).optional()),
  logoWidthHeader: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(800).optional()),
  logoHeightDashboard: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(800).optional()),
  logoWidthDashboard: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(1000).optional()),
  logoHeightLogin: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(800).optional()),
  logoWidthLogin: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : Number(val)), z.number().min(10).max(1000).optional()),
});
const whatsappTemplatesSchema = z.object({
  client: z.string().min(1, 'La plantilla para el cliente no puede estar vacía.'),
  aval: z.string().min(1, 'La plantilla para el aval no puede estar vacía.'),
});

type AppNameFormValues = z.infer<typeof appNameSchema>;
type LogoFormValues = z.infer<typeof logoFormSchema>;
type WhatsappTemplatesFormValues = z.infer<typeof whatsappTemplatesSchema>;

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
    { tag: '{{plaza}}', desc: 'Nombre de la Plaza' },
    { tag: '{{localidad}}', desc: 'Nombre de la Localidad' },
    { tag: '{{promotora}}', desc: 'Nombre de la Promotora' },
    { tag: '{{nombre_negocio}}', desc: 'Nombre de tu empresa' },
];

export function SettingsClientPage({ initialConfig, mode = 'system' }: SettingsClientPageProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAccumulating, setIsAccumulating] = useState(false);
    const [isReverting, setIsReverting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedPlazaId, setSelectedPlazaId] = useState<string>('default');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const { toast } = useToast();
    const router = useRouter();
    const { appUser } = useAuth();
    const { data: systemData } = useRealtimeData();

    const appNameForm = useForm<AppNameFormValues>({
        resolver: zodResolver(appNameSchema),
        defaultValues: { appName: initialConfig?.appName || '' },
    });

    const logoForm = useForm<LogoFormValues>({
        resolver: zodResolver(logoFormSchema),
        defaultValues: { 
            logoUrl: initialConfig?.logoUrl || '',
            pwaLogoUrl: initialConfig?.pwaLogoUrl || '',
            logoFormat: initialConfig?.logoFormat || 'square',
            logoHeightHeader: initialConfig?.logoHeightHeader ?? undefined,
            logoWidthHeader: initialConfig?.logoWidthHeader ?? undefined,
            logoHeightDashboard: initialConfig?.logoHeightDashboard ?? undefined,
            logoWidthDashboard: initialConfig?.logoWidthDashboard ?? undefined,
            logoHeightLogin: initialConfig?.logoHeightLogin ?? undefined,
            logoWidthLogin: initialConfig?.logoWidthLogin ?? undefined,
        },
    });

    const whatsappForm = useForm<WhatsappTemplatesFormValues>({
        resolver: zodResolver(whatsappTemplatesSchema),
        defaultValues: { 
            client: '',
            aval: ''
        },
    });

    // Cargar datos al cambiar de plaza seleccionada
    useEffect(() => {
        if (selectedPlazaId === 'default') {
            whatsappForm.reset({
                client: initialConfig?.whatsappTemplate || 'Hola {{nombre_cliente}}, te recordamos tu adeudo de {{saldo_pendiente}}.',
                aval: initialConfig?.whatsappTemplates?.default?.aval || 'Hola {{nombre_aval}}, te contactamos por el atraso de {{nombre_cliente}}.'
            });
        } else {
            const plazaTemplates = initialConfig?.whatsappTemplates?.[selectedPlazaId];
            whatsappForm.reset({
                client: plazaTemplates?.client || initialConfig?.whatsappTemplate || 'Hola {{nombre_cliente}}, te recordamos tu adeudo de {{saldo_pendiente}}.',
                aval: plazaTemplates?.aval || 'Hola {{nombre_aval}}, te contactamos por el atraso de {{nombre_cliente}}.'
            });
        }
    }, [selectedPlazaId, initialConfig, whatsappForm]);

    const [menuConfigState, setMenuConfigState] = useState<Record<string, 'operacion' | 'administracion'>>({});
    const [operacionColorState, setOperacionColorState] = useState<string>('#3b82f6');
    const [administracionColorState, setAdministracionColorState] = useState<string>('#8b5cf6');

    useEffect(() => {
        const defaultMenuConfig: Record<string, 'operacion' | 'administracion'> = {
            dashboard: 'operacion',
            clients: 'operacion',
            consultarCliente: 'operacion',
            loans: 'operacion',
            overduePortfolio: 'operacion',
            carteraVencida: 'operacion',
            debes: 'operacion',
            wallet: 'administracion',
            control: 'administracion',
            settings: 'administracion',
            avisos: 'administracion',
            personal: 'administracion',
        };
        setMenuConfigState({ ...defaultMenuConfig, ...initialConfig?.menuConfig });
        if (initialConfig?.operacionColor) {
            setOperacionColorState(initialConfig.operacionColor);
        }
        if (initialConfig?.administracionColor) {
            setAdministracionColorState(initialConfig.administracionColor);
        }
    }, [initialConfig]);

    const [staffTypesState, setStaffTypesState] = useState<string[]>(initialConfig?.staffTypes || ['EJECUTIVO/A', 'SUPERVISOR/A', 'PROMOTOR/A']);
    const [newStaffType, setNewStaffType] = useState('');

    const [menuOrderState, setMenuOrderState] = useState<string[]>([]);
    const [activeMenuSettingsTab, setActiveMenuSettingsTab] = useState<'operacion' | 'administracion'>('operacion');

    useEffect(() => {
        const defaultOrder = allLinks.map(l => l.id);
        if (initialConfig?.menuOrder) {
            const existingOrder = initialConfig.menuOrder.filter((id: string) => defaultOrder.includes(id));
            const missingOrder = defaultOrder.filter((id: string) => !existingOrder.includes(id));
            setMenuOrderState([...existingOrder, ...missingOrder]);
        } else {
            setMenuOrderState(defaultOrder);
        }
    }, [initialConfig]);

    const orderedLinksInSettings = useMemo(() => {
        return [...allLinks].sort((a, b) => {
            const indexA = menuOrderState.indexOf(a.id);
            const indexB = menuOrderState.indexOf(b.id);
            const posA = indexA === -1 ? 999 : indexA;
            const posB = indexB === -1 ? 999 : indexB;
            return posA - posB;
        });
    }, [menuOrderState]);

    const filteredLinksInSettings = useMemo(() => {
        return orderedLinksInSettings.filter(link => {
            const val = menuConfigState[link.id] || 'operacion';
            return val === activeMenuSettingsTab;
        });
    }, [orderedLinksInSettings, menuConfigState, activeMenuSettingsTab]);

    const moveFilteredMenuItem = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index > 0) {
            const currentId = filteredLinksInSettings[index].id;
            const targetId = filteredLinksInSettings[index - 1].id;
            
            setMenuOrderState(prev => {
                const nextOrder = [...prev];
                const currentIndex = nextOrder.indexOf(currentId);
                const targetIndex = nextOrder.indexOf(targetId);
                if (currentIndex !== -1 && targetIndex !== -1) {
                    nextOrder[currentIndex] = targetId;
                    nextOrder[targetIndex] = currentId;
                }
                return nextOrder;
            });
        } else if (direction === 'down' && index < filteredLinksInSettings.length - 1) {
            const currentId = filteredLinksInSettings[index].id;
            const targetId = filteredLinksInSettings[index + 1].id;
            
            setMenuOrderState(prev => {
                const nextOrder = [...prev];
                const currentIndex = nextOrder.indexOf(currentId);
                const targetIndex = nextOrder.indexOf(targetId);
                if (currentIndex !== -1 && targetIndex !== -1) {
                    nextOrder[currentIndex] = targetId;
                    nextOrder[targetIndex] = currentId;
                }
                return nextOrder;
            });
        }
    };

    const handleAddStaffType = () => {
        const trimmed = newStaffType.trim().toUpperCase();
        if (!trimmed) return;
        if (staffTypesState.includes(trimmed)) {
            toast({ variant: 'destructive', title: 'Error', description: 'Este puesto ya existe.' });
            return;
        }
        setStaffTypesState(prev => [...prev, trimmed]);
        setNewStaffType('');
    };

    const handleRemoveStaffType = (typeToRemove: string) => {
        setStaffTypesState(prev => prev.filter(t => t !== typeToRemove));
    };

    const onSaveStaffTypes = async () => {
        setIsSaving(true);
        try {
            const result = await saveStaffTypesAction(staffTypesState);
            if (result.success) {
                toast({ title: 'Configuración Guardada', description: result.message });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const onSaveMenuConfig = async () => {
        setIsSaving(true);
        try {
            const result = await saveMenuConfigAction(menuConfigState, menuOrderState);
            if (result.success) {
                toast({ title: 'Menú Actualizado', description: 'La distribución del menú ha sido guardada.' });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const onSaveMenuColors = async () => {
        setIsSaving(true);
        try {
            const result = await saveMenuColorsAction(operacionColorState, administracionColorState);
            if (result.success) {
                toast({ title: 'Colores Actualizados', description: 'Los colores de los menús han sido guardados.' });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
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

    const handleRevertExtras = async () => {
        setIsReverting(true);
        try {
            const result = await revertExtraWeekPaymentsAction();
            if (result.success) {
                toast({ title: "Reversión Completada", description: result.message });
                router.refresh();
            } else throw new Error(result.message);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message });
        } finally {
            setIsReverting(false);
        }
    };

    const handleExportBackup = () => {
        if (!systemData) return;
        
        try {
            const backup = {
                version: '1.0',
                date: new Date().toISOString(),
                ...systemData
            };
            
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RESPALDO_CREDICONTROL_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({ title: "Respaldo Generado", description: "El archivo se ha descargado correctamente." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error de Exportación", description: error.message });
        }
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                const result = await importBackupAction(json);
                if (result.success) {
                    toast({ title: "Restauración Exitosa", description: result.message });
                    router.refresh();
                } else throw new Error(result.message);
            } catch (error: any) {
                toast({ variant: 'destructive', title: "Error de Restauración", description: error.message });
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
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
            const result = await saveLogoAction(values.logoUrl, values.logoFormat, {
                logoHeightHeader: values.logoHeightHeader ?? undefined,
                logoWidthHeader: values.logoWidthHeader ?? undefined,
                logoHeightDashboard: values.logoHeightDashboard ?? undefined,
                logoWidthDashboard: values.logoWidthDashboard ?? undefined,
                logoHeightLogin: values.logoHeightLogin ?? undefined,
                logoWidthLogin: values.logoWidthLogin ?? undefined,
            }, values.pwaLogoUrl);
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

    const onSaveWhatsAppSubmit = async (values: WhatsappTemplatesFormValues) => {
        setIsSaving(true);
        try {
            const templates: WhatsAppTemplates = {
                client: values.client,
                aval: values.aval
            };
            const result = await savePlazaWhatsAppTemplatesAction(selectedPlazaId, templates);
            
            // Si es el default, también actualizar el campo global por compatibilidad legacy
            if (selectedPlazaId === 'default') {
                await saveWhatsAppTemplateAction(values.client);
            }

            if (result.success) {
                toast({ title: 'Configuración Guardada', description: `Las plantillas para ${selectedPlazaId === 'default' ? 'todas las plazas' : 'la plaza seleccionada'} han sido actualizadas.` });
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
            <div className="grid gap-6 max-w-4xl">
                <Tabs defaultValue="identidad" className="space-y-6">
                    <div className="flex justify-start">
                        <TabsList className="inline-flex h-auto items-center justify-start rounded-xl bg-slate-100 dark:bg-slate-900/50 p-1 text-muted-foreground border border-slate-200/60 dark:border-slate-800/40 shadow-inner w-full md:w-auto overflow-x-auto flex-nowrap gap-1">
                            <TabsTrigger
                                value="identidad"
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 border border-transparent data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:font-black data-[state=active]:shadow-primary/25 text-muted-foreground hover:text-foreground hover:bg-background/50 shrink-0"
                            >
                                <Building2 className="h-4 w-4" />
                                <span>Identidad y Diseño</span>
                            </TabsTrigger>
                            <span className="h-4 w-[1px] bg-slate-300/80 dark:bg-slate-700/80 shrink-0" />
                            <TabsTrigger
                                value="menu"
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 border border-transparent data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:font-black data-[state=active]:shadow-primary/25 text-muted-foreground hover:text-foreground hover:bg-background/50 shrink-0"
                            >
                                <Route className="h-4 w-4" />
                                <span>Distribución de Menú</span>
                            </TabsTrigger>
                            <span className="h-4 w-[1px] bg-slate-300/80 dark:bg-slate-700/80 shrink-0" />
                            <TabsTrigger
                                value="whatsapp"
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 border border-transparent data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:font-black data-[state=active]:shadow-primary/25 text-muted-foreground hover:text-foreground hover:bg-background/50 shrink-0"
                            >
                                <MessageSquare className="h-4 w-4" />
                                <span>Notificaciones WhatsApp</span>
                            </TabsTrigger>
                            <span className="h-4 w-[1px] bg-slate-300/80 dark:bg-slate-700/80 shrink-0" />
                            <TabsTrigger
                                value="puestos"
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 border border-transparent data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:font-black data-[state=active]:shadow-primary/25 text-muted-foreground hover:text-foreground hover:bg-background/50 shrink-0"
                            >
                                <UserCheck className="h-4 w-4" />
                                <span>Puestos de Personal</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="identidad" className="space-y-6 focus-visible:outline-none animate-in fade-in-50 duration-300">
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
                                    <form onSubmit={logoForm.handleSubmit(onSaveLogoSubmit)} className="space-y-6">
                                        <FormField control={logoForm.control} name="logoUrl" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold">URL del Logotipo Corporativo (Imagen o Video)</FormLabel>
                                                <div className="relative flex-grow">
                                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input placeholder="https://ejemplo.com/logo.png o .mp4" {...field} className="pl-10" /></FormControl>
                                                </div>
                                                <FormDescription className="text-xs">
                                                    Se admiten imágenes estáticas (PNG, JPG, SVG, GIF) y videos animados (MP4, WebM).
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={logoForm.control} name="pwaLogoUrl" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold">URL de la Imagen para la PWA (Icono)</FormLabel>
                                                <div className="relative flex-grow">
                                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <FormControl><Input placeholder="https://ejemplo.com/pwa-logo.png" {...field} className="pl-10" /></FormControl>
                                                </div>
                                                <FormDescription className="text-xs">
                                                    Esta imagen se utilizará como icono de la aplicación web progresiva (PWA) instalada en dispositivos móviles. Se recomienda que sea una imagen cuadrada en formato PNG.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <FormField control={logoForm.control} name="logoFormat" render={({ field }) => (
                                            <FormItem className="space-y-2">
                                                <FormLabel className="font-bold">Formato / Proporción del Logotipo</FormLabel>
                                                <FormControl>
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => field.onChange('square')}
                                                            className={cn(
                                                                "flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 bg-card",
                                                                field.value === 'square' 
                                                                    ? "border-primary bg-primary/5 shadow-sm" 
                                                                    : "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            <div className="h-8 w-8 rounded border-2 border-dashed border-current flex items-center justify-center font-black text-xs">1:1</div>
                                                            <span className="text-xs font-bold">Cuadrado / Circular</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => field.onChange('horizontal')}
                                                            className={cn(
                                                                "flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all gap-2 bg-card",
                                                                field.value === 'horizontal' 
                                                                    ? "border-primary bg-primary/5 shadow-sm" 
                                                                    : "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            <div className="h-8 w-16 rounded border-2 border-dashed border-current flex items-center justify-center font-black text-xs font-mono">Horizontal</div>
                                                            <span className="text-xs font-bold">Apaisado / Banner</span>
                                                        </button>
                                                    </div>
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    Elige <strong>Cuadrado</strong> para logotipos en pastilla o circulares. Elige <strong>Horizontal</strong> para logotipos tipo banner; esto optimizará las dimensiones en la barra superior.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )} />

                                        <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                Dimensiones Personalizadas (en píxeles)
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground">Deja los campos vacíos si deseas usar los tamaños predefinidos del sistema.</p>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {/* Barra de Navegación */}
                                                <div className="space-y-3 p-4 border rounded-2xl bg-muted/20">
                                                    <span className="text-xs font-black uppercase text-primary">Barra de Navegación</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <FormField control={logoForm.control} name="logoWidthHeader" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Ancho (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={logoForm.control} name="logoHeightHeader" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Alto (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>

                                                {/* Dashboard Principal */}
                                                <div className="space-y-3 p-4 border rounded-2xl bg-muted/20">
                                                    <span className="text-xs font-black uppercase text-primary">Dashboard Principal</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <FormField control={logoForm.control} name="logoWidthDashboard" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Ancho (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={logoForm.control} name="logoHeightDashboard" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Alto (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>

                                                {/* Pantalla de Login */}
                                                <div className="space-y-3 p-4 border rounded-2xl bg-muted/20">
                                                    <span className="text-xs font-black uppercase text-primary">Pantalla de Login</span>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <FormField control={logoForm.control} name="logoWidthLogin" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Ancho (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                        <FormField control={logoForm.control} name="logoHeightLogin" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground/80">Alto (px)</FormLabel>
                                                                <FormControl><Input type="number" placeholder="Auto" {...field} value={field.value ?? ''} onChange={field.onChange} className="bg-white" /></FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-2">
                                            <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/95 font-bold h-10 px-6 rounded-lg">
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                                                Guardar Logotipo
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>

                        <Card className="shadow-lg border-primary/10">
                            <CardHeader className="bg-primary/5 border-b mb-6">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <Sparkles className="h-5 w-5 text-primary" /> Personalización de Colores
                                </CardTitle>
                                <CardDescription>Configura los colores principales para las pestañas y secciones de Operación y Administración.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Color Operación */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold block">Color para Operación</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                value={operacionColorState} 
                                                onChange={(e) => setOperacionColorState(e.target.value)}
                                                className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                                            />
                                            <Input 
                                                type="text" 
                                                value={operacionColorState} 
                                                onChange={(e) => setOperacionColorState(e.target.value)}
                                                placeholder="#3b82f6"
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {['#3b82f6', '#10b981', '#6366f1', '#f97316', '#ef4444', '#ec4899'].map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setOperacionColorState(c)}
                                                    className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110 active:scale-95 relative"
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {operacionColorState === c && (
                                                        <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white shadow-sm" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Color Administración */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-bold block">Color para Administración</label>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                value={administracionColorState} 
                                                onChange={(e) => setAdministracionColorState(e.target.value)}
                                                className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                                            />
                                            <Input 
                                                type="text" 
                                                value={administracionColorState} 
                                                onChange={(e) => setAdministracionColorState(e.target.value)}
                                                placeholder="#8b5cf6"
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {['#8b5cf6', '#6366f1', '#673ab7', '#ec4899', '#f43f5e', '#14b8a6'].map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setAdministracionColorState(c)}
                                                    className="h-6 w-6 rounded-full border border-border transition-transform hover:scale-110 active:scale-95 relative"
                                                    style={{ backgroundColor: c }}
                                                >
                                                    {administracionColorState === c && (
                                                        <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-white shadow-sm" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <Button onClick={onSaveMenuColors} disabled={isSaving} className="bg-primary hover:bg-primary/95 font-bold h-10 px-6 rounded-lg">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        Guardar Colores
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="menu" className="focus-visible:outline-none animate-in fade-in-50 duration-300">
                        <Card className="shadow-lg border-blue-200 overflow-hidden">
                            <CardHeader className="bg-blue-50 border-b mb-6">
                                <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
                                    <Route className="h-5 w-5" /> Distribución de Menú
                                </CardTitle>
                                <CardDescription>
                                    Organiza las secciones del sistema en los menús de Operación y Administración.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    {/* Tab Selector */}
                                    <div className="flex bg-muted/65 p-0.5 rounded-full border border-border/40 justify-between relative h-9 items-center max-w-[280px]">
                                        <button
                                            type="button"
                                            onClick={() => setActiveMenuSettingsTab('operacion')}
                                            className={cn(
                                                "flex-1 py-1 rounded-full text-xs font-bold text-center transition-all duration-300 relative z-10 active:scale-95",
                                                activeMenuSettingsTab === 'operacion'
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 font-black"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Operación
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveMenuSettingsTab('administracion')}
                                            className={cn(
                                                "flex-1 py-1 rounded-full text-xs font-bold text-center transition-all duration-300 relative z-10 active:scale-95",
                                                activeMenuSettingsTab === 'administracion'
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 font-black"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Administración
                                        </button>
                                    </div>

                                    <div className="grid gap-4">
                                        {filteredLinksInSettings.length > 0 ? (
                                            filteredLinksInSettings.map((link: any, index: number) => {
                                                const value = menuConfigState[link.id] || 'operacion';
                                                const LinkIcon = link.icon;
                                                return (
                                                    <div key={link.id} className="flex items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <LinkIcon className="h-5 w-5 text-muted-foreground" />
                                                            <div>
                                                                <p className="font-bold text-sm">{link.label}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Ruta: {link.href}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-[180px]">
                                                                <Select
                                                                    value={value}
                                                                    onValueChange={(val: 'operacion' | 'administracion') => {
                                                                        setMenuConfigState(prev => ({
                                                                            ...prev,
                                                                            [link.id]: val
                                                                        }));
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="operacion">Operación</SelectItem>
                                                                        <SelectItem value="administracion">Administración</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="flex items-center gap-0.5">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={index === 0}
                                                                    onClick={() => moveFilteredMenuItem(index, 'up')}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                                                >
                                                                    <ChevronUp className="h-4.5 w-4.5" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    disabled={index === filteredLinksInSettings.length - 1}
                                                                    onClick={() => moveFilteredMenuItem(index, 'down')}
                                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                                                                >
                                                                    <ChevronDown className="h-4.5 w-4.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="text-center py-8 text-xs text-muted-foreground">
                                                No hay secciones asignadas a este menú.
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button
                                            onClick={onSaveMenuConfig}
                                            disabled={isSaving}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-black h-12 px-10 rounded-xl shadow-lg"
                                        >
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
                                            Guardar Distribución de Menú
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="whatsapp" className="focus-visible:outline-none animate-in fade-in-50 duration-300">
                        <Card className="shadow-lg border-green-200 overflow-hidden">
                            <CardHeader className="bg-green-50 border-b mb-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-xl text-green-800">
                                            <MessageSquare className="h-5 w-5" /> Notificaciones WhatsApp
                                        </CardTitle>
                                        <CardDescription>Define mensajes personalizados por Plaza y Destinatario.</CardDescription>
                                    </div>
                                    <div className="min-w-[200px] space-y-1">
                                        <label className="text-[10px] font-black uppercase text-green-700">Configurar Plaza:</label>
                                        <Select value={selectedPlazaId} onValueChange={setSelectedPlazaId}>
                                            <SelectTrigger className="bg-white border-green-200 focus:ring-green-500">
                                                <SelectValue placeholder="Selecciona Plaza" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="default">TODAS (Predefinido)</SelectItem>
                                                {systemData?.plazas.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Etiquetas Dinámicas</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
                                        {AVAILABLE_TAGS.map(t => (
                                            <div key={t.tag} className="flex flex-col gap-0.5">
                                                <code className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 w-fit">{t.tag}</code>
                                                <span className="text-[8px] text-muted-foreground leading-none">{t.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Form {...whatsappForm}>
                                    <form onSubmit={whatsappForm.handleSubmit(onSaveWhatsAppSubmit)} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={whatsappForm.control} name="client" render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-green-600" />
                                                        <FormLabel className="font-black uppercase text-xs">Mensaje para el Cliente</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Textarea 
                                                            placeholder="Escribe el mensaje aquí..." 
                                                            className="min-h-[200px] resize-none border-2 focus:ring-green-500 text-sm" 
                                                            {...field} 
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={whatsappForm.control} name="aval" render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <UserCheck className="h-4 w-4 text-green-600" />
                                                        <FormLabel className="font-black uppercase text-xs">Mensaje para el Aval</FormLabel>
                                                    </div>
                                                    <FormControl>
                                                        <Textarea 
                                                            placeholder="Escribe el mensaje aquí..." 
                                                            className="min-h-[200px] resize-none border-2 focus:ring-green-500 text-sm" 
                                                            {...field} 
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                        <div className="flex justify-end pt-4 border-t">
                                            <Button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-black h-12 px-10 rounded-xl shadow-lg">
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                                Guardar Cambios para {selectedPlazaId === 'default' ? 'Sistema' : 'Plaza'}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="puestos" className="focus-visible:outline-none animate-in fade-in-50 duration-300">
                        <Card className="shadow-lg border-primary/10">
                            <CardHeader className="bg-primary/5 border-b mb-6">
                                <CardTitle className="flex items-center gap-2 text-xl">
                                    <UserCheck className="h-5 w-5 text-primary" /> Puestos y Tipos de Personal
                                </CardTitle>
                                <CardDescription>Administra el catálogo de puestos disponibles para registrar a tus empleados.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input 
                                            placeholder="Nuevo puesto (ej. COBRADOR/A)" 
                                            value={newStaffType} 
                                            onChange={(e) => setNewStaffType(e.target.value.toUpperCase())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddStaffType();
                                                }
                                            }}
                                        />
                                        <Button onClick={handleAddStaffType} type="button">
                                            Agregar
                                        </Button>
                                    </div>
                                    
                                    <div className="border rounded-xl p-4 bg-muted/10 space-y-2">
                                        {staffTypesState.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-2">No hay puestos registrados. El sistema usará los valores por defecto.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {staffTypesState.map((type, index) => (
                                                    <div key={index} className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-card shadow-sm text-sm font-semibold">
                                                        <span>{type}</span>
                                                        <button 
                                                            type="button"
                                                            className="text-destructive hover:bg-destructive/10 p-0.5 rounded transition-colors"
                                                            onClick={() => handleRemoveStaffType(type)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button onClick={onSaveStaffTypes} disabled={isSaving} className="bg-primary hover:bg-primary/95 font-bold h-10 px-6 rounded-lg">
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                            Guardar Puestos
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
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
                <CardContent className="pt-8 space-y-6">
                    {/* Sincronización Global */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 border-2 border-blue-100 rounded-3xl bg-blue-50/20">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-lg font-bold text-blue-900">Sincronización de Cartera (Base)</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Formaliza abonos asumidos <strong>solo en semanas del contrato base</strong>. La semana extra nunca se llenará automáticamente.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="default" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-6 rounded-xl shadow-lg" disabled={isAccumulating}>
                                    <History className="mr-2 h-5 w-5" />
                                    Sincronizar Todo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl p-8">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-bold">¿Deseas formalizar la cartera base?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base py-4">
                                        Se registrarán abonos permanentes para semanas vencidas del contrato. La semana de penalización no se verá afectada.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleAccumulateAll} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8">
                                        Sí, Ejecutar
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    {/* REVERSIÓN DE SEMANAS EXTRAS */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-6 border-2 border-orange-100 rounded-3xl bg-orange-50/10">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                                <RefreshCcw className="h-5 w-5" /> Reversión de Semanas Extras
                            </h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Limpia abonos erróneos en semanas extras registrados por auto-llenado a partir del <strong>13/03/26</strong>. El saldo se pondrá en $0 y la cartera se ajustará automáticamente.
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50 font-bold h-12 px-6 rounded-xl" disabled={isReverting}>
                                    {isReverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                    Revertir Semanas Extras
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl p-8 border-orange-200">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-bold text-orange-900 flex items-center gap-2">
                                        <AlertTriangle className="h-6 w-6 text-orange-600" /> ¿Ejecutar Limpieza de Emergencia?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-base py-4 text-orange-800">
                                        Este proceso buscará abonos confirmados en semanas extra (posteriores al 13/03/26) y los pondrá de nuevo en $0. El saldo de tu caja global disminuirá según el total recuperado.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRevertExtras} className="bg-orange-600 hover:bg-orange-700 rounded-xl h-12 px-8 text-white">
                                        Sí, Revertir Pagos
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-zinc-200 overflow-hidden">
                <CardHeader className="bg-zinc-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <FileJson className="h-5 w-5 text-zinc-700" /> Respaldo y Restauración de Sistema
                    </CardTitle>
                    <CardDescription>Resguarda toda la información de clientes, préstamos y finanzas en un archivo externo.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Exportar */}
                        <div className="p-6 border-2 border-dashed rounded-3xl space-y-4 flex flex-col items-center text-center bg-zinc-50/50">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <Download className="h-8 w-8 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-lg">Exportar Base de Datos</h3>
                                <p className="text-xs text-muted-foreground">Descarga un archivo JSON con toda la información actual del sistema.</p>
                            </div>
                            <Button onClick={handleExportBackup} className="w-full h-12 font-bold rounded-xl" variant="outline">
                                Generar Respaldo Full
                            </Button>
                        </div>

                        {/* Importar */}
                        <div className="p-6 border-2 border-dashed border-blue-100 rounded-3xl space-y-4 flex flex-col items-center text-center bg-blue-50/10">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <Upload className="h-8 w-8 text-blue-600" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="font-bold text-lg">Importar Respaldo</h3>
                                <p className="text-xs text-muted-foreground">Carga un respaldo previo para restaurar el sistema. <strong>¡Esto borrará los datos actuales!</strong></p>
                            </div>
                            <input 
                                type="file" 
                                accept=".json" 
                                className="hidden" 
                                ref={fileInputRef} 
                                onChange={handleImportFile} 
                            />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button className="w-full h-12 font-bold rounded-xl bg-blue-600 hover:bg-blue-700" disabled={isImporting}>
                                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
                                        Subir Archivo de Respaldo
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl p-8">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
                                            <AlertTriangle className="h-6 w-6 text-red-600" /> ¿Restaurar Base de Datos?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription className="text-base py-4 text-red-700">
                                            Esta acción reemplazará <strong>TODOS</strong> los datos actuales (clientes, préstamos, cartera) con los del archivo. Los usuarios del personal deben ser registrados previamente en el sistema para vincular sus permisos.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="rounded-xl h-12">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className="bg-red-600 hover:bg-red-700 rounded-xl h-12 px-8"
                                        >
                                            Entendido, Proceder
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-destructive/20 overflow-hidden">
                <CardHeader className="bg-destructive/5 border-b mb-6">
                    <CardTitle className="flex items-center gap-2 text-xl text-destructive">
                        <ShieldAlert className="h-5 w-5" /> Zona Crítica de Emergencia
                    </CardTitle>
                    <CardDescription>Acciones destructivas que afectan la totalidad del sistema.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 p-8 border-2 border-destructive/10 rounded-3xl bg-destructive/5">
                        <div className="space-y-3 flex-1">
                            <h3 className="text-xl font-bold text-destructive">Restauración de Fábrica</h3>
                            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                                Elimina permanentemente toda la información. Esta operación no se puede deshacer.
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
