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
import { useRealtimeData } from '@/hooks/use-realtime-data';

interface OverduePortfolioClientPageProps {
    initialOverdueLoans: OverdueLoanDetails[];
    clients: Client[];
    loanPlans: LoanPlan[];
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
    title: string;
}

export function OverduePortfolioClientPage({ 
    initialOverdueLoans, 
    clients, 
    loanPlans, 
    plazas, 
    localidades, 
    promotoras,
    title
}: OverduePortfolioClientPageProps) {
    const { data } = useRealtimeData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlaza, setSelectedPlaza] = useState('all');
    const [selectedLocalidad, setSelectedLocalidad] = useState('all');
    const [selectedPromotora, setSelectedPromotora] = useState('all');

    const isOverduePortfolio = title === "Pagos Pendientes";
    const globalDebtLabel = isOverduePortfolio ? "Acumulado de Fallos (Filtro)" : "Deuda Pendiente (Filtro)";

    const appConfig = data?.config;

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
                details.client.phone.includes(term) || 
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
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                <div className="bg-destructive/80 text-white p-3 rounded-lg shadow-sm border border-destructive">
                    <div className="text-[9px] font-black uppercase tracking-wider opacity-80">{globalDebtLabel}</div>
                    <div className="text-lg font-black">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalDue)}
                    </div>
                </div>
                <div className="bg-card text-card-foreground p-3 rounded-lg border shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Clientes (Filtro)</div>
                    <div className="text-lg font-black">{totalClients}</div>
                    <p className="text-[8px] text-muted-foreground uppercase">{initialOverdueLoans.length} total histórico</p>
                </div>
            </div>

            <div className="bg-card p-3 rounded-lg border shadow-sm space-y-3">
                <div className="flex flex-col gap-3">
                    <div className="w-full space-y-1">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Buscar</label>
                        <div className="relative">
                            <Input
                                placeholder="Nombre, calle o teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 text-xs"
                            />
                            {searchTerm && (
                                <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Plaza</label>
                            <Select value={selectedPlaza} onValueChange={(v) => { setSelectedPlaza(v); setSelectedLocalidad('all'); setSelectedPromotora('all'); }}>
                                <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {[...plazas].sort((a,b) => a.name.localeCompare(b.name)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Zona</label>
                            <Select value={selectedLocalidad} onValueChange={(v) => { setSelectedLocalidad(v); setSelectedPromotora('all'); }}>
                                <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {filteredLocalidadesOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Ruta</label>
                            <Select value={selectedPromotora} onValueChange={setSelectedPromotora}>
                                <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {filteredPromotorasOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-1 pt-1">
                    {filteredLoans.length > 0 ? (
                        filteredLoans.map(details => (
                           <OverdueCard 
                                key={details.loan.id} 
                                details={details} 
                                allClients={clients}
                                allLoanPlans={loanPlans}
                                plazaColor={plazaColors[details.hierarchy.plazaId] || '#666'}
                                isOverduePortfolio={isOverduePortfolio}
                                whatsappTemplate={appConfig?.whatsappTemplate}
                                appName={appConfig?.appName}
                           />
                        ))
                    ) : (
                        <div className="col-span-full py-8 text-center border-2 border-dashed rounded-lg bg-muted/20">
                            <p className="text-[11px] text-muted-foreground font-black uppercase">
                                Sin resultados para estos filtros
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
