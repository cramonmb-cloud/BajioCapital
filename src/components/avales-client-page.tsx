'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { Client, Loan, LoanPlan } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  List,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  UserCheck,
  CircleDot,
  FileSpreadsheet,
  Link2,
  Users
} from 'lucide-react';
import Link from 'next/link';

const ITEMS_PER_PAGE = 15;

interface AvalesClientPageProps {
  initialClients: Client[];
  initialLoans: Loan[];
  initialPlans: LoanPlan[];
}

export interface ParsedEndorser {
  name: string;
  normName: string;
  street: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  phone: string;
  guarantees: string;
  clientsBacked: {
    id: string;
    name: string;
    phone: string;
    hasActiveLoan: boolean;
    activeLoans: Loan[];
  }[];
  selfClientId: string;
  selfHasActiveLoan: boolean;
  selfActiveLoans: Loan[];
  backedClientsCount: number;
  isLinkedToActiveLoan: boolean;
}

// Robust function to parse composite endorsement string: "NAME (STREET, NEIGHBORHOOD, CP, CITY, Tel: PHONE, Garantía: GUARANTEES)"
function parseEndorsement(endorsementStr: string) {
  if (!endorsementStr) {
    return { name: '', street: '', neighborhood: '', postalCode: '', city: '', phone: '', guarantees: '' };
  }

  const parts = endorsementStr.split('(');
  const name = parts[0].trim();

  if (parts.length < 2) {
    return { name, street: '', neighborhood: '', postalCode: '', city: '', phone: '', guarantees: '' };
  }

  // Content inside parenthesis
  const inside = parts.slice(1).join('(').replace(/\)$/, '').trim();

  // Extract phone (Tel: ...)
  let phone = '';
  const phoneMatch = inside.match(/Tel:\s*([^,]+)/i);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }

  // Extract guarantees (Garantía: ...)
  let guarantees = '';
  const guaranteesMatch = inside.match(/Garantía:\s*(.+)$/i);
  if (guaranteesMatch) {
    guarantees = guaranteesMatch[1].trim();
  }

  // Clean remaining address parts
  let addressText = inside;
  if (phoneMatch) addressText = addressText.replace(phoneMatch[0], '');
  if (guaranteesMatch) addressText = addressText.replace(guaranteesMatch[0], '');

  const addressParts = addressText
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '' && !p.toUpperCase().startsWith('TEL:') && !p.toUpperCase().startsWith('GARANTÍA:'));

  let street = addressParts[0] || '';
  let neighborhood = addressParts[1] || '';
  let postalCode = addressParts[2] || '';
  let city = addressParts[3] || '';

  if (postalCode && !/^\d+$/.test(postalCode) && !city) {
    city = postalCode;
    postalCode = '';
  }

  return { name, street, neighborhood, postalCode, city, phone, guarantees };
}

export function AvalesClientPage({ initialClients, initialLoans, initialPlans }: AvalesClientPageProps) {
  const { appUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'linked-active' | 'self-active' | 'multiple' | 'clean'>('all');
  const [backedClientsFilter, setBackedClientsFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  const handleLoanClick = (loan: Loan, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expand
    setSelectedLoan(loan);
    setIsLoanModalOpen(true);
  };

  // Parse and group all endorsers
  const endorsers = useMemo(() => {
    const grouped: Record<string, ParsedEndorser> = {};

    initialClients.forEach(client => {
      if (!client.endorsement || !client.endorsement.trim()) return;

      const parsed = parseEndorsement(client.endorsement);
      if (!parsed.name) return;

      const normName = parsed.name.trim().toUpperCase();

      // Check if client has active loans (Active or Overdue)
      const clientActiveLoans = initialLoans.filter(
        l => l.clientId === client.id && (l.status === 'Active' || l.status === 'Overdue')
      );
      const clientHasActiveLoan = clientActiveLoans.length > 0;

      const backedClientInfo = {
        id: client.id,
        name: client.name,
        phone: client.phone,
        hasActiveLoan: clientHasActiveLoan,
        activeLoans: clientActiveLoans
      };

      if (!grouped[normName]) {
        grouped[normName] = {
          name: parsed.name,
          normName,
          street: parsed.street,
          neighborhood: parsed.neighborhood,
          postalCode: parsed.postalCode,
          city: parsed.city,
          phone: parsed.phone,
          guarantees: parsed.guarantees,
          clientsBacked: clientHasActiveLoan ? [backedClientInfo] : [],
          selfClientId: '',
          selfHasActiveLoan: false,
          selfActiveLoans: [],
          backedClientsCount: clientHasActiveLoan ? 1 : 0,
          isLinkedToActiveLoan: clientHasActiveLoan
        };
      } else {
        const existing = grouped[normName];
        
        // Consolidate details to keep the most complete data
        if (!existing.phone && parsed.phone) existing.phone = parsed.phone;
        if (!existing.street && parsed.street) existing.street = parsed.street;
        if (!existing.neighborhood && parsed.neighborhood) existing.neighborhood = parsed.neighborhood;
        if (!existing.postalCode && parsed.postalCode) existing.postalCode = parsed.postalCode;
        if (!existing.city && parsed.city) existing.city = parsed.city;
        if (!existing.guarantees && parsed.guarantees) existing.guarantees = parsed.guarantees;

        // Prevent duplicate backed clients and only add if they have an active loan
        if (clientHasActiveLoan) {
          if (!existing.clientsBacked.some(c => c.id === client.id)) {
            existing.clientsBacked.push(backedClientInfo);
          }
        }

        existing.backedClientsCount = existing.clientsBacked.length;
        existing.isLinkedToActiveLoan = existing.isLinkedToActiveLoan || clientHasActiveLoan;
      }
    });

    // Match endorsers with their own loans if they exist as clients
    Object.keys(grouped).forEach(normName => {
      const endorser = grouped[normName];
      const matchingClient = initialClients.find(c => c.name.trim().toUpperCase() === normName);
      if (matchingClient) {
        endorser.selfClientId = matchingClient.id;
        endorser.selfActiveLoans = initialLoans.filter(
          l => l.clientId === matchingClient.id && (l.status === 'Active' || l.status === 'Overdue')
        );
        endorser.selfHasActiveLoan = endorser.selfActiveLoans.length > 0;
      }
    });

    return Object.values(grouped);
  }, [initialClients, initialLoans]);

  // Statistics
  const stats = useMemo(() => {
    const total = endorsers.length;
    const linkedActive = endorsers.filter(e => e.isLinkedToActiveLoan).length;
    const selfActive = endorsers.filter(e => e.selfHasActiveLoan).length;
    const multiple = endorsers.filter(e => e.backedClientsCount >= 2).length;

    return { total, linkedActive, selfActive, multiple };
  }, [endorsers]);

  // Search and filter
  const filteredEndorsers = useMemo(() => {
    return endorsers.filter(e => {
      // Search term
      const matchesSearch = 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.phone.includes(searchTerm) ||
        `${e.street} ${e.neighborhood} ${e.city}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.guarantees.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Backed clients filter
      if (backedClientsFilter === '1' && e.backedClientsCount !== 1) return false;
      if (backedClientsFilter === '2' && e.backedClientsCount !== 2) return false;
      if (backedClientsFilter === '3' && e.backedClientsCount !== 3) return false;
      if (backedClientsFilter === '4+' && e.backedClientsCount < 4) return false;

      // Filter type
      if (filterType === 'linked-active') return e.isLinkedToActiveLoan;
      if (filterType === 'self-active') return e.selfHasActiveLoan;
      if (filterType === 'multiple') return e.backedClientsCount >= 2;
      if (filterType === 'clean') return !e.isLinkedToActiveLoan && !e.selfHasActiveLoan;

      return true;
    });
  }, [endorsers, searchTerm, filterType, backedClientsFilter]);

  const totalPages = Math.ceil(filteredEndorsers.length / ITEMS_PER_PAGE);

  const visibleEndorsers = useMemo(() => {
    if (showAll) return filteredEndorsers;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEndorsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEndorsers, currentPage, showAll]);

  // Reset page when criteria changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, backedClientsFilter]);

  const toggleExpand = (normName: string) => {
    setExpandedId(prev => (prev === normName ? null : normName));
  };

  const hasAccess = appUser?.role === 'admin' || appUser?.permissions?.avales;

  if (!hasAccess) {
    return (
      <div className="flex h-[60vh] items-center justify-center p-4">
        <Card className="max-w-[420px] w-full text-center border-red-200 shadow-lg shadow-red-500/5 bg-white/80 backdrop-blur">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-2 animate-bounce">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg font-black uppercase text-red-600">Acceso Restringido</CardTitle>
            <CardDescription className="text-xs text-red-700/80">
              No tienes los permisos necesarios para consultar la sección de Avales del negocio. Contacta al administrador principal.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header section with micro-animation */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-indigo-600 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)] animate-pulse" />
            Administración de Avales
          </h1>
        </div>
      </div>

      {/* Grid of customized Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-zinc-500 bg-white/40 hover:bg-white/60 transition-all duration-300 shadow-sm relative overflow-hidden group">
          <div className="absolute right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <ShieldCheck className="h-20 w-20 text-zinc-900" />
          </div>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Avales Únicos</p>
              <h3 className="text-2xl font-black tracking-tight text-zinc-800">{stats.total}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 shadow-sm">
              <CircleDot className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-white/40 hover:bg-white/60 transition-all duration-300 shadow-sm relative overflow-hidden group">
          <div className="absolute right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <AlertCircle className="h-20 w-20 text-red-900" />
          </div>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Préstamos Avalados Activos</p>
              <h3 className="text-2xl font-black tracking-tight text-red-600">{stats.linkedActive}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shadow-sm">
              <Link2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 bg-white/40 hover:bg-white/60 transition-all duration-300 shadow-sm relative overflow-hidden group">
          <div className="absolute right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <UserCheck className="h-20 w-20 text-orange-900" />
          </div>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Con Préstamo Propio Activo</p>
              <h3 className="text-2xl font-black tracking-tight text-orange-600">{stats.selfActive}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-white/40 hover:bg-white/60 transition-all duration-300 shadow-sm relative overflow-hidden group">
          <div className="absolute right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Users className="h-20 w-20 text-indigo-900" />
          </div>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Avales Múltiples (2+)</p>
              <h3 className="text-2xl font-black tracking-tight text-indigo-600">{stats.multiple}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main content table card */}
      <Card className="shadow-md border-border/40 rounded-2xl overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/10 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-600">
              Listado de Avales
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
              {searchTerm 
                ? `Mostrando ${filteredEndorsers.length} de ${endorsers.length} avales encontrados.`
                : `Un total de ${endorsers.length} avales registrados en la cartera.`
              }
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowAll(!showAll);
                setCurrentPage(1);
              }}
              className="gap-2 h-9 text-xs font-bold uppercase rounded-xl border-border/60 hover:bg-indigo-50/20"
            >
              <List className="h-4 w-4" />
              {showAll ? "Paginado" : "Mostrar todo"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Search bar and Filters */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-grow max-w-2xl">
              <div className="relative flex-grow">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Buscar aval por nombre, teléfono, dirección o garantía..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 border-2 rounded-xl uppercase font-semibold text-xs tracking-wide focus-visible:ring-indigo-500 w-full"
                />
              </div>

              <div className="w-full sm:w-[220px] shrink-0">
                <Select value={backedClientsFilter} onValueChange={setBackedClientsFilter}>
                  <SelectTrigger className="h-10 text-xs border-2 uppercase font-bold rounded-xl focus:ring-indigo-500 bg-white">
                    <SelectValue placeholder="Clientes Respaldados" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-xs font-bold uppercase">Respaldados: Todos</SelectItem>
                    <SelectItem value="1" className="text-xs font-bold uppercase">Respaldados: 1 Cliente</SelectItem>
                    <SelectItem value="2" className="text-xs font-bold uppercase">Respaldados: 2 Clientes</SelectItem>
                    <SelectItem value="3" className="text-xs font-bold uppercase">Respaldados: 3 Clientes</SelectItem>
                    <SelectItem value="4+" className="text-xs font-bold uppercase">Respaldados: 4 o más</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                  filterType === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('linked-active')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                  filterType === 'linked-active'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/20'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                }`}
              >
                Aval Activo
              </button>
              <button
                onClick={() => setFilterType('self-active')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                  filterType === 'self-active'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/20'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200'
                }`}
              >
                Préstamo Propio Activo
              </button>
              <button
                onClick={() => setFilterType('multiple')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                  filterType === 'multiple'
                    ? 'bg-indigo-900 text-white border-indigo-900 shadow-sm shadow-indigo-900/20'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:border-indigo-100 hover:text-indigo-900'
                }`}
              >
                Aval Múltiple
              </button>
              <button
                onClick={() => setFilterType('clean')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-200 ${
                  filterType === 'clean'
                    ? 'bg-green-600 text-white border-green-600 shadow-sm shadow-green-600/20'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
                }`}
              >
                Sin Deudas
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3">Nombre del Aval</TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3">Dirección</TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3">Teléfono</TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3 text-center">Clientes Respaldados</TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3 text-center">Préstamo como Aval</TableHead>
                  <TableHead className="font-black text-[9px] uppercase tracking-widest text-muted-foreground py-3 text-center">Préstamo Propio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEndorsers.map((endorser) => {
                  const isExpanded = expandedId === endorser.normName;

                  return (
                    <Fragment key={endorser.normName}>
                      <TableRow 
                        key={endorser.normName} 
                        className={`hover:bg-indigo-50/5 cursor-pointer border-zinc-200/60 font-semibold transition-all ${
                          isExpanded ? 'bg-indigo-50/15' : ''
                        }`}
                        onClick={() => toggleExpand(endorser.normName)}
                      >
                        {/* Expand Icon */}
                        <TableCell className="text-center py-3">
                          {isExpanded ? (
                            <ChevronUp className="h-4.5 w-4.5 text-indigo-600" />
                          ) : (
                            <ChevronDown className="h-4.5 w-4.5 text-zinc-400 group-hover:text-indigo-600" />
                          )}
                        </TableCell>

                        {/* Name */}
                        <TableCell className="align-middle py-3">
                          <span className="text-xs font-black uppercase text-zinc-800 tracking-tight">
                            {endorser.name}
                          </span>
                        </TableCell>

                        {/* Address */}
                        <TableCell className="align-middle text-[10px] text-zinc-500 uppercase py-3 max-w-[200px] truncate leading-tight font-medium">
                          {endorser.street || endorser.neighborhood ? (
                            <span>{endorser.street}, {endorser.neighborhood}</span>
                          ) : (
                            <span className="italic opacity-60">Sin dirección registrada</span>
                          )}
                        </TableCell>

                        {/* Phone */}
                        <TableCell className="align-middle py-3">
                          {endorser.phone ? (
                            <Button 
                              asChild 
                              variant="ghost" 
                              className="h-7 px-2 text-[10px] font-black text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg shrink-0 gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={`tel:${endorser.phone.replace(/\D/g, '')}`}>
                                <Phone className="h-3 w-3" />
                                {endorser.phone}
                              </a>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-zinc-400 italic font-medium px-2">Sin teléfono</span>
                          )}
                        </TableCell>

                        {/* Clients Backed Count */}
                        <TableCell className="align-middle text-center py-3">
                          <Badge className={`h-5 px-2 text-[9px] font-black uppercase rounded-lg border ${
                            endorser.backedClientsCount >= 2
                              ? 'bg-indigo-900/10 text-indigo-900 border-indigo-200'
                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}>
                            {endorser.backedClientsCount} {endorser.backedClientsCount === 1 ? 'cliente' : 'clientes'}
                          </Badge>
                        </TableCell>

                        {/* Active loan as endorser */}
                        <TableCell className="align-middle text-center py-3">
                          {endorser.isLinkedToActiveLoan ? (
                            <Badge variant="destructive" className="h-5 px-2 text-[8px] font-black uppercase rounded-lg shadow-sm border border-red-200">
                              Activo / Adeudo
                            </Badge>
                          ) : (
                            <Badge className="h-5 px-2 text-[8px] font-black uppercase rounded-lg bg-green-50 text-green-700 border border-green-200 shadow-sm">
                              Libre
                            </Badge>
                          )}
                        </TableCell>

                        {/* Active loan as self */}
                        <TableCell className="align-middle text-center py-3">
                          {endorser.selfHasActiveLoan ? (
                            <Badge className="h-5 px-2 text-[8px] font-black uppercase rounded-lg bg-orange-50 text-orange-700 border border-orange-200 shadow-sm">
                              Activo
                            </Badge>
                          ) : endorser.selfClientId ? (
                            <Badge className="h-5 px-2 text-[8px] font-black uppercase rounded-lg bg-zinc-100 text-zinc-500 border border-zinc-200 shadow-sm">
                              Cliente sin adeudo
                            </Badge>
                          ) : (
                            <Badge className="h-5 px-2 text-[8px] font-black uppercase rounded-lg bg-zinc-50 text-zinc-400 border border-zinc-200/50 shadow-sm">
                              No es cliente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Collapsible Details Panel */}
                      {isExpanded && (
                        <TableRow className="bg-indigo-50/5 hover:bg-indigo-50/5">
                          <TableCell colSpan={7} className="p-0 border-b border-border/40">
                            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 animate-in fade-in slide-in-from-top-1 duration-200">
                              
                              {/* Left column: Full data breakdown */}
                              <div className="md:col-span-5 space-y-4">
                                <div className="space-y-3 bg-white p-4 rounded-xl border border-zinc-200/60 shadow-inner">
                                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    Ficha de Información
                                  </h4>

                                  <div className="space-y-2.5">
                                    <div className="flex gap-2.5 items-start">
                                      <MapPin className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-[8px] font-black uppercase text-zinc-400">Domicilio Registrado</p>
                                        <p className="text-[10px] font-bold uppercase text-zinc-800 leading-tight">
                                          {endorser.street ? `${endorser.street}` : ''}
                                          {endorser.neighborhood ? `, Col. ${endorser.neighborhood}` : ''}
                                          {endorser.postalCode ? `, C.P. ${endorser.postalCode}` : ''}
                                          {endorser.city ? `, ${endorser.city}` : ''}
                                          {!endorser.street && !endorser.neighborhood && !endorser.city && (
                                            <span className="italic opacity-60">Sin domicilio disponible</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    {endorser.phone && (
                                      <div className="flex gap-2.5 items-center">
                                        <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                                        <div>
                                          <p className="text-[8px] font-black uppercase text-zinc-400">Teléfono</p>
                                          <p className="text-[10px] font-bold text-zinc-800">{endorser.phone}</p>
                                        </div>
                                      </div>
                                    )}

                                    <div className="pt-2 border-t border-zinc-100 space-y-1">
                                      <p className="text-[8px] font-black uppercase text-zinc-400">Garantías Registradas del Aval</p>
                                      <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/60 min-h-[50px] text-[10px] font-bold text-zinc-700 whitespace-pre-wrap leading-relaxed">
                                        {endorser.guarantees ? endorser.guarantees.toUpperCase() : 'SIN GARANTÍA REGISTRADA PARA EL AVAL.'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right column: Backed clients & Self Status */}
                              <div className="md:col-span-7 space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm space-y-3">
                                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                    <Users className="h-4 w-4" />
                                    Clientes Avalados y Estado de Préstamos
                                  </h4>

                                  <div className="space-y-2">
                                    {endorser.clientsBacked.map(client => (
                                      <div key={client.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl border border-zinc-100 bg-zinc-50/50 hover:bg-zinc-50 transition-colors gap-2">
                                        <div className="space-y-0.5">
                                          <Link 
                                            href={`/dashboard/clientes/${client.id}`} 
                                            className="text-xs font-black text-indigo-600 hover:underline uppercase tracking-tight flex items-center gap-1"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {client.name}
                                          </Link>
                                          <p className="text-[9px] text-zinc-400 font-bold">Tel: {client.phone || 'Sin Teléfono'}</p>
                                        </div>

                                        <div className="flex gap-1.5 items-center">
                                          {client.hasActiveLoan ? (
                                            client.activeLoans.map(loan => (
                                              <Badge 
                                                key={loan.id} 
                                                variant="destructive" 
                                                className={`h-5 text-[8px] font-black uppercase rounded-lg px-2 shadow-sm cursor-pointer hover:opacity-90 transition-opacity ${
                                                  loan.status === 'Overdue' ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'
                                                }`}
                                                onClick={(e) => handleLoanClick(loan, e)}
                                              >
                                                Préstamo Activo: {formatCurrency(loan.amount)} ({loan.status === 'Overdue' ? 'Vencido' : 'Activo'})
                                              </Badge>
                                            ))
                                          ) : (
                                            <Badge className="h-5 text-[8px] font-black uppercase rounded-lg bg-green-50 text-green-700 border border-green-200 shadow-sm px-2">
                                              Préstamos Liquidados / Ninguno
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Self Loan Status Details if any */}
                                {endorser.selfClientId && (
                                  <div className="bg-white p-4 rounded-xl border border-zinc-200/60 shadow-sm space-y-3">
                                    <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                      <UserCheck className="h-4 w-4" />
                                      Expediente Propio como Cliente
                                    </h4>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl border border-zinc-100 bg-orange-50/10 gap-2">
                                      <div className="space-y-0.5">
                                        <Link 
                                          href={`/dashboard/clientes/${endorser.selfClientId}`} 
                                          className="text-xs font-black text-orange-600 hover:underline uppercase tracking-tight"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          Ver Ficha del Cliente {endorser.name}
                                        </Link>
                                        <p className="text-[8px] font-bold text-zinc-400">ID Cliente: {endorser.selfClientId}</p>
                                      </div>

                                      <div className="flex gap-1.5 items-center">
                                        {endorser.selfHasActiveLoan ? (
                                          endorser.selfActiveLoans.map(loan => (
                                            <Badge 
                                              key={loan.id} 
                                              className="h-5 text-[8px] font-black uppercase rounded-lg bg-orange-600 text-white shadow-sm px-2 cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={(e) => handleLoanClick(loan, e)}
                                            >
                                              Préstamo Activo: {formatCurrency(loan.amount)}
                                            </Badge>
                                          ))
                                        ) : (
                                          <Badge className="h-5 text-[8px] font-black uppercase rounded-lg bg-zinc-100 text-zinc-600 border border-zinc-200 shadow-sm px-2">
                                            Sin deudas propias activas
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {visibleEndorsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-xs font-bold uppercase text-zinc-400">
                      No se encontraron avales que coincidan con la búsqueda o filtro seleccionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* Pagination */}
        {!showAll && totalPages > 1 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t border-border/10">
            <div className="text-xs font-black uppercase text-muted-foreground">
              Mostrando {visibleEndorsers.length} de {filteredEndorsers.length} avales
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs font-black uppercase text-zinc-600">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl h-9 text-xs font-bold uppercase border-border/60"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl h-9 text-xs font-bold uppercase border-border/60"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
        {showAll && filteredEndorsers.length > ITEMS_PER_PAGE && (
          <CardFooter className="py-4 border-t border-border/10 justify-center">
            <p className="text-xs font-black uppercase text-muted-foreground">
              Mostrando lista completa ({filteredEndorsers.length} avales)
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Modal para detalles del préstamo */}
      <Dialog open={isLoanModalOpen} onOpenChange={setIsLoanModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl w-full max-h-[85vh] flex flex-col bg-white">
          {selectedLoan && (() => {
            const client = initialClients.find(c => c.id === selectedLoan.clientId);
            const plan = initialPlans.find(p => p.id === selectedLoan.loanPlanId);
            const weeklyPayment = plan ? (selectedLoan.amount / 1000) * plan.weeklyPaymentRate : 0;
            const term = plan?.termInWeeks || 16;
            
            const totalPaid = (selectedLoan.payments || []).reduce((sum, p) => sum + p.amount, 0);
            
            // Calculate elapsed weeks
            const elapsedDays = Math.round((new Date().getTime() - new Date(selectedLoan.startDate).getTime()) / (1000 * 3600 * 24));
            const rawCurrentWeek = Math.max(1, Math.floor((elapsedDays - 1) / 7) + 1);
            
            // Missed payments count
            let missedCount = 0;
            for (let i = 1; i <= term; i++) {
              const p = (selectedLoan.payments || []).find(pay => pay.weekNumber === i);
              if (!p && i < rawCurrentWeek) {
                missedCount++;
              } else if (p && p.amount < weeklyPayment) {
                missedCount++;
              }
            }

            const totalExpectedBase = term * weeklyPayment;
            const remainingBase = Math.max(0, totalExpectedBase - totalPaid);

            return (
              <>
                <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between bg-zinc-50/50">
                  <div>
                    <DialogTitle className="text-base font-black uppercase tracking-tight text-zinc-900">
                      Detalle del Préstamo
                    </DialogTitle>
                    <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                      Información esencial y estado de cobranza
                    </DialogDescription>
                  </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* General Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 text-center">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Cliente</p>
                      <p className="text-[11px] font-black text-zinc-800 uppercase truncate">{client?.name || 'Desconocido'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 text-center">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Monto</p>
                      <p className="text-[11px] font-black text-zinc-800">{formatCurrency(selectedLoan.amount)}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 text-center">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Plan / Plazo</p>
                      <p className="text-[11px] font-black text-zinc-800 uppercase">{plan?.name || `${term} Semanas`}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50 text-center">
                      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-wider mb-0.5">Estado</p>
                      <Badge className={`h-5 text-[8px] font-black uppercase rounded-lg px-2 mt-0.5 ${
                        selectedLoan.status === 'Overdue' ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'
                      }`}>
                        {selectedLoan.status === 'Overdue' ? 'Vencido' : 'Activo'}
                      </Badge>
                    </div>
                  </div>

                  {/* financial summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-50/50 p-4 rounded-xl border border-zinc-200/50">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-zinc-400 uppercase">Abono Semanal</span>
                      <span className="text-sm font-black text-zinc-700">{formatCurrency(weeklyPayment)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-zinc-400 uppercase">Total Cobrado</span>
                      <span className="text-sm font-black text-green-700">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-zinc-400 uppercase">Restante Base</span>
                      <span className="text-sm font-black text-red-700">{formatCurrency(remainingBase)}</span>
                    </div>
                  </div>

                  {/* Payments history */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest border-b border-zinc-100 pb-2">
                      Historial de Semanas ({selectedLoan.payments?.length || 0} de {term} pagadas)
                    </h4>

                    <div className="max-h-[200px] overflow-y-auto rounded-xl border border-zinc-200">
                      <Table>
                        <TableHeader className="bg-zinc-50">
                          <TableRow>
                            <TableHead className="py-2 text-[8px] font-black uppercase text-center w-[60px]">Semana</TableHead>
                            <TableHead className="py-2 text-[8px] font-black uppercase">Fecha de Pago</TableHead>
                            <TableHead className="py-2 text-[8px] font-black uppercase text-right">Importe</TableHead>
                            <TableHead className="py-2 text-[8px] font-black uppercase text-center w-[100px]">Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from({ length: term }).map((_, i) => {
                            const weekNum = i + 1;
                            const payment = (selectedLoan.payments || []).find(p => p.weekNumber === weekNum);
                            
                            let statusText = 'Pendiente';
                            let statusColor = 'bg-zinc-100 text-zinc-500 border-zinc-200';
                            
                            if (payment) {
                              if (payment.amount >= weeklyPayment) {
                                statusText = 'Pagado';
                                statusColor = 'bg-green-50 text-green-700 border-green-200';
                              } else if (payment.amount > 0) {
                                statusText = 'Incompleto';
                                statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
                              } else {
                                statusText = 'Fallo';
                                statusColor = 'bg-red-50 text-red-700 border-red-200';
                              }
                            } else if (weekNum < rawCurrentWeek) {
                              statusText = 'Fallo';
                              statusColor = 'bg-red-50 text-red-700 border-red-200';
                            }

                            return (
                              <TableRow key={weekNum} className="hover:bg-zinc-50/50 text-[10px] font-bold text-zinc-700">
                                <TableCell className="text-center py-2">{weekNum}</TableCell>
                                <TableCell className="py-2">
                                  {payment ? new Date(payment.date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                </TableCell>
                                <TableCell className="text-right py-2">
                                  {payment ? formatCurrency(payment.amount) : '-'}
                                </TableCell>
                                <TableCell className="text-center py-2">
                                  <Badge className={`h-4.5 px-1.5 text-[8px] font-black uppercase rounded-lg border ${statusColor}`}>
                                    {statusText}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center bg-indigo-50/20 p-3 rounded-xl border border-indigo-100/50 text-[10px] text-indigo-900 leading-tight font-medium">
                    <AlertCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>
                      Fecha de Inicio del Préstamo: <strong>{new Date(selectedLoan.startDate).toLocaleDateString('es-MX')}</strong>.
                      {missedCount > 0 && (
                        <span> Actualmente cuenta con <strong>{missedCount} fallos</strong> acumulados.</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-50 border-t flex justify-end shrink-0">
                  <Button 
                    onClick={() => setIsLoanModalOpen(false)}
                    className="rounded-xl h-9 text-xs font-black uppercase px-6"
                  >
                    Cerrar Detalles
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
