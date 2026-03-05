'use client';

import { useState, useMemo } from 'react';
import type { OverdueLoanDetails } from '@/app/dashboard/overdue-portfolio/page';
import { Input } from '@/components/ui/input';
import { OverdueCard } from '@/components/overdue-card';
import type { Client, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { generateColorPalette } from '@/lib/utils';

interface OverduePortfolioClientPageProps {
    initialOverdueLoans: OverdueLoanDetails[];
    clients: Client[];
    loanPlans: LoanPlan[];
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
}

export function OverduePortfolioClientPage({ 
    initialOverdueLoans, 
    clients, 
    loanPlans, 
    plazas, 
    localidades, 
    promotoras 
}: OverduePortfolioClientPageProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlaza, setSelectedPlaza] = useState('all');
    const [selectedLocalidad, setSelectedLocalidad] = useState('all');
    const [selectedPromotora, setSelectedPromotora] = useState('all');

    // Generate colors for plazas
    const plazaColors = useMemo(() => {
        const sortedPlazas = [...plazas].sort((a, b) => a.name.localeCompare(b.name));
        const colors = generateColorPalette(sortedPlazas.length);
        const map: Record<string, string> = {};
        sortedPlazas.forEach((p, i) => {
            map[p.id] = colors[i];
        });
        return map;
    }, [plazas]);

    // Hierarchical filter options
    const filteredLocalidadesOptions = useMemo(() => {
        let result = selectedPlaza === 'all' 
            ? localidades 
            : localidades.filter(l => l.plazaId === selectedPlaza);
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedPlaza, localidades]);

    const filteredPromotorasOptions = useMemo(() => {
        let result;
        if (selectedLocalidad === 'all') {
            if (selectedPlaza === 'all') {
                result = promotoras;
            } else {
                const plazaLocalidadIds = localidades.filter(l => l.plazaId === selectedPlaza).map(l => l.id);
                result = promotoras.filter(p => plazaLocalidadIds.includes(p.localidadId));
            }
        } else {
            result = promotoras.filter(p => p.localidadId === selectedLocalidad);
        }
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedLocalidad, selectedPlaza, promotoras, localidades]);

    // Apply filtering
    const filteredLoans = useMemo(() => {
        return initialOverdueLoans.filter(details => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                details.client.name.toLowerCase().includes(term) ||
                details.client.street.toLowerCase().includes(term) ||
                details.client.phone.includes(term) || // Búsqueda por teléfono
                details.hierarchy.plazaName.toLowerCase().includes(term) ||
                details.hierarchy.localidadName.toLowerCase().includes(term) ||
                details.hierarchy.promotoraName.toLowerCase().includes(term);

            const matchesPlaza = selectedPlaza === 'all' || details.hierarchy.plazaId === selectedPlaza;
            const matchesLocalidad = selectedLocalidad === 'all' || details.hierarchy.localidadId === selectedLocalidad;
            const matchesPromotora = selectedPromotora === 'all' || details.hierarchy.promotoraId === selectedPromotora;

            return matchesSearch && matchesPlaza && matchesLocalidad && matchesPromotora;
        });
    }, [initialOverdueLoans, searchTerm, selectedPlaza, selectedLocalidad, selectedPromotora]);

    const totalDue = filteredLoans.reduce((acc, details) => acc + details.amountDue, 0);
    const totalClients = new Set(filteredLoans.map(d => d.client.id)).size;

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedPlaza('all');
        setSelectedLocalidad('all');
        setSelectedPromotora('all');
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="bg-destructive/80 text-white p-4 rounded-lg shadow-sm border border-destructive">
                    <div className="text-xs font-bold uppercase tracking-wider opacity-80">Deuda Pendiente (Filtro)</div>
                    <div className="text-2xl font-bold">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalDue)}
                    </div>
                </div>
                <div className="bg-card text-card-foreground p-4 rounded-lg border shadow-sm">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total de Clientes (Filtro)</div>
                    <div className="text-2xl font-bold">{totalClients}</div>
                    <p className="text-[10px] text-muted-foreground uppercase">{initialOverdueLoans.length} clientes en total</p>
                </div>
            </div>

            <div className="bg-card p-4 rounded-lg border shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Buscar Cliente</label>
                        <Input
                            placeholder="Nombre, dirección o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div className="w-full md:w-[180px] space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Plaza</label>
                        <Select value={selectedPlaza} onValueChange={(v) => { setSelectedPlaza(v); setSelectedLocalidad('all'); setSelectedPromotora('all'); }}>
                            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {[...plazas].sort((a,b) => a.name.localeCompare(b.name)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-[180px] space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Localidad</label>
                        <Select value={selectedLocalidad} onValueChange={(v) => { setSelectedLocalidad(v); setSelectedPromotora('all'); }}>
                            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {filteredLocalidadesOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-[180px] space-y-1">
                        <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Promotora</label>
                        <Select value={selectedPromotora} onValueChange={setSelectedPromotora}>
                            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                {filteredPromotorasOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={clearFilters} disabled={searchTerm === '' && selectedPlaza === 'all' && selectedLocalidad === 'all' && selectedPromotora === 'all'}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
                    {filteredLoans.length > 0 ? (
                        filteredLoans.map(details => (
                           <OverdueCard 
                                key={details.loan.id} 
                                details={details} 
                                allClients={clients}
                                allLoanPlans={loanPlans}
                                plazaColor={plazaColors[details.hierarchy.plazaId] || '#666'}
                           />
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/30">
                            <p className="text-muted-foreground font-medium">
                                No hay clientes con pagos pendientes que coincidan con la búsqueda o filtros.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
