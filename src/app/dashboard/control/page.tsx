import { getClients, getLoanPlans, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import { ControlClientPage } from '@/components/control-client-page';

export default async function ControlPage() {
    const [clients, loanPlans, plazas, localidades, promotoras] = await Promise.all([
        getClients(),
        getLoanPlans(),
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
    ]);

    return <ControlClientPage 
                initialClients={clients} 
                initialLoanPlans={loanPlans}
                initialPlazas={plazas}
                initialLocalidades={localidades}
                initialPromotoras={promotoras}
            />;
}
