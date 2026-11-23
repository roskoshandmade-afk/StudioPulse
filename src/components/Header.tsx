import React, { useState } from 'react';
import { Menu, X, Database } from 'lucide-react';
import { UserRole } from '../types';
import { SyncStatus } from '../utils/supabaseSync';
import { LogoPulse } from './LogoPulse';

export type WorkspaceTab = 'projects' | 'proposals' | 'worklog' | 'team';

interface HeaderProps {
  role: UserRole;
  activeTab: WorkspaceTab;
  selectedProjectName?: string;
  canCopyClientLink?: boolean;
  syncStatus: SyncStatus;
  hasPendingChanges?: boolean;
  pendingCount?: number;
  syncErrorHint?: string;
  onRoleChange: (role: UserRole) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onOpenNewProject?: () => void;
  onCopyClientLink?: () => void;
  onOpenBackup: () => void;
  onOpenSupabaseSettings: () => void;
  onGoHome: () => void;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'director', label: 'Руководитель' },
  { value: 'assistant', label: 'Помощник' },
  { value: 'client', label: 'Клиент' },
];

export const SyncIndicator: React.FC<{
  status: SyncStatus;
  hasPendingChanges?: boolean;
  pendingCount?: number;
  errorHint?: string;
  onClick?: () => void;
}> = ({ status, hasPendingChanges = false, pendingCount = 0, errorHint, onClick }) => {
  const isSyncingState = status === 'syncing' || status === 'connecting';
  const isOfflineOrPending = !isSyncingState && (status === 'offline' || hasPendingChanges);
  const effectivePending = Math.max(pendingCount, hasPendingChanges ? 1 : 0);

  const dotClass = isSyncingState
    ? 'bg-[#0284C7] animate-pulse'
    : isOfflineOrPending
    ? effectivePending > 0
      ? 'bg-[#D97706]'
      : 'bg-[#E11D48]'
    : 'bg-[#0D9488]';

  const buttonClass = isSyncingState
    ? 'border-[#0284C7]/25 bg-[#F0F9FF]/90 text-[#0284C7] hover:bg-[#0284C7] hover:text-white'
    : isOfflineOrPending
    ? effectivePending > 0
      ? 'border-[#D97706]/30 bg-amber-50/85 text-[#B45309] hover:bg-[#D97706] hover:text-white'
      : 'border-rose-300/60 bg-rose-50/85 text-[#E11D48] hover:bg-[#E11D48] hover:text-white'
    : 'border-[#0EA5E9]/20 bg-white/80 text-[#0F766E] hover:border-[#0D9488]/40 hover:bg-[#F0FDFA]';

  const title = isSyncingState
    ? effectivePending > 0
      ? `Отправка офлайн-изменений (${effectivePending}) в Supabase...`
      : 'Синхронизация данных с Supabase...'
    : isOfflineOrPending
    ? effectivePending > 0
      ? `Офлайн: ${effectivePending} несинхронизированных правок сохранены локально и отправятся при восстановлении сети. ${errorHint || ''}`
      : `${errorHint || 'Нет связи с Supabase, изменения сохраняются локально'} · Нажмите для настройки`
    : 'Онлайн · Все изменения синхронизированы с Supabase · Нажмите для настроек';

  const renderLabel = () => {
    if (isSyncingState) {
      return <span>Синхронизация...</span>;
    }
    if (isOfflineOrPending) {
      if (effectivePending > 0) {
        return <span>Офлайн ({effectivePending})</span>;
      }
      return <span>Офлайн</span>;
    }
    return <span>Онлайн</span>;
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-xs transition-colors whitespace-nowrap shrink-0 sm:px-3 ${buttonClass}`}
        title={title}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
        {renderLabel()}
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#0EA5E9]/20 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[#4C6D7C] backdrop-blur-xs whitespace-nowrap shrink-0 sm:px-3"
      title={title}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {renderLabel()}
    </span>
  );
};

export const Header: React.FC<HeaderProps> = ({
  role,
  activeTab,
  syncStatus,
  hasPendingChanges = false,
  pendingCount = 0,
  syncErrorHint,
  onRoleChange,
  onTabChange,
  onOpenBackup,
  onOpenSupabaseSettings,
  onGoHome,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 w-full overflow-x-clip border-b border-[#0EA5E9]/14 bg-white/82 backdrop-blur-md shadow-[0_8px_28px_-12px_rgba(15,76,92,0.08)]">
      {/* Primary Top Bar */}
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 xl:gap-4 xl:px-8">
        {/* Zone 1: Brand Logo + Live Sync Status */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5 xl:gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center transition-opacity hover:opacity-85 shrink-0"
            aria-label="Студия Пульс — на главную"
          >
            <LogoPulse />
          </button>

          <SyncIndicator
            status={syncStatus}
            hasPendingChanges={hasPendingChanges}
            pendingCount={pendingCount}
            errorHint={syncErrorHint}
            onClick={role !== 'client' ? onOpenSupabaseSettings : undefined}
          />
        </div>

        {/* Zone 2: Single Desktop Navigation (strictly visible on lg+ only) */}
        {role !== 'client' ? (
          <nav
            aria-label="Основная навигация"
            className="hidden min-w-0 items-center gap-0.5 rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC]/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:flex xl:gap-1"
          >
            <button
              type="button"
              onClick={() => onTabChange('projects')}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap shrink-0 xl:px-3 xl:text-xs ${
                activeTab === 'projects'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#4C6D7C] hover:bg-white/85 hover:text-[#0F2936]'
              }`}
            >
              Пульс студии
            </button>
            <button
              type="button"
              onClick={() => onTabChange('proposals')}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap shrink-0 xl:px-3 xl:text-xs ${
                activeTab === 'proposals'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#4C6D7C] hover:bg-white/85 hover:text-[#0F2936]'
              }`}
            >
              Конструктор КП
            </button>
            <button
              type="button"
              onClick={() => onTabChange('worklog')}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap shrink-0 xl:px-3 xl:text-xs ${
                activeTab === 'worklog'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#4C6D7C] hover:bg-white/85 hover:text-[#0F2936]'
              }`}
            >
              Журнал и расходы
            </button>
            <button
              type="button"
              onClick={() => onTabChange('team')}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap shrink-0 xl:px-3 xl:text-xs ${
                activeTab === 'team'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#4C6D7C] hover:bg-white/85 hover:text-[#0F2936]'
              }`}
            >
              Команда и ФОТ
            </button>
            <button
              type="button"
              onClick={onOpenBackup}
              className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-[#4C6D7C] transition-colors hover:bg-white/85 hover:text-[#0F2936] whitespace-nowrap shrink-0 xl:px-3 xl:text-xs"
            >
              Резервная копия
            </button>
          </nav>
        ) : (
          <div className="hidden rounded-full border border-[#0EA5E9]/18 bg-[#F2FAFC]/90 px-4 py-1.5 text-xs font-medium text-[#4C6D7C] whitespace-nowrap lg:block">
            Режим предпросмотра для клиента
          </div>
        )}

        {/* Zone 3: Role Switcher (Tablet & Desktop md+) */}
        <div className="hidden items-center md:flex shrink-0">
          <div
            className="flex items-center rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC]/90 p-0.5"
            role="group"
            aria-label="Переключатель режима роли"
          >
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRoleChange(opt.value)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] transition-all whitespace-nowrap shrink-0 xl:px-3 xl:text-xs ${
                  role === opt.value
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:text-[#0F2936]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Menu Trigger (< md) */}
        <div className="flex items-center md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#0EA5E9]/20 bg-white/90 text-[#0F2936] transition-colors hover:border-[#0D9488]/45 hover:bg-[#F0FDFA]"
            aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" strokeWidth={1.6} />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.6} />
            )}
          </button>
        </div>
      </div>

      {/* Tablet Secondary Nav Strip (strictly hidden on lg+ and < md) */}
      <div className="hidden border-t border-[#0EA5E9]/10 bg-white/60 px-6 py-2 md:flex lg:hidden">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-center">
          {role !== 'client' ? (
            <nav
              aria-label="Навигация по разделам"
              className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC]/90 p-1"
            >
              <button
                type="button"
                onClick={() => onTabChange('projects')}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-all whitespace-nowrap ${
                  activeTab === 'projects'
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                }`}
              >
                Пульс студии
              </button>
              <button
                type="button"
                onClick={() => onTabChange('proposals')}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-all whitespace-nowrap ${
                  activeTab === 'proposals'
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                }`}
              >
                Конструктор КП
              </button>
              <button
                type="button"
                onClick={() => onTabChange('worklog')}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-all whitespace-nowrap ${
                  activeTab === 'worklog'
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                }`}
              >
                Журнал и расходы
              </button>
              <button
                type="button"
                onClick={() => onTabChange('team')}
                className={`rounded-full px-3.5 py-1.5 text-xs transition-all whitespace-nowrap ${
                  activeTab === 'team'
                    ? 'btn-pulse font-semibold'
                    : 'font-medium text-[#4C6D7C] hover:bg-white hover:text-[#0F2936]'
                }`}
              >
                Команда и ФОТ
              </button>
              <button
                type="button"
                onClick={onOpenBackup}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-[#4C6D7C] transition-colors hover:bg-white hover:text-[#0F2936] whitespace-nowrap"
              >
                Резервная копия
              </button>
            </nav>
          ) : (
            <div className="rounded-full border border-[#0EA5E9]/18 bg-[#F2FAFC]/90 px-4 py-1 text-xs font-medium text-[#4C6D7C] whitespace-nowrap">
              Режим предпросмотра для клиента
            </div>
          )}
        </div>
      </div>

      {/* Mobile Dropdown Drawer (strictly hidden on md+) */}
      {mobileMenuOpen && (
        <div className="border-t border-[#0EA5E9]/14 bg-white/95 px-4 py-4 backdrop-blur-md md:hidden">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-[#4C6D7C]">Режим просмотра</div>
              <div
                className="grid grid-cols-3 gap-1 rounded-full border border-[#0EA5E9]/16 bg-[#F2FAFC] p-1"
                role="group"
                aria-label="Переключатель режима роли"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onRoleChange(opt.value);
                      setMobileMenuOpen(false);
                    }}
                    className={`rounded-full py-2 text-xs transition-all ${
                      role === opt.value ? 'btn-pulse font-semibold' : 'font-medium text-[#4C6D7C]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {role !== 'client' && (
              <nav
                aria-label="Мобильная навигация"
                className="grid grid-cols-1 gap-1.5 border-t border-[#0EA5E9]/12 pt-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('projects');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between rounded-2xl px-3.5 text-left text-sm ${
                    activeTab === 'projects'
                      ? 'btn-pulse font-semibold'
                      : 'font-medium text-[#0F2936] hover:bg-[#F2FAFC]'
                  }`}
                >
                  Пульс студии
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('proposals');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between rounded-2xl px-3.5 text-left text-sm ${
                    activeTab === 'proposals'
                      ? 'btn-pulse font-semibold'
                      : 'font-medium text-[#0F2936] hover:bg-[#F2FAFC]'
                  }`}
                >
                  Конструктор КП
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('worklog');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between rounded-2xl px-3.5 text-left text-sm ${
                    activeTab === 'worklog'
                      ? 'btn-pulse font-semibold'
                      : 'font-medium text-[#0F2936] hover:bg-[#F2FAFC]'
                  }`}
                >
                  Журнал и расходы
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onTabChange('team');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex min-h-[40px] items-center justify-between rounded-2xl px-3.5 text-left text-sm ${
                    activeTab === 'team'
                      ? 'btn-pulse font-semibold'
                      : 'font-medium text-[#0F2936] hover:bg-[#F2FAFC]'
                  }`}
                >
                  Команда и ФОТ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenBackup();
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-[40px] items-center gap-2 rounded-2xl px-3.5 text-left text-sm font-medium text-[#0F2936] hover:bg-[#F2FAFC]"
                >
                  <Database className="h-4 w-4 text-[#0D9488]" strokeWidth={1.6} />
                  Резервная копия
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
