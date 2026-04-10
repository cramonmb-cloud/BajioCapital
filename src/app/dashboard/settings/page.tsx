import { getPlazas, getLocalidades, getPromotoras, getUsers, getAppConfig } from "@/lib/firestore-data";
import { UserManagement } from "@/components/user-management";
import { PlazaManagement } from "@/components/plaza-management";
import { SettingsClientPage } from "@/components/settings-client-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Settings as SettingsIcon, Wrench } from "lucide-react";

export default async function SettingsPage() {
    const [plazas, localidades, promotoras, users, config] = await Promise.all([
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
        getUsers(),
        getAppConfig(),
    ]);
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
                <p className="text-muted-foreground">
                    Administra los usuarios, la estructura operativa y las herramientas de mantenimiento de CrediControl.
                </p>
            </div>

            <Tabs defaultValue="users" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px]">
                    <TabsTrigger value="users" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>Usuarios</span>
                    </TabsTrigger>
                    <TabsTrigger value="zones" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>Zonas</span>
                    </TabsTrigger>
                    <TabsTrigger value="system" className="flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        <span>Sistema</span>
                    </TabsTrigger>
                    <TabsTrigger value="maintenance" className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        <span>Mantenimiento</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="space-y-4">
                    <UserManagement users={users} />
                </TabsContent>

                <TabsContent value="zones" className="space-y-4">
                    <PlazaManagement 
                        initialPlazas={plazas} 
                        initialLocalidades={localidades} 
                        initialPromotoras={promotoras} 
                    />
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    <SettingsClientPage initialConfig={config} mode="system" />
                </TabsContent>

                <TabsContent value="maintenance" className="space-y-4">
                    <SettingsClientPage initialConfig={config} mode="maintenance" />
                </TabsContent>
            </Tabs>
        </div>
    );
}
