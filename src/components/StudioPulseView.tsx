import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  FileText,
  FolderOpen,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  Ruler,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import { AppData, Project, ProjectStatus } from '../types';
import {
  calculateStudioPulse,
  formatCurrency,
  getProjectProgress,
} from '../utils/calculations';
import { ArchitecturalDonutChart, DonutSlice } from './ArchitecturalDonutChart';

interface StudioPulseViewProps {
  data: AppData;
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onCreateProposal: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onDeleteAllDemo: () => void;
  onCopyClientLink: (project: Project) => void;
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
  onOpenBackup: () => void;
}

const STATUS_FILTERS: Array<'Все' | ProjectStatus> = [
  'Все',
  'В работе',
  'На паузе',
  'Заморожен',
  'Сдан',
];

const PROJECT_STATUSES: ProjectStatus[] = [
  'В работе',
  'На паузе',
  'Заморожен',
  'Сдан',
];

// High-contrast noble modernist palette for cost structure donut
const STUDIO_DONUT_COLORS = [
  '#0D9488', // deep teal-emerald
  '#0284C7', // saturated azure
  '#4F46E5', // soft indigo
  '#0891B2', // architectural cyan
  '#D97706', // warm amber-gold
  '#6366F1', // refined violet-indigo
  '#E11D48', // noble coral-ruby
];

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function getStatusColorClass(status: ProjectStatus): string {
  switch (status) {
    case 'В работе':
      return 'text-[#0284C7] font-semibold';
    case 'Сдан':
      return 'text-[#0D9488] font-semibold';
    case 'На паузе':
      return 'text-[#D97706] font-semibold';
    case 'Заморожен':
      return 'text-[#4C6D7C] font-medium';
  }
}

function getTrafficSignal(level: 'ok' | 'warning' | 'critical'): {
  label: string;
  textClass: string;
  badgeClass: string;
} {
  if (level === 'critical') {
    return {
      label: 'Критический риск',
      textClass: 'text-[#E11D48]',
      badgeClass:
        'border-[#FDA4AF]/75 bg-[#FFF1F2]/90 text-[#E11D48] backdrop-blur-xs',
    };
  }
  if (level === 'warning') {
    return {
      label: 'Внимание · ФОТ',
      textClass: 'text-[#B45309]',
      badgeClass:
        'border-amber-300/60 bg-amber-50/85 text-[#B45309] backdrop-blur-xs',
    };
  }
  return {
    label: 'В графике',
    textClass: 'text-[#0D9488]',
    badgeClass:
      'border-[#0D9488]/20 bg-[#F0FDFA]/90 text-[#0D9488] backdrop-blur-xs',
  };
}

export const StudioPulseView: React.FC<StudioPulseViewProps> = ({
  data,
  onSelectProject,
  onOpenNewProject,
  onCreateProposal,
  onEditProject,
  onDeleteProject,
  onDeleteAllDemo,
  onCopyClientLink,
  onUpdateProjectStatus,
  onOpenBackup,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Все' | ProjectStatus>('Все');
  const [onlyRisk, setOnlyRisk] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const pulse = useMemo(() => calculateStudioPulse(data), [data]);

  const demoProjects = useMemo(
    () => data.projects.filter((p) => p.isDemo || p.name.includes('[ДЕМО]')),
    [data.projects]
  );

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.projects.filter((p) => {
      if (onlyRisk && !pulse.projectAtRisk[p.id]) return false;
      if (statusFilter !== 'Все' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.clientContact.toLowerCase().includes(q)
      );
    });
  }, [data.projects, search, statusFilter, onlyRisk, pulse.projectAtRisk]);

  // Max financial value across all projects for normalized 3-bar comparative chart
  const maxProjectChartValue = useMemo(() => {
    let maxVal = 1;
    for (const p of data.projects) {
      const f = pulse.projectFinances[p.id];
      if (!f) continue;
      maxVal = Math.max(maxVal, f.contractTotal, f.paidTotal, f.totalCosts);
    }
    return maxVal;
  }, [data.projects, pulse.projectFinances]);

  const studioCostSlices: DonutSlice[] = useMemo(
    () =>
      pulse.studioCostBreakdown.map((item, idx) => ({
        id: item.group,
        label: item.group,
        value: item.amount,
        percent: item.percent,
        color: STUDIO_DONUT_COLORS[idx % STUDIO_DONUT_COLORS.length],
      })),
    [pulse.studioCostBreakdown]
  );

  const paidOverallPct =
    pulse.totalContract > 0
      ? Math.round((pulse.totalPaid / pulse.totalContract) * 100)
      : 0;
  const totalOutflow = pulse.totalCosts + pulse.unallocatedCurrentMonthSalary;

  const renderQuickLinkButton = (
    project: Project,
    label: string,
    url: string,
    icon: React.ReactNode
  ) => {
    if (url && url.trim()) {
      return (
        <a
          href={normalizeUrl(url.trim())}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 flex-1 items-center justify-center gap-1 rounded-full border border-[#0EA5E9]/18 bg-[#F0F9FF]/80 px-2.5 text-[11px] font-medium text-[#0F2936] transition-all hover:border-[#0D9488] hover:bg-[#0D9488] hover:text-white whitespace-nowrap"
          title={`Открыть: ${label}`}
        >
          {icon}
          <span>{label}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-60" strokeWidth={1.6} />
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onEditProject(project)}
        className="flex h-8 flex-1 items-center justify-center gap-1 rounded-full border border-dashed border-[#0EA5E9]/24 bg-white/65 px-2.5 text-[11px] font-medium text-[#547585] transition-colors hover:border-[#0D9488] hover:text-[#0D9488] whitespace-nowrap"
        title={`Добавить ссылку: ${label}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-9">
      {/* Airy Modernist Hero Header with "В зоне риска" Toggle */}
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-medium text-[#547585]">
            Сводный дашборд студии · {data.projects.length}{' '}
            {data.projects.length === 1 ? 'объект' : 'объектов'} ·{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
              {pulse.totalAreaSqm} м²
            </span>
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-[#0F2936] sm:text-[34px]">
            Пульс студии
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Toggle: Only Problematic / At-Risk Projects */}
          <button
            type="button"
            onClick={() => setOnlyRisk((v) => !v)}
            aria-pressed={onlyRisk}
            className={`flex min-h-[40px] items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 backdrop-blur-xs ${
              onlyRisk
                ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-[0_8px_18px_rgba(225,29,72,0.22)]'
                : pulse.riskProjectsCount > 0
                ? 'border-[#FDA4AF]/75 bg-[#FFF1F2]/90 text-[#E11D48] hover:bg-[#E11D48] hover:text-white'
                : 'border-[#0EA5E9]/18 bg-white/85 text-[#0F2936] hover:border-[#0D9488] hover:bg-[#F0FDFA]'
            }`}
            title="Показать только объекты с просрочкой студии, просроченной оплатой КП или перерасходом бюджета команды"
          >
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>В зоне риска</span>
            <span className="font-mono tabular-nums">({pulse.riskProjectsCount})</span>
          </button>

          <button
            type="button"
            onClick={onOpenBackup}
            className="min-h-[40px] rounded-full border border-[#0EA5E9]/18 bg-white/85 px-4 py-2 text-xs font-medium text-[#0F2936] backdrop-blur-xs transition-colors hover:border-[#0D9488] hover:bg-[#F0FDFA] hover:text-[#0D9488] whitespace-nowrap shrink-0"
          >
            Резервная копия JSON
          </button>

          <button
            type="button"
            onClick={onCreateProposal}
            className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#0D9488]/30 bg-[#F0FDFA]/90 px-4 py-2 text-xs font-semibold text-[#0F766E] backdrop-blur-xs transition-colors hover:bg-[#0D9488] hover:text-white whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            Создать КП
          </button>

          <button
            type="button"
            onClick={onOpenNewProject}
            className="btn-pulse flex min-h-[40px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            Новый проект
          </button>
        </div>
      </div>

      {/* Demo Template Notice */}
      {demoProjects.length > 0 && (
        <div className="bento-card flex flex-col items-start justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-[#4C6D7C]">
            <span className="font-bold text-[#0F2936]">
              Активен демонстрационный портфель ({demoProjects.length}{' '}
              {demoProjects.length === 1 ? 'проект' : 'проекта'}).
            </span>{' '}
            Показаны примеры объектов со схемами 30/50/20 и 50/50, скидками и совмещением ролей. Вы можете удалить их одной кнопкой.
          </p>
          <button
            type="button"
            onClick={onDeleteAllDemo}
            className="min-h-[36px] rounded-full border border-[#B5DFE8] bg-white px-4 py-1.5 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#E11D48] hover:bg-[#FFF1F2] hover:text-[#E11D48] whitespace-nowrap shrink-0"
          >
            Удалить демо-данные и начать с нуля
          </button>
        </div>
      )}

      {/* 1. Top 4 Unified Light Bento KPI Cards */}
      <section aria-label="Ключевые показатели студии">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: Objects Portfolio */}
          <div className="bento-card flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#547585]">01. Объекты студии</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" aria-hidden="true" />
              </div>
              <div className="mt-3.5 flex items-baseline gap-2.5">
                <span className="font-mono text-3xl font-semibold tabular-nums text-[#0F2936]">
                  {pulse.activeProjectsCount}
                </span>
                <span className="text-xs font-medium text-[#547585]">в работе</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#0EA5E9]/12 pt-4 text-xs">
              <div>
                <div className="text-[11px] text-[#547585]">На паузе / заморожены</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {pulse.pausedProjectsCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#547585]">В зоне риска</div>
                <button
                  type="button"
                  onClick={() => setOnlyRisk((v) => !v)}
                  className={`mt-0.5 inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums underline-offset-4 hover:underline ${
                    pulse.riskProjectsCount > 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      pulse.riskProjectsCount > 0 ? 'bg-[#E11D48]' : 'bg-[#0D9488]'
                    }`}
                  />
                  {pulse.riskProjectsCount}
                </button>
              </div>
            </div>
          </div>

          {/* KPI 2: Revenue by KP */}
          <div className="bento-card flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#547585]">02. Выручка по КП</span>
                <span className="rounded-full border border-[#0D9488]/20 bg-[#F0FDFA]/90 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#0D9488]">
                  {paidOverallPct}% опл.
                </span>
              </div>
              <div className="mt-3.5 font-mono text-3xl font-semibold tabular-nums text-[#0F2936]">
                {formatCurrency(pulse.totalContract)}
              </div>
              <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-[#E5F4F8]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0D9488] to-[#0284C7]"
                  style={{ width: `${paidOverallPct}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#0EA5E9]/12 pt-4 text-xs">
              <div>
                <div className="text-[11px] text-[#547585]">Получено</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0D9488]">
                  {formatCurrency(pulse.totalPaid)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#547585]">Остаток к получению</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {formatCurrency(pulse.totalReceivables)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Team Costs & Expenses */}
          <div className="bento-card flex flex-col justify-between p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#547585]">
                  03. Затраты на команду и чеки
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" aria-hidden="true" />
              </div>
              <div className="mt-3.5 font-mono text-3xl font-semibold tabular-nums text-[#0F2936]">
                {formatCurrency(totalOutflow)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#0EA5E9]/12 pt-4 text-xs">
              <div>
                <div className="text-[11px] text-[#547585]">Оклады</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {formatCurrency(pulse.totalAllocatedSalary + pulse.unallocatedCurrentMonthSalary)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#547585]">Сдельная</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {formatCurrency(pulse.totalPiecework)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#547585]">Чеки</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {formatCurrency(pulse.totalDirectExpenses)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 4: Light Pastel-Teal Designer Balance Card — Текущее сальдо */}
          <div
            className={`flex flex-col justify-between p-6 ${
              pulse.cashBalance < 0 ? 'bento-card-risk' : 'bento-card-balance'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-medium ${
                    pulse.cashBalance < 0 ? 'text-[#9F1239]' : 'text-[#0F6E6E]'
                  }`}
                >
                  04. Текущее сальдо
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-xs ${
                    pulse.cashBalance < 0
                      ? 'border-[#FDA4AF]/75 bg-white/80 text-[#E11D48]'
                      : 'border-[#0D9488]/20 bg-white/80 text-[#0D9488]'
                  }`}
                >
                  {pulse.cashBalance < 0 ? 'Кассовый разрыв' : 'Положительное'}
                </span>
              </div>
              <div
                className={`mt-3.5 font-mono text-3xl font-semibold tabular-nums ${
                  pulse.cashBalance < 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                }`}
              >
                {pulse.cashBalance >= 0 ? '+' : ''}
                {formatCurrency(pulse.cashBalance)}
              </div>
            </div>
            <div
              className={`mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-xs ${
                pulse.cashBalance < 0 ? 'border-[#FDA4AF]/40' : 'border-[#0D9488]/16'
              }`}
            >
              <div>
                <div className="text-[11px] text-[#547585]">Прогноз прибыли</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                  {formatCurrency(pulse.totalMargin)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#547585]">Средняя маржа</div>
                <div
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    pulse.averageMarginPercent < 20 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                  }`}
                >
                  {pulse.averageMarginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Studio-Wide Summary Charts (High-Contrast Comparison + Cost Structure Donut) */}
      {data.projects.length > 0 && (
        <section
          aria-label="Сводная аналитика по всем проектам"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          {/* Chart A: Horizontal 3-Bar Comparison Across All Projects */}
          <div className="bento-card p-6 xl:col-span-7">
            <div className="flex flex-col justify-between gap-3.5 border-b border-[#0EA5E9]/12 pb-4">
              <div>
                <div className="text-[11px] font-medium text-[#547585]">
                  Сравнительный срез портфеля
                </div>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
                  Бюджет КП vs Получено vs Затраты по объектам
                </h2>
              </div>

              {/* Explicit High-Contrast Financial Color Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-[#0EA5E9]/14 bg-[#F4FAFC]/85 px-3.5 py-2.5 text-[11px] font-medium text-[#0F2936]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-full bg-[#0284C7]" />
                  Бюджет КП
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-full bg-[#0D9488]" />
                  Оплачено
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-full bg-[#4F46E5]" />
                  Затраты в норме
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-full bg-[#D97706]" />
                  Риск ФОТ (&gt;80%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-4 rounded-full bg-[#E11D48]" />
                  Превышение / срыв
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {data.projects.map((project) => {
                const fin = pulse.projectFinances[project.id];
                const kpW = (fin.contractTotal / maxProjectChartValue) * 100;
                const paidW = (fin.paidTotal / maxProjectChartValue) * 100;
                const costW = (fin.totalCosts / maxProjectChartValue) * 100;
                const fotUsageRatio =
                  fin.fotLimitPercent > 0 ? fin.fotPercentOfContract / fin.fotLimitPercent : 0;
                const isCritical = fin.isOverFotLimit || fin.isNegativeMargin || fin.isCashNegative;
                const isFotWarning = !isCritical && fotUsageRatio >= 0.8;

                return (
                  <div
                    key={project.id}
                    className={`rounded-2xl px-4 py-4 transition-all ${
                      isCritical
                        ? 'border border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/85'
                        : isFotWarning
                        ? 'border border-amber-300/60 border-l-4 border-l-[#D97706] bg-amber-50/55'
                        : 'border border-transparent hover:border-[#0EA5E9]/14 hover:bg-[#F4FAFC]/75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProject(project.id)}
                          className="text-left text-xs font-semibold text-[#0F2936] underline-offset-4 hover:text-[#0D9488] hover:underline"
                        >
                          {project.name}
                        </button>
                        {isCritical ? (
                          <span className="inline-flex items-center rounded-full border border-[#FDA4AF]/75 bg-white/85 px-2.5 py-0.5 text-[10px] font-semibold text-[#E11D48] backdrop-blur-xs">
                            Критический риск
                          </span>
                        ) : isFotWarning ? (
                          <span className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-50/85 px-2.5 py-0.5 text-[10px] font-semibold text-[#B45309] backdrop-blur-xs">
                            Внимание · ФОТ
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                        <span
                          className={
                            fin.isOverFotLimit
                              ? 'font-semibold text-[#E11D48]'
                              : isFotWarning
                              ? 'font-semibold text-[#D97706]'
                              : 'text-[#547585]'
                          }
                        >
                          ФОТ {fin.fotPercentOfContract.toFixed(0)}% / {fin.fotLimitPercent}%
                        </span>
                        <span className="text-[#C5E6EC]">·</span>
                        <span
                          className={
                            fin.isNegativeMargin
                              ? 'font-semibold text-[#E11D48]'
                              : fin.isCashNegative
                              ? 'font-semibold text-[#D97706]'
                              : 'font-semibold text-[#0D9488]'
                          }
                        >
                          Маржа {fin.projectedMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 3 High-Contrast Horizontal Bars */}
                    <div className="mt-3 space-y-2">
                      {/* Bar 1: Total KP Budget (#0284C7) */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#547585] sm:col-span-2">
                          КП
                        </span>
                        <div className="col-span-6 h-2.5 overflow-hidden rounded-full bg-[#E5F4F8]/90 sm:col-span-7">
                          <div
                            className="h-full rounded-full bg-[#0284C7]"
                            style={{ width: `${Math.max(kpW > 0 ? 2 : 0, kpW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] font-semibold tabular-nums text-[#0F2936]">
                          {formatCurrency(fin.contractTotal)}
                        </span>
                      </div>

                      {/* Bar 2: Received from Client (#0D9488) */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#547585] sm:col-span-2">
                          Оплачено
                        </span>
                        <div className="col-span-6 h-2.5 overflow-hidden rounded-full bg-[#E5F4F8]/90 sm:col-span-7">
                          <div
                            className="h-full rounded-full bg-[#0D9488]"
                            style={{ width: `${Math.max(paidW > 0 ? 2 : 0, paidW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] font-semibold tabular-nums text-[#0D9488]">
                          {formatCurrency(fin.paidTotal)}
                        </span>
                      </div>

                      {/* Bar 3: Team + Direct Costs (#4F46E5 normal, #D97706 warning, #E11D48 critical) */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#547585] sm:col-span-2">
                          Затраты
                        </span>
                        <div className="col-span-6 h-2.5 overflow-hidden rounded-full bg-[#E5F4F8]/90 sm:col-span-7">
                          <div
                            className={`h-full rounded-full ${
                              isCritical
                                ? 'bg-[#E11D48]'
                                : isFotWarning
                                ? 'bg-[#D97706]'
                                : 'bg-[#4F46E5]'
                            }`}
                            style={{ width: `${Math.max(costW > 0 ? 2 : 0, costW)}%` }}
                          />
                        </div>
                        <span
                          className={`col-span-3 text-right font-mono text-[11px] font-semibold tabular-nums ${
                            isCritical
                              ? 'text-[#E11D48]'
                              : isFotWarning
                              ? 'text-[#D97706]'
                              : 'text-[#4F46E5]'
                          }`}
                        >
                          {formatCurrency(fin.totalCosts)}
                        </span>
                      </div>
                    </div>

                    {isCritical && (
                      <div className="mt-2.5 text-[11px] font-semibold text-[#E11D48]">
                        {fin.isNegativeMargin
                          ? 'Превышение бюджета КП — проект уходит в минус'
                          : fin.isOverFotLimit
                          ? `Превышен лимит ФОТ (${fin.fotPercentOfContract.toFixed(1)}% при норме ${fin.fotLimitPercent}%)`
                          : 'Кассовый разрыв — расходы превысили полученные от клиента оплаты'}
                      </div>
                    )}
                    {isFotWarning && (
                      <div className="mt-2.5 text-[11px] font-medium text-[#B45309]">
                        Приближение к лимиту ФОТ: использовано {Math.round(fotUsageRatio * 100)}% бюджета команды
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart B: Studio Cost Structure Donut Chart + Breakdown Table */}
          <div className="bento-card p-6 xl:col-span-5">
            <div className="border-b border-[#0EA5E9]/12 pb-4">
              <div className="text-[11px] font-medium text-[#547585]">
                Распределение себестоимости
              </div>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
                Структура затрат студии
              </h2>
            </div>

            <div className="mt-6">
              <ArchitecturalDonutChart
                slices={studioCostSlices}
                centerLabel="Всего затрат"
                centerValue={formatCurrency(pulse.totalCosts)}
                centerSublabel="100% по объектам"
                emptyText="Затраты появятся после внесения выработки команды и чеков в журнале"
              />
            </div>

            {pulse.unallocatedCurrentMonthSalary > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-xs font-medium text-[#B45309] backdrop-blur-xs">
                Нераспределённый оклад текущего месяца:{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {formatCurrency(pulse.unallocatedCurrentMonthSalary)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Risk Alerts Strip */}
      {pulse.risks.length > 0 && (
        <section
          aria-label="Сигналы и риски"
          className="bento-card-risk overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-[#FDA4AF]/45 bg-[#FFF1F2]/75 px-6 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#9F1239]">
              <AlertTriangle className="h-4 w-4 text-[#E11D48]" strokeWidth={1.6} />
              Контроль рисков и отклонений
            </div>
            <span className="rounded-full bg-[#E11D48] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-white">
              {pulse.risks.length}
            </span>
          </div>
          <div className="divide-y divide-[#FDA4AF]/25 bg-white/65">
            {pulse.risks.map((risk) => (
              <div
                key={risk.id}
                className={`flex flex-col justify-between gap-2.5 px-6 py-4 sm:flex-row sm:items-center ${
                  risk.severity === 'critical'
                    ? 'bg-gradient-to-r from-[#FFF1F2]/70 to-[#FFF7ED]/50'
                    : 'bg-amber-50/45'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-xs ${
                        risk.severity === 'critical'
                          ? 'border-[#FDA4AF]/75 bg-white/85 text-[#E11D48]'
                          : 'border-amber-300/60 bg-amber-50/90 text-[#B45309]'
                      }`}
                    >
                      {risk.severity === 'critical' ? 'Критический риск' : 'Внимание'}
                    </span>
                    <span className="font-semibold text-[#0F2936]">{risk.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#547585]">{risk.detail}</p>
                </div>
                {risk.projectId && (
                  <button
                    type="button"
                    onClick={() => onSelectProject(risk.projectId!)}
                    className="inline-flex items-center gap-1 self-start rounded-full border border-[#0EA5E9]/20 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-[#0F2936] transition-colors hover:border-[#0D9488] hover:text-[#0D9488] sm:self-center whitespace-nowrap shrink-0"
                  >
                    К объекту
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Projects Registry with Risk Filter, Quick Actions, Cards / Table Switcher */}
      <section aria-label="Реестр проектов" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          {/* Status Filter Bar + At-Risk Active Indicator */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#C5E6EC] bg-white/80 p-1 backdrop-blur-sm">
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'btn-pulse'
                      : 'text-[#4C6D7C] hover:bg-[#EEF8FA] hover:text-[#0F2936]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {onlyRisk && (
              <button
                type="button"
                onClick={() => setOnlyRisk(false)}
                className="flex h-[38px] items-center gap-1.5 rounded-full bg-[#E11D48] px-3.5 text-xs font-semibold text-white hover:bg-[#BE123C] whitespace-nowrap"
              >
                Фильтр: только в зоне риска ×
              </button>
            )}
          </div>

          {/* Search + View Mode Switcher */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[#547585]"
                strokeWidth={1.6}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск объекта или адреса..."
                className="h-10 w-full rounded-full border border-[#0EA5E9]/18 bg-white/88 pr-4 pl-9 text-xs text-[#0F2936] placeholder:text-[#7A9AA8] backdrop-blur-xs focus:border-[#0D9488] focus:ring-2 focus:ring-[#14B8A6]/20 focus:outline-none"
              />
            </div>

            <div
              className="flex items-center gap-1 rounded-full border border-[#0EA5E9]/16 bg-white/80 p-1 self-start backdrop-blur-xs sm:self-auto"
              role="group"
              aria-label="Переключатель вида списка"
            >
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'btn-pulse font-semibold'
                    : 'text-[#547585] hover:text-[#0F2936]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.6} />
                Плитки
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'btn-pulse font-semibold'
                    : 'text-[#547585] hover:text-[#0F2936]'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                Таблица
              </button>
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="bento-card px-6 py-16 text-center">
            <p className="text-sm font-bold text-[#0F2936]">
              {data.projects.length === 0
                ? 'Список проектов пуст'
                : onlyRisk
                ? 'Проблемных объектов в зоне риска нет'
                : 'По вашему запросу проекты не найдены'}
            </p>
            <p className="mt-1.5 text-xs text-[#4C6D7C]">
              {data.projects.length === 0
                ? 'Создайте первый объект с нуля — настройте КП, этапы Ганта и бюджет.'
                : onlyRisk
                ? 'Все текущие объекты идут без просрочек студии, задержек оплаты КП и перерасхода команды.'
                : 'Измените статус фильтрации или очистите поиск.'}
            </p>
            {data.projects.length === 0 ? (
              <button
                type="button"
                onClick={onOpenNewProject}
                className="btn-pulse mt-5 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-5 py-2 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Создать первый проект
              </button>
            ) : onlyRisk ? (
              <button
                type="button"
                onClick={() => setOnlyRisk(false)}
                className="mt-5 inline-flex min-h-[38px] items-center rounded-full border border-[#B5DFE8] bg-white px-4 py-2 text-xs font-semibold text-[#0F2936] hover:border-[#0D9488] hover:text-[#0D9488]"
              >
                Показать все проекты
              </button>
            ) : null}
          </div>
        ) : viewMode === 'cards' ? (
          /* Modern Bento Project Cards Grid */
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const fin = pulse.projectFinances[project.id];
              const progress = getProjectProgress(project);
              const fotUsageRatio =
                fin.fotLimitPercent > 0 ? fin.fotPercentOfContract / fin.fotLimitPercent : 0;
              const rawRiskLevel = pulse.projectRiskLevel[project.id] || 'ok';
              const effectiveRiskLevel =
                rawRiskLevel === 'critical'
                  ? 'critical'
                  : rawRiskLevel === 'warning' || fotUsageRatio >= 0.8
                  ? 'warning'
                  : 'ok';
              const riskReasons = pulse.projectRiskReasons[project.id] || [];
              const signal = getTrafficSignal(effectiveRiskLevel);

              return (
                <article
                  key={project.id}
                  className={`flex flex-col justify-between overflow-hidden transition-all hover:shadow-[0_14px_34px_-10px_rgba(15,76,92,0.13)] ${
                    effectiveRiskLevel === 'critical'
                      ? 'bento-card-risk'
                      : effectiveRiskLevel === 'warning'
                      ? 'bento-card border-l-4 border-l-[#D97706]'
                      : 'bento-card'
                  }`}
                >
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      {/* Top Row: Inline Quick Status Dropdown + Area + Signal */}
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Статус объекта ${project.name}`}
                            value={project.status}
                            onChange={(e) =>
                              onUpdateProjectStatus(
                                project.id,
                                e.target.value as ProjectStatus
                              )
                            }
                            className={`h-7 cursor-pointer rounded-full border border-[#0EA5E9]/18 bg-white/85 px-2.5 text-[11px] focus:border-[#0D9488] focus:outline-none ${getStatusColorClass(
                              project.status
                            )}`}
                          >
                            {PROJECT_STATUSES.map((st) => (
                              <option key={st} value={st} className="text-[#0F2936]">
                                {st}
                              </option>
                            ))}
                          </select>
                          <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                            {project.areaSqm} м²
                          </span>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${signal.badgeClass}`}
                        >
                          {signal.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="mt-4 block w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold tracking-tight text-[#0F2936] underline-offset-4 hover:text-[#0D9488] hover:underline">
                            {project.name}
                          </h3>
                          {project.isDemo && (
                            <span className="rounded-full border border-[#0EA5E9]/18 bg-[#F0F9FF] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-[#547585]">
                              ДЕМО
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#547585]">
                          {project.address || 'Адрес не указан'}
                        </p>
                      </button>

                      {/* Risk Reasons Line (if any) */}
                      {riskReasons.length > 0 && (
                        <div
                          className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-medium ${
                            effectiveRiskLevel === 'critical'
                              ? 'border border-[#FDA4AF]/45 bg-white/70 text-[#E11D48]'
                              : 'border border-amber-300/50 bg-amber-50/85 text-[#B45309]'
                          }`}
                        >
                          {riskReasons.join(' · ')}
                        </div>
                      )}

                      {/* Quick Access Links: КП / Обмер / Папка */}
                      <div className="mt-4 flex items-center gap-2">
                        {renderQuickLinkButton(
                          project,
                          'КП',
                          project.links.proposalUrl,
                          <FileText className="h-3 w-3 shrink-0" strokeWidth={1.6} />
                        )}
                        {renderQuickLinkButton(
                          project,
                          'Обмер',
                          project.links.measurementUrl,
                          <Ruler className="h-3 w-3 shrink-0" strokeWidth={1.6} />
                        )}
                        {renderQuickLinkButton(
                          project,
                          'Папка',
                          project.links.folderUrl,
                          <FolderOpen className="h-3 w-3 shrink-0" strokeWidth={1.6} />
                        )}
                      </div>

                      {/* High-Contrast Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="font-medium text-[#547585]">Готовность проекта</span>
                          <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                            {progress}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E5F4F8]">
                          <div
                            className={`h-full rounded-full ${
                              progress === 100
                                ? 'bg-[#0D9488]'
                                : effectiveRiskLevel === 'critical'
                                ? 'bg-[#E11D48]'
                                : 'bg-[#0284C7]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial Snapshot Grid */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#0EA5E9]/12 pt-4 text-xs">
                        <div>
                          <div className="text-[10px] font-medium text-[#547585]">КП / Оплачено</div>
                          <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                            {formatCurrency(fin.contractTotal)}
                          </div>
                          <div className="font-mono text-[10px] font-semibold tabular-nums text-[#0D9488]">
                            {fin.paidPercent}% опл.
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-medium text-[#547585]">Затраты</div>
                          <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#0F2936]">
                            {formatCurrency(fin.totalCosts)}
                          </div>
                          <div
                            className={`font-mono text-[10px] tabular-nums ${
                              fin.isOverFotLimit
                                ? 'font-semibold text-[#E11D48]'
                                : fotUsageRatio >= 0.8
                                ? 'font-semibold text-[#D97706]'
                                : 'text-[#547585]'
                            }`}
                          >
                            ФОТ {fin.fotPercentOfContract.toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-medium text-[#547585]">Маржа</div>
                          <div
                            className={`mt-0.5 font-mono font-semibold tabular-nums ${
                              fin.isNegativeMargin ? 'text-[#E11D48]' : 'text-[#0D9488]'
                            }`}
                          >
                            {fin.projectedMarginPercent.toFixed(1)}%
                          </div>
                          <div className="font-mono text-[10px] tabular-nums text-[#547585]">
                            {formatCurrency(fin.projectedMarginAmount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Strip */}
                    <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#0EA5E9]/12 pt-4">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="btn-pulse flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold"
                      >
                        Открыть объект
                        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.7} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyClientLink(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white/90 text-[#0F2936] transition-colors hover:border-[#0D9488] hover:bg-[#0D9488] hover:text-white"
                        title="Скопировать ссылку клиенту (?view=client&project=...)"
                        aria-label="Скопировать ссылку клиенту"
                      >
                        <Link2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white/90 text-[#0F2936] transition-colors hover:border-[#0284C7] hover:text-[#0284C7]"
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white/90 text-[#547585] transition-colors hover:border-[#E11D48] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Compact Summary Table with Sticky Left Column + Quick Status + Quick Links */
          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#0EA5E9]/16 bg-[#EFF9FB] text-[11px] font-semibold text-[#0F2936]">
                    <th className="sticky left-0 z-10 border-r border-[#0EA5E9]/14 bg-[#EFF9FB] px-5 py-3.5">
                      Объект и материалы
                    </th>
                    <th className="px-4 py-3.5">Статус / Светофор</th>
                    <th className="px-4 py-3.5 text-right">Готовность</th>
                    <th className="px-4 py-3.5 text-right">Бюджет КП</th>
                    <th className="px-4 py-3.5 text-right">Получено</th>
                    <th className="px-4 py-3.5 text-right">Затраты / ФОТ</th>
                    <th className="px-4 py-3.5 text-right">Маржа</th>
                    <th className="px-5 py-3.5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0EA5E9]/10">
                  {filteredProjects.map((project) => {
                    const fin = pulse.projectFinances[project.id];
                    const progress = getProjectProgress(project);
                    const fotUsageRatio =
                      fin.fotLimitPercent > 0 ? fin.fotPercentOfContract / fin.fotLimitPercent : 0;
                    const rawRiskLevel = pulse.projectRiskLevel[project.id] || 'ok';
                    const effectiveRiskLevel =
                      rawRiskLevel === 'critical'
                        ? 'critical'
                        : rawRiskLevel === 'warning' || fotUsageRatio >= 0.8
                        ? 'warning'
                        : 'ok';
                    const signal = getTrafficSignal(effectiveRiskLevel);

                    return (
                      <tr
                        key={project.id}
                        className={`group transition-colors ${
                          effectiveRiskLevel === 'critical'
                            ? 'bg-gradient-to-r from-[#FFF1F2]/85 to-[#FFF7ED]/70 hover:from-[#FFE4E6]/75 hover:to-[#FFF1F2]/75'
                            : effectiveRiskLevel === 'warning'
                            ? 'bg-amber-50/50 hover:bg-amber-50/85'
                            : 'hover:bg-[#F4FAFC]'
                        }`}
                      >
                        <td
                          className={`sticky left-0 z-10 border-r border-[#0EA5E9]/12 px-5 py-3.5 transition-colors ${
                            effectiveRiskLevel === 'critical'
                              ? 'border-l-4 border-l-rose-500 bg-[#FFF3F4] group-hover:bg-[#FFE8EA]'
                              : effectiveRiskLevel === 'warning'
                              ? 'border-l-4 border-l-[#D97706] bg-[#FFFDF4] group-hover:bg-amber-50'
                              : 'bg-white group-hover:bg-[#F4FAFC]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectProject(project.id)}
                            className="text-left"
                          >
                            <div className="text-xs font-semibold text-[#0F2936] underline-offset-4 group-hover:text-[#0D9488] group-hover:underline">
                              {project.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#4C6D7C]">
                              {project.areaSqm} м² · {project.address || 'Без адреса'}
                            </div>
                          </button>
                          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                            {project.links.proposalUrl && (
                              <a
                                href={normalizeUrl(project.links.proposalUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#0284C9] underline underline-offset-2"
                              >
                                КП
                              </a>
                            )}
                            {project.links.measurementUrl && (
                              <a
                                href={normalizeUrl(project.links.measurementUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#0284C9] underline underline-offset-2"
                              >
                                Обмер
                              </a>
                            )}
                            {project.links.folderUrl && (
                              <a
                                href={normalizeUrl(project.links.folderUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#0284C9] underline underline-offset-2"
                              >
                                Папка
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <select
                            aria-label={`Статус объекта ${project.name}`}
                            value={project.status}
                            onChange={(e) =>
                              onUpdateProjectStatus(
                                project.id,
                                e.target.value as ProjectStatus
                              )
                            }
                            className={`h-7 cursor-pointer rounded-full border border-[#C5E6EC] bg-white px-2.5 text-xs focus:border-[#0D9488] focus:outline-none ${getStatusColorClass(
                              project.status
                            )}`}
                          >
                            {PROJECT_STATUSES.map((st) => (
                              <option key={st} value={st} className="text-[#0F2936]">
                                {st}
                              </option>
                            ))}
                          </select>
                          <div className={`mt-1 text-[11px] font-bold ${signal.textClass}`}>
                            {signal.label}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="font-mono text-xs font-bold tabular-nums text-[#0F2936]">
                            {progress}%
                          </div>
                            <div className="mt-1 ml-auto h-2 w-16 overflow-hidden rounded-full bg-[#E5F4F8]">
                              <div
                                className={`h-full rounded-full ${
                                  progress === 100
                                    ? 'bg-[#0D9488]'
                                    : effectiveRiskLevel === 'critical'
                                    ? 'bg-[#E11D48]'
                                    : 'bg-[#0284C7]'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-[#0F2936] whitespace-nowrap">
                            {formatCurrency(fin.contractTotal)}
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-[#0D9488]">
                              {formatCurrency(fin.paidTotal)}
                            </div>
                            <div className="text-[11px] text-[#547585]">{fin.paidPercent}%</div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-[#0F2936]">
                              {formatCurrency(fin.totalCosts)}
                            </div>
                            <div
                              className={`text-[11px] ${
                                fin.isOverFotLimit
                                  ? 'font-semibold text-[#E11D48]'
                                  : fotUsageRatio >= 0.8
                                  ? 'font-semibold text-[#D97706]'
                                  : 'text-[#547585]'
                              }`}
                            >
                              ФОТ {fin.fotPercentOfContract.toFixed(1)}%
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                            <div
                              className={`font-semibold ${
                                fin.isNegativeMargin ? 'text-[#E11D48]' : 'text-[#0F2936]'
                              }`}
                            >
                              {formatCurrency(fin.projectedMarginAmount)}
                            </div>
                            <div
                              className={`text-[11px] font-semibold ${
                                fin.projectedMarginPercent < 20 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                              }`}
                            >
                              {fin.projectedMarginPercent.toFixed(1)}%
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectProject(project.id)}
                                className="btn-pulse h-8 rounded-full px-3.5 text-xs font-semibold"
                              >
                                Открыть
                              </button>
                              <button
                                type="button"
                                onClick={() => onCopyClientLink(project)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#0F2936] hover:border-[#0D9488] hover:bg-[#0D9488] hover:text-white"
                                title="Скопировать ссылку клиенту"
                                aria-label="Скопировать ссылку клиенту"
                              >
                                <Link2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditProject(project)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#0F2936] hover:border-[#0284C7] hover:text-[#0284C7]"
                                aria-label="Редактировать"
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteProject(project)}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] hover:border-[#E11D48] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                                aria-label="Удалить"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                              </button>
                            </div>
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
