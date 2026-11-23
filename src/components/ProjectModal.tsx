import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, FileText, FolderOpen, Plus, RefreshCw, Ruler, Trash2, X } from 'lucide-react';
import {
  buildPaymentStagesForScheme,
  createId,
  createWorkStagesForScheme,
} from '../data/demoData';
import {
  PaymentSchemeTemplate,
  PaymentStage,
  Project,
  ProjectStatus,
  TeamMember,
} from '../types';
import { formatCurrency, getTodayIso } from '../utils/calculations';

interface ProjectModalProps {
  open: boolean;
  editingProject: Project | null;
  team: TeamMember[];
  defaultFotLimitPercent: number;
  onSave: (project: Project, isNew: boolean) => void;
  onClose: () => void;
}

const STATUSES: ProjectStatus[] = ['В работе', 'На паузе', 'Заморожен', 'Сдан'];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  editingProject,
  team,
  defaultFotLimitPercent,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [areaSqm, setAreaSqm] = useState<string>('90');
  const [ratePerSqm, setRatePerSqm] = useState<string>('2500');
  const [contractAmount, setContractAmount] = useState<string>('225000');
  const [contractManuallyEdited, setContractManuallyEdited] = useState(false);

  const [paymentScheme, setPaymentScheme] =
    useState<PaymentSchemeTemplate>('3-stage-30-50-20');
  const [separateMeasurementFee, setSeparateMeasurementFee] = useState(true);
  const [measurementFeeAmount, setMeasurementFeeAmount] = useState<string>('10000');

  const [status, setStatus] = useState<ProjectStatus>('В работе');
  const [clientContact, setClientContact] = useState('');
  const [startDate, setStartDate] = useState(getTodayIso());
  const [fotLimitPercent, setFotLimitPercent] = useState<string>(
    String(defaultFotLimitPercent || 45)
  );
  const [proposalUrl, setProposalUrl] = useState('');
  const [measurementUrl, setMeasurementUrl] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [paymentStages, setPaymentStages] = useState<PaymentStage[]>([]);
  const [useTemplateWorkStages, setUseTemplateWorkStages] = useState(true);
  const [error, setError] = useState('');

  // Initialize form whenever modal opens
  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingProject) {
      const stagesTotal = editingProject.paymentStages.reduce(
        (acc, ps) => acc + (Number(ps.amount) || 0),
        0
      );
      const area = editingProject.areaSqm || 0;
      const inferredRate =
        editingProject.ratePerSqm ??
        (area > 0 && stagesTotal > 0 ? Math.round(stagesTotal / area) : 2500);
      const finalContract = editingProject.contractAmount ?? stagesTotal;

      setName(editingProject.name);
      setAddress(editingProject.address);
      setAreaSqm(String(area));
      setRatePerSqm(String(inferredRate));
      setContractAmount(String(finalContract));
      setContractManuallyEdited(true);
      setPaymentScheme(editingProject.paymentScheme || '3-stage-30-50-20');
      setSeparateMeasurementFee(editingProject.separateMeasurementFee ?? false);
      setMeasurementFeeAmount(String(editingProject.measurementFeeAmount ?? 10000));
      setStatus(editingProject.status);
      setClientContact(editingProject.clientContact);
      setStartDate(editingProject.startDate || getTodayIso());
      setFotLimitPercent(String(editingProject.fotLimitPercent || defaultFotLimitPercent || 45));
      setProposalUrl(editingProject.links.proposalUrl);
      setMeasurementUrl(editingProject.links.measurementUrl);
      setFolderUrl(editingProject.links.folderUrl);
      setTeamIds(editingProject.teamIds);
      setPaymentStages(editingProject.paymentStages.map((ps) => ({ ...ps })));
      setUseTemplateWorkStages(false);
    } else {
      const today = getTodayIso();
      const defaultArea = 90;
      const defaultRate = 2500;
      const defaultContract = defaultArea * defaultRate;
      const defaultScheme: Exclude<PaymentSchemeTemplate, 'custom'> = '3-stage-30-50-20';

      setName('');
      setAddress('');
      setAreaSqm(String(defaultArea));
      setRatePerSqm(String(defaultRate));
      setContractAmount(String(defaultContract));
      setContractManuallyEdited(false);
      setPaymentScheme(defaultScheme);
      setSeparateMeasurementFee(true);
      setMeasurementFeeAmount('10000');
      setStatus('В работе');
      setClientContact('');
      setStartDate(today);
      setFotLimitPercent(String(defaultFotLimitPercent || 45));
      setProposalUrl('');
      setMeasurementUrl('');
      setFolderUrl('');
      setTeamIds(team.map((m) => m.id));
      setPaymentStages(
        buildPaymentStagesForScheme({
          scheme: defaultScheme,
          contractTotal: defaultContract,
          startDate: today,
          separateMeasurementFee: true,
          measurementFeeAmount: 10000,
        })
      );
      setUseTemplateWorkStages(true);
    }
  }, [open, editingProject, team, defaultFotLimitPercent]);

  const numericArea = Math.max(0, Number(areaSqm) || 0);
  const numericRate = Math.max(0, Number(ratePerSqm) || 0);
  const calculatedBaseAmount = Math.round(numericArea * numericRate);
  const numericContract = Math.max(0, Number(contractAmount) || 0);
  const numericMeasFee = Math.max(0, Number(measurementFeeAmount) || 0);

  const discountInfo = useMemo(() => {
    const diff = calculatedBaseAmount - numericContract;
    if (calculatedBaseAmount <= 0 || diff === 0) {
      return { amount: 0, percent: 0, type: 'none' as const };
    }
    const pct = (Math.abs(diff) / calculatedBaseAmount) * 100;
    return {
      amount: Math.abs(diff),
      percent: pct,
      type: diff > 0 ? ('discount' as const) : ('markup' as const),
    };
  }, [calculatedBaseAmount, numericContract]);

  const stagesSum = useMemo(
    () => paymentStages.reduce((acc, ps) => acc + (Number(ps.amount) || 0), 0),
    [paymentStages]
  );

  const recalculateStages = (params: {
    scheme: PaymentSchemeTemplate;
    total: number;
    separateMeas: boolean;
    measFee: number;
    date: string;
  }) => {
    const effectiveScheme: Exclude<PaymentSchemeTemplate, 'custom'> =
      params.scheme === '2-stage-50-50' ? '2-stage-50-50' : '3-stage-30-50-20';
    setPaymentStages(
      buildPaymentStagesForScheme({
        scheme: effectiveScheme,
        contractTotal: params.total,
        startDate: params.date,
        separateMeasurementFee: params.separateMeas,
        measurementFeeAmount: params.measFee,
      })
    );
  };

  const handleAreaChange = (val: string) => {
    setAreaSqm(val);
    const nextArea = Math.max(0, Number(val) || 0);
    const nextCalc = Math.round(nextArea * numericRate);

    if (!editingProject) {
      // Auto-suggest Шаблон Б (50/50) for <= 70 м², Шаблон А (30/50/20) for >= 75 м²
      const suggestedScheme: PaymentSchemeTemplate =
        nextArea > 0 && nextArea <= 70 ? '2-stage-50-50' : '3-stage-30-50-20';
      const nextScheme =
        paymentScheme === 'custom' ? paymentScheme : suggestedScheme;
      if (paymentScheme !== 'custom') setPaymentScheme(nextScheme);

      if (!contractManuallyEdited) {
        setContractAmount(String(nextCalc));
        recalculateStages({
          scheme: nextScheme,
          total: nextCalc,
          separateMeas: separateMeasurementFee,
          measFee: numericMeasFee,
          date: startDate,
        });
      }
    }
  };

  const handleRateChange = (val: string) => {
    setRatePerSqm(val);
    const nextRate = Math.max(0, Number(val) || 0);
    const nextCalc = Math.round(numericArea * nextRate);
    if (!editingProject && !contractManuallyEdited) {
      setContractAmount(String(nextCalc));
      recalculateStages({
        scheme: paymentScheme,
        total: nextCalc,
        separateMeas: separateMeasurementFee,
        measFee: numericMeasFee,
        date: startDate,
      });
    }
  };

  const handleContractAmountChange = (val: string) => {
    setContractAmount(val);
    setContractManuallyEdited(true);
    const nextTotal = Math.max(0, Number(val) || 0);
    if (!editingProject && paymentScheme !== 'custom') {
      recalculateStages({
        scheme: paymentScheme,
        total: nextTotal,
        separateMeas: separateMeasurementFee,
        measFee: numericMeasFee,
        date: startDate,
      });
    }
  };

  const handleSelectScheme = (scheme: Exclude<PaymentSchemeTemplate, 'custom'>) => {
    setPaymentScheme(scheme);
    recalculateStages({
      scheme,
      total: numericContract,
      separateMeas: separateMeasurementFee,
      measFee: numericMeasFee,
      date: startDate,
    });
  };

  const handleToggleMeasurementFee = (checked: boolean) => {
    setSeparateMeasurementFee(checked);
    if (!editingProject || paymentScheme !== 'custom') {
      recalculateStages({
        scheme: paymentScheme,
        total: numericContract,
        separateMeas: checked,
        measFee: numericMeasFee,
        date: startDate,
      });
    }
  };

  const handleMeasurementFeeChange = (val: string) => {
    setMeasurementFeeAmount(val);
    const nextFee = Math.max(0, Number(val) || 0);
    if (separateMeasurementFee && (!editingProject || paymentScheme !== 'custom')) {
      recalculateStages({
        scheme: paymentScheme,
        total: numericContract,
        separateMeas: true,
        measFee: nextFee,
        date: startDate,
      });
    }
  };

  if (!open) return null;

  const toggleTeamMember = (id: string) => {
    setTeamIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addPaymentStage = () => {
    setPaymentStages((prev) => [
      ...prev,
      {
        id: createId('ps'),
        order: prev.length + 1,
        title: `Этап ${prev.length + 1}. Новый этап`,
        amount: 0,
        dueDate: startDate || getTodayIso(),
        isPaid: false,
        paidDate: '',
      },
    ]);
  };

  const updatePaymentStage = (id: string, patch: Partial<PaymentStage>) => {
    setPaymentStages((prev) =>
      prev.map((ps) => (ps.id === id ? { ...ps, ...patch } : ps))
    );
  };

  const removePaymentStage = (id: string) => {
    setPaymentStages((prev) =>
      prev
        .filter((ps) => ps.id !== id)
        .map((ps, index) => ({ ...ps, order: index + 1 }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название проекта');
      return;
    }

    const parsedArea = Math.max(0, Number(areaSqm) || 0);
    const parsedRate = Math.max(0, Number(ratePerSqm) || 0);
    const parsedLimit = Math.min(
      100,
      Math.max(5, Number(fotLimitPercent) || defaultFotLimitPercent || 45)
    );
    const normalizedStages = paymentStages.map((ps, idx) => ({
      ...ps,
      order: idx + 1,
      amount: Math.max(0, Number(ps.amount) || 0),
    }));
    const finalSum =
      normalizedStages.reduce((acc, s) => acc + s.amount, 0) || numericContract;

    const isNew = !editingProject;
    const workStages = editingProject
      ? editingProject.workStages
      : useTemplateWorkStages
      ? createWorkStagesForScheme(paymentScheme, normalizedStages, startDate, team)
      : [];

    const project: Project = {
      id: editingProject ? editingProject.id : createId('proj'),
      isDemo: editingProject ? editingProject.isDemo : false,
      name: name.trim(),
      address: address.trim(),
      areaSqm: parsedArea,
      ratePerSqm: parsedRate,
      contractAmount: finalSum,
      paymentScheme,
      separateMeasurementFee,
      measurementFeeAmount: separateMeasurementFee ? numericMeasFee : 0,
      status,
      clientContact: clientContact.trim(),
      startDate: startDate || getTodayIso(),
      fotLimitPercent: parsedLimit,
      plannedCategoryBudgets: editingProject?.plannedCategoryBudgets,
      costLines: editingProject?.costLines || [],
      links: {
        proposalUrl: proposalUrl.trim(),
        measurementUrl: measurementUrl.trim(),
        folderUrl: folderUrl.trim(),
      },
      teamIds,
      paymentStages: normalizedStages,
      workStages,
    };

    onSave(project, isNew);
    onClose();
  };

  const sumMatchesContract = Math.abs(stagesSum - numericContract) < 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2936]/40 p-3 backdrop-blur-xs sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div className="bento-card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white/95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDF0F4] bg-[#F4FBFD] px-6 py-4">
          <div>
            <h2
              id="project-modal-title"
              className="text-base font-bold tracking-tight text-[#0F2936]"
            >
              {editingProject ? 'Редактировать объект' : 'Новый дизайн-проект'}
            </h2>
            <p className="mt-0.5 text-[11px] text-[#4C6D7C]">
              Паспорт, ссылки для кабинета клиента, умный калькулятор КП и схема этапов
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4C6D7C] transition-colors hover:bg-white hover:text-[#0F2936]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {error && (
              <div className="rounded-xl border border-[#FDA4AF] bg-[#FFF1F2] px-4 py-2.5 text-xs font-medium text-[#E11D48]">
                {error}
              </div>
            )}

            {/* 01. Passport */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-[#0D9488]">01. Паспорт объекта</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Название проекта *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: ЖК «Лазурный берег» или Офис БЦ Север"
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3.5 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Адрес объекта
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Город, улица, дом, квартира/офис"
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3.5 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Контакт клиента
                  </label>
                  <input
                    type="text"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    placeholder="Телефон, Telegram или WhatsApp"
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3.5 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">Статус</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                      className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-xs font-medium text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                      Дата старта
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 font-mono text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                      Лимит ФОТ, %
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      value={fotLimitPercent}
                      onChange={(e) => setFotLimitPercent(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 font-mono text-sm tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 02. Document Links for Client View */}
            <div className="space-y-3 border-t border-[#DDF0F4] pt-5">
              <div>
                <div className="text-xs font-bold text-[#0D9488]">
                  02. Документы и ссылки (отображаются в «Кабинете проекта» клиента)
                </div>
                <p className="mt-0.5 text-[11px] text-[#4C6D7C]">
                  Если поле пустое, кнопка у клиента будет неактивна («Документ готовится»). Заполненная ссылка открывается в новой вкладке.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#0F2936]">
                    <FileText className="h-3.5 w-3.5 text-[#0D9488]" />
                    Коммерческое предложение
                  </label>
                  <input
                    type="text"
                    value={proposalUrl}
                    onChange={(e) => setProposalUrl(e.target.value)}
                    placeholder="Google Docs / PDF / Яндекс Диск"
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-xs text-[#0F2936] placeholder:text-[#8AAAB8] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#0F2936]">
                    <Ruler className="h-3.5 w-3.5 text-[#0D9488]" />
                    Обмерный план
                  </label>
                  <input
                    type="text"
                    value={measurementUrl}
                    onChange={(e) => setMeasurementUrl(e.target.value)}
                    placeholder="PDF / DWG / Диск"
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-xs text-[#0F2936] placeholder:text-[#8AAAB8] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#0F2936]">
                    <FolderOpen className="h-3.5 w-3.5 text-[#0284C9]" />
                    Папка с материалами и рендерами
                  </label>
                  <input
                    type="text"
                    value={folderUrl}
                    onChange={(e) => setFolderUrl(e.target.value)}
                    placeholder="Облачная папка (Диск / Drive)"
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-xs text-[#0F2936] placeholder:text-[#8AAAB8] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 03. Smart KP Calculator & Payment Templates */}
            <div className="space-y-4 border-t border-[#DDF0F4] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488]">
                  <Calculator className="h-3.5 w-3.5" />
                  03. Умный калькулятор КП и шаблоны этапов оплаты
                </div>
                {contractManuallyEdited && calculatedBaseAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setContractAmount(String(calculatedBaseAmount));
                      setContractManuallyEdited(false);
                      recalculateStages({
                        scheme: paymentScheme,
                        total: calculatedBaseAmount,
                        separateMeas: separateMeasurementFee,
                        measFee: numericMeasFee,
                        date: startDate,
                      });
                    }}
                    className="text-[11px] font-semibold text-[#0284C9] underline-offset-4 hover:underline"
                  >
                    Сбросить договор к тарифу ({formatCurrency(calculatedBaseAmount)})
                  </button>
                )}
              </div>

              {/* Area × Rate → Contract Sum + Discount */}
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#C5E6EC] bg-[#EEF8FA] p-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                    Площадь, м² *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={areaSqm}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                    Тариф, ₽ / м²
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={ratePerSqm}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-medium text-[#4C6D7C]">
                    Расчёт (м² × тариф)
                  </div>
                  <div className="flex h-10 items-center rounded-xl border border-[#DDF0F4] bg-white/80 px-3 font-mono text-sm font-semibold tabular-nums text-[#4C6D7C]">
                    {formatCurrency(calculatedBaseAmount)}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold text-[#0F2936]">
                    Итоговая сумма договора, ₽
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={contractAmount}
                    onChange={(e) => handleContractAmountChange(e.target.value)}
                    className="h-10 w-full rounded-xl border-2 border-[#0D9488] bg-white px-3 font-mono text-sm font-bold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>

                {/* Live Discount / Markup Indicator */}
                {discountInfo.type !== 'none' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#C5E6EC] pt-2.5 text-xs sm:col-span-4">
                    <span className="text-[#4C6D7C]">
                      Отклонение от прайса ({numericArea} м² × {formatCurrency(numericRate)}):
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        discountInfo.type === 'discount' ? 'text-[#E11D48]' : 'text-[#0D9488]'
                      }`}
                    >
                      {discountInfo.type === 'discount' ? 'Скидка: −' : 'Наценка: +'}
                      {formatCurrency(discountInfo.amount)} ({discountInfo.type === 'discount' ? '−' : '+'}
                      {discountInfo.percent.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Separate Measurement Fee Toggle + 1-Click Templates */}
              <div className="space-y-3">
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#C5E6EC] bg-white px-4 py-3 sm:flex-row sm:items-center">
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#0F2936]">
                    <input
                      type="checkbox"
                      checked={separateMeasurementFee}
                      onChange={(e) => handleToggleMeasurementFee(e.target.checked)}
                      className="h-4 w-4 accent-[#0D9488]"
                    />
                    <span>
                      Отдельный платёж за замеры{' '}
                      <span className="font-normal text-[#4C6D7C]">
                        (строка «Замеры» с автоматическим вычетом из Этапа 1)
                      </span>
                    </span>
                  </label>

                  {separateMeasurementFee && (
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={measurementFeeAmount}
                        onChange={(e) => handleMeasurementFeeChange(e.target.value)}
                        className="h-8 w-28 rounded-xl border border-[#B5DFE8] bg-white px-2.5 font-mono text-xs font-bold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                      />
                      <span className="font-mono text-xs text-[#4C6D7C]">₽</span>
                    </div>
                  )}
                </div>

                {/* Template A / Template B 1-Click Switcher */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleSelectScheme('3-stage-30-50-20')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      paymentScheme === '3-stage-30-50-20'
                        ? 'border-transparent bg-gradient-to-br from-[#0D9488] to-[#0284C9] text-white shadow-sm'
                        : 'border-[#C5E6EC] bg-white text-[#0F2936] hover:border-[#0284C9] hover:bg-[#F4FBFD]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span>Шаблон А — 3 этапа (30% / 50% / 20%)</span>
                      <span className="font-mono text-[10px] opacity-85">от 75 м² / офисы</span>
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] leading-snug ${
                        paymentScheme === '3-stage-30-50-20' ? 'text-white/85' : 'text-[#4C6D7C]'
                      }`}
                    >
                      Э1 (30% − замеры): планировка, ТЗ, старт-визы · Э2 (50%): все 3D, правки, салоны · Э3 (20%): РД, ведомость, печать 2 экз.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectScheme('2-stage-50-50')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      paymentScheme === '2-stage-50-50'
                        ? 'border-transparent bg-gradient-to-br from-[#0D9488] to-[#0284C9] text-white shadow-sm'
                        : 'border-[#C5E6EC] bg-white text-[#0F2936] hover:border-[#0284C9] hover:bg-[#F4FBFD]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span>Шаблон Б — 2 этапа (50% / 50%)</span>
                      <span className="font-mono text-[10px] opacity-85">до 70 м²</span>
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] leading-snug ${
                        paymentScheme === '2-stage-50-50' ? 'text-white/85' : 'text-[#4C6D7C]'
                      }`}
                    >
                      Э1 (50% − замеры): замеры, планировка, мудборды, визы кухни и с/у · Э2 (50%): визы остальных зон, вся РД, печать.
                    </p>
                  </button>
                </div>
              </div>

              {/* Editable Payment Stages List */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-[#0F2936]">Этапы оплаты по КП</span>
                    <span
                      className={`font-mono text-[11px] font-bold tabular-nums ${
                        sumMatchesContract ? 'text-[#0D9488]' : 'text-[#F59E0B]'
                      }`}
                    >
                      Итого этапы: {formatCurrency(stagesSum)}
                      {sumMatchesContract
                        ? ' (= договору ✓)'
                        : ` (разница ${formatCurrency(stagesSum - numericContract)})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingProject && (
                      <button
                        type="button"
                        onClick={() =>
                          recalculateStages({
                            scheme: paymentScheme,
                            total: numericContract,
                            separateMeas: separateMeasurementFee,
                            measFee: numericMeasFee,
                            date: startDate,
                          })
                        }
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#4C6D7C] hover:text-[#0284C9]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Пересчитать по шаблону
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addPaymentStage}
                      className="flex items-center gap-1 rounded-full border border-[#B5DFE8] bg-white px-3 py-1 text-xs font-semibold text-[#0D9488] hover:border-[#0D9488] hover:bg-[#F0FDFA]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Добавить этап
                    </button>
                  </div>
                </div>

                {paymentStages.map((ps, idx) => (
                  <div
                    key={ps.id}
                    className="grid grid-cols-1 gap-2 rounded-2xl border border-[#DDF0F4] bg-[#F4FBFD] p-3 sm:grid-cols-12 sm:items-center"
                  >
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={ps.title}
                        onChange={(e) => updatePaymentStage(ps.id, { title: e.target.value })}
                        placeholder={`Этап ${idx + 1}`}
                        className="h-9 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-xs font-medium text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={ps.amount}
                        onChange={(e) =>
                          updatePaymentStage(ps.id, { amount: Number(e.target.value) || 0 })
                        }
                        placeholder="Сумма ₽"
                        className="h-9 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-3">
                      <input
                        type="date"
                        value={ps.dueDate}
                        onChange={(e) => updatePaymentStage(ps.id, { dueDate: e.target.value })}
                        className="h-9 flex-1 rounded-xl border border-[#C5E6EC] bg-white px-2.5 font-mono text-[11px] text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removePaymentStage(ps.id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#C5E6EC] bg-white text-[#4C6D7C] hover:border-[#FDA4AF] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                        aria-label="Удалить этап оплаты"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 04. Team Directory Assignment */}
            <div className="space-y-3 border-t border-[#DDF0F4] pt-5">
              <div className="text-xs font-bold text-[#0D9488]">
                04. Роли для диаграммы Ганта (детальные выплаты и совмещение настраиваются в карточке объекта)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {team.map((member) => {
                  const checked = teamIds.includes(member.id);
                  return (
                    <label
                      key={member.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs transition-colors ${
                        checked
                          ? 'border-[#0D9488] bg-[#F0FDFA] text-[#0F2936]'
                          : 'border-[#C5E6EC] bg-white text-[#4C6D7C] hover:bg-[#F4FBFD]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeamMember(member.id)}
                          className="h-4 w-4 accent-[#0D9488]"
                        />
                        <span className="font-medium text-[#0F2936]">{member.roleTitle}</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#4C6D7C]">{member.code}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!editingProject && (
              <div className="border-t border-[#DDF0F4] pt-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-[#0F2936]">
                  <input
                    type="checkbox"
                    checked={useTemplateWorkStages}
                    onChange={(e) => setUseTemplateWorkStages(e.target.checked)}
                    className="h-4 w-4 accent-[#0D9488]"
                  />
                  <span>
                    Автоматически создать подэтапы на диаграмме Ганта по выбранному шаблону (
                    {paymentScheme === '2-stage-50-50'
                      ? 'Шаблон Б: 7 подэтапов 50/50'
                      : 'Шаблон А: 10 подэтапов 30/50/20'}
                    )
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#DDF0F4] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-full border border-[#B5DFE8] bg-white px-5 py-2 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0284C9] hover:text-[#0284C9]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-pulse min-h-[40px] rounded-full px-6 py-2 text-xs font-semibold"
            >
              {editingProject ? 'Сохранить изменения' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
