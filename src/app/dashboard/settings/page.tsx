import { SettingsClientPage } from "@/components/settings-client-page";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Ajustes</h1>
                <p className="text-muted-foreground">
                    Administra las configuraciones de tu aplicación.
                </p>
            </div>
            <SettingsClientPage />
        </div>
    );
}
