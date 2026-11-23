import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LogoPulse } from './components/LogoPulse';
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
        <div className="flex min-h-screen items-center justify-center p-6 text-[#0F2936]">
          <div className="bento-card w-full max-w-md p-6">
            <LogoPulse />
            <h1 className="mt-5 text-lg font-bold text-[#0F2936]">Ошибка отображения</h1>
            <p className="mt-2 text-xs leading-relaxed text-[#4C6D7C]">
              {this.state.message}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-pulse rounded-full px-4 py-2 text-xs font-semibold"
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
                className="rounded-full border border-[#C5E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2936] transition-colors hover:border-[#0D9488] hover:bg-[#F0FDFA]"
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
