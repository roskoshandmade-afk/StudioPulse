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
    <div className="fixed right-4 bottom-4 z-50 max-w-sm border border-[#0A0A0A] bg-[#0A0A0A] px-4 py-3 text-white">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-xs font-medium leading-snug">
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626]" />
          ) : (
            <Check className="h-4 w-4 shrink-0 text-[#4ADE80]" />
          )}
          <span>{toast.text}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-neutral-400 transition-colors hover:text-white"
          aria-label="Скрыть уведомление"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
