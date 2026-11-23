import React from 'react';
import { Check, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
  type?: 'default' | 'error';
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-2xl border px-4 py-3 text-white shadow-lg backdrop-blur-md ${
        toast.type === 'error'
          ? 'border-[#FDA4AF]/40 bg-[#9F1239]/95'
          : 'border-[#5EEAD4]/30 bg-[#0F2936]/95'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs font-medium leading-snug">
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#FDA4AF]" />
          ) : (
            <Check className="h-4 w-4 shrink-0 text-[#2DD4BF]" />
          )}
          <span>{toast.text}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Скрыть уведомление"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
