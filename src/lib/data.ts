import type { Client, LoanPlan, Loan, Payment } from './types';

export const clients: Client[] = [
  {
    id: '1',
    name: 'Ana García',
    email: 'ana.garcia@example.com',
    phone: '555-0101',
    street: 'Calle Falsa 123',
    neighborhood: 'Centro',
    postalCode: '12345',
    city: 'Springfield',
    guarantee: 'Propiedad en Av. Siempreviva 742',
    endorsement: 'Homero Simpson',
    avatarUrl: 'https://picsum.photos/seed/1/40/40',
  },
  {
    id: '2',
    name: 'Carlos Rodriguez',
    email: 'carlos.r@example.com',
    phone: '555-0102',
    street: 'Boulevard de los Sueños Rotos 45',
    neighborhood: 'Norte',
    postalCode: '67890',
    city: 'Shelbyville',
    guarantee: 'Vehículo Toyota Corolla 2022',
    endorsement: 'Maria Hernandez',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
  },
  {
    id: '3',
    name: 'Sofia Martinez',
    email: 'sofia.m@example.com',
    phone: '555-0103',
    street: 'Plaza Mayor 1',
    neighborhood: 'Distrito Capital',
    postalCode: '28012',
    city: 'Madrid',
    guarantee: 'Nómina de empresa',
    endorsement: 'Juan Perez',
    avatarUrl: 'https://picsum.photos/seed/3/40/40',
  },
];

export const loanPlans: LoanPlan[] = [
  {
    id: 'plan-1',
    name: 'Plan Semanal Básico',
    description: 'Abonos fijos semanales durante 12 semanas.',
    termInWeeks: 12,
    weeklyPaymentRate: 110,
  },
  {
    id: 'plan-2',
    name: 'Plan Rápido',
    description: 'Paga tu préstamo en menos tiempo con abonos semanales.',
    termInWeeks: 8,
    weeklyPaymentRate: 150,
  },
  {
    id: 'plan-3',
    name: 'Plan Extendido',
    description: 'Abonos semanales más pequeños por un período más largo.',
    termInWeeks: 14,
    weeklyPaymentRate: 75,
  },
];

const getPastDate = (weeksAgo: number) => {
    const date = new Date();
    date.setDate(date.getDate() - (weeksAgo * 7));
    return date.toISOString().split('T')[0];
};


export const loans: Loan[] = [
  {
    id: 'loan-1',
    clientId: '1',
    loanPlanId: 'plan-1',
    amount: 1000,
    startDate: getPastDate(4),
    status: 'Active',
    payments: [],
    promotoraId: 'promotora-1',
  },
  {
    id: 'loan-2',
    clientId: '2',
    loanPlanId: 'plan-3', // 14 weeks plan
    amount: 2000,
    startDate: getPastDate(10), // Started 10 weeks ago
    status: 'Overdue',
    payments: [
        // Paid first 3 weeks
        { date: getPastDate(9), amount: 150, weekNumber: 1 },
        { date: getPastDate(8), amount: 150, weekNumber: 2 },
        { date: getPastDate(7), amount: 150, weekNumber: 3 },
        // Missed week 4 and 5 (triggers penalty)
        // Paid week 6
        { date: getPastDate(4), amount: 150, weekNumber: 6 },
        // Missed all subsequent weeks
    ],
    promotoraId: 'promotora-2',
  },
  {
    id: 'loan-3',
    clientId: '3',
    loanPlanId: 'plan-2',
    amount: 500,
    startDate: getPastDate(20),
    status: 'Paid Off',
    payments: [],
    promotoraId: 'promotora-1',
  },
   {
    id: 'loan-4',
    clientId: '1',
    loanPlanId: 'plan-2',
    amount: 3000,
    startDate: getPastDate(1),
    status: 'Active',
    payments: [],
    promotoraId: 'promotora-2',
  },
];
