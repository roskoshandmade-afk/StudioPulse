import React, { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Upload,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  clearCustomSupabaseConfig,
  getActiveSupabaseConfig,
  saveCustomSupabaseConfig,
  SupabaseConfigSource,
} from '../supabaseClient';
import {
  RealtimeStatus,
  SupabaseSyncError,
  SyncStatus,
  testSupabaseConnection,
} from '../utils/supabaseSync';

interface SupabaseSettingsModalProps {
  open: boolean;
  syncStatus: SyncStatus;
  realtimeStatus: RealtimeStatus;
  hasPendingChanges: boolean;
  pendingCount: number;
  localUpdatedAt: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  lastSyncError: SupabaseSyncError | null;
  onClose: () => void;
  onConfigApplied: () => void;
  onForcePushLocalToCloud: () => Promise<{ ok: boolean; error?: SupabaseSyncError }>;
  onNotify: (msg: string, type?: 'default' | 'error') => void;
}

function formatSyncTimestamp(ts: number | null): string {
  if (!ts || ts <= 0) return '—';
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  open,
  syncStatus,
  realtimeStatus,
  hasPendingChanges,
  pendingCount,
  localUpdatedAt,
  lastSyncedAt,
  isSyncing,
  lastSyncError,
  onClose,
  onConfigApplied,
  onForcePushLocalToCloud,
  onNotify,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [configSource, setConfigSource] = useState<SupabaseConfigSource>('unconfigured');
  const [testing, setTesting] = useState(false);
  const [forcePushing, setForcePushing] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const cfg = getActiveSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setTestResult(null);
    setShowKey(false);
  }, [open]);

  if (!open) return null;

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      setTestResult({
        ok: false,
        message: 'Заполните оба поля: Project URL и Anon Key.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(cleanUrl, cleanKey);
    setTesting(false);

    if (res.ok) {
      saveCustomSupabaseConfig(cleanUrl, cleanKey);
      setConfigSource('custom');
      setTestResult({
        ok: true,
        message: `Соединение установлено (${res.latencyMs} мс)`,
        detail: hasPendingChanges
          ? `В локальной очереди ${Math.max(1, pendingCount)} правок — выполняется приоритетная отправка в облако.`
          : res.rowExists
          ? 'Таблица studio_state доступна, данные синхронизируются.'
          : 'Таблица studio_state доступна, выполняется первичная запись состояния.',
      });
      onConfigApplied();
      onNotify(`Supabase подключён (${res.latencyMs} мс)`);
    } else {
      const codeTag = res.error?.code
        ? `[${res.error.code}]`
        : res.error?.status
        ? `[HTTP ${res.error.status}]`
        : '[ОШИБКА]';
      setTestResult({
        ok: false,
        message: `${codeTag} ${res.error?.humanHint || 'Не удалось подключиться'}`,
        detail: res.error?.message,
      });
    }
  };

  const handleForcePush = async () => {
    if (forcePushing || isSyncing) return;
    setForcePushing(true);
    setTestResult(null);

    const res = await onForcePushLocalToCloud();
    setForcePushing(false);

    if (res.ok) {
      setTestResult({
        ok: true,
        message: 'Локальные данные успешно отправлены в облако',
        detail: 'Строка public.studio_state (id = main) перезаписана текущим локальным состоянием. Очередь очищена.',
      });
    } else {
      const codeTag = res.error?.code
        ? `[${res.error.code}]`
        : res.error?.status
        ? `[HTTP ${res.error.status}]`
        : '[ОШИБКА]';
      setTestResult({
        ok: false,
        message: `${codeTag} ${res.error?.humanHint || 'Не удалось отправить данные в облако'}`,
        detail: res.error?.message,
      });
    }
  };

  const handleResetToBuildDefaults = () => {
    clearCustomSupabaseConfig();
    const cfg = getActiveSupabaseConfig();
    setUrl(cfg.url);
    setAnonKey(cfg.anonKey);
    setConfigSource(cfg.source);
    setTestResult(null);
    onConfigApplied();
    onNotify('Восстановлены настройки подключения из сборки');
  };

  const isSyncingState = isSyncing || syncStatus === 'syncing' || syncStatus === 'connecting';
  const isOfflineOrPending = !isSyncingState && (syncStatus === 'offline' || hasPendingChanges);
  const effectivePending = Math.max(pendingCount, hasPendingChanges ? 1 : 0);

  const statusLabel = isSyncingState
    ? 'Синхронизация...'
    : isOfflineOrPending
    ? effectivePending > 0
      ? `Офлайн (ожидают отправки: ${effectivePending})`
      : 'Офлайн (локальный режим)'
    : 'Онлайн';

  const statusColorClass = isSyncingState
    ? 'text-[#1D4ED8]'
    : isOfflineOrPending
    ? effectivePending > 0
      ? 'text-[#C2410C]'
      : 'text-[#DC2626]'
    : 'text-[#15803D]';

  const realtimeLabel =
    realtimeStatus === 'subscribed'
      ? 'Realtime активен'
      : realtimeStatus === 'connecting'
      ? 'Realtime подключается...'
      : realtimeStatus === 'error'
      ? 'Realtime недоступен (REST-синхронизация)'
      : 'Realtime не запущен';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supabase-settings-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto border border-[#0A0A0A] bg-white p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#0A0A0A] pb-4">
          <div>
            <h2
              id="supabase-settings-title"
              className="text-base font-semibold tracking-tight text-[#0A0A0A]"
            >
              Настройки подключения Supabase
            </h2>
            <p className="mt-1 text-xs text-[#525252]">
              Offline-First синхронизация через таблицу{' '}
              <code className="font-mono text-[#0A0A0A]">public.studio_state</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#525252] transition-colors hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Diagnostic Status Strip */}
        <div className="mt-4 border border-[#D4D4D4] bg-[#F4F4F4] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className={`flex items-center gap-2 font-semibold ${statusColorClass}`}>
              {isSyncingState ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#2563EB]" />
              ) : isOfflineOrPending ? (
                <WifiOff
                  className={`h-3.5 w-3.5 ${
                    effectivePending > 0 ? 'text-[#EA580C]' : 'text-[#DC2626]'
                  }`}
                />
              ) : (
                <Wifi className="h-3.5 w-3.5 text-[#15803D]" />
              )}
              <span>{statusLabel}</span>
            </div>
            <span className="font-mono text-[11px] text-[#525252]">
              {configSource === 'custom'
                ? 'Источник: браузер (sandbox)'
                : configSource === 'env'
                ? 'Источник: переменные окружения'
                : 'Не задано (нужны env или ручной ввод)'}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1 border-t border-[#D4D4D4] pt-2 text-[11px] text-[#525252] sm:grid-cols-2">
            <div>
              Канал: <span className="font-medium text-[#0A0A0A]">{realtimeLabel}</span>
            </div>
            <div className="font-mono tabular-nums sm:text-right">
              В очереди:{' '}
              <span
                className={`font-semibold ${
                  hasPendingChanges ? 'text-[#C2410C]' : 'text-[#15803D]'
                }`}
              >
                {hasPendingChanges ? effectivePending : 0}
              </span>
            </div>
            <div className="font-mono tabular-nums">
              Локально: {formatSyncTimestamp(localUpdatedAt)}
            </div>
            <div className="font-mono tabular-nums sm:text-right">
              В облаке: {formatSyncTimestamp(lastSyncedAt)}
            </div>
          </div>

          {hasPendingChanges && (
            <div className="mt-2.5 border border-[#EA580C] bg-[#FFF7ED] px-2.5 py-2 text-[11px] text-[#9A3412]">
              Защита от потери данных активна: пока локальные изменения ({effectivePending}) не
              отправлены в Supabase, входящие обновления из облака не перезапишут вашу работу.
            </div>
          )}

          {syncStatus === 'offline' && lastSyncError && (
            <div className="mt-3 border-t border-[#D4D4D4] pt-2.5 text-xs">
              <div className="font-semibold text-[#DC2626]">
                Причина:{' '}
                {lastSyncError.code
                  ? `[${lastSyncError.code}] `
                  : lastSyncError.status
                  ? `[HTTP ${lastSyncError.status}] `
                  : ''}
                {lastSyncError.humanHint}
              </div>
              <div className="mt-1 break-words font-mono text-[11px] text-[#525252]">
                {lastSyncError.message}
              </div>
            </div>
          )}
        </div>

        {/* Manual Conflict Resolution / Force Push Action */}
        <div className="mt-4 border border-[#0A0A0A] bg-white p-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-[#0A0A0A]">
                Ручная синхронизация и разрешение конфликтов
              </div>
              <p className="mt-0.5 text-[11px] text-[#525252]">
                Отправит текущее локальное состояние браузера в Supabase поверх облачной копии.
              </p>
            </div>
            <button
              type="button"
              onClick={handleForcePush}
              disabled={forcePushing || isSyncing || testing}
              className="flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 border border-[#0A0A0A] bg-[#0A0A0A] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#262626] disabled:opacity-50"
            >
              <Upload className={`h-3.5 w-3.5 ${forcePushing ? 'animate-pulse' : ''}`} />
              {forcePushing
                ? 'Отправка...'
                : 'Принудительно отправить локальные данные в облако'}
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleTestAndConnect} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="supabase-url-input"
              className="mb-1.5 block text-xs font-medium text-[#0A0A0A]"
            >
              Project URL
            </label>
            <input
              id="supabase-url-input"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="h-10 w-full border border-[#0A0A0A] bg-white px-3 font-mono text-xs text-[#0A0A0A] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="supabase-key-input"
              className="mb-1.5 block text-xs font-medium text-[#0A0A0A]"
            >
              Anon / Publishable Key
            </label>
            <div className="flex border border-[#0A0A0A] bg-white">
              <input
                id="supabase-key-input"
                type={showKey ? 'text' : 'password'}
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="sb_publishable_... или eyJhbGciOi..."
                className="h-10 flex-1 bg-transparent px-3 font-mono text-xs text-[#0A0A0A] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="flex h-10 w-10 items-center justify-center border-l border-[#D4D4D4] text-[#525252] hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
                title={showKey ? 'Скрыть ключ' : 'Показать ключ'}
                aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[#525252]">
              Используйте только публичный ключ (<code className="font-mono">anon / publishable</code>). Ключ сохраняется локально в вашем браузере.
            </p>
          </div>

          {testResult && (
            <div
              className={`border p-3 text-xs ${
                testResult.ok
                  ? 'border-[#15803D] bg-[#F0FDF4] text-[#15803D]'
                  : 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
              }`}
            >
              <div className="flex items-start gap-2 font-semibold">
                {testResult.ok ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
              {testResult.detail && (
                <div className="mt-1 break-words font-mono text-[11px] opacity-90">
                  {testResult.detail}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D4D4D4] pt-4">
            {configSource === 'custom' ? (
              <button
                type="button"
                onClick={handleResetToBuildDefaults}
                className="flex min-h-[38px] items-center gap-1.5 border border-[#D4D4D4] bg-white px-3 text-xs font-medium text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Сбросить к сборке
              </button>
            ) : (
              <span className="text-[11px] text-[#525252]">
                Подробный лог ошибок — в Console (F12)
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] border border-[#0A0A0A] bg-white px-4 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
              >
                Закрыть
              </button>
              <button
                type="submit"
                disabled={testing || forcePushing}
                className="flex min-h-[38px] items-center gap-1.5 bg-[#0A0A0A] px-4 text-xs font-semibold text-white hover:bg-[#262626] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                {testing ? 'Проверка...' : 'Проверить и подключить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
