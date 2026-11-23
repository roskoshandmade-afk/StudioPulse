import React, { useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ListTree,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { createId } from '../data/demoData';
import { DelayReason, Project, TeamMember, WorkSubStage } from '../types';
import { formatDate, formatShortDate, getTodayIso } from '../utils/calculations';

interface GanttChartProps {
  project: Project;
  team: TeamMember[];
  onUpdateWorkStages: (workStages: WorkSubStage[]) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_MONTHS = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

function parseDateMs(dateStr: string): number {
  if (!dateStr) return NaN;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function getMondayBefore(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const GanttChart: React.FC<GanttChartProps> = ({
  project,
  team,
  onUpdateWorkStages,
}) => {
  const [editingTask, setEditingTask] = useState<WorkSubStage | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [displayMode, setDisplayMode] = useState<'gantt' | 'timeline'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'timeline' : 'gantt'
  );

  const memberMap = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);
  const todayIso = getTodayIso();
  const todayMs = parseDateMs(todayIso);

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  // Build hierarchical stage groups with aggregated summary dates & readiness
  const grouped = useMemo(() => {
    const groups = project.paymentStages.map((ps) => {
      const tasks = project.workStages.filter((ws) => ws.paymentStageId === ps.id);
      const avgProgress = tasks.length
        ? Math.round(tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / tasks.length)
        : 0;

      const planStarts = tasks.map((t) => parseDateMs(t.planStart)).filter((n) => !Number.isNaN(n));
      const planEnds = tasks.map((t) => parseDateMs(t.planEnd)).filter((n) => !Number.isNaN(n));

      return {
        stageId: ps.id,
        title: ps.title,
        isPaid: ps.isPaid,
        tasks,
        avgProgress,
        minPlanMs: planStarts.length ? Math.min(...planStarts) : null,
        maxPlanMs: planEnds.length ? Math.max(...planEnds) : null,
      };
    });

    const knownIds = new Set(project.paymentStages.map((p) => p.id));
    const orphans = project.workStages.filter((ws) => !knownIds.has(ws.paymentStageId));
    if (orphans.length > 0) {
      const avgProgress = Math.round(
        orphans.reduce((acc, t) => acc + (t.progress || 0), 0) / orphans.length
      );
      const planStarts = orphans
        .map((t) => parseDateMs(t.planStart))
        .filter((n) => !Number.isNaN(n));
      const planEnds = orphans
        .map((t) => parseDateMs(t.planEnd))
        .filter((n) => !Number.isNaN(n));

      groups.push({
        stageId: '__orphans__',
        title: 'Дополнительные работы',
        isPaid: false,
        tasks: orphans,
        avgProgress,
        minPlanMs: planStarts.length ? Math.min(...planStarts) : null,
        maxPlanMs: planEnds.length ? Math.max(...planEnds) : null,
      });
    }

    return groups;
  }, [project.paymentStages, project.workStages]);

  // Compute calendar timeline with Month spans + Weekly grid columns
  const calendar = useMemo(() => {
    const timestamps: number[] = [todayMs];
    for (const ws of project.workStages) {
      [ws.planStart, ws.planEnd, ws.actualStart, ws.actualEnd].forEach((d) => {
        const ms = parseDateMs(d);
        if (!Number.isNaN(ms)) timestamps.push(ms);
      });
    }

    const rawMin = Math.min(...timestamps) - 4 * DAY_MS;
    const rawMax = Math.max(...timestamps) + 10 * DAY_MS;

    const startMs = getMondayBefore(rawMin);
    const totalDays = Math.max(35, Math.ceil((rawMax - startMs) / DAY_MS));
    const weekCount = Math.ceil(totalDays / 7);
    const endMs = startMs + weekCount * 7 * DAY_MS;
    const spanMs = endMs - startMs;

    // Weekly columns
    const weeks: Array<{ startMs: number; label: string; leftPct: number; widthPct: number }> = [];
    for (let i = 0; i < weekCount; i++) {
      const wStart = startMs + i * 7 * DAY_MS;
      const d = new Date(wStart);
      const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
      weeks.push({
        startMs: wStart,
        label,
        leftPct: (i / weekCount) * 100,
        widthPct: (1 / weekCount) * 100,
      });
    }

    // Month header bands
    const months: Array<{ key: string; label: string; leftPct: number; widthPct: number }> = [];
    let cursor = new Date(startMs);
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() < endMs) {
      const mStart = Math.max(startMs, cursor.getTime());
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const mEnd = Math.min(endMs, nextMonth.getTime());
      const leftPct = ((mStart - startMs) / spanMs) * 100;
      const widthPct = ((mEnd - mStart) / spanMs) * 100;

      months.push({
        key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
        label: `${SHORT_MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`,
        leftPct,
        widthPct,
      });

      cursor = nextMonth;
    }

    const todayPct = ((todayMs - startMs) / spanMs) * 100;
    const timelineWidthPx = Math.max(760, weekCount * 92);

    return { startMs, endMs, spanMs, weeks, months, todayPct, timelineWidthPx };
  }, [project.workStages, todayMs]);

  const msToPct = (ms: number): number => {
    const pct = ((ms - calendar.startMs) / calendar.spanMs) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const openAddTask = (paymentStageId: string) => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 10);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    setEditingTask({
      id: createId('ws'),
      paymentStageId,
      title: '',
      assigneeId: team[0]?.id || '',
      planStart: todayIso,
      planEnd: end,
      actualStart: '',
      actualEnd: '',
      progress: 0,
      delayReason: 'none',
      internalNote: '',
    });
    setIsAddingTask(true);
  };

  const openEditTask = (task: WorkSubStage) => {
    setEditingTask({ ...task });
    setIsAddingTask(false);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;
    const cleaned: WorkSubStage = {
      ...editingTask,
      title: editingTask.title.trim(),
      progress: Math.max(0, Math.min(100, Number(editingTask.progress) || 0)),
    };
    if (isAddingTask) {
      onUpdateWorkStages([...project.workStages, cleaned]);
    } else {
      onUpdateWorkStages(
        project.workStages.map((ws) => (ws.id === cleaned.id ? cleaned : ws))
      );
    }
    setEditingTask(null);
    setIsAddingTask(false);
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateWorkStages(project.workStages.filter((ws) => ws.id !== taskId));
    setEditingTask(null);
    setIsAddingTask(false);
  };

  const handleQuickProgress = (taskId: string, progress: number) => {
    onUpdateWorkStages(
      project.workStages.map((ws) => {
        if (ws.id !== taskId) return ws;
        const next: WorkSubStage = { ...ws, progress };
        if (progress > 0 && !next.actualStart) {
          next.actualStart = todayIso;
        }
        if (progress === 100 && !next.actualEnd) {
          next.actualEnd = todayIso;
        }
        return next;
      })
    );
  };

  /**
   * Computes Plan & Fact geometry (including exact overrun tail beyond planEnd).
   */
  const computeTaskGeometry = (task: WorkSubStage) => {
    const planStartMs = parseDateMs(task.planStart);
    const planEndMs = parseDateMs(task.planEnd);
    const hasPlan = !Number.isNaN(planStartMs) && !Number.isNaN(planEndMs);

    const planLeft = hasPlan ? msToPct(planStartMs) : null;
    const planRight = hasPlan ? msToPct(planEndMs + DAY_MS) : null;
    const planWidth =
      planLeft !== null && planRight !== null ? Math.max(0.8, planRight - planLeft) : null;

    const actStartStr = task.actualStart || (task.progress > 0 ? task.planStart : '');
    const actEndStr =
      task.actualEnd ||
      (task.progress === 100 ? task.planEnd : task.progress > 0 ? todayIso : '');

    const actStartMs = parseDateMs(actStartStr);
    const actEndMs = parseDateMs(actEndStr);
    const hasActual = !Number.isNaN(actStartMs) && !Number.isNaN(actEndMs);

    const effectiveEndMs =
      hasActual
        ? actEndMs
        : task.progress < 100 && hasPlan && todayMs > planEndMs
        ? todayMs
        : NaN;

    const hasOverrun = hasPlan && !Number.isNaN(effectiveEndMs) && effectiveEndMs > planEndMs;
    const overrunDays = hasOverrun
      ? Math.max(1, Math.round((effectiveEndMs - planEndMs) / DAY_MS))
      : 0;

    let baseLeft: number | null = null;
    let baseWidth: number | null = null;
    let tailLeft: number | null = null;
    let tailWidth: number | null = null;

    if (hasActual) {
      const clampedBaseEnd = hasOverrun ? Math.max(actStartMs, planEndMs) : actEndMs;
      baseLeft = msToPct(actStartMs);
      const baseRight = msToPct(clampedBaseEnd + DAY_MS);
      baseWidth = Math.max(0.8, baseRight - baseLeft);
    }

    if (hasOverrun) {
      tailLeft = msToPct(planEndMs + DAY_MS);
      const tailRight = msToPct(effectiveEndMs + DAY_MS);
      tailWidth = Math.max(0.8, tailRight - tailLeft);
    }

    const isCriticalRow =
      task.delayReason === 'studio' || (hasOverrun && task.delayReason !== 'client');
    const isWarningRow = !isCriticalRow && task.delayReason === 'client';

    // High-contrast noble semantic palette: Teal (#0D9488), Indigo (#4F46E5), Amber (#D97706), Coral-Ruby (#E11D48)
    const tailColorClass =
      task.delayReason === 'client' ? 'bg-[#D97706]' : 'bg-[#E11D48]';

    const mainFillColorClass =
      task.progress === 100 && !hasOverrun
        ? 'bg-[#0D9488]'
        : isCriticalRow
        ? 'bg-[#E11D48]'
        : task.delayReason === 'client'
        ? 'bg-[#D97706]'
        : 'bg-[#4F46E5]';

    return {
      planLeft,
      planWidth,
      baseLeft,
      baseWidth,
      tailLeft,
      tailWidth,
      hasOverrun,
      overrunDays,
      isCriticalRow,
      isWarningRow,
      tailColorClass,
      mainFillColorClass,
      actStartStr,
      actEndStr,
    };
  };

  return (
    <section
      aria-label="Диаграмма Ганта План vs Факт"
      className="bento-card overflow-hidden"
    >
      {/* Header Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0EA5E9]/14 px-6 py-5 lg:flex-row lg:items-center">
        <div>
          <div className="text-[11px] font-medium text-[#547585]">Производственный график</div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#0F2936]">
            Диаграмма Ганта · План vs Факт
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Gantt vs Compact Timeline */}
          <div
            className="flex items-center gap-1 rounded-full border border-[#0EA5E9]/16 bg-[#F0F9FF]/80 p-1"
            role="group"
            aria-label="Режим отображения графика"
          >
            <button
              type="button"
              onClick={() => setDisplayMode('gantt')}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all whitespace-nowrap ${
                displayMode === 'gantt'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#547585] hover:text-[#0F2936]'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" strokeWidth={1.6} />
              Гант
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('timeline')}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all whitespace-nowrap ${
                displayMode === 'timeline'
                  ? 'btn-pulse font-semibold'
                  : 'text-[#547585] hover:text-[#0F2936]'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" strokeWidth={1.6} />
              Таймлайн этапов
            </button>
          </div>

          {project.paymentStages.length > 0 && (
            <button
              type="button"
              onClick={() => openAddTask(project.paymentStages[0].id)}
              className="btn-pulse flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              Подэтап
            </button>
          )}
        </div>
      </div>

      {/* Prominent Color Legend Strip Above Gantt Chart */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0EA5E9]/14 bg-[#F4FAFC]/85 px-6 py-3 text-[11px] font-medium text-[#0F2936]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-1.5">
            <span className="gantt-plan-hatch inline-block h-3 w-6 rounded-sm border border-[#0284C7]" />
            План по графику
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-full bg-[#0D9488]" />
            Выполнено в срок (100%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-full bg-[#4F46E5]" />
            В работе (активный этап)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-full bg-[#D97706]" />
            Внимание · Ожидание клиента
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 rounded-full bg-[#E11D48]" />
            Срыв дедлайна (+N дн.)
          </span>
        </div>
        <span className="rounded-full border border-[#0EA5E9]/20 bg-white/90 px-3 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#0284C7]">
          Сегодня · {formatShortDate(todayIso)}
        </span>
      </div>

      {grouped.length === 0 ? (
        <div className="px-6 py-12 text-center text-xs text-[#4C6D7C]">
          Добавьте этапы оплаты КП, чтобы построить иерархию работ на диаграмме Ганта.
        </div>
      ) : displayMode === 'gantt' ? (
        /* PROFESSIONAL GANTT CHART WITH STICKY LEFT COLUMN & 2-TIER MONTH/WEEK GRID */
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${320 + calendar.timelineWidthPx}px` }}>
            {/* Calendar Header Row */}
            <div className="flex border-b border-[#C5E6EC] bg-[#EEF8FA]">
              {/* Sticky Left Column Header */}
              <div className="sticky left-0 z-30 flex w-[300px] shrink-0 items-end justify-between border-r border-[#C5E6EC] bg-[#EEF8FA] px-5 py-3 sm:w-[340px]">
                <span className="text-[11px] font-bold text-[#0F2936]">
                  Этап / Подэтап · Роль
                </span>
                <span className="text-[11px] font-semibold text-[#4C6D7C]">Готовность</span>
              </div>

              {/* Right Two-Tier Month + Week Header */}
              <div
                className="relative flex-1 select-none"
                style={{ minWidth: `${calendar.timelineWidthPx}px` }}
              >
                {/* Row 1: Months */}
                <div className="relative h-7 border-b border-[#D4ECF1]">
                  {calendar.months.map((m) => (
                    <div
                      key={m.key}
                      style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                      className="absolute top-0 bottom-0 flex items-center overflow-hidden border-r border-[#D4ECF1] px-2.5 text-[11px] font-bold text-[#0F2936]"
                    >
                      <span className="truncate">{m.label}</span>
                    </div>
                  ))}
                </div>

                {/* Row 2: Weeks */}
                <div className="relative h-7">
                  {calendar.weeks.map((w, idx) => (
                    <div
                      key={idx}
                      style={{ left: `${w.leftPct}%`, width: `${w.widthPct}%` }}
                      className="absolute top-0 bottom-0 flex items-center border-r border-[#D4ECF1] px-2 font-mono text-[10px] font-medium tabular-nums text-[#4C6D7C]"
                    >
                      {w.label}
                    </div>
                  ))}

                  {/* Today Header Tag */}
                  {calendar.todayPct >= 0 && calendar.todayPct <= 100 && (
                    <div
                      style={{ left: `${calendar.todayPct}%` }}
                      className="pointer-events-none absolute top-0 bottom-0 z-20 -translate-x-1/2"
                    >
                      <div className="rounded-full bg-[#0284C9] px-2 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white shadow-xs whitespace-nowrap">
                        {formatShortDate(todayIso)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body Rows */}
            <div className="divide-y divide-[#DDF0F4]">
              {grouped.map((group) => {
                const isCollapsed = !!collapsedStages[group.stageId];
                const summaryLeft =
                  group.minPlanMs !== null ? msToPct(group.minPlanMs) : null;
                const summaryRight =
                  group.maxPlanMs !== null ? msToPct(group.maxPlanMs + DAY_MS) : null;
                const summaryWidth =
                  summaryLeft !== null && summaryRight !== null
                    ? Math.max(1, summaryRight - summaryLeft)
                    : null;

                return (
                  <div key={group.stageId}>
                    {/* Parent Summary Row: KP Payment Stage */}
                    <div className="flex border-b border-[#D4ECF1] bg-[#EEF8FA]/80">
                      {/* Sticky Left Summary Cell */}
                      <div className="sticky left-0 z-20 flex w-[300px] shrink-0 items-center justify-between gap-2 border-r border-[#C5E6EC] bg-[#EEF8FA] px-4 py-3 sm:w-[340px]">
                        <button
                          type="button"
                          onClick={() => toggleStageCollapse(group.stageId)}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#0D9488]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#0D9488]" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-[#0F2936]">
                              {group.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#4C6D7C]">
                              <span>{group.tasks.length} подэт.</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  group.isPaid
                                    ? 'font-bold text-[#0D9488]'
                                    : 'font-medium text-[#4C6D7C]'
                                }
                              >
                                {group.isPaid ? 'Оплачено' : 'Ожидается'}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#0F2936]">
                            {group.avgProgress}%
                          </span>
                          {group.stageId !== '__orphans__' && (
                            <button
                              type="button"
                              onClick={() => openAddTask(group.stageId)}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-[#B5DFE8] bg-white text-[#0D9488] transition-colors hover:bg-[#0D9488] hover:text-white"
                              title="Добавить подэтап"
                              aria-label="Добавить подэтап"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Right Summary Timeline Span */}
                      <div
                        className="relative flex-1"
                        style={{ minWidth: `${calendar.timelineWidthPx}px` }}
                      >
                        {/* Week Vertical Gridlines */}
                        {calendar.weeks.map((w, idx) => (
                          <div
                            key={idx}
                            style={{ left: `${w.leftPct}%`, width: `${w.widthPct}%` }}
                            className="pointer-events-none absolute top-0 bottom-0 border-r border-[#DDF0F4]"
                          />
                        ))}

                        {/* Today Marker Line */}
                        {calendar.todayPct >= 0 && calendar.todayPct <= 100 && (
                          <div
                            style={{ left: `${calendar.todayPct}%` }}
                            className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-[#0284C9]"
                          />
                        )}

                        {/* Summary Stage Span Bar */}
                        {summaryLeft !== null && summaryWidth !== null && (
                          <div
                            style={{ left: `${summaryLeft}%`, width: `${summaryWidth}%` }}
                            className="absolute top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full border border-[#0284C9]/60 bg-white/80"
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#0D9488] to-[#0284C9]"
                              style={{ width: `${group.avgProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Child Sub-Stage Rows */}
                    {!isCollapsed &&
                      (group.tasks.length === 0 ? (
                        <div className="flex bg-white">
                          <div className="sticky left-0 z-20 w-[300px] shrink-0 border-r border-[#C5E6EC] bg-white px-10 py-3 text-xs text-[#4C6D7C] sm:w-[340px]">
                            Нет подэтапов
                          </div>
                          <div className="flex-1" />
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E4F3F7]">
                          {group.tasks.map((task) => {
                            const member = memberMap.get(task.assigneeId);
                            const geo = computeTaskGeometry(task);
                            const overrunLabel = `+${geo.overrunDays} дн.`;
                            const showOverrunInside =
                              geo.tailWidth !== null && geo.tailWidth >= 6.5;

                            const rowBgClass = geo.isCriticalRow
                              ? 'bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/82 hover:from-[#FFE4E6]/85 hover:to-[#FFF1F2]/80'
                              : geo.isWarningRow
                              ? 'bg-amber-50/55 hover:bg-amber-50/85'
                              : 'bg-white hover:bg-[#F4FAFC]';

                            const stickyBgClass = geo.isCriticalRow
                              ? 'border-l-4 border-l-rose-500 bg-[#FFF3F4] group-hover:bg-[#FFE8EA]'
                              : geo.isWarningRow
                              ? 'border-l-4 border-l-[#D97706] bg-[#FFFDF4] group-hover:bg-amber-50'
                              : 'bg-white group-hover:bg-[#F4FAFC]';

                            return (
                              <div
                                key={task.id}
                                className={`group flex transition-colors ${rowBgClass}`}
                              >
                                {/* Sticky Left Task Cell */}
                                <div
                                  className={`sticky left-0 z-20 flex w-[300px] shrink-0 flex-col justify-center border-r border-[#0EA5E9]/14 py-3 pr-4 pl-8 transition-colors sm:w-[340px] ${stickyBgClass}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditTask(task)}
                                      className="text-left text-xs font-semibold text-[#0F2936] underline-offset-4 hover:text-[#0D9488] hover:underline"
                                    >
                                      {task.title}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditTask(task)}
                                      className="shrink-0 rounded-full p-1 text-[#547585] opacity-75 hover:bg-white hover:text-[#0D9488] hover:opacity-100"
                                      aria-label="Редактировать подэтап"
                                    >
                                      <Pencil className="h-3 w-3" strokeWidth={1.6} />
                                    </button>
                                  </div>

                                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                                    <div className="flex items-center gap-1.5 text-[#547585]">
                                      <span className="rounded-md bg-[#EBF7FA] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#0F2936]">
                                        {member ? member.code : '—'}
                                      </span>
                                      <span className="font-mono tabular-nums">
                                        {formatShortDate(task.planStart)}–{formatShortDate(task.planEnd)}
                                      </span>
                                    </div>

                                    <label className="inline-flex items-center gap-1.5">
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={task.progress}
                                        onChange={(e) =>
                                          handleQuickProgress(task.id, Number(e.target.value))
                                        }
                                        className="h-1 w-12 cursor-pointer accent-[#0D9488]"
                                        aria-label={`Готовность ${task.title}`}
                                      />
                                      <span className="w-8 text-right font-mono font-semibold tabular-nums text-[#0F2936]">
                                        {task.progress}%
                                      </span>
                                    </label>
                                  </div>

                                  {(geo.hasOverrun || task.delayReason !== 'none') && (
                                    <div
                                      className={`mt-1.5 inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-xs ${
                                        task.delayReason === 'client'
                                          ? 'border-amber-300/60 bg-amber-50/90 text-[#B45309]'
                                          : 'border-[#FDA4AF]/75 bg-white/85 text-[#E11D48]'
                                      }`}
                                    >
                                      {task.delayReason === 'client'
                                        ? 'Ожидание клиента'
                                        : 'Срыв дедлайна (студия)'}
                                      {geo.hasOverrun ? ` · ${overrunLabel}` : ''}
                                    </div>
                                  )}
                                </div>

                                {/* Right Two-Layer Plan / Fact Canvas */}
                                <div
                                  onClick={() => openEditTask(task)}
                                  className="relative flex-1 cursor-pointer py-3"
                                  style={{ minWidth: `${calendar.timelineWidthPx}px`, minHeight: '74px' }}
                                >
                                  {/* Week Gridlines */}
                                  {calendar.weeks.map((w, idx) => (
                                    <div
                                      key={idx}
                                      style={{ left: `${w.leftPct}%`, width: `${w.widthPct}%` }}
                                      className="pointer-events-none absolute top-0 bottom-0 border-r border-[#E4F3F7]"
                                    />
                                  ))}

                                  {/* Vertical Today Line */}
                                  {calendar.todayPct >= 0 && calendar.todayPct <= 100 && (
                                    <div
                                      style={{ left: `${calendar.todayPct}%` }}
                                      className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-[#0284C7]/80"
                                    />
                                  )}

                                  {/* LAYER 1 (Top): Crisp Azure Hatched PLAN Strip */}
                                  <div className="relative h-4">
                                    {geo.planLeft !== null && geo.planWidth !== null && (
                                      <div
                                        style={{
                                          left: `${geo.planLeft}%`,
                                          width: `${geo.planWidth}%`,
                                        }}
                                        title={`План: ${formatDate(task.planStart)} — ${formatDate(task.planEnd)}`}
                                        className="gantt-plan-hatch absolute top-0.5 h-3 rounded-sm border border-[#0284C7]/75"
                                      />
                                    )}
                                  </div>

                                  {/* LAYER 2 (Bottom): High-Contrast Solid FACT Bar + Semantic Overrun Tail */}
                                  <div className="relative mt-1.5 h-5">
                                    {/* Base Actual Segment (within plan) */}
                                    {geo.baseLeft !== null && geo.baseWidth !== null && (
                                      <div
                                        style={{
                                          left: `${geo.baseLeft}%`,
                                          width: `${geo.baseWidth}%`,
                                        }}
                                        title={`Факт: ${formatDate(geo.actStartStr)} — ${formatDate(geo.actEndStr)} · ${task.progress}%`}
                                        className="absolute top-0 h-4.5 overflow-hidden rounded-full border border-[#B5DFE8] bg-[#E8F6F9] shadow-xs"
                                      >
                                        <div
                                          className={`h-full rounded-full ${geo.mainFillColorClass}`}
                                          style={{ width: `${task.progress}%` }}
                                        />
                                        <span
                                          className={`pointer-events-none absolute inset-y-0 left-2 flex items-center font-mono text-[9px] font-bold tabular-nums ${
                                            task.progress >= 25 ? 'text-white' : 'text-[#0F2936]'
                                          }`}
                                        >
                                          {task.progress}%
                                        </span>
                                      </div>
                                    )}

                                    {/* Overrun Tail Segment (strictly beyond planEnd) */}
                                    {geo.tailLeft !== null && geo.tailWidth !== null && (
                                      <>
                                        <div
                                          style={{
                                            left: `${geo.tailLeft}%`,
                                            width: `${geo.tailWidth}%`,
                                          }}
                                          title={`Перерасход срока: ${overrunLabel} (${task.delayReason === 'client' ? 'ожидание клиента' : 'задержка студии'})`}
                                          className={`absolute top-0 flex h-4.5 items-center overflow-hidden rounded-r-full shadow-xs ${geo.tailColorClass}`}
                                        >
                                          {showOverrunInside && (
                                            <span className="truncate px-2 font-mono text-[9px] font-bold tabular-nums text-white">
                                              {overrunLabel}
                                            </span>
                                          )}
                                        </div>
                                        {!showOverrunInside && (
                                          <span
                                            style={{
                                              left: `calc(${Math.min(
                                                92,
                                                geo.tailLeft + geo.tailWidth
                                              )}% + 6px)`,
                                            }}
                                            className={`pointer-events-none absolute top-0 flex h-4.5 items-center font-mono text-[10px] font-bold tabular-nums whitespace-nowrap ${
                                              task.delayReason === 'client'
                                                ? 'text-[#B45309]'
                                                : 'text-[#E11D48]'
                                            }`}
                                          >
                                            {overrunLabel}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* COMPACT TIMELINE MODE (IDEAL FOR MOBILE & QUICK STAGE REVIEW) */
        <div className="divide-y divide-[#DDF0F4]">
          {grouped.map((group) => {
            const isCollapsed = !!collapsedStages[group.stageId];
            return (
              <div key={group.stageId}>
                <div className="flex items-center justify-between gap-3 bg-[#EEF8FA] px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleStageCollapse(group.stageId)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#0D9488]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#0D9488]" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0F2936]">{group.title}</div>
                      <div className="mt-0.5 text-[11px] text-[#4C6D7C]">
                        {group.tasks.length} подэт. ·{' '}
                        <span className={group.isPaid ? 'font-bold text-[#0D9488]' : 'text-[#4C6D7C]'}>
                          {group.isPaid ? 'Оплачено' : 'Ожидается оплата'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-xs font-bold tabular-nums text-[#0F2936]">
                      {group.avgProgress}%
                    </span>
                    {group.stageId !== '__orphans__' && (
                      <button
                        type="button"
                        onClick={() => openAddTask(group.stageId)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#B5DFE8] bg-white text-[#0D9488] hover:bg-[#0D9488] hover:text-white"
                        aria-label="Добавить подэтап"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-[#E4F3F7]">
                    {group.tasks.map((task) => {
                      const member = memberMap.get(task.assigneeId);
                      const geo = computeTaskGeometry(task);
                      return (
                        <div
                          key={task.id}
                          onClick={() => openEditTask(task)}
                          className={`cursor-pointer px-6 py-4 transition-colors ${
                            geo.isCriticalRow
                              ? 'border-l-4 border-l-rose-500 bg-gradient-to-r from-[#FFF1F2]/92 to-[#FFF7ED]/82 hover:from-[#FFE4E6]/85 hover:to-[#FFF1F2]/80'
                              : geo.isWarningRow
                              ? 'border-l-4 border-l-[#D97706] bg-amber-50/55 hover:bg-amber-50/85'
                              : 'bg-white hover:bg-[#F4FAFC]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#0F2936]">
                                {task.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#547585]">
                                <span className="font-mono font-semibold text-[#0F2936]">
                                  {member ? `${member.code} · ${member.roleTitle}` : 'Исполнитель не назначен'}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-sm font-semibold tabular-nums text-[#0F2936] shrink-0">
                              {task.progress}%
                            </span>
                          </div>

                          {/* Dual Plan vs Fact Dates Row */}
                          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <span className="text-[#547585]">План: </span>
                              <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                                {formatShortDate(task.planStart)} — {formatShortDate(task.planEnd)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#547585]">Факт: </span>
                              <span className="font-mono font-semibold tabular-nums text-[#0F2936]">
                                {task.actualStart
                                  ? `${formatShortDate(task.actualStart)} — ${task.actualEnd ? formatShortDate(task.actualEnd) : 'в работе'}`
                                  : 'не начато'}
                              </span>
                            </div>
                          </div>

                          {/* Progress + Overrun Indicator Strip */}
                          <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#E5F4F8]">
                            <div
                              className={`h-full rounded-full ${geo.mainFillColorClass}`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>

                          {(geo.hasOverrun || task.delayReason !== 'none') && (
                            <div
                              className={`mt-2.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-xs ${
                                task.delayReason === 'client'
                                  ? 'border-amber-300/60 bg-amber-50/90 text-[#B45309]'
                                  : 'border-[#FDA4AF]/75 bg-white/85 text-[#E11D48]'
                              }`}
                            >
                              {task.delayReason === 'client'
                                ? 'Сдвиг: ждём обратную связь от заказчика'
                                : 'Срыв дедлайна: задержка студии'}
                              {geo.hasOverrun ? ` (+${geo.overrunDays} дн. сверх плана)` : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Work Sub-Stage Modal */}
      {editingTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2936]/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bento-card w-full max-w-lg bg-white/95 p-6">
            <div className="flex items-center justify-between border-b border-[#DDF0F4] pb-3.5">
              <h3 className="text-sm font-bold text-[#0F2936]">
                {isAddingTask ? 'Новый рабочий подэтап' : 'Редактирование подэтапа'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#4C6D7C] hover:bg-[#EEF8FA] hover:text-[#0F2936]"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                  Название подэтапа *
                </label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Например: Визы кухни и санузлов"
                  className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-3 text-sm text-[#0F2936] focus:border-[#0D9488] focus:ring-2 focus:ring-[#14B8A6]/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Этап оплаты КП
                  </label>
                  <select
                    value={editingTask.paymentStageId}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, paymentStageId: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  >
                    {project.paymentStages.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {ps.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Исполнитель (роль)
                  </label>
                  <select
                    value={editingTask.assigneeId}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, assigneeId: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  >
                    <option value="">Не назначен</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.roleTitle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    План · начало
                  </label>
                  <input
                    type="date"
                    value={editingTask.planStart}
                    onChange={(e) => setEditingTask({ ...editingTask, planStart: e.target.value })}
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 font-mono text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    План · завершение
                  </label>
                  <input
                    type="date"
                    value={editingTask.planEnd}
                    onChange={(e) => setEditingTask({ ...editingTask, planEnd: e.target.value })}
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 font-mono text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Факт · начало
                  </label>
                  <input
                    type="date"
                    value={editingTask.actualStart}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, actualStart: e.target.value })
                    }
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 font-mono text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Факт · завершение
                  </label>
                  <input
                    type="date"
                    value={editingTask.actualEnd}
                    onChange={(e) => setEditingTask({ ...editingTask, actualEnd: e.target.value })}
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 font-mono text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs font-medium text-[#4C6D7C]">
                    <span>Готовность</span>
                    <span className="font-mono font-bold tabular-nums text-[#0F2936]">
                      {editingTask.progress}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={editingTask.progress}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, progress: Number(e.target.value) })
                    }
                    className="mt-2 w-full accent-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                    Причина сдвига срока
                  </label>
                  <select
                    value={editingTask.delayReason}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        delayReason: e.target.value as DelayReason,
                      })
                    }
                    className="h-10 w-full rounded-xl border border-[#C5E6EC] bg-white px-2.5 text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                  >
                    <option value="none">В графике (нет задержки)</option>
                    <option value="client">Ждём обратную связь от заказчика</option>
                    <option value="studio">Задержка студии</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#4C6D7C]">
                  Внутренняя заметка (скрыта от клиента)
                </label>
                <textarea
                  rows={2}
                  value={editingTask.internalNote}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, internalNote: e.target.value })
                  }
                  placeholder="Комментарий по правкам, подрядчикам или согласованиям..."
                  className="w-full rounded-xl border border-[#C5E6EC] bg-white p-2.5 text-xs text-[#0F2936] focus:border-[#0D9488] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-[#DDF0F4] pt-4">
                {!isAddingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#FDA4AF] bg-[#FFF1F2] px-3.5 text-xs font-semibold text-[#E11D48] hover:bg-[#E11D48] hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Удалить
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="min-h-[38px] rounded-full border border-[#C5E6EC] bg-white px-4 text-xs font-semibold text-[#0F2936] hover:border-[#0D9488]"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn-pulse min-h-[38px] rounded-full px-5 text-xs font-semibold"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
