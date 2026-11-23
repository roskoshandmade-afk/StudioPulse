import React, { useMemo, useState } from 'react';
import { ExternalLink, FileDown, FileText, FolderOpen, Ruler } from 'lucide-react';
import { Project } from '../types';
import { ClientSnapshot } from '../utils/storage';
import { SyncStatus } from '../utils/supabaseSync';
import { SyncIndicator } from './Header';
import {
  formatCurrency,
  formatDate,
  formatShortDate,
} from '../utils/calculations';

interface ClientViewProps {
  project: Project | ClientSnapshot | null;
  allProjects?: Project[];
  isLockedClient: boolean;
  syncStatus?: SyncStatus;
  onSelectPreviewProject?: (projectId: string) => void;
  onExportPdf?: (project: Project | ClientSnapshot) => Promise<void>;
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export const ClientView: React.FC<ClientViewProps> = ({
  project,
  allProjects = [],
  isLockedClient,
  syncStatus,
  onSelectPreviewProject,
  onExportPdf,
}) => {
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdfClick = async () => {
    if (!project || !onExportPdf || exportingPdf) return;
    setExportingPdf(true);
    try {
      await onExportPdf(project);
    } finally {
      setExportingPdf(false);
    }
  };

  const financials = useMemo(() => {
    if (!project) return { total: 0, paid: 0, remaining: 0, paidPct: 0 };
    const total = project.paymentStages.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const paid = project.paymentStages
      .filter((s) => s.isPaid)
      .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const remaining = Math.max(0, total - paid);
    const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, remaining, paidPct };
  }, [project]);

  const overallProgress = useMemo(() => {
    if (!project || !project.workStages.length) return 0;
    const sum = project.workStages.reduce((acc, ws) => acc + (ws.progress || 0), 0);
    return Math.round(sum / project.workStages.length);
  }, [project]);

  const groupedWork = useMemo(() => {
    if (!project) return [];
    return project.paymentStages.map((ps) => {
      const tasks = project.workStages.filter((ws) => ws.paymentStageId === ps.id);
      const avg = tasks.length
        ? Math.round(tasks.reduce((a, t) => a + (t.progress || 0), 0) / tasks.length)
        : 0;
      return {
        stage: ps,
        tasks,
        progress: avg,
      };
    });
  }, [project]);

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      {/* Minimal locked client top line (no role switcher, no other projects) */}
      {isLockedClient && (
        <header className="border-b border-[#0A0A0A] bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3.5">
              <span className="text-sm font-bold tracking-[0.18em] text-[#0A0A0A]">
                LIMUR STUDIO
              </span>
              <span
                className="inline-flex items-center border border-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tracking-[0.08em] text-[#B45309] whitespace-nowrap shrink-0 select-none"
                title="Изолированная тестовая копия (Sandbox / Dev)"
              >
                КОПИЯ / DEV
              </span>
              {syncStatus && (
                <>
                  <span className="h-3.5 w-px bg-[#D4D4D4]" aria-hidden="true" />
                  <SyncIndicator status={syncStatus} />
                </>
              )}
            </div>
            <span className="text-xs font-medium text-[#525252]">Кабинет проекта</span>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Preview Project Selector (only when testing via Role Switcher, NEVER in locked client URL) */}
        {!isLockedClient && allProjects.length > 1 && onSelectPreviewProject && project && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#0A0A0A] bg-[#F4F4F4] px-4 py-3 text-xs">
            <span className="font-medium text-[#525252]">Предпросмотр экрана клиента для объекта:</span>
            <select
              value={project.id}
              onChange={(e) => onSelectPreviewProject(e.target.value)}
              className="h-8 border border-[#0A0A0A] bg-white px-2.5 text-xs font-semibold text-[#0A0A0A]"
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!project ? (
          <div className="border border-[#0A0A0A] bg-white px-6 py-16 text-center">
            <h1 className="text-lg font-bold text-[#0A0A0A]">Проект не найден</h1>
            <p className="mt-2 text-xs text-[#525252]">
              Проверьте корректность ссылки или обратитесь в студию для получения актуальной ссылки на объект.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Project Hero Header */}
            <section className="border border-[#0A0A0A] border-t-4 border-t-[#0A0A0A] bg-white p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#525252]">
                    <span className="font-semibold text-[#0A0A0A]">{project.status}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold tabular-nums text-[#0A0A0A]">
                      {project.areaSqm} м²
                    </span>
                    {project.address && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{project.address}</span>
                      </>
                    )}
                  </div>

                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-[#0A0A0A] sm:text-4xl [text-wrap:balance]">
                    {project.name}
                  </h1>
                </div>

                {onExportPdf && (
                  <button
                    type="button"
                    disabled={exportingPdf}
                    onClick={handleExportPdfClick}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 self-start bg-[#0A0A0A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#262626] disabled:opacity-60 whitespace-nowrap"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {exportingPdf ? 'Формирование PDF...' : 'Скачать PDF-отчёт'}
                  </button>
                )}
              </div>

              {/* Overall Readiness Bar */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#525252]">Общая готовность дизайн-проекта</span>
                  <span className="font-mono text-base font-bold tabular-nums text-[#0A0A0A]">
                    {overallProgress}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full bg-[#F4F4F4]">
                  <div
                    className={`h-full ${overallProgress === 100 ? 'bg-[#15803D]' : 'bg-[#0A0A0A]'}`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Quick Material & Document Links */}
              <div className="mt-7 grid grid-cols-1 gap-3 border-t border-[#D4D4D4] pt-6 sm:grid-cols-3">
                {project.links.proposalUrl ? (
                  <a
                    href={normalizeUrl(project.links.proposalUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between bg-[#0A0A0A] px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#262626]"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0" />
                      Коммерческое предложение
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-75" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex min-h-[48px] cursor-not-allowed items-center justify-between border border-dashed border-[#D4D4D4] bg-[#F4F4F4] px-4 py-3 text-left text-xs text-[#737373] opacity-75"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 shrink-0" />
                      <span>
                        <span className="block font-medium text-[#525252]">
                          Коммерческое предложение
                        </span>
                        <span className="block text-[10px] text-[#737373]">Документ готовится</span>
                      </span>
                    </span>
                  </button>
                )}

                {project.links.measurementUrl ? (
                  <a
                    href={normalizeUrl(project.links.measurementUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between border border-[#0A0A0A] bg-white px-4 py-3 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <Ruler className="h-4 w-4 shrink-0" />
                      Обмерный план
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex min-h-[48px] cursor-not-allowed items-center justify-between border border-dashed border-[#D4D4D4] bg-[#F4F4F4] px-4 py-3 text-left text-xs text-[#737373] opacity-75"
                  >
                    <span className="flex items-center gap-2.5">
                      <Ruler className="h-4 w-4 shrink-0" />
                      <span>
                        <span className="block font-medium text-[#525252]">Обмерный план</span>
                        <span className="block text-[10px] text-[#737373]">Документ готовится</span>
                      </span>
                    </span>
                  </button>
                )}

                {project.links.folderUrl ? (
                  <a
                    href={normalizeUrl(project.links.folderUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[48px] items-center justify-between border border-[#0A0A0A] bg-white px-4 py-3 text-xs font-semibold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      Папка с материалами
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="flex min-h-[48px] cursor-not-allowed items-center justify-between border border-dashed border-[#D4D4D4] bg-[#F4F4F4] px-4 py-3 text-left text-xs text-[#737373] opacity-75"
                  >
                    <span className="flex items-center gap-2.5">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span>
                        <span className="block font-medium text-[#525252]">
                          Папка с материалами
                        </span>
                        <span className="block text-[10px] text-[#737373]">Документ готовится</span>
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </section>

            {/* Transparent Payment Schedule with Inverse #0A0A0A Summary Bar */}
            <section className="border border-[#0A0A0A] bg-white">
              <div className="border-b border-[#0A0A0A] px-6 py-5">
                <h2 className="text-base font-bold tracking-tight text-[#0A0A0A]">
                  График платежей по КП
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-px border-b border-[#0A0A0A] bg-[#262626] sm:grid-cols-3">
                <div className="bg-[#0A0A0A] px-6 py-5 text-white">
                  <div className="text-xs text-[#A3A3A3]">Стоимость проекта</div>
                  <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-white">
                    {formatCurrency(financials.total)}
                  </div>
                </div>
                <div className="bg-[#0A0A0A] px-6 py-5 text-white">
                  <div className="text-xs text-[#A3A3A3]">Оплачено ({financials.paidPct}%)</div>
                  <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-[#4ADE80]">
                    {formatCurrency(financials.paid)}
                  </div>
                </div>
                <div className="bg-[#0A0A0A] px-6 py-5 text-white">
                  <div className="text-xs text-[#A3A3A3]">Остаток к оплате</div>
                  <div
                    className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${
                      financials.remaining > 0 ? 'text-[#F87171]' : 'text-[#4ADE80]'
                    }`}
                  >
                    {formatCurrency(financials.remaining)}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#D4D4D4]">
                {project.paymentStages.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex flex-col justify-between gap-2 px-6 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#0A0A0A]">{ps.title}</div>
                      <div className="mt-0.5 font-mono text-xs tabular-nums text-[#525252]">
                        {ps.isPaid
                          ? `Оплачено ${formatDate(ps.paidDate)}`
                          : `Плановый срок: ${formatDate(ps.dueDate)}`}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      <span className="font-mono text-sm font-bold tabular-nums text-[#0A0A0A]">
                        {formatCurrency(ps.amount)}
                      </span>
                      <span
                        className={`w-24 text-right text-xs font-bold ${
                          ps.isPaid ? 'text-[#15803D]' : 'text-[#DC2626]'
                        }`}
                      >
                        {ps.isPaid ? 'Оплачено' : 'Ожидается'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Simplified Work Progress & Timeline (No Internal Notes or Staff Info) */}
            <section className="border border-[#0A0A0A] bg-white">
              <div className="border-b border-[#0A0A0A] px-6 py-5">
                <h2 className="text-base font-bold tracking-tight text-[#0A0A0A]">
                  Этапы работ и график выполнения
                </h2>
              </div>

              <div className="divide-y divide-[#D4D4D4]">
                {groupedWork.map(({ stage, tasks, progress }) => (
                  <div key={stage.id} className="p-6">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="text-sm font-bold text-[#0A0A0A]">{stage.title}</h3>
                      <span className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
                        Готовность этапа: {progress}%
                      </span>
                    </div>

                    {tasks.length === 0 ? (
                      <p className="mt-3 text-xs text-[#737373]">Подэтапы формируются.</p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {tasks.map((task) => {
                          const statusText =
                            task.progress === 100
                              ? 'Выполнено'
                              : task.delayReason === 'client'
                              ? 'Ожидаем обратную связь'
                              : task.progress > 0
                              ? 'В работе'
                              : 'Запланировано';

                          const statusColor =
                            task.progress === 100
                              ? 'text-[#15803D]'
                              : task.delayReason === 'client'
                              ? 'text-[#D97706]'
                              : 'text-[#525252]';

                          return (
                            <div key={task.id} className="space-y-1.5">
                              <div className="flex flex-col justify-between gap-1 text-xs sm:flex-row sm:items-center">
                                <span className="font-semibold text-[#0A0A0A]">{task.title}</span>
                                <div className="flex items-center gap-2.5 text-[11px]">
                                  <span className="font-mono tabular-nums text-[#525252]">
                                    {formatShortDate(task.planStart)} — {formatShortDate(task.planEnd)}
                                  </span>
                                  <span className="text-[#D4D4D4]">·</span>
                                  <span className={`font-semibold ${statusColor}`}>{statusText}</span>
                                  <span className="font-mono font-bold tabular-nums text-[#0A0A0A]">
                                    {task.progress}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-[#F4F4F4]">
                                <div
                                  className={`h-full ${
                                    task.progress === 100
                                      ? 'bg-[#15803D]'
                                      : task.delayReason === 'client'
                                      ? 'bg-[#D97706]'
                                      : 'bg-[#0A0A0A]'
                                  }`}
                                  style={{ width: `${task.progress}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
