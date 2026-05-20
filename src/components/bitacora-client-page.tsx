'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { AppUser, Wallet, WalletTransaction, Client } from "@/lib/types";

const ITEMS_PER_PAGE = 40;

interface BitacoraClientPageProps {
    wallet: Wallet;
    transactions: WalletTransaction[];
    clients: Client[];
    users: AppUser[];
}

export function BitacoraClientPage({ wallet, transactions, clients, users }: BitacoraClientPageProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return transactions.slice(start, start + ITEMS_PER_PAGE);
    }, [transactions, currentPage]);

    const getClientName = (clientId?: string) => {
        if (!clientId) return 'N/A';
        return clients.find(c => c.id === clientId)?.name || 'Cliente Desconocido';
    }

    const getUserName = (userId?: string) => {
        if (!userId) return 'Sistema';
        return users.find(u => u.id === userId)?.username || 'Usuario Desconocido';
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('es-MX', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bitácora</h1>
                <p className="text-muted-foreground">
                    Administra el flujo de dinero de tu negocio.
                </p>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Saldo Actual
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(wallet.balance)}</div>
                    <p className="text-xs text-muted-foreground">
                        Dinero total disponible.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Movimientos</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Tipo</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="pr-6">Usuario</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedTransactions.length > 0 ? (
                                paginatedTransactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="pl-6">
                                            <Badge variant={tx.type === 'credit' ? 'secondary' : 'destructive'}>
                                                {tx.type === 'credit' ? 
                                                    <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" /> : 
                                                    <ArrowDownLeft className="mr-1 h-3 w-3 text-red-500" />
                                                }
                                                {tx.type === 'credit' ? 'Ingreso' : 'Egreso'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`font-medium ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(tx.amount)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>
                                            {tx.clientId ? (
                                                <Link href={`/dashboard/clients/${tx.clientId}`} className="text-primary hover:underline uppercase text-xs font-bold">
                                                    {getClientName(tx.clientId)}
                                                </Link>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground pr-6 uppercase text-[10px] font-bold">{getUserName(tx.userId)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No hay movimientos registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex items-center justify-between py-4 border-t px-6">
                        <div className="text-sm text-muted-foreground">
                            Mostrando registros {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} de {transactions.length}
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">Página {currentPage} de {totalPages}</span>
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
            </Card>
        </div>
    );
}
