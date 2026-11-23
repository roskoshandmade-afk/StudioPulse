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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0A0A0A] pb-6 md:flex-row md:items-end">
        <div>
          <div className="text-xs text-[#525252]">
            Справочник позиций без личных имён · Автоматический расчёт окладов по м² и часам
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0A0A0A] sm:text-3xl">
            Команда и лимит ФОТ
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="flex min-h-[40px] items-center gap-1.5 self-start bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#262626] md:self-auto whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить должность
        </button>
      </div>

      {/* Summary & Global FOT Limit Settings */}
      <div className="grid grid-cols-1 gap-px border border-[#0A0A0A] bg-[#0A0A0A] md:grid-cols-3">
        <div className="bg-[#0A0A0A] p-5 text-white">
          <div className="text-xs text-[#A3A3A3]">Фиксированные оклады в месяц</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white">
            {formatCurrency(totalMonthlySalary)}
          </div>
          <div className="mt-1.5 text-xs text-[#A3A3A3]">
            Штатных позиций:{' '}
            <span className="font-mono tabular-nums text-white">
              {team.filter((m) => m.paymentType === 'salary').length}
            </span>
          </div>
        </div>

        <div className="bg-white p-5">
          <div className="text-xs text-[#525252]">Сдельные позиции</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#0A0A0A]">
            {team.filter((m) => m.paymentType === 'piecework').length}
          </div>
          <div className="mt-1.5 text-xs text-[#525252]">
            Оплата по факту м² / этапов / выездов
          </div>
        </div>

        <div className="bg-white p-5">
          <div className="text-xs text-[#525252]">Лимит ФОТ по умолчанию (% от КП)</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="100"
              value={fotLimitInput}
              onChange={(e) => setFotLimitInput(e.target.value)}
              className="h-9 w-24 border border-[#0A0A0A] bg-white px-3 font-mono text-sm font-semibold tabular-nums text-[#0A0A0A] focus:outline-none"
            />
            <span className="font-mono text-sm text-[#525252]">%</span>
            <button
              type="button"
              onClick={saveFotLimit}
              className="flex h-9 items-center gap-1 bg-[#0A0A0A] px-3 text-xs font-medium text-white transition-colors hover:bg-[#262626]"
            >
              <Check className="h-3.5 w-3.5" />
              Применить
            </button>
          </div>
          <div className="mt-1.5 text-[11px] text-[#525252]">
            При превышении порога проект подсвечивается в рисках
          </div>
        </div>
      </div>

      {/* Add / Edit Position Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-[#0A0A0A] bg-white p-6"
        >
          <div className="flex items-center justify-between border-b border-[#D4D4D4] pb-3">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">
              {editingId ? 'Редактировать позицию команды' : 'Новая позиция / роль'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-[#525252] hover:text-[#0A0A0A]"
              aria-label="Закрыть форму"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[#6B6B68]">Должность / роль *</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="Например: Визуализатор 3D"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Код для Ганта</label>
              <input
                type="text"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ВИЗ"
                className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-sm uppercase text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Статья аналитики</label>
              <select
                value={costGroup}
                onChange={(e) =>
                  setCostGroup(e.target.value as Exclude<CostRoleGroup, 'Печать и логистика'>)
                }
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
              >
                {COST_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#6B6B68]">Тип оплаты</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
              >
                <option value="salary">Ежемесячный оклад</option>
                <option value="piecework">Сдельная (м² / этап)</option>
              </select>
            </div>

            {paymentType === 'salary' ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Оклад в месяц, ₽</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-sm tabular-nums text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-[#6B6B68]">
                    База распределения оклада между проектами
                  </label>
                  <select
                    value={allocationBasis}
                    onChange={(e) => setAllocationBasis(e.target.value as AllocationBasis)}
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  >
                    <option value="area">Пропорционально отработанным м² за месяц</option>
                    <option value="hours">Пропорционально отработанным часам за месяц</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Базовая ставка, ₽</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={pieceworkRate}
                    onChange={(e) => setPieceworkRate(e.target.value)}
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-3 font-mono text-sm tabular-nums text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#6B6B68]">Единица расчёта</label>
                  <select
                    value={pieceworkUnit}
                    onChange={(e) =>
                      setPieceworkUnit(e.target.value as 'м²' | 'этап' | 'выезд')
                    }
                    className="h-10 w-full border border-[#D4D4D0] bg-white px-2.5 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  >
                    <option value="м²">за м²</option>
                    <option value="этап">за этап</option>
                    <option value="выезд">за выезд</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-[#D4D4D4] pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[40px] border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="min-h-[40px] bg-[#0A0A0A] px-5 text-xs font-medium text-white hover:bg-[#262626]"
            >
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      )}

      {/* Team Directory Table */}
      <div className="overflow-x-auto border border-[#0A0A0A] bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#0A0A0A] bg-[#F4F4F4] text-[11px] font-medium text-[#525252]">
              <th className="px-5 py-3.5">Код</th>
              <th className="px-4 py-3.5">Должность / Роль</th>
              <th className="px-4 py-3.5">Статья затрат</th>
              <th className="px-4 py-3.5">Формат оплаты</th>
              <th className="px-4 py-3.5 text-right">Оклад / Ставка</th>
              <th className="px-5 py-3.5 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4D4D4]">
            {team.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-xs text-[#525252]">
                  Список должностей пуст. Добавьте первую позицию команды.
                </td>
              </tr>
            ) : (
              team.map((m) => (
                <tr key={m.id} className="hover:bg-[#F4F4F4]">
                  <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[#0A0A0A]">
                    {m.code}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-[#0A0A0A]">
                    {m.roleTitle}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-[#525252]">{m.costGroup}</td>
                  <td className="px-4 py-3.5 text-xs text-[#0A0A0A]">
                    {m.paymentType === 'salary'
                      ? `Оклад · деление по ${m.allocationBasis === 'area' ? 'м²' : 'часам'}`
                      : `Сдельная · за ${m.pieceworkUnit}`}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-[#0A0A0A]">
                    {m.paymentType === 'salary'
                      ? `${formatCurrency(m.monthlySalary)} / мес`
                      : `${formatCurrency(m.pieceworkRate)} / ${m.pieceworkUnit}`}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(m)}
                        className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                        aria-label="Редактировать"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMember(m)}
                        className="flex h-8 w-8 items-center justify-center border border-[#D4D4D4] bg-white text-[#525252] hover:border-[#DC2626] hover:text-[#DC2626]"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
};
