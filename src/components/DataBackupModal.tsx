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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2936]/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
    >
      <div className="bento-card w-full max-w-lg bg-white/95 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDF0F4] pb-4">
          <div>
            <h2 id="backup-modal-title" className="text-lg font-bold tracking-tight text-[#0F2936]">
              Данные и резервные копии
            </h2>
            <p className="mt-1 text-xs text-[#4C6D7C]">
              Все изменения синхронизируются в реальном времени (Supabase) и кэшируются локально
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#4C6D7C] transition-colors hover:bg-[#EEF8FA] hover:text-[#0F2936]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 border-b border-[#DDF0F4] pb-5">
          <div className="rounded-2xl border border-[#DDF0F4] bg-[#F4FBFD] p-3.5">
            <div className="text-xs text-[#4C6D7C]">Проекты</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F2936]">
              {data.projects.length}
            </div>
          </div>
          <div className="rounded-2xl border border-[#DDF0F4] bg-[#F4FBFD] p-3.5">
            <div className="text-xs text-[#4C6D7C]">Позиции команды</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F2936]">
              {data.team.length}
            </div>
          </div>
          <div className="rounded-2xl border border-[#DDF0F4] bg-[#F4FBFD] p-3.5">
            <div className="text-xs text-[#4C6D7C]">Записи журнала</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#0F2936]">
              {data.worklogs.length + data.expenses.length}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                exportDataToJson(data);
                onNotify('JSON-резервная копия сохранена');
              }}
              className="btn-pulse flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт JSON
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full border border-[#B5DFE8] bg-white px-4 py-2 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0284C9] hover:text-[#0284C9] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 text-[#0D9488]" />
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

          <div className="border-t border-[#DDF0F4] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0F2936]">
                  <span>Облачная синхронизация Supabase</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                      syncStatus === 'online' || syncStatus === 'syncing'
                        ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0D9488]'
                        : 'border-[#FDA4AF] bg-[#FFF1F2] text-[#E11D48]'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        syncStatus === 'online' || syncStatus === 'syncing'
                          ? 'bg-[#0D9488]'
                          : 'bg-[#E11D48]'
                      }`}
                    />
                    {syncStatus === 'online' || syncStatus === 'syncing' ? 'Онлайн' : 'Офлайн'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#4C6D7C]">
                  Задайте Project URL и Anon Key или проверьте соединение с базой
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupabaseSettings();
                }}
                className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#B5DFE8] bg-white px-3.5 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0284C9] hover:bg-[#F0F9FB] hover:text-[#0284C9] whitespace-nowrap"
              >
                <Settings2 className="h-3.5 w-3.5 text-[#0284C9]" />
                Настройки Supabase
              </button>
            </div>
          </div>

          <div className="border-t border-[#DDF0F4] pt-4">
            <div className="text-xs font-semibold text-[#0F2936]">Управление демо-данными</div>
            <p className="mt-1 text-xs leading-relaxed text-[#4C6D7C]">
              Вы можете очистить все проекты и журнал для работы с чистого листа (сохранив стандартный справочник ролей) или вернуть демонстрационный шаблон.
            </p>

            {!confirmClear ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border border-[#FDA4AF] bg-white px-4 py-2 text-xs font-semibold text-[#E11D48] transition-colors hover:bg-[#FFF1F2] whitespace-nowrap"
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
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full border border-[#B5DFE8] bg-white px-4 py-2 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0284C9] hover:text-[#0284C9] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Загрузить [ДЕМО] шаблон
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-[#FDA4AF] bg-[#FFF1F2] p-3.5">
                <p className="text-xs font-semibold text-[#E11D48]">
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
                    className="min-h-[36px] rounded-full bg-[#E11D48] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#BE123C]"
                  >
                    Да, начать с нуля
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[36px] rounded-full border border-[#B5DFE8] bg-white px-4 py-1.5 text-xs font-semibold text-[#0F2936] hover:border-[#0284C9]"
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
