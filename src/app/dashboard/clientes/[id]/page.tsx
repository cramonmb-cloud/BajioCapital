
import { notFound } from 'next/navigation';
import { getClient, getLoans, getLoanPlans, getUsers, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, Home, Shield, UserCheck } from 'lucide-react';
import { ClientPageActions } from './page-actions';
import { ClientLoansTable } from './client-loans-table';


export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  
  if (!client) {
    notFound();
  }

  const [clientLoans, loanPlans, allLoans, users, plazas, localidades, promotoras] = await Promise.all([
      getLoans(params.id),
      getLoanPlans(),
      getLoans(),
      getUsers(),
      getPlazas(),
      getLocalidades(),
      getPromotoras(),
  ]);

  const fullAddress = `${client.street}, ${client.neighborhood}, C.P. ${client.postalCode}, ${client.city}`;
  
  let endorsementName = client.endorsement;
  let endorsementDetails = '';
  const endorsementMatch = client.endorsement.match(/(.*) \((.*)\)/);
  if (endorsementMatch) {
    endorsementName = endorsementMatch[1];
    endorsementDetails = endorsementMatch[2];
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20 border">
            <AvatarImage src={client.avatarUrl} alt={client.name} />
            <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <p className="text-muted-foreground">ID de Cliente: {client.id}</p>
            </div>
        </div>
        <ClientPageActions clientId={client.id} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Préstamos del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientLoansTable 
                clientLoans={clientLoans} 
                loanPlans={loanPlans} 
                allLoans={allLoans}
                users={users}
                plazas={plazas}
                localidades={localidades}
                promotoras={promotoras}
              />
            </CardContent>
          </Card>
          
        </div>

        <div className="space-y-6">
           <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
               <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Email</span>
                    <p className="text-muted-foreground">{client.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Teléfono</span>
                    <p className="text-muted-foreground">{client.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Home className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Dirección</span>
                    <p className="text-muted-foreground">{fullAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Garantías y Avales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
               <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Garantía</span>
                    <p className="text-muted-foreground">{client.guarantee}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserCheck className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Aval</span>
                    <p className="text-muted-foreground font-semibold">{endorsementName}</p>
                    {endorsementDetails && <p className="text-muted-foreground">{endorsementDetails}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
