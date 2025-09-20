export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  guarantee: string;
  endorsement: string;
  avatarUrl: string;
};

export type LoanPlan = {
  id: string;
  name: string;
  description: string;
  termInWeeks: number;
  weeklyPayment: number;
};

export type Payment = {
  id: string;
  loanId: string;
  date: string;
  amount: number;
};

export type Loan = {
  id: string;
  clientId: string;
  loanPlanId: string;
  amount: number;
  startDate: string;
  status: 'Active' | 'Overdue' | 'Paid Off';
  payments: Payment[];
};
