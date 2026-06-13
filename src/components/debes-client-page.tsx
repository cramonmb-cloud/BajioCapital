'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { cn, getSaturdayOfWeek, getMexicoNow } from '@/lib/utils';
import type { Client, LoanPlan, Loan, Plaza, Localidad, Promotora, PromotoraSettlement } from '@/lib/types';
import { saveSettlementAction } from '@/app/dashboard/debes/actions';
import { useAuth } from '@/hooks/use-auth';
import { Coins, Download, Save, Loader2, Building, MapPin, User, Calendar, PlusCircle, AlertCircle, FileSpreadsheet, Search, Lock, Unlock, FileText, X } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}

interface DebesClientPageProps {
  initialClients: Client[];
  initialLoanPlans: LoanPlan[];
  initialPlazas: Plaza[];
  initialLocalidades: Localidad[];
  initialPromotoras: Promotora[];
}

function parseLocalDate(dateInput: any): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    }
  }
  return new Date(dateInput);
}

export function DebesClientPage({
  initialClients,
  initialLoanPlans,
  initialPlazas,
  initialLocalidades,
  initialPromotoras,
}: DebesClientPageProps) {
  const { toast } = useToast();
  const { data: realtime } = useRealtimeData({
    clients: initialClients,
    loanPlans: initialLoanPlans,
    plazas: initialPlazas,
    localidades: initialLocalidades,
    promotoras: initialPromotoras
  });
  const { appUser } = useAuth();
  const isCristobal = appUser?.username?.toLowerCase() === 'cristobal';

  // Selected filters
  const [selectedPlaza, setSelectedPlaza] = useState<string>('');
  const [selectedLocalidad, setSelectedLocalidad] = useState<string>('');
  const [selectedPromotora, setSelectedPromotora] = useState<string>('');

  // Local overrides for unsaved edits: weekDateString -> overrides
  const [overrides, setOverrides] = useState<Record<string, Partial<PromotoraSettlement>>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Search state for fast direct promoter search
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Track rows manually unlocked for editing (only editable by Cristobal)
  const [unlockedRows, setUnlockedRows] = useState<Record<string, boolean>>({});

  // Batch PDF states
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchSelectedWeek, setBatchSelectedWeek] = useState<string>('');
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [batchSelectedPromotoras, setBatchSelectedPromotoras] = useState<Record<string, boolean>>({});

  const isRowDisabled = (row: any) => {
    if (!row.isSavedInDb) return false;
    return !unlockedRows[row.id];
  };

  // Fallbacks to initial data if realtime data is not yet loaded
  const plazas = useMemo(() => realtime?.plazas || initialPlazas, [realtime?.plazas, initialPlazas]);
  const localidades = useMemo(() => realtime?.localidades || initialLocalidades, [realtime?.localidades, initialLocalidades]);
  const promotoras = useMemo(() => realtime?.promotoras || initialPromotoras, [realtime?.promotoras, initialPromotoras]);
  const loans = useMemo(() => realtime?.loans || [], [realtime?.loans]);
  const loanPlans = useMemo(() => realtime?.loanPlans || initialLoanPlans, [realtime?.loanPlans, initialLoanPlans]);
  const savedSettlements = useMemo(() => realtime?.promotoraSettlements || [], [realtime?.promotoraSettlements]);

  // Derived filter chains
  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => a.name.localeCompare(b.name)), [plazas]);
  const filteredLocalidades = useMemo(() => 
    localidades.filter(l => l.plazaId === selectedPlaza).sort((a, b) => a.name.localeCompare(b.name)), 
    [localidades, selectedPlaza]
  );
  const filteredPromotoras = useMemo(() => 
    promotoras.filter(p => p.localidadId === selectedLocalidad).sort((a, b) => a.name.localeCompare(b.name)), 
    [promotoras, selectedLocalidad]
  );

  // Memoize all promotoras with their plaza/localidad details for the search box
  const allPromotorasWithDetails = useMemo(() => {
    return promotoras.map(p => {
      const loc = localidades.find(l => l.id === p.localidadId);
      const plaza = loc ? plazas.find(pl => pl.id === loc.plazaId) : null;
      return {
        ...p,
        localidadName: loc?.name || 'N/A',
        plazaName: plaza?.name || 'N/A',
        plazaId: loc?.plazaId || '',
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [promotoras, localidades, plazas]);

  const searchedPromotoras = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase();
    return allPromotorasWithDetails.filter(p => 
      p.name.toLowerCase().includes(query) ||
      p.localidadName.toLowerCase().includes(query) ||
      p.plazaName.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [searchTerm, allPromotorasWithDetails]);

  const activeLoansForPromotora = useMemo(() => {
    if (!selectedPromotora) return [];
    return loans.filter(l => l.promotoraId === selectedPromotora);
  }, [loans, selectedPromotora]);

  // Get Saturdays list where there was activity, sorted descending (newest first)
  const settlementWeeks = useMemo(() => {
    if (!selectedPromotora) return [];

    const saturdays: Date[] = [];
    const today = getMexicoNow();
    const currentSaturday = getSaturdayOfWeek(today);

    // Limit starting date to Saturday, 2026-05-23
    const startLimitDate = new Date('2026-05-23T00:00:00');
    let startSaturday = getSaturdayOfWeek(startLimitDate);

    // Find oldest loan of this promoter
    if (activeLoansForPromotora.length > 0) {
      const oldestStartDateStr = activeLoansForPromotora.reduce((oldest, l) => {
        return parseLocalDate(l.startDate) < parseLocalDate(oldest) ? l.startDate : oldest;
      }, activeLoansForPromotora[0].startDate);

      const oldestSaturday = getSaturdayOfWeek(parseLocalDate(oldestStartDateStr));
      
      // Enforce that we do not start before May 30th, 2026
      if (oldestSaturday.getTime() > startSaturday.getTime()) {
        startSaturday = oldestSaturday;
      }
    }

    // Generate Saturdays from startSaturday to currentSaturday
    const maxDate = new Date(currentSaturday);
    const currentTemp = new Date(startSaturday);

    while (currentTemp <= maxDate) {
      saturdays.push(new Date(currentTemp));
      currentTemp.setDate(currentTemp.getDate() + 7);
    }

    // Filter out any dates that are strictly greater than currentSaturday (safety guard)
    const filteredSaturdays = saturdays.filter(d => d.getTime() <= currentSaturday.getTime());

    // Sort descending (newest weeks at the top)
    return filteredSaturdays.sort((a, b) => b.getTime() - a.getTime());
  }, [activeLoansForPromotora, selectedPromotora]);

  const getVentaForWeek = (weekDate: Date) => {
    const targetTime = weekDate.getTime();
    return activeLoansForPromotora
      .filter(l => getSaturdayOfWeek(parseLocalDate(l.startDate)).getTime() === targetTime)
      .reduce((sum, l) => sum + l.amount, 0);
  };

  const getNewAbonoSemanalForWeek = (weekDate: Date) => {
    const targetTime = weekDate.getTime();
    return activeLoansForPromotora
      .filter(l => getSaturdayOfWeek(parseLocalDate(l.startDate)).getTime() === targetTime)
      .reduce((sum, l) => {
        const plan = loanPlans.find(p => p.id === l.loanPlanId);
        if (!plan) return sum;
        return sum + (l.amount / 1000) * plan.weeklyPaymentRate;
      }, 0);
  };

  // Compile final rows with chronological propagation and real-time db calculations
  const rows = useMemo(() => {
    if (!selectedPromotora) return [];

    const chronoWeeks = [...settlementWeeks].reverse();
    const computedChronoRows: any[] = [];

    chronoWeeks.forEach((week, index) => {
      const weekStr = week.toISOString().split('T')[0];
      const id = `${selectedPromotora}_${weekStr}`;
      const saved = savedSettlements.find(s => s.id === id);
      const local = overrides[weekStr] || {};

      const weekTime = week.getTime();

      // 1. Calculate database-driven defaults for this week
      let realDebeEntregar = 0;
      let realFalla = 0;
      let realEfectivo = 0;
      let realRecuperado = 0;

      activeLoansForPromotora.forEach(loan => {
        const plan = loanPlans.find(lp => lp.id === loan.loanPlanId);
        if (!plan) return;

        const loanSaturday = getSaturdayOfWeek(parseLocalDate(loan.startDate));
        const loanSaturdayTime = loanSaturday.getTime();

        // First payment is due 1 week (7 days) after the start Saturday
        const firstPaymentTime = loanSaturdayTime + (7 * 24 * 3600 * 1000);

        let isActive = true;
        if (weekTime < firstPaymentTime) {
          isActive = false;
        }

        // Check if it was paid off before this target week
        if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') {
          const lastPayment = loan.payments.length > 0
            ? loan.payments.reduce((latest, p) => parseLocalDate(p.date) > parseLocalDate(latest.date) ? p : latest)
            : null;
          if (lastPayment) {
            const payoffSaturday = getSaturdayOfWeek(parseLocalDate(lastPayment.date));
            if (payoffSaturday.getTime() < weekTime) {
              isActive = false;
            }
          }
        }

        const weeklyPayment = (loan.amount / 1000) * plan.weeklyPaymentRate;
        const expectedForLoan = isActive ? weeklyPayment : 0;
        realDebeEntregar += expectedForLoan;

        // Sum actual payments made to this loan in this week
        const paymentsInWeek = (loan.payments || []).filter(p => {
          const paymentDate = parseLocalDate(p.date);
          const paymentSaturday = getSaturdayOfWeek(paymentDate);
          return paymentSaturday.getTime() === weekTime;
        });
        const actualPaidInWeek = paymentsInWeek.reduce((sum, p) => sum + p.amount, 0);

        // Calculate failure, efectivo, recuperado for this loan
        const loanFalla = Math.max(0, expectedForLoan - actualPaidInWeek);
        const loanEfectivo = Math.min(actualPaidInWeek, expectedForLoan);
        const loanRecuperado = Math.max(0, actualPaidInWeek - expectedForLoan);

        realFalla += loanFalla;
        realEfectivo += loanEfectivo;
        realRecuperado += loanRecuperado;
      });

      const ventaVal = getVentaForWeek(week);
      const abonoSemanalVal = getNewAbonoSemanalForWeek(week);

      // 2. Propagate/calculate debeEntregar
      let debeEntregar = 0;
      if (index === 0) {
        if (local.debeEntregar !== undefined) {
          debeEntregar = local.debeEntregar;
        } else if (saved?.debeEntregar !== undefined) {
          debeEntregar = saved.debeEntregar;
        } else {
          debeEntregar = realDebeEntregar;
        }
      } else {
        const prevRow = computedChronoRows[index - 1];
        debeEntregar = prevRow.total - prevRow.comicion + prevRow.abonoSemanal + prevRow.adelEnt - prevRow.adelSal;
      }

      // 3. Combine defaults, saved from DB, and local overrides
      const savedComicionPercent = saved?.comicionPercent !== undefined ? saved.comicionPercent : 8;
      const comicionPercent = local.comicionPercent !== undefined ? local.comicionPercent : savedComicionPercent;

      const defaultFalla = realFalla;
      const defaultRecuperado = realRecuperado;

      // Falla, Recuperado, Deuda, AdelEnt, AdelSal can be overridden
      const falla = local.falla !== undefined ? local.falla : (saved?.falla !== undefined ? saved.falla : defaultFalla);
      const recuperado = local.recuperado !== undefined ? local.recuperado : (saved?.recuperado !== undefined ? saved.recuperado : defaultRecuperado);
      const adelEnt = local.adelEnt !== undefined ? local.adelEnt : (saved?.adelEnt !== undefined ? saved.adelEnt : 0);
      const adelSal = local.adelSal !== undefined ? local.adelSal : (saved?.adelSal !== undefined ? saved.adelSal : 0);

      // Calculate efectivo (linked directly to falla unless explicitly set otherwise)
      let efectivo = debeEntregar - falla;
      if (local.efectivo !== undefined) {
        efectivo = local.efectivo;
      } else if (saved?.efectivo !== undefined) {
        efectivo = saved.efectivo;
      } else {
        efectivo = Math.max(0, debeEntregar - falla);
      }

      // Calculate derived fields
      const total = efectivo + recuperado;
      const diferencia = efectivo - debeEntregar;
      const defaultDeudaCalc = Math.max(0, debeEntregar - efectivo);
      const deuda = local.deuda !== undefined ? local.deuda : (saved?.deuda !== undefined ? saved.deuda : defaultDeudaCalc);

      const defaultComicion = ventaVal * (comicionPercent / 100);
      const comicion = local.comicion !== undefined ? local.comicion : (saved?.comicion !== undefined ? saved.comicion : defaultComicion);

      computedChronoRows.push({
        id,
        promotoraId: selectedPromotora,
        weekDate: weekStr,
        debeEntregar,
        falla,
        efectivo,
        recuperado,
        total,
        diferencia,
        deuda,
        venta: ventaVal,
        comicion,
        comicionPercent,
        abonoSemanal: abonoSemanalVal,
        adelEnt,
        adelSal,
        isDirty: Object.keys(local).length > 0,
        isSavedInDb: !!saved,
      });
    });

    // Return reversed (newest first)
    return [...computedChronoRows].reverse();
  }, [settlementWeeks, selectedPromotora, savedSettlements, overrides, activeLoansForPromotora, loanPlans]);

  // Handle cell edit
  const handleCellChange = (weekStr: string, field: keyof PromotoraSettlement, value: number, debeEntregar: number) => {
    setOverrides(prev => {
      const currentWeekOverrides = prev[weekStr] || {};
      const updatedOverrides: Partial<PromotoraSettlement> = {
        ...currentWeekOverrides,
        [field]: value,
      };

      // Auto link Falla and Efectivo
      if (field === 'falla') {
        updatedOverrides.efectivo = Math.max(0, debeEntregar - value);
      } else if (field === 'efectivo') {
        updatedOverrides.falla = Math.max(0, debeEntregar - value);
      } else if (field === 'debeEntregar') {
        const currentFalla = updatedOverrides.falla !== undefined ? updatedOverrides.falla : (rows.find(r => r.weekDate === weekStr)?.falla || 0);
        updatedOverrides.efectivo = Math.max(0, value - currentFalla);
      }

      // Percentage and Commission amount automatic cross-calculation
      if (field === 'comicionPercent') {
        const rowData = rows.find(r => r.weekDate === weekStr);
        const venta = rowData ? rowData.venta : 0;
        updatedOverrides.comicion = Math.round(venta * (value / 100));
      }
      
      if (field === 'comicion') {
        const rowData = rows.find(r => r.weekDate === weekStr);
        const venta = rowData ? rowData.venta : 0;
        if (venta > 0) {
          updatedOverrides.comicionPercent = Number(((value / venta) * 100).toFixed(1));
        }
      }

      return {
        ...prev,
        [weekStr]: updatedOverrides,
      };
    });
  };

  // Save row to Firestore
  const handleSaveRow = async (row: any) => {
    setSavingRowId(row.id);
    try {
      const settlementData: PromotoraSettlement = {
        id: row.id,
        promotoraId: row.promotoraId,
        weekDate: row.weekDate,
        debeEntregar: row.debeEntregar,
        falla: row.falla,
        efectivo: row.efectivo,
        recuperado: row.recuperado,
        total: row.total,
        diferencia: row.diferencia,
        deuda: row.deuda,
        venta: row.venta,
        comicion: row.comicion,
        comicionPercent: row.comicionPercent,
        abonoSemanal: row.abonoSemanal,
        adelEnt: row.adelEnt,
        adelSal: row.adelSal,
      };

      const result = await saveSettlementAction(settlementData);
      if (result.success) {
        toast({ title: 'Liquidación Guardada', description: `Semana ${formatDateStr(row.weekDate)} guardada.` });
        
        // Remove from local dirty overrides since database is now synced
        setOverrides(prev => {
          const next = { ...prev };
          delete next[row.weekDate];
          return next;
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: error.message });
    } finally {
      setSavingRowId(null);
    }
  };

  const allAvailableWeeks = useMemo(() => {
    const saturdays: Date[] = [];
    const today = getMexicoNow();
    const currentSaturday = getSaturdayOfWeek(today);
    const startLimitDate = new Date('2026-05-23T00:00:00');
    const startSaturday = getSaturdayOfWeek(startLimitDate);

    const maxDate = new Date(currentSaturday);
    const currentTemp = new Date(startSaturday);

    while (currentTemp <= maxDate) {
      saturdays.push(new Date(currentTemp));
      currentTemp.setDate(currentTemp.getDate() + 7);
    }
    return saturdays.sort((a, b) => b.getTime() - a.getTime());
  }, []);

  const latestWeekStr = useMemo(() => {
    if (allAvailableWeeks.length > 0) {
      return allAvailableWeeks[0].toISOString().split('T')[0];
    }
    return '';
  }, [allAvailableWeeks]);

  const handleOpenBatchModal = () => {
    if (latestWeekStr && !batchSelectedWeek) {
      setBatchSelectedWeek(latestWeekStr);
    }
    setIsBatchModalOpen(true);
  };

  const filteredBatchPromotoras = useMemo(() => {
    const query = batchSearchTerm.toLowerCase().trim();
    if (!query) return allPromotorasWithDetails;
    return allPromotorasWithDetails.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.localidadName.toLowerCase().includes(query) ||
      p.plazaName.toLowerCase().includes(query)
    );
  }, [batchSearchTerm, allPromotorasWithDetails]);

  const getSettlementRowForPromotora = (pId: string, targetWeekStr: string) => {
    const pLoans = loans.filter(l => l.promotoraId === pId);
    if (pLoans.length === 0) {
      return {
        id: `${pId}_${targetWeekStr}`,
        promotoraId: pId,
        weekDate: targetWeekStr,
        debeEntregar: 0,
        falla: 0,
        efectivo: 0,
        recuperado: 0,
        total: 0,
        diferencia: 0,
        deuda: 0,
        venta: 0,
        comicion: 0,
        comicionPercent: 8,
        abonoSemanal: 0,
        adelEnt: 0,
        adelSal: 0,
      };
    }

    const startLimitDate = new Date('2026-05-23T00:00:00');
    let startSaturday = getSaturdayOfWeek(startLimitDate);

    const oldestStartDateStr = pLoans.reduce((oldest, l) => {
      return parseLocalDate(l.startDate) < parseLocalDate(oldest) ? l.startDate : oldest;
    }, pLoans[0].startDate);

    const oldestSaturday = getSaturdayOfWeek(parseLocalDate(oldestStartDateStr));
    if (oldestSaturday.getTime() > startSaturday.getTime()) {
      startSaturday = oldestSaturday;
    }

    const today = getMexicoNow();
    const currentSaturday = getSaturdayOfWeek(today);
    
    const targetWeekDate = new Date(targetWeekStr + 'T00:00:00');
    if (targetWeekDate.getTime() < startSaturday.getTime()) {
      return {
        id: `${pId}_${targetWeekStr}`,
        promotoraId: pId,
        weekDate: targetWeekStr,
        debeEntregar: 0,
        falla: 0,
        efectivo: 0,
        recuperado: 0,
        total: 0,
        diferencia: 0,
        deuda: 0,
        venta: 0,
        comicion: 0,
        comicionPercent: 8,
        abonoSemanal: 0,
        adelEnt: 0,
        adelSal: 0,
      };
    }

    const saturdays: Date[] = [];
    const maxDate = new Date(currentSaturday);
    const currentTemp = new Date(startSaturday);

    while (currentTemp <= maxDate) {
      saturdays.push(new Date(currentTemp));
      currentTemp.setDate(currentTemp.getDate() + 7);
    }
    const filteredSaturdays = saturdays.filter(d => d.getTime() <= currentSaturday.getTime());
    const chronoWeeks = filteredSaturdays.sort((a, b) => a.getTime() - b.getTime());

    const computedChronoRows: any[] = [];

    for (let index = 0; index < chronoWeeks.length; index++) {
      const week = chronoWeeks[index];
      const weekStr = week.toISOString().split('T')[0];
      const id = `${pId}_${weekStr}`;
      const saved = savedSettlements.find(s => s.id === id);
      const weekTime = week.getTime();

      let realDebeEntregar = 0;
      let realFalla = 0;
      let realEfectivo = 0;
      let realRecuperado = 0;

      pLoans.forEach(loan => {
        const plan = loanPlans.find(lp => lp.id === loan.loanPlanId);
        if (!plan) return;

        const loanSaturday = getSaturdayOfWeek(parseLocalDate(loan.startDate));
        const loanSaturdayTime = loanSaturday.getTime();
        const firstPaymentTime = loanSaturdayTime + (7 * 24 * 3600 * 1000);

        let isActive = true;
        if (weekTime < firstPaymentTime) {
          isActive = false;
        }

        if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') {
          const lastPayment = loan.payments.length > 0
            ? loan.payments.reduce((latest, p) => parseLocalDate(p.date) > parseLocalDate(latest.date) ? p : latest)
            : null;
          if (lastPayment) {
            const payoffSaturday = getSaturdayOfWeek(parseLocalDate(lastPayment.date));
            if (payoffSaturday.getTime() < weekTime) {
              isActive = false;
            }
          }
        }

        const weeklyPayment = (loan.amount / 1000) * plan.weeklyPaymentRate;
        const expectedForLoan = isActive ? weeklyPayment : 0;
        realDebeEntregar += expectedForLoan;

        const paymentsInWeek = (loan.payments || []).filter(p => {
          const paymentDate = parseLocalDate(p.date);
          const paymentSaturday = getSaturdayOfWeek(paymentDate);
          return paymentSaturday.getTime() === weekTime;
        });
        const actualPaidInWeek = paymentsInWeek.reduce((sum, p) => sum + p.amount, 0);

        const loanFalla = Math.max(0, expectedForLoan - actualPaidInWeek);
        const loanEfectivo = Math.min(actualPaidInWeek, expectedForLoan);
        const loanRecuperado = Math.max(0, actualPaidInWeek - expectedForLoan);

        realFalla += loanFalla;
        realEfectivo += loanEfectivo;
        realRecuperado += loanRecuperado;
      });

      const getVenta = (weekDate: Date) => {
        return pLoans
          .filter(l => getSaturdayOfWeek(parseLocalDate(l.startDate)).getTime() === weekDate.getTime())
          .reduce((sum, l) => sum + l.amount, 0);
      };

      const getNewAbono = (weekDate: Date) => {
        return pLoans
          .filter(l => getSaturdayOfWeek(parseLocalDate(l.startDate)).getTime() === weekDate.getTime())
          .reduce((sum, l) => {
            const plan = loanPlans.find(p => p.id === l.loanPlanId);
            if (!plan) return sum;
            return sum + (l.amount / 1000) * plan.weeklyPaymentRate;
          }, 0);
      };

      const ventaVal = getVenta(week);
      const abonoSemanalVal = getNewAbono(week);

      let debeEntregar = 0;
      if (index === 0) {
        if (saved?.debeEntregar !== undefined) {
          debeEntregar = saved.debeEntregar;
        } else {
          debeEntregar = realDebeEntregar;
        }
      } else {
        const prevRow = computedChronoRows[index - 1];
        debeEntregar = prevRow.total - prevRow.comicion + prevRow.abonoSemanal + prevRow.adelEnt - prevRow.adelSal;
      }

      const savedComicionPercent = saved?.comicionPercent !== undefined ? saved.comicionPercent : 8;
      const defaultFalla = realFalla;
      const defaultRecuperado = realRecuperado;

      const falla = saved?.falla !== undefined ? saved.falla : defaultFalla;
      const recuperado = saved?.recuperado !== undefined ? saved.recuperado : defaultRecuperado;
      const adelEnt = saved?.adelEnt !== undefined ? saved.adelEnt : 0;
      const adelSal = saved?.adelSal !== undefined ? saved.adelSal : 0;

      let efectivo = debeEntregar - falla;
      if (saved?.efectivo !== undefined) {
        efectivo = saved.efectivo;
      } else {
        efectivo = Math.max(0, debeEntregar - falla);
      }

      const total = efectivo + recuperado;
      const diferencia = efectivo - debeEntregar;
      const defaultDeudaCalc = Math.max(0, debeEntregar - efectivo);
      const deuda = saved?.deuda !== undefined ? saved.deuda : defaultDeudaCalc;

      const defaultComicion = ventaVal * (savedComicionPercent / 100);
      const comicion = saved?.comicion !== undefined ? saved.comicion : defaultComicion;

      const rowObj = {
        id,
        promotoraId: pId,
        weekDate: weekStr,
        debeEntregar,
        falla,
        efectivo,
        recuperado,
        total,
        diferencia,
        deuda,
        venta: ventaVal,
        comicion,
        comicionPercent: savedComicionPercent,
        abonoSemanal: abonoSemanalVal,
        adelEnt,
        adelSal,
      };

      computedChronoRows.push(rowObj);

      if (weekStr === targetWeekStr) {
        return rowObj;
      }
    }

    return computedChronoRows.find(r => r.weekDate === targetWeekStr) || {
      id: `${pId}_${targetWeekStr}`,
      promotoraId: pId,
      weekDate: targetWeekStr,
      debeEntregar: 0,
      falla: 0,
      efectivo: 0,
      recuperado: 0,
      total: 0,
      diferencia: 0,
      deuda: 0,
      venta: 0,
      comicion: 0,
      comicionPercent: 8,
      abonoSemanal: 0,
      adelEnt: 0,
      adelSal: 0,
    };
  };

  const handleExportBatchPDF = () => {
    const selectedIds = Object.keys(batchSelectedPromotoras).filter(id => batchSelectedPromotoras[id]);
    if (selectedIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error de exportación',
        description: 'Debes seleccionar al menos una promotora para el reporte.',
      });
      return;
    }

    if (!batchSelectedWeek) {
      toast({
        variant: 'destructive',
        title: 'Error de exportación',
        description: 'Debes seleccionar una semana.',
      });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 30;
    const topMargin = 50;

    // Title & Header Design
    doc.setFillColor(30, 41, 59); // Slate header
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTROL DE PROMOTORAS - REPORTE CONSOLIDADO DE DEBES', margin, 25);

    // Metadata Block
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SEMANA SELECCIONADA:', margin, topMargin + 10);
    doc.text('CANTIDAD PROMOTORAS:', margin, topMargin + 25);

    doc.setFont('helvetica', 'normal');
    const formattedWeekDateStr = formatDateStr(batchSelectedWeek);
    doc.text(formattedWeekDateStr, margin + 140, topMargin + 10);
    doc.text(`${selectedIds.length}`, margin + 140, topMargin + 25);

    const rightColX = pageWidth - margin - 185;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA GENERACIÓN:', rightColX, topMargin + 10);
    doc.text('TIPO DE REPORTE:', rightColX, topMargin + 25);

    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-MX'), rightColX + 130, topMargin + 10);
    doc.text('CONSOLIDADO GRUPAL', rightColX + 130, topMargin + 25);

    // Columns matching user requirement
    const tableHeaders = [[
      'PROMOTORA',
      'DEBE ENTREGAR',
      'FALLA',
      'EFECTIVO',
      'RECUPERADO',
      'TOTAL',
      'DIFERENCIA',
      'DEUDA',
      'VENTA',
      'COMISION',
      'ABONO SEM.',
      'ADEL. ENT',
      'ADEL. SAL'
    ]];

    // Gather rows data for each selected promotora
    const pdfDataRows: any[] = [];
    let grandDebeEntregar = 0;
    let grandFalla = 0;
    let grandEfectivo = 0;
    let grandRecuperado = 0;
    let grandTotal = 0;
    let grandDiferencia = 0;
    let grandDeuda = 0;
    let grandVenta = 0;
    let grandComicion = 0;
    let grandAbonoSemanal = 0;
    let grandAdelEnt = 0;
    let grandAdelSal = 0;

    selectedIds.forEach(pId => {
      const pDetail = allPromotorasWithDetails.find(p => p.id === pId);
      const row = getSettlementRowForPromotora(pId, batchSelectedWeek);
      
      const promotoraLabel = pDetail 
        ? `${pDetail.name.toUpperCase()}\n(${pDetail.localidadName.toUpperCase()} - ${pDetail.plazaName.toUpperCase()})`
        : 'N/A';

      if (row) {
        pdfDataRows.push([
          promotoraLabel,
          formatCurrency(row.debeEntregar),
          formatCurrency(row.falla),
          formatCurrency(row.efectivo),
          formatCurrency(row.recuperado),
          formatCurrency(row.total),
          formatCurrency(row.diferencia),
          formatCurrency(row.deuda),
          formatCurrency(row.venta),
          formatCurrency(row.comicion),
          formatCurrency(row.abonoSemanal),
          formatCurrency(row.adelEnt),
          formatCurrency(row.adelSal)
        ]);

        grandDebeEntregar += row.debeEntregar;
        grandFalla += row.falla;
        grandEfectivo += row.efectivo;
        grandRecuperado += row.recuperado;
        grandTotal += row.total;
        grandDiferencia += row.diferencia;
        grandDeuda += row.deuda;
        grandVenta += row.venta;
        grandComicion += row.comicion;
        grandAbonoSemanal += row.abonoSemanal;
        grandAdelEnt += row.adelEnt;
        grandAdelSal += row.adelSal;
      }
    });

    // Add consolidated totals row
    pdfDataRows.push([
      'TOTAL CONSOLIDADO',
      formatCurrency(grandDebeEntregar),
      formatCurrency(grandFalla),
      formatCurrency(grandEfectivo),
      formatCurrency(grandRecuperado),
      formatCurrency(grandTotal),
      formatCurrency(grandDiferencia),
      formatCurrency(grandDeuda),
      formatCurrency(grandVenta),
      formatCurrency(grandComicion),
      formatCurrency(grandAbonoSemanal),
      formatCurrency(grandAdelEnt),
      formatCurrency(grandAdelSal)
    ]);

    doc.autoTable({
      startY: topMargin + 45,
      head: tableHeaders,
      body: pdfDataRows,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 4,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', minCellWidth: 100 },
      },
      didParseCell: (data) => {
        if (data.row.index === pdfDataRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    const dateFormatted = formattedWeekDateStr.replace(/\//g, '-');
    const fileName = `consolidado_debes_${dateFormatted}.pdf`;

    doc.save(fileName);
    toast({
      title: 'Reporte Consolidado Exportado',
      description: `El archivo ${fileName} ha sido generado exitosamente.`,
    });
    setIsBatchModalOpen(false);
  };

  // Helper strings
  const getHierarchyNames = () => {
    const p = promotoras.find(p => p.id === selectedPromotora);
    const l = localidades.find(l => l.id === p?.localidadId);
    const pl = plazas.find(plaza => plaza.id === l?.plazaId);
    return {
      promotoraName: p?.name || 'N/A',
      localidadName: l?.name || 'N/A',
      plazaName: pl?.name || 'N/A',
    };
  };

  const formatDateStr = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // PDF Generation function
  const handleExportPDF = (selectedRow: any) => {
    if (rows.length === 0 || !selectedRow) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 30;
    const topMargin = 50;

    const { promotoraName, localidadName, plazaName } = getHierarchyNames();

    // Title & Header Design
    doc.setFillColor(30, 41, 59); // Sleek dark slate color
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTROL DE PROMOTORAS - LIQUIDACIONES ("DEBES")', margin, 25);

    // Metadata Block
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PROMOTORA:', margin, topMargin + 10);
    doc.text('LOCALIDAD:', margin, topMargin + 25);
    doc.text('PLAZA:', margin, topMargin + 40);

    doc.setFont('helvetica', 'normal');
    doc.text(promotoraName.toUpperCase(), margin + 90, topMargin + 10);
    doc.text(localidadName.toUpperCase(), margin + 90, topMargin + 25);
    doc.text(plazaName.toUpperCase(), margin + 90, topMargin + 40);

    const rightColX = pageWidth - margin - 185;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA IMPRESIÓN:', rightColX, topMargin + 10);
    doc.text('SEMANA SELECCIONADA:', rightColX, topMargin + 25);

    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-MX'), rightColX + 130, topMargin + 10);
    doc.text(formatDateStr(selectedRow.weekDate), rightColX + 130, topMargin + 25);

    // Columns matching user photo
    const tableHeaders = [[
      'FECHA',
      'DEBE ENTREGAR',
      'FALLA',
      'EFECTIVO',
      'RECUPERADO',
      'TOTAL',
      'DIFERENCIA',
      'DEUDA',
      'VENTA',
      'COMISION',
      'ABONO SEMANAL',
      'ADEL. ENT',
      'ADEL. SAL'
    ]];

    // Find index of selected row
    const selectedIndex = rows.findIndex(r => r.id === selectedRow.id);

    // Only put the selected week and the following week (if it exists)
    const pdfRows = [selectedRow];
    if (selectedIndex > 0) {
      pdfRows.push(rows[selectedIndex - 1]);
    }

    const tableData = pdfRows.map(r => [
      formatDateStr(r.weekDate),
      formatCurrency(r.debeEntregar),
      formatCurrency(r.falla),
      formatCurrency(r.efectivo),
      formatCurrency(r.recuperado),
      formatCurrency(r.total),
      formatCurrency(r.diferencia),
      formatCurrency(r.deuda),
      formatCurrency(r.venta),
      formatCurrency(r.comicion),
      formatCurrency(r.abonoSemanal),
      formatCurrency(r.adelEnt),
      formatCurrency(r.adelSal)
    ]);

    doc.autoTable({
      startY: topMargin + 60,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 4,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { fontStyle: 'bold', minCellWidth: 40 }, // Fecha
      }
    });

    const weekFormatted = formatDateStr(selectedRow.weekDate).replace(/\//g, '-');
    const fileName = `debe_${promotoraName.toLowerCase().replace(/\s+/g, '_')}_${weekFormatted}.pdf`;

    doc.save(fileName);
    toast({ title: 'PDF Exportado', description: `El archivo ${fileName} ha sido generado.` });
  };

  return (
    <div className="space-y-6">
      {/* Search and hierarchy selectors */}
      <Card className="shadow-lg border-primary/10 overflow-visible bg-background">
        <CardHeader className="bg-primary/5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-sm">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-slate-800">DEBES DE PROMOTORAS</CardTitle>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleOpenBatchModal}
            className="rounded-xl h-9 px-4 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-all shadow-sm w-full sm:w-auto"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Reporte Avanzado
          </Button>
        </CardHeader>
        <CardContent className="py-3 px-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Búsqueda Rápida de Promotoras */}
            <div className="space-y-1 relative w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3 w-3 text-primary" /> Búsqueda Rápida
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Buscar promotora..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="rounded-xl border-2 h-9 pl-8 pr-3 bg-muted/20 focus-visible:ring-primary font-medium text-xs w-full"
                />
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Dropdown Results Overlay */}
              {isSearchFocused && searchTerm.trim() && (
                <div className="absolute z-50 w-full md:w-[140%] min-w-[280px] mt-1.5 bg-background border-2 border-slate-100 rounded-xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                  {searchedPromotoras.length > 0 ? (
                    <div className="p-1.5 divide-y divide-slate-50">
                      {searchedPromotoras.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setSelectedPlaza(p.plazaId);
                            setSelectedLocalidad(p.localidadId);
                            setSelectedPromotora(p.id);
                            setSearchTerm('');
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 active:bg-primary/10 rounded-lg text-left transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800 uppercase text-xs">{p.name}</span>
                            <div className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">
                              {p.localidadName} ({p.plazaName})
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            Elegir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground font-bold">
                      No hay coincidencias
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Plaza */}
            <div className="space-y-1 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <Building className="h-3 w-3" /> Plaza de Operación
              </label>
              <Select value={selectedPlaza} onValueChange={(val) => { setSelectedPlaza(val); setSelectedLocalidad(''); setSelectedPromotora(''); }}>
                <SelectTrigger className="rounded-xl border-2 h-9 bg-muted/20 hover:bg-muted/30 transition-colors focus:ring-primary text-xs">
                  <SelectValue placeholder="Seleccionar Plaza" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {sortedPlazas.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="uppercase font-semibold text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Localidad */}
            <div className="space-y-1 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Localidad / Sector
              </label>
              <Select value={selectedLocalidad} onValueChange={(val) => { setSelectedLocalidad(val); setSelectedPromotora(''); }} disabled={!selectedPlaza}>
                <SelectTrigger className="rounded-xl border-2 h-9 bg-muted/20 hover:bg-muted/30 transition-colors disabled:opacity-50 text-xs">
                  <SelectValue placeholder={selectedPlaza ? "Seleccionar Localidad" : "Plaza primero"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {filteredLocalidades.map((l) => (
                    <SelectItem key={l.id} value={l.id} className="uppercase font-semibold text-xs">{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Promotora */}
            <div className="space-y-1 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" /> Promotora Responsable
              </label>
              <Select value={selectedPromotora} onValueChange={setSelectedPromotora} disabled={!selectedLocalidad}>
                <SelectTrigger className="rounded-xl border-2 h-9 bg-muted/20 hover:bg-muted/30 transition-colors disabled:opacity-50 text-xs">
                  <SelectValue placeholder={selectedLocalidad ? "Seleccionar Promotora" : "Localidad primero"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {filteredPromotoras.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="uppercase font-semibold text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main calculation sheet table */}
      {selectedPromotora ? (
        <Card className="shadow-2xl border-slate-200 overflow-hidden bg-background">
          <CardHeader className="bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-xl font-bold uppercase text-slate-800">
                  Bitácora de {getHierarchyNames().promotoraName}
                </CardTitle>
              </div>
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Zona: {getHierarchyNames().localidadName} ({getHierarchyNames().plazaName})
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {rows.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-100">
                  <TableRow className="border-b">
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[65px]">Fecha</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[85px]">Debe Entregar</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Falla</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[85px]">Efectivo</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Recuperado</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Total</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Diferencia</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Deuda</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Venta</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[120px]">Comisión</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[85px]">Abono Semanal</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Adel. Ent</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Adel. Sal</TableHead>
                    <TableHead className="font-black text-center text-[9px] md:text-[10px] uppercase text-slate-700 py-2 px-1 h-9 min-w-[75px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, rowIndex) => {
                    const isFirstChronoWeek = rowIndex === rows.length - 1;
                    const currentSaturday = getSaturdayOfWeek(getMexicoNow());
                    const prevSaturday = new Date(currentSaturday);
                    prevSaturday.setDate(prevSaturday.getDate() - 7);
                    const prevSaturdayStr = prevSaturday.toISOString().split('T')[0];
                    const isPrevWeek = row.weekDate === prevSaturdayStr;
                    return (
                      <TableRow key={row.id} className={cn("hover:bg-muted/10 transition-colors border-b", isPrevWeek && "bg-blue-200/50 hover:bg-blue-200/70 dark:bg-blue-900/40 dark:hover:bg-blue-900/50 border-l-4 border-l-blue-600 shadow-sm")}>
                        {/* Date */}
                        <TableCell className="font-bold text-center text-[11px] py-2 px-1">
                          {formatDateStr(row.weekDate)}
                        </TableCell>

                        {/* Debe Entregar */}
                        <TableCell className={cn("font-extrabold text-center text-[11px] text-slate-600 py-2 px-1", isPrevWeek ? "bg-blue-200/60 dark:bg-blue-900/30" : "bg-slate-50/50")}>
                          {isFirstChronoWeek && isCristobal ? (
                            <Input
                              type="number"
                              value={row.debeEntregar === 0 ? '' : row.debeEntregar}
                              onChange={(e) => handleCellChange(row.weekDate, 'debeEntregar', Number(e.target.value), row.debeEntregar)}
                              placeholder="0"
                              disabled={isRowDisabled(row)}
                              className="h-7 w-[75px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-primary disabled:opacity-85"
                            />
                          ) : (
                            formatCurrency(row.debeEntregar)
                          )}
                        </TableCell>

                        {/* Falla */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.falla === 0 ? '' : row.falla}
                            onChange={(e) => handleCellChange(row.weekDate, 'falla', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[65px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-red-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Efectivo */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.efectivo === 0 ? '' : row.efectivo}
                            onChange={(e) => handleCellChange(row.weekDate, 'efectivo', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[75px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-emerald-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Recuperado */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.recuperado === 0 ? '' : row.recuperado}
                            onChange={(e) => handleCellChange(row.weekDate, 'recuperado', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[65px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-blue-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Total */}
                        <TableCell className={cn("font-extrabold text-center text-[11px] py-2 px-1", isPrevWeek ? "bg-blue-200/60 dark:bg-blue-900/30" : "bg-slate-50/50")}>
                          {formatCurrency(row.total)}
                        </TableCell>

                        {/* Diferencia */}
                        <TableCell className="text-center py-2 px-1">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                            row.diferencia < 0 ? 'bg-red-100 text-red-700' : row.diferencia > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {row.diferencia === 0 ? 'Ø' : formatCurrency(row.diferencia)}
                          </span>
                        </TableCell>

                        {/* Deuda */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.deuda === 0 ? '' : row.deuda}
                            onChange={(e) => handleCellChange(row.weekDate, 'deuda', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[65px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-orange-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Venta */}
                        <TableCell className={cn("font-bold text-center text-[11px] text-blue-700 py-2 px-1", isPrevWeek ? "bg-blue-200/40 dark:bg-blue-900/20" : "bg-blue-50/10")}>
                          {row.venta === 0 ? 'Ø' : formatCurrency(row.venta)}
                        </TableCell>

                        {/* Comisión */}
                        <TableCell className="text-center py-2 px-1">
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              value={row.comicion === 0 ? '' : row.comicion}
                              onChange={(e) => handleCellChange(row.weekDate, 'comicion', Number(e.target.value), row.debeEntregar)}
                              placeholder="0"
                              disabled={isRowDisabled(row)}
                              className="h-7 w-[60px] px-0.5 text-xs text-center rounded-lg font-semibold tracking-tighter border disabled:opacity-85"
                            />
                            <div className="flex items-center gap-0.5 bg-slate-50 border rounded-lg px-0.5 h-7">
                              <Input
                                type="number"
                                value={row.comicionPercent === undefined ? 8 : row.comicionPercent}
                                onChange={(e) => handleCellChange(row.weekDate, 'comicionPercent', Number(e.target.value), row.debeEntregar)}
                                disabled={isRowDisabled(row)}
                                className="h-5 w-9 text-center p-0 font-semibold tracking-tighter border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs disabled:opacity-85"
                                placeholder="8"
                              />
                              <span className="text-[9px] font-black text-slate-500 pr-0.5">%</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Abono Semanal */}
                        <TableCell className={cn("font-semibold text-center text-[11px] text-slate-500 py-2 px-1", isPrevWeek ? "bg-blue-200/40 dark:bg-blue-900/20" : "bg-slate-50/30")}>
                          {row.abonoSemanal === 0 ? 'Ø' : formatCurrency(row.abonoSemanal)}
                        </TableCell>

                        {/* Adelanto Ent */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.adelEnt === 0 ? '' : row.adelEnt}
                            onChange={(e) => handleCellChange(row.weekDate, 'adelEnt', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[65px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Adelanto Sal */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.adelSal === 0 ? '' : row.adelSal}
                            onChange={(e) => handleCellChange(row.weekDate, 'adelSal', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={isRowDisabled(row)}
                            className="h-7 w-[65px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-center px-1">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleExportPDF(row)}
                              className="h-7 px-1.5 rounded-lg hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 font-extrabold text-[9px] flex items-center gap-1 transition-colors"
                              title="Exportar esta semana y la siguiente a PDF"
                            >
                              <FileText className="h-3 w-3" />
                              PDF
                            </Button>
                            {row.isSavedInDb && (
                              isCristobal ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setUnlockedRows(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                  className="h-7 w-7 p-0 rounded-full hover:bg-slate-200 transition-colors"
                                  title={unlockedRows[row.id] ? "Bloquear Edición" : "Habilitar Edición (Cristobal)"}
                                >
                                  {unlockedRows[row.id] ? (
                                    <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                                  )}
                                </Button>
                              ) : (
                                <div className="inline-flex items-center justify-center h-7 w-7 text-slate-400" title="Registro Guardado (Bloqueado)">
                                  <Lock className="h-3.5 w-3.5" />
                                </div>
                              )
                            )}
                            <Button
                              size="sm"
                              disabled={!row.isDirty || savingRowId === row.id || isRowDisabled(row)}
                              onClick={() => handleSaveRow(row)}
                              className={`rounded-full h-7 px-2.5 text-[10px] font-bold transition-all shadow-sm ${
                                row.isDirty && !isRowDisabled(row)
                                  ? 'bg-primary hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                                  : 'bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed'
                              }`}
                            >
                              {savingRowId === row.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3 mr-1" />
                              )}
                              Guardar
                            </Button>
                          </div>
                        </TableCell>
                    </TableRow>
                  ); })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <AlertCircle className="h-12 w-12 text-slate-300 mb-3" />
                <p className="font-bold text-sm">No se encontraron semanas de actividad para esta promotora.</p>
                <p className="text-xs">Los registros de liquidación aparecerán una vez que haya préstamos asignados.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-dashed border-slate-300 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Coins className="h-16 w-16 text-slate-300 mb-4 animate-pulse" />
            <h3 className="font-black text-slate-700 text-lg uppercase tracking-wide">Consulta de Promotoras</h3>
            <p className="text-xs max-w-sm mt-1">Selecciona una Plaza, Localidad y Promotora en los campos superiores para desplegar y liquidar sus cuentas semanales.</p>
          </CardContent>
        </Card>
      )}

      {/* Modal Reporte Avanzado */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-background border-2 border-slate-100 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <span className="font-extrabold text-base uppercase tracking-wide">Reporte Avanzado de Debes</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsBatchModalOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Step 1: Semana */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" /> 1. Selecciona la Semana de Reporte
                </label>
                <Select value={batchSelectedWeek} onValueChange={setBatchSelectedWeek}>
                  <SelectTrigger className="rounded-xl border-2 h-10 bg-muted/20 hover:bg-muted/30 transition-colors focus:ring-primary text-xs text-left">
                    <SelectValue placeholder="Seleccionar Semana" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {allAvailableWeeks.map((week) => {
                      const weekStr = week.toISOString().split('T')[0];
                      return (
                        <SelectItem key={weekStr} value={weekStr} className="font-semibold text-xs">
                          Semana del {formatDateStr(weekStr)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Promotoras */}
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> 2. Selecciona las Promotoras
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newSelection: Record<string, boolean> = {};
                        allPromotorasWithDetails.forEach(p => {
                          newSelection[p.id] = true;
                        });
                        setBatchSelectedPromotoras(newSelection);
                      }}
                      className="text-[9px] font-black uppercase bg-primary/10 text-primary hover:bg-primary/20 px-2.5 py-1 rounded transition-colors font-bold"
                    >
                      Seleccionar Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedPromotoras({})}
                      className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors font-bold"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar promotora por nombre, localidad o plaza..."
                    value={batchSearchTerm}
                    onChange={(e) => setBatchSearchTerm(e.target.value)}
                    className="rounded-xl border-2 h-9 pl-8 pr-3 bg-muted/10 focus-visible:ring-primary font-medium text-xs w-full"
                  />
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                </div>

                {/* Checklist grid */}
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto bg-muted/5 p-2">
                  {filteredBatchPromotoras.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredBatchPromotoras.map((p) => {
                        const isChecked = !!batchSelectedPromotoras[p.id];
                        return (
                          <label
                            key={p.id}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all hover:bg-background",
                              isChecked 
                                ? "bg-primary/5 border-primary/20 hover:border-primary/30" 
                                : "border-slate-100 bg-background hover:border-slate-200"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setBatchSelectedPromotoras(prev => ({
                                  ...prev,
                                  [p.id]: e.target.checked
                                }));
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 uppercase text-[11px] truncate leading-none">
                                {p.name}
                              </p>
                              <span className="text-[9px] uppercase font-semibold text-muted-foreground block mt-0.5 truncate">
                                {p.localidadName} ({p.plazaName})
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground font-bold">
                      No se encontraron promotoras
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t px-6 py-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsBatchModalOpen(false)}
                className="rounded-xl h-9 text-xs font-bold hover:bg-slate-150 transition-colors"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleExportBatchPDF}
                className="rounded-xl h-9 px-5 text-xs font-bold bg-primary hover:bg-primary/95 text-white flex items-center gap-2 transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                Exportar PDF Consolidado
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
