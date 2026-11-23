import {
  buildPaymentStagesForScheme,
  createId,
  createWorkStagesForScheme,
} from '../data/demoData';
import {
  CommercialProposal,
  Project,
  ProposalExtraOption,
  ProposalPaymentTemplate,
  ProposalTariffKey,
  TeamMember,
} from '../types';
import { getTodayIso } from './calculations';

export interface ProposalTariffPreset {
  key: ProposalTariffKey;
  title: string;
  shortTitle: string;
  defaultRatePerSqm: number;
  subtitle: string;
  defaultWorkingDays3: [number, number, number];
  defaultWorkingDays2: [number, number];
  deliverables: string[];
}

export const PROPOSAL_TARIFFS: Record<ProposalTariffKey, ProposalTariffPreset> = {
  planning: {
    key: 'planning',
    title: 'Планировочное решение',
    shortTitle: 'Планировка',
    defaultRatePerSqm: 1200,
    subtitle: 'Обмеры, 3 варианта планировки, план демонтажа/монтажа, расстановка мебели',
    defaultWorkingDays3: [5, 7, 5],
    defaultWorkingDays2: [8, 7],
    deliverables: [
      'Выезд на объект, лазерные обмеры помещений и фотофиксация',
      'Обмерный план с привязкой инженерных коммуникаций',
      'Разработка 3 вариантов планировочного решения с зонированием',
      'Итоговый утверждённый план расстановки мебели и оборудования',
      'План демонтажа и монтажа перегородок с размерами',
    ],
  },
  working: {
    key: 'working',
    title: 'Рабочий проект (Чертежи)',
    shortTitle: 'Чертежи',
    defaultRatePerSqm: 2200,
    subtitle: 'Планировка + полный альбом рабочих чертежей для строителей',
    defaultWorkingDays3: [10, 16, 10],
    defaultWorkingDays2: [14, 18],
    deliverables: [
      'Полный состав пакета «Планировочное решение» (обмеры, 3 варианта, демонтаж/монтаж)',
      'Планы полов, тёплых полов, потолков, разрезы и узлы примыканий',
      'Планы электрики: розетки, электровыводы, освещение и сценарии выключателей',
      'План сантехнических привязок и развёртки стен всех помещений',
      'Ведомость отделочных площадей и комплект чертежей для строительной бригады',
    ],
  },
  full: {
    key: 'full',
    title: 'Полный дизайн-проект',
    shortTitle: 'Полный проект',
    defaultRatePerSqm: 3500,
    subtitle: 'Планировка + 3D-визуализация всех помещений + чертежи + ведомость материалов',
    defaultWorkingDays3: [12, 22, 16],
    defaultWorkingDays2: [20, 25],
    deliverables: [
      'Лазерные обмеры, подробное ТЗ и 3 варианта планировочного решения',
      'Концептуальные мудборды, подбор палитры и стилевой концепции',
      'Фотореалистичная 3D-визуализация всех проектируемых помещений',
      'Полный альбом рабочих чертежей для строительной бригады',
      'Ведомость отделочных материалов, освещения, сантехники и мебели',
      'Подготовка и выдача печатного альбома А3 + PDF-комплекта',
    ],
  },
};

export const PROPOSAL_TARIFF_LIST: ProposalTariffPreset[] = [
  PROPOSAL_TARIFFS.planning,
  PROPOSAL_TARIFFS.working,
  PROPOSAL_TARIFFS.full,
];

export function createDefaultExtraOptions(): ProposalExtraOption[] {
  return [
    {
      id: 'opt_supervision',
      title: 'Авторский надзор',
      description: 'Плановые выезды на объект, контроль соответствия стройки проекту и консультации прораба',
      price: 35000,
      enabled: false,
    },
    {
      id: 'opt_procurement',
      title: 'Комплектация объекта',
      description: 'Подбор поставщиков, запрос счетов, проверка образцов и контроль графика поставок',
      price: 45000,
      enabled: false,
    },
    {
      id: 'opt_lighting',
      title: 'Светотехнический расчёт',
      description: 'Расчёт уровня освещённости (люкс) и подбор светового оборудования под сценарии',
      price: 18000,
      enabled: false,
    },
    {
      id: 'opt_engineering',
      title: 'Координация инженерных разделов',
      description: 'Увязка чертежей с проектами вентиляции, кондиционирования и «умного дома»',
      price: 25000,
      enabled: false,
    },
  ];
}

export interface CalculatedPaymentStage {
  order: number;
  title: string;
  sharePercent: number;
  workingDays: number;
  rawAmount: number;
  deductedAdvance: number;
  payableAmount: number;
  note?: string;
}

export interface ProposalFinancialBreakdown {
  safeAreaSqm: number;
  isAreaValid: boolean;
  ratePerSqm: number;
  baseDesignTotal: number;
  extrasTotal: number;
  subtotalBeforeDiscount: number;
  discountAmount: number;
  discountEffectivePercent: number;
  finalTotal: number;
  effectiveRatePerSqm: number;
  measurementAdvance: number;
  advanceOverflowApplied: boolean;
  stages: CalculatedPaymentStage[];
  totalPayableStages: number;
  totalWorkingDays: number;
  validUntilDate: string;
}

function addCalendarDays(isoDate: string, days: number): string {
  const base = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return getTodayIso();
  base.setDate(base.getDate() + Math.max(0, Math.round(days)));
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(
    base.getDate()
  ).padStart(2, '0')}`;
}

export function getDefaultStageDays(
  tariffKey: ProposalTariffKey,
  template: ProposalPaymentTemplate
): number[] {
  const preset = PROPOSAL_TARIFFS[tariffKey] || PROPOSAL_TARIFFS.full;
  return template === '2-stage-50-50'
    ? [...preset.defaultWorkingDays2]
    : [...preset.defaultWorkingDays3];
}

export function calculateProposalFinancials(
  proposal: CommercialProposal
): ProposalFinancialBreakdown {
  const rawArea = Number(proposal.areaSqm);
  const isAreaValid = Number.isFinite(rawArea) && rawArea > 0;
  const safeAreaSqm = isAreaValid ? rawArea : 0;
  const ratePerSqm = Math.max(0, Math.round(Number(proposal.ratePerSqm) || 0));

  const baseDesignTotal = Math.round(safeAreaSqm * ratePerSqm);
  const extrasTotal = (proposal.extraOptions || [])
    .filter((o) => o.enabled)
    .reduce((acc, o) => acc + Math.max(0, Math.round(Number(o.price) || 0)), 0);

  const subtotalBeforeDiscount = baseDesignTotal + extrasTotal;

  const rawDiscount = Math.max(0, Number(proposal.discountValue) || 0);
  const discountAmount =
    proposal.discountType === 'percent'
      ? Math.round(subtotalBeforeDiscount * (Math.min(100, rawDiscount) / 100))
      : Math.min(subtotalBeforeDiscount, Math.round(rawDiscount));

  const finalTotal = Math.max(0, subtotalBeforeDiscount - discountAmount);
  const discountEffectivePercent =
    subtotalBeforeDiscount > 0 ? (discountAmount / subtotalBeforeDiscount) * 100 : 0;
  const effectiveRatePerSqm = safeAreaSqm > 0 ? Math.round(finalTotal / safeAreaSqm) : 0;

  const requestedAdvance = proposal.deductMeasurementAdvance
    ? Math.max(0, Math.round(Number(proposal.measurementAdvanceAmount) || 0))
    : 0;
  const measurementAdvance = Math.min(finalTotal, requestedAdvance);

  const defaultDays = getDefaultStageDays(proposal.tariffKey, proposal.paymentTemplate);
  const getDays = (idx: number) => {
    const val = Number(proposal.stageWorkingDays?.[idx]);
    return Number.isFinite(val) && val > 0 ? Math.round(val) : defaultDays[idx] || 10;
  };

  let rawStages: Array<{
    order: number;
    title: string;
    sharePercent: number;
    workingDays: number;
    rawAmount: number;
  }>;

  if (proposal.paymentTemplate === '2-stage-50-50') {
    const s1 = Math.round(finalTotal * 0.5);
    const s2 = Math.max(0, finalTotal - s1);
    rawStages = [
      {
        order: 1,
        title: 'Этап 1. Старт проекта, планировка и концепция',
        sharePercent: 50,
        workingDays: getDays(0),
        rawAmount: s1,
      },
      {
        order: 2,
        title: 'Этап 2. Визуализация, рабочие чертежи и выдача альбома',
        sharePercent: 50,
        workingDays: getDays(1),
        rawAmount: s2,
      },
    ];
  } else {
    const s1 = Math.round(finalTotal * 0.3);
    const s2 = Math.round(finalTotal * 0.5);
    const s3 = Math.max(0, finalTotal - s1 - s2);
    rawStages = [
      {
        order: 1,
        title: 'Этап 1. Планировочное решение и концепция',
        sharePercent: 30,
        workingDays: getDays(0),
        rawAmount: s1,
      },
      {
        order: 2,
        title: 'Этап 2. 3D-визуализация и согласование материалов',
        sharePercent: 50,
        workingDays: getDays(1),
        rawAmount: s2,
      },
      {
        order: 3,
        title: 'Этап 3. Альбом рабочих чертежей и ведомость',
        sharePercent: 20,
        workingDays: getDays(2),
        rawAmount: s3,
      },
    ];
  }

  // Apply measurement advance deduction starting from Stage 1, with strict >= 0 protection
  let remainingAdvanceToDeduct = measurementAdvance;
  let advanceOverflowApplied = false;

  const stages: CalculatedPaymentStage[] = rawStages.map((st, idx) => {
    const deducted = Math.min(st.rawAmount, remainingAdvanceToDeduct);
    if (idx > 0 && deducted > 0) {
      advanceOverflowApplied = true;
    }
    remainingAdvanceToDeduct = Math.max(0, remainingAdvanceToDeduct - deducted);
    const payableAmount = Math.max(0, st.rawAmount - deducted);

    return {
      order: st.order,
      title: st.title,
      sharePercent: st.sharePercent,
      workingDays: st.workingDays,
      rawAmount: st.rawAmount,
      deductedAdvance: deducted,
      payableAmount,
      note:
        deducted > 0
          ? `С учётом вычета аванса за замеры (−${deducted.toLocaleString('ru-RU')} ₽)`
          : undefined,
    };
  });

  const totalPayableStages = stages.reduce((acc, s) => acc + s.payableAmount, 0);
  const totalWorkingDays = stages.reduce((acc, s) => acc + s.workingDays, 0);
  const validUntilDate = addCalendarDays(
    proposal.createdAt || getTodayIso(),
    Math.max(1, Number(proposal.validityDays) || 14)
  );

  return {
    safeAreaSqm,
    isAreaValid,
    ratePerSqm,
    baseDesignTotal,
    extrasTotal,
    subtotalBeforeDiscount,
    discountAmount,
    discountEffectivePercent,
    finalTotal,
    effectiveRatePerSqm,
    measurementAdvance,
    advanceOverflowApplied,
    stages,
    totalPayableStages,
    totalWorkingDays,
    validUntilDate,
  };
}

export function generateNextProposalNumber(existing: CommercialProposal[]): string {
  const year = new Date().getFullYear();
  const prefix = `КП-${year}-`;
  let maxNum = 0;
  for (const p of existing) {
    const m = p.number.match(/(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
}

export function createNewProposalDraft(existing: CommercialProposal[] = []): CommercialProposal {
  const today = getTodayIso();
  const preset = PROPOSAL_TARIFFS.full;
  return {
    id: createId('kp'),
    number: generateNextProposalNumber(existing),
    createdAt: today,
    updatedAt: new Date().toISOString(),
    status: 'Черновик',
    clientName: '',
    clientContact: '',
    city: 'Симферополь',
    objectName: '',
    objectType: 'Жилой интерьер',
    areaSqm: 78,
    measurementLink: '',
    tariffKey: 'full',
    ratePerSqm: preset.defaultRatePerSqm,
    deliverables: [...preset.deliverables],
    discountType: 'percent',
    discountValue: 0,
    extraOptions: createDefaultExtraOptions(),
    deductMeasurementAdvance: true,
    measurementAdvanceAmount: 10000,
    paymentTemplate: '3-stage-30-50-20',
    stageWorkingDays: [...preset.defaultWorkingDays3],
    revisionRounds: 2,
    albumFormat: 'Печатный альбом формата А3 (2 экз.) + электронная версия PDF',
    validityDays: 14,
    studioPhone: '+7 (978) 840-12-40',
    studioEmail: 'hello@studiopulse.ru',
    directorName: 'Руководитель студии «Студия Пульс»',
    extraNotes:
      'Сроки указаны в рабочих днях без учёта времени согласования этапов со стороны Заказчика.',
  };
}

export function createSampleProposal(): CommercialProposal {
  const today = getTodayIso();
  const preset = PROPOSAL_TARIFFS.full;
  return {
    id: 'kp_sample_aura',
    number: `КП-${new Date().getFullYear()}-01`,
    createdAt: today,
    updatedAt: new Date().toISOString(),
    status: 'Отправлено клиенту',
    clientName: 'Анна Соколова',
    clientContact: '+7 (978) 512-34-89 · Telegram',
    city: 'Симферополь',
    objectName: 'ЖК Аура, 3-комн. квартира',
    objectType: 'Жилой интерьер',
    areaSqm: 86,
    measurementLink: '',
    tariffKey: 'full',
    ratePerSqm: preset.defaultRatePerSqm,
    deliverables: [...preset.deliverables],
    discountType: 'percent',
    discountValue: 5,
    extraOptions: createDefaultExtraOptions().map((opt) =>
      opt.id === 'opt_supervision' ? { ...opt, enabled: true } : opt
    ),
    deductMeasurementAdvance: true,
    measurementAdvanceAmount: 10000,
    paymentTemplate: '3-stage-30-50-20',
    stageWorkingDays: [...preset.defaultWorkingDays3],
    revisionRounds: 2,
    albumFormat: 'Печатный альбом формата А3 (2 экз.) + электронная версия PDF',
    validityDays: 14,
    studioPhone: '+7 (978) 840-12-40',
    studioEmail: 'hello@studiopulse.ru',
    directorName: 'Руководитель студии «Студия Пульс»',
    extraNotes:
      'Аванс за выезд и лазерные обмеры (10 000 ₽) полностью засчитывается в счёт первого этапа при подписании договора.',
  };
}

/**
 * Converts an approved CommercialProposal into a live Project in Studio Pulse
 * with exact budget, measurement advance deduction, payment schedule, and Gantt stages.
 */
export function convertProposalToProject(
  proposal: CommercialProposal,
  team: TeamMember[],
  defaultFotLimitPercent: number
): Project {
  const fin = calculateProposalFinancials(proposal);
  const today = getTodayIso();
  const safeArea = Math.max(1, fin.safeAreaSqm);

  const objectTitle = proposal.objectName.trim() || `Объект по ${proposal.number}`;
  const fullAddress = [proposal.city.trim(), proposal.objectName.trim()]
    .filter(Boolean)
    .join(', ');
  const clientContactLine = [proposal.clientName.trim(), proposal.clientContact.trim()]
    .filter(Boolean)
    .join(' · ');

  const hasAdvance = proposal.deductMeasurementAdvance && fin.measurementAdvance > 0;

  const paymentStages = buildPaymentStagesForScheme({
    scheme: proposal.paymentTemplate,
    contractTotal: fin.finalTotal,
    startDate: today,
    separateMeasurementFee: hasAdvance,
    measurementFeeAmount: fin.measurementAdvance,
  });

  // If measurement advance was deducted, mark leading "Замеры" row as already paid
  if (hasAdvance && paymentStages.length > 0 && paymentStages[0].title === 'Замеры') {
    paymentStages[0] = {
      ...paymentStages[0],
      isPaid: true,
      paidDate: today,
    };
  }

  const workStages = createWorkStagesForScheme(
    proposal.paymentTemplate,
    paymentStages,
    today,
    team
  );

  return {
    id: createId('proj'),
    isDemo: false,
    name: objectTitle,
    address: fullAddress || proposal.city.trim() || 'Адрес уточняется',
    areaSqm: safeArea,
    ratePerSqm: fin.effectiveRatePerSqm || fin.ratePerSqm,
    contractAmount: fin.finalTotal,
    paymentScheme: proposal.paymentTemplate,
    separateMeasurementFee: hasAdvance,
    measurementFeeAmount: fin.measurementAdvance,
    status: 'В работе',
    clientContact: clientContactLine || 'Контакт клиента не указан',
    startDate: today,
    fotLimitPercent: defaultFotLimitPercent || 45,
    links: {
      proposalUrl: '',
      measurementUrl: proposal.measurementLink.trim(),
      folderUrl: '',
    },
    teamIds: team.map((m) => m.id),
    costLines: [],
    paymentStages,
    workStages,
  };
}
