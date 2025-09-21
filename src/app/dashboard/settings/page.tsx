import { SettingsClientPage } from "@/components/settings-client-page";
import { GroupsManagement } from "@/components/groups-management";
import { Separator } from "@/components/ui/separator";
import { getGroups, getSupervisors } from "@/lib/firestore-data";

export default async function SettingsPage() {
    const [groups, supervisors] = await Promise.all([
        getGroups(),
        getSupervisors()
    ]);
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
                <p className="text-muted-foreground">
                    Administra las configuraciones de tu aplicación.
                </p>
            </div>

            <GroupsManagement initialGroups={groups} initialSupervisors={supervisors} />

            <Separator />
            
            <SettingsClientPage />
        </div>
    );
}
