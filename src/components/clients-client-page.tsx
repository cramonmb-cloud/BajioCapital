'use client';

import { useState, useMemo } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import type { Client, Loan } from '@/lib/types';
import { Input } from './ui/input';

interface ClientsClientPageProps {
    initialClients: Client[];
    initialLoans: Loan[];
}

export function ClientsClientPage({ initialClients, initialLoans }: ClientsClientPageProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClients = useMemo(() => {
        if (!searchTerm) {
            return initialClients;
        }
        return initialClients.filter(client => 
            client.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, initialClients]);

    const getClientLoanCount = (clientId: string) => {
        return initialLoans.filter(loan => loan.clientId === clientId).length;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
                <p className="text-muted-foreground">
                    Administra tus clientes y su información.
                </p>
                </div>
                <Button disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Registrar Cliente
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Clientes</CardTitle>
                    <CardDescription>
                        {searchTerm 
                            ? `Mostrando ${filteredClients.length} de ${initialClients.length} clientes.`
                            : `Un total de ${initialClients.length} clientes registrados.`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <Input 
                            placeholder="Buscar cliente por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="hidden md:table-cell">Email</TableHead>
                            <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                            <TableHead>Préstamos</TableHead>
                            <TableHead>
                            <span className="sr-only">Acciones</span>
                            </TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredClients.map((client) => (
                            <TableRow key={client.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                                    <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                                    {client.name}
                                </Link>
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{client.email}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone}</TableCell>
                            <TableCell>{getClientLoanCount(client.id)}</TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/dashboard/clients/${client.id}`}>Ver detalles</Link>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        {filteredClients.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron clientes que coincidan con la búsqueda.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
