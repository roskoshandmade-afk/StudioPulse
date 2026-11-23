import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { createId } from '../data/demoData';
import {
  AppData,
  DirectExpense,
  ExpenseCategory,
  WorklogEntry,
} from '../types';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatNumber,
  getCurrentMonthIso,
  getTodayIso,
} from '../utils/calculations';

interface WorklogSectionProps {
  data: AppData;
  fixedProjectId?: string;
  onAddWorklog: (entry: WorklogEntry) => void;
  onUpdateWorklog: (entry: WorklogEntry) => void;
  onDeleteWorklog: (id: string) => void;
  onAddExpense: (expense: DirectExpense) => void;
  onUpdateExpense: (expense: DirectExpense) => void;
  onDeleteExpense: (id: string) => void;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Печать и альбомы',
  'Выкрасы и образцы',
  'Бензин и логистика',
  'Прочие расходы',
];

export const WorklogSection: React.FC<WorklogSectionProps> = ({
  data,
  fixedProjectId,
  onAddWorklog,
  onUpdateWorklog,
  onDeleteWorklog,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  const [subTab, setSubTab] = useState<'worklog' | 'expenses'>('worklog');
  const [filterProjectId, setFilterProjectId] = useState<string>(fixedProjectId || 'all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Worklog Form State
  const [showWorklogForm, setShowWorklogForm] = useState(false);
  const [editingWlId, setEditingWlId] = useState<string | null>(null);
  const [wlProjectId, setWlProjectId] = useState(fixedProjectId || data.projects[0]?.id || '');
  const [wlMemberId, setWlMemberId] = useState(data.team[0]?.id || '');
  const [wlMonth, setWlMonth] = useState(getCurrentMonthIso());
  const [wlDate, setWlDate] = useState(getTodayIso());
  const [wlArea, setWlArea] = useState('');
  const [wlHours, setWlHours] = useState('');
  const [wlPiecework, setWlPiecework] = useState('');
  const [wlComment, setWlComment] = useState('');

  // Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expProjectId, setExpProjectId] = useState(fixedProjectId || data.projects[0]?.id || '');
  const [expDate, setExpDate] = useState(getTodayIso());
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Печать и альбомы');
  const [expAmount, setExpAmount] = useState('');
  const [expComment, setExpComment] = useState('');

  const projectMap = useMemo(() => new Map(data.projects.map((p) => [p.id, p])), [data.projects]);
  const memberMap = useMemo(() => new Map(data.team.map((m) => [m.id, m])), [data.team]);

  const activeProjectFilter = fixedProjectId || filterProjectId;

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    data.worklogs.forEach((w) => w.month && set.add(w.month));
    set.add(getCurrentMonthIso());
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data.worklogs]);

  const filteredWorklogs = useMemo(() => {
    return data.worklogs
      .filter((w) => {
        if (activeProjectFilter !== 'all' && w.projectId !== activeProjectFilter) return false;
        if (filterMonth !== 'all' && w.month !== filterMonth) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.worklogs, activeProjectFilter, filterMonth]);

  const filteredExpenses = useMemo(() => {
    return data.expenses
      .filter((e) => {
        if (activeProjectFilter !== 'all' && e.projectId !== activeProjectFilter) return false;
        if (filterMonth !== 'all' && !e.date.startsWith(filterMonth)) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.expenses, activeProjectFilter, filterMonth]);

  const selectedMember = memberMap.get(wlMemberId);

  const openNewWorklog = () => {
    setEditingWlId(null);
    setWlProjectId(fixedProjectId || data.projects[0]?.id || '');
    setWlMemberId(data.team[0]?.id || '');
    setWlMonth(getCurrentMonthIso());
    setWlDate(getTodayIso());
    setWlArea('');
    setWlHours('');
    setWlPiecework('');
    setWlComment('');
    setShowWorklogForm(true);
  };

  const startEditWorklog = (entry: WorklogEntry) => {
    setEditingWlId(entry.id);
    setWlProjectId(entry.projectId);
    setWlMemberId(entry.memberId);
    setWlMonth(entry.month);
    setWlDate(entry.date);
    setWlArea(String(entry.areaSqm || ''));
    setWlHours(String(entry.hours || ''));
    setWlPiecework(String(entry.pieceworkAmount || ''));
    setWlComment(entry.comment);
    setShowWorklogForm(true);
  };

  const handleMemberOrAreaChange = (nextMemberId: string, nextAreaStr: string) => {
    setWlMemberId(nextMemberId);
    setWlArea(nextAreaStr);
    const m = memberMap.get(nextMemberId);
    if (m && m.paymentType === 'piecework' && !editingWlId) {
      const numArea = Number(nextAreaStr) || 0;
      if (m.pieceworkUnit === 'м²' && numArea > 0) {
        setWlPiecework(String(Math.round(numArea * m.pieceworkRate)));
      } else if (m.pieceworkUnit !== 'м²' && m.pieceworkRate > 0) {
        setWlPiecework(String(m.pieceworkRate));
      }
    }
  };

  const submitWorklog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wlProjectId || !wlMemberId) return;

    const entry: WorklogEntry = {
      id: editingWlId || createId('wl'),
      projectId: wlProjectId,
      memberId: wlMemberId,
      month: wlMonth || getCurrentMonthIso(),
      date: wlDate || getTodayIso(),
      areaSqm: Math.max(0, Number(wlArea) || 0),
      hours: Math.max(0, Number(wlHours) || 0),
      pieceworkAmount: Math.max(0, Number(wlPiecework) || 0),
      comment: wlComment.trim(),
    };

    if (editingWlId) {
      onUpdateWorklog(entry);
    } else {
      onAddWorklog(entry);
    }
    setShowWorklogForm(false);
    setEditingWlId(null);
  };

  const openNewExpense = () => {
    setEditingExpId(null);
    setExpProjectId(fixedProjectId || data.projects[0]?.id || '');
    setExpDate(getTodayIso());
    setExpCategory('Печать и альбомы');
    setExpAmount('');
    setExpComment('');
    setShowExpenseForm(true);
  };

  const startEditExpense = (exp: DirectExpense) => {
    setEditingExpId(exp.id);
    setExpProjectId(exp.projectId);
    setExpDate(exp.date);
    setExpCategory(exp.category);
    setExpAmount(String(exp.amount || ''));
    setExpComment(exp.comment);
    setShowExpenseForm(true);
  };

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expProjectId) return;
    const expense: DirectExpense = {
      id: editingExpId || createId('exp'),
      projectId: expProjectId,
      date: expDate || getTodayIso(),
      category: expCategory,
      amount: Math.max(0, Number(expAmount) || 0),
      comment: expComment.trim(),
    };
    if (editingExpId) {
      onUpdateExpense(expense);
    } else {
      onAddExpense(expense);
    }
    setShowExpenseForm(false);
    setEditingExpId(null);
  };

  const totalPieceworkShown = filteredWorklogs.reduce((acc, w) => acc + (w.pieceworkAmount || 0), 0);
  const totalExpensesShown = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  return (
    <section aria-label="Журнал выработки и расходов" className="space-y-5">
      {!fixedProjectId && (
        <div className="border-b border-[#0A0A0A] pb-6">
          <div className="text-xs text-[#525252]">
            Учёт м² и часов для автоматического деления окладов, сдельных начислений и прямых чеков
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0A0A0A] sm:text-3xl">
            Журнал выработки и расходов
          </h1>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-1 border border-[#0A0A0A] bg-[#F4F4F4] p-1 self-start">
          <button
            type="button"
            onClick={() => setSubTab('worklog')}
            className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'worklog'
                ? 'bg-[#0A0A0A] text-white'
                : 'text-[#525252] hover:text-[#0A0A0A]'
            }`}
          >
            Выработка команды ({filteredWorklogs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('expenses')}
            className={`px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'expenses'
                ? 'bg-[#0A0A0A] text-white'
                : 'text-[#525252] hover:text-[#0A0A0A]'
            }`}
          >
            Прямые чеки ({filteredExpenses.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!fixedProjectId && (
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="h-9 border border-[#0A0A0A] bg-white px-2.5 text-xs text-[#0A0A0A] focus:outline-none"
            >
              <option value="all">Все объекты</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-9 border border-[#0A0A0A] bg-white px-2.5 text-xs text-[#0A0A0A] focus:outline-none"
          >
            <option value="all">Все месяцы</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>

          {subTab === 'worklog' ? (
            <button
              type="button"
              disabled={data.projects.length === 0 || data.team.length === 0}
              onClick={openNewWorklog}
              className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#262626] disabled:opacity-40 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Внести выработку
            </button>
          ) : (
            <button
              type="button"
              disabled={data.projects.length === 0}
              onClick={openNewExpense}
              className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#262626] disabled:opacity-40 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить чек
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Worklog Form */}
      {subTab === 'worklog' && showWorklogForm && (
        <form onSubmit={submitWorklog} className="border border-[#0A0A0A] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#D4D4D4] pb-3">
            <div className="text-sm font-semibold text-[#0A0A0A]">
              {editingWlId ? 'Редактировать запись выработки' : 'Новая запись выработки / сделки'}
            </div>
            <button
              type="button"
              onClick={() => setShowWorklogForm(false)}
              className="text-[#525252] hover:text-[#0A0A0A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!fixedProjectId && (
              <div>
                <label className="mb-1 block text-xs text-[#6B6B68]">Объект *</label>
                <select
                  required
                  value={wlProjectId}
                  onChange={(e) => setWlProjectId(e.target.value)}
                  className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-xs text-[#0F0F0F]"
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Сотрудник / роль *</label>
              <select
                required
                value={wlMemberId}
                onChange={(e) => handleMemberOrAreaChange(e.target.value, wlArea)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-xs text-[#0F0F0F]"
              >
                {data.team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} · {m.roleTitle} ({m.paymentType === 'salary' ? 'оклад' : 'сделка'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Месяц расчёта</label>
              <input
                type="month"
                required
                value={wlMonth}
                onChange={(e) => setWlMonth(e.target.value)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Дата записи</label>
              <input
                type="date"
                value={wlDate}
                onChange={(e) => setWlDate(e.target.value)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">
                Отработано м²{' '}
                {selectedMember?.paymentType === 'salary' &&
                  selectedMember.allocationBasis === 'area' &&
                  '(база оклада)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={wlArea}
                onChange={(e) => handleMemberOrAreaChange(wlMemberId, e.target.value)}
                placeholder="0"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-xs tabular-nums text-[#0F0F0F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">
                Отработано часов{' '}
                {selectedMember?.paymentType === 'salary' &&
                  selectedMember.allocationBasis === 'hours' &&
                  '(база оклада)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={wlHours}
                onChange={(e) => setWlHours(e.target.value)}
                placeholder="0"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-xs tabular-nums text-[#0F0F0F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">
                Сдельное начисление, ₽
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={wlPiecework}
                onChange={(e) => setWlPiecework(e.target.value)}
                placeholder={selectedMember?.paymentType === 'salary' ? '0 (оклад)' : 'Сумма ₽'}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-xs tabular-nums text-[#0F0F0F]"
              />
            </div>

            <div className={fixedProjectId ? 'sm:col-span-2 lg:col-span-2' : 'sm:col-span-2 lg:col-span-1'}>
              <label className="mb-1 block text-xs text-[#6B6B68]">Комментарий</label>
              <input
                type="text"
                value={wlComment}
                onChange={(e) => setWlComment(e.target.value)}
                placeholder="Какие помещения / этап выполнены"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-xs text-[#0F0F0F]"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-[#D4D4D4] pt-3">
            <button
              type="button"
              onClick={() => setShowWorklogForm(false)}
              className="min-h-[38px] border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="min-h-[38px] bg-[#0A0A0A] px-5 text-xs font-medium text-white hover:bg-[#262626]"
            >
              {editingWlId ? 'Сохранить' : 'Записать'}
            </button>
          </div>
        </form>
      )}

      {/* Add / Edit Direct Expense Form */}
      {subTab === 'expenses' && showExpenseForm && (
        <form onSubmit={submitExpense} className="border border-[#0A0A0A] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#D4D4D4] pb-3">
            <div className="text-sm font-semibold text-[#0A0A0A]">
              {editingExpId ? 'Редактировать расход' : 'Новый прямой чек по объекту'}
            </div>
            <button
              type="button"
              onClick={() => setShowExpenseForm(false)}
              className="text-[#525252] hover:text-[#0A0A0A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!fixedProjectId && (
              <div>
                <label className="mb-1 block text-xs text-[#6B6B68]">Объект *</label>
                <select
                  required
                  value={expProjectId}
                  onChange={(e) => setExpProjectId(e.target.value)}
                  className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-xs text-[#0F0F0F]"
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Категория</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-xs text-[#0F0F0F]"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Дата чека</label>
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Сумма, ₽ *</label>
              <input
                type="number"
                required
                min="0"
                step="50"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="0"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-xs tabular-nums text-[#0F0F0F]"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs text-[#6B6B68]">Описание чека</label>
              <input
                type="text"
                value={expComment}
                onChange={(e) => setExpComment(e.target.value)}
                placeholder="Печать альбома А3, выкрасы эмали, доставка образцов..."
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-xs text-[#0F0F0F]"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-[#D4D4D4] pt-3">
            <button
              type="button"
              onClick={() => setShowExpenseForm(false)}
              className="min-h-[38px] border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="min-h-[38px] bg-[#0A0A0A] px-5 text-xs font-medium text-white hover:bg-[#262626]"
            >
              {editingExpId ? 'Сохранить' : 'Добавить чек'}
            </button>
          </div>
        </form>
      )}

      {/* Worklog Table */}
      {subTab === 'worklog' ? (
        <div className="overflow-x-auto border border-[#0A0A0A] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-medium text-[#525252]">
                <th className="px-5 py-3">Месяц / Дата</th>
                {!fixedProjectId && <th className="px-4 py-3">Объект</th>}
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3 text-right">Выработка</th>
                <th className="px-4 py-3 text-right">Сделка ₽</th>
                <th className="px-4 py-3">Комментарий</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4D4D4] text-xs">
              {filteredWorklogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={fixedProjectId ? 6 : 7}
                    className="px-5 py-10 text-center text-[#525252]"
                  >
                    Записей выработки пока нет.
                  </td>
                </tr>
              ) : (
                filteredWorklogs.map((w) => {
                  const m = memberMap.get(w.memberId);
                  const p = projectMap.get(w.projectId);
                  return (
                    <tr key={w.id} className="hover:bg-[#F4F4F4]">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="font-medium text-[#0A0A0A]">
                          {formatMonthLabel(w.month)}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-[#737373]">
                          {formatDate(w.date)}
                        </div>
                      </td>
                      {!fixedProjectId && (
                        <td className="px-4 py-3 font-medium text-[#0A0A0A]">
                          {p?.name || 'Удалённый объект'}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="mr-1.5 font-mono text-[11px] font-semibold text-[#0A0A0A]">
                          {m?.code || '—'}
                        </span>
                        <span className="text-[#525252]">{m?.roleTitle || 'Неизвестно'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        {w.areaSqm > 0 ? `${formatNumber(w.areaSqm)} м²` : ''}
                        {w.areaSqm > 0 && w.hours > 0 ? ' · ' : ''}
                        {w.hours > 0 ? `${formatNumber(w.hours)} ч` : ''}
                        {w.areaSqm === 0 && w.hours === 0 ? '—' : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        {w.pieceworkAmount > 0 ? formatCurrency(w.pieceworkAmount) : 'Оклад'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[#525252]">
                        {w.comment || '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEditWorklog(w)}
                            className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                            aria-label="Редактировать"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteWorklog(w.id)}
                            className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]"
                            aria-label="Удалить"
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
            {filteredWorklogs.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#0A0A0A] bg-[#F4F4F4] text-xs font-semibold text-[#0A0A0A]">
                  <td colSpan={fixedProjectId ? 3 : 4} className="px-5 py-3">
                    Итого сдельная оплата по выборке
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatCurrency(totalPieceworkShown)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        /* Direct Expenses Table */
        <div className="overflow-x-auto border border-[#0A0A0A] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-medium text-[#525252]">
                <th className="px-5 py-3">Дата</th>
                {!fixedProjectId && <th className="px-4 py-3">Объект</th>}
                <th className="px-4 py-3">Категория</th>
                <th className="px-4 py-3">Описание</th>
                <th className="px-4 py-3 text-right">Сумма</th>
                <th className="px-5 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D4D4D4] text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td
                    colSpan={fixedProjectId ? 5 : 6}
                    className="px-5 py-10 text-center text-[#525252]"
                  >
                    Прямых расходов (печать, выкрасы, логистика) пока нет.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const p = projectMap.get(exp.projectId);
                  return (
                    <tr key={exp.id} className="hover:bg-[#F4F4F4]">
                      <td className="px-5 py-3 font-mono tabular-nums text-[#525252] whitespace-nowrap">
                        {formatDate(exp.date)}
                      </td>
                      {!fixedProjectId && (
                        <td className="px-4 py-3 font-medium text-[#0A0A0A]">
                          {p?.name || 'Удалённый объект'}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-[#0A0A0A] whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="px-4 py-3 text-[#525252]">{exp.comment || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#0A0A0A] whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEditExpense(exp)}
                            className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                            aria-label="Редактировать"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(exp.id)}
                            className="flex h-7 w-7 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]"
                            aria-label="Удалить"
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
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#0A0A0A] bg-[#F4F4F4] text-xs font-semibold text-[#0A0A0A]">
                  <td colSpan={fixedProjectId ? 3 : 4} className="px-5 py-3">
                    Итого прямые расходы
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatCurrency(totalExpensesShown)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
};
