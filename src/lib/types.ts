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
  highlight?: boolean;
};

export type Payment = {
  date: string;
  amount: number;
  weekNumber: number;
  isRecovered?: boolean;
};

export type Loan = {
  id: string;
  clientId: string;
  loanPlanId: string;
  promotoraId?: string;
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
    userId?: string;
};

export type Plaza = {
    id: string;
    name: string;
    highlight?: boolean;
};

export type Localidad = {
    id: string;
    name: string;
    plazaId: string;
    highlight?: boolean;
};

export type Promotora = {
    id: string;
    name: string;
    localidadId: string;
    highlight?: boolean;
};

export type PromotoraSettlement = {
    id: string; // promotoraId_weekDate
    promotoraId: string;
    weekDate: string; // Saturday ISO string
    debeEntregar: number;
    falla: number;
    efectivo: number;
    recuperado: number;
    total: number;
    diferencia: number;
    deuda: number;
    venta: number;
    comicion: number;
    comicionPercent?: number;
    abonoSemanal: number;
    adelEnt: number;
    adelSal: number;
};

export type UserPermissions = {
    dashboard: boolean;
    clients: boolean;
    consultarCliente: boolean;
    loans: boolean;
    overduePortfolio: boolean;
    carteraVencida: boolean;
    wallet: boolean;
    plans: boolean;
    settings: boolean;
    editClients: boolean;
    control: boolean;
    debes: boolean;
    // Granular settings
    manageUsers: boolean;
    manageZones: boolean;
    manageMigration: boolean;
    managePlans: boolean;
    manageSystem: boolean;
    manageMaintenance: boolean;
    manageAvisos: boolean;
    // Mobile
    showMobileNavBar: boolean;
    mobileSections: string[];
};

export type AppUser = {
    id: string;
    username: string;
    role: 'admin' | 'supervisor';
    permissions: UserPermissions;
    password?: string;
    assignedPlazaIds?: string[];
    assignedLocalidadIds?: string[];
};

export type WhatsAppTemplates = {
    client: string;
    aval: string;
};

export type AppConfig = {
  appName?: string;
  logoUrl?: string;
  pwaLogoUrl?: string;
  logoFormat?: 'square' | 'horizontal';
  logoHeightHeader?: number;
  logoWidthHeader?: number;
  logoHeightDashboard?: number;
  logoWidthDashboard?: number;
  logoHeightLogin?: number;
  logoWidthLogin?: number;
  whatsappTemplate?: string; // Mantener por compatibilidad con default client
  whatsappTemplates?: Record<string, WhatsAppTemplates>; // PlazaId -> Templates
  menuConfig?: Record<string, 'operacion' | 'administracion'>;
  operacionColor?: string;
  administracionColor?: string;
};

export type Aviso = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: string; // ISO string
  createdBy: string; // Username
  readBy: string[]; // List of usernames who marked Enterado
  active: boolean;
};
