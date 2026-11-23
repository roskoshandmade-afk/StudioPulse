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

  // Traffic Light for Project Margin & FOT (Coral for critical, Amber for >80% warning or over limit, Teal for normal)
  const trafficLight = useMemo(() => {
    const limit = finance.fotLimitPercent || 45;
    const fotUtilizationPct = limit > 0 ? (finance.fotPercentOfContract / limit) * 100 : 0;

    if (finance.isNegativeMargin) {
      return {
        tone: 'red' as const,
        dotClass: 'bg-[#E11D48]',
        cardClass:
          'border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/85',
        textClass: 'text-[#E11D48]',
        badgeClass: 'border border-[#FDA4AF]/75 bg-white/85 text-[#E11D48] backdrop-blur-xs',
        badge: 'Критично',
        label: 'Убыток по объекту',
        detail: `Затраты превысили договор КП на ${formatCurrency(Math.abs(finance.projectedMarginAmount))} (скидка или перерасход команды).`,
      };
    }
    if (finance.isCashNegative) {
      return {
        tone: 'red' as const,
        dotClass: 'bg-[#E11D48]',
        cardClass:
          'border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/85',
        textClass: 'text-[#E11D48]',
        badgeClass: 'border border-[#FDA4AF]/75 bg-white/85 text-[#E11D48] backdrop-blur-xs',
        badge: 'Критично',
        label: 'Кассовый разрыв',
        detail: `Затраты (${formatCurrency(finance.totalCosts)}) выше оплаченных клиентом этапов (${formatCurrency(finance.paidTotal)}).`,
      };
    }
    if (finance.fotPercentOfContract > limit) {
      return {
        tone: 'red' as const,
        dotClass: 'bg-[#E11D48]',
        cardClass:
          'border-[#FDA4AF]/60 border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/85',
        textClass: 'text-[#E11D48]',
        badgeClass: 'border border-[#FDA4AF]/75 bg-white/85 text-[#E11D48] backdrop-blur-xs',
        badge: 'Превышен лимит',
        label: `ФОТ выше ${limit}% (${finance.fotPercentOfContract.toFixed(1)}%)`,
        detail: `Маржа положительная (${formatCurrency(finance.projectedMarginAmount)}), но доля команды превышает целевой порог ${limit}%.`,
      };
    }
    if (fotUtilizationPct >= 80) {
      return {
        tone: 'amber' as const,
        dotClass: 'bg-[#D97706]',
        cardClass: 'border-amber-300/60 border-l-4 border-l-[#D97706] bg-amber-50/75',
        textClass: 'text-[#B45309]',
        badgeClass: 'border border-amber-300/60 bg-amber-50/90 text-[#B45309] backdrop-blur-xs',
        badge: 'Внимание · ФОТ',
        label: `ФОТ близок к лимиту (${Math.round(fotUtilizationPct)}% от порога ${limit}%)`,
        detail: `ФОТ составляет ${finance.fotPercentOfContract.toFixed(1)}% от договора — контролируйте новые начисления по команде.`,
      };
    }
    return {
      tone: 'green' as const,
      dotClass: 'bg-[#0D9488]',
      cardClass: 'border-[#0D9488]/20 bg-[#F0FDFA]/85',
      textClass: 'text-[#0D9488]',
      badgeClass: 'border border-[#0D9488]/20 bg-white/85 text-[#0D9488] backdrop-blur-xs',
      badge: 'Норма',
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
      className="bento-card overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0EA5E9]/14 px-6 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="text-[11px] font-medium text-[#547585]">
            Только для Руководителя и Помощника · Совмещение ролей, сдельщики, окладники и накладные
          </div>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#0F2936]">
            Команда и затраты объекта
          </h2>
        </div>
        <button
          type="button"
          onClick={() => openNewForm()}
          className="btn-pulse flex h-9 items-center gap-1.5 self-start rounded-full px-4 text-xs font-semibold sm:self-auto whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          Добавить строку затрат
        </button>
      </div>

      {/* Margin & FOT Traffic Light Strip */}
      <div className="grid grid-cols-1 gap-4 border-b border-[#0EA5E9]/14 bg-[#F4FAFC]/80 p-6 lg:grid-cols-12">
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 lg:col-span-5 ${trafficLight.cardClass}`}
        >
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${trafficLight.dotClass}`}
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold ${trafficLight.textClass}`}>
                {trafficLight.label}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${trafficLight.badgeClass}`}
              >
                {trafficLight.badge}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[#547585]">
              {trafficLight.detail}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-4 py-3.5 lg:col-span-2">
          <div className="text-[10px] font-medium text-[#547585]">Бюджет затрат</div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#0F2936]">
            {formatCurrency(linesSummary.totalBudget)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#547585]">
            ФОТ {finance.fotPercentOfContract.toFixed(1)}% от КП
          </div>
        </div>

        <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-4 py-3.5 lg:col-span-2">
          <div className="text-[10px] font-medium text-[#547585]">Выплачено</div>
          <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-[#0D9488]">
            {formatCurrency(linesSummary.totalPaid)}
          </div>
          <div className="font-mono text-[10px] tabular-nums text-[#547585]">
            {linesSummary.paidPct}% от бюджета
          </div>
        </div>

        <div
          className={`px-4 py-3.5 lg:col-span-3 ${
            finance.isNegativeMargin ? 'bento-card-risk' : 'bento-card-balance'
          }`}
        >
          <div
            className={`flex items-center justify-between text-[10px] font-medium ${
              finance.isNegativeMargin ? 'text-[#9F1239]' : 'text-[#0F6E6E]'
            }`}
          >
            <span>Остаток к выплате</span>
            <span>Маржа объекта</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-sm font-semibold tabular-nums">
            <span className="text-[#0F2936]">{formatCurrency(linesSummary.totalRemaining)}</span>
            <span className={finance.isNegativeMargin ? 'text-[#E11D48]' : 'text-[#0D9488]'}>
              {finance.projectedMarginPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-[#547585]">
            <span>{linesSummary.remPct}% осталось</span>
            <span>{formatCurrency(finance.projectedMarginAmount)}</span>
          </div>
        </div>
      </div>

      {/* Add / Edit Cost Line Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border-b border-[#DDF0F4] bg-[#EEF8FA] p-5"
        >
          <div className="flex items-center justify-between border-b border-[#C5E6EC] pb-3">
            <div className="text-xs font-bold text-[#0F2936]">
              {editingId ? 'Редактировать строку затрат' : 'Новая строка затрат по роли / совмещению'}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                Роль / статья затрат *
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as ProjectCostRole)}
                className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs font-medium text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              >
                {COST_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                Исполнитель (можно совмещать роли) *
              </label>
              <input
                type="text"
                required
                list="project-assignee-suggestions"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Например: Алина, София, Вика..."
                className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              />
              <datalist id="project-assignee-suggestions">
                {existingAssignees.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                Формат расчёта
              </label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as CostLinePayMode)}
                className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              >
                <option value="piecework">Сдельная / фикс за роль</option>
                <option value="salary">Окладник (доля по м² или дням)</option>
                <option value="overhead">Накладные (бензин, печать)</option>
              </select>
            </div>

            {payMode === 'salary' ? (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                  Окладник из справочника (опц.)
                </label>
                <select
                  value={memberId}
                  onChange={(e) => handleSelectSalariedMember(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
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
                <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                  Бюджет (Всего), ₽ *
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                />
              </div>
            )}

            {payMode === 'salary' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                    Оклад в месяц, ₽ *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
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
                    className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  >
                    <option value="days">По рабочим дням</option>
                    <option value="sqm">По отработанным м²</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                    Отработано на объекте ({salaryUnit === 'days' ? 'дней' : 'м²'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={workedUnits}
                    onChange={(e) => setWorkedUnits(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                    Месячная норма ({salaryUnit === 'days' ? 'дн./мес' : 'м²/мес'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={monthlyCapacityUnits}
                    onChange={(e) => setMonthlyCapacityUnits(e.target.value)}
                    className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                Выплачено на сегодня, ₽
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-xs tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-[11px] font-medium text-[#4C6D7C]">
                Комментарий / объём работ
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Например: 3D-визуализация + правки, или 250 ₽/м² за РД"
                className="h-9 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-xs text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              />
            </div>
          </div>

          {payMode === 'salary' && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C5E6EC] bg-white px-4 py-2.5 text-xs">
              <span className="text-[#4C6D7C]">
                Авто-списание доли оклада в себестоимость объекта:{' '}
                <span className="font-mono text-[#0F2936]">
                  {formatCurrency(Number(monthlySalary) || 0)} × ({workedUnits || 0} /{' '}
                  {monthlyCapacityUnits || 22}{' '}
                  {salaryUnit === 'days' ? 'дн.' : 'м²'})
                </span>
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#0D9488]">
                = {formatCurrency(previewSalaryBudget)}
              </span>
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#C5E6EC] pt-3">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="h-9 rounded-full border border-[#B5DFE8] bg-white px-4 text-xs font-medium text-[#0F2936] hover:border-[#0284C9] hover:text-[#0284C9]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-pulse flex h-9 items-center gap-1.5 rounded-full px-5 text-xs font-semibold"
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
            <tr className="border-b border-[#DDF0F4] bg-[#EEF8FA] text-[11px] font-semibold text-[#4C6D7C]">
              <th className="px-5 py-3">Роль и исполнитель</th>
              <th className="px-4 py-3">Формат</th>
              <th className="px-4 py-3 text-right">Бюджет (Всего)</th>
              <th className="px-4 py-3 text-right">Выплачено</th>
              <th className="px-4 py-3 text-right">Остаток к выплате</th>
              <th className="px-5 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1F2F6] text-xs">
            {costLines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-[#4C6D7C]">
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
                  <tr key={line.id} className="transition-colors hover:bg-[#F4FBFD]">
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#0F2936]">{line.role}</span>
                        <span className="text-[#B5DFE8]">·</span>
                        <span className="font-medium text-[#0F2936]">{line.assigneeName}</span>
                        {isMultiRole && (
                          <span
                            className="rounded-full border border-[#BAE6FD] bg-[#E0F2FE] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#0284C9]"
                            title={`Сотрудник совмещает ${multiInfo!.count} роли на этом объекте (итого ${formatCurrency(multiInfo!.totalBudget)})`}
                          >
                            совмещение ×{multiInfo!.count}
                          </span>
                        )}
                      </div>
                      {line.note && (
                        <div className="mt-0.5 text-[11px] text-[#4C6D7C]">{line.note}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-[11px] text-[#4C6D7C] whitespace-nowrap">
                      {line.payMode === 'salary' ? (
                        <div>
                          <div className="font-semibold text-[#0F2936]">Окладник</div>
                          <div className="font-mono text-[10px] tabular-nums">
                            {formatNumber(line.workedUnits || 0)} /{' '}
                            {formatNumber(line.monthlyCapacityUnits || 22)}{' '}
                            {line.salaryUnit === 'sqm' ? 'м²' : 'дн.'} от{' '}
                            {formatCurrency(line.monthlySalary || 0)}
                          </div>
                        </div>
                      ) : line.payMode === 'overhead' ? (
                        <span className="font-medium text-[#4C6D7C]">Накладные</span>
                      ) : (
                        <span className="font-medium text-[#0F2936]">Сдельная</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold tabular-nums text-[#0F2936] whitespace-nowrap">
                      {formatCurrency(effBudget)}
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="font-mono font-semibold tabular-nums text-[#0D9488]">
                        {formatCurrency(paid)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#4C6D7C]">
                        {paidPct}%
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div
                        className={`font-mono font-bold tabular-nums ${
                          remaining > 0 ? 'text-[#0F2936]' : 'text-[#0D9488]'
                        }`}
                      >
                        {formatCurrency(remaining)}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-[#4C6D7C]">
                        {remPct}%
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {effBudget > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMarkFullyPaid(line)}
                            className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold transition-all whitespace-nowrap ${
                              isSettled
                                ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0D9488] hover:bg-white'
                                : 'border-[#B5DFE8] bg-white text-[#0F2936] hover:border-[#0D9488] hover:bg-[#0D9488] hover:text-white'
                            }`}
                            title={
                              isSettled
                                ? 'Снять отметку полной выплаты'
                                : 'Отметить как выплачено 100%'
                            }
                          >
                            <CheckCheck className="h-3 w-3" strokeWidth={1.6} />
                            {isSettled ? 'Оплачено' : 'Выплатить'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(line)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] hover:border-[#0284C7] hover:text-[#0284C7]"
                          aria-label="Редактировать строку"
                        >
                          <Pencil className="h-3 w-3" strokeWidth={1.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLine(line.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] hover:border-[#FDA4AF] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                          aria-label="Удалить строку"
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
          {costLines.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#C5E6EC] bg-[#EEF8FA] text-xs font-bold text-[#0F2936]">
                <td colSpan={2} className="px-5 py-3.5">
                  Итого по команде и накладным ({costLines.length} поз.)
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                  {formatCurrency(linesSummary.totalBudget)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#0D9488]">
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
        <div className="flex flex-wrap items-center gap-3 border-t border-[#DDF0F4] bg-[#F4FBFD] px-5 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F2936]">
            <Users className="h-3.5 w-3.5 text-[#0284C9]" />
            Сводка по совмещению ролей:
          </span>
          {multiRoleSpecialists.map((spec) => (
            <span
              key={spec.displayName}
              className="rounded-full border border-[#BAE6FD] bg-white px-3 py-1 font-mono text-[11px] tabular-nums text-[#0F2936]"
            >
              {spec.displayName} ({spec.count} роли) —{' '}
              <strong className="text-[#0284C9]">{formatCurrency(spec.totalBudget)}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
