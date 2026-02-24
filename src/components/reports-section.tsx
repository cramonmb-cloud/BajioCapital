'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import type { Loan, Client, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

interface ReportsSectionProps {
  loans: Loan[];
  clients: Client[];
  loanPlans: LoanPlan[];
  plazas: Plaza[];
  localidades: Localidad[];
  promotoras: Promotora[];
}

export function ReportsSection({ loans, clients, loanPlans, plazas, localidades, promotoras }: ReportsSectionProps) {
  const [selectedPlaza, setSelectedPlaza] = useState('all');
  const [selectedLocalidad, setSelectedLocalidad] = useState('all');
  const [selectedPromotora, setSelectedPromotora] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Alphabetical sorting for selections
  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => a.name.localeCompare(b.name)), [plazas]);

  const filteredLocalidades = useMemo(() => {
    let result = selectedPlaza === 'all' ? localidades : localidades.filter(l => l.plazaId === selectedPlaza);
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedPlaza, localidades]);

  const filteredPromotoras = useMemo(() => {
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

  const handleExportToExcel = () => {
    setIsExporting(true);
    try {
      const dataToExport = loans
        .filter(loan => {
          const promotora = promotoras.find(p => p.id === loan.promotoraId);
          if (!promotora) return false;
          const localidad = localidades.find(l => l.id === promotora.localidadId);
          if (!localidad) return false;

          const plazaMatch = selectedPlaza === 'all' || localidad.plazaId === selectedPlaza;
          const localidadMatch = selectedLocalidad === 'all' || promotora.localidadId === selectedLocalidad;
          const promotoraMatch = selectedPromotora === 'all' || loan.promotoraId === selectedPromotora;

          return plazaMatch && localidadMatch && promotoraMatch;
        })
        .map(loan => {
          const client = clients.find(c => c.id === loan.clientId);
          const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
          const promotora = promotoras.find(p => p.id === loan.promotoraId);
          const localidad = localidades.find(l => l.id === promotora?.localidadId);
          const plaza = plazas.find(p => p.id === localidad?.plazaId);

          if (!client || !loanPlan || !promotora || !localidad || !plaza) {
            return null;
          }

          // Calculate balance
          const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
          const totalLoanAmount = weeklyPayment * loanPlan.termInWeeks;
          const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
          const balance = totalLoanAmount - totalPaid;

          // Parse endorsement data
          let endorsementName = '', endorsementAddress = '', endorsementPhone = '', endorsementColonia = '', endorsementCP = '';
          const endorsementMatch = client.endorsement.match(/(.*) \((.*)\)/);
          if (endorsementMatch) {
            endorsementName = endorsementMatch[1];
            const details = endorsementMatch[2].split(',').map(s => s.trim());
            const phoneMatch = details.find(d => d.toLowerCase().startsWith('tel:'));
            if(phoneMatch) endorsementPhone = phoneMatch.replace(/tel:/i, '').trim();

            // Simplified address parsing
            endorsementAddress = details[0] || '';
            endorsementColonia = details[1] || '';
            endorsementCP = details[2] || '';
          } else {
            endorsementName = client.endorsement;
          }

          return {
            'Plaza': plaza.name,
            'Localidad': localidad.name,
            'Promotora': promotora.name,
            'Cliente': client.name,
            'Dirección': client.street,
            'Telefonos': client.phone,
            'Colonia': client.neighborhood,
            'C.P.': client.postalCode,
            'Aval': endorsementName,
            'Dirección Aval': endorsementAddress,
            'Telefonos Aval': endorsementPhone,
            'Colonia Aval': endorsementColonia,
            'C.P. Aval': endorsementCP,
            'Fecha del Prestamo': new Date(loan.startDate).toLocaleDateString('es-MX'),
            'Cantidad del Prestamo': loan.amount,
            'Saldo': balance > 0 ? balance : 0,
          };
        })
        .filter(item => item !== null);

      if (dataToExport.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Sin Datos',
          description: 'No hay datos para exportar con los filtros seleccionados.',
        });
        return;
      }
      
      const worksheet = XLSX.utils.json_to_sheet(dataToExport as any[]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Prestamos');

      // Formatting currency columns
      const currencyFormat = '"$"#,##0.00';
      const currencyCols = ['Cantidad del Prestamo', 'Saldo'];
      const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({ wch: key.length + 5 }));

      (dataToExport as any[]).forEach((row, rowIndex) => {
        Object.keys(row).forEach((key, colIndex) => {
             if (row[key] && row[key].length > colWidths[colIndex].wch) {
                colWidths[colIndex].wch = row[key].length + 2;
             }
             if(currencyCols.includes(key)) {
                const cellRef = XLSX.utils.encode_cell({c: colIndex, r: rowIndex + 1});
                if(worksheet[cellRef]) worksheet[cellRef].z = currencyFormat;
             }
        });
      });
      worksheet['!cols'] = colWidths;

      const plazaName = selectedPlaza === 'all' ? 'General' : plazas.find(p => p.id === selectedPlaza)?.name || '';
      const localidadName = selectedLocalidad === 'all' ? '' : localidades.find(l => l.id === selectedLocalidad)?.name || '';
      const promotoraName = selectedPromotora === 'all' ? '' : promotoras.find(p => p.id === selectedPromotora)?.name || '';

      const fileNameParts = ['Reporte', plazaName, localidadName, promotoraName].filter(Boolean);
      const fileName = `${fileNameParts.join('_')}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast({
        title: 'Exportación Exitosa',
        description: `${dataToExport.length} registros exportados a Excel.`,
      });

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        variant: 'destructive',
        title: 'Error de Exportación',
        description: 'No se pudo generar el archivo de Excel.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informes</CardTitle>
        <CardDescription>
          Exporta información detallada de los préstamos a un archivo de Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Plaza</label>
            <Select value={selectedPlaza} onValueChange={setSelectedPlaza}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {sortedPlazas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Localidad</label>
            <Select value={selectedLocalidad} onValueChange={setSelectedLocalidad}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {filteredLocalidades.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Promotora</label>
            <Select value={selectedPromotora} onValueChange={setSelectedPromotora}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {filteredPromotoras.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleExportToExcel} disabled={isExporting} className="w-full">
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Exportar a Excel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
