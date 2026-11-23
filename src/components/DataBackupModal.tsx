import React, { useRef, useState } from 'react';
import { Download, Upload, Trash2, RotateCcw, X, Settings2 } from 'lucide-react';
import { AppData } from '../types';
import { exportDataToJson, parseImportedJson } from '../utils/storage';
import { SyncStatus } from '../utils/supabaseSync';

interface DataBackupModalProps {
  open: boolean;
  data: AppData;
  syncStatus: SyncStatus;
  onClose: () => void;
  onOpenSupabaseSettings: () => void;
  onImport: (imported: AppData) => void;
  onResetEmpty: () => void;
  onRestoreDemo: () => void;
  onNotify: (msg: string, type?: 'default' | 'error') => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  open,
  data,
  syncStatus,
  onClose,
  onOpenSupabaseSettings,
  onImport,
  onResetEmpty,
  onRestoreDemo,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedJson(text);
      if (!result.ok) {
        onNotify(result.error, 'error');
        return;
      }
      onImport(result.data);
      onNotify(`Резервная копия загружена: ${result.data.projects.length} пр.`);
      onClose();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="w-full max-w-lg border border-[#0A0A0A] bg-white p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#0A0A0A] pb-4">
          <div>
            <h2 id="backup-modal-title" className="text-lg font-semibold tracking-tight text-[#0A0A0A]">
              Данные и резервные копии
            </h2>
            <p className="mt-1 text-xs text-[#525252]">
              Все изменения синхронизируются в реальном времени (Supabase) и кэшируются локально
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[#525252] transition-colors hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4 border-b border-[#D4D4D4] pb-5">
          <div>
            <div className="text-xs text-[#525252]">Проекты</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0A0A0A]">
              {data.projects.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#525252]">Позиции команды</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0A0A0A]">
              {data.team.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#525252]">Записи журнала</div>
            <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#0A0A0A]">
              {data.worklogs.length + data.expenses.length}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                exportDataToJson(data);
                onNotify('JSON-резервная копия сохранена');
              }}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-2 bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#262626] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт JSON
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-2 border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#F4F4F4] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              Импорт JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="border-t border-[#D4D4D4] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-[#0A0A0A]">
                  <span>Облачная синхронизация Supabase</span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                      syncStatus === 'online' || syncStatus === 'syncing'
                        ? 'text-[#15803D]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 ${
                        syncStatus === 'online' || syncStatus === 'syncing'
                          ? 'bg-[#15803D]'
                          : 'bg-[#DC2626]'
                      }`}
                    />
                    {syncStatus === 'online' || syncStatus === 'syncing' ? 'Онлайн' : 'Офлайн'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#525252]">
                  Задайте Project URL и Anon Key или проверьте соединение с базой
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupabaseSettings();
                }}
                className="flex min-h-[36px] items-center gap-1.5 border border-[#0A0A0A] bg-white px-3 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white whitespace-nowrap"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Настройки Supabase
              </button>
            </div>
          </div>

          <div className="border-t border-[#D4D4D4] pt-4">
            <div className="text-xs font-medium text-[#0A0A0A]">Управление демо-данными</div>
            <p className="mt-1 text-xs leading-relaxed text-[#525252]">
              Вы можете очистить все проекты и журнал для работы с чистого листа (сохранив стандартный справочник ролей) или вернуть демонстрационный шаблон.
            </p>

            {!confirmClear ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 border border-[#DC2626] bg-white px-4 py-2 text-xs font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Очистить демо / Начать с нуля
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRestoreDemo();
                    onNotify('Загружен демонстрационный шаблон');
                    onClose();
                  }}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#F4F4F4] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Загрузить [ДЕМО] шаблон
                </button>
              </div>
            ) : (
              <div className="mt-3 border border-[#DC2626] bg-[#FEF2F2] p-3">
                <p className="text-xs font-medium text-[#DC2626]">
                  Удалить все текущие проекты, записи выработки и чеки?
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetEmpty();
                      setConfirmClear(false);
                      onNotify('Все данные очищены. Можно создавать проекты с нуля');
                      onClose();
                    }}
                    className="min-h-[36px] bg-[#DC2626] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B91C1C]"
                  >
                    Да, начать с нуля
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[36px] border border-[#0A0A0A] bg-white px-3 py-1.5 text-xs font-medium text-[#0A0A0A] hover:bg-[#F4F4F4]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
