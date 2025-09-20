'use client';

import { useState, useTransition } from 'react';
import type { Client, Loan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOutreachSuggestionAction } from '@/app/dashboard/actions';
import { Loader2, Wand2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Terminal } from 'lucide-react';

interface ClientOutreachProps {
  client: Client;
  loans: Loan[];
}

export function ClientOutreach({ client, loans }: ClientOutreachProps) {
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleGenerateSuggestion = () => {
    startTransition(async () => {
      const mostRecentLoan = loans.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
      
      if (!mostRecentLoan) {
        setSuggestion("Este cliente no tiene préstamos para generar una sugerencia.");
        return;
      }
      
      const input = {
        clientId: client.id,
        clientName: client.name,
        loanAmount: mostRecentLoan.amount,
        loanStatus: mostRecentLoan.status,
        paymentHistory: `El cliente tiene ${mostRecentLoan.payments.length} pagos registrados. El préstamo inició el ${new Date(mostRecentLoan.startDate).toLocaleDateString()}.`,
        missedPayments: mostRecentLoan.status === 'Overdue' ? 1 : 0, // Simplified logic
      };

      const result = await getOutreachSuggestionAction(input);
      setSuggestion(result);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sugerencia de Contacto (IA)</CardTitle>
        <CardDescription>
          Genera una sugerencia personalizada sobre cuándo y cómo contactar al cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleGenerateSuggestion} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Generar Sugerencia
        </Button>
        {suggestion && (
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Sugerencia de la IA</AlertTitle>
            <AlertDescription>{suggestion}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
