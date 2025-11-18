'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import Link from 'next/link';

interface ClientPageActionsProps {
    clientId: string;
}

export function ClientPageActions({ clientId }: ClientPageActionsProps) {
    const { appUser } = useAuth();
    
    if (!appUser) return null;

    const canEdit = appUser.role === 'admin' || (appUser.permissions && appUser.permissions.editClients);

    if (!canEdit) return null;

    return (
        <Button asChild>
            <Link href={`/dashboard/clients/${clientId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Cliente
            </Link>
        </Button>
    );
}
