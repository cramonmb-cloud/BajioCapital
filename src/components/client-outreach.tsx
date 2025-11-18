'use client';

import { useState } from 'react';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { getClientOutreachSuggestion, type ClientOutreachInput } from '@/ai/flows/client-outreach-suggestions';


interface ClientOutreachProps {
    clientInfo: ClientOutreachInput;
}

export function ClientOutreach({ clientInfo }: ClientOutreachProps) {
    const [suggestion, setSuggestion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const fetchSuggestion = async () => {
        setIsLoading(true);
        setSuggestion('');
        try {
            const result = await getClientOutreachSuggestion(clientInfo);
            setSuggestion(result.outreachSuggestion);
        } catch (error) {
            console.error('Error fetching outreach suggestion:', error);
            toast({
                variant: 'destructive',
                title: 'Error de IA',
                description: 'No se pudo generar la sugerencia.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" onClick={fetchSuggestion}>
                     {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="mr-2 h-4 w-4 text-yellow-400" />
                    )}
                    Sugerencia IA
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none flex items-center">
                            <Bot className="mr-2 h-4 w-4" />
                            Sugerencia de Contacto
                        </h4>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                             <p className="text-sm text-muted-foreground">
                               {suggestion || 'Haz clic para generar una sugerencia de outreach personalizada para este cliente.'}
                            </p>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
