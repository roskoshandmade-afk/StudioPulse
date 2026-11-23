import React, { useMemo, useState } from 'react';
import { ExternalLink, FileDown, FileText, FolderOpen, Ruler } from 'lucide-react';
import { Project } from '../types';
import { ClientSnapshot } from '../utils/storage';
import { SyncStatus } from '../utils/supabaseSync';
import { SyncIndicator } from './Header';
import { LogoPulse } from './LogoPulse';
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
    <div className="min-h-screen text-[#0F2936]">
      {/* Minimal locked client top line (no role switcher, no other projects) */}
      {isLockedClient && (
        <header className="sticky top-0 z-30 w-full overflow-x-clip border-b border-[#0EA5E9]/14 bg-white/82 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoPulse compact showSubtitle={false} />
              {syncStatus && (
                <>
                  <span className="h-4 w-px bg-[#0EA5E9]/18 shrink-0" aria-hidden="true" />
                  <SyncIndicator status={syncStatus} />
                </>
              )}
            </div>
            <span className="hidden rounded-full border border-[#0EA5E9]/18 bg-[#F0F9FF]/85 px-3 py-1 text-xs font-medium text-[#0284C7] whitespace-nowrap shrink-0 sm:inline-flex">
              Кабинет проекта
            </span>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Preview Project Selector (only when testing via Role Switcher, NEVER in locked client URL) */}
        {!isLockedClient && allProjects.length > 1 && onSelectPreviewProject && project && (
          <div className="bento-card mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs">
            <span className="font-medium text-[#4C6D7C]">Предпросмотр экрана клиента для объекта:</span>
            <select
              value={project.id}
              onChange={(e) => onSelectPreviewProject(e.target.value)}
              className="h-9 rounded-full border border-[#B5DFE8] bg-white px-4 text-xs font-semibold text-[#0F2936] focus:border-[#0284C9] focus:outline-none"
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
          <div className="bento-card px-6 py-16 text-center">
            <h1 className="text-lg font-bold text-[#0F2936]">Проект не найден</h1>
            <p className="mt-2 text-xs text-[#4C6D7C]">
              Проверьте корректность ссылки или обратитесь в «Студию Пульс» для получения актуальной ссылки на объект.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Project Hero Header */}
            <section className="bento-card overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#547585]">
                      <span className="rounded-full border border-[#0D9488]/20 bg-[#F0FDFA]/90 px-2.5 py-0.5 font-semibold text-[#0D9488]">
                        {project.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                        {project.areaSqm} м²
                      </span>
                      {project.address && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{project.address}</span>
                        </>
                      )}
                    </div>

                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F2936] sm:text-4xl [text-wrap:balance]">
                      {project.name}
                    </h1>
                  </div>

                  {onExportPdf && (
                    <button
                      type="button"
                      disabled={exportingPdf}
                      onClick={handleExportPdfClick}
                      className="btn-pulse flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full px-5 text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
                    >
                      <FileDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                      {exportingPdf ? 'Формирование PDF...' : 'Скачать PDF-отчёт'}
                    </button>
                  )}
                </div>

                {/* Overall Readiness Bar */}
                <div className="mt-6 rounded-2xl border border-[#DDF0F4] bg-[#F4FBFD] p-4">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-[#4C6D7C]">Общая готовность дизайн-проекта</span>
                    <span className="font-mono text-base font-bold tabular-nums text-[#0D9488]">
                      {overallProgress}%
                    </span>
                  </div>
                  <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#DCEFF4]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        overallProgress === 100
                          ? 'bg-[#0D9488]'
                          : 'bg-gradient-to-r from-[#14B8A6] to-[#0284C9]'
                      }`}
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>

                {/* Quick Material & Document Links */}
                <div className="mt-6 grid grid-cols-1 gap-3 border-t border-[#DDF0F4] pt-6 sm:grid-cols-3">
                  {project.links.proposalUrl ? (
                    <a
                      href={normalizeUrl(project.links.proposalUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-pulse flex min-h-[48px] items-center justify-between rounded-full px-5 py-3 text-xs font-semibold"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0" />
                        Коммерческое предложение
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-85" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex min-h-[48px] cursor-not-allowed items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-[#F4FBFD] px-4 py-3 text-left text-xs text-[#6B8B99] opacity-80"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span>
                          <span className="block font-medium text-[#4C6D7C]">
                            Коммерческое предложение
                          </span>
                          <span className="block text-[10px] text-[#7A9AA8]">Документ готовится</span>
                        </span>
                      </span>
                    </button>
                  )}

                  {project.links.measurementUrl ? (
                    <a
                      href={normalizeUrl(project.links.measurementUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[48px] items-center justify-between rounded-full border border-[#B5DFE8] bg-white px-5 py-3 text-xs font-semibold text-[#0F2936] transition-all hover:border-[#0284C9] hover:bg-[#F0F9FB] hover:text-[#0284C9]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Ruler className="h-4 w-4 shrink-0 text-[#0D9488]" />
                        Обмерный план
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex min-h-[48px] cursor-not-allowed items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-[#F4FBFD] px-4 py-3 text-left text-xs text-[#6B8B99] opacity-80"
                    >
                      <span className="flex items-center gap-2.5">
                        <Ruler className="h-4 w-4 shrink-0" />
                        <span>
                          <span className="block font-medium text-[#4C6D7C]">Обмерный план</span>
                          <span className="block text-[10px] text-[#7A9AA8]">Документ готовится</span>
                        </span>
                      </span>
                    </button>
                  )}

                  {project.links.folderUrl ? (
                    <a
                      href={normalizeUrl(project.links.folderUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[48px] items-center justify-between rounded-full border border-[#B5DFE8] bg-white px-5 py-3 text-xs font-semibold text-[#0F2936] transition-all hover:border-[#0284C9] hover:bg-[#F0F9FB] hover:text-[#0284C9]"
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderOpen className="h-4 w-4 shrink-0 text-[#0284C9]" />
                        Папка с материалами
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="flex min-h-[48px] cursor-not-allowed items-center justify-between rounded-2xl border border-dashed border-[#B5DFE8] bg-[#F4FBFD] px-4 py-3 text-left text-xs text-[#6B8B99] opacity-80"
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderOpen className="h-4 w-4 shrink-0" />
                        <span>
                          <span className="block font-medium text-[#4C6D7C]">
                            Папка с материалами
                          </span>
                          <span className="block text-[10px] text-[#7A9AA8]">Документ готовится</span>
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Transparent Payment Schedule with Light Pastel Summary Bar */}
            <section className="bento-card overflow-hidden">
              <div className="border-b border-[#0EA5E9]/14 px-6 py-5">
                <h2 className="text-base font-semibold tracking-tight text-[#0F2936]">
                  График платежей по КП
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 border-b border-[#0EA5E9]/14 bg-[#F4FAFC]/80 p-6 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-5 py-4">
                  <div className="text-xs font-medium text-[#547585]">Стоимость проекта</div>
                  <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#0F2936]">
                    {formatCurrency(financials.total)}
                  </div>
                </div>
                <div className="bento-card-balance px-5 py-4">
                  <div className="text-xs font-medium text-[#0F6E6E]">
                    Оплачено ({financials.paidPct}%)
                  </div>
                  <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-[#0D9488]">
                    {formatCurrency(financials.paid)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#0EA5E9]/14 bg-white/90 px-5 py-4">
                  <div className="text-xs font-medium text-[#547585]">Остаток к оплате</div>
                  <div
                    className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
                      financials.remaining > 0 ? 'text-[#E11D48]' : 'text-[#0D9488]'
                    }`}
                  >
                    {formatCurrency(financials.remaining)}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#E1F2F6]">
                {project.paymentStages.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex flex-col justify-between gap-2 px-6 py-4 transition-colors hover:bg-[#F4FBFD] sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#0F2936]">{ps.title}</div>
                      <div className="mt-0.5 font-mono text-xs tabular-nums text-[#4C6D7C]">
                        {ps.isPaid
                          ? `Оплачено ${formatDate(ps.paidDate)}`
                          : `Плановый срок: ${formatDate(ps.dueDate)}`}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-mono text-sm font-bold tabular-nums text-[#0F2936]">
                        {formatCurrency(ps.amount)}
                      </span>
                      <span
                        className={`inline-flex min-w-[96px] justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          ps.isPaid
                            ? 'border-[#99F6E4] bg-[#F0FDFA] text-[#0D9488]'
                            : 'border-[#FDA4AF] bg-[#FFF1F2] text-[#E11D48]'
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
            <section className="bento-card overflow-hidden">
              <div className="border-b border-[#DDF0F4] px-6 py-5">
                <h2 className="text-base font-bold tracking-tight text-[#0F2936]">
                  Этапы работ и график выполнения
                </h2>
              </div>

              <div className="divide-y divide-[#E1F2F6]">
                {groupedWork.map(({ stage, tasks, progress }) => (
                  <div key={stage.id} className="p-6">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <h3 className="text-sm font-bold text-[#0F2936]">{stage.title}</h3>
                      <span className="inline-flex items-center self-start rounded-full border border-[#C5E6EC] bg-[#EEF8FA] px-3 py-0.5 font-mono text-xs font-bold tabular-nums text-[#0D9488] sm:self-auto">
                        Готовность этапа: {progress}%
                      </span>
                    </div>

                    {tasks.length === 0 ? (
                      <p className="mt-3 text-xs text-[#6B8B99]">Подэтапы формируются.</p>
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

                          const statusBadge =
                            task.progress === 100
                              ? 'border-[#0D9488]/20 bg-[#F0FDFA]/90 text-[#0D9488]'
                              : task.delayReason === 'client'
                              ? 'border-amber-300/60 bg-amber-50/85 text-[#B45309] backdrop-blur-xs'
                              : task.progress > 0
                              ? 'border-[#4F46E5]/20 bg-[#EEF2FF]/90 text-[#4F46E5]'
                              : 'border-[#0EA5E9]/16 bg-[#F4FAFC] text-[#547585]';

                          const barColor =
                            task.progress === 100
                              ? 'bg-[#0D9488]'
                              : task.delayReason === 'client'
                              ? 'bg-[#D97706]'
                              : 'bg-[#4F46E5]';

                          return (
                            <div key={task.id} className="space-y-1.5">
                              <div className="flex flex-col justify-between gap-1 text-xs sm:flex-row sm:items-center">
                                <span className="font-semibold text-[#0F2936]">{task.title}</span>
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-mono tabular-nums text-[#4C6D7C]">
                                    {formatShortDate(task.planStart)} — {formatShortDate(task.planEnd)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadge}`}
                                  >
                                    {statusText}
                                  </span>
                                  <span className="font-mono font-bold tabular-nums text-[#0F2936]">
                                    {task.progress}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-[#E1F2F6]">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
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
