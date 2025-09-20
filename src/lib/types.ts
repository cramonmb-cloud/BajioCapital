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
  payments: Omit<Payment, 'id' | 'loanId'>[];
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
