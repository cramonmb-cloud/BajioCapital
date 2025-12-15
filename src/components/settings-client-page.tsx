
'use client';

import { useState } from "react";
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
import { Trash2, Loader2, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { deleteAllDataAction } from "@/app/dashboard/settings/actions";
import { seedDatabaseAction } from "@/app/dashboard/seed-actions";
import { useRouter } from "next/navigation";


export function SettingsClientPage() {
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

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

    return (
        <div className="space-y-6">
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
