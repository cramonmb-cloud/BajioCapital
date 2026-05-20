'use client';

import { useRealtimeData } from "@/hooks/use-realtime-data";
import { UserManagement } from "@/components/user-management";
import { PlazaManagement } from "@/components/plaza-management";
import { SettingsClientPage } from "@/components/settings-client-page";
import { PlanManagement } from "@/components/plan-management";
import { MigrationManagement } from "@/components/migration-management";
import { SupervisorAppSync } from "@/components/supervisor-app-sync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MapPin, Settings as SettingsIcon, Wrench, FileText, ArrowRightLeft, CloudDownload } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Loading from "../loading";
import { useMemo } from "react";

export default function SettingsPage() {
    const { data, loading } = useRealtimeData();
    const { appUser } = useAuth();

    const permissions = useMemo(() => {
        if (!appUser) return null;
        
        const isCristobal = appUser.username.toUpperCase() === 'CRISTOBAL';

        if (appUser.role === 'admin' || isCristobal) {
            return {
                users: true,
                zones: true,
                migration: true,
                plans: true,
                system: true,
                maintenance: true,
                sync: true
            };
        }
        return {
            users: appUser.permissions?.manageUsers || appUser.permissions?.settings,
            zones: appUser.permissions?.manageZones || appUser.permissions?.settings,
            migration: appUser.permissions?.manageMigration || appUser.permissions?.settings,
            plans: appUser.permissions?.managePlans || appUser.permissions?.settings,
            system: appUser.permissions?.manageSystem || appUser.permissions?.settings,
            maintenance: appUser.permissions?.manageMaintenance || appUser.permissions?.settings,
            sync: appUser.permissions?.manageSystem || appUser.permissions?.settings
        };
    }, [appUser]);

    if (loading || !data || !permissions) {
        return <Loading />;
    }

    const { plazas, localidades, promotoras, users, config, loanPlans } = data;

    // Find the first allowed tab to set as default
    const defaultTab = permissions.users ? "users" : 
                     permissions.zones ? "zones" : 
                     permissions.migration ? "migration" :
                     permissions.plans ? "plans" :
                     permissions.sync ? "sync" :
                     permissions.system ? "system" : "maintenance";
    
    return (
        <div className="container mx-auto space-y-8 py-6">
            <div className="flex flex-col gap-2 border-b pb-6">
                <h1 className="text-4xl font-extrabold tracking-tight">Ajustes del Sistema</h1>
                <p className="text-lg text-muted-foreground">
                    Administra los parámetros operativos y de seguridad de la plataforma.
                </p>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-8">
                <div className="flex justify-center md:justify-start">
                    <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-full md:w-auto overflow-x-auto">
                        {permissions.users && (
                            <TabsTrigger value="users" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                <Users className="h-4 w-4" />
                                <span className="hidden sm:inline">Personal</span>
                            </TabsTrigger>
                        )}
                        {permissions.zones && (
                            <TabsTrigger value="zones" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                <MapPin className="h-4 w-4" />
                                <span className="hidden sm:inline">Localidades y Promotoras</span>
                            </TabsTrigger>
                        )}
                        {permissions.migration && (
                            <TabsTrigger value="migration" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                <ArrowRightLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Migración</span>
                            </TabsTrigger>
                        )}
                        {permissions.plans && (
                            <TabsTrigger value="plans" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                <FileText className="h-4 w-4" />
                                <span className="hidden sm:inline">Planes</span>
                            </TabsTrigger>
                        )}
                        {permissions.sync && (
                            <TabsTrigger value="sync" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-blue-600">
                                <CloudDownload className="h-4 w-4" />
                                <span className="hidden sm:inline">Sincronización</span>
                            </TabsTrigger>
                        )}
                        {permissions.system && (
                            <TabsTrigger value="system" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                <SettingsIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Personalización</span>
                            </TabsTrigger>
                        )}
                        {permissions.maintenance && (
                            <TabsTrigger value="maintenance" className="flex items-center gap-2 px-6 py-2 transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-destructive data-[state=active]:text-destructive">
                                <Wrench className="h-4 w-4" />
                                <span className="hidden sm:inline">Mantenimiento</span>
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {permissions.users && (
                    <TabsContent value="users" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <UserManagement users={users} />
                        </div>
                    </TabsContent>
                )}

                {permissions.zones && (
                    <TabsContent value="zones" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <PlazaManagement 
                                initialPlazas={plazas} 
                                initialLocalidades={localidades} 
                                initialPromotoras={promotoras} 
                            />
                        </div>
                    </TabsContent>
                )}

                {permissions.migration && (
                    <TabsContent value="migration" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <MigrationManagement 
                                initialPlazas={plazas} 
                                initialLocalidades={localidades} 
                                initialPromotoras={promotoras} 
                            />
                        </div>
                    </TabsContent>
                )}

                {permissions.plans && (
                    <TabsContent value="plans" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <PlanManagement initialLoanPlans={loanPlans} />
                        </div>
                    </TabsContent>
                )}

                {permissions.sync && (
                    <TabsContent value="sync" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <SupervisorAppSync 
                                plazas={plazas} 
                                localidades={localidades} 
                                promotoras={promotoras} 
                                loanPlans={loanPlans} 
                            />
                        </div>
                    </TabsContent>
                )}

                {permissions.system && (
                    <TabsContent value="system" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <SettingsClientPage initialConfig={config} mode="system" />
                        </div>
                    </TabsContent>
                )}

                {permissions.maintenance && (
                    <TabsContent value="maintenance" className="mt-0 focus-visible:outline-none">
                        <div className="animate-in fade-in-50 duration-500">
                            <SettingsClientPage initialConfig={config} mode="maintenance" />
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
