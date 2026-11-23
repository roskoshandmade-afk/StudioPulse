import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { STORAGE_KEY, SYNC_META_KEY } from './utils/storage';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Непредвиденная ошибка интерфейса',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-white p-6 text-[#0A0A0A]">
          <div className="w-full max-w-md border border-[#0A0A0A] bg-white p-6">
            <div className="text-xs font-semibold tracking-[0.14em] text-[#0A0A0A]">
              LIMUR STUDIO OS
            </div>
            <h1 className="mt-3 text-lg font-semibold">Ошибка отображения</h1>
            <p className="mt-2 text-xs leading-relaxed text-[#525252]">
              {this.state.message}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-white"
              >
                Перезагрузить
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                    localStorage.removeItem(SYNC_META_KEY);
                  } catch {
                    // ignore
                  }
                  window.location.reload();
                }}
                className="border border-[#0A0A0A] bg-white px-4 py-2 text-xs font-medium text-[#0A0A0A]"
              >
                Сбросить локальный кэш
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
