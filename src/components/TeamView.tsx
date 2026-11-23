import React, { useState } from 'react';
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import { createId } from '../data/demoData';
import {
  AllocationBasis,
  CostRoleGroup,
  PaymentType,
  StudioSettings,
  TeamMember,
} from '../types';
import { formatCurrency } from '../utils/calculations';

interface TeamViewProps {
  team: TeamMember[];
  settings: StudioSettings;
  onAddMember: (member: TeamMember) => void;
  onUpdateMember: (member: TeamMember) => void;
  onDeleteMember: (member: TeamMember) => void;
  onUpdateSettings: (settings: StudioSettings) => void;
}

const COST_GROUPS: Array<Exclude<CostRoleGroup, 'Печать и логистика'>> = [
  'Дизайнер',
  'Визуализатор',
  'Чертёжник',
  'Замеры',
  'Комплектатор',
  'Руководитель проекта',
  'Прочие роли',
];

export const TeamView: React.FC<TeamViewProps> = ({
  team,
  settings,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onUpdateSettings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [roleTitle, setRoleTitle] = useState('');
  const [code, setCode] = useState('');
  const [costGroup, setCostGroup] = useState<Exclude<CostRoleGroup, 'Печать и логистика'>>('Дизайнер');
  const [paymentType, setPaymentType] = useState<PaymentType>('salary');
  const [monthlySalary, setMonthlySalary] = useState('100000');
  const [allocationBasis, setAllocationBasis] = useState<AllocationBasis>('area');
  const [pieceworkRate, setPieceworkRate] = useState('800');
  const [pieceworkUnit, setPieceworkUnit] = useState<'м²' | 'этап' | 'выезд'>('м²');

  const [fotLimitInput, setFotLimitInput] = useState(String(settings.defaultFotLimitPercent));

  const totalMonthlySalary = team
    .filter((m) => m.paymentType === 'salary')
    .reduce((acc, m) => acc + (Number(m.monthlySalary) || 0), 0);

  const resetForm = () => {
    setRoleTitle('');
    setCode('');
    setCostGroup('Дизайнер');
    setPaymentType('salary');
    setMonthlySalary('100000');
    setAllocationBasis('area');
    setPieceworkRate('800');
    setPieceworkUnit('м²');
    setEditingId(null);
    setShowAddForm(false);
  };

  const startEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setShowAddForm(true);
    setRoleTitle(m.roleTitle);
    setCode(m.code);
    setCostGroup(m.costGroup);
    setPaymentType(m.paymentType);
    setMonthlySalary(String(m.monthlySalary || 0));
    setAllocationBasis(m.allocationBasis || 'area');
    setPieceworkRate(String(m.pieceworkRate || 0));
    setPieceworkUnit(m.pieceworkUnit || 'м²');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) return;

    const payload: TeamMember = {
      id: editingId || createId('tm'),
      roleTitle: roleTitle.trim(),
      code: (code.trim() || roleTitle.trim().slice(0, 3)).toUpperCase(),
      costGroup,
      paymentType,
      monthlySalary: paymentType === 'salary' ? Math.max(0, Number(monthlySalary) || 0) : 0,
      allocationBasis,
      pieceworkRate: paymentType === 'piecework' ? Math.max(0, Number(pieceworkRate) || 0) : 0,
      pieceworkUnit,
    };

    if (editingId) {
      onUpdateMember(payload);
    } else {
      onAddMember(payload);
    }
    resetForm();
  };

  const saveFotLimit = () => {
    const val = Math.min(100, Math.max(5, Number(fotLimitInput) || 40));
    setFotLimitInput(String(val));
    onUpdateSettings({ ...settings, defaultFotLimitPercent: val });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0EA5E9]/14 pb-5 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-medium text-[#547585]">
            Справочник позиций без личных имён · Автоматический расчёт окладов по м² и часам
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F2936] sm:text-3xl">
            Команда и лимит ФОТ
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="btn-pulse flex min-h-[40px] items-center gap-1.5 self-start rounded-full px-5 py-2 text-xs font-semibold md:self-auto whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
          Добавить должность
        </button>
      </div>

      {/* Summary & Global FOT Limit Settings */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="bento-card-balance p-6">
          <div className="text-xs font-medium text-[#0F6E6E]">Фиксированные оклады в месяц</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0D9488]">
            {formatCurrency(totalMonthlySalary)}
          </div>
          <div className="mt-1.5 text-xs text-[#547585]">
            Штатных позиций:{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
              {team.filter((m) => m.paymentType === 'salary').length}
            </span>
          </div>
        </div>

        <div className="bento-card p-6">
          <div className="text-xs font-medium text-[#547585]">Сдельные позиции</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0F2936]">
            {team.filter((m) => m.paymentType === 'piecework').length}
          </div>
          <div className="mt-1.5 text-xs text-[#547585]">
            Оплата по факту м² / этапов / выездов
          </div>
        </div>

        <div className="bento-card p-6">
          <div className="text-xs font-medium text-[#547585]">Лимит ФОТ по умолчанию (% от КП)</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="100"
              value={fotLimitInput}
              onChange={(e) => setFotLimitInput(e.target.value)}
              className="h-9 w-24 rounded-xl border border-[#0EA5E9]/20 bg-white px-3 font-mono text-sm font-semibold tabular-nums text-[#0F2936] focus:border-[#0284C7] focus:outline-none"
            />
            <span className="font-mono text-sm text-[#547585]">%</span>
            <button
              type="button"
              onClick={saveFotLimit}
              className="btn-pulse flex h-9 items-center gap-1 rounded-full px-4 text-xs font-semibold"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
              Применить
            </button>
          </div>
          <div className="mt-1.5 text-[11px] text-[#547585]">
            При превышении порога проект подсвечивается в рисках
          </div>
        </div>
      </div>

      {/* Add / Edit Position Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bento-card p-6">
          <div className="flex items-center justify-between border-b border-[#DDF0F4] pb-3">
            <h2 className="text-sm font-bold text-[#0F2936]">
              {editingId ? 'Редактировать позицию команды' : 'Новая позиция / роль'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#4C6D7C] hover:bg-[#EEF8FA] hover:text-[#0F2936]"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                Должность / роль *
              </label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Например: Визуализатор 3D"
                className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">Код для Ганта</label>
              <input
                type="text"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ВИЗ"
                className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-sm uppercase text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                Статья аналитики
              </label>
              <select
                value={costGroup}
                onChange={(e) =>
                  setCostGroup(e.target.value as Exclude<CostRoleGroup, 'Печать и логистика'>)
                }
                className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              >
                {COST_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">Тип оплаты</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
              >
                <option value="salary">Ежемесячный оклад</option>
                <option value="piecework">Сдельная (м² / этап)</option>
              </select>
            </div>

            {paymentType === 'salary' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Оклад в месяц, ₽
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-sm tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    База распределения оклада между проектами
                  </label>
                  <select
                    value={allocationBasis}
                    onChange={(e) => setAllocationBasis(e.target.value as AllocationBasis)}
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  >
                    <option value="area">Пропорционально отработанным м² за месяц</option>
                    <option value="hours">Пропорционально отработанным часам за месяц</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Базовая ставка, ₽
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={pieceworkRate}
                    onChange={(e) => setPieceworkRate(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 font-mono text-sm tabular-nums text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Единица расчёта
                  </label>
                  <select
                    value={pieceworkUnit}
                    onChange={(e) =>
                      setPieceworkUnit(e.target.value as 'м²' | 'этап' | 'выезд')
                    }
                    className="h-10 w-full rounded-xl border border-[#B5DFE8] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
                  >
                    <option value="м²">за м²</option>
                    <option value="этап">за этап</option>
                    <option value="выезд">за выезд</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2.5 border-t border-[#DDF0F4] pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[40px] rounded-full border border-[#B5DFE8] bg-white px-5 text-xs font-semibold text-[#0F2936] hover:border-[#0284C9] hover:text-[#0284C9]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-pulse min-h-[40px] rounded-full px-6 text-xs font-semibold"
            >
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      )}

      {/* Team Directory Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#DDF0F4] bg-[#EEF8FA] text-[11px] font-semibold text-[#4C6D7C]">
                <th className="px-5 py-3.5">Код</th>
                <th className="px-4 py-3.5">Должность / Роль</th>
                <th className="px-4 py-3.5">Статья затрат</th>
                <th className="px-4 py-3.5">Формат оплаты</th>
                <th className="px-4 py-3.5 text-right">Оклад / Ставка</th>
                <th className="px-5 py-3.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1F2F6]">
              {team.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#4C6D7C]">
                    Список должностей пуст. Добавьте первую позицию команды.
                  </td>
                </tr>
              ) : (
                team.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[#F4FBFD]">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-full border border-[#C5E6EC] bg-[#EEF8FA] px-2.5 py-0.5 font-mono text-xs font-bold text-[#0D9488]">
                        {m.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-[#0F2936]">
                      {m.roleTitle}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#4C6D7C]">{m.costGroup}</td>
                    <td className="px-4 py-3.5 text-xs text-[#0F2936]">
                      {m.paymentType === 'salary'
                        ? `Оклад · деление по ${m.allocationBasis === 'area' ? 'м²' : 'часам'}`
                        : `Сдельная · за ${m.pieceworkUnit}`}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold tabular-nums text-[#0F2936]">
                      {m.paymentType === 'salary'
                        ? `${formatCurrency(m.monthlySalary)} / мес`
                        : `${formatCurrency(m.pieceworkRate)} / ${m.pieceworkUnit}`}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] hover:border-[#0284C7] hover:text-[#0284C7]"
                          aria-label="Редактировать"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMember(m)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#0EA5E9]/18 bg-white text-[#547585] hover:border-[#FDA4AF] hover:bg-[#FFF1F2] hover:text-[#E11D48]"
                          aria-label="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
