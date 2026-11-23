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

const ROLE_SHADE_PALETTE = [
  '#0A0A0A',
  '#3B3B3B',
  '#6B6B6B',
  '#9A9A9A',
  '#C4C4C4',
  '#DEDEDE',
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
        color: '#15803D',
        sublabel: 'Остаток после всех затрат',
      });
    }

    finance.costBreakdown.forEach((item, idx) => {
      slices.push({
        id: item.group,
        label: item.group,
        value: item.amount,
        percent: (item.amount / baseTotal) * 100,
        color: ROLE_SHADE_PALETTE[idx % ROLE_SHADE_PALETTE.length],
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
      const isOver = plan > 0 ? fact > plan : fact > 0;
      return { group, plan, fact, diff, isOver };
    });

    const maxVal = Math.max(
      1,
      ...rows.map((r) => Math.max(r.plan, r.fact))
    );

    const totalPlan = rows.reduce((a, r) => a + r.plan, 0);
    const totalFact = rows.reduce((a, r) => a + r.fact, 0);

    return { rows, maxVal, totalPlan, totalFact };
  }, [finance.costBreakdown, plannedBudgets]);

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
      {/* Two Premium Architectural Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Chart 1: Donut Chart of Project Budget Distribution (Profit + Role Costs) */}
        <div className="border border-[#0A0A0A] bg-white p-6 xl:col-span-6">
          <div className="flex items-start justify-between gap-4 border-b border-[#0A0A0A] pb-4">
            <div>
              <div className="text-[11px] text-[#525252]">Распределение договора КП</div>
              <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#0A0A0A]">
                Бюджет объекта · Прибыль и доли ролей
              </h2>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-[#525252]">Маржинальность</div>
              <div
                className={`font-mono text-base font-bold tabular-nums ${
                  finance.projectedMarginPercent < 20
                    ? 'text-[#DC2626]'
                    : finance.projectedMarginPercent < 35
                    ? 'text-[#D97706]'
                    : 'text-[#15803D]'
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
                  : `Затраты ${finance.contractTotal > 0 ? Math.round((finance.totalCosts / finance.contractTotal) * 100) : 0}%`
              }
              emptyText="Добавьте этапы оплаты КП и записи журнала для расчёта структуры бюджета"
            />
          </div>

          {/* FOT Threshold Bar */}
          <div className="mt-6 border-t border-[#D4D4D4] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#525252]">
                Факт ФОТ к договору (лимит {finance.fotLimitPercent}%)
              </span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  finance.isOverFotLimit ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                }`}
              >
                {finance.fotPercentOfContract.toFixed(1)}% · {formatCurrency(finance.fotTotal)}
              </span>
            </div>
            <div className="relative mt-2 h-2 w-full bg-[#F4F4F4]">
              <div
                className={`h-full ${finance.isOverFotLimit ? 'bg-[#DC2626]' : 'bg-[#0A0A0A]'}`}
                style={{ width: `${Math.min(100, finance.fotPercentOfContract)}%` }}
              />
              <div
                style={{ left: `${Math.min(100, finance.fotLimitPercent)}%` }}
                className="absolute -top-1 -bottom-1 w-[2px] bg-[#DC2626]"
                title={`Лимит ФОТ: ${finance.fotLimitPercent}%`}
              />
            </div>
          </div>
        </div>

        {/* Chart 2: Vertical / Comparative Column Chart — Plan vs Fact Costs per Category */}
        <div className="border border-[#0A0A0A] bg-white p-6 xl:col-span-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#0A0A0A] pb-4">
            <div>
              <div className="text-[11px] text-[#525252]">Контроль перерасхода по статьям</div>
              <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#0A0A0A]">
                План затрат vs Факт затрат
              </h2>
            </div>

            <button
              type="button"
              onClick={() => (editingPlans ? setEditingPlans(false) : openPlanEditor())}
              className="flex h-8 items-center gap-1.5 border border-[#0A0A0A] bg-white px-3 text-[11px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="h-3 w-3" />
              {editingPlans ? 'Скрыть настройку' : 'Настроить план'}
            </button>
          </div>

          {/* Inline Planned Budget Editor */}
          {editingPlans && (
            <form
              onSubmit={savePlanBudgets}
              className="mt-4 border border-[#0F0F0F] bg-[#F7F7F6] p-4"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-[#0F0F0F]">
                <span>Плановый бюджет затрат по статьям (₽)</span>
                <button
                  type="button"
                  onClick={() => setEditingPlans(false)}
                  className="text-[#525252] hover:text-[#0F0F0F]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {comparisonCategories.rows.map((row) => (
                  <div key={row.group} className="flex items-center justify-between gap-2">
                    <label className="truncate text-xs text-[#525252]">{row.group}</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={planDraft[row.group] ?? ''}
                      onChange={(e) =>
                        setPlanDraft((prev) => ({ ...prev, [row.group]: e.target.value }))
                      }
                      className="h-8 w-28 border border-[#D4D4D4] bg-white px-2 text-right font-mono text-xs tabular-nums text-[#0F0F0F]"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E5E5] pt-3">
                <button
                  type="button"
                  onClick={resetPlanBudgets}
                  className="inline-flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0F0F0F]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Сбросить к авто-плану
                </button>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1 bg-[#0F0F0F] px-3.5 text-xs font-medium text-white hover:bg-[#262626]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Сохранить план
                </button>
              </div>
            </form>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#525252]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="gantt-plan-hatch inline-block h-2.5 w-3.5 border border-[#0A0A0A]" />
                План ({formatCurrency(comparisonCategories.totalPlan)})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3.5 bg-[#0A0A0A]" />
                Факт в норме
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-3.5 bg-[#DC2626]" />
                Перерасход
              </span>
            </div>
            <span className="font-mono font-bold tabular-nums text-[#0A0A0A]">
              Факт: {formatCurrency(comparisonCategories.totalFact)}
            </span>
          </div>

          {/* Architectural Grouped Vertical Column Chart */}
          <div className="mt-6 overflow-x-auto pb-1">
            <div className="grid min-w-[440px] grid-cols-5 gap-3 sm:gap-4">
              {comparisonCategories.rows.slice(0, 5).map((row) => {
                const planH = Math.max(
                  row.plan > 0 ? 4 : 0,
                  Math.round((row.plan / comparisonCategories.maxVal) * 140)
                );
                const factH = Math.max(
                  row.fact > 0 ? 4 : 0,
                  Math.round((row.fact / comparisonCategories.maxVal) * 140)
                );

                return (
                  <div key={row.group} className="flex flex-col items-center">
                    {/* Delta Callout */}
                    <div className="mb-2 h-4 font-mono text-[10px] font-bold tabular-nums">
                      {row.isOver ? (
                        <span className="text-[#DC2626]">+{formatCurrency(row.diff)}</span>
                      ) : row.plan > 0 && row.fact > 0 ? (
                        <span className="text-[#15803D]">
                          {Math.round((row.fact / row.plan) * 100)}%
                        </span>
                      ) : (
                        <span className="text-[#A3A3A3]">—</span>
                      )}
                    </div>

                    {/* Paired Columns Plot Area */}
                    <div className="flex h-[144px] w-full items-end justify-center gap-1.5 border-b border-[#0A0A0A] px-1">
                      <div
                        style={{ height: `${planH}px` }}
                        title={`План (${row.group}): ${formatCurrency(row.plan)}`}
                        className="gantt-plan-hatch w-5 border border-b-0 border-[#0A0A0A] sm:w-6"
                      />
                      <div
                        style={{ height: `${factH}px` }}
                        title={`Факт (${row.group}): ${formatCurrency(row.fact)}`}
                        className={`w-5 sm:w-6 ${row.isOver ? 'bg-[#DC2626]' : 'bg-[#0A0A0A]'}`}
                      />
                    </div>

                    {/* Category Label & Exact Figures */}
                    <div className="mt-2.5 text-center">
                      <div className="text-[11px] font-semibold leading-tight text-[#0A0A0A]">
                        {row.group === 'Печать и логистика' ? 'Печать / лог.' : row.group}
                      </div>
                      <div
                        className={`mt-1 font-mono text-[10px] font-bold tabular-nums ${
                          row.isOver ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                        }`}
                      >
                        {formatCurrency(row.fact)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#525252]">
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
            <div className="mt-4 space-y-2 border-t border-[#D4D4D4] pt-3 text-xs">
              {comparisonCategories.rows.slice(5).map((row) => (
                <div key={row.group} className="flex items-center justify-between">
                  <span className="text-[#525252]">{row.group}</span>
                  <span className="font-mono tabular-nums text-[#0A0A0A]">
                    Факт {formatCurrency(row.fact)} / План {formatCurrency(row.plan)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transparent Monthly Salary Allocation Formula Breakdown */}
      <div className="border border-[#0A0A0A] bg-white">
        <button
          type="button"
          onClick={() => setShowFormulaDetails((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#F4F4F4]"
        >
          <div>
            <div className="text-sm font-bold text-[#0A0A0A]">
              Прозрачный расчёт распределения окладов
            </div>
            <div className="mt-0.5 text-xs text-[#525252]">
              Оклад штатного сотрудника × (Выработка на объекте / Вся выработка сотрудника по студии за месяц)
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
              {formatCurrency(finance.allocatedSalaryTotal)}
            </span>
            {showFormulaDetails ? (
              <ChevronUp className="h-4 w-4 text-[#0A0A0A]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#0A0A0A]" />
            )}
          </div>
        </button>

        {showFormulaDetails && (
          <div className="overflow-x-auto border-t border-[#0A0A0A]">
            {finance.salaryAllocations.length === 0 ? (
              <div className="px-6 py-6 text-xs text-[#525252]">
                По этому объекту пока нет записей выработки окладных сотрудников. Внесите отработанные м² или часы в журнале ниже.
              </div>
            ) : (
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-semibold text-[#0A0A0A]">
                    <th className="px-6 py-2.5">Месяц</th>
                    <th className="px-4 py-2.5">Должность</th>
                    <th className="px-4 py-2.5 text-right">Оклад / мес</th>
                    <th className="px-4 py-2.5 text-right">Выработка (объект / студия)</th>
                    <th className="px-4 py-2.5 text-right">Доля</th>
                    <th className="px-6 py-2.5 text-right">Отнесено на объект</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4D4D4] text-xs">
                  {finance.salaryAllocations.map((row) => {
                    const unit = row.basis === 'area' ? 'м²' : 'ч';
                    return (
                      <tr key={`${row.month}_${row.memberId}`} className="hover:bg-[#F4F4F4]">
                        <td className="px-6 py-3 text-[#0A0A0A]">
                          {formatMonthLabel(row.month)}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#0A0A0A]">
                          <span className="mr-2 font-mono text-[11px] text-[#525252]">
                            {row.memberCode}
                          </span>
                          {row.memberRole}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#525252]">
                          {formatCurrency(row.monthlySalary)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0A0A0A]">
                          {formatNumber(row.projectVolume)} / {formatNumber(row.totalMonthVolume)}{' '}
                          {unit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-[#525252]">
                          {row.sharePercent.toFixed(1)}%
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-bold tabular-nums text-[#0A0A0A]">
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
