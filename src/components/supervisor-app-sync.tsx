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
import { CloudDownload, Loader2, KeyRound, CalendarDays, CheckCircle2, ShieldCheck, Database, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { syncWithSupervisorAppAction } from '@/app/dashboard/settings/actions';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';

const syncSchema = z.object({
  apiKey: z.string().min(5, 'La llave de acceso es demasiado corta.'),
  weekId: z.string().regex(/^\d{4}-\d{2}$/, 'El formato debe ser YYYY-WW (ej. 2024-18)'),
});

type SyncFormValues = z.infer<typeof syncSchema>;

export function SupervisorAppSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();

    const form = useForm<SyncFormValues>({
        resolver: zodResolver(syncSchema),
        defaultValues: {
            apiKey: '',
            weekId: new Date().getFullYear() + '-' + String(Math.ceil((new Date().getDate() / 7))).padStart(2, '0'),
        },
    });

    const onSyncSubmit = async (values: SyncFormValues) => {
        setIsSyncing(true);
        try {
            const result = await syncWithSupervisorAppAction(values.weekId, values.apiKey);
            if (result.success) {
                toast({
                    title: 'Sincronización Exitosa',
                    description: result.message,
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error de Integración',
                description: error.message,
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="max-w-4xl space-y-6">
            <Card className="shadow-lg border-blue-200 overflow-hidden">
                <CardHeader className="bg-blue-600 text-white pb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            <CloudDownload className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black uppercase tracking-tight">Sincronizar con SUPERvisorApp</CardTitle>
                            <CardDescription className="text-blue-100 font-medium">Importación masiva de clientes desde el servidor corporativo.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">
                    <Alert className="bg-blue-50 border-blue-100 text-blue-800">
                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                        <AlertTitle className="font-bold">Conexión Segura Detectada</AlertTitle>
                        <AlertDescription className="text-xs">
                            Este módulo utiliza el protocolo HTTPS y autenticación por cabecera <strong>X-API-KEY</strong> para proteger tus datos corporativos durante el traslado.
                        </AlertDescription>
                    </Alert>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSyncSubmit)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <FormField
                                    control={form.control}
                                    name="apiKey"
                                    render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="flex items-center gap-2 font-black uppercase text-xs text-zinc-600">
                                            <KeyRound className="h-4 w-4 text-blue-600" />
                                            Llave de Acceso (X-API-KEY)
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="password" 
                                                placeholder="Ingresa tu token secreto" 
                                                className="h-12 border-2 focus:ring-blue-500 rounded-xl font-mono text-sm" 
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">La llave es proporcionada por el administrador corporativo.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="weekId"
                                    render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel className="flex items-center gap-2 font-black uppercase text-xs text-zinc-600">
                                            <CalendarDays className="h-4 w-4 text-blue-600" />
                                            Semana de Importación
                                        </FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="Ej: 2024-18" 
                                                className="h-12 border-2 focus:ring-blue-500 rounded-xl font-bold text-center text-lg" 
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">Formato Año-Semana (YYYY-WW). Los clientes se filtran por esta fecha.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>

                            <div className="p-6 bg-muted/30 rounded-2xl border-2 border-dashed space-y-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Database className="h-4 w-4" /> Resumen de Mapeo de Datos
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> NOMBRES
                                    </Badge>
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> TELÉFONOS
                                    </Badge>
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> DOMICILIOS
                                    </Badge>
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> AVALES
                                    </Badge>
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> GARANTÍAS
                                    </Badge>
                                    <Badge variant="outline" className="justify-start gap-2 h-8 font-bold border-zinc-300">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> FOTOGRAFÍAS
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-zinc-500 italic mt-2">
                                    * Los campos no coincidentes se guardarán como metadatos internos.
                                </p>
                            </div>

                            <div className="flex flex-col items-center gap-4 pt-4">
                                <Button 
                                    type="submit" 
                                    size="lg" 
                                    disabled={isSyncing} 
                                    className="w-full md:w-auto h-14 px-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl shadow-blue-200 transition-all active:scale-95"
                                >
                                    {isSyncing ? (
                                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                    ) : (
                                        <CloudDownload className="mr-2 h-6 w-6" />
                                    )}
                                    {isSyncing ? 'CONECTANDO CON EL SERVIDOR...' : 'INICIAR SINCRONIZACIÓN AHORA'}
                                </Button>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold">
                                    <Info className="h-3 w-3" /> Este proceso puede tardar unos segundos dependiendo del volumen de datos.
                                </p>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
