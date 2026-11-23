import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { createId } from '../data/demoData';
import {
  CostLinePayMode,
  Project,
  ProjectCostLine,
  ProjectCostRole,
  ProjectFinanceSummary,
  SalaryAllocationUnit,
  TeamMember,
} from '../types';
import {
  formatCurrency,
  formatNumber,
  getCostLineEffectiveBudget,
} from '../utils/calculations';

interface ProjectCostLinesSectionProps {
  project: Project;
  team: TeamMember[];
  finance: ProjectFinanceSummary;
  onUpdateProject: (updated: Project) => void;
}

const COST_ROLES: ProjectCostRole[] = [
  'Дизайнер',
  'Визуализатор',
  'Чертёжник',
  'Замерщик',
  'Комплектатор',
  'Бензин и печать альбомов',
];

export const ProjectCostLinesSection: React.FC<ProjectCostLinesSectionProps> = ({
  project,
  team,
  finance,
  onUpdateProject,
}) => {
  const costLines = useMemo(
    () => (Array.isArray(project.costLines) ? project.costLines : []),
    [project.costLines]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [role, setRole] = useState<ProjectCostRole>('Дизайнер');
  const [assigneeName, setAssigneeName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [payMode, setPayMode] = useState<CostLinePayMode>('piecework');
  const [budgetAmount, setBudgetAmount] = useState('40000');
  const [paidAmount, setPaidAmount] = useState('0');
  const [monthlySalary, setMonthlySalary] = useState('95000');
  const [salaryUnit, setSalaryUnit] = useState<SalaryAllocationUnit>('days');
  const [workedUnits, setWorkedUnits] = useState('5');
  const [monthlyCapacityUnits, setMonthlyCapacityUnits] = useState('22');
  const [note, setNote] = useState('');

  const salariedTeam = useMemo(
    () => team.filter((m) => m.paymentType === 'salary' && m.monthlySalary > 0),
    [team]
  );

  // Detect совмещение ролей (specialists assigned to 2+ roles on this project)
  const assigneeCounts = useMemo(() => {
    const map = new Map<string, { displayName: string; count: number; totalBudget: number }>();
    for (const line of costLines) {
      if (line.payMode === 'overhead' || line.role === 'Бензин и печать альбомов') continue;
      const key = line.assigneeName.trim().toLowerCase();
      if (!key) continue;
      const eff = getCostLineEffectiveBudget(line);
      const curr = map.get(key);
      if (curr) {
        curr.count += 1;
        curr.totalBudget += eff;
      } else {
        map.set(key, {
          displayName: line.assigneeName.trim(),
          count: 1,
          totalBudget: eff,
        });
      }
    }
    return map;
  }, [costLines]);

  const multiRoleSpecialists = useMemo(
    () => Array.from(assigneeCounts.values()).filter((item) => item.count > 1),
    [assigneeCounts]
  );

  const existingAssignees = useMemo(() => {
    const set = new Set<string>();
    costLines.forEach((l) => {
      if (l.assigneeName.trim() && l.payMode !== 'overhead') set.add(l.assigneeName.trim());
    });
    return Array.from(set);
  }, [costLines]);

  // Totals for cost lines table
  const linesSummary = useMemo(() => {
    let totalBudget = 0;
    let totalPaid = 0;
    for (const line of costLines) {
      const eff = getCostLineEffectiveBudget(line);
      const paid = Math.min(eff, Math.max(0, Number(line.paidAmount) || 0));
      totalBudget += eff;
      totalPaid += paid;
    }
    const totalRemaining = Math.max(0, totalBudget - totalPaid);
    const paidPct = totalBudget > 0 ? Math.round((totalPaid / totalBudget) * 100) : 0;
    const remPct = totalBudget > 0 ? Math.max(0, 100 - paidPct) : 0;
    return { totalBudget, totalPaid, totalRemaining, paidPct, remPct };
  }, [costLines]);

  // Traffic Light for Project Margin & FOT (Green if FOT <= 45% and positive margin; Red if negative / cash gap)
  const trafficLight = useMemo(() => {
    const limit = finance.fotLimitPercent || 45;
    if (finance.isNegativeMargin) {
      return {
        tone: 'red' as const,
        dotClass: 'bg-[#DC2626]',
        borderClass: 'border-[#DC2626]',
        textClass: 'text-[#DC2626]',
        label: 'Убыток по объекту',
        detail: `Затраты превысили договор КП на ${formatCurrency(Math.abs(finance.projectedMarginAmount))} (скидка или перерасход команды).`,
      };
    }
    if (finance.isCashNegative) {
      return {
        tone: 'red' as const,
        dotClass: 'bg-[#DC2626]',
        borderClass: 'border-[#DC2626]',
        textClass: 'text-[#DC2626]',
        label: 'Кассовый разрыв',
        detail: `Затраты (${formatCurrency(finance.totalCosts)}) выше оплаченных клиентом этапов (${formatCurrency(finance.paidTotal)}).`,
      };
    }
    if (finance.fotPercentOfContract > limit) {
      return {
        tone: 'amber' as const,
        dotClass: 'bg-[#D97706]',
        borderClass: 'border-[#D97706]',
        textClass: 'text-[#D97706]',
        label: `ФОТ выше ${limit}% (${finance.fotPercentOfContract.toFixed(1)}%)`,
        detail: `Маржа положительная (${formatCurrency(finance.projectedMarginAmount)}), но доля команды превышает целевой порог ${limit}%.`,
      };
    }
    return {
      tone: 'green' as const,
      dotClass: 'bg-[#15803D]',
      borderClass: 'border-[#15803D]',
      textClass: 'text-[#15803D]',
      label: `В норме · ФОТ ≤ ${limit}%`,
      detail: `ФОТ составляет ${finance.fotPercentOfContract.toFixed(1)}% от договора, прогнозная маржа ${finance.projectedMarginPercent.toFixed(1)}%.`,
    };
  }, [finance]);

  const previewSalaryBudget = useMemo(() => {
    const s = Math.max(0, Number(monthlySalary) || 0);
    const w = Math.max(0, Number(workedUnits) || 0);
    const c = Math.max(1, Number(monthlyCapacityUnits) || 22);
    return Math.round(s * (w / c));
  }, [monthlySalary, workedUnits, monthlyCapacityUnits]);

  const openNewForm = (presetRole?: ProjectCostRole) => {
    const r = presetRole || 'Дизайнер';
    setEditingId(null);
    setRole(r);
    setAssigneeName(r === 'Бензин и печать альбомов' ? 'Накладные объекта' : '');
    setMemberId('');
    setPayMode(r === 'Бензин и печать альбомов' ? 'overhead' : 'piecework');
    setBudgetAmount(r === 'Бензин и печать альбомов' ? '10000' : '40000');
    setPaidAmount('0');
    setMonthlySalary(String(salariedTeam[0]?.monthlySalary || 95000));
    setSalaryUnit('days');
    setWorkedUnits('5');
    setMonthlyCapacityUnits('22');
    setNote('');
    setShowForm(true);
  };

  const startEdit = (line: ProjectCostLine) => {
    setEditingId(line.id);
    setRole(line.role);
    setAssigneeName(line.assigneeName);
    setMemberId(line.memberId || '');
    setPayMode(line.payMode);
    setBudgetAmount(String(line.budgetAmount || 0));
    setPaidAmount(String(line.paidAmount || 0));
    setMonthlySalary(String(line.monthlySalary || 95000));
    setSalaryUnit(line.salaryUnit || 'days');
    setWorkedUnits(String(line.workedUnits || 0));
    setMonthlyCapacityUnits(
      String(line.monthlyCapacityUnits || (line.salaryUnit === 'sqm' ? 150 : 22))
    );
    setNote(line.note || '');
    setShowForm(true);
  };

  const handleRoleChange = (nextRole: ProjectCostRole) => {
    setRole(nextRole);
    if (nextRole === 'Бензин и печать альбомов') {
      setPayMode('overhead');
      if (!assigneeName.trim()) setAssigneeName('Накладные объекта');
    } else if (payMode === 'overhead') {
      setPayMode('piecework');
      if (assigneeName === 'Накладные объекта') setAssigneeName('');
    }
  };

  const handleSelectSalariedMember = (id: string) => {
    setMemberId(id);
    const m = salariedTeam.find((item) => item.id === id);
    if (!m) return;
    setMonthlySalary(String(m.monthlySalary));
    if (!assigneeName.trim()) {
      setAssigneeName(m.roleTitle);
    }
    if (m.allocationBasis === 'area') {
      setSalaryUnit('sqm');
      setWorkedUnits(String(project.areaSqm || 50));
      setMonthlyCapacityUnits('200');
    } else {
      setSalaryUnit('days');
      setWorkedUnits('5');
      setMonthlyCapacityUnits('22');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isSalary = payMode === 'salary';
    const effBudget = isSalary
      ? previewSalaryBudget
      : Math.max(0, Number(budgetAmount) || 0);
    const cleanPaid = Math.min(effBudget, Math.max(0, Number(paidAmount) || 0));

    const nextLine: ProjectCostLine = {
      id: editingId || createId('cl'),
      role,
      assigneeName:
        assigneeName.trim() ||
        (role === 'Бензин и печать альбомов' ? 'Накладные объекта' : role),
      memberId: memberId || undefined,
      payMode,
      budgetAmount: effBudget,
      paidAmount: cleanPaid,
      ...(isSalary
        ? {
            monthlySalary: Math.max(0, Number(monthlySalary) || 0),
            salaryUnit,
            workedUnits: Math.max(0, Number(workedUnits) || 0),
            monthlyCapacityUnits: Math.max(1, Number(monthlyCapacityUnits) || 22),
          }
        : {}),
      note: note.trim() || undefined,
    };

    const nextLines = editingId
      ? costLines.map((l) => (l.id === editingId ? nextLine : l))
      : [...costLines, nextLine];

    onUpdateProject({
      ...project,
      costLines: nextLines,
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDeleteLine = (id: string) => {
    onUpdateProject({
      ...project,
      costLines: costLines.filter((l) => l.id !== id),
    });
  };

  const handleMarkFullyPaid = (line: ProjectCostLine) => {
    const eff = getCostLineEffectiveBudget(line);
    const nextPaid = line.paidAmount >= eff ? 0 : eff;
    onUpdateProject({
      ...project,
      costLines: costLines.map((l) =>
        l.id === line.id ? { ...l, paidAmount: nextPaid } : l
      ),
    });
  };

  return (
    <section
      aria-label="Команда и затраты объекта"
      className="border border-[#0A0A0A] bg-white"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0A0A0A] px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[11px] text-[#525252]">
            Только для Руководителя и Помощника · Совмещение ролей, сдельщики, окладники и накладные
          </div>
          <h2 className="mt-0.5 text-base font-bold tracking-tight text-[#0A0A0A]">
            Команда и затраты объекта
          </h2>
        </div>
        <button
          type="button"
          onClick={() => openNewForm()}
          className="flex h-9 items-center gap-1.5 self-start bg-[#0A0A0A] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#262626] sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить строку затрат
        </button>
      </div>

      {/* Margin & FOT Traffic Light Strip */}
      <div className="grid grid-cols-1 gap-px border-b border-[#0A0A0A] bg-[#D4D4D4] lg:grid-cols-12">
        <div className="flex items-start gap-3 bg-white px-5 py-4 lg:col-span-5">
          <span
            className={`mt-1 h-3 w-3 shrink-0 ${trafficLight.dotClass}`}
            aria-hidden="true"
          />
          <div>
            <div className={`text-xs font-bold ${trafficLight.textClass}`}>
              {trafficLight.label}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#525252]">
              {trafficLight.detail}
            </p>
          </div>
        </div>

        <div className="bg-[#F4F4F4] px-4 py-3.5 lg:col-span-2">
          <div className="text-[10px] text-[#525252]">Бюджет затрат</div>
          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#0A0A0A]">
            {formatCurrency(linesSummary.totalBudget)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#525252]">
            ФОТ {finance.fotPercentOfContract.toFixed(1)}% от КП
          </div>
        </div>

        <div className="bg-[#F4F4F4] px-4 py-3.5 lg:col-span-2">
          <div className="text-[10px] text-[#525252]">Выплачено</div>
          <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#15803D]">
            {formatCurrency(linesSummary.totalPaid)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#525252]">
            {linesSummary.paidPct}% от бюджета
          </div>
        </div>

        <div className="bg-[#0A0A0A] px-4 py-3.5 text-white lg:col-span-3">
          <div className="flex items-center justify-between text-[10px] text-[#A3A3A3]">
            <span>Остаток к выплате</span>
            <span>Маржа объекта</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-sm font-bold tabular-nums">
            <span className="text-white">{formatCurrency(linesSummary.totalRemaining)}</span>
            <span
              className={
                finance.isNegativeMargin
                  ? 'text-[#F87171]'
                  : finance.fotPercentOfContract > (finance.fotLimitPercent || 45)
                  ? 'text-[#FBBF24]'
                  : 'text-[#4ADE80]'
              }
            >
              {finance.projectedMarginPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-[#A3A3A3]">
            <span>{linesSummary.remPct}% осталось</span>
            <span>{formatCurrency(finance.projectedMarginAmount)}</span>
          </div>
        </div>
      </div>

      {/* Add / Edit Cost Line Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border-b border-[#0A0A0A] bg-[#F4F4F4] p-5"
        >
          <div className="flex items-center justify-between border-b border-[#D4D4D4] pb-3">
            <div className="text-xs font-bold text-[#0A0A0A]">
              {editingId ? 'Редактировать строку затрат' : 'Новая строка затрат по роли / совмещению'}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-[#525252] hover:text-[#0A0A0A]"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                Роль / статья затрат *
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as ProjectCostRole)}
                className="h-9 w-full border border-[#0A0A0A] bg-white px-2.5 text-xs font-medium text-[#0A0A0A] focus:outline-none"
              >
                {COST_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                Исполнитель (можно совмещать роли) *
              </label>
              <input
                type="text"
                required
                list="project-assignee-suggestions"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Например: Алина, София, Вика..."
                className="h-9 w-full border border-[#0A0A0A] bg-white px-3 text-xs text-[#0A0A0A] focus:outline-none"
              />
              <datalist id="project-assignee-suggestions">
                {existingAssignees.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                Формат расчёта
              </label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as CostLinePayMode)}
                className="h-9 w-full border border-[#0A0A0A] bg-white px-2.5 text-xs text-[#0A0A0A] focus:outline-none"
              >
                <option value="piecework">Сдельная / фикс за роль</option>
                <option value="salary">Окладник (доля по м² или дням)</option>
                <option value="overhead">Накладные (бензин, печать)</option>
              </select>
            </div>

            {payMode === 'salary' ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                  Окладник из справочника (опц.)
                </label>
                <select
                  value={memberId}
                  onChange={(e) => handleSelectSalariedMember(e.target.value)}
                  className="h-9 w-full border border-[#D4D4D4] bg-white px-2.5 text-xs text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
                >
                  <option value="">Задать оклад вручную</option>
                  {salariedTeam.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.roleTitle} ({formatCurrency(m.monthlySalary)}/мес)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                  Бюджет (Всего), ₽ *
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="h-9 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0A0A0A] focus:outline-none"
                />
              </div>
            )}

            {payMode === 'salary' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                    Оклад в месяц, ₽ *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="h-9 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                    База списания оклада
                  </label>
                  <select
                    value={salaryUnit}
                    onChange={(e) => {
                      const next = e.target.value as SalaryAllocationUnit;
                      setSalaryUnit(next);
                      setMonthlyCapacityUnits(next === 'days' ? '22' : '200');
                      if (next === 'sqm' && project.areaSqm > 0) {
                        setWorkedUnits(String(project.areaSqm));
                      }
                    }}
                    className="h-9 w-full border border-[#0A0A0A] bg-white px-2.5 text-xs text-[#0A0A0A]"
                  >
                    <option value="days">По рабочим дням</option>
                    <option value="sqm">По отработанным м²</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                    Отработано на объекте ({salaryUnit === 'days' ? 'дней' : 'м²'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={workedUnits}
                    onChange={(e) => setWorkedUnits(e.target.value)}
                    className="h-9 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                    Месячная норма ({salaryUnit === 'days' ? 'дн./мес' : 'м²/мес'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={monthlyCapacityUnits}
                    onChange={(e) => setMonthlyCapacityUnits(e.target.value)}
                    className="h-9 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A]"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                Выплачено на сегодня, ₽
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="h-9 w-full border border-[#D4D4D4] bg-white px-3 font-mono text-xs tabular-nums text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
              />
            </div>

            <div className={payMode === 'salary' ? 'sm:col-span-2 lg:col-span-3' : 'sm:col-span-2 lg:col-span-3'}>
              <label className="mb-1 block text-[11px] font-medium text-[#525252]">
                Комментарий / объём работ
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: 3D-визуализация + правки, или 250 ₽/м² за РД"
                className="h-9 w-full border border-[#D4D4D4] bg-white px-3 text-xs text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none"
              />
            </div>
          </div>

          {payMode === 'salary' && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-[#0A0A0A] bg-white px-3.5 py-2.5 text-xs">
              <span className="text-[#525252]">
                Авто-списание доли оклада в себестоимость объекта:{' '}
                <span className="font-mono text-[#0A0A0A]">
                  {formatCurrency(Number(monthlySalary) || 0)} × ({workedUnits || 0} /{' '}
                  {monthlyCapacityUnits || 22}{' '}
                  {salaryUnit === 'days' ? 'дн.' : 'м²'})
                </span>
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#0A0A0A]">
                = {formatCurrency(previewSalaryBudget)}
              </span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#D4D4D4] pt-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="h-9 border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-white/60"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-5 text-xs font-semibold text-white hover:bg-[#262626]"
            >
              <Check className="h-3.5 w-3.5" />
              {editingId ? 'Сохранить строку' : 'Добавить в бюджет'}
            </button>
          </div>
        </form>
      )}

      {/* Cost Lines Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-semibold text-[#0A0A0A]">
              <th className="px-5 py-3">Роль и исполнитель</th>
              <th className="px-4 py-3">Формат</th>
              <th className="px-4 py-3 text-right">Бюджет (Всего)</th>
              <th className="px-4 py-3 text-right">Выплачено</th>
              <th className="px-4 py-3 text-right">Остаток к выплате</th>
              <th className="px-5 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4D4D4] text-xs">
            {costLines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[#525252]">
                  Строки затрат команды и накладных ещё не добавлены. Нажмите «+ Добавить строку затрат».
                </td>
              </tr>
            ) : (
              costLines.map((line) => {
                const effBudget = getCostLineEffectiveBudget(line);
                const paid = Math.min(effBudget, Math.max(0, Number(line.paidAmount) || 0));
                const remaining = Math.max(0, effBudget - paid);
                const paidPct = effBudget > 0 ? Math.round((paid / effBudget) * 100) : 100;
                const remPct = effBudget > 0 ? Math.max(0, 100 - paidPct) : 0;
                const assigneeKey = line.assigneeName.trim().toLowerCase();
                const multiInfo =
                  line.payMode !== 'overhead' ? assigneeCounts.get(assigneeKey) : undefined;
                const isMultiRole = Boolean(multiInfo && multiInfo.count > 1);
                const isSettled = remaining === 0;

                return (
                  <tr key={line.id} className="hover:bg-[#F4F4F4]">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#0A0A0A]">{line.role}</span>
                        <span className="text-[#D4D4D4]">·</span>
                        <span className="font-medium text-[#0A0A0A]">{line.assigneeName}</span>
                        {isMultiRole && (
                          <span
                            className="border border-[#0A0A0A] bg-[#F4F4F4] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#0A0A0A]"
                            title={`Сотрудник совмещает ${multiInfo!.count} роли на этом объекте (итого ${formatCurrency(multiInfo!.totalBudget)})`}
                          >
                            совмещение ×{multiInfo!.count}
                          </span>
                        )}
                      </div>
                      {line.note && (
                        <div className="mt-0.5 text-[11px] text-[#525252]">{line.note}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-[11px] text-[#525252] whitespace-nowrap">
                      {line.payMode === 'salary' ? (
                        <div>
                          <div className="font-semibold text-[#0A0A0A]">Окладник</div>
                          <div className="font-mono text-[10px] tabular-nums">
                            {formatNumber(line.workedUnits || 0)} /{' '}
                            {formatNumber(line.monthlyCapacityUnits || 22)}{' '}
                            {line.salaryUnit === 'sqm' ? 'м²' : 'дн.'} от{' '}
                            {formatCurrency(line.monthlySalary || 0)}
                          </div>
                        </div>
                      ) : line.payMode === 'overhead' ? (
                        <span className="font-medium text-[#525252]">Накладные</span>
                      ) : (
                        <span className="font-medium text-[#0A0A0A]">Сдельная</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                      {formatCurrency(effBudget)}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-mono font-semibold tabular-nums text-[#15803D]">
                        {formatCurrency(paid)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#525252]">
                        {paidPct}%
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div
                        className={`font-mono font-bold tabular-nums ${
                          remaining > 0 ? 'text-[#0A0A0A]' : 'text-[#15803D]'
                        }`}
                      >
                        {formatCurrency(remaining)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#525252]">
                        {remPct}%
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {effBudget > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMarkFullyPaid(line)}
                            className={`flex h-7 items-center gap-1 border px-2 text-[10px] font-semibold transition-colors whitespace-nowrap ${
                              isSettled
                                ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D] hover:bg-white'
                                : 'border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white'
                            }`}
                            title={
                              isSettled
                                ? 'Снять отметку полной выплаты'
                                : 'Отметить как выплачено 100%'
                            }
                          >
                            <CheckCheck className="h-3 w-3" />
                            {isSettled ? 'Оплачено' : 'Выплатить'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(line)}
                          className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                          aria-label="Редактировать строку"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                          className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]"
                          aria-label="Удалить строку"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {costLines.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#0A0A0A] bg-[#F4F4F4] text-xs font-bold text-[#0A0A0A]">
                <td colSpan={2} className="px-5 py-3.5">
                  Итого по команде и накладным ({costLines.length} поз.)
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                  {formatCurrency(linesSummary.totalBudget)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#15803D]">
                  {formatCurrency(linesSummary.totalPaid)} ({linesSummary.paidPct}%)
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                  {formatCurrency(linesSummary.totalRemaining)} ({linesSummary.remPct}%)
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Multi-role Consolidation Summary Strip */}
      {multiRoleSpecialists.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[#D4D4D4] bg-white px-5 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0A0A0A]">
            <Users className="h-3.5 w-3.5" />
            Сводка по совмещению ролей:
          </span>
          {multiRoleSpecialists.map((spec) => (
            <span
              key={spec.displayName}
              className="border border-[#0A0A0A] bg-[#F4F4F4] px-2.5 py-1 font-mono text-[11px] tabular-nums text-[#0A0A0A]"
            >
              {spec.displayName} ({spec.count} роли) —{' '}
              <strong>{formatCurrency(spec.totalBudget)}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
