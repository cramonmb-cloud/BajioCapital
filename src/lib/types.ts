export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  street: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  guarantee: string;
  endorsement: string;
  avatarUrl: string;
};

export type LoanPlan = {
  id: string;
  name: string;
  description: string;
  termInWeeks: number;
  weeklyPaymentRate: number; 
};

export type Payment = {
  date: string;
  amount: number;
  weekNumber: number;
};

export type Loan = {
  id: string;
  clientId: string;
  loanPlanId: string;
  groupId?: string; // Added groupId
  amount: number;
  startDate: string;
  status: 'Active' | 'Overdue' | 'Paid Off' | 'Pagado desde CV';
  payments: Payment[];
};

export type Wallet = {
    id: string;
    balance: number;
}

export type WalletTransaction = {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    date: string;
    description: string;
    loanId?: string;
    clientId?: string;
};

export type Supervisor = {
    id: string;
    name: string;
};

export type Group = {
    id: string;
    name: string;
    supervisorId: string;
};

export type UserPermissions = {
    dashboard: boolean;
    clients: boolean;
    loans: boolean;
    overduePortfolio: boolean;
    wallet: boolean;
    plans: boolean;
    settings: boolean;
};

export type AppUser = {
    id: string;
    username: string;
    role: 'admin' | 'supervisor';
    permissions: UserPermissions;
};
