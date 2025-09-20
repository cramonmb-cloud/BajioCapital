import type { Client, LoanPlan, Loan, Payment } from './types';

export const clients: Client[] = [
  {
    id: '1',
    name: 'Ana García',
    email: 'ana.garcia@example.com',
    phone: '555-0101',
    address: 'Calle Falsa 123, Springfield',
    guarantee: 'Propiedad en Av. Siempreviva 742',
    endorsement: 'Homero Simpson',
    avatarUrl: 'https://picsum.photos/seed/1/40/40',
  },
  {
    id: '2',
    name: 'Carlos Rodriguez',
    email: 'carlos.r@example.com',
    phone: '555-0102',
    address: 'Boulevard de los Sueños Rotos 45',
    guarantee: 'Vehículo Toyota Corolla 2022',
    endorsement: 'Maria Hernandez',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
  },
  {
    id: '3',
    name: 'Sofia Martinez',
    email: 'sofia.m@example.com',
    phone: '555-0103',
    address: 'Plaza Mayor 1, Madrid',
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
    termInWeeks: 24,
    weeklyPaymentRate: 75,
  },
];

const payments: Payment[] = [
  { id: 'p1', loanId: 'loan-1', date: '2025-05-10', amount: 110 },
  { id: 'p2', loanId: 'loan-1', date: '2025-05-17', amount: 110 },
  { id: 'p3', loanId: 'loan-2', date: '2025-05-15', amount: 500 },
];

export const loans: Loan[] = [
  {
    id: 'loan-1',
    clientId: '1',
    loanPlanId: 'plan-1',
    amount: 1000,
    startDate: '2025-05-03',
    status: 'Active',
    payments: payments.filter(p => p.loanId === 'loan-1'),
  },
  {
    id: 'loan-2',
    clientId: '2',
    loanPlanId: 'plan-3',
    amount: 2000,
    startDate: '2025-05-01',
    status: 'Overdue',
    payments: payments.filter(p => p.loanId === 'loan-2'),
  },
  {
    id: 'loan-3',
    clientId: '3',
    loanPlanId: 'plan-2',
    amount: 500,
    startDate: '2025-02-01',
    status: 'Paid Off',
    payments: [],
  },
   {
    id: 'loan-4',
    clientId: '1',
    loanPlanId: 'plan-2',
    amount: 3000,
    startDate: '2025-06-01',
    status: 'Active',
    payments: [],
  },
];
