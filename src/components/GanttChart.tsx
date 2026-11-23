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

    // Determine overrun tail: if actual end (or today for overdue unfinished task) > planEnd
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

    // Split actual bar into in-plan portion + overrun tail portion
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

    const tailColorClass =
      task.delayReason === 'client' ? 'bg-[#D97706]' : 'bg-[#DC2626]';

    const mainFillColorClass =
      task.progress === 100 && !hasOverrun
        ? 'bg-[#15803D]'
        : task.delayReason === 'studio'
        ? 'bg-[#DC2626]'
        : task.delayReason === 'client'
        ? 'bg-[#D97706]'
        : 'bg-[#0A0A0A]';

    return {
      planLeft,
      planWidth,
      baseLeft,
      baseWidth,
      tailLeft,
      tailWidth,
      hasOverrun,
      overrunDays,
      tailColorClass,
      mainFillColorClass,
      actStartStr,
      actEndStr,
    };
  };

  return (
    <section aria-label="Диаграмма Ганта План vs Факт" className="border border-[#0A0A0A] bg-white">
      {/* Header Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#0A0A0A] px-5 py-5 lg:flex-row lg:items-center">
        <div>
          <div className="text-[11px] text-[#525252]">Производственный график</div>
          <h2 className="mt-0.5 text-lg font-bold tracking-tight text-[#0A0A0A]">
            Диаграмма Ганта · План vs Факт
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle: Gantt vs Compact Timeline (ideal for mobile) */}
          <div
            className="flex items-center border border-[#0A0A0A] bg-[#F4F4F4] p-0.5"
            role="group"
            aria-label="Режим отображения графика"
          >
            <button
              type="button"
              onClick={() => setDisplayMode('gantt')}
              className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                displayMode === 'gantt'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#525252] hover:text-[#0A0A0A]'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Гант
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('timeline')}
              className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                displayMode === 'timeline'
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#525252] hover:text-[#0A0A0A]'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              Таймлайн этапов
            </button>
          </div>

          {project.paymentStages.length > 0 && (
            <button
              type="button"
              onClick={() => openAddTask(project.paymentStages[0].id)}
              className="flex h-9 items-center gap-1.5 bg-[#0A0A0A] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#262626] whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Подэтап
            </button>
          )}
        </div>
      </div>

      {/* Architectural Legend Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A] bg-[#F4F4F4] px-5 py-2.5 text-[11px] text-[#0A0A0A]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="flex items-center gap-1.5">
            <span className="gantt-plan-hatch inline-block h-3 w-6 border border-[#0A0A0A]" />
            План по графику
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 bg-[#0A0A0A]" />
            Факт (в работе)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 bg-[#15803D]" />
            Выполнено в срок (100%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 bg-[#D97706]" />
            Ожидание клиента
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-6 bg-[#DC2626]" />
            Задержка (+N дн.)
          </span>
        </div>
        <span className="font-mono text-[11px] font-bold tabular-nums text-[#0A0A0A]">
          Сегодня · {formatShortDate(todayIso)}
        </span>
      </div>

      {grouped.length === 0 ? (
        <div className="px-6 py-12 text-center text-xs text-[#525252]">
          Добавьте этапы оплаты КП, чтобы построить иерархию работ на диаграмме Ганта.
        </div>
      ) : displayMode === 'gantt' ? (
        /* PROFESSIONAL GANTT CHART WITH STICKY LEFT COLUMN & 2-TIER MONTH/WEEK GRID */
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${320 + calendar.timelineWidthPx}px` }}>
            {/* Calendar Header Row */}
            <div className="flex border-b border-[#0A0A0A] bg-[#F4F4F4]">
              {/* Sticky Left Column Header */}
              <div className="sticky left-0 z-30 flex w-[300px] shrink-0 items-end justify-between border-r border-[#0A0A0A] bg-[#F4F4F4] px-5 py-3 sm:w-[340px]">
                <span className="text-[11px] font-bold text-[#0A0A0A]">
                  Этап / Подэтап · Роль
                </span>
                <span className="text-[11px] font-medium text-[#525252]">Готовность</span>
              </div>

              {/* Right Two-Tier Month + Week Header */}
              <div
                className="relative flex-1 select-none"
                style={{ minWidth: `${calendar.timelineWidthPx}px` }}
              >
                {/* Row 1: Months */}
                <div className="relative h-7 border-b border-[#D4D4D4]">
                  {calendar.months.map((m) => (
                    <div
                      key={m.key}
                      style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                      className="absolute top-0 bottom-0 flex items-center overflow-hidden border-r border-[#D4D4D4] px-2.5 text-[11px] font-bold text-[#0A0A0A]"
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
                      className="absolute top-0 bottom-0 flex items-center border-r border-[#D4D4D4] px-2 font-mono text-[10px] font-medium tabular-nums text-[#525252]"
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
                      <div className="bg-[#0A0A0A] px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white whitespace-nowrap">
                        {formatShortDate(todayIso)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body Rows */}
            <div className="divide-y divide-[#D4D4D4]">
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
                    <div className="flex border-b border-[#D4D4D4] bg-[#F4F4F4]">
                      {/* Sticky Left Summary Cell */}
                      <div className="sticky left-0 z-20 flex w-[300px] shrink-0 items-center justify-between gap-2 border-r border-[#0A0A0A] bg-[#F4F4F4] px-4 py-3 sm:w-[340px]">
                        <button
                          type="button"
                          onClick={() => toggleStageCollapse(group.stageId)}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#0A0A0A]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#0A0A0A]" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-[#0A0A0A]">
                              {group.title}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#525252]">
                              <span>{group.tasks.length} подэт.</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={
                                  group.isPaid
                                    ? 'font-semibold text-[#15803D]'
                                    : 'text-[#525252]'
                                }
                              >
                                {group.isPaid ? 'Оплачено' : 'Ожидается'}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
                            {group.avgProgress}%
                          </span>
                          {group.stageId !== '__orphans__' && (
                            <button
                              type="button"
                              onClick={() => openAddTask(group.stageId)}
                              className="flex h-6 w-6 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
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
                            className="pointer-events-none absolute top-0 bottom-0 border-r border-[#E0E0E0]"
                          />
                        ))}

                        {/* Today Marker Line */}
                        {calendar.todayPct >= 0 && calendar.todayPct <= 100 && (
                          <div
                            style={{ left: `${calendar.todayPct}%` }}
                            className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-[#0A0A0A]"
                          />
                        )}

                        {/* Architectural Bracket Summary Bar */}
                        {summaryLeft !== null && summaryWidth !== null && (
                          <div
                            style={{ left: `${summaryLeft}%`, width: `${summaryWidth}%` }}
                            className="absolute top-1/2 h-2.5 -translate-y-1/2 border-x-2 border-t-2 border-[#0A0A0A]"
                          >
                            <div
                              className="h-full bg-[#0A0A0A]/25"
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
                          <div className="sticky left-0 z-20 w-[300px] shrink-0 border-r border-[#0A0A0A] bg-white px-10 py-3 text-xs text-[#737373] sm:w-[340px]">
                            Нет подэтапов
                          </div>
                          <div className="flex-1" />
                        </div>
                      ) : (
                        <div className="divide-y divide-[#D4D4D4]">
                          {group.tasks.map((task) => {
                            const member = memberMap.get(task.assigneeId);
                            const geo = computeTaskGeometry(task);
                            const overrunLabel = `+${geo.overrunDays} дн.`;
                            const showOverrunInside =
                              geo.tailWidth !== null && geo.tailWidth >= 6.5;

                            return (
                              <div
                                key={task.id}
                                className="group flex bg-white transition-colors hover:bg-[#F4F4F4]"
                              >
                                {/* Sticky Left Task Cell */}
                                <div className="sticky left-0 z-20 flex w-[300px] shrink-0 flex-col justify-center border-r border-[#0A0A0A] bg-white py-3 pr-4 pl-9 transition-colors group-hover:bg-[#F4F4F4] sm:w-[340px]">
                                  <div className="flex items-start justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() => openEditTask(task)}
                                      className="text-left text-xs font-semibold text-[#0A0A0A] underline-offset-4 hover:underline"
                                    >
                                      {task.title}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditTask(task)}
                                      className="shrink-0 p-0.5 text-[#525252] opacity-75 hover:text-[#0A0A0A] hover:opacity-100"
                                      aria-label="Редактировать подэтап"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                                    <div className="flex items-center gap-1.5 text-[#525252]">
                                      <span className="font-mono font-bold text-[#0A0A0A]">
                                        {member ? member.code : '—'}
                                      </span>
                                      <span aria-hidden="true">·</span>
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
                                        className="h-1 w-12 cursor-pointer accent-[#0A0A0A]"
                                        aria-label={`Готовность ${task.title}`}
                                      />
                                      <span className="w-8 text-right font-mono font-bold tabular-nums text-[#0A0A0A]">
                                        {task.progress}%
                                      </span>
                                    </label>
                                  </div>

                                  {(geo.hasOverrun || task.delayReason !== 'none') && (
                                    <div
                                      className={`mt-1 text-[10px] font-bold ${
                                        task.delayReason === 'client'
                                          ? 'text-[#D97706]'
                                          : 'text-[#DC2626]'
                                      }`}
                                    >
                                      {task.delayReason === 'client'
                                        ? 'Ожидание обратной связи клиента'
                                        : 'Задержка студии'}
                                      {geo.hasOverrun ? ` · ${overrunLabel}` : ''}
                                    </div>
                                  )}
                                </div>

                                {/* Right Two-Layer Plan / Fact Canvas */}
                                <div
                                  onClick={() => openEditTask(task)}
                                  className="relative flex-1 cursor-pointer py-3"
                                  style={{ minWidth: `${calendar.timelineWidthPx}px`, minHeight: '70px' }}
                                >
                                  {/* Week Gridlines */}
                                  {calendar.weeks.map((w, idx) => (
                                    <div
                                      key={idx}
                                      style={{ left: `${w.leftPct}%`, width: `${w.widthPct}%` }}
                                      className="pointer-events-none absolute top-0 bottom-0 border-r border-[#E5E5E5]"
                                    />
                                  ))}

                                  {/* Vertical Today Line */}
                                  {calendar.todayPct >= 0 && calendar.todayPct <= 100 && (
                                    <div
                                      style={{ left: `${calendar.todayPct}%` }}
                                      className="pointer-events-none absolute top-0 bottom-0 z-10 w-[1.5px] bg-[#0A0A0A]"
                                    />
                                  )}

                                  {/* LAYER 1 (Top): Graphic Black-Outlined Hatched PLAN Strip */}
                                  <div className="relative h-4">
                                    {geo.planLeft !== null && geo.planWidth !== null && (
                                      <div
                                        style={{
                                          left: `${geo.planLeft}%`,
                                          width: `${geo.planWidth}%`,
                                        }}
                                        title={`План: ${formatDate(task.planStart)} — ${formatDate(task.planEnd)}`}
                                        className="gantt-plan-hatch absolute top-0.5 h-3 border border-[#0A0A0A]"
                                      />
                                    )}
                                  </div>

                                  {/* LAYER 2 (Bottom): High-Contrast Solid FACT Bar + Red Overrun Tail */}
                                  <div className="relative mt-1.5 h-5">
                                    {/* Base Actual Segment (within plan) */}
                                    {geo.baseLeft !== null && geo.baseWidth !== null && (
                                      <div
                                        style={{
                                          left: `${geo.baseLeft}%`,
                                          width: `${geo.baseWidth}%`,
                                        }}
                                        title={`Факт: ${formatDate(geo.actStartStr)} — ${formatDate(geo.actEndStr)} · ${task.progress}%`}
                                        className="absolute top-0 h-4 overflow-hidden border border-[#0A0A0A] bg-[#F4F4F4]"
                                      >
                                        <div
                                          className={`h-full ${geo.mainFillColorClass}`}
                                          style={{ width: `${task.progress}%` }}
                                        />
                                        <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center font-mono text-[9px] font-bold tabular-nums text-white mix-blend-difference">
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
                                          className={`absolute top-0 flex h-4 items-center overflow-hidden ${geo.tailColorClass}`}
                                        >
                                          {showOverrunInside && (
                                            <span className="truncate px-1.5 font-mono text-[9px] font-bold tabular-nums text-white">
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
                                              )}% + 4px)`,
                                            }}
                                            className={`pointer-events-none absolute top-0 flex h-4 items-center font-mono text-[10px] font-bold tabular-nums whitespace-nowrap ${
                                              task.delayReason === 'client'
                                                ? 'text-[#D97706]'
                                                : 'text-[#DC2626]'
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
        <div className="divide-y divide-[#D4D4D4]">
          {grouped.map((group) => {
            const isCollapsed = !!collapsedStages[group.stageId];
            return (
              <div key={group.stageId}>
                <div className="flex items-center justify-between gap-3 bg-[#F4F4F4] px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggleStageCollapse(group.stageId)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#0A0A0A]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#0A0A0A]" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0A0A0A]">{group.title}</div>
                      <div className="mt-0.5 text-[11px] text-[#525252]">
                        {group.tasks.length} подэт. ·{' '}
                        <span className={group.isPaid ? 'font-semibold text-[#15803D]' : 'text-[#525252]'}>
                          {group.isPaid ? 'Оплачено' : 'Ожидается оплата'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-xs font-bold tabular-nums text-[#0A0A0A]">
                      {group.avgProgress}%
                    </span>
                    {group.stageId !== '__orphans__' && (
                      <button
                        type="button"
                        onClick={() => openAddTask(group.stageId)}
                        className="flex h-7 w-7 items-center justify-center border border-[#0A0A0A] bg-white text-[#0A0A0A]"
                        aria-label="Добавить подэтап"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-[#D4D4D4]">
                    {group.tasks.map((task) => {
                      const member = memberMap.get(task.assigneeId);
                      const geo = computeTaskGeometry(task);
                      return (
                        <div
                          key={task.id}
                          onClick={() => openEditTask(task)}
                          className="cursor-pointer bg-white px-5 py-4 transition-colors hover:bg-[#F4F4F4]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#0A0A0A]">
                                {task.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#525252]">
                                <span className="font-mono font-bold text-[#0A0A0A]">
                                  {member ? `${member.code} · ${member.roleTitle}` : 'Исполнитель не назначен'}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-sm font-bold tabular-nums text-[#0A0A0A] shrink-0">
                              {task.progress}%
                            </span>
                          </div>

                          {/* Dual Plan vs Fact Dates Row */}
                          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                            <div>
                              <span className="text-[#525252]">План: </span>
                              <span className="font-mono font-medium tabular-nums text-[#0A0A0A]">
                                {formatShortDate(task.planStart)} — {formatShortDate(task.planEnd)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#525252]">Факт: </span>
                              <span className="font-mono font-medium tabular-nums text-[#0A0A0A]">
                                {task.actualStart
                                  ? `${formatShortDate(task.actualStart)} — ${task.actualEnd ? formatShortDate(task.actualEnd) : 'в работе'}`
                                  : 'не начато'}
                              </span>
                            </div>
                          </div>

                          {/* Progress + Overrun Indicator Strip */}
                          <div className="mt-2.5 flex h-2 w-full overflow-hidden border border-[#0A0A0A] bg-[#F4F4F4]">
                            <div
                              className={`h-full ${geo.mainFillColorClass}`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>

                          {(geo.hasOverrun || task.delayReason !== 'none') && (
                            <div
                              className={`mt-2 text-[11px] font-bold ${
                                task.delayReason === 'client'
                                  ? 'text-[#D97706]'
                                  : 'text-[#DC2626]'
                              }`}
                            >
                              {task.delayReason === 'client'
                                ? 'Сдвиг: ждём обратную связь от заказчика'
                                : 'Сдвиг: задержка студии'}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg border border-[#0A0A0A] bg-white p-6">
            <div className="flex items-center justify-between border-b border-[#0A0A0A] pb-3">
              <h3 className="text-sm font-bold text-[#0A0A0A]">
                {isAddingTask ? 'Новый рабочий подэтап' : 'Редактирование подэтапа'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-[#525252] hover:text-[#0F0F0F]"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#525252]">Название подэтапа *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Например: Визы кухни и санузлов"
                  className="h-10 w-full border border-[#D4D4D4] bg-white px-3 text-sm text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-[#525252]">Этап оплаты КП</label>
                  <select
                    value={editingTask.paymentStageId}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, paymentStageId: e.target.value })
                    }
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                  >
                    {project.paymentStages.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {ps.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[#525252]">Исполнитель (роль)</label>
                  <select
                    value={editingTask.assigneeId}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, assigneeId: e.target.value })
                    }
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
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
                  <label className="mb-1 block text-xs text-[#525252]">План · начало</label>
                  <input
                    type="date"
                    value={editingTask.planStart}
                    onChange={(e) => setEditingTask({ ...editingTask, planStart: e.target.value })}
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#525252]">План · завершение</label>
                  <input
                    type="date"
                    value={editingTask.planEnd}
                    onChange={(e) => setEditingTask({ ...editingTask, planEnd: e.target.value })}
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#525252]">Факт · начало</label>
                  <input
                    type="date"
                    value={editingTask.actualStart}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, actualStart: e.target.value })
                    }
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#525252]">Факт · завершение</label>
                  <input
                    type="date"
                    value={editingTask.actualEnd}
                    onChange={(e) => setEditingTask({ ...editingTask, actualEnd: e.target.value })}
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 font-mono text-xs text-[#0F0F0F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 flex items-center justify-between text-xs text-[#525252]">
                    <span>Готовность</span>
                    <span className="font-mono font-semibold tabular-nums text-[#0F0F0F]">
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
                    className="mt-2 w-full accent-[#0F0F0F]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[#525252]">Причина сдвига срока</label>
                  <select
                    value={editingTask.delayReason}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        delayReason: e.target.value as DelayReason,
                      })
                    }
                    className="h-10 w-full border border-[#D4D4D4] bg-white px-2.5 text-xs text-[#0F0F0F]"
                  >
                    <option value="none">В графике (нет задержки)</option>
                    <option value="client">Ждём обратную связь от заказчика</option>
                    <option value="studio">Задержка студии</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#525252]">
                  Внутренняя заметка (скрыта от клиента)
                </label>
                <textarea
                  rows={2}
                  value={editingTask.internalNote}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, internalNote: e.target.value })
                  }
                  placeholder="Комментарий по правкам, подрядчикам или согласованиям..."
                  className="w-full border border-[#D4D4D4] bg-white p-2.5 text-xs text-[#0F0F0F] focus:border-[#0F0F0F] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between border-t border-[#E5E5E5] pt-4">
                {!isAddingTask ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="flex min-h-[38px] items-center gap-1.5 border border-[#FECACA] bg-white px-3 text-xs font-medium text-[#B91C1C] hover:bg-[#FEF2F2]"
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
                    className="min-h-[38px] border border-[#D4D4D4] bg-white px-4 text-xs font-medium text-[#0F0F0F]"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="min-h-[38px] bg-[#0F0F0F] px-5 text-xs font-medium text-white hover:bg-[#262626]"
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
