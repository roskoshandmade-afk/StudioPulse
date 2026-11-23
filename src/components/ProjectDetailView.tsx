import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileDown,
  FolderOpen,
  FileText,
  Link2,
  Pencil,
  Plus,
  Ruler,
  Trash2,
  X,
} from 'lucide-react';
import { createId } from '../data/demoData';
import {
  AppData,
  DirectExpense,
  PaymentStage,
  Project,
  ProjectStatus,
  WorkSubStage,
  WorklogEntry,
} from '../types';
import {
  calculateProjectFinance,
  formatCurrency,
  formatDate,
  getProjectProgress,
  getTodayIso,
} from '../utils/calculations';
import { GanttChart } from './GanttChart';
import { ProjectAnalytics } from './ProjectAnalytics';
import { ProjectCostLinesSection } from './ProjectCostLinesSection';
import { WorklogSection } from './WorklogSection';

interface ProjectDetailViewProps {
  data: AppData;
  project: Project;
  onBack: () => void;
  onUpdateProject: (updated: Project) => void;
  onEditProjectModal: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onCopyClientLink: (project: Project) => void;
  onExportPdf: (project: Project) => Promise<void>;
  onAddWorklog: (entry: WorklogEntry) => void;
  onUpdateWorklog: (entry: WorklogEntry) => void;
  onDeleteWorklog: (id: string) => void;
  onAddExpense: (expense: DirectExpense) => void;
  onUpdateExpense: (expense: DirectExpense) => void;
  onDeleteExpense: (id: string) => void;
}

const STATUSES: ProjectStatus[] = ['В работе', 'На паузе', 'Заморожен', 'Сдан'];

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  data,
  project,
  onBack,
  onUpdateProject,
  onEditProjectModal,
  onDeleteProject,
  onCopyClientLink,
  onExportPdf,
  onAddWorklog,
  onUpdateWorklog,
  onDeleteWorklog,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageTitle, setStageTitle] = useState('');
  const [stageAmount, setStageAmount] = useState('');
  const [stageDueDate, setStageDueDate] = useState('');
  const [addingStage, setAddingStage] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const finance = useMemo(() => calculateProjectFinance(data, project), [data, project]);
  const progress = useMemo(() => getProjectProgress(project), [project]);
  const todayIso = getTodayIso();

  const handleExportPdfClick = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await onExportPdf(project);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleStatusChange = (status: ProjectStatus) => {
    onUpdateProject({ ...project, status });
  };

  const handleTogglePayment = (stageId: string) => {
    const nextStages = project.paymentStages.map((ps) => {
      if (ps.id !== stageId) return ps;
      const nextPaid = !ps.isPaid;
      return {
        ...ps,
        isPaid: nextPaid,
        paidDate: nextPaid ? ps.paidDate || todayIso : '',
      };
    });
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const handlePaidDateChange = (stageId: string, paidDate: string) => {
    const nextStages = project.paymentStages.map((ps) =>
      ps.id === stageId ? { ...ps, paidDate } : ps
    );
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const startEditStage = (ps: PaymentStage) => {
    setAddingStage(false);
    setEditingStageId(ps.id);
    setStageTitle(ps.title);
    setStageAmount(String(ps.amount));
    setStageDueDate(ps.dueDate);
  };

  const startAddStage = () => {
    setEditingStageId(null);
    setAddingStage(true);
    setStageTitle(`Этап ${project.paymentStages.length + 1}. `);
    setStageAmount('0');
    setStageDueDate(todayIso);
  };

  const saveStageEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageTitle.trim()) return;
    const amt = Math.max(0, Number(stageAmount) || 0);

    if (addingStage) {
      const nextStage: PaymentStage = {
        id: createId('ps'),
        order: project.paymentStages.length + 1,
        title: stageTitle.trim(),
        amount: amt,
        dueDate: stageDueDate || todayIso,
        isPaid: false,
        paidDate: '',
      };
      onUpdateProject({
        ...project,
        paymentStages: [...project.paymentStages, nextStage],
      });
    } else if (editingStageId) {
      const nextStages = project.paymentStages.map((ps) =>
        ps.id === editingStageId
          ? {
              ...ps,
              title: stageTitle.trim(),
              amount: amt,
              dueDate: stageDueDate,
            }
          : ps
      );
      onUpdateProject({ ...project, paymentStages: nextStages });
    }
    setEditingStageId(null);
    setAddingStage(false);
  };

  const deletePaymentStage = (stageId: string) => {
    const nextStages = project.paymentStages
      .filter((ps) => ps.id !== stageId)
      .map((ps, idx) => ({ ...ps, order: idx + 1 }));
    onUpdateProject({ ...project, paymentStages: nextStages });
  };

  const handleUpdateWorkStages = (workStages: WorkSubStage[]) => {
    onUpdateProject({ ...project, workStages });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[#0EA5E9]/18 bg-white/85 px-4 py-2 text-xs font-medium text-[#0F2936] backdrop-blur-xs transition-all hover:border-[#0284C7] hover:text-[#0284C7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          Все проекты
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdfClick}
            className="btn-pulse flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
            title="Экспортировать клиентскую финансовую сводку в PDF"
          >
            <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />
            {exportingPdf ? 'Формирование PDF...' : 'PDF-отчёт клиенту'}
          </button>
          <button
            type="button"
            onClick={() => onCopyClientLink(project)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#0EA5E9]/18 bg-white/90 px-4 text-xs font-medium text-[#0F2936] transition-all hover:border-[#0284C7] hover:bg-[#F0F9FF] hover:text-[#0284C7] whitespace-nowrap"
            title="Скопировать прямую ссылку (?view=client&project=...) только для этого заказчика"
          >
            <Link2 className="h-3.5 w-3.5 text-[#0D9488]" strokeWidth={1.6} />
            Скопировать ссылку клиенту
          </button>
          <button
            type="button"
            onClick={() => onEditProjectModal(project)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[#0EA5E9]/18 bg-white/90 px-4 text-xs font-medium text-[#0F2936] transition-all hover:border-[#0284C7] hover:bg-[#F0F9FF] hover:text-[#0284C7] whitespace-nowrap"
          >
            <Pencil className="h-3.5 w-3.5 text-[#547585]" strokeWidth={1.6} />
            Редактировать объект
          </button>
          <button
            type="button"
            onClick={() => onDeleteProject(project)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white/90 text-[#547585] transition-colors hover:border-[#FDA4AF] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
            aria-label="Удалить проект"
            title="Удалить проект"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      {/* Block 1: Project Passport & Quick Links */}
      <section aria-label="Паспорт объекта" className="bento-card overflow-hidden">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#547585]">
                <span>Старт {formatDate(project.startDate)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                  {project.areaSqm} м²
                </span>
                {project.ratePerSqm ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#547585]">
                      Тариф {formatCurrency(project.ratePerSqm)}/м²
                    </span>
                  </>
                ) : null}
                <span aria-hidden="true">·</span>
                <span className="rounded-full border border-[#0D9488]/20 bg-[#F0FDFA]/90 px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#0D9488]">
                  Готовность {progress}%
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Лимит ФОТ {project.fotLimitPercent}%</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#0F2936] sm:text-3xl">
                {project.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#4C6D7C]">
                <span>{project.address || 'Адрес не указан'}</span>
                {project.clientContact && (
                  <>
                    <span className="text-[#B5DFE8]">/</span>
                    <span>Клиент: {project.clientContact}</span>
                  </>
                )}
                {project.ratePerSqm &&
                  project.areaSqm > 0 &&
                  project.ratePerSqm * project.areaSqm > finance.contractTotal && (
                    <>
                      <span className="text-[#B5DFE8]">/</span>
                      <span className="font-mono font-semibold text-[#E11D48]">
                        Скидка −
                        {formatCurrency(
                          project.ratePerSqm * project.areaSqm - finance.contractTotal
                        )}{' '}
                        (
                        {(
                          ((project.ratePerSqm * project.areaSqm - finance.contractTotal) /
                            (project.ratePerSqm * project.areaSqm)) *
                          100
                        ).toFixed(1)}
                        %)
                      </span>
                    </>
                  )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="project-status-select" className="text-xs font-medium text-[#4C6D7C] whitespace-nowrap">
                  Статус:
                </label>
                <select
                  id="project-status-select"
                  value={project.status}
                  onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
                  className="h-9 rounded-full border border-[#B5DFE8] bg-white px-4 text-xs font-semibold text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Links Row */}
          <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#DDF0F4] pt-5 sm:grid-cols-3">
            {project.links.proposalUrl ? (
              <a
                href={normalizeUrl(project.links.proposalUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#C5E6EC] bg-[#F4FBFD] px-4 py-2.5 text-xs font-semibold text-[#0F2936] transition-all hover:border-[#0284C9] hover:bg-white hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0D9488]" />
                  Коммерческое предложение (КП)
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onEditProjectModal(project)}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-white/70 px-4 py-2.5 text-xs text-[#4C6D7C] transition-colors hover:border-[#0284C9] hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Добавить ссылку на КП
                </span>
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {project.links.measurementUrl ? (
              <a
                href={normalizeUrl(project.links.measurementUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#C5E6EC] bg-[#F4FBFD] px-4 py-2.5 text-xs font-semibold text-[#0F2936] transition-all hover:border-[#0284C9] hover:bg-white hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-[#0D9488]" />
                  Обмерный план
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onEditProjectModal(project)}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-white/70 px-4 py-2.5 text-xs text-[#4C6D7C] transition-colors hover:border-[#0284C9] hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Добавить обмерный план
                </span>
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {project.links.folderUrl ? (
              <a
                href={normalizeUrl(project.links.folderUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#C5E6EC] bg-[#F4FBFD] px-4 py-2.5 text-xs font-semibold text-[#0F2936] transition-all hover:border-[#0284C9] hover:bg-white hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-[#0284C9]" />
                  Папка с материалами
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onEditProjectModal(project)}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-white/70 px-4 py-2.5 text-xs text-[#4C6D7C] transition-colors hover:border-[#0284C9] hover:text-[#0284C9]"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Добавить папку исходников
                </span>
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Block 2: Payment Schedule by KP with Unified Light Pastel Balance Block */}
      <section aria-label="Финансы по КП" className="bento-card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-[#0EA5E9]/14 px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] font-medium text-[#547585]">График расчётов</div>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
              Финансы по КП · Этапы оплаты
            </h2>
          </div>
          <button
            type="button"
            onClick={startAddStage}
            className="flex h-9 items-center gap-1.5 self-start rounded-full border border-[#0EA5E9]/18 bg-white/90 px-4 text-xs font-medium text-[#0F2936] transition-all hover:border-[#0284C7] hover:bg-[#F0F9FF] hover:text-[#0284C7] sm:self-auto whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5 text-[#0D9488]" strokeWidth={1.6} />
            Этап оплаты
          </button>
        </div>

        {/* Summary Strip with Unified Light Pastel-Teal Balance Tile */}
        <div className="grid grid-cols-1 gap-4 border-b border-[#0EA5E9]/14 bg-[#F4FAFC]/80 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-4 py-4">
            <div className="text-[11px] font-medium text-[#547585]">Всего по КП</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#0F2936]">
              {formatCurrency(finance.contractTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-4 py-4">
            <div className="text-[11px] font-medium text-[#547585]">
              Оплачено ({finance.paidPercent}%)
            </div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#0D9488]">
              {formatCurrency(finance.paidTotal)}
            </div>
          </div>
          <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-4 py-4">
            <div className="text-[11px] font-medium text-[#547585]">Остаток на сегодня</div>
            <div
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                finance.remainingTotal > 0 ? 'text-[#0F2936]' : 'text-[#0D9488]'
              }`}
            >
              {formatCurrency(finance.remainingTotal)}
            </div>
          </div>
          <div
            className={`px-4 py-4 ${
              finance.netBalanceFromPaid < 0 ? 'bento-card-risk' : 'bento-card-balance'
            }`}
          >
            <div
              className={`text-[11px] font-medium ${
                finance.netBalanceFromPaid < 0 ? 'text-[#9F1239]' : 'text-[#0F6E6E]'
              }`}
            >
              Текущее сальдо объекта
            </div>
            <div
              className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                finance.netBalanceFromPaid < 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
              }`}
            >
              {finance.netBalanceFromPaid >= 0 ? '+' : ''}
              {formatCurrency(finance.netBalanceFromPaid)}
            </div>
          </div>
        </div>

        {/* Inline Add/Edit Stage Form */}
        {(addingStage || editingStageId) && (
          <form
            onSubmit={saveStageEdit}
            className="border-b border-[#DDF0F4] bg-[#EEF8FA] px-5 py-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
              <div className="sm:col-span-5">
                <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                  Название этапа
                </label>
                <input
                  type="text"
                  required
                  value={stageTitle}
                  onChange={(e) => setStageTitle(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                  Сумма, ₽
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={stageAmount}
                  onChange={(e) => setStageAmount(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                  План. срок
                </label>
                <input
                  type="date"
                  value={stageDueDate}
                  onChange={(e) => setStageDueDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-2.5 font-mono text-[11px] text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <button
                  type="submit"
                  className="btn-pulse flex h-9 flex-1 items-center justify-center rounded-full px-3 text-xs font-semibold"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingStage(false);
                    setEditingStageId(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#B5DFE8] bg-white text-[#4C6D7C] hover:text-[#0F2936]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Payment Stages Table (Sticky Left Column on Mobile) */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#DDF0F4] bg-[#EEF8FA] text-[11px] font-semibold text-[#4C6D7C]">
                <th className="sticky left-0 z-10 border-r border-[#DDF0F4] bg-[#EEF8FA] px-5 py-3">
                  Этап оплаты
                </th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-4 py-3">Срок по КП</th>
                <th className="px-4 py-3">Статус оплаты</th>
                <th className="px-4 py-3">Дата поступления</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1F2F6] text-xs">
              {project.paymentStages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#4C6D7C]">
                    Этапы оплаты ещё не добавлены.
                  </td>
                </tr>
              ) : (
                project.paymentStages.map((ps) => {
                  const isOverdue = !ps.isPaid && ps.dueDate && ps.dueDate < todayIso;
                  return (
                    <tr
                      key={ps.id}
                      className={`group transition-colors ${
                        isOverdue
                          ? 'bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/82 hover:from-[#FFE4E6]/85 hover:to-[#FFF1F2]/80'
                          : 'hover:bg-[#F4FAFC]'
                      }`}
                    >
                      <td
                        className={`sticky left-0 z-10 border-r border-[#0EA5E9]/12 px-5 py-3.5 font-semibold text-[#0F2936] ${
                          isOverdue
                            ? 'border-l-4 border-l-rose-500 bg-[#FFF3F4] group-hover:bg-[#FFE8EA]'
                            : 'bg-white group-hover:bg-[#F4FAFC]'
                        }`}
                      >
                        {ps.title}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#0F2936] whitespace-nowrap">
                        {formatCurrency(ps.amount)}
                      </td>
                      <td
                        className={`px-4 py-3.5 font-mono tabular-nums whitespace-nowrap ${
                          isOverdue ? 'font-semibold text-[#E11D48]' : 'text-[#547585]'
                        }`}
                      >
                        {formatDate(ps.dueDate)}
                        {isOverdue && (
                          <span className="ml-1.5 rounded-full border border-[#FDA4AF]/75 bg-white/90 px-2.5 py-0.5 font-sans text-[10px] font-semibold text-[#E11D48]">
                            просрочено
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={ps.isPaid}
                            onChange={() => handleTogglePayment(ps.id)}
                            className="h-4 w-4 accent-[#0D9488]"
                          />
                          <span
                            className={
                              ps.isPaid
                                ? 'font-semibold text-[#0D9488]'
                                : 'font-semibold text-[#E11D48]'
                            }
                          >
                            {ps.isPaid ? 'Оплачено' : 'Ожидается'}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-3.5">
                        {ps.isPaid ? (
                          <input
                            type="date"
                            value={ps.paidDate}
                            onChange={(e) => handlePaidDateChange(ps.id, e.target.value)}
                            className="h-8 rounded-lg border border-[#0EA5E9]/20 bg-white px-2.5 font-mono text-[11px] text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
                          />
                        ) : (
                          <span className="text-[#8AAAB8]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditStage(ps)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] transition-colors hover:border-[#0284C7] hover:text-[#0284C7]"
                            aria-label="Редактировать этап"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.6} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePaymentStage(ps.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] transition-colors hover:border-[#FDA4AF] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                            aria-label="Удалить этап"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.6} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Block 3: Team, Multi-Role Cost Lines, Salaried Allocation & Margin Traffic Light */}
      <ProjectCostLinesSection
        project={project}
        team={data.team}
        finance={finance}
        onUpdateProject={onUpdateProject}
      />

      {/* Block 4: Interactive Gantt Chart */}
      <GanttChart
        project={project}
        team={data.team}
        onUpdateWorkStages={handleUpdateWorkStages}
      />

      {/* Block 5: Analytics & Two Charts */}
      <ProjectAnalytics
        project={project}
        finance={finance}
        defaultFotLimitPercent={data.settings.defaultFotLimitPercent}
        onUpdateProject={onUpdateProject}
      />

      {/* Block 6: Project Worklog & Direct Expenses */}
      <div className="space-y-3 border-t border-[#C5E6EC] pt-6">
        <div>
          <div className="text-[11px] font-medium text-[#4C6D7C]">Первичные данные</div>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#0F2936]">
            Журнал выработки и прямых расходов объекта
          </h2>
          <p className="mt-0.5 text-xs text-[#4C6D7C]">
            Записи выработки автоматически обновляют распределение окладов и графики бюджета выше
          </p>
        </div>
        <WorklogSection
          data={data}
          fixedProjectId={project.id}
          onAddWorklog={onAddWorklog}
          onUpdateWorklog={onUpdateWorklog}
          onDeleteWorklog={onDeleteWorklog}
          onAddExpense={onAddExpense}
          onUpdateExpense={onUpdateExpense}
          onDeleteExpense={onDeleteExpense}
        />
      </div>
    </div>
  );
};
