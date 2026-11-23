import {
  AppData,
  PaymentSchemeTemplate,
  PaymentStage,
  Project,
  TeamMember,
  WorkSubStage,
} from '../types';

export function createId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_FOT_LIMIT_PERCENT = 45;

export const DEFAULT_TEAM: TeamMember[] = [
  {
    id: 'tm_designer',
    roleTitle: 'Дизайнер (ведущий)',
    code: 'ДИЗ',
    costGroup: 'Дизайнер',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 400,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_visualizer',
    roleTitle: 'Визуализатор 3D',
    code: 'ВИЗ',
    costGroup: 'Визуализатор',
    paymentType: 'salary',
    monthlySalary: 95000,
    allocationBasis: 'area',
    pieceworkRate: 0,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_drafter',
    roleTitle: 'Чертёжник / Рабочая документация',
    code: 'ЧРТ',
    costGroup: 'Чертёжник',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 350,
    pieceworkUnit: 'м²',
  },
  {
    id: 'tm_measurer',
    roleTitle: 'Замерщик',
    code: 'ЗМР',
    costGroup: 'Замеры',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 10000,
    pieceworkUnit: 'выезд',
  },
  {
    id: 'tm_complectator',
    roleTitle: 'Комплектатор',
    code: 'КМП',
    costGroup: 'Комплектатор',
    paymentType: 'piecework',
    monthlySalary: 0,
    allocationBasis: 'area',
    pieceworkRate: 25000,
    pieceworkUnit: 'этап',
  },
  {
    id: 'tm_assistant',
    roleTitle: 'Личный ассистент / РП',
    code: 'АСС',
    costGroup: 'Руководитель проекта',
    paymentType: 'salary',
    monthlySalary: 65000,
    allocationBasis: 'hours',
    pieceworkRate: 0,
    pieceworkUnit: 'этап',
  },
];

function getRelativeDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToIso(baseIso: string, offsetDays: number): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generates exact payment stages matching studio templates:
 * - Шаблон А (30% / 50% / 20%) — for apartments >= 75 м² and offices
 * - Шаблон Б (50% / 50%) — for apartments <= 70 м²
 * When separateMeasurementFee is enabled, creates row 0 "Замеры" and subtracts it from Stage 1
 * so that the sum of all stages strictly equals contractTotal.
 */
export function buildPaymentStagesForScheme(params: {
  scheme: Exclude<PaymentSchemeTemplate, 'custom'>;
  contractTotal: number;
  startDate: string;
  separateMeasurementFee: boolean;
  measurementFeeAmount: number;
}): PaymentStage[] {
  const total = Math.max(0, Math.round(params.contractTotal));
  const mFee = params.separateMeasurementFee
    ? Math.min(total, Math.max(0, Math.round(params.measurementFeeAmount)))
    : 0;
  const start = params.startDate || getRelativeDate(0);

  const stages: PaymentStage[] = [];
  let order = 1;

  if (params.separateMeasurementFee && mFee > 0) {
    stages.push({
      id: createId('ps'),
      order: order++,
      title: 'Замеры',
      amount: mFee,
      dueDate: addDaysToIso(start, 0),
      isPaid: false,
      paidDate: '',
    });
  }

  if (params.scheme === '3-stage-30-50-20') {
    const rawStage1 = Math.round(total * 0.3);
    const stage2 = Math.round(total * 0.5);
    const stage3 = Math.max(0, total - rawStage1 - stage2);

    // Subtract measurement fee from Stage 1; if mFee > rawStage1, rebalance gracefully
    const stage1 = Math.max(0, rawStage1 - mFee);
    const remainderDelta = total - (mFee + stage1 + stage2 + stage3);
    const adjustedStage2 = Math.max(0, stage2 + remainderDelta);

    stages.push(
      {
        id: createId('ps'),
        order: order++,
        title:
          mFee > 0
            ? 'Этап 1. Аванс 30% (за вычетом замеров)'
            : 'Этап 1. Аванс 30%',
        amount: stage1,
        dueDate: addDaysToIso(start, 3),
        isPaid: false,
        paidDate: '',
      },
      {
        id: createId('ps'),
        order: order++,
        title: 'Этап 2. Аванс 50%',
        amount: adjustedStage2,
        dueDate: addDaysToIso(start, 25),
        isPaid: false,
        paidDate: '',
      },
      {
        id: createId('ps'),
        order: order++,
        title: 'Этап 3. Остаток 20%',
        amount: stage3,
        dueDate: addDaysToIso(start, 52),
        isPaid: false,
        paidDate: '',
      }
    );
  } else {
    const rawStage1 = Math.round(total * 0.5);
    const stage2 = Math.max(0, total - rawStage1);
    const stage1 = Math.max(0, rawStage1 - mFee);
    const remainderDelta = total - (mFee + stage1 + stage2);
    const adjustedStage2 = Math.max(0, stage2 + remainderDelta);

    stages.push(
      {
        id: createId('ps'),
        order: order++,
        title:
          mFee > 0
            ? 'Этап 1. Аванс 50% (за вычетом замеров)'
            : 'Этап 1. Аванс 50%',
        amount: stage1,
        dueDate: addDaysToIso(start, 3),
        isPaid: false,
        paidDate: '',
      },
      {
        id: createId('ps'),
        order: order++,
        title: 'Этап 2. Остаток 50%',
        amount: adjustedStage2,
        dueDate: addDaysToIso(start, 32),
        isPaid: false,
        paidDate: '',
      }
    );
  }

  return stages;
}

/**
 * Generates studio Gantt work sub-stages for Шаблон А (30/50/20) or Шаблон Б (50/50).
 */
export function createWorkStagesForScheme(
  scheme: PaymentSchemeTemplate,
  paymentStages: PaymentStage[],
  startDateStr: string,
  team: TeamMember[]
): WorkSubStage[] {
  const start = startDateStr || getRelativeDate(0);
  const findByGroup = (group: string) =>
    team.find((m) => m.costGroup === group)?.id || team[0]?.id || '';

  // Skip leading "Замеры" payment row when binding main work stages to Этап 1 / 2 / 3
  const hasSeparateMeas =
    paymentStages.length > 0 && paymentStages[0].title.toLowerCase().includes('замер');
  const mainStages = hasSeparateMeas ? paymentStages.slice(1) : paymentStages;

  const psMeas = hasSeparateMeas ? paymentStages[0].id : mainStages[0]?.id || paymentStages[0]?.id || '';
  const ps1 = mainStages[0]?.id || paymentStages[0]?.id || '';
  const ps2 = mainStages[1]?.id || ps1;
  const ps3 = mainStages[2]?.id || ps2;

  if (!ps1) return [];

  const mk = (
    paymentStageId: string,
    title: string,
    group: string,
    dStart: number,
    dEnd: number
  ): WorkSubStage => ({
    id: createId('ws'),
    paymentStageId,
    title,
    assigneeId: findByGroup(group),
    planStart: addDaysToIso(start, dStart),
    planEnd: addDaysToIso(start, dEnd),
    actualStart: '',
    actualEnd: '',
    progress: 0,
    delayReason: 'none',
    internalNote: '',
  });

  if (scheme === '2-stage-50-50') {
    return [
      // Этап 1 (Аванс 50% минус замеры)
      mk(psMeas || ps1, 'Замеры', 'Замеры', 0, 2),
      mk(ps1, 'Планировка', 'Дизайнер', 3, 10),
      mk(ps1, 'Мудборды', 'Дизайнер', 11, 16),
      mk(ps1, 'Визы кухни и с/у', 'Визуализатор', 17, 26),
      // Этап 2 (Остаток 50%)
      mk(ps2, 'Визы остальных зон', 'Визуализатор', 27, 38),
      mk(ps2, 'Вся рабочая документация', 'Чертёжник', 39, 52),
      mk(ps2, 'Ведомости и печать альбома', 'Дизайнер', 53, 58),
    ];
  }

  // Default: Шаблон А — 3 этапа (30% / 50% / 20%)
  return [
    // Этап 1 (Аванс 30% минус замеры)
    mk(psMeas || ps1, 'Замеры', 'Замеры', 0, 3),
    mk(ps1, 'Планировочное решение', 'Дизайнер', 4, 12),
    mk(ps1, 'Коллажи / ТЗ', 'Дизайнер', 13, 19),
    mk(ps1, 'Старт-визы (кухня и с/у)', 'Визуализатор', 20, 29),
    // Этап 2 (Аванс 50%)
    mk(ps2, '3D-визуализация всех помещений', 'Визуализатор', 30, 46),
    mk(ps2, 'Правки по концепции', 'Дизайнер', 47, 52),
    mk(ps2, 'Выезд в салоны', 'Комплектатор', 50, 56),
    // Этап 3 (Остаток 20%)
    mk(ps3, 'Полный комплект рабочей документации', 'Чертёжник', 57, 72),
    mk(ps3, 'Ведомость материалов', 'Комплектатор', 70, 77),
    mk(ps3, 'Печать альбома (2 экз.)', 'Дизайнер', 78, 81),
  ];
}

export function createStandardWorkTemplate(
  paymentStages: PaymentStage[],
  startDateStr: string,
  team: TeamMember[]
): WorkSubStage[] {
  return createWorkStagesForScheme('3-stage-30-50-20', paymentStages, startDateStr, team);
}

/**
 * Realistic anonymized 3-project demo portfolio of the design studio.
 * Can be deleted in 1 click via «Удалить демо-данные и начать с нуля».
 */
export function createDemoData(): AppData {
  // ---------------------------------------------------------------------------
  // 1. «ЖК Лазурный берег» — 139 м², договор 275 000 ₽, схема 30/50/20
  //    Замеры 10к ✓, Этап 1 70к ✓, Этап 2 130к ✓, Этап 3 65к ✕
  //    Команда: Дизайнер София 50к, Визер Полина 40к, Чертёж Алина 50к,
  //             Замеры Вика 10к, Бензин/печать 10к
  // ---------------------------------------------------------------------------
  const p1Id = 'proj_demo_lazurny';
  const p1Meas = 'ps_laz_0';
  const p1S1 = 'ps_laz_1';
  const p1S2 = 'ps_laz_2';
  const p1S3 = 'ps_laz_3';

  const projectLazurny: Project = {
    id: p1Id,
    isDemo: true,
    name: 'ЖК Лазурный берег',
    address: 'Приморский б-р, д. 14, кв. 86',
    areaSqm: 139,
    ratePerSqm: 2000,
    contractAmount: 275000,
    paymentScheme: '3-stage-30-50-20',
    separateMeasurementFee: true,
    measurementFeeAmount: 10000,
    status: 'В работе',
    clientContact: 'Заказчик · +7 (900) 111-22-33 · Telegram',
    startDate: getRelativeDate(-46),
    fotLimitPercent: DEFAULT_FOT_LIMIT_PERCENT,
    links: {
      proposalUrl: 'https://studiopulse.ru/#kp-lazurny',
      measurementUrl: 'https://studiopulse.ru/#obmer-lazurny',
      folderUrl: 'https://studiopulse.ru/#folder-lazurny',
    },
    teamIds: ['tm_designer', 'tm_visualizer', 'tm_drafter', 'tm_measurer'],
    costLines: [
      {
        id: 'cl_laz_1',
        role: 'Дизайнер',
        assigneeName: 'София',
        memberId: 'tm_designer',
        payMode: 'piecework',
        budgetAmount: 50000,
        paidAmount: 35000,
        note: 'Планировочное решение, ТЗ, коллажи, авторский контроль',
      },
      {
        id: 'cl_laz_2',
        role: 'Визуализатор',
        assigneeName: 'Полина',
        memberId: 'tm_visualizer',
        payMode: 'piecework',
        budgetAmount: 40000,
        paidAmount: 40000,
        note: 'Старт-визы кухни/с/у + 3D всех помещений',
      },
      {
        id: 'cl_laz_3',
        role: 'Чертёжник',
        assigneeName: 'Алина',
        memberId: 'tm_drafter',
        payMode: 'piecework',
        budgetAmount: 50000,
        paidAmount: 20000,
        note: 'Полный комплект рабочей документации (139 м²)',
      },
      {
        id: 'cl_laz_4',
        role: 'Замерщик',
        assigneeName: 'Вика',
        memberId: 'tm_measurer',
        payMode: 'piecework',
        budgetAmount: 10000,
        paidAmount: 10000,
        note: 'Лазерный обмер и обмерный план DWG/PDF',
      },
      {
        id: 'cl_laz_5',
        role: 'Бензин и печать альбомов',
        assigneeName: 'Накладные объекта',
        payMode: 'overhead',
        budgetAmount: 10000,
        paidAmount: 4500,
        note: 'Выезды в салоны, бензин, печать альбома (2 экз.)',
      },
    ],
    paymentStages: [
      {
        id: p1Meas,
        order: 1,
        title: 'Замеры',
        amount: 10000,
        dueDate: getRelativeDate(-46),
        isPaid: true,
        paidDate: getRelativeDate(-46),
      },
      {
        id: p1S1,
        order: 2,
        title: 'Этап 1. Аванс 30% (за вычетом замеров)',
        amount: 70000,
        dueDate: getRelativeDate(-43),
        isPaid: true,
        paidDate: getRelativeDate(-42),
      },
      {
        id: p1S2,
        order: 3,
        title: 'Этап 2. Аванс 50%',
        amount: 130000,
        dueDate: getRelativeDate(-18),
        isPaid: true,
        paidDate: getRelativeDate(-17),
      },
      {
        id: p1S3,
        order: 4,
        title: 'Этап 3. Остаток 20%',
        amount: 65000,
        dueDate: getRelativeDate(12),
        isPaid: false,
        paidDate: '',
      },
    ],
    workStages: [
      {
        id: 'ws_laz_1',
        paymentStageId: p1Meas,
        title: 'Замеры',
        assigneeId: 'tm_measurer',
        planStart: getRelativeDate(-46),
        planEnd: getRelativeDate(-44),
        actualStart: getRelativeDate(-46),
        actualEnd: getRelativeDate(-44),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Обмеры и фотофиксация завершены.',
      },
      {
        id: 'ws_laz_2',
        paymentStageId: p1S1,
        title: 'Планировочное решение',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-43),
        planEnd: getRelativeDate(-35),
        actualStart: getRelativeDate(-43),
        actualEnd: getRelativeDate(-34),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Утверждён 2-й вариант с просторной кухней-гостиной.',
      },
      {
        id: 'ws_laz_3',
        paymentStageId: p1S1,
        title: 'Коллажи / ТЗ',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-34),
        planEnd: getRelativeDate(-28),
        actualStart: getRelativeDate(-34),
        actualEnd: getRelativeDate(-27),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_laz_4',
        paymentStageId: p1S1,
        title: 'Старт-визы (кухня и с/у)',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-27),
        planEnd: getRelativeDate(-19),
        actualStart: getRelativeDate(-27),
        actualEnd: getRelativeDate(-18),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_laz_5',
        paymentStageId: p1S2,
        title: '3D-визуализация всех помещений',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-18),
        planEnd: getRelativeDate(-5),
        actualStart: getRelativeDate(-17),
        actualEnd: getRelativeDate(-4),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Все рендеры приняты заказчиком.',
      },
      {
        id: 'ws_laz_6',
        paymentStageId: p1S2,
        title: 'Правки по концепции',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-5),
        planEnd: getRelativeDate(-1),
        actualStart: getRelativeDate(-4),
        actualEnd: getRelativeDate(-1),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_laz_7',
        paymentStageId: p1S2,
        title: 'Выезд в салоны',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-2),
        planEnd: getRelativeDate(2),
        actualStart: getRelativeDate(-2),
        actualEnd: '',
        progress: 80,
        delayReason: 'none',
        internalNote: 'Подобран керамогранит и паркетная доска, остался свет.',
      },
      {
        id: 'ws_laz_8',
        paymentStageId: p1S3,
        title: 'Полный комплект рабочей документации',
        assigneeId: 'tm_drafter',
        planStart: getRelativeDate(0),
        planEnd: getRelativeDate(12),
        actualStart: getRelativeDate(0),
        actualEnd: '',
        progress: 40,
        delayReason: 'none',
        internalNote: 'В работе планы электрики и развёртки стен.',
      },
      {
        id: 'ws_laz_9',
        paymentStageId: p1S3,
        title: 'Ведомость материалов',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(10),
        planEnd: getRelativeDate(16),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_laz_10',
        paymentStageId: p1S3,
        title: 'Печать альбома (2 экз.)',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(17),
        planEnd: getRelativeDate(19),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
    ],
  };

  // ---------------------------------------------------------------------------
  // 2. «Бизнес-центр Север» — 298 м², офис, договор 200 000 ₽ со скидкой, 30/50/20
  //    Замеры 10к ✓, Этап 1 50к ✓, Этап 2 100к ✓, Этап 3 40к ✕
  //    Команда: Арт-дир 0₽, Визер Алина 40к, Чертёж Елена 74 500 ₽,
  //             Замеры Вика 5к, Бензин/печать 10к
  // ---------------------------------------------------------------------------
  const p2Id = 'proj_demo_sever';
  const p2Meas = 'ps_sev_0';
  const p2S1 = 'ps_sev_1';
  const p2S2 = 'ps_sev_2';
  const p2S3 = 'ps_sev_3';

  const projectSever: Project = {
    id: p2Id,
    isDemo: true,
    name: 'Бизнес-центр Север',
    address: 'Северный пр-т, д. 7, офис 402 (298 м²)',
    areaSqm: 298,
    ratePerSqm: 1000,
    contractAmount: 200000,
    paymentScheme: '3-stage-30-50-20',
    separateMeasurementFee: true,
    measurementFeeAmount: 10000,
    status: 'В работе',
    clientContact: 'Руководитель АХО · +7 (900) 444-55-66',
    startDate: getRelativeDate(-55),
    fotLimitPercent: DEFAULT_FOT_LIMIT_PERCENT,
    links: {
      proposalUrl: 'https://studiopulse.ru/#kp-sever',
      measurementUrl: 'https://studiopulse.ru/#obmer-sever',
      folderUrl: '',
    },
    teamIds: ['tm_designer', 'tm_visualizer', 'tm_drafter', 'tm_measurer'],
    costLines: [
      {
        id: 'cl_sev_1',
        role: 'Дизайнер',
        assigneeName: 'Арт-дир',
        memberId: 'tm_designer',
        payMode: 'piecework',
        budgetAmount: 0,
        paidAmount: 0,
        note: 'Ведение концепции арт-директором без выделенного гонорара',
      },
      {
        id: 'cl_sev_2',
        role: 'Визуализатор',
        assigneeName: 'Алина',
        memberId: 'tm_visualizer',
        payMode: 'piecework',
        budgetAmount: 40000,
        paidAmount: 40000,
        note: '3D-визуализация ресепшн, опенспейс и переговорных',
      },
      {
        id: 'cl_sev_3',
        role: 'Чертёжник',
        assigneeName: 'Елена',
        memberId: 'tm_drafter',
        payMode: 'piecework',
        budgetAmount: 74500,
        paidAmount: 40000,
        note: 'Рабочая документация офиса 298 м² (250 ₽/м²)',
      },
      {
        id: 'cl_sev_4',
        role: 'Замерщик',
        assigneeName: 'Вика',
        memberId: 'tm_measurer',
        payMode: 'piecework',
        budgetAmount: 5000,
        paidAmount: 5000,
        note: 'Обмеры и сверка с планом БТИ',
      },
      {
        id: 'cl_sev_5',
        role: 'Бензин и печать альбомов',
        assigneeName: 'Накладные объекта',
        payMode: 'overhead',
        budgetAmount: 10000,
        paidAmount: 6000,
        note: 'Выезды на объект, печать 2 альбомов А3',
      },
    ],
    paymentStages: [
      {
        id: p2Meas,
        order: 1,
        title: 'Замеры',
        amount: 10000,
        dueDate: getRelativeDate(-55),
        isPaid: true,
        paidDate: getRelativeDate(-55),
      },
      {
        id: p2S1,
        order: 2,
        title: 'Этап 1. Аванс 30% (за вычетом замеров)',
        amount: 50000,
        dueDate: getRelativeDate(-52),
        isPaid: true,
        paidDate: getRelativeDate(-50),
      },
      {
        id: p2S2,
        order: 3,
        title: 'Этап 2. Аванс 50%',
        amount: 100000,
        dueDate: getRelativeDate(-22),
        isPaid: true,
        paidDate: getRelativeDate(-20),
      },
      {
        id: p2S3,
        order: 4,
        title: 'Этап 3. Остаток 20%',
        amount: 40000,
        dueDate: getRelativeDate(-2),
        isPaid: false,
        paidDate: '',
      },
    ],
    workStages: [
      {
        id: 'ws_sev_1',
        paymentStageId: p2Meas,
        title: 'Замеры',
        assigneeId: 'tm_measurer',
        planStart: getRelativeDate(-55),
        planEnd: getRelativeDate(-52),
        actualStart: getRelativeDate(-55),
        actualEnd: getRelativeDate(-52),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sev_2',
        paymentStageId: p2S1,
        title: 'Планировочное решение',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-51),
        planEnd: getRelativeDate(-42),
        actualStart: getRelativeDate(-51),
        actualEnd: getRelativeDate(-40),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Согласовано зонирование на 32 рабочих места.',
      },
      {
        id: 'ws_sev_3',
        paymentStageId: p2S1,
        title: 'Коллажи / ТЗ',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-41),
        planEnd: getRelativeDate(-34),
        actualStart: getRelativeDate(-40),
        actualEnd: getRelativeDate(-33),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sev_4',
        paymentStageId: p2S1,
        title: 'Старт-визы (кухня и с/у)',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-33),
        planEnd: getRelativeDate(-24),
        actualStart: getRelativeDate(-33),
        actualEnd: getRelativeDate(-23),
        progress: 100,
        delayReason: 'none',
        internalNote: 'Кофе-поинт, ресепшн и санузлы.',
      },
      {
        id: 'ws_sev_5',
        paymentStageId: p2S2,
        title: '3D-визуализация всех помещений',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-23),
        planEnd: getRelativeDate(-10),
        actualStart: getRelativeDate(-22),
        actualEnd: getRelativeDate(-8),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sev_6',
        paymentStageId: p2S2,
        title: 'Правки по концепции',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-10),
        planEnd: getRelativeDate(-6),
        actualStart: getRelativeDate(-8),
        actualEnd: getRelativeDate(-5),
        progress: 100,
        delayReason: 'client',
        internalNote: 'Согласование фирменного цвета переговорной.',
      },
      {
        id: 'ws_sev_7',
        paymentStageId: p2S3,
        title: 'Полный комплект рабочей документации',
        assigneeId: 'tm_drafter',
        planStart: getRelativeDate(-12),
        planEnd: getRelativeDate(-2),
        actualStart: getRelativeDate(-10),
        actualEnd: '',
        progress: 75,
        delayReason: 'studio',
        internalNote: 'Большой объём узлов по слаботочке и вентиляции — задержка 2 дня.',
      },
      {
        id: 'ws_sev_8',
        paymentStageId: p2S3,
        title: 'Ведомость материалов и печать альбома (2 экз.)',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(1),
        planEnd: getRelativeDate(6),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
    ],
  };

  // ---------------------------------------------------------------------------
  // 3. «ЖК Скандинавия» — 58 м², договор 145 000 ₽, схема 50/50
  //    Замеры 10к ✓, Этап 1 60к ✓, Этап 2 75к ✕
  //    Включает пример совмещения ролей (Алина: Визуализатор + Чертёжник)
  // ---------------------------------------------------------------------------
  const p3Id = 'proj_demo_scandinavia';
  const p3Meas = 'ps_sca_0';
  const p3S1 = 'ps_sca_1';
  const p3S2 = 'ps_sca_2';

  const projectScandinavia: Project = {
    id: p3Id,
    isDemo: true,
    name: 'ЖК Скандинавия',
    address: 'Скандинавский б-р, д. 19, кв. 114',
    areaSqm: 58,
    ratePerSqm: 2500,
    contractAmount: 145000,
    paymentScheme: '2-stage-50-50',
    separateMeasurementFee: true,
    measurementFeeAmount: 10000,
    status: 'В работе',
    clientContact: 'Заказчик · +7 (900) 777-88-99 · WhatsApp',
    startDate: getRelativeDate(-21),
    fotLimitPercent: DEFAULT_FOT_LIMIT_PERCENT,
    links: {
      proposalUrl: 'https://studiopulse.ru/#kp-scandinavia',
      measurementUrl: '',
      folderUrl: '',
    },
    teamIds: ['tm_designer', 'tm_visualizer', 'tm_drafter', 'tm_measurer'],
    costLines: [
      {
        id: 'cl_sca_1',
        role: 'Дизайнер',
        assigneeName: 'София',
        memberId: 'tm_designer',
        payMode: 'piecework',
        budgetAmount: 22000,
        paidAmount: 11000,
        note: 'Планировка, мудборды и ведение объекта 58 м²',
      },
      {
        id: 'cl_sca_2',
        role: 'Визуализатор',
        assigneeName: 'Алина',
        memberId: 'tm_visualizer',
        payMode: 'piecework',
        budgetAmount: 18000,
        paidAmount: 18000,
        note: 'Визы кухни, с/у и спальни (совмещение ролей)',
      },
      {
        id: 'cl_sca_3',
        role: 'Чертёжник',
        assigneeName: 'Алина',
        memberId: 'tm_drafter',
        payMode: 'piecework',
        budgetAmount: 18000,
        paidAmount: 0,
        note: 'Вся рабочая документация 58 м² (совмещение ролей)',
      },
      {
        id: 'cl_sca_4',
        role: 'Замерщик',
        assigneeName: 'Вика',
        memberId: 'tm_measurer',
        payMode: 'piecework',
        budgetAmount: 5000,
        paidAmount: 5000,
        note: 'Лазерный обмер 58 м²',
      },
      {
        id: 'cl_sca_5',
        role: 'Бензин и печать альбомов',
        assigneeName: 'Накладные объекта',
        payMode: 'overhead',
        budgetAmount: 5000,
        paidAmount: 1500,
        note: 'Печать альбома и дорога',
      },
    ],
    paymentStages: [
      {
        id: p3Meas,
        order: 1,
        title: 'Замеры',
        amount: 10000,
        dueDate: getRelativeDate(-21),
        isPaid: true,
        paidDate: getRelativeDate(-21),
      },
      {
        id: p3S1,
        order: 2,
        title: 'Этап 1. Аванс 50% (за вычетом замеров)',
        amount: 60000,
        dueDate: getRelativeDate(-18),
        isPaid: true,
        paidDate: getRelativeDate(-18),
      },
      {
        id: p3S2,
        order: 3,
        title: 'Этап 2. Остаток 50%',
        amount: 75000,
        dueDate: getRelativeDate(15),
        isPaid: false,
        paidDate: '',
      },
    ],
    workStages: [
      {
        id: 'ws_sca_1',
        paymentStageId: p3Meas,
        title: 'Замеры',
        assigneeId: 'tm_measurer',
        planStart: getRelativeDate(-21),
        planEnd: getRelativeDate(-19),
        actualStart: getRelativeDate(-21),
        actualEnd: getRelativeDate(-19),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sca_2',
        paymentStageId: p3S1,
        title: 'Планировка',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-18),
        planEnd: getRelativeDate(-12),
        actualStart: getRelativeDate(-18),
        actualEnd: getRelativeDate(-12),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sca_3',
        paymentStageId: p3S1,
        title: 'Мудборды',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(-11),
        planEnd: getRelativeDate(-6),
        actualStart: getRelativeDate(-11),
        actualEnd: getRelativeDate(-5),
        progress: 100,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sca_4',
        paymentStageId: p3S1,
        title: 'Визы кухни и с/у',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(-5),
        planEnd: getRelativeDate(4),
        actualStart: getRelativeDate(-5),
        actualEnd: '',
        progress: 70,
        delayReason: 'client',
        internalNote: 'Ждём обратную связь по оттенку фасадов кухни.',
      },
      {
        id: 'ws_sca_5',
        paymentStageId: p3S2,
        title: 'Визы остальных зон',
        assigneeId: 'tm_visualizer',
        planStart: getRelativeDate(5),
        planEnd: getRelativeDate(13),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sca_6',
        paymentStageId: p3S2,
        title: 'Вся рабочая документация',
        assigneeId: 'tm_drafter',
        planStart: getRelativeDate(14),
        planEnd: getRelativeDate(24),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
      {
        id: 'ws_sca_7',
        paymentStageId: p3S2,
        title: 'Ведомости и печать альбома',
        assigneeId: 'tm_designer',
        planStart: getRelativeDate(25),
        planEnd: getRelativeDate(28),
        actualStart: '',
        actualEnd: '',
        progress: 0,
        delayReason: 'none',
        internalNote: '',
      },
    ],
  };

  return {
    version: 2,
    settings: {
      defaultFotLimitPercent: DEFAULT_FOT_LIMIT_PERCENT,
      studioName: 'Студия Пульс',
    },
    team: DEFAULT_TEAM,
    projects: [projectLazurny, projectSever, projectScandinavia],
    worklogs: [],
    expenses: [],
  };
}

export function createEmptyData(): AppData {
  return {
    version: 2,
    settings: {
      defaultFotLimitPercent: DEFAULT_FOT_LIMIT_PERCENT,
      studioName: 'Студия Пульс',
    },
    team: DEFAULT_TEAM,
    projects: [],
    worklogs: [],
    expenses: [],
  };
}
