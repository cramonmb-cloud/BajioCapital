import type { Client, LoanPlan, Loan, Payment, Plaza, Localidad, Promotora } from './types';

export const clients: Client[] = [
  {
    id: 'client-1',
    name: 'ANA GARCIA',
    email: 'ana.garcia@example.com',
    phone: '555-0101',
    street: 'CALLE FALSA 123',
    neighborhood: 'CENTRO',
    postalCode: '12345',
    city: 'SPRINGFIELD',
    guarantee: 'PROPIEDAD EN AV. SIEMPREVIVA 742',
    endorsement: 'HOMERO SIMPSON (AV. SIEMPREVIVA 742, TEL: 555-1234)',
    avatarUrl: 'https://picsum.photos/seed/1/40/40',
  },
  {
    id: 'client-2',
    name: 'CARLOS RODRIGUEZ',
    email: 'carlos.r@example.com',
    phone: '555-0102',
    street: 'BOULEVARD DE LOS SUEÑOS ROTOS 45',
    neighborhood: 'NORTE',
    postalCode: '67890',
    city: 'SHELBYVILLE',
    guarantee: 'VEHÍCULO TOYOTA COROLLA 2022',
    endorsement: 'MARIA HERNANDEZ (CALLE LOMBARD 10, TEL: 555-5678)',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
  },
  {
    id: 'client-3',
    name: 'SOFIA MARTINEZ',
    email: 'sofia.m@example.com',
    phone: '555-0103',
    street: 'PLAZA MAYOR 1',
    neighborhood: 'DISTRITO CAPITAL',
    postalCode: '28012',
    city: 'MADRID',
    guarantee: 'NÓMINA DE EMPRESA',
    endorsement: 'JUAN PEREZ (GRAN VIA 22, TEL: 555-8765)',
    avatarUrl: 'https://picsum.photos/seed/3/40/40',
  },
    {
    id: 'client-4',
    name: 'LUIS FERNANDEZ',
    email: 'luis.f@example.com',
    phone: '555-0104',
    street: 'AV. REFORMA 222',
    neighborhood: 'JUAREZ',
    postalCode: '06600',
    city: 'CIUDAD DE MEXICO',
    guarantee: 'FACTURA DE NEGOCIO',
    endorsement: 'ELENA GOMEZ (CALLE FLORENCIA 30, TEL: 555-4321)',
    avatarUrl: 'https://picsum.photos/seed/4/40/40',
  },
];

export const loanPlans: LoanPlan[] = [
  {
    id: 'plan-1',
    name: 'PLAN SEMANAL BÁSICO',
    description: 'Abonos fijos semanales durante 12 semanas.',
    termInWeeks: 12,
    weeklyPaymentRate: 110,
  },
  {
    id: 'plan-2',
    name: 'PLAN RÁPIDO',
    description: 'Paga tu préstamo en menos tiempo con abonos semanales.',
    termInWeeks: 8,
    weeklyPaymentRate: 150,
  },
  {
    id: 'plan-3',
    name: 'PLAN EXTENDIDO',
    description: 'Abonos semanales más pequeños por un período más largo.',
    termInWeeks: 14,
    weeklyPaymentRate: 100,
  },
];

export const plazas: Plaza[] = [
    { id: 'plaza-1', name: 'PLAZA MATRIZ' },
    { id: 'plaza-2', name: 'PLAZA NORTE' },
];

export const localidades: Localidad[] = [
    { id: 'localidad-1', name: 'ZONA CENTRO', plazaId: 'plaza-1' },
    { id: 'localidad-2', name: 'ZONA SUR', plazaId: 'plaza-1' },
    { id: 'localidad-3', name: 'DELEGACION NORTE', plazaId: 'plaza-2' },
];

export const promotoras: Promotora[] = [
    { id: 'promotora-1', name: 'MARIA', localidadId: 'localidad-1' },
    { id: 'promotora-2', name: 'JOSE', localidadId: 'localidad-1' },
    { id: 'promotora-3', name: 'LAURA', localidadId: 'localidad-2' },
    { id: 'promotora-4', name: 'PEDRO', localidadId: 'localidad-3' },
];


const getPastDate = (weeksAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (weeksAgo * 7));
    return date.toISOString().split('T')[0];
};

const generatePayments = (loanPlanId: string, loanAmount: number, weeksToPay: number, weeksToMiss: number[] = []) => {
    const plan = loanPlans.find(p => p.id === loanPlanId);
    if (!plan) return [];
    const weeklyPayment = (loanAmount / 1000) * plan.weeklyPaymentRate;
    const payments: Payment[] = [];
    for (let i = 1; i <= weeksToPay; i++) {
        if (!weeksToMiss.includes(i)) {
            payments.push({
                date: getPastDate(plan.termInWeeks - i),
                amount: weeklyPayment,
                weekNumber: i,
            });
        }
    }
    return payments;
}

export const loans: Loan[] = [
  // Loan 1: Active, few payments made
  {
    id: 'loan-1',
    clientId: 'client-1',
    loanPlanId: 'plan-1', // 12 weeks
    amount: 1000,
    startDate: getPastDate(4),
    status: 'Active',
    payments: generatePayments('plan-1', 1000, 2),
    promotoraId: 'promotora-1',
  },
  // Loan 2: Overdue, several missed payments
  {
    id: 'loan-2',
    clientId: 'client-2',
    loanPlanId: 'plan-3', // 14 weeks
    amount: 2000,
    startDate: getPastDate(10),
    status: 'Overdue',
    payments: generatePayments('plan-3', 2000, 8, [4, 5, 7]), // Paid 5 weeks out of 8 past weeks
    promotoraId: 'promotora-3',
  },
  // Loan 3: Paid Off completely and on time
  {
    id: 'loan-3',
    clientId: 'client-3',
    loanPlanId: 'plan-2', // 8 weeks
    amount: 500,
    startDate: getPastDate(10),
    status: 'Paid Off',
    payments: generatePayments('plan-2', 500, 8),
    promotoraId: 'promotora-2',
  },
   // Loan 4: New loan, just started, active
  {
    id: 'loan-4',
    clientId: 'client-1', // Same client as loan-1, but previous is paid/different
    loanPlanId: 'plan-2', // 8 weeks
    amount: 3000,
    startDate: getPastDate(1),
    status: 'Active',
    payments: [],
    promotoraId: 'promotora-1',
  },
   // Loan 5: Was overdue, but now paid off (Pagado desde CV)
  {
    id: 'loan-5',
    clientId: 'client-4',
    loanPlanId: 'plan-1', // 12 weeks
    amount: 1500,
    startDate: getPastDate(15),
    status: 'Pagado desde CV',
    payments: generatePayments('plan-1', 1500, 12, [3, 4]), // Missed some payments but eventually paid all
    promotoraId: 'promotora-4',
  },
];
