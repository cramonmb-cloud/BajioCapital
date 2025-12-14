
import { getLoans, getLoanPlans } from '@/lib/firestore-data';
import { ControlClientPage } from '@/components/control-client-page';

export default async function ControlPage() {
    const [loans, loanPlans] = await Promise.all([
        getLoans(),
        getLoanPlans()
    ]);

    return <ControlClientPage initialLoans={loans} initialLoanPlans={loanPlans} />;
}
