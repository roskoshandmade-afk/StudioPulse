import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Home,
  Link2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  CommercialProposal,
  Project,
  ProposalDiscountType,
  ProposalObjectType,
  ProposalPaymentTemplate,
  ProposalStatus,
  ProposalTariffKey,
} from '../types';
import { formatCurrency, formatDate } from '../utils/calculations';
import {
  calculateProposalFinancials,
  getDefaultStageDays,
  PROPOSAL_TARIFF_LIST,
  PROPOSAL_TARIFFS,
} from '../utils/proposals';
import { LogoPulse } from './LogoPulse';

interface ProposalBuilderViewProps {
  proposals: CommercialProposal[];
  selectedProposalId: string | null;
  projects: Project[];
  onSelectProposal: (id: string) => void;
  onCreateProposal: () => void;
  onDuplicateProposal: (proposal: CommercialProposal) => void;
  onUpdateProposal: (proposal: CommercialProposal) => void;
  onDeleteProposal: (proposal: CommercialProposal) => void;
  onConvertToProject: (proposal: CommercialProposal) => void;
  onOpenProject: (projectId: string) => void;
  onNotify: (text: string, type?: 'default' | 'error') => void;
}

const PROPOSAL_STATUSES: ProposalStatus[] = [
  'Черновик',
  'Отправлено клиенту',
  'Согласовано',
];

function getStatusPillClass(status: ProposalStatus): string {
  switch (status) {
    case 'Согласовано':
      return 'border-[#0D9488]/30 bg-[#F0FDFA] text-[#0F766E]';
    case 'Отправлено клиенту':
      return 'border-[#0284C7]/28 bg-[#F0F9FF] text-[#0369A1]';
    case 'Черновик':
    default:
      return 'border-[#94A3B8]/35 bg-[#F8FAFC] text-[#475569]';
  }
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const ProposalBuilderView: React.FC<ProposalBuilderViewProps> = ({
  proposals,
  selectedProposalId,
  projects,
  onSelectProposal,
  onCreateProposal,
  onDuplicateProposal,
  onUpdateProposal,
  onDeleteProposal,
  onConvertToProject,
  onOpenProject,
  onNotify,
}) => {
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [statusFilter, setStatusFilter] = useState<'Все' | ProposalStatus>('Все');
  const [newDeliverableText, setNewDeliverableText] = useState('');
  const convertingLockRef = useRef<string | null>(null);

  const activeProposal = useMemo(() => {
    if (!proposals.length) return null;
    if (selectedProposalId) {
      const found = proposals.find((p) => p.id === selectedProposalId);
      if (found) return found;
    }
    return proposals[0];
  }, [proposals, selectedProposalId]);

  const filteredProposals = useMemo(() => {
    if (statusFilter === 'Все') return proposals;
    return proposals.filter((p) => p.status === statusFilter);
  }, [proposals, statusFilter]);

  const pipelineStats = useMemo(() => {
    let totalQuoted = 0;
    let approvedCount = 0;
    let sentCount = 0;
    for (const p of proposals) {
      const f = calculateProposalFinancials(p);
      totalQuoted += f.finalTotal;
      if (p.status === 'Согласовано') approvedCount += 1;
      if (p.status === 'Отправлено клиенту') sentCount += 1;
    }
    return { totalQuoted, approvedCount, sentCount };
  }, [proposals]);

  const financials = useMemo(
    () => (activeProposal ? calculateProposalFinancials(activeProposal) : null),
    [activeProposal]
  );

  const linkedProject = useMemo(() => {
    if (!activeProposal?.convertedProjectId) return null;
    return projects.find((pr) => pr.id === activeProposal.convertedProjectId) || null;
  }, [activeProposal, projects]);

  const patchProposal = (patch: Partial<CommercialProposal>) => {
    if (!activeProposal) return;
    onUpdateProposal({
      ...activeProposal,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSelectTariff = (tariffKey: ProposalTariffKey) => {
    if (!activeProposal) return;
    const preset = PROPOSAL_TARIFFS[tariffKey];
    patchProposal({
      tariffKey,
      ratePerSqm: preset.defaultRatePerSqm,
      deliverables: [...preset.deliverables],
      stageWorkingDays: getDefaultStageDays(tariffKey, activeProposal.paymentTemplate),
    });
  };

  const handleSelectPaymentTemplate = (template: ProposalPaymentTemplate) => {
    if (!activeProposal) return;
    patchProposal({
      paymentTemplate: template,
      stageWorkingDays: getDefaultStageDays(activeProposal.tariffKey, template),
    });
  };

  const handleToggleExtra = (optionId: string) => {
    if (!activeProposal) return;
    patchProposal({
      extraOptions: activeProposal.extraOptions.map((opt) =>
        opt.id === optionId ? { ...opt, enabled: !opt.enabled } : opt
      ),
    });
  };

  const handleExtraPriceChange = (optionId: string, rawVal: string) => {
    if (!activeProposal) return;
    const nextPrice = Math.max(0, Math.round(Number(rawVal) || 0));
    patchProposal({
      extraOptions: activeProposal.extraOptions.map((opt) =>
        opt.id === optionId ? { ...opt, price: nextPrice } : opt
      ),
    });
  };

  const handleStageDaysChange = (stageIdx: number, rawVal: string) => {
    if (!activeProposal) return;
    const nextDays = Math.max(1, Math.round(Number(rawVal) || 1));
    const current = [...(activeProposal.stageWorkingDays || [])];
    current[stageIdx] = nextDays;
    patchProposal({ stageWorkingDays: current });
  };

  const handleUpdateDeliverable = (index: number, value: string) => {
    if (!activeProposal) return;
    const next = [...activeProposal.deliverables];
    next[index] = value;
    patchProposal({ deliverables: next });
  };

  const handleRemoveDeliverable = (index: number) => {
    if (!activeProposal) return;
    patchProposal({
      deliverables: activeProposal.deliverables.filter((_, i) => i !== index),
    });
  };

  const handleAddDeliverable = () => {
    if (!activeProposal) return;
    const text = newDeliverableText.trim();
    if (!text) return;
    patchProposal({
      deliverables: [...activeProposal.deliverables, text],
    });
    setNewDeliverableText('');
  };

  const handlePrintPdf = () => {
    if (!activeProposal || !financials) return;
    if (!financials.isAreaValid) {
      onNotify('Укажите площадь объекта больше 0 м² перед печатью КП', 'error');
      return;
    }

    const prevTitle = document.title;
    const safeObj = (activeProposal.objectName || 'Коммерческое_предложение')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s+/g, '_');
    document.title = `${activeProposal.number}_${safeObj}_Студия_Пульс`;

    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);

    window.print();
    window.setTimeout(restoreTitle, 1500);
  };

  const handleConvertClick = () => {
    if (!activeProposal || !financials) return;
    if (linkedProject) {
      onOpenProject(linkedProject.id);
      return;
    }
    if (!financials.isAreaValid) {
      onNotify('Укажите корректную площадь объекта (больше 0 м²)', 'error');
      return;
    }
    if (convertingLockRef.current === activeProposal.id) {
      return;
    }
    convertingLockRef.current = activeProposal.id;
    onConvertToProject(activeProposal);
    window.setTimeout(() => {
      if (convertingLockRef.current === activeProposal.id) {
        convertingLockRef.current = null;
      }
    }, 1200);
  };

  const selectedTariff = activeProposal
    ? PROPOSAL_TARIFFS[activeProposal.tariffKey] || PROPOSAL_TARIFFS.full
    : PROPOSAL_TARIFFS.full;

  const enabledExtras = activeProposal
    ? activeProposal.extraOptions.filter((o) => o.enabled)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Hero & Summary Bar (Hidden in Print) */}
      <div className="no-print flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-medium text-[#547585]">
            Коммерческие предложения · {proposals.length}{' '}
            {proposals.length === 1 ? 'документ' : 'документов'} · Согласовано:{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0D9488]">
              {pipelineStats.approvedCount}
            </span>{' '}
            · Портфель КП:{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
              {formatCurrency(pipelineStats.totalQuoted)}
            </span>
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-[#0F2936] sm:text-[34px]">
            Конструктор КП
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCreateProposal}
            className="btn-pulse flex min-h-[40px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            Создать КП
          </button>
        </div>
      </div>

      {/* Saved Proposals History Strip (Hidden in Print) */}
      <section className="no-print bento-card p-4 sm:p-5" aria-label="История коммерческих предложений">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0F2936]">
            <FileText className="h-4 w-4 text-[#0D9488]" strokeWidth={1.7} />
            <span>История КП</span>
            <span className="font-mono text-xs font-medium tabular-nums text-[#547585]">
              ({filteredProposals.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC] p-1">
            {(['Все', ...PROPOSAL_STATUSES] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-full px-3 py-1 text-[11px] transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredProposals.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#B5DFE8] bg-[#F4FBFD]/80 px-6 py-8 text-center">
            <p className="text-sm font-medium text-[#0F2936]">
              {proposals.length === 0
                ? 'У вас пока нет созданных коммерческих предложений'
                : 'Нет КП с выбранным статусом'}
            </p>
            <p className="mt-1 text-xs text-[#547585]">
              Создайте новое КП, настройте тариф и распечатайте брендированный PDF-документ формата А4.
            </p>
            <button
              type="button"
              onClick={onCreateProposal}
              className="btn-pulse mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              Создать первое КП
            </button>
          </div>
        ) : (
          <div className="mt-3.5 flex gap-3 overflow-x-auto pb-1.5">
            {filteredProposals.map((item) => {
              const itemFin = calculateProposalFinancials(item);
              const isSelected = activeProposal?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectProposal(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectProposal(item.id);
                    }
                  }}
                  className={`group flex min-w-[240px] max-w-[280px] shrink-0 cursor-pointer flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-[#0D9488]/45 bg-gradient-to-br from-[#F0FDFA] via-[#F2FAFC] to-[#E0F2FE]/80 shadow-[0_8px_22px_-10px_rgba(13,148,136,0.28)]'
                      : 'border-[#0EA5E9]/14 bg-white/85 hover:border-[#0EA5E9]/35 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#0284C7]">
                      {item.number}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${getStatusPillClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="truncate text-sm font-semibold text-[#0F2936]">
                      {item.objectName.trim() || 'Новый объект'}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#547585]">
                      {[item.clientName.trim() || 'Без заказчика', item.city.trim()]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[#0EA5E9]/12 pt-2.5 text-xs">
                    <span className="font-mono font-bold tabular-nums text-[#0F2936]">
                      {formatCurrency(itemFin.finalTotal)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[#547585]">
                      {item.areaSqm} м² · {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {activeProposal && financials && (
        <>
          {/* Active Proposal Command Bar (Hidden in Print) */}
          <div className="no-print bento-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#547585]">Статус КП:</span>
              <div
                className="flex flex-wrap items-center gap-1 rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC] p-1"
                role="group"
                aria-label="Статус коммерческого предложения"
              >
                {PROPOSAL_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => patchProposal({ status: st })}
                    className={`rounded-full px-3 py-1 text-xs transition-all whitespace-nowrap ${
                      activeProposal.status === st
                        ? st === 'Согласовано'
                          ? 'bg-[#0D9488] font-semibold text-white shadow-xs'
                          : st === 'Отправлено клиенту'
                          ? 'bg-[#0284C7] font-semibold text-white shadow-xs'
                          : 'bg-[#334155] font-semibold text-white shadow-xs'
                        : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onDuplicateProposal(activeProposal)}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#0EA5E9]/20 bg-white px-3.5 text-xs font-medium text-[#0F2936] transition-colors hover:border-[#0D9488]/45 hover:bg-[#F0FDFA] hover:text-[#0D9488] whitespace-nowrap"
                title="Создать копию этого КП"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
                Дублировать
              </button>

              <button
                type="button"
                onClick={() => onDeleteProposal(activeProposal)}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-rose-200/80 bg-white px-3.5 text-xs font-medium text-[#E11D48] transition-colors hover:border-[#E11D48] hover:bg-[#FFF1F2] whitespace-nowrap"
                title="Удалить это КП"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                Удалить
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#0284C7]/28 bg-[#F0F9FF] px-4 text-xs font-semibold text-[#0369A1] transition-colors hover:bg-[#0284C7] hover:text-white whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5" strokeWidth={1.7} />
                Скачать / Распечатать PDF
              </button>

              {linkedProject ? (
                <button
                  type="button"
                  onClick={() => onOpenProject(linkedProject.id)}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#0D9488]/35 bg-[#F0FDFA] px-4 text-xs font-semibold text-[#0F766E] transition-colors hover:bg-[#0D9488] hover:text-white whitespace-nowrap"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Объект в студии
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConvertClick}
                  className="btn-pulse flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold whitespace-nowrap"
                >
                  <FileCheck2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Согласовано → Создать объект в студии
                </button>
              )}
            </div>
          </div>

          {/* Mobile Pane Switcher (360px - 1023px, Hidden in Print) */}
          <div className="no-print grid grid-cols-2 gap-1.5 rounded-full border border-[#0EA5E9]/18 bg-white/85 p-1.5 shadow-xs lg:hidden">
            <button
              type="button"
              onClick={() => setMobilePane('editor')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-xs transition-all ${
                mobilePane === 'editor'
                  ? 'btn-pulse font-semibold'
                  : 'font-medium text-[#4C6D7C] hover:text-[#0F2936]'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.7} />
              Редактор КП
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-xs transition-all ${
                mobilePane === 'preview'
                  ? 'btn-pulse font-semibold'
                  : 'font-medium text-[#4C6D7C] hover:text-[#0F2936]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.7} />
              Предпросмотр листа
            </button>
          </div>

          {/* Two-Column Workspace: Left Form + Right Live A4 Sheet */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Structured Proposal Form (Hidden in Print) */}
            <div
              className={`no-print space-y-5 lg:col-span-5 ${
                mobilePane === 'editor' ? 'block' : 'hidden lg:block'
              }`}
            >
              {/* BLOCK A: Client & Object */}
              <section className="bento-card p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 border-b border-[#0EA5E9]/12 pb-3.5">
                  <div>
                    <div className="text-[11px] font-semibold text-[#0D9488]">Блок А</div>
                    <h2 className="text-base font-semibold text-[#0F2936]">Клиент и объект</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={activeProposal.number}
                      onChange={(e) => patchProposal({ number: e.target.value })}
                      aria-label="Номер КП"
                      className="h-8 w-28 rounded-full border border-[#0EA5E9]/22 bg-[#F4FAFC] px-3 text-center font-mono text-xs font-semibold text-[#0F2936] focus:border-[#0284C7] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Object Type Segmented Control */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#4C6D7C]">
                      Тип объекта
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[#0EA5E9]/16 bg-[#F2FAFC] p-1">
                      {(
                        [
                          { value: 'Жилой интерьер', icon: Home },
                          { value: 'Коммерческое помещение / Офис', icon: Building2 },
                        ] as Array<{ value: ProposalObjectType; icon: typeof Home }>
                      ).map(({ value, icon: Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => patchProposal({ objectType: value })}
                          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-center text-[11px] leading-tight transition-all ${
                            activeProposal.objectType === value
                              ? 'btn-pulse font-semibold'
                              : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
                          <span className="truncate">
                            {value === 'Жилой интерьер' ? 'Жилой интерьер' : 'Коммерция / Офис'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Имя заказчика
                      </label>
                      <input
                        type="text"
                        value={activeProposal.clientName}
                        onChange={(e) => patchProposal({ clientName: e.target.value })}
                        placeholder="Например: Анна Соколова"
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 text-sm text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Телефон / мессенджер
                      </label>
                      <input
                        type="text"
                        value={activeProposal.clientContact}
                        onChange={(e) => patchProposal({ clientContact: e.target.value })}
                        placeholder="+7 (978) 000-00-00 · Telegram"
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 text-sm text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Город
                      </label>
                      <input
                        type="text"
                        value={activeProposal.city}
                        onChange={(e) => patchProposal({ city: e.target.value })}
                        placeholder="Симферополь"
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 text-sm text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Название ЖК / объекта
                      </label>
                      <input
                        type="text"
                        value={activeProposal.objectName}
                        onChange={(e) => patchProposal({ objectName: e.target.value })}
                        placeholder="ЖК Аура, 3-комн. квартира"
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 text-sm text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Площадь по обмеру, м²
                      </label>
                      <input
                        type="number"
                        min={1}
                        step="0.5"
                        value={activeProposal.areaSqm === 0 ? '' : activeProposal.areaSqm}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            patchProposal({ areaSqm: 0 });
                            return;
                          }
                          const parsed = Number(raw);
                          patchProposal({
                            areaSqm: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
                          });
                        }}
                        placeholder="86"
                        className={`h-10 w-full rounded-xl border bg-white px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:outline-none ${
                          financials.isAreaValid
                            ? 'border-[#0EA5E9]/22 focus:border-[#0284C7]'
                            : 'border-[#E11D48] bg-[#FFF1F2]/60 focus:border-[#E11D48]'
                        }`}
                      />
                      {!financials.isAreaValid && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#E11D48]">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Укажите площадь больше 0 м²
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Дата КП
                      </label>
                      <input
                        type="date"
                        value={activeProposal.createdAt}
                        onChange={(e) => patchProposal({ createdAt: e.target.value })}
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 font-mono text-sm text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#4C6D7C]">
                      <Link2 className="h-3.5 w-3.5 text-[#0D9488]" />
                      Ссылка на обмерный план / ТЗ
                    </label>
                    <input
                      type="url"
                      value={activeProposal.measurementLink}
                      onChange={(e) => patchProposal({ measurementLink: e.target.value })}
                      placeholder="https://disk.yandex.ru/... или Google Drive"
                      className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 text-sm text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* BLOCK B: Tariff & Scope */}
              <section className="bento-card p-5 sm:p-6">
                <div className="border-b border-[#0EA5E9]/12 pb-3.5">
                  <div className="text-[11px] font-semibold text-[#0D9488]">Блок Б</div>
                  <h2 className="text-base font-semibold text-[#0F2936]">
                    Тариф, состав работ и опции
                  </h2>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Tariff Preset Cards */}
                  <div className="space-y-2.5">
                    {PROPOSAL_TARIFF_LIST.map((preset) => {
                      const isActive = activeProposal.tariffKey === preset.key;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => handleSelectTariff(preset.key)}
                          className={`flex w-full items-start justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                            isActive
                              ? 'border-[#0D9488]/45 bg-gradient-to-r from-[#F0FDFA] to-[#F0F9FF] shadow-[0_6px_18px_-10px_rgba(13,148,136,0.28)]'
                              : 'border-[#0EA5E9]/16 bg-white/80 hover:border-[#0EA5E9]/38 hover:bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  isActive
                                    ? 'border-[#0D9488] bg-[#0D9488] text-white'
                                    : 'border-[#94B8C6] bg-white'
                                }`}
                              >
                                {isActive && <Check className="h-2.5 w-2.5" strokeWidth={2.5} />}
                              </span>
                              <span className="text-sm font-semibold text-[#0F2936]">
                                {preset.title}
                              </span>
                            </div>
                            <p className="mt-1 pl-6 text-[11px] leading-relaxed text-[#547585]">
                              {preset.subtitle}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-[#0D9488]">
                            {preset.defaultRatePerSqm.toLocaleString('ru-RU')} ₽/м²
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Rate & Discount */}
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-medium text-[#4C6D7C]">
                          Ставка, ₽/м²
                        </label>
                        {activeProposal.ratePerSqm !== selectedTariff.defaultRatePerSqm && (
                          <button
                            type="button"
                            onClick={() =>
                              patchProposal({ ratePerSqm: selectedTariff.defaultRatePerSqm })
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0284C7] hover:underline"
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            Сброс ({selectedTariff.defaultRatePerSqm})
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={activeProposal.ratePerSqm}
                        onChange={(e) =>
                          patchProposal({
                            ratePerSqm: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          })
                        }
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-medium text-[#4C6D7C]">Скидка</label>
                        <div className="inline-flex rounded-full border border-[#0EA5E9]/18 bg-[#F2FAFC] p-0.5 text-[10px]">
                          {(['percent', 'fixed'] as ProposalDiscountType[]).map((dt) => (
                            <button
                              key={dt}
                              type="button"
                              onClick={() => patchProposal({ discountType: dt })}
                              className={`rounded-full px-2 py-0.5 font-semibold transition-colors ${
                                activeProposal.discountType === dt
                                  ? 'bg-[#0D9488] text-white'
                                  : 'text-[#4C6D7C]'
                              }`}
                            >
                              {dt === 'percent' ? '%' : '₽'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={activeProposal.discountType === 'percent' ? 100 : undefined}
                        step={activeProposal.discountType === 'percent' ? 1 : 5000}
                        value={activeProposal.discountValue}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          patchProposal({
                            discountValue:
                              activeProposal.discountType === 'percent'
                                ? Math.min(100, v)
                                : Math.round(v),
                          });
                        }}
                        className="h-10 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Deliverables Editor */}
                  <div className="rounded-2xl border border-[#0EA5E9]/14 bg-[#F6FBFD] p-3.5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#0F2936]">
                        Состав работ ({activeProposal.deliverables.length})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          patchProposal({ deliverables: [...selectedTariff.deliverables] })
                        }
                        className="text-[11px] font-medium text-[#0284C7] hover:underline"
                      >
                        По шаблону тарифа
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {activeProposal.deliverables.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="w-5 shrink-0 font-mono text-[11px] text-[#547585]">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => handleUpdateDeliverable(idx, e.target.value)}
                            className="h-8 flex-1 rounded-lg border border-[#0EA5E9]/16 bg-white px-2.5 text-xs text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveDeliverable(idx)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#7A9AA8] hover:bg-rose-50 hover:text-[#E11D48]"
                            aria-label="Удалить пункт"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <input
                        type="text"
                        value={newDeliverableText}
                        onChange={(e) => setNewDeliverableText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDeliverable();
                          }
                        }}
                        placeholder="Добавить пункт состава работ..."
                        className="h-8 flex-1 rounded-lg border border-dashed border-[#0EA5E9]/28 bg-white px-2.5 text-xs text-[#0F2936] placeholder:text-[#8BA5B2] focus:border-[#0284C7] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddDeliverable}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#0D9488]/30 bg-[#F0FDFA] px-2.5 text-xs font-semibold text-[#0F766E] hover:bg-[#0D9488] hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Добавить
                      </button>
                    </div>
                  </div>

                  {/* Extra Options */}
                  <div>
                    <div className="mb-2 text-xs font-semibold text-[#0F2936]">
                      Дополнительные опции
                    </div>
                    <div className="space-y-2">
                      {activeProposal.extraOptions.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-2xl border p-3 transition-colors ${
                            opt.enabled
                              ? 'border-[#0D9488]/35 bg-[#F0FDFA]/70'
                              : 'border-[#0EA5E9]/14 bg-white/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <label className="flex flex-1 cursor-pointer items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={opt.enabled}
                                onChange={() => handleToggleExtra(opt.id)}
                                className="mt-0.5 h-4 w-4 rounded border-[#94B8C6] accent-[#0D9488]"
                              />
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-[#0F2936]">
                                  {opt.title}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-snug text-[#547585]">
                                  {opt.description}
                                </span>
                              </span>
                            </label>
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={opt.price}
                                onChange={(e) => handleExtraPriceChange(opt.id, e.target.value)}
                                aria-label={`Стоимость опции ${opt.title}`}
                                className="h-8 w-24 rounded-lg border border-[#0EA5E9]/20 bg-white px-2 text-right font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                              />
                              <span className="text-xs text-[#547585]">₽</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* BLOCK C: Financial Calculation, Payment Schedule & Terms */}
              <section className="bento-card p-5 sm:p-6">
                <div className="border-b border-[#0EA5E9]/12 pb-3.5">
                  <div className="text-[11px] font-semibold text-[#0D9488]">Блок В</div>
                  <h2 className="text-base font-semibold text-[#0F2936]">
                    Финансовый расчёт, этапы оплат и условия
                  </h2>
                </div>

                <div className="mt-4 space-y-4">
                  {/* Measurement Advance Toggle */}
                  <div className="rounded-2xl border border-[#0D9488]/24 bg-[#F0FDFA]/75 p-3.5">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={activeProposal.deductMeasurementAdvance}
                        onChange={(e) =>
                          patchProposal({ deductMeasurementAdvance: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-[#0D9488] accent-[#0D9488]"
                      />
                      <span className="text-xs font-semibold text-[#0F2936]">
                        Учесть аванс за замеры (вычесть из 1-го этапа)
                      </span>
                    </label>

                    {activeProposal.deductMeasurementAdvance && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-6">
                        <span className="text-xs text-[#4C6D7C]">Сумма аванса за замеры:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={activeProposal.measurementAdvanceAmount}
                            onChange={(e) =>
                              patchProposal({
                                measurementAdvanceAmount: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                ),
                              })
                            }
                            className="h-9 w-28 rounded-xl border border-[#0D9488]/30 bg-white px-3 text-right font-mono text-xs font-bold tabular-nums text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                          />
                          <span className="text-xs font-medium text-[#4C6D7C]">₽</span>
                        </div>
                        {financials.advanceOverflowApplied && (
                          <p className="w-full text-[11px] text-[#0F766E]">
                            Аванс превышает сумму 1-го этапа — остаток вычета автоматически перенесён на следующий этап без ухода в минус.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Schedule Template */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#4C6D7C]">
                      Шаблон графика платежей
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectPaymentTemplate('3-stage-30-50-20')}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition-all ${
                          activeProposal.paymentTemplate === '3-stage-30-50-20'
                            ? 'border-[#0D9488]/45 bg-[#F0FDFA] shadow-xs'
                            : 'border-[#0EA5E9]/16 bg-white hover:border-[#0EA5E9]/35'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold text-[#0F2936]">
                          30% / 50% / 20%
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#547585]">3 этапа оплаты</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPaymentTemplate('2-stage-50-50')}
                        className={`rounded-2xl border px-3 py-2.5 text-left transition-all ${
                          activeProposal.paymentTemplate === '2-stage-50-50'
                            ? 'border-[#0D9488]/45 bg-[#F0FDFA] shadow-xs'
                            : 'border-[#0EA5E9]/16 bg-white hover:border-[#0EA5E9]/35'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold text-[#0F2936]">50% / 50%</div>
                        <div className="mt-0.5 text-[11px] text-[#547585]">2 этапа оплаты</div>
                      </button>
                    </div>
                  </div>

                  {/* Stage Working Days & Auto-Calculated Amounts */}
                  <div className="space-y-2">
                    {financials.stages.map((st, idx) => (
                      <div
                        key={st.order}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0EA5E9]/14 bg-[#F6FBFD] px-3 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[#0F2936]">
                            Этап {st.order} ({st.sharePercent}%)
                          </div>
                          {st.deductedAdvance > 0 && (
                            <div className="text-[10px] text-[#0D9488]">
                              Вычтен аванс −{formatCurrency(st.deductedAdvance)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={st.workingDays}
                              onChange={(e) => handleStageDaysChange(idx, e.target.value)}
                              aria-label={`Срок этапа ${st.order} в рабочих днях`}
                              className="h-8 w-14 rounded-lg border border-[#0EA5E9]/20 bg-white px-2 text-center font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                            />
                            <span className="text-[11px] text-[#547585]">р.д.</span>
                          </div>
                          <span className="min-w-[92px] text-right font-mono text-xs font-bold tabular-nums text-[#0F2936]">
                            {formatCurrency(st.payableAmount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Terms & Studio Contacts */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Кругов правок
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={activeProposal.revisionRounds}
                        onChange={(e) =>
                          patchProposal({
                            revisionRounds: Math.max(1, Math.round(Number(e.target.value) || 1)),
                          })
                        }
                        className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Срок действия КП, дн.
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={activeProposal.validityDays}
                        onChange={(e) =>
                          patchProposal({
                            validityDays: Math.max(1, Math.round(Number(e.target.value) || 14)),
                          })
                        }
                        className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                      Формат выдачи проекта
                    </label>
                    <input
                      type="text"
                      value={activeProposal.albumFormat}
                      onChange={(e) => patchProposal({ albumFormat: e.target.value })}
                      className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Телефон студии (в КП)
                      </label>
                      <input
                        type="text"
                        value={activeProposal.studioPhone}
                        onChange={(e) => patchProposal({ studioPhone: e.target.value })}
                        className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                        Email / сайт (в КП)
                      </label>
                      <input
                        type="text"
                        value={activeProposal.studioEmail}
                        onChange={(e) => patchProposal({ studioEmail: e.target.value })}
                        className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                      Подписант от студии
                    </label>
                    <input
                      type="text"
                      value={activeProposal.directorName}
                      onChange={(e) => patchProposal({ directorName: e.target.value })}
                      className="h-9 w-full rounded-xl border border-[#0EA5E9]/22 bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                      Примечания и особые условия
                    </label>
                    <textarea
                      rows={3}
                      value={activeProposal.extraNotes}
                      onChange={(e) => patchProposal({ extraNotes: e.target.value })}
                      className="w-full rounded-xl border border-[#0EA5E9]/22 bg-white p-3 text-xs leading-relaxed text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Live A4 Document Sheet (Always visible in Print) */}
            <div
              className={`lg:sticky lg:top-[84px] lg:col-span-7 print:block ${
                mobilePane === 'preview' ? 'block' : 'hidden lg:block'
              }`}
            >
              <article
                id="proposal-print-sheet"
                className="overflow-hidden rounded-[20px] border border-[#0EA5E9]/18 bg-white text-[#0F2936] shadow-[0_22px_60px_-18px_rgba(15,41,54,0.16)]"
              >
                {/* Document Header Band */}
                <header className="print-avoid-break border-b border-[#0EA5E9]/16 bg-gradient-to-r from-[#F0FDFA] via-[#F2FAFC] to-[#E6F6FD] px-6 py-6 sm:px-9 sm:py-7">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <LogoPulse />
                      <div className="mt-3 text-[11px] font-medium text-[#4C6D7C]">
                        {activeProposal.objectType} · Индивидуальное предложение
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-semibold tracking-wide text-[#0D9488]">
                        КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ
                      </div>
                      <div className="mt-0.5 font-mono text-lg font-bold tracking-tight text-[#0F2936]">
                        № {activeProposal.number}
                      </div>
                      <div className="mt-1 font-mono text-[11px] tabular-nums text-[#4C6D7C]">
                        от {formatDate(activeProposal.createdAt)} · действует до{' '}
                        {formatDate(financials.validUntilDate)}
                      </div>
                    </div>
                  </div>
                </header>

                {/* Document Body */}
                <div className="space-y-6 px-6 py-6 sm:px-9 sm:py-7">
                  {/* Client & Object Summary Grid */}
                  <section className="print-section grid grid-cols-1 gap-4 rounded-2xl border border-[#DDF0F4] bg-[#F7FCFD] p-4 sm:grid-cols-2 sm:p-5">
                    <div>
                      <div className="text-[10px] font-semibold tracking-wider text-[#547585] uppercase">
                        Заказчик
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#0F2936]">
                        {activeProposal.clientName.trim() || 'Имя заказчика не указано'}
                      </div>
                      <div className="mt-0.5 text-xs text-[#4C6D7C]">
                        {activeProposal.clientContact.trim() || 'Контакт не указан'}
                      </div>
                    </div>

                    <div className="sm:border-l sm:border-[#DDF0F4] sm:pl-5">
                      <div className="text-[10px] font-semibold tracking-wider text-[#547585] uppercase">
                        Объект проектирования
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#0F2936]">
                        {[activeProposal.city.trim(), activeProposal.objectName.trim()]
                          .filter(Boolean)
                          .join(', ') || 'Объект не указан'}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4C6D7C]">
                        <span>
                          Площадь:{' '}
                          <strong className="font-mono tabular-nums text-[#0F2936]">
                            {financials.safeAreaSqm} м²
                          </strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Срок:{' '}
                          <strong className="font-mono tabular-nums text-[#0F2936]">
                            {financials.totalWorkingDays} раб. дн.
                          </strong>
                        </span>
                      </div>
                      {activeProposal.measurementLink.trim() && (
                        <div className="mt-1.5 truncate text-[11px]">
                          <a
                            href={normalizeUrl(activeProposal.measurementLink.trim())}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#0284C7] underline decoration-[#0284C7]/35 underline-offset-2"
                          >
                            Обмерный план / ТЗ: {activeProposal.measurementLink.trim()}
                          </a>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Scope of Work Table */}
                  <section className="print-section">
                    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0F2936]">
                        1. Состав работ и расчёт стоимости
                      </h3>
                      <span className="text-xs font-medium text-[#0D9488]">
                        Пакет «{selectedTariff.title}»
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[#DDF0F4]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DDF0F4] bg-[#F2FAFC] text-[11px] font-semibold text-[#4C6D7C]">
                            <th className="px-4 py-2.5">Наименование работ</th>
                            <th className="px-3 py-2.5 text-right whitespace-nowrap">Объём / ставка</th>
                            <th className="px-4 py-2.5 text-right whitespace-nowrap">Стоимость</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E7F4F7]">
                          <tr className="print-avoid-break bg-white">
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-[#0F2936]">
                                {selectedTariff.title}
                              </div>
                              <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[#4C6D7C]">
                                {activeProposal.deliverables
                                  .filter((d) => d.trim().length > 0)
                                  .map((line, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span className="mt-0.5 font-mono text-[10px] font-semibold text-[#0D9488]">
                                        {String(i + 1).padStart(2, '0')}
                                      </span>
                                      <span>{line}</span>
                                    </li>
                                  ))}
                              </ul>
                            </td>
                            <td className="px-3 py-3 text-right align-top font-mono text-[11px] tabular-nums text-[#4C6D7C] whitespace-nowrap">
                              {financials.safeAreaSqm} м² ×{' '}
                              {financials.ratePerSqm.toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="px-4 py-3 text-right align-top font-mono text-xs font-bold tabular-nums text-[#0F2936] whitespace-nowrap">
                              {formatCurrency(financials.baseDesignTotal)}
                            </td>
                          </tr>

                          {enabledExtras.map((opt) => (
                            <tr key={opt.id} className="print-avoid-break bg-white">
                              <td className="px-4 py-2.5 align-top">
                                <div className="font-semibold text-[#0F2936]">{opt.title}</div>
                                <div className="mt-0.5 text-[11px] text-[#547585]">
                                  {opt.description}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right align-top text-[11px] text-[#547585] whitespace-nowrap">
                                Доп. опция
                              </td>
                              <td className="px-4 py-2.5 text-right align-top font-mono text-xs font-bold tabular-nums text-[#0F2936] whitespace-nowrap">
                                {formatCurrency(opt.price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Transparent Financial Summary */}
                    <div className="print-avoid-break mt-4 rounded-2xl border border-[#0D9488]/22 bg-gradient-to-r from-[#F0FDFA] via-[#F2FAFC] to-[#E8F6FD] p-4 sm:p-5">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[#4C6D7C]">
                          <span>Стоимость проектных работ ({financials.safeAreaSqm} м²)</span>
                          <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                            {formatCurrency(financials.baseDesignTotal)}
                          </span>
                        </div>

                        {financials.extrasTotal > 0 && (
                          <div className="flex items-center justify-between text-[#4C6D7C]">
                            <span>Дополнительные опции ({enabledExtras.length})</span>
                            <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                              +{formatCurrency(financials.extrasTotal)}
                            </span>
                          </div>
                        )}

                        {financials.discountAmount > 0 && (
                          <div className="flex items-center justify-between text-[#0D9488]">
                            <span>
                              Персональная скидка (
                              {activeProposal.discountType === 'percent'
                                ? `${activeProposal.discountValue}%`
                                : `${financials.discountEffectivePercent.toFixed(1)}%`}
                              )
                            </span>
                            <span className="font-mono font-semibold tabular-nums">
                              −{formatCurrency(financials.discountAmount)}
                            </span>
                          </div>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#0D9488]/20 pt-3">
                          <div>
                            <div className="text-sm font-bold text-[#0F2936]">
                              Итоговая стоимость проекта
                            </div>
                            {financials.safeAreaSqm > 0 && (
                              <div className="mt-0.5 text-[11px] text-[#4C6D7C]">
                                Итоговая ставка:{' '}
                                <span className="font-mono font-semibold tabular-nums text-[#0F766E]">
                                  {financials.effectiveRatePerSqm.toLocaleString('ru-RU')} ₽/м²
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="font-mono text-2xl font-bold tracking-tight tabular-nums text-[#0D9488]">
                            {formatCurrency(financials.finalTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Payment Schedule Table */}
                  <section className="print-section">
                    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0F2936]">
                        2. График платежей и ориентировочные сроки
                      </h3>
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-[#4C6D7C]">
                        Схема{' '}
                        {activeProposal.paymentTemplate === '2-stage-50-50'
                          ? '50% / 50%'
                          : '30% / 50% / 20%'}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-[#DDF0F4]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#DDF0F4] bg-[#F2FAFC] text-[11px] font-semibold text-[#4C6D7C]">
                            <th className="px-4 py-2.5">Этап оплаты</th>
                            <th className="px-3 py-2.5 text-center whitespace-nowrap">Доля</th>
                            <th className="px-3 py-2.5 text-center whitespace-nowrap">Срок</th>
                            <th className="px-4 py-2.5 text-right whitespace-nowrap">Сумма к оплате</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E7F4F7]">
                          {activeProposal.deductMeasurementAdvance &&
                            financials.measurementAdvance > 0 && (
                              <tr className="print-avoid-break bg-[#F0FDFA]/60">
                                <td className="px-4 py-2.5">
                                  <div className="font-semibold text-[#0F766E]">
                                    Аванс за лазерные обмеры (зачтён)
                                  </div>
                                  <div className="text-[10px] text-[#4C6D7C]">
                                    Вычитается из платежа 1-го этапа при заключении договора
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-[11px] text-[#0F766E]">
                                  Зачёт
                                </td>
                                <td className="px-3 py-2.5 text-center font-mono text-[11px] text-[#4C6D7C]">
                                  Выполнено
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-[#0F766E] whitespace-nowrap">
                                  {formatCurrency(financials.measurementAdvance)}
                                </td>
                              </tr>
                            )}

                          {financials.stages.map((st) => (
                            <tr key={st.order} className="print-avoid-break bg-white">
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-[#0F2936]">{st.title}</div>
                                {st.note && (
                                  <div className="mt-0.5 text-[10px] font-medium text-[#0D9488]">
                                    {st.note}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-[11px] tabular-nums text-[#4C6D7C]">
                                {st.sharePercent}%
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono text-[11px] tabular-nums text-[#4C6D7C] whitespace-nowrap">
                                {st.workingDays} раб. дн.
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums text-[#0F2936] whitespace-nowrap">
                                {formatCurrency(st.payableAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="print-avoid-break border-t border-[#DDF0F4] bg-[#F7FCFD] font-semibold">
                            <td className="px-4 py-2.5 text-xs text-[#0F2936]" colSpan={2}>
                              Итого по графику
                              {financials.measurementAdvance > 0
                                ? ' (с учётом аванса за замеры)'
                                : ''}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-xs tabular-nums text-[#0F2936] whitespace-nowrap">
                              {financials.totalWorkingDays} раб. дн.
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm font-bold tabular-nums text-[#0D9488] whitespace-nowrap">
                              {formatCurrency(
                                financials.totalPayableStages + financials.measurementAdvance
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>

                  {/* Terms & Conditions */}
                  <section className="print-section rounded-2xl border border-[#DDF0F4] bg-[#F9FDFD] p-4 sm:p-5">
                    <h3 className="text-xs font-bold tracking-wide text-[#0F2936] uppercase">
                      3. Условия сотрудничества
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                      <div>
                        <div className="text-[10px] font-medium text-[#547585]">
                          Включённые правки
                        </div>
                        <div className="mt-0.5 font-semibold text-[#0F2936]">
                          До {activeProposal.revisionRounds}{' '}
                          {activeProposal.revisionRounds % 10 === 1 &&
                          activeProposal.revisionRounds % 100 !== 11
                            ? 'круга'
                            : 'кругов'}{' '}
                          правок на этап
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-[#547585]">Формат выдачи</div>
                        <div className="mt-0.5 font-semibold text-[#0F2936]">
                          {activeProposal.albumFormat || 'Альбом А3 + PDF'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-medium text-[#547585]">
                          Срок действия КП
                        </div>
                        <div className="mt-0.5 font-semibold text-[#0F2936]">
                          {activeProposal.validityDays} дн. (до{' '}
                          <span className="font-mono tabular-nums">
                            {formatDate(financials.validUntilDate)}
                          </span>
                          )
                        </div>
                      </div>
                    </div>

                    {activeProposal.extraNotes.trim() && (
                      <p className="mt-3 border-t border-[#E1F2F6] pt-2.5 text-[11px] leading-relaxed text-[#4C6D7C]">
                        {activeProposal.extraNotes}
                      </p>
                    )}
                  </section>

                  {/* Studio Contacts & Signature Footer */}
                  <footer className="print-section flex flex-col justify-between gap-6 border-t border-[#DDF0F4] pt-5 sm:flex-row sm:items-end">
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-[#0F2936]">
                        Студия дизайна интерьеров «Студия Пульс»
                      </div>
                      <div className="text-[#4C6D7C]">
                        {[activeProposal.studioPhone.trim(), activeProposal.studioEmail.trim()]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="pt-1 text-[11px] text-[#6B8B99]">
                        {activeProposal.directorName}
                      </div>
                    </div>

                    <div className="flex items-end gap-6 text-[11px] text-[#547585]">
                      <div className="w-36 border-b border-[#94B8C6] pb-1 text-center">
                        Подпись студии
                      </div>
                      <div className="w-36 border-b border-[#94B8C6] pb-1 text-center">
                        Согласовано заказчиком
                      </div>
                    </div>
                  </footer>
                </div>
              </article>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
