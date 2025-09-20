import { getClients, getWallet, getWalletTransactions } from "@/lib/firestore-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function WalletPage() {
    const [wallet, transactions, clients] = await Promise.all([
        getWallet(),
        getWalletTransactions(),
        getClients(),
    ]);

    const getClientName = (clientId?: string) => {
        if (!clientId) return 'N/A';
        return clients.find(c => c.id === clientId)?.name || 'Cliente Desconocido';
    }

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
                <h1 className="text-3xl font-bold tracking-tight">Cartera</h1>
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
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Cliente</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length > 0 ? (
                                transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell>
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
                                                <Link href={`/dashboard/clients/${tx.clientId}`} className="text-primary hover:underline">
                                                    {getClientName(tx.clientId)}
                                                </Link>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No hay movimientos registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
