import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { CostRoleGroup, Project, ProjectFinanceSummary } from '../types';
import {
  CORE_COST_CATEGORIES,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  getPlannedCategoryBudgets,
} from '../utils/calculations';
import { ArchitecturalDonutChart, DonutSlice } from './ArchitecturalDonutChart';

interface ProjectAnalyticsProps {
  project: Project;
  finance: ProjectFinanceSummary;
  defaultFotLimitPercent: number;
  onUpdateProject: (updated: Project) => void;
}

const ROLE_COLOR_PALETTE = [
  '#0284C7', // saturated azure
  '#4F46E5', // soft indigo
  '#0891B2', // architectural cyan
  '#6366F1', // refined violet-indigo
  '#D97706', // warm amber-gold
  '#14B8A6', // soft turquoise
];

export const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({
  project,
  finance,
  defaultFotLimitPercent,
  onUpdateProject,
}) => {
  const [showFormulaDetails, setShowFormulaDetails] = useState(true);
  const [editingPlans, setEditingPlans] = useState(false);
  const [planDraft, setPlanDraft] = useState<Partial<Record<CostRoleGroup, string>>>({});

  const plannedBudgets = useMemo(
    () => getPlannedCategoryBudgets(project, finance.contractTotal, defaultFotLimitPercent),
    [project, finance.contractTotal, defaultFotLimitPercent]
  );

  // Donut Chart Slices: Net Studio Profit + Cost Shares per Role out of KP Contract Budget
  const budgetDonutSlices: DonutSlice[] = useMemo(() => {
    const baseTotal = Math.max(finance.contractTotal, finance.totalCosts);
    if (baseTotal <= 0) return [];

    const slices: DonutSlice[] = [];

    if (finance.projectedMarginAmount > 0) {
      slices.push({
        id: '__profit__',
        label: 'Чистая прибыль студии',
        value: finance.projectedMarginAmount,
        percent: (finance.projectedMarginAmount / baseTotal) * 100,
        color: '#0D9488',
        sublabel: 'Остаток после всех затрат',
      });
    }

    finance.costBreakdown.forEach((item, idx) => {
      slices.push({
        id: item.group,
        label: item.group,
        value: item.amount,
        percent: (item.amount / baseTotal) * 100,
        color: ROLE_COLOR_PALETTE[idx % ROLE_COLOR_PALETTE.length],
      });
    });

    return slices;
  }, [finance]);

  // Categories to compare in Plan vs Fact bar chart
  const comparisonCategories = useMemo(() => {
    const factMap = new Map(finance.costBreakdown.map((item) => [item.group, item.amount]));
    const set = new Set<CostRoleGroup>(CORE_COST_CATEGORIES);
    for (const item of finance.costBreakdown) {
      set.add(item.group);
    }

    const rows = Array.from(set).map((group) => {
      const plan = plannedBudgets[group] || 0;
      const fact = factMap.get(group) || 0;
      const diff = fact - plan;
      const usagePct = plan > 0 ? (fact / plan) * 100 : fact > 0 ? 101 : 0;
      const isOver = plan > 0 ? fact > plan : fact > 0;
      const isWarning = !isOver && plan > 0 && usagePct >= 80;
      return { group, plan, fact, diff, usagePct, isOver, isWarning };
    });

    const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.plan, r.fact)));

    const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
    const totalFact = rows.reduce((a, r) => a + r.fact, 0);

    return { rows, maxVal, totalPlan, totalFact };
  }, [finance.costBreakdown, plannedBudgets]);

  const fotUsageRatio =
    finance.fotLimitPercent > 0 ? finance.fotPercentOfContract / finance.fotLimitPercent : 0;
  const isFotWarning = !finance.isOverFotLimit && fotUsageRatio >= 0.8;

  const openPlanEditor = () => {
    const draft: Partial<Record<CostRoleGroup, string>> = {};
    for (const row of comparisonCategories.rows) {
      draft[row.group] = String(Math.round(row.plan));
    }
    setPlanDraft(draft);
    setEditingPlans(true);
  };

  const savePlanBudgets = (e: React.FormEvent) => {
    e.preventDefault();
    const nextBudgets: Partial<Record<CostRoleGroup, number>> = {
      ...(project.plannedCategoryBudgets || {}),
    };
    for (const [k, v] of Object.entries(planDraft)) {
      nextBudgets[k as CostRoleGroup] = Math.max(0, Number(v) || 0);
    }
    onUpdateProject({
      ...project,
      plannedCategoryBudgets: nextBudgets,
    });
    setEditingPlans(false);
  };

  const resetPlanBudgets = () => {
    const nextProject = { ...project };
    delete nextProject.plannedCategoryBudgets;
    onUpdateProject(nextProject);
    setEditingPlans(false);
  };

  return (
    <section aria-label="Экономика объекта и диаграммы" className="space-y-6">
      {/* Two High-Contrast Modern Bento Financial Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Chart 1: Donut Chart of Project Budget Distribution (Profit + Role Costs) */}
        <div className="bento-card p-6 xl:col-span-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#0EA5E9]/14 pb-4">
            <div>
              <div className="text-[11px] font-medium text-[#547585]">
                Распределение договора КП
              </div>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
                Бюджет объекта · Прибыль и доли ролей
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-medium text-[#547585]">Маржинальность</div>
              <div
                className={`font-mono text-base font-semibold tabular-nums ${
                  finance.projectedMarginPercent < 20
                    ? 'text-[#E11D48]'
                    : finance.projectedMarginPercent < 35
                    ? 'text-[#D97706]'
                    : 'text-[#0D9488]'
                }`}
              >
                {finance.projectedMarginPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-6">
            <ArchitecturalDonutChart
              slices={budgetDonutSlices}
              centerLabel="Бюджет КП"
              centerValue={formatCurrency(finance.contractTotal)}
              centerSublabel={
                finance.isNegativeMargin
                  ? `Убыток ${formatCurrency(Math.abs(finance.projectedMarginAmount))}`
                  : `Затраты ${
                      finance.contractTotal > 0
                        ? Math.round((finance.totalCosts / finance.contractTotal) * 100)
                        : 0
                    }%`
              }
              emptyText="Добавьте этапы оплаты КП и записи журнала для расчёта структуры бюджета"
            />
          </div>

          {/* FOT Threshold Bar with >80% Amber Risk & >100% Coral-Ruby Critical Alert */}
          <div
            className={`mt-6 rounded-2xl border p-4 ${
              finance.isOverFotLimit
                ? 'border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/85'
                : isFotWarning
                ? 'border-amber-300/60 border-l-4 border-l-[#D97706] bg-amber-50/70'
                : 'border-[#0EA5E9]/14 bg-[#F4FAFC]/85'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#547585]">
                  Факт ФОТ к договору (лимит {finance.fotLimitPercent}%)
                </span>
                {finance.isOverFotLimit ? (
                  <span className="rounded-full border border-[#FDA4AF]/75 bg-white/85 px-2.5 py-0.5 text-[10px] font-semibold text-[#E11D48] backdrop-blur-xs">
                    Перерасход ФОТ
                  </span>
                ) : isFotWarning ? (
                  <span className="rounded-full border border-amber-300/60 bg-amber-50/90 px-2.5 py-0.5 text-[10px] font-semibold text-[#B45309] backdrop-blur-xs">
                    Внимание · ФОТ (&gt;80%)
                  </span>
                ) : null}
              </div>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  finance.isOverFotLimit
                    ? 'text-[#E11D48]'
                    : isFotWarning
                    ? 'text-[#B45309]'
                    : 'text-[#0D9488]'
                }`}
              >
                {finance.fotPercentOfContract.toFixed(1)}% · {formatCurrency(finance.fotTotal)}
              </span>
            </div>
            <div className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#E1F2F6]">
              <div
                className={`h-full rounded-full ${
                  finance.isOverFotLimit
                    ? 'bg-[#E11D48]'
                    : isFotWarning
                    ? 'bg-[#D97706]'
                    : 'bg-gradient-to-r from-[#0D9488] to-[#0284C7]'
                }`}
                style={{ width: `${Math.min(100, finance.fotPercentOfContract)}%` }}
              />
              <div
                style={{ left: `${Math.min(100, finance.fotLimitPercent)}%` }}
                className="absolute -top-0.5 -bottom-0.5 w-[2.5px] rounded-full bg-[#E11D48]"
                title={`Лимит ФОТ: ${finance.fotLimitPercent}%`}
              />
            </div>
          </div>
        </div>

        {/* Chart 2: Vertical / Comparative Column Chart — Plan vs Fact Costs per Category */}
        <div className="bento-card p-6 xl:col-span-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#0EA5E9]/14 pb-4">
            <div>
              <div className="text-[11px] font-medium text-[#547585]">
                Контроль перерасхода по статьям
              </div>
              <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
                План затрат vs Факт затрат
              </h2>
            </div>

            <button
              type="button"
              onClick={() => (editingPlans ? setEditingPlans(false) : openPlanEditor())}
              className="flex h-8 items-center gap-1.5 rounded-full border border-[#0EA5E9]/18 bg-white/90 px-3.5 text-[11px] font-medium text-[#0F2936] transition-colors hover:border-[#0D9488] hover:bg-[#F0FDFA] hover:text-[#0D9488] whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3 w-3" strokeWidth={1.6} />
              {editingPlans ? 'Скрыть настройку' : 'Настроить план'}
            </button>
          </div>

          {/* Inline Planned Budget Editor */}
          {editingPlans && (
            <form
              onSubmit={savePlanBudgets}
              className="mt-4 rounded-xl border border-[#C5E6EC] bg-[#F3FBFD] p-4"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#0F2936]">
                <span>Плановый бюджет затрат по статьям (₽)</span>
                <button
                  type="button"
                  onClick={() => setEditingPlans(false)}
                  className="text-[#4C6D7C] hover:text-[#0F2936]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {comparisonCategories.rows.map((row) => (
                  <div key={row.group} className="flex items-center justify-between gap-2">
                    <label className="truncate text-xs text-[#4C6D7C]">{row.group}</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={planDraft[row.group] ?? ''}
                      onChange={(e) =>
                        setPlanDraft((prev) => ({ ...prev, [row.group]: e.target.value }))
                      }
                      className="h-8 w-28 rounded-lg border border-[#C5E6EC] bg-white px-2 text-right font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DDF0F4] pt-3">
                <button
                  type="button"
                  onClick={resetPlanBudgets}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4C6D7C] hover:text-[#0F2936]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Сбросить к авто-плану
                </button>
                <button
                  type="submit"
                  className="btn-pulse inline-flex h-8 items-center gap-1 rounded-full px-4 text-xs font-semibold"
                >
                  <Check className="h-3.5 w-3.5" />
                  Сохранить план
                </button>
              </div>
            </form>
          )}

          {/* Explicit High-Contrast Financial Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#0EA5E9]/14 bg-[#F4FAFC]/85 px-3.5 py-2.5 text-[11px] font-medium text-[#0F2936]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="gantt-plan-hatch inline-block h-2.5 w-4 rounded-sm border border-[#0284C7]" />
                План ({formatCurrency(comparisonCategories.totalPlan)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-full bg-[#4F46E5]" />
                Затраты в норме
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-full bg-[#D97706]" />
                Внимание (&gt;80%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-4 rounded-full bg-[#E11D48]" />
                Перерасход
              </span>
            </div>
            <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
              Факт: {formatCurrency(comparisonCategories.totalFact)}
            </span>
          </div>

          {/* High-Contrast Grouped Vertical Column Chart */}
          <div className="mt-5 overflow-x-auto pb-1">
            <div className="grid min-w-[440px] grid-cols-5 gap-2.5 sm:gap-3">
              {comparisonCategories.rows.slice(0, 5).map((row) => {
                const planH = Math.max(
                  row.plan > 0 ? 6 : 0,
                  Math.round((row.plan / comparisonCategories.maxVal) * 140)
                );
                const factH = Math.max(
                  row.fact > 0 ? 6 : 0,
                  Math.round((row.fact / comparisonCategories.maxVal) * 140)
                );

                return (
                  <div
                    key={row.group}
                    className={`flex flex-col items-center rounded-2xl px-1.5 py-2.5 ${
                      row.isOver
                        ? 'border border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-b from-[#FFF1F2]/92 to-[#FFF7ED]/85'
                        : row.isWarning
                        ? 'border border-amber-300/60 bg-amber-50/70'
                        : ''
                    }`}
                  >
                    {/* Delta Callout */}
                    <div className="mb-2 h-5 font-mono text-[10px] font-semibold tabular-nums">
                      {row.isOver ? (
                        <span className="text-[#E11D48]">+{formatCurrency(row.diff)}</span>
                      ) : row.isWarning ? (
                        <span className="text-[#B45309]">{Math.round(row.usagePct)}%</span>
                      ) : row.plan > 0 && row.fact > 0 ? (
                        <span className="text-[#4F46E5]">{Math.round(row.usagePct)}%</span>
                      ) : (
                        <span className="text-[#94B3C0]">—</span>
                      )}
                    </div>

                    {/* Paired Columns Plot Area */}
                    <div className="flex h-[144px] w-full items-end justify-center gap-1.5 border-b border-[#0EA5E9]/16 px-1">
                      <div
                        style={{ height: `${planH}px` }}
                        title={`План (${row.group}): ${formatCurrency(row.plan)}`}
                        className="gantt-plan-hatch w-5 rounded-t-md border border-b-0 border-[#0284C7]/80 sm:w-6"
                      />
                      <div
                        style={{ height: `${factH}px` }}
                        title={`Факт (${row.group}): ${formatCurrency(row.fact)}`}
                        className={`w-5 rounded-t-md sm:w-6 ${
                          row.isOver
                            ? 'bg-[#E11D48]'
                            : row.isWarning
                            ? 'bg-[#D97706]'
                            : 'bg-[#4F46E5]'
                        }`}
                      />
                    </div>

                    {/* Category Label & Exact Figures */}
                    <div className="mt-2.5 text-center">
                      <div className="text-[11px] font-semibold leading-tight text-[#0F2936]">
                        {row.group === 'Печать и логистика' ? 'Печать / лог.' : row.group}
                      </div>
                      <div
                        className={`mt-1 font-mono text-[10px] font-semibold tabular-nums ${
                          row.isOver
                            ? 'text-[#E11D48]'
                            : row.isWarning
                            ? 'text-[#B45309]'
                            : 'text-[#0F2936]'
                        }`}
                      >
                        {formatCurrency(row.fact)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#547585]">
                        / {formatCurrency(row.plan)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Any Extra Categories Beyond Core 5 */}
          {comparisonCategories.rows.length > 5 && (
            <div className="mt-4 space-y-2 border-t border-[#DDF0F4] pt-3 text-xs">
              {comparisonCategories.rows.slice(5).map((row) => (
                <div key={row.group} className="flex items-center justify-between">
                  <span className="text-[#4C6D7C]">{row.group}</span>
                  <span
                    className={`font-mono tabular-nums ${
                      row.isOver ? 'font-bold text-[#E11D48]' : 'text-[#0F2936]'
                    }`}
                  >
                    Факт {formatCurrency(row.fact)} / План {formatCurrency(row.plan)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transparent Monthly Salary Allocation Formula Breakdown */}
      <div className="bento-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowFormulaDetails((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#F3FBFD]"
        >
          <div>
            <div className="text-sm font-semibold text-[#0F2936]">
              Прозрачный расчёт распределения окладов
            </div>
            <div className="mt-0.5 text-xs text-[#547585]">
              Оклад штатного сотрудника × (Выработка на объекте / Вся выработка сотрудника по студии за месяц)
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-xs font-semibold tabular-nums text-[#0F2936]">
              {formatCurrency(finance.allocatedSalaryTotal)}
            </span>
            {showFormulaDetails ? (
              <ChevronUp className="h-4 w-4 text-[#0D9488]" strokeWidth={1.6} />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#0D9488]" strokeWidth={1.6} />
            )}
          </div>
        </button>

        {showFormulaDetails && (
          <div className="overflow-x-auto border-t border-[#DDF0F4]">
            {finance.salaryAllocations.length === 0 ? (
              <div className="px-6 py-6 text-xs text-[#4C6D7C]">
                По этому объекту пока нет записей выработки окладных сотрудников. Внесите отработанные м² или часы в журнале ниже.
              </div>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#C5E6EC] bg-[#EEF8FA] text-[11px] font-bold text-[#0F2936]">
                    <th className="px-6 py-2.5">Месяц</th>
                    <th className="px-4 py-2.5">Должность</th>
                    <th className="px-4 py-2.5 text-right">Оклад / мес</th>
                    <th className="px-4 py-2.5 text-right">Выработка (объект / студия)</th>
                    <th className="px-4 py-2.5 text-right">Доля</th>
                    <th className="px-6 py-2.5 text-right">Отнесено на объект</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4F3F7] text-xs">
                  {finance.salaryAllocations.map((row) => {
                    const unit = row.basis === 'area' ? 'м²' : 'ч';
                    return (
                      <tr key={`${row.month}_${row.memberId}`} className="hover:bg-[#F3FBFD]">
                        <td className="px-6 py-3 font-medium text-[#0F2936]">
                          {formatMonthLabel(row.month)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0F2936]">
                          <span className="mr-2 rounded-md bg-[#E6F5F8] px-1.5 py-0.5 font-mono text-[10px] text-[#0F2936]">
                            {row.memberCode}
                          </span>
                          {row.memberRole}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#4C6D7C]">
                          {formatCurrency(row.monthlySalary)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0F2936]">
                          {formatNumber(row.projectVolume)} / {formatNumber(row.totalMonthVolume)}{' '}
                          {unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#4C6D7C]">
                          {row.sharePercent.toFixed(1)}%
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-bold tabular-nums text-[#0D9488]">
                          {formatCurrency(row.allocatedAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
