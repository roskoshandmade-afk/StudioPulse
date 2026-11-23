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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md border border-[#0A0A0A] bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 id="confirm-dialog-title" className="text-base font-semibold tracking-tight text-[#0A0A0A]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#525252] transition-colors hover:bg-[#F4F4F4] hover:text-[#0A0A0A]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#525252]">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#D4D4D4] pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A] transition-colors hover:bg-[#F4F4F4] whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[40px] px-4 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 ${
              danger ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#0A0A0A] hover:bg-[#262626]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
