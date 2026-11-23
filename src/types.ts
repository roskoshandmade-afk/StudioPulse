export type UserRole = 'director' | 'assistant' | 'client';

export type ProjectStatus = 'В работе' | 'На паузе' | 'Заморожен' | 'Сдан';

export type PaymentType = 'salary' | 'piecework';

export type AllocationBasis = 'area' | 'hours';

export type DelayReason = 'none' | 'client' | 'studio';

export type PaymentSchemeTemplate = '3-stage-30-50-20' | '2-stage-50-50' | 'custom';

export type ExpenseCategory =
  | 'Печать и альбомы'
  | 'Выкрасы и образцы'
  | 'Бензин и логистика'
  | 'Прочие расходы';

export type CostRoleGroup =
  | 'Дизайнер'
  | 'Визуализатор'
  | 'Чертёжник'
  | 'Замеры'
  | 'Комплектатор'
  | 'Руководитель проекта'
  | 'Печать и логистика'
  | 'Прочие роли';

export type ProjectCostRole =
  | 'Дизайнер'
  | 'Визуализатор'
  | 'Чертёжник'
  | 'Замерщик'
  | 'Комплектатор'
  | 'Бензин и печать альбомов';

export type CostLinePayMode = 'piecework' | 'salary' | 'overhead';
export type SalaryAllocationUnit = 'sqm' | 'days';

export interface ProjectCostLine {
  id: string;
  role: ProjectCostRole;
  assigneeName: string; // Supports совмещение ролей: same person can appear on multiple lines
  memberId?: string; // Optional link to studio team directory
  payMode: CostLinePayMode; // 'piecework' | 'salary' | 'overhead'
  budgetAmount: number; // Used for piecework & overhead; auto-derived for salary
  paidAmount: number; // Already paid ₽
  // Salaried staff allocation fields (when payMode === 'salary')
  monthlySalary?: number;
  salaryUnit?: SalaryAllocationUnit; // 'sqm' (м²) or 'days' (дни)
  workedUnits?: number; // Worked м² or days on this project
  monthlyCapacityUnits?: number; // Total monthly norm (e.g. 22 days or 150 м²)
  note?: string;
}

export interface TeamMember {
  id: string;
  roleTitle: string;
  code: string;
  costGroup: Exclude<CostRoleGroup, 'Печать и логистика'>;
  paymentType: PaymentType;
  monthlySalary: number;
  allocationBasis: AllocationBasis;
  pieceworkRate: number;
  pieceworkUnit: 'м²' | 'этап' | 'выезд';
}

export interface PaymentStage {
  id: string;
  order: number;
  title: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  isPaid: boolean;
  paidDate: string; // YYYY-MM-DD or ''
}

export interface WorkSubStage {
  id: string;
  paymentStageId: string;
  title: string;
  assigneeId: string; // TeamMember.id or ''
  planStart: string; // YYYY-MM-DD
  planEnd: string; // YYYY-MM-DD
  actualStart: string; // YYYY-MM-DD or ''
  actualEnd: string; // YYYY-MM-DD or ''
  progress: number; // 0..100
  delayReason: DelayReason;
  internalNote: string; // Never shown in Client View
}

export interface ProjectLinks {
  proposalUrl: string; // Коммерческое предложение
  measurementUrl: string; // Обмерный план
  folderUrl: string; // Папка с материалами и рендерами
}

export interface Project {
  id: string;
  isDemo?: boolean;
  name: string;
  address: string;
  areaSqm: number;
  ratePerSqm?: number; // Тариф, ₽/м²
  contractAmount?: number; // Итоговая сумма по договору (с учётом округления/скидки)
  paymentScheme?: PaymentSchemeTemplate;
  separateMeasurementFee?: boolean;
  measurementFeeAmount?: number;
  status: ProjectStatus;
  clientContact: string;
  startDate: string; // YYYY-MM-DD
  fotLimitPercent: number; // Default 45
  plannedCategoryBudgets?: Partial<Record<CostRoleGroup, number>>;
  links: ProjectLinks;
  teamIds: string[];
  costLines?: ProjectCostLine[]; // Детальные строки команды, совмещения ролей и накладных расходов
  paymentStages: PaymentStage[];
  workStages: WorkSubStage[];
}

export interface WorklogEntry {
  id: string;
  projectId: string;
  memberId: string;
  month: string; // YYYY-MM
  date: string; // YYYY-MM-DD
  areaSqm: number;
  hours: number;
  pieceworkAmount: number;
  comment: string;
}

export interface DirectExpense {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  comment: string;
}

export interface StudioSettings {
  defaultFotLimitPercent: number;
  studioName: string;
}

export interface AppData {
  version: number;
  settings: StudioSettings;
  team: TeamMember[];
  projects: Project[];
  worklogs: WorklogEntry[];
  expenses: DirectExpense[];
}

export interface SalaryAllocationDetail {
  month: string;
  memberId: string;
  memberRole: string;
  memberCode: string;
  costGroup: CostRoleGroup;
  monthlySalary: number;
  basis: AllocationBasis;
  projectVolume: number;
  totalMonthVolume: number;
  sharePercent: number;
  allocatedAmount: number;
}

export interface CostBreakdownItem {
  group: CostRoleGroup;
  amount: number;
  percent: number;
}

export interface ProjectFinanceSummary {
  contractTotal: number;
  paidTotal: number;
  remainingTotal: number;
  paidPercent: number;
  allocatedSalaryTotal: number;
  pieceworkTotal: number;
  fotTotal: number; // allocatedSalaryTotal + pieceworkTotal
  directExpensesTotal: number;
  totalCosts: number;
  totalCostsPaid: number;
  totalCostsRemaining: number;
  netBalanceFromPaid: number; // paidTotal - totalCosts
  projectedMarginAmount: number; // contractTotal - totalCosts
  projectedMarginPercent: number; // (contractTotal - totalCosts) / contractTotal * 100
  fotPercentOfContract: number; // fotTotal / contractTotal * 100
  fotLimitPercent: number;
  isOverFotLimit: boolean;
  isNegativeMargin: boolean;
  isCashNegative: boolean;
  salaryAllocations: SalaryAllocationDetail[];
  costBreakdown: CostBreakdownItem[];
}

export interface RiskItem {
  id: string;
  severity: 'critical' | 'warning';
  category: 'salary' | 'fot' | 'deadline' | 'payment' | 'margin';
  projectId?: string;
  title: string;
  detail: string;
}
