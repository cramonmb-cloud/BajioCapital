'use client';

import { useState, useMemo, useEffect } from 'react';
import { PlusCircle, ChevronLeft, ChevronRight, List, Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

const ITEMS_PER_PAGE = 20;

interface ClientsClientPageProps {
    initialClients: Client[];
    initialLoans: Loan[];
}

export function ClientsClientPage({ initialClients, initialLoans }: ClientsClientPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);

    const filteredClients = useMemo(() => {
        if (!searchTerm) {
            return initialClients;
        }
        return initialClients.filter(client => 
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, initialClients]);

    const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

    const visibleClients = useMemo(() => {
        if (showAll) return filteredClients;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredClients.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredClients, currentPage, showAll]);

    // Reset to page 1 when searching
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const getClientLoanCount = (clientId: string) => {
        return initialLoans.filter(loan => loan.clientId === clientId).length;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle>Lista de Clientes</CardTitle>
                        <CardDescription>
                            {searchTerm 
                                ? `Mostrando ${filteredClients.length} de ${initialClients.length} clientes.`
                                : `Un total de ${initialClients.length} clientes registrados.`
                            }
                        </CardDescription>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            setShowAll(!showAll);
                            setCurrentPage(1);
                        }}
                        className="gap-2"
                    >
                        <List className="h-4 w-4" />
                        {showAll ? "Ver paginado" : "Mostrar todo"}
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <Input 
                            placeholder="Buscar cliente por nombre o dirección..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm uppercase"
                        />
                    </div>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="hidden md:table-cell">Dirección</TableHead>
                            <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                            <TableHead>Préstamos</TableHead>
                            <TableHead>
                            <span className="sr-only">Acciones</span>
                            </TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {visibleClients.map((client) => (
                            <TableRow key={client.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                                    <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Link href={`/dashboard/clientes/${client.id}`} className="hover:underline uppercase font-bold text-xs">
                                    {client.name}
                                </Link>
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground uppercase text-[10px] font-medium">
                                {client.street}, {client.neighborhood}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{client.phone}</TableCell>
                            <TableCell className="text-xs font-bold">{getClientLoanCount(client.id)}</TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase">
                                    <Link href={`/dashboard/clientes/${client.id}`}>Ver detalles</Link>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        {visibleClients.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron clientes que coincidan con la búsqueda.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
                {!showAll && totalPages > 1 && (
                    <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {visibleClients.length} de {filteredClients.length} clientes
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">
                                Página {currentPage} de {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardFooter>
                )}
                {showAll && filteredClients.length > ITEMS_PER_PAGE && (
                    <CardFooter className="py-4 border-t justify-center">
                        <p className="text-sm text-muted-foreground font-medium">
                            Mostrando lista completa ({filteredClients.length} clientes)
                        </p>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}