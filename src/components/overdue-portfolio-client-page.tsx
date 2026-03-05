'use client';

import { useState } from 'react';
import type { OverdueLoanDetails, } from '@/app/dashboard/overdue-portfolio/page';
import { Input } from '@/components/ui/input';
import { OverdueCard } from '@/components/overdue-card';
import type { Client, LoanPlan } from '@/lib/types';

interface OverduePortfolioClientPageProps {
    initialOverdueLoans: OverdueLoanDetails[];
    clients: Client[];
    loanPlans: LoanPlan[];
}

export function OverduePortfolioClientPage({ initialOverdueLoans, clients, loanPlans }: OverduePortfolioClientPageProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLoans = initialOverdueLoans.filter(details =>
        details.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details.client.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details.hierarchy.plazaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details.hierarchy.localidadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        details.hierarchy.promotoraName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalDue = filteredLoans.reduce((acc, details) => acc + details.amountDue, 0);
    const totalClients = new Set(filteredLoans.map(d => d.client.id)).size;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-destructive/80 text-destructive-foreground p-4 rounded-lg">
                    <div className="text-sm font-medium">Deuda Pendiente (Filtro)</div>
                    <div className="text-2xl font-bold">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalDue)}
                    </div>
                </div>
                <div className="bg-card text-card-foreground p-4 rounded-lg border">
                    <div className="text-sm font-medium">Total de Clientes (Filtro)</div>
                    <div className="text-2xl font-bold">{totalClients}</div>
                    <p className="text-xs text-muted-foreground">{initialOverdueLoans.length} cliente(s) en total</p>
                </div>
            </div>

            <div className="bg-card p-4 rounded-lg border">
                <h2 className="text-lg font-semibold mb-2">Lista de Pagos Pendientes</h2>
                <div className="mb-4">
                     <Input
                        placeholder="Buscar por nombre, dirección, plaza o promotora..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredLoans.length > 0 ? (
                        filteredLoans.map(details => (
                           <OverdueCard 
                                key={details.loan.id} 
                                details={details} 
                                allClients={clients}
                                allLoanPlans={loanPlans}
                           />
                        ))
                    ) : (
                        <p className="text-muted-foreground md:col-span-2 xl:col-span-3 text-center">
                            No hay clientes con pagos pendientes que coincidan con la búsqueda.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
