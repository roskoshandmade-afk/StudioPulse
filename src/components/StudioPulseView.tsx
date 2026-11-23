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

const STUDIO_DONUT_COLORS = [
  '#0A0A0A',
  '#3B3B3B',
  '#6B6B6B',
  '#9A9A9A',
  '#C4C4C4',
  '#DEDEDE',
];

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function getStatusColorClass(status: ProjectStatus): string {
  switch (status) {
    case 'В работе':
      return 'text-[#0A0A0A] font-semibold';
    case 'Сдан':
      return 'text-[#15803D] font-semibold';
    case 'На паузе':
      return 'text-[#D97706] font-semibold';
    case 'Заморожен':
      return 'text-[#737373] font-medium';
  }
}

function getTrafficSignal(level: 'ok' | 'warning' | 'critical'): {
  label: string;
  textClass: string;
  barClass: string;
} {
  if (level === 'critical') {
    return {
      label: 'Зона риска',
      textClass: 'text-[#DC2626]',
      barClass: 'bg-[#DC2626]',
    };
  }
  if (level === 'warning') {
    return {
      label: 'Внимание',
      textClass: 'text-[#D97706]',
      barClass: 'bg-[#D97706]',
    };
  }
  return {
    label: 'В графике',
    textClass: 'text-[#15803D]',
    barClass: 'bg-[#15803D]',
  };
}

export const StudioPulseView: React.FC<StudioPulseViewProps> = ({
  data,
  onSelectProject,
  onOpenNewProject,
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
          className="flex h-8 flex-1 items-center justify-center gap-1 border border-[#0A0A0A] bg-[#F4F4F4] px-2 text-[11px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap"
          title={`Открыть: ${label}`}
        >
          {icon}
          <span>{label}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-60" />
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onEditProject(project)}
        className="flex h-8 flex-1 items-center justify-center gap-1 border border-dashed border-[#D4D4D4] bg-white px-2 text-[11px] font-medium text-[#737373] transition-colors hover:border-[#0A0A0A] hover:text-[#0A0A0A] whitespace-nowrap"
        title={`Добавить ссылку: ${label}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-10">
      {/* Editorial Hero Header with "В зоне риска" Toggle */}
      <div className="flex flex-col justify-between gap-5 border-b-2 border-[#0A0A0A] pb-6 md:flex-row md:items-end">
        <div>
          <div className="text-xs text-[#525252]">
            Сводный аналитический дашборд · {data.projects.length}{' '}
            {data.projects.length === 1 ? 'объект' : 'объектов'} ·{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">
              {pulse.totalAreaSqm} м²
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0A0A0A] sm:text-4xl">
            Пульс студии
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Toggle: Only Problematic / At-Risk Projects */}
          <button
            type="button"
            onClick={() => setOnlyRisk((v) => !v)}
            aria-pressed={onlyRisk}
            className={`flex min-h-[40px] items-center gap-2 border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              onlyRisk
                ? 'border-[#DC2626] bg-[#DC2626] text-white'
                : pulse.riskProjectsCount > 0
                ? 'border-[#DC2626] bg-white text-[#DC2626] hover:bg-[#DC2626] hover:text-white'
                : 'border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#F4F4F4]'
            }`}
            title="Показать только объекты с просрочкой студии, просроченной оплатой КП или перерасходом бюджета команды"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>В зоне риска</span>
            <span className="font-mono tabular-nums">({pulse.riskProjectsCount})</span>
          </button>

          <button
            type="button"
            onClick={onOpenBackup}
            className="min-h-[40px] border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#F4F4F4] whitespace-nowrap shrink-0"
          >
            Резервная копия JSON
          </button>

          <button
            type="button"
            onClick={onOpenNewProject}
            className="flex min-h-[40px] items-center gap-1.5 bg-[#0A0A0A] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#262626] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Новый проект
          </button>
        </div>
      </div>

      {/* Demo Template Notice */}
      {demoProjects.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 border border-[#0A0A0A] bg-[#F4F4F4] px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-xs leading-relaxed text-[#525252]">
            <span className="font-semibold text-[#0A0A0A]">
              Активен демонстрационный портфель ({demoProjects.length}{' '}
              {demoProjects.length === 1 ? 'проект' : 'проекта'}).
            </span>{' '}
            Показаны примеры объектов со схемами 30/50/20 и 50/50, скидками и совмещением ролей. Вы можете удалить их одной кнопкой.
          </p>
          <button
            type="button"
            onClick={onDeleteAllDemo}
            className="min-h-[36px] border border-[#0A0A0A] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
          >
            Удалить демо-данные и начать с нуля
          </button>
        </div>
      )}

      {/* 1. Top 4 Inverse High-Contrast Studio KPI Panel (#0A0A0A architectural carbon block) */}
      <section aria-label="Ключевые показатели студии">
        <div className="grid grid-cols-1 gap-px border border-[#0A0A0A] bg-[#262626] sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: Objects Portfolio */}
          <div className="flex flex-col justify-between bg-[#0A0A0A] p-6 text-white">
            <div>
              <div className="text-xs font-medium tracking-wide text-[#A3A3A3]">
                01. Объекты студии
              </div>
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="font-mono text-3xl font-bold tabular-nums text-white">
                  {pulse.activeProjectsCount}
                </span>
                <span className="text-xs text-[#A3A3A3]">в работе</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#262626] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#A3A3A3]">На паузе / заморожены</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-white">
                  {pulse.pausedProjectsCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#A3A3A3]">В зоне риска</div>
                <button
                  type="button"
                  onClick={() => setOnlyRisk((v) => !v)}
                  className={`mt-0.5 inline-flex items-center gap-1.5 font-mono font-bold tabular-nums underline-offset-4 hover:underline ${
                    pulse.riskProjectsCount > 0 ? 'text-[#F87171]' : 'text-[#4ADE80]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 ${
                      pulse.riskProjectsCount > 0 ? 'bg-[#DC2626]' : 'bg-[#15803D]'
                    }`}
                  />
                  {pulse.riskProjectsCount}
                </button>
              </div>
            </div>
          </div>

          {/* KPI 2: Revenue by KP */}
          <div className="flex flex-col justify-between bg-[#0A0A0A] p-6 text-white">
            <div>
              <div className="text-xs font-medium tracking-wide text-[#A3A3A3]">
                02. Выручка по КП
              </div>
              <div className="mt-3 font-mono text-3xl font-bold tabular-nums text-white">
                {formatCurrency(pulse.totalContract)}
              </div>
              <div className="mt-3 h-1.5 w-full bg-[#262626]">
                <div
                  className="h-full bg-[#15803D]"
                  style={{ width: `${paidOverallPct}%` }}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#262626] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Получено ({paidOverallPct}%)</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-[#4ADE80]">
                  {formatCurrency(pulse.totalPaid)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Остаток к получению</div>
                <div className="mt-0.5 font-mono font-semibold tabular-nums text-white">
                  {formatCurrency(pulse.totalReceivables)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 3: Total Team Costs & Expenses */}
          <div className="flex flex-col justify-between bg-[#0A0A0A] p-6 text-white">
            <div>
              <div className="text-xs font-medium tracking-wide text-[#A3A3A3]">
                03. Затраты на команду и чеки
              </div>
              <div className="mt-3 font-mono text-3xl font-bold tabular-nums text-white">
                {formatCurrency(totalOutflow)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#262626] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Оклады</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-white">
                  {formatCurrency(pulse.totalAllocatedSalary + pulse.unallocatedCurrentMonthSalary)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Сдельная</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-white">
                  {formatCurrency(pulse.totalPiecework)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Чеки</div>
                <div className="mt-0.5 font-mono font-medium tabular-nums text-white">
                  {formatCurrency(pulse.totalDirectExpenses)}
                </div>
              </div>
            </div>
          </div>

          {/* KPI 4: Focal Accent Card — Текущее сальдо и маржа */}
          <div className="flex flex-col justify-between border-t-4 border-t-white bg-[#0A0A0A] p-6 text-white xl:border-t-0 xl:border-l-2 xl:border-l-white">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wide text-white">
                  04. Текущее сальдо
                </span>
                <span
                  className={`h-2.5 w-2.5 shrink-0 ${
                    pulse.cashBalance < 0 ? 'bg-[#DC2626]' : 'bg-[#15803D]'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <div
                className={`mt-3 font-mono text-3xl font-bold tabular-nums ${
                  pulse.cashBalance < 0 ? 'text-[#F87171]' : 'text-white'
                }`}
              >
                {pulse.cashBalance >= 0 ? '+' : ''}
                {formatCurrency(pulse.cashBalance)}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#333333] pt-3.5 text-xs">
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Прогноз прибыли</div>
                <div
                  className={`mt-0.5 font-mono font-semibold tabular-nums ${
                    pulse.totalMargin < 0 ? 'text-[#F87171]' : 'text-white'
                  }`}
                >
                  {formatCurrency(pulse.totalMargin)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Средняя маржа</div>
                <div
                  className={`mt-0.5 font-mono font-bold tabular-nums ${
                    pulse.averageMarginPercent < 20
                      ? 'text-[#F87171]'
                      : pulse.averageMarginPercent < 35
                      ? 'text-[#FBBF24]'
                      : 'text-[#4ADE80]'
                  }`}
                >
                  {pulse.averageMarginPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Studio-Wide Summary Charts (Comparison Across Projects + Cost Structure Donut) */}
      {data.projects.length > 0 && (
        <section
          aria-label="Сводная аналитика по всем проектам"
          className="grid grid-cols-1 gap-6 xl:grid-cols-12"
        >
          {/* Chart A: Horizontal 3-Bar Comparison Across All Projects */}
          <div className="border border-[#0A0A0A] bg-white p-6 xl:col-span-7">
            <div className="flex flex-col justify-between gap-3 border-b border-[#0A0A0A] pb-4 sm:flex-row sm:items-end">
              <div>
                <div className="text-[11px] text-[#525252]">Сравнительный срез портфеля</div>
                <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#0A0A0A]">
                  Бюджет КП vs Получено vs Затраты по объектам
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3.5 text-[11px] text-[#525252]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 border border-[#0A0A0A] bg-[#F4F4F4]" />
                  Бюджет КП
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 bg-[#15803D]" />
                  Получено
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 bg-[#0A0A0A]" />
                  Затраты
                </span>
              </div>
            </div>

            <div className="mt-5 divide-y divide-[#D4D4D4]">
              {data.projects.map((project) => {
                const fin = pulse.projectFinances[project.id];
                const kpW = (fin.contractTotal / maxProjectChartValue) * 100;
                const paidW = (fin.paidTotal / maxProjectChartValue) * 100;
                const costW = (fin.totalCosts / maxProjectChartValue) * 100;
                const isDanger = fin.isOverFotLimit || fin.isNegativeMargin || fin.isCashNegative;

                return (
                  <div key={project.id} className="py-4 first:pt-1 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="text-left text-xs font-bold text-[#0A0A0A] underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </button>
                      <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                        <span className="text-[#525252]">
                          ФОТ {fin.fotPercentOfContract.toFixed(0)}% / {fin.fotLimitPercent}%
                        </span>
                        <span className="text-[#D4D4D4]">·</span>
                        <span
                          className={
                            fin.isNegativeMargin
                              ? 'font-bold text-[#DC2626]'
                              : fin.isCashNegative
                              ? 'font-bold text-[#D97706]'
                              : 'font-bold text-[#15803D]'
                          }
                        >
                          Маржа {fin.projectedMarginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 3 Stacked Horizontal Bars */}
                    <div className="mt-2.5 space-y-1.5">
                      {/* Bar 1: Total KP Budget */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#525252] sm:col-span-2">
                          КП
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F4F4F4] sm:col-span-7">
                          <div
                            className="h-full border border-[#0A0A0A] bg-[#E5E5E5]"
                            style={{ width: `${Math.max(kpW > 0 ? 1.5 : 0, kpW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] tabular-nums text-[#0A0A0A]">
                          {formatCurrency(fin.contractTotal)}
                        </span>
                      </div>

                      {/* Bar 2: Received from Client */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#525252] sm:col-span-2">
                          Оплачено
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F4F4F4] sm:col-span-7">
                          <div
                            className="h-full bg-[#15803D]"
                            style={{ width: `${Math.max(paidW > 0 ? 1.5 : 0, paidW)}%` }}
                          />
                        </div>
                        <span className="col-span-3 text-right font-mono text-[11px] font-semibold tabular-nums text-[#15803D]">
                          {formatCurrency(fin.paidTotal)}
                        </span>
                      </div>

                      {/* Bar 3: Team + Direct Costs */}
                      <div className="grid grid-cols-12 items-center gap-2">
                        <span className="col-span-3 text-[11px] font-medium text-[#525252] sm:col-span-2">
                          Затраты
                        </span>
                        <div className="col-span-6 h-2.5 bg-[#F4F4F4] sm:col-span-7">
                          <div
                            className={`h-full ${isDanger ? 'bg-[#DC2626]' : 'bg-[#0A0A0A]'}`}
                            style={{ width: `${Math.max(costW > 0 ? 1.5 : 0, costW)}%` }}
                          />
                        </div>
                        <span
                          className={`col-span-3 text-right font-mono text-[11px] font-semibold tabular-nums ${
                            isDanger ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                          }`}
                        >
                          {formatCurrency(fin.totalCosts)}
                        </span>
                      </div>
                    </div>

                    {isDanger && (
                      <div className="mt-2 text-[11px] font-semibold text-[#DC2626]">
                        {fin.isNegativeMargin
                          ? 'Превышение бюджета КП — проект уходит в минус'
                          : fin.isOverFotLimit
                          ? `Превышен порог ФОТ (${fin.fotPercentOfContract.toFixed(1)}% при лимите ${fin.fotLimitPercent}%)`
                          : 'Кассовый разрыв — расходы превысили полученные от клиента оплаты'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart B: Studio Cost Structure Donut Chart + Breakdown Table */}
          <div className="border border-[#0A0A0A] bg-white p-6 xl:col-span-5">
            <div className="border-b border-[#0A0A0A] pb-4">
              <div className="text-[11px] text-[#525252]">Распределение себестоимости</div>
              <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#0A0A0A]">
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
              <div className="mt-5 border-t border-[#D4D4D4] pt-3.5 text-xs font-medium text-[#D97706]">
                Нераспределённый оклад текущего месяца:{' '}
                <span className="font-mono font-bold tabular-nums">
                  {formatCurrency(pulse.unallocatedCurrentMonthSalary)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Risk Alerts Strip */}
      {pulse.risks.length > 0 && (
        <section aria-label="Сигналы и риски" className="border border-[#0A0A0A] bg-white">
          <div className="flex items-center justify-between border-b border-[#0A0A0A] bg-[#F4F4F4] px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0A0A0A]">
              <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
              Контроль рисков и отклонений
            </div>
            <span className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
              {pulse.risks.length}
            </span>
          </div>
          <div className="divide-y divide-[#D4D4D4]">
            {pulse.risks.map((risk) => (
              <div
                key={risk.id}
                className="flex flex-col justify-between gap-2 px-5 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        risk.severity === 'critical'
                          ? 'font-bold text-[#DC2626]'
                          : 'font-bold text-[#D97706]'
                      }
                    >
                      {risk.severity === 'critical' ? 'Критично' : 'Внимание'}
                    </span>
                    <span className="text-[#D4D4D4]">·</span>
                    <span className="font-semibold text-[#0A0A0A]">{risk.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#525252]">{risk.detail}</p>
                </div>
                {risk.projectId && (
                  <button
                    type="button"
                    onClick={() => onSelectProject(risk.projectId!)}
                    className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[#0A0A0A] underline-offset-4 hover:underline sm:self-center whitespace-nowrap shrink-0"
                  >
                    К объекту
                    <ArrowUpRight className="h-3.5 w-3.5" />
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
            <div className="flex flex-wrap items-center gap-1 border border-[#0A0A0A] bg-[#F4F4F4] p-1">
              {STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-[#0A0A0A] text-white'
                      : 'text-[#525252] hover:text-[#0A0A0A]'
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
                className="flex h-[38px] items-center gap-1.5 border border-[#DC2626] bg-[#DC2626] px-3 text-xs font-semibold text-white hover:bg-[#B91C1C] whitespace-nowrap"
              >
                Фильтр: только в зоне риска ×
              </button>
            )}
          </div>

          {/* Search + View Mode Switcher */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#525252]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск объекта или адреса..."
                className="h-10 w-full border border-[#0A0A0A] bg-white pr-3 pl-9 text-xs text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none"
              />
            </div>

            <div
              className="flex items-center border border-[#0A0A0A] bg-[#F4F4F4] p-1 self-start sm:self-auto"
              role="group"
              aria-label="Переключатель вида списка"
            >
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  viewMode === 'cards'
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Плитки
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#525252] hover:text-[#0A0A0A]'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Таблица
              </button>
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="border border-[#0A0A0A] bg-white px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[#0A0A0A]">
              {data.projects.length === 0
                ? 'Список проектов пуст'
                : onlyRisk
                ? 'Проблемных объектов в зоне риска нет'
                : 'По вашему запросу проекты не найдены'}
            </p>
            <p className="mt-1.5 text-xs text-[#525252]">
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
                className="mt-5 inline-flex min-h-[40px] items-center gap-1.5 bg-[#0A0A0A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#262626]"
              >
                <Plus className="h-3.5 w-3.5" />
                Создать первый проект
              </button>
            ) : onlyRisk ? (
              <button
                type="button"
                onClick={() => setOnlyRisk(false)}
                className="mt-5 inline-flex min-h-[38px] items-center border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-semibold text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
              >
                Показать все проекты
              </button>
            ) : null}
          </div>
        ) : viewMode === 'cards' ? (
          /* High-Contrast Architectural Cards Grid View */
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const fin = pulse.projectFinances[project.id];
              const progress = getProjectProgress(project);
              const riskLevel = pulse.projectRiskLevel[project.id] || 'ok';
              const riskReasons = pulse.projectRiskReasons[project.id] || [];
              const signal = getTrafficSignal(riskLevel);

              return (
                <article
                  key={project.id}
                  className="flex flex-col justify-between border border-[#0A0A0A] bg-white"
                >
                  {/* Top Crisp Signal Hairline */}
                  <div className={`h-1 w-full ${signal.barClass}`} />

                  <div className="flex flex-1 flex-col justify-between p-5">
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
                            className={`h-7 cursor-pointer border border-[#D4D4D4] bg-[#F4F4F4] px-2 text-[11px] focus:border-[#0A0A0A] focus:outline-none ${getStatusColorClass(
                              project.status
                            )}`}
                          >
                            {PROJECT_STATUSES.map((st) => (
                              <option key={st} value={st} className="text-[#0A0A0A]">
                                {st}
                              </option>
                            ))}
                          </select>
                          <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">
                            {project.areaSqm} м²
                          </span>
                        </div>
                        <span className={`font-bold ${signal.textClass}`}>
                          {signal.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="mt-3.5 block w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold tracking-tight text-[#0A0A0A] underline-offset-4 hover:underline">
                            {project.name}
                          </h3>
                          {project.isDemo && (
                            <span className="border border-[#D4D4D4] bg-[#F4F4F4] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-[#525252]">
                              ДЕМО
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#525252]">
                          {project.address || 'Адрес не указан'}
                        </p>
                      </button>

                      {/* Risk Reasons Line (if any) */}
                      {riskReasons.length > 0 && (
                        <div className="mt-2.5 text-[11px] font-semibold text-[#DC2626]">
                          {riskReasons.join(' · ')}
                        </div>
                      )}

                      {/* Quick Access Links: КП / Обмер / Папка */}
                      <div className="mt-4 flex items-center gap-1.5">
                        {renderQuickLinkButton(
                          project,
                          'КП',
                          project.links.proposalUrl,
                          <FileText className="h-3 w-3 shrink-0" />
                        )}
                        {renderQuickLinkButton(
                          project,
                          'Обмер',
                          project.links.measurementUrl,
                          <Ruler className="h-3 w-3 shrink-0" />
                        )}
                        {renderQuickLinkButton(
                          project,
                          'Папка',
                          project.links.folderUrl,
                          <FolderOpen className="h-3 w-3 shrink-0" />
                        )}
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className="text-[#525252]">Готовность проекта</span>
                          <span className="font-mono font-bold tabular-nums text-[#0A0A0A]">
                            {progress}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-[#F4F4F4]">
                          <div
                            className={`h-full ${
                              progress === 100 ? 'bg-[#15803D]' : 'bg-[#0A0A0A]'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Financial Snapshot Grid */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#D4D4D4] pt-4 text-xs">
                        <div>
                          <div className="text-[10px] text-[#525252]">КП / Оплачено</div>
                          <div className="mt-0.5 font-mono font-bold tabular-nums text-[#0A0A0A]">
                            {formatCurrency(fin.contractTotal)}
                          </div>
                          <div className="font-mono text-[10px] font-semibold tabular-nums text-[#15803D]">
                            {fin.paidPercent}% опл.
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#525252]">Затраты</div>
                          <div className="mt-0.5 font-mono font-bold tabular-nums text-[#0A0A0A]">
                            {formatCurrency(fin.totalCosts)}
                          </div>
                          <div
                            className={`font-mono text-[10px] tabular-nums ${
                              fin.isOverFotLimit ? 'font-bold text-[#DC2626]' : 'text-[#525252]'
                            }`}
                          >
                            ФОТ {fin.fotPercentOfContract.toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[#525252]">Маржа</div>
                          <div
                            className={`mt-0.5 font-mono font-bold tabular-nums ${
                              fin.isNegativeMargin ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                            }`}
                          >
                            {fin.projectedMarginPercent.toFixed(1)}%
                          </div>
                          <div className="font-mono text-[10px] tabular-nums text-[#525252]">
                            {formatCurrency(fin.projectedMarginAmount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Strip */}
                    <div className="mt-5 flex items-center justify-between gap-1.5 border-t border-[#0A0A0A] pt-4">
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className="flex min-h-[38px] flex-1 items-center justify-center gap-1.5 bg-[#0A0A0A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
                      >
                        Открыть объект
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyClientLink(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white"
                        title="Скопировать ссылку клиенту (?view=client&project=...)"
                        aria-label="Скопировать ссылку клиенту"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#D4D4D4] bg-white text-[#0A0A0A] transition-colors hover:border-[#0A0A0A]"
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project)}
                        className="flex h-[38px] w-[38px] items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] transition-colors hover:border-[#DC2626] hover:text-[#DC2626]"
                        title="Удалить"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Compact Summary Table with Sticky Left Column + Quick Status + Quick Links */
          <div className="overflow-x-auto border border-[#0A0A0A] bg-white">
            <table className="w-full min-w-[1020px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-semibold text-[#0A0A0A]">
                  <th className="sticky left-0 z-10 border-r border-[#D4D4D4] bg-[#F4F4F4] px-5 py-3.5">
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
              <tbody className="divide-y divide-[#D4D4D4]">
                {filteredProjects.map((project) => {
                  const fin = pulse.projectFinances[project.id];
                  const progress = getProjectProgress(project);
                  const signal = getTrafficSignal(pulse.projectRiskLevel[project.id] || 'ok');

                  return (
                    <tr key={project.id} className="group transition-colors hover:bg-[#F4F4F4]">
                      <td className="sticky left-0 z-10 border-r border-[#D4D4D4] bg-white px-5 py-3.5 group-hover:bg-[#F4F4F4]">
                        <button
                          type="button"
                          onClick={() => onSelectProject(project.id)}
                          className="text-left"
                        >
                          <div className="text-xs font-bold text-[#0A0A0A] underline-offset-4 group-hover:underline">
                            {project.name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#525252]">
                            {project.areaSqm} м² · {project.address || 'Без адреса'}
                          </div>
                        </button>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                          {project.links.proposalUrl && (
                            <a
                              href={normalizeUrl(project.links.proposalUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#0A0A0A] underline underline-offset-2"
                            >
                              КП
                            </a>
                          )}
                          {project.links.measurementUrl && (
                            <a
                              href={normalizeUrl(project.links.measurementUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#0A0A0A] underline underline-offset-2"
                            >
                              Обмер
                            </a>
                          )}
                          {project.links.folderUrl && (
                            <a
                              href={normalizeUrl(project.links.folderUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#0A0A0A] underline underline-offset-2"
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
                          className={`h-7 cursor-pointer border border-[#D4D4D4] bg-white px-2 text-xs focus:border-[#0A0A0A] focus:outline-none ${getStatusColorClass(
                            project.status
                          )}`}
                        >
                          {PROJECT_STATUSES.map((st) => (
                            <option key={st} value={st} className="text-[#0A0A0A]">
                              {st}
                            </option>
                          ))}
                        </select>
                        <div className={`mt-1 text-[11px] font-bold ${signal.textClass}`}>
                          {signal.label}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
                          {progress}%
                        </div>
                        <div className="mt-1 ml-auto h-1.5 w-16 bg-[#E5E5E5]">
                          <div
                            className={`h-full ${progress === 100 ? 'bg-[#15803D]' : 'bg-[#0A0A0A]'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs font-bold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        {formatCurrency(fin.contractTotal)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-bold text-[#15803D]">
                          {formatCurrency(fin.paidTotal)}
                        </div>
                        <div className="text-[11px] text-[#525252]">{fin.paidPercent}%</div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-[#0A0A0A]">
                          {formatCurrency(fin.totalCosts)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            fin.isOverFotLimit ? 'font-bold text-[#DC2626]' : 'text-[#525252]'
                          }`}
                        >
                          ФОТ {fin.fotPercentOfContract.toFixed(1)}%
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <div
                          className={`font-bold ${
                            fin.isNegativeMargin ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                          }`}
                        >
                          {formatCurrency(fin.projectedMarginAmount)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            fin.projectedMarginPercent < 20 ? 'text-[#DC2626]' : 'text-[#15803D]'
                          }`}
                        >
                          {fin.projectedMarginPercent.toFixed(1)}%
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectProject(project.id)}
                            className="h-8 bg-[#0A0A0A] px-3 text-xs font-semibold text-white hover:bg-[#262626]"
                          >
                            Открыть
                          </button>
                          <button
                            type="button"
                            onClick={() => onCopyClientLink(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                            title="Скопировать ссылку клиенту"
                            aria-label="Скопировать ссылку клиенту"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProject(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                            aria-label="Редактировать"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project)}
                            className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]"
                            aria-label="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
