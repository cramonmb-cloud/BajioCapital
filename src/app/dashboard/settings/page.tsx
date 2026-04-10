import { getPlazas, getLocalidades, getPromotoras, getUsers, getAppConfig } from "@/lib/firestore-data";
import { UserManagement } from "@/components/user-management";
import { PlazaManagement } from "@/components/plaza-management";
import { SettingsClientPage } from "@/components/settings-client-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        <div className="container mx-auto space-y-8 py-6">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-4xl font-extrabold tracking-tight">Ajustes del Sistema</h1>
                <p className="text-lg text-muted-foreground">
                    Administra la identidad corporativa, el personal, la estructura operativa y el mantenimiento de la plataforma.
                </p>
            </div>

            <Tabs defaultValue="users" className="space-y-8">
                <div className="flex justify-center md:justify-start">
                    <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full md:w-auto">
                        <TabsTrigger value="users" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">Personal</span>
                        </TabsTrigger>
                        <TabsTrigger value="zones" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                            <MapPin className="h-4 w-4" />
                            <span className="hidden sm:inline">Zonas y Rutas</span>
                        </TabsTrigger>
                        <TabsTrigger value="system" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                            <SettingsIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Personalización</span>
                        </TabsTrigger>
                        <TabsTrigger value="maintenance" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-destructive data-[state=active]:text-destructive">
                            <Wrench className="h-4 w-4" />
                            <span className="hidden sm:inline">Mantenimiento</span>
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="users" className="mt-0 focus-visible:outline-none">
                    <div className="animate-in fade-in-50 duration-500">
                        <UserManagement users={users} />
                    </div>
                </TabsContent>

                <TabsContent value="zones" className="mt-0 focus-visible:outline-none">
                    <div className="animate-in fade-in-50 duration-500">
                        <PlazaManagement 
                            initialPlazas={plazas} 
                            initialLocalidades={localidades} 
                            initialPromotoras={promotoras} 
                        />
                    </div>
                </TabsContent>

                <TabsContent value="system" className="mt-0 focus-visible:outline-none">
                    <div className="animate-in fade-in-50 duration-500">
                        <SettingsClientPage initialConfig={config} mode="system" />
                    </div>
                </TabsContent>

                <TabsContent value="maintenance" className="mt-0 focus-visible:outline-none">
                    <div className="animate-in fade-in-50 duration-500">
                        <SettingsClientPage initialConfig={config} mode="maintenance" />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
