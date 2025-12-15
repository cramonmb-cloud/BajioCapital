
import { getLoans, getLoanPlans, getClients, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import { ControlClientPage } from '@/components/control-client-page';

export default async function ControlPage() {
    const [loans, loanPlans, clients, plazas, localidades, promotoras] = await Promise.all([
        getLoans(),
        getLoanPlans(),
        getClients(),
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
    ]);

    return <ControlClientPage 
                initialLoans={loans} 
                initialLoanPlans={loanPlans}
                clients={clients}
                plazas={plazas}
                localidades={localidades}
                promotoras={promotoras}
            />;
}
