import { SettingsClientPage } from "@/components/settings-client-page";
import { PlazaManagement } from "@/components/plaza-management";
import { UserManagement } from "@/components/user-management";
import { Separator } from "@/components/ui/separator";
import { getPlazas, getLocalidades, getPromotoras, getUsers } from "@/lib/firestore-data";

export default async function SettingsPage() {
    const [plazas, localidades, promotoras, users] = await Promise.all([
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
        getUsers(),
    ]);
    
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
                <p className="text-muted-foreground">
                    Administra las configuraciones de tu aplicación.
                </p>
            </div>

            <UserManagement users={users} />

            <Separator />

            <PlazaManagement 
                initialPlazas={plazas} 
                initialLocalidades={localidades} 
                initialPromotoras={promotoras} 
            />

            <Separator />
            
            <SettingsClientPage />
        </div>
    );
}
