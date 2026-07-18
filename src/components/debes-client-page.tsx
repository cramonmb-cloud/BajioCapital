'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn, getSaturdayOfWeek, getMexicoNow } from '@/lib/utils';
import type { Client, LoanPlan, Loan, Plaza, Localidad, Promotora, PromotoraSettlement } from '@/lib/types';
import { saveSettlementAction } from '@/app/dashboard/debes/actions';
import { useAuth } from '@/hooks/use-auth';
import { Coins, Download, Save, Loader2, Building, MapPin, Calendar, Check, Lock, Unlock } from 'lucide-react';
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
  const { appUser } = useAuth();
  const isCristobal = appUser?.username?.toLowerCase() === 'cristobal';

  // Selected filters
  const [selectedPlaza, setSelectedPlaza] = useState<string>('');
  const [selectedLocalidad, setSelectedLocalidad] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');

  // Local overrides for unsaved edits: promotoraId -> overrides
  const [overrides, setOverrides] = useState<Record<string, Partial<PromotoraSettlement>>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Track rows manually unlocked for editing (only editable by Cristobal)
  const [unlockedRows, setUnlockedRows] = useState<Record<string, boolean>>({});

  const isRowDisabled = (row: any) => {
    if (!row.isSavedInDb) return false;
    return !unlockedRows[row.promotoraId];
  };

  const toggleUnlockRow = (promotoraId: string) => {
    setUnlockedRows(prev => ({
      ...prev,
      [promotoraId]: !prev[promotoraId]
    }));
  };

  const plazaPromotoraIds = useMemo(() => {
    if (!selectedPlaza) return [];
    const locs = initialLocalidades.filter(l => l.plazaId === selectedPlaza);
    const locIds = locs.map(l => l.id);
    const proms = initialPromotoras.filter(p => locIds.includes(p.localidadId));
    return proms.map(p => p.id);
  }, [selectedPlaza, initialLocalidades, initialPromotoras]);

  const dynamicLoansQuery = useMemo(() => {
    return query(collection(db, 'loans'));
  }, []);

  const dynamicSettlementsQuery = useMemo(() => {
    return query(collection(db, 'promotoraSettlements'));
  }, []);

  const { data: realtime } = useRealtimeData({
    clients: initialClients,
    loanPlans: initialLoanPlans,
    plazas: initialPlazas,
    localidades: initialLocalidades,
    promotoras: initialPromotoras
  }, {
    enabledCollections: ['loans', 'loanPlans', 'plazas', 'localidades', 'promotoras', 'promotoraSettlements'],
    queries: {
      loans: dynamicLoansQuery,
      promotoraSettlements: dynamicSettlementsQuery
    }
  });

  const plazas = useMemo(() => realtime?.plazas || initialPlazas, [realtime?.plazas, initialPlazas]);
  const localidades = useMemo(() => realtime?.localidades || initialLocalidades, [realtime?.localidades, initialLocalidades]);
  const promotoras = useMemo(() => realtime?.promotoras || initialPromotoras, [realtime?.promotoras, initialPromotoras]);
  const loans = useMemo(() => realtime?.loans || [], [realtime?.loans]);
  const loanPlans = useMemo(() => realtime?.loanPlans || initialLoanPlans, [realtime?.loanPlans, initialLoanPlans]);
  const savedSettlements = useMemo(() => realtime?.promotoraSettlements || [], [realtime?.promotoraSettlements]);

  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => (a?.name || '').localeCompare(b?.name || '')), [plazas]);
  const filteredLocalidades = useMemo(() => 
    localidades.filter(l => l.plazaId === selectedPlaza).sort((a, b) => (a?.name || '').localeCompare(b?.name || '')), 
    [localidades, selectedPlaza]
  );
  
  const localidadPromotoras = useMemo(() => {
    if (!selectedLocalidad) return [];
    return promotoras.filter(p => p.localidadId === selectedLocalidad)
      .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }, [promotoras, selectedLocalidad]);

  const allAvailableWeeks = useMemo(() => {
    const saturdays: Date[] = [];
    const today = getMexicoNow();
    const currentSaturday = getSaturdayOfWeek(today);

    // Dynamic start date based on the oldest loan, defaulting to '2026-07-11'
    let startLimitDate = new Date('2026-07-11T00:00:00');
    if (loans.length > 0) {
      const oldestStartDateStr = loans.reduce((oldest, l) => {
        if (!l.startDate) return oldest;
        const d = parseLocalDate(l.startDate);
        const o = parseLocalDate(oldest);
        return d < o ? l.startDate : oldest;
      }, loans[0].startDate);

      if (oldestStartDateStr) {
        startLimitDate = parseLocalDate(oldestStartDateStr);
      }
    }

    const startSaturday = getSaturdayOfWeek(startLimitDate);
    const maxDate = new Date(currentSaturday);
    const currentTemp = new Date(startSaturday);

    while (currentTemp <= maxDate) {
      saturdays.push(new Date(currentTemp));
      currentTemp.setDate(currentTemp.getDate() + 7);
    }
    return saturdays.sort((a, b) => b.getTime() - a.getTime());
  }, [loans]);

  useEffect(() => {
    if (allAvailableWeeks.length > 0 && !selectedWeek) {
      setSelectedWeek(allAvailableWeeks[0].toISOString().split('T')[0]);
    }
  }, [allAvailableWeeks, selectedWeek]);

  const getWeeklyPaymentAmount = (loan: Loan) => {
    const plan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!plan) return 0;
    return (loan.amount / 1000) * plan.weeklyPaymentRate;
  };

  const getSettlementRowForPromotora = (pId: string, targetWeekStr: string) => {
    const promotora = promotoras.find(p => p.id === pId);
    const pName = promotora?.name || '';
    const pLoans = loans.filter(l => l.promotoraId === pId || (pName && l.promotoraId?.toUpperCase() === pName.toUpperCase()));
    if (pLoans.length === 0) {
      const local = overrides[pId] || {};
      const baseRow = {
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
      const merged = { ...baseRow, ...local };
      merged.total = merged.efectivo + merged.recuperado;
      merged.diferencia = merged.efectivo - merged.debeEntregar;
      merged.deuda = Math.max(0, merged.debeEntregar - merged.efectivo);
      return merged;
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
      const local = overrides[pId] || {};
      const baseRow = {
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
      const merged = { ...baseRow, ...local };
      merged.total = merged.efectivo + merged.recuperado;
      merged.diferencia = merged.efectivo - merged.debeEntregar;
      merged.deuda = Math.max(0, merged.debeEntregar - merged.efectivo);
      return merged;
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
        if (weekTime < loanSaturdayTime) {
          isActive = false;
        }

        if (loan.status === 'Overdue') {
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

      const ventaVal = getVenta(week);
      const abonoSemanalVal = realDebeEntregar;

      let debeEntregar = 0;
      if (index === 0) {
        if (saved?.debeEntregar !== undefined) {
          debeEntregar = saved.debeEntregar;
        } else {
          debeEntregar = realDebeEntregar;
        }
      } else {
        const prevRow = computedChronoRows[index - 1];
        debeEntregar = prevRow.deuda + abonoSemanalVal + prevRow.adelEnt - prevRow.adelSal;
      }

      const savedComicionPercent = saved?.comicionPercent !== undefined ? saved.comicionPercent : 8;
      const defaultFalla = realFalla;
      const defaultRecuperado = realRecuperado;

      const falla = saved?.falla !== undefined ? saved.falla : defaultFalla;
      const recuperado = saved?.recuperado !== undefined ? saved.recuperado : defaultRecuperado;
      const adelEnt = saved?.adelEnt !== undefined ? saved.adelEnt : 0;
      const adelSal = saved?.adelSal !== undefined ? saved.adelSal : 0;

      let efectivo = debeEntregar - falla;
      const isEfectivoManual = saved && saved.efectivo !== undefined && saved.efectivo !== (saved.debeEntregar - saved.falla);
      if (isEfectivoManual) {
        efectivo = saved.efectivo;
      } else {
        efectivo = Math.max(0, debeEntregar - falla);
      }

      const total = efectivo + recuperado;
      const diferencia = efectivo - debeEntregar;
      const deuda = Math.max(0, debeEntregar - efectivo);

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
        const local = overrides[pId] || {};
        const mergedRow = {
          ...rowObj,
          debeEntregar: local.debeEntregar !== undefined ? local.debeEntregar : rowObj.debeEntregar,
          falla: local.falla !== undefined ? local.falla : rowObj.falla,
          efectivo: local.efectivo !== undefined ? local.efectivo : rowObj.efectivo,
          recuperado: local.recuperado !== undefined ? local.recuperado : rowObj.recuperado,
          comicionPercent: local.comicionPercent !== undefined ? local.comicionPercent : rowObj.comicionPercent,
          comicion: local.comicion !== undefined ? local.comicion : rowObj.comicion,
          adelEnt: local.adelEnt !== undefined ? local.adelEnt : rowObj.adelEnt,
          adelSal: local.adelSal !== undefined ? local.adelSal : rowObj.adelSal,
        };
        mergedRow.total = mergedRow.efectivo + mergedRow.recuperado;
        mergedRow.diferencia = mergedRow.efectivo - mergedRow.debeEntregar;
        mergedRow.deuda = Math.max(0, mergedRow.debeEntregar - mergedRow.efectivo);
        return mergedRow;
      }
    }

    const local = overrides[pId] || {};
    const finalRow = computedChronoRows.find(r => r.weekDate === targetWeekStr) || {
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
    const merged = { ...finalRow, ...local };
    merged.total = merged.efectivo + merged.recuperado;
    merged.diferencia = merged.efectivo - merged.debeEntregar;
    merged.deuda = Math.max(0, merged.debeEntregar - merged.efectivo);
    return merged;
  };

  const getSemanaExtraCountForPromotora = (pId: string, weekStr: string) => {
    const promotora = promotoras.find(p => p.id === pId);
    const pName = promotora?.name || '';
    const pLoans = loans.filter(l => l.promotoraId === pId || (pName && l.promotoraId?.toUpperCase() === pName.toUpperCase()));
    if (!weekStr) return 0;
    const weekTime = new Date(weekStr + 'T00:00:00').getTime();
    let count = 0;
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

      if (!isActive) return;

      const targetWeekNumber = Math.floor((weekTime - loanSaturdayTime) / (7 * 24 * 3600 * 1000));
      let missedCount = 0;
      const wp = (loan.amount / 1000) * plan.weeklyPaymentRate;
      for (let w = 1; w < targetWeekNumber; w++) {
        const p = loan.payments.find(pay => pay.weekNumber === w);
        if (!p || p.amount < wp) {
          missedCount++;
        }
      }

      if (missedCount >= 2) {
        count++;
      }
    });
    return count;
  };

  const rows = useMemo(() => {
    if (!selectedLocalidad || !selectedWeek) return [];

    return localidadPromotoras.map(promotora => {
      const settlement = getSettlementRowForPromotora(promotora.id, selectedWeek);
      const semExt = getSemanaExtraCountForPromotora(promotora.id, selectedWeek);
      const fallaPercent = settlement.debeEntregar > 0 ? (settlement.falla / settlement.debeEntregar) * 100 : 0;
      
      const saved = savedSettlements.find(s => s.id === `${promotora.id}_${selectedWeek}`);
      
      return {
        ...settlement,
        promotoraName: promotora.name,
        semExt,
        fallaPercent,
        isDirty: Object.keys(overrides[promotora.id] || {}).length > 0,
        isSavedInDb: !!saved,
      };
    });
  }, [localidadPromotoras, selectedWeek, loans, loanPlans, savedSettlements, overrides]);

  const totals = useMemo(() => {
    let debeEntregar = 0;
    let falla = 0;
    let efectivo = 0;
    let recuperado = 0;
    let total = 0;
    let diferencia = 0;
    let venta = 0;
    let comicion = 0;
    let semExt = 0;

    rows.forEach(r => {
      debeEntregar += r.debeEntregar;
      falla += r.falla;
      efectivo += r.efectivo;
      recuperado += r.recuperado;
      total += r.total;
      diferencia += r.diferencia;
      venta += r.venta;
      comicion += r.comicion;
      semExt += r.semExt;
    });

    const fallaPercent = debeEntregar > 0 ? (falla / debeEntregar) * 100 : 0;

    return {
      debeEntregar,
      falla,
      efectivo,
      recuperado,
      total,
      diferencia,
      fallaPercent,
      venta,
      comicion,
      semExt
    };
  }, [rows]);

  const handleCellChange = (promotoraId: string, field: keyof PromotoraSettlement, value: number, debeEntregar: number) => {
    setOverrides(prev => {
      const currentOverrides = prev[promotoraId] || {};
      const updatedOverrides: Partial<PromotoraSettlement> = {
        ...currentOverrides,
        [field]: value,
      };

      if (field === 'falla') {
        updatedOverrides.efectivo = Math.max(0, debeEntregar - value);
      } else if (field === 'efectivo') {
        updatedOverrides.falla = Math.max(0, debeEntregar - value);
      } else if (field === 'debeEntregar') {
        const currentFalla = updatedOverrides.falla !== undefined ? updatedOverrides.falla : (rows.find(r => r.promotoraId === promotoraId)?.falla || 0);
        updatedOverrides.efectivo = Math.max(0, value - currentFalla);
      }

      if (field === 'comicionPercent') {
        const rowData = rows.find(r => r.promotoraId === promotoraId);
        const venta = rowData ? rowData.venta : 0;
        updatedOverrides.comicion = Math.round(venta * (value / 100));
      }
      
      if (field === 'comicion') {
        const rowData = rows.find(r => r.promotoraId === promotoraId);
        const venta = rowData ? rowData.venta : 0;
        if (venta > 0) {
          updatedOverrides.comicionPercent = Number(((value / venta) * 100).toFixed(1));
        }
      }

      return {
        ...prev,
        [promotoraId]: updatedOverrides,
      };
    });
  };

  const handleSaveRow = async (row: any) => {
    setSavingRowId(row.promotoraId);
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
        toast({ title: 'Liquidación Guardada', description: `Grupo ${row.promotoraName} guardado.` });
        
        setOverrides(prev => {
          const next = { ...prev };
          delete next[row.promotoraId];
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

  const handleExportConsolidatedPDF = () => {
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const topMargin = 60;
    const margin = 30;

    const currentPlazaName = plazas.find(p => p.id === selectedPlaza)?.name || '';
    const currentLocName = localidades.find(l => l.id === selectedLocalidad)?.name || '';

    // Paint Title Block
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTROL DE PROMOTORAS - REPORTE CONSOLIDADO DE DEBES', margin, 30);

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('PLAZA:', margin, topMargin + 10);
    doc.text('LOCALIDAD:', margin, topMargin + 25);
    doc.text('SEMANA:', margin, topMargin + 40);

    doc.setFont('helvetica', 'normal');
    doc.text(currentPlazaName.toUpperCase(), margin + 90, topMargin + 10);
    doc.text(currentLocName.toUpperCase(), margin + 90, topMargin + 25);
    doc.text(formatDateStr(selectedWeek), margin + 90, topMargin + 40);

    const rightColX = pageWidth - margin - 220;
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA IMPRESIÓN:', rightColX, topMargin + 10);
    doc.text('GRUPOS MOSTRADOS:', rightColX, topMargin + 25);

    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('es-MX'), rightColX + 130, topMargin + 10);
    doc.text(`${rows.length}`, rightColX + 130, topMargin + 25);

    const tableHeaders = [[
      'GRUPO', 'DEBE ENTREGAR', 'FALLA', 'EFECTIVO', 'RECUPERADO', 'TOTAL', 'DIFERENCIA', '% FALLA', 'VENTA', 'COMISION', 'SEM EXT.'
    ]];

    const tableData = rows.map(r => [
      r.promotoraName.toUpperCase(),
      formatCurrency(r.debeEntregar),
      formatCurrency(r.falla),
      formatCurrency(r.efectivo),
      formatCurrency(r.recuperado),
      formatCurrency(r.total),
      formatCurrency(r.diferencia),
      `${r.fallaPercent.toFixed(1)}%`,
      formatCurrency(r.venta),
      formatCurrency(r.comicion),
      r.semExt.toString()
    ]);

    const footerRow = [
      'TOTAL GENERAL',
      formatCurrency(totals.debeEntregar),
      formatCurrency(totals.falla),
      formatCurrency(totals.efectivo),
      formatCurrency(totals.recuperado),
      formatCurrency(totals.total),
      formatCurrency(totals.diferencia),
      `${totals.fallaPercent.toFixed(1)}%`,
      formatCurrency(totals.venta),
      formatCurrency(totals.comicion),
      totals.semExt.toString()
    ];

    doc.autoTable({
      startY: topMargin + 55,
      head: tableHeaders,
      body: tableData,
      foot: [footerRow],
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        lineWidth: 0.5,
        lineColor: [100, 116, 139],
        fontSize: 7.5,
        cellPadding: { top: 6, right: 4, bottom: 6, left: 4 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 100 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'center' }
      }
    });

    const formattedLoc = currentLocName.toUpperCase().replace(/\s+/g, '_');
    const formattedWeek = formatDateStr(selectedWeek).replace(/\//g, '-');
    doc.save(`DETERMINACION_${formattedLoc}_${formattedWeek}.pdf`);
  };

  const handleExportDraftPDF = () => {
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const topMargin = 60;
    const margin = 30;

    const currentPlazaName = plazas.find(p => p.id === selectedPlaza)?.name || '';
    const currentLocName = localidades.find(l => l.id === selectedLocalidad)?.name || '';

    // Paint Title Block
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CONTROL DE PROMOTORAS - DETERMINACIONES', margin, 30);

    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('PLAZA:', margin, topMargin + 10);
    doc.text('LOCALIDAD:', margin, topMargin + 25);
    doc.text('SEMANA:', margin, topMargin + 40);

    doc.setFont('helvetica', 'normal');
    doc.text(currentPlazaName.toUpperCase(), margin + 90, topMargin + 10);
    doc.text(currentLocName.toUpperCase(), margin + 90, topMargin + 25);
    doc.text(formatDateStr(selectedWeek), margin + 90, topMargin + 40);

    const rightColX = pageWidth - margin - 220;
    doc.setFont('helvetica', 'bold');
    doc.text('GRUPOS MOSTRADOS:', rightColX, topMargin + 10);

    doc.setFont('helvetica', 'normal');
    doc.text(`${rows.length}`, rightColX + 130, topMargin + 10);

    const tableHeaders = [[
      'GRUPO', 'DEBE ENTREGAR', 'FALLA', 'EFECTIVO', 'RECUPERADO', 'TOTAL', 'DIFERENCIA', '% FALLA', 'VENTA', 'COMISION', 'SEM EXT.'
    ]];

    const tableData = rows.map(r => [
      r.promotoraName.toUpperCase(),
      formatCurrency(r.debeEntregar),
      '', // FALLA
      '', // EFECTIVO
      '', // RECUPERADO
      '', // TOTAL
      '', // DIFERENCIA
      '', // % FALLA
      '', // VENTA
      '', // COMISION
      ''  // SEM EXT.
    ]);

    const footerRow = [
      'TOTAL GENERAL',
      formatCurrency(totals.debeEntregar),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ];

    doc.autoTable({
      startY: topMargin + 55,
      head: tableHeaders,
      body: tableData,
      foot: [footerRow],
      theme: 'grid',
      margin: { left: margin, right: margin },
      styles: {
        lineWidth: 0.5,
        lineColor: [100, 116, 139],
        fontSize: 7.5,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left' },
        1: { halign: 'right', fontStyle: 'bold', fontSize: 9.5 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right' },
        7: { halign: 'center' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'center' }
      }
    });

    const formattedLoc = currentLocName.toUpperCase().replace(/\s+/g, '_');
    const formattedWeek = formatDateStr(selectedWeek).replace(/\//g, '-');
    doc.save(`DETERMINACION_${formattedLoc}_${formattedWeek}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Search and hierarchy selectors */}
      <Card className="shadow-lg border-primary/10 overflow-visible bg-background">
        <CardHeader className="bg-primary/5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-sm">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-800 uppercase tracking-tight">DEBES</CardTitle>
              <CardDescription className="text-xs">Consulta y administra la liquidación semanal consolidada de promotoras.</CardDescription>
            </div>
          </div>
          {rows.length > 0 && (
            <Button
              type="button"
              onClick={handleExportConsolidatedPDF}
              className="rounded-xl h-9 px-4 text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-all shadow-sm w-full sm:w-auto uppercase tracking-wider"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </CardHeader>
        <CardContent className="py-4 px-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Plaza */}
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5 tracking-wider">
                <Building className="h-3.5 w-3.5 text-primary" /> Plaza de Operación
              </label>
              <Select value={selectedPlaza} onValueChange={(val) => { setSelectedPlaza(val); setSelectedLocalidad(''); }}>
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
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5 tracking-wider">
                <MapPin className="h-3.5 w-3.5 text-primary" /> Localidad / Sector
              </label>
              <Select value={selectedLocalidad} onValueChange={setSelectedLocalidad} disabled={!selectedPlaza}>
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

            {/* Semana */}
            <div className="space-y-1.5 w-full">
              <label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5 tracking-wider">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Semana de Consulta
              </label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="rounded-xl border-2 h-9 bg-muted/20 hover:bg-muted/30 transition-colors focus:ring-primary text-xs text-left">
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
          </div>
        </CardContent>
      </Card>

      {/* Main calculation sheet table */}
      {selectedLocalidad && selectedWeek ? (
        <Card className="shadow-2xl border-slate-200 overflow-hidden bg-background">
          <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4 px-6">
            <div className="space-y-0.5">
              <CardTitle className="text-base font-bold uppercase text-slate-800">
                DETERMINACION - DEBES
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-semibold text-muted-foreground">
                Localidad: {localidades.find(l => l.id === selectedLocalidad)?.name} | Semana: del {formatDateStr(selectedWeek)}
              </CardDescription>
            </div>
            {rows.length > 0 && (
              <Button
                type="button"
                onClick={handleExportDraftPDF}
                className="rounded-xl h-8 px-3 text-[10px] font-extrabold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-all shadow-sm uppercase tracking-wider"
              >
                <Download className="h-3.5 w-3.5" />
                Borrador Debe
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {rows.length > 0 ? (
              <Table>
                <TableHeader className="bg-slate-100/80">
                  <TableRow className="border-b">
                    <TableHead className="font-extrabold text-left text-[9px] uppercase text-slate-700 py-2 px-3 h-10 min-w-[120px]">Grupo</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[95px]">Debe Entregar</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[85px]">Falla</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[95px]">Efectivo</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[85px]">Recuperado</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[90px]">Total</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[85px]">Diferencia</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[70px]">% Falla</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[85px]">Venta</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[110px]">Comisión</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[70px]">Sem Ext.</TableHead>
                    <TableHead className="font-extrabold text-center text-[9px] uppercase text-slate-700 py-2 px-1 h-10 min-w-[80px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const disabled = isRowDisabled(row);
                    const isUnlocked = unlockedRows[row.promotoraId];

                    return (
                      <TableRow key={row.promotoraId} className={cn("hover:bg-muted/10 transition-colors border-b", row.isDirty && "bg-amber-50/40 hover:bg-amber-50/60 border-l-4 border-l-amber-500")}>
                        {/* Grupo */}
                        <TableCell className="font-extrabold text-left text-[11px] py-3 px-3 text-slate-800 uppercase">
                          {row.promotoraName}
                        </TableCell>

                        {/* Debe Entregar */}
                        <TableCell className="font-extrabold text-center text-[11px] text-slate-600 py-2 px-1 bg-slate-50/50">
                          {isCristobal ? (
                            <Input
                              type="number"
                              value={row.debeEntregar === 0 ? '' : row.debeEntregar}
                              onChange={(e) => handleCellChange(row.promotoraId, 'debeEntregar', Number(e.target.value), row.debeEntregar)}
                              placeholder="0"
                              disabled={disabled}
                              className="h-7 w-[80px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-primary disabled:opacity-85"
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
                            onChange={(e) => handleCellChange(row.promotoraId, 'falla', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={disabled}
                            className="h-7 w-[75px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-red-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Efectivo */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.efectivo === 0 ? '' : row.efectivo}
                            onChange={(e) => handleCellChange(row.promotoraId, 'efectivo', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={disabled}
                            className="h-7 w-[80px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-emerald-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Recuperado */}
                        <TableCell className="text-center py-2 px-1">
                          <Input
                            type="number"
                            value={row.recuperado === 0 ? '' : row.recuperado}
                            onChange={(e) => handleCellChange(row.promotoraId, 'recuperado', Number(e.target.value), row.debeEntregar)}
                            placeholder="0"
                            disabled={disabled}
                            className="h-7 w-[75px] px-0.5 text-xs text-center mx-auto rounded-lg font-semibold tracking-tighter border focus-visible:ring-blue-500 disabled:opacity-85"
                          />
                        </TableCell>

                        {/* Total */}
                        <TableCell className="font-extrabold text-center text-[11px] py-2 px-1 bg-slate-50/50">
                          {formatCurrency(row.total)}
                        </TableCell>

                        {/* Diferencia */}
                        <TableCell className="text-center py-2 px-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            row.diferencia < 0 ? 'bg-red-100 text-red-700' : row.diferencia > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {row.diferencia === 0 ? 'Ø' : formatCurrency(row.diferencia)}
                          </span>
                        </TableCell>

                        {/* % Falla */}
                        <TableCell className="font-extrabold text-center text-[10px] py-2 px-1 text-slate-500">
                          {row.fallaPercent.toFixed(1)}%
                        </TableCell>

                        {/* Venta */}
                        <TableCell className="font-bold text-center text-[11px] text-blue-700 py-2 px-1 bg-blue-50/10">
                          {row.venta === 0 ? 'Ø' : formatCurrency(row.venta)}
                        </TableCell>

                        {/* Comisión */}
                        <TableCell className="text-center py-2 px-1">
                          <div className="flex items-center gap-1 justify-center">
                            <Input
                              type="number"
                              value={row.comicion === 0 ? '' : row.comicion}
                              onChange={(e) => handleCellChange(row.promotoraId, 'comicion', Number(e.target.value), row.debeEntregar)}
                              placeholder="0"
                              disabled={disabled}
                              className="h-7 w-[65px] px-0.5 text-xs text-center rounded-lg font-semibold tracking-tighter border disabled:opacity-85"
                            />
                            <div className="flex items-center gap-0.5 bg-slate-50 border rounded-lg px-0.5 h-7">
                              <Input
                                type="number"
                                value={row.comicionPercent === undefined ? 8 : row.comicionPercent}
                                onChange={(e) => handleCellChange(row.promotoraId, 'comicionPercent', Number(e.target.value), row.debeEntregar)}
                                disabled={disabled}
                                className="h-5 w-9 text-center p-0 font-semibold tracking-tighter border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs disabled:opacity-85"
                                placeholder="8"
                              />
                              <span className="text-[9px] font-black text-slate-500 pr-0.5">%</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Sem Ext. */}
                        <TableCell className="font-extrabold text-center text-[11px] text-orange-600 py-2 px-1 bg-amber-50/10">
                          {row.semExt}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="text-center py-2 px-2">
                          <div className="flex items-center justify-center gap-1.5">
                            {row.isSavedInDb && isCristobal && (
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => toggleUnlockRow(row.promotoraId)}
                                className={cn("h-7 w-7 rounded-lg border", isUnlocked ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200" : "bg-slate-50 hover:bg-slate-100 text-slate-500")}
                                title={isUnlocked ? "Bloquear Fila" : "Desbloquear Fila"}
                              >
                                {isUnlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              </Button>
                            )}

                            {(!row.isSavedInDb || isUnlocked || row.isDirty) && (
                              <Button
                                size="icon"
                                onClick={() => handleSaveRow(row)}
                                disabled={savingRowId === row.promotoraId}
                                className={cn(
                                  "h-7 w-7 rounded-lg text-white transition-all shadow-sm",
                                  row.isDirty 
                                    ? "bg-amber-500 hover:bg-amber-600" 
                                    : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60"
                                )}
                                title="Guardar Fila"
                              >
                                {savingRowId === row.promotoraId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}

                            {row.isSavedInDb && !row.isDirty && !isUnlocked && (
                              <div className="h-7 w-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700" title="Guardado">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* TOTAL GENERAL ROW */}
                  <TableRow className="bg-slate-200 hover:bg-slate-250 border-t-2 border-slate-300 font-extrabold">
                    <TableCell className="font-black text-left text-[11px] py-3 px-3 text-slate-800 uppercase">
                      Total General
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.debeEntregar)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.falla)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.efectivo)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.recuperado)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.total)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px]">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        totals.diferencia < 0 ? 'bg-red-100 text-red-700' : totals.diferencia > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {totals.diferencia === 0 ? 'Ø' : formatCurrency(totals.diferencia)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-3 text-[10px] text-slate-700">
                      {totals.fallaPercent.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-blue-800">
                      {formatCurrency(totals.venta)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-slate-800">
                      {formatCurrency(totals.comicion)}
                    </TableCell>
                    <TableCell className="text-center py-3 text-[11px] text-orange-600">
                      {totals.semExt}
                    </TableCell>
                    <TableCell className="py-3 px-2"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground font-bold uppercase tracking-wider">
                No hay promotoras configuradas en esta localidad.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Coins className="h-16 w-16 text-slate-300 mb-4 animate-pulse" />
            <h3 className="font-black text-slate-700 text-lg uppercase tracking-wide">Consulta de Debes</h3>
            <p className="text-xs max-w-sm mt-1">Selecciona una Plaza, Localidad y Semana de Consulta en los campos superiores para desplegar y administrar las liquidaciones consolidada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
