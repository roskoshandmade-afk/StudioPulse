import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2936]/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bento-card w-full max-w-md bg-white/95 p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 id="confirm-dialog-title" className="text-base font-bold tracking-tight text-[#0F2936]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4C6D7C] transition-colors hover:bg-[#EEF8FA] hover:text-[#0F2936]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#4C6D7C]">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-[#DDF0F4] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] rounded-full border border-[#B5DFE8] bg-white px-5 py-2 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0284C9] hover:text-[#0284C9] whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[40px] rounded-full px-5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${
              danger ? 'bg-[#E11D48] hover:bg-[#BE123C]' : 'btn-pulse'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
