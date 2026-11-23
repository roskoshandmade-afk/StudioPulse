import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ClientView } from './components/ClientView';
import { DataBackupModal } from './components/DataBackupModal';
import { Header, WorkspaceTab } from './components/Header';
import { ProjectDetailView } from './components/ProjectDetailView';
import { ProjectModal } from './components/ProjectModal';
import { StudioPulseView } from './components/StudioPulseView';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { TeamView } from './components/TeamView';
import { Toast, ToastMessage } from './components/Toast';
import { WorklogSection } from './components/WorklogSection';
import { createDemoData, createEmptyData } from './data/demoData';
import {
  AppData,
  DirectExpense,
  Project,
  ProjectStatus,
  StudioSettings,
  TeamMember,
  UserRole,
  WorklogEntry,
} from './types';
import {
  buildClientShareUrl,
  ClientSnapshot,
  copyToClipboard,
  loadAppData,
  loadSyncMeta,
  LocalSyncMeta,
  markSyncCompleted,
  parseClientUrlParams,
  saveLocalMutation,
  saveRemoteSnapshot,
} from './utils/storage';
import { exportProjectFinancialPdf } from './utils/exportProjectPdf';
import {
  fetchStudioState,
  RealtimeStatus,
  saveStudioStateRemote,
  subscribeStudioState,
  SupabaseSyncError,
  SyncStatus,
} from './utils/supabaseSync';

export default function App() {
  const urlClientState = useMemo(() => parseClientUrlParams(), []);

  const [data, setData] = useState<AppData>(() => loadAppData());
  const [syncMeta, setSyncMeta] = useState<LocalSyncMeta>(() => loadSyncMeta());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting'
  );
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('idle');
  const [lastSyncError, setLastSyncError] = useState<SupabaseSyncError | null>(null);
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [role, setRole] = useState<UserRole>(
    urlClientState.isLockedClient ? 'client' : 'director'
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    urlClientState.projectId
  );

  // Offline-First synchronization refs & mutex
  const mountedRef = useRef(true);
  const isSyncingRef = useRef(false);
  const needsResyncAfterCurrentRef = useRef(false);
  const realtimeAcceptingRef = useRef(false);
  const restConnectedRef = useRef(false);
  const lastSyncedJsonRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  const latestDataRef = useRef<AppData>(data);
  const syncMetaRef = useRef<LocalSyncMeta>(syncMeta);

  latestDataRef.current = data;
  syncMetaRef.current = syncMeta;

  // Modals & notifications
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Подтвердить',
    danger: false,
    onConfirm: () => {},
  });

  const notify = useCallback((text: string, type: 'default' | 'error' = 'default') => {
    const id = Date.now();
    setToast({ id, text, type });
    window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    }, 3400);
  }, []);

  /**
   * Core mutex-guarded upload of local state to Supabase `public.studio_state` (`id = 'main'`).
   * - Never clears `hasPendingChanges` until Supabase responds with `!error`.
   * - Never enables incoming Realtime events until upload is confirmed by server.
   * - If additional edits occurred mid-flight, automatically runs one more upload pass.
   */
  const pushLocalChangesToCloud = useCallback(
    async (options?: {
      force?: boolean;
      notifyOfflineFlush?: boolean;
    }): Promise<{ ok: boolean; error?: SupabaseSyncError }> => {
      if (urlClientState.isLockedClient) {
        return { ok: true };
      }

      // If browser reports offline, keep dirty flag intact and never lose local edits
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        restConnectedRef.current = false;
        realtimeAcceptingRef.current = false;
        if (mountedRef.current) {
          setSyncStatus('offline');
        }
        return { ok: false };
      }

      // Mutex: prevent two parallel conflicting sync requests on flickering network
      if (isSyncingRef.current) {
        needsResyncAfterCurrentRef.current = true;
        return { ok: false };
      }

      const pendingBeforePush = syncMetaRef.current.pendingCount;
      if (!options?.force && !syncMetaRef.current.hasPendingChanges) {
        return { ok: true };
      }

      isSyncingRef.current = true;
      realtimeAcceptingRef.current = false;
      needsResyncAfterCurrentRef.current = false;

      if (mountedRef.current) {
        setIsSyncing(true);
        setSyncStatus('syncing');
      }

      try {
        // Loop handles new local edits made while the previous upsert was in flight
        while (true) {
          const snapshot = latestDataRef.current;
          const snapshotUpdatedAt = syncMetaRef.current.localUpdatedAt;
          const serialized = JSON.stringify(snapshot);

          const res = await saveStudioStateRemote(snapshot);
          if (!mountedRef.current) {
            return { ok: res.ok, error: res.error };
          }

          if (!res.ok) {
            // Keep `hasPendingChanges = true` and `pendingCount` intact in localStorage
            restConnectedRef.current = false;
            realtimeAcceptingRef.current = false;
            setLastSyncError(res.error || null);
            setSyncStatus('offline');
            return { ok: false, error: res.error };
          }

          // Check whether newer local edits arrived while this request was in flight
          const editedDuringFlight =
            syncMetaRef.current.localUpdatedAt > snapshotUpdatedAt ||
            needsResyncAfterCurrentRef.current;

          if (editedDuringFlight) {
            needsResyncAfterCurrentRef.current = false;
            continue;
          }

          // Server confirmed `!error` and no newer local mutations exist -> clear dirty flag
          lastSyncedJsonRef.current = serialized;
          restConnectedRef.current = true;
          const clearedMeta = markSyncCompleted(Date.now());
          syncMetaRef.current = clearedMeta;
          setSyncMeta(clearedMeta);
          setLastSyncError(null);
          // ONLY AFTER server confirmation do we re-enable incoming Realtime updates
          realtimeAcceptingRef.current = true;
          setSyncStatus('online');

          if (options?.notifyOfflineFlush && pendingBeforePush > 0) {
            notify(`Офлайн-изменения (${pendingBeforePush}) успешно отправлены в облако`);
          }

          return { ok: true };
        }
      } finally {
        isSyncingRef.current = false;
        if (mountedRef.current) {
          setIsSyncing(false);
        }
      }
    },
    [notify, urlClientState.isLockedClient]
  );

  /**
   * Strict Offline-First reconciliation on startup, `window 'online'`, or Realtime reconnect:
   * 1. ALWAYS check `hasPendingChanges` first.
   * 2. If `hasPendingChanges === true`: FORBIDDEN to pull from Supabase! Push local state first,
   *    wait for confirmation, clear `hasPendingChanges = false`, and ONLY THEN accept Realtime.
   * 3. If `hasPendingChanges === false`: pull fresh state from Supabase to receive teammates' edits.
   */
  const reconcileWithCloud = useCallback(
    async (reason: 'startup' | 'online' | 'realtime-reconnect') => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        restConnectedRef.current = false;
        realtimeAcceptingRef.current = false;
        if (mountedRef.current) {
          setSyncStatus('offline');
        }
        return;
      }

      // Mutex guard against flickering network triggering parallel syncs
      if (isSyncingRef.current) {
        needsResyncAfterCurrentRef.current = true;
        return;
      }

      // Re-read authoritative dirty flag from localStorage/ref
      const currentMeta = loadSyncMeta();
      syncMetaRef.current = currentMeta;
      if (mountedRef.current) {
        setSyncMeta(currentMeta);
      }

      // STEP 1 & 2: If there are pending local edits, NEVER download over them — push FIRST!
      if (currentMeta.hasPendingChanges && !urlClientState.isLockedClient) {
        realtimeAcceptingRef.current = false;
        await pushLocalChangesToCloud({
          force: true,
          notifyOfflineFlush: reason === 'online' || reason === 'realtime-reconnect',
        });
        return;
      }

      // STEP 3: No pending local changes -> safe to fetch latest cloud state from teammates
      isSyncingRef.current = true;
      realtimeAcceptingRef.current = false;
      needsResyncAfterCurrentRef.current = false;

      if (mountedRef.current) {
        setIsSyncing(true);
        setSyncStatus(reason === 'startup' ? 'connecting' : 'syncing');
      }

      let shouldPushAfterFetch = false;

      try {
        const res = await fetchStudioState();
        if (!mountedRef.current) return;

        // Race check: if user made a local edit while fetchStudioState was in flight,
        // ABORT applying remote data and push local changes instead!
        if (syncMetaRef.current.hasPendingChanges || needsResyncAfterCurrentRef.current) {
          shouldPushAfterFetch = true;
          return;
        }

        if (!res.ok) {
          restConnectedRef.current = false;
          realtimeAcceptingRef.current = false;
          setLastSyncError(res.error || null);
          setSyncStatus('offline');
          return;
        }

        setLastSyncError(null);

        if (res.data) {
          const isUntouchedLegacyV1Demo =
            !urlClientState.isLockedClient &&
            (res.data.version || 1) < 2 &&
            res.data.projects.length === 1 &&
            res.data.projects[0]?.id === 'proj_demo_presnya' &&
            Boolean(res.data.projects[0]?.isDemo);

          if (isUntouchedLegacyV1Demo) {
            const upgradedDemo = createDemoData();
            setSyncStatus('syncing');
            const upgradeRes = await saveStudioStateRemote(upgradedDemo);
            if (!mountedRef.current) return;

            if (upgradeRes.ok) {
              const syncedMeta = saveRemoteSnapshot(upgradedDemo);
              latestDataRef.current = upgradedDemo;
              syncMetaRef.current = syncedMeta;
              lastSyncedJsonRef.current = JSON.stringify(upgradedDemo);
              restConnectedRef.current = true;
              realtimeAcceptingRef.current = true;
              setData(upgradedDemo);
              setSyncMeta(syncedMeta);
              setLastSyncError(null);
              setSyncStatus('online');
            } else {
              const dirtyMeta = saveLocalMutation(upgradedDemo, true);
              latestDataRef.current = upgradedDemo;
              syncMetaRef.current = dirtyMeta;
              restConnectedRef.current = false;
              realtimeAcceptingRef.current = false;
              setData(upgradedDemo);
              setSyncMeta(dirtyMeta);
              setLastSyncError(upgradeRes.error || null);
              setSyncStatus('offline');
            }
          } else {
            const remoteJson = JSON.stringify(res.data);
            const syncedMeta = saveRemoteSnapshot(res.data);
            latestDataRef.current = res.data;
            syncMetaRef.current = syncedMeta;
            lastSyncedJsonRef.current = remoteJson;
            restConnectedRef.current = true;
            realtimeAcceptingRef.current = true;
            setData(res.data);
            setSyncMeta(syncedMeta);
            setSyncStatus('online');
          }
        } else {
          // New/empty `public.studio_state` (no `id = 'main'` row or empty payload):
          // Guarantee valid starter state locally and seed the remote table cleanly without failing.
          const currentLocal = latestDataRef.current;
          const hasValidLocal =
            currentLocal &&
            Array.isArray(currentLocal.projects) &&
            Array.isArray(currentLocal.team);
          const seedData = hasValidLocal ? currentLocal : createDemoData();

          if (!hasValidLocal) {
            latestDataRef.current = seedData;
            setData(seedData);
          }

          if (urlClientState.isLockedClient) {
            restConnectedRef.current = true;
            realtimeAcceptingRef.current = true;
            setSyncStatus('online');
          } else {
            setSyncStatus('syncing');
            const seedRes = await saveStudioStateRemote(seedData);
            if (!mountedRef.current) return;

            // If user made local edits while initial seeding was in flight, push those next
            if (syncMetaRef.current.hasPendingChanges || needsResyncAfterCurrentRef.current) {
              shouldPushAfterFetch = true;
              return;
            }

            if (seedRes.ok) {
              const syncedMeta = saveRemoteSnapshot(seedData);
              syncMetaRef.current = syncedMeta;
              lastSyncedJsonRef.current = JSON.stringify(seedData);
              restConnectedRef.current = true;
              realtimeAcceptingRef.current = true;
              setSyncMeta(syncedMeta);
              setLastSyncError(null);
              setSyncStatus('online');
            } else {
              restConnectedRef.current = false;
              realtimeAcceptingRef.current = false;
              setLastSyncError(seedRes.error || null);
              setSyncStatus('offline');
            }
          }
        }
      } finally {
        isSyncingRef.current = false;
        if (mountedRef.current) {
          setIsSyncing(false);
        }
      }

      if (shouldPushAfterFetch && mountedRef.current) {
        needsResyncAfterCurrentRef.current = false;
        void pushLocalChangesToCloud({ force: true });
      }
    },
    [pushLocalChangesToCloud, urlClientState.isLockedClient]
  );

  const schedulePushToCloud = useCallback(() => {
    if (urlClientState.isLockedClient) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      restConnectedRef.current = false;
      realtimeAcceptingRef.current = false;
      setSyncStatus('offline');
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSyncStatus('syncing');
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void pushLocalChangesToCloud();
    }, 200);
  }, [pushLocalChangesToCloud, urlClientState.isLockedClient]);

  /**
   * Single entry point for ALL local user mutations.
   * Synchronously saves to localStorage with `localUpdatedAt`, `hasPendingChanges: true`, `pendingCount + 1`,
   * blocks incoming Realtime overwrites, and immediately triggers cloud sync if online.
   */
  const applyLocalChange = useCallback(
    (updater: AppData | ((prev: AppData) => AppData)) => {
      const prev = latestDataRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;

      const nextMeta = saveLocalMutation(next, true);
      latestDataRef.current = next;
      syncMetaRef.current = nextMeta;
      realtimeAcceptingRef.current = false;

      setData(next);
      setSyncMeta(nextMeta);

      schedulePushToCloud();
    },
    [schedulePushToCloud]
  );

  const handleForcePushLocalToCloud = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const res = await pushLocalChangesToCloud({ force: true });
    if (res.ok) {
      notify('Локальные данные принудительно отправлены в Supabase');
    } else if (res.error) {
      notify(res.error.humanHint, 'error');
    } else {
      notify('Нет подключения к сети. Данные сохранены локально.', 'error');
    }
    return res;
  }, [notify, pushLocalChangesToCloud]);

  // 1. Track component lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // 2. Startup reconciliation + Realtime subscription with strict dirty-flag gate
  useEffect(() => {
    let active = true;
    restConnectedRef.current = false;
    realtimeAcceptingRef.current = false;

    void reconcileWithCloud('startup');

    const unsubscribe = subscribeStudioState(
      (remoteData) => {
        if (!active) return;

        // STRICT GATE: Never overwrite local state while there are pending offline changes,
        // an active sync is in progress, or Realtime intake has not been unlocked yet.
        if (
          syncMetaRef.current.hasPendingChanges ||
          isSyncingRef.current ||
          !realtimeAcceptingRef.current
        ) {
          return;
        }

        const remoteJson = JSON.stringify(remoteData);
        if (remoteJson === lastSyncedJsonRef.current) {
          return;
        }

        lastSyncedJsonRef.current = remoteJson;
        restConnectedRef.current = true;
        latestDataRef.current = remoteData;
        const syncedMeta = saveRemoteSnapshot(remoteData);
        syncMetaRef.current = syncedMeta;
        setSyncMeta(syncedMeta);
        setData(remoteData);
        setLastSyncError(null);
        setSyncStatus('online');
      },
      (rtStatus) => {
        if (!active) return;
        setRealtimeStatus(rtStatus);
        if (rtStatus === 'subscribed') {
          // On Realtime reconnect: reconcile using strict dirty-flag-first rule!
          if (syncMetaRef.current.hasPendingChanges || !restConnectedRef.current) {
            void reconcileWithCloud('realtime-reconnect');
          } else {
            realtimeAcceptingRef.current = true;
            setSyncStatus((curr) => (curr === 'syncing' ? curr : 'online'));
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [reconcileWithCloud, syncGeneration]);

  // 3. Browser online / offline event listeners (strict Offline-First recovery)
  useEffect(() => {
    const handleOnline = () => {
      void reconcileWithCloud('online');
    };

    const handleOffline = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      restConnectedRef.current = false;
      realtimeAcceptingRef.current = false;
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reconcileWithCloud]);

  // 4. Protect against closing/reloading tab while unsynced changes or active sync exist
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (syncMetaRef.current.hasPendingChanges || isSyncingRef.current) {
        const message =
          'Не все изменения успели отправиться в облако. Вы уверены, что хотите закрыть страницу?';
        event.preventDefault();
        event.returnValue = message;
        return message;
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const selectedProject = useMemo(
    () => data.projects.find((p) => p.id === selectedProjectId) || null,
    [data.projects, selectedProjectId]
  );

  const clientViewProject = useMemo(() => {
    if (urlClientState.isLockedClient) {
      if (urlClientState.projectId) {
        const matched = data.projects.find((p) => p.id === urlClientState.projectId);
        if (matched) return matched;
      }
      if (urlClientState.snapshot) {
        return urlClientState.snapshot;
      }
      return null;
    }
    if (selectedProject) return selectedProject;
    return data.projects[0] || null;
  }, [selectedProject, urlClientState, data.projects]);

  const handleCopyClientLink = useCallback(
    async (projectOverride?: Project) => {
      const target = projectOverride || selectedProject || data.projects[0];
      if (!target) {
        notify('Создайте проект, чтобы сформировать ссылку для клиента', 'error');
        return;
      }
      const shareUrl = buildClientShareUrl(target);
      const ok = await copyToClipboard(shareUrl);
      if (ok) {
        notify(`Ссылка для клиента скопирована (${target.name})`);
      } else {
        notify('Не удалось скопировать ссылку автоматически', 'error');
      }
    },
    [selectedProject, data.projects, notify]
  );

  const handleExportPdf = useCallback(
    async (target: Project | ClientSnapshot) => {
      try {
        await exportProjectFinancialPdf(target);
        notify(`PDF-отчёт сформирован (${target.name})`);
      } catch (err) {
        notify(
          err instanceof Error
            ? `Ошибка создания PDF: ${err.message}`
            : 'Не удалось сформировать PDF-отчёт',
          'error'
        );
      }
    },
    [notify]
  );

  // Project CRUD
  const handleSaveProject = (project: Project, isNew: boolean) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: isNew
        ? [project, ...prev.projects]
        : prev.projects.map((p) => (p.id === project.id ? project : p)),
    }));
    if (isNew) {
      setSelectedProjectId(project.id);
      setActiveTab('projects');
      notify(`Проект «${project.name}» создан`);
    } else {
      notify('Изменения проекта сохранены');
    }
  };

  const handleUpdateProject = (updated: Project) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === updated.id ? updated : p)),
    }));
  };

  const handleQuickStatusChange = (projectId: string, status: ProjectStatus) => {
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === projectId ? { ...p, status } : p)),
    }));
    notify(`Статус обновлён: ${status}`);
  };

  const requestDeleteProject = (project: Project) => {
    setConfirmState({
      open: true,
      title: 'Удалить объект?',
      description: `Проект «${project.name}», его этапы, задачи Ганта и связанные записи журнала будут удалены без возможности восстановления.`,
      confirmLabel: 'Удалить проект',
      danger: true,
      onConfirm: () => {
        applyLocalChange((prev) => ({
          ...prev,
          projects: prev.projects.filter((p) => p.id !== project.id),
          worklogs: prev.worklogs.filter((w) => w.projectId !== project.id),
          expenses: prev.expenses.filter((e) => e.projectId !== project.id),
        }));
        if (selectedProjectId === project.id) {
          setSelectedProjectId(null);
        }
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Проект удалён');
      },
    });
  };

  const handleDeleteAllDemo = () => {
    const demoIds = new Set(
      data.projects
        .filter((p) => p.isDemo || p.name.includes('[ДЕМО]'))
        .map((p) => p.id)
    );
    applyLocalChange((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => !demoIds.has(p.id)),
      worklogs: prev.worklogs.filter((w) => !demoIds.has(w.projectId)),
      expenses: prev.expenses.filter((e) => !demoIds.has(e.projectId)),
    }));
    if (selectedProjectId && demoIds.has(selectedProjectId)) {
      setSelectedProjectId(null);
    }
    notify('Демо-шаблон удалён. Можно создавать ваши проекты');
  };

  // Team CRUD
  const handleAddMember = (member: TeamMember) => {
    applyLocalChange((prev) => ({ ...prev, team: [...prev.team, member] }));
    notify(`Добавлена должность: ${member.roleTitle}`);
  };

  const handleUpdateMember = (member: TeamMember) => {
    applyLocalChange((prev) => ({
      ...prev,
      team: prev.team.map((m) => (m.id === member.id ? member : m)),
    }));
    notify('Данные должности обновлены');
  };

  const requestDeleteMember = (member: TeamMember) => {
    setConfirmState({
      open: true,
      title: 'Удалить позицию команды?',
      description: `Должность «${member.roleTitle}» будет удалена из справочника. Существующие записи журнала останутся в истории.`,
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: () => {
        applyLocalChange((prev) => ({
          ...prev,
          team: prev.team.filter((m) => m.id !== member.id),
        }));
        setConfirmState((s) => ({ ...s, open: false }));
        notify('Должность удалена');
      },
    });
  };

  const handleUpdateSettings = (settings: StudioSettings) => {
    applyLocalChange((prev) => ({ ...prev, settings }));
    notify(`Лимит ФОТ обновлён: ${settings.defaultFotLimitPercent}%`);
  };

  // Worklogs & Expenses CRUD
  const handleAddWorklog = (entry: WorklogEntry) => {
    applyLocalChange((prev) => ({ ...prev, worklogs: [entry, ...prev.worklogs] }));
    notify('Запись выработки добавлена');
  };

  const handleUpdateWorklog = (entry: WorklogEntry) => {
    applyLocalChange((prev) => ({
      ...prev,
      worklogs: prev.worklogs.map((w) => (w.id === entry.id ? entry : w)),
    }));
    notify('Запись выработки обновлена');
  };

  const handleDeleteWorklog = (id: string) => {
    applyLocalChange((prev) => ({
      ...prev,
      worklogs: prev.worklogs.filter((w) => w.id !== id),
    }));
    notify('Запись выработки удалена');
  };

  const handleAddExpense = (expense: DirectExpense) => {
    applyLocalChange((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    notify('Прямой расход добавлен');
  };

  const handleUpdateExpense = (expense: DirectExpense) => {
    applyLocalChange((prev) => ({
      ...prev,
      expenses: prev.expenses.map((e) => (e.id === expense.id ? expense : e)),
    }));
    notify('Расход обновлён');
  };

  const handleDeleteExpense = (id: string) => {
    applyLocalChange((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    notify('Расход удалён');
  };

  // Locked Client View (opened via copied link ?view=client&project=...)
  if (urlClientState.isLockedClient) {
    return (
      <>
        <ClientView
          project={clientViewProject}
          isLockedClient={true}
          syncStatus={syncStatus}
          onExportPdf={handleExportPdf}
        />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      <Header
        role={role}
        activeTab={activeTab}
        selectedProjectName={selectedProject?.name}
        canCopyClientLink={data.projects.length > 0}
        syncStatus={syncStatus}
        hasPendingChanges={syncMeta.hasPendingChanges}
        pendingCount={syncMeta.pendingCount}
        syncErrorHint={lastSyncError?.humanHint}
        onRoleChange={(nextRole) => {
          setRole(nextRole);
          if (nextRole === 'client' && !selectedProjectId && data.projects[0]) {
            setSelectedProjectId(data.projects[0].id);
          }
        }}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'projects') {
            setSelectedProjectId(null);
          }
        }}
        onOpenNewProject={() => {
          setEditingProject(null);
          setProjectModalOpen(true);
        }}
        onCopyClientLink={() => handleCopyClientLink()}
        onOpenBackup={() => setBackupModalOpen(true)}
        onOpenSupabaseSettings={() => setSupabaseModalOpen(true)}
        onGoHome={() => {
          if (role !== 'client') {
            setActiveTab('projects');
            setSelectedProjectId(null);
          }
        }}
      />

      {role === 'client' ? (
        <ClientView
          project={clientViewProject}
          allProjects={data.projects}
          isLockedClient={false}
          syncStatus={syncStatus}
          onSelectPreviewProject={(id) => setSelectedProjectId(id)}
          onExportPdf={handleExportPdf}
        />
      ) : (
        <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          {/* Active Role Context Line */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-[#D4D4D4] pb-3 text-xs text-[#525252]">
            <div>
              Режим:{' '}
              <span className="font-semibold text-[#0A0A0A]">
                {role === 'director'
                  ? 'Руководитель (полный финансовый и операционный доступ)'
                  : 'Помощник (полный операционный и финансовый доступ)'}
              </span>
            </div>
            <div className="font-mono text-[11px] font-medium tabular-nums text-[#0A0A0A]">
              Лимит ФОТ: {data.settings.defaultFotLimitPercent}%
            </div>
          </div>

          {activeTab === 'projects' && selectedProject ? (
            <ProjectDetailView
              data={data}
              project={selectedProject}
              onBack={() => setSelectedProjectId(null)}
              onUpdateProject={handleUpdateProject}
              onEditProjectModal={(p) => {
                setEditingProject(p);
                setProjectModalOpen(true);
              }}
              onDeleteProject={requestDeleteProject}
              onCopyClientLink={(p) => handleCopyClientLink(p)}
              onExportPdf={handleExportPdf}
              onAddWorklog={handleAddWorklog}
              onUpdateWorklog={handleUpdateWorklog}
              onDeleteWorklog={handleDeleteWorklog}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          ) : activeTab === 'projects' ? (
            <StudioPulseView
              data={data}
              onSelectProject={(id) => setSelectedProjectId(id)}
              onOpenNewProject={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              onEditProject={(p) => {
                setEditingProject(p);
                setProjectModalOpen(true);
              }}
              onDeleteProject={requestDeleteProject}
              onDeleteAllDemo={handleDeleteAllDemo}
              onCopyClientLink={(p) => handleCopyClientLink(p)}
              onUpdateProjectStatus={handleQuickStatusChange}
              onOpenBackup={() => setBackupModalOpen(true)}
            />
          ) : activeTab === 'worklog' ? (
            <WorklogSection
              data={data}
              onAddWorklog={handleAddWorklog}
              onUpdateWorklog={handleUpdateWorklog}
              onDeleteWorklog={handleDeleteWorklog}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          ) : (
            <TeamView
              team={data.team}
              settings={data.settings}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={requestDeleteMember}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      )}

      {/* Modals */}
      <ProjectModal
        open={projectModalOpen}
        editingProject={editingProject}
        team={data.team}
        defaultFotLimitPercent={data.settings.defaultFotLimitPercent}
        onSave={handleSaveProject}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
      />

      <DataBackupModal
        open={backupModalOpen}
        data={data}
        syncStatus={syncStatus}
        onClose={() => setBackupModalOpen(false)}
        onOpenSupabaseSettings={() => setSupabaseModalOpen(true)}
        onImport={(imported) => {
          applyLocalChange(imported);
          setSelectedProjectId(null);
        }}
        onResetEmpty={() => {
          applyLocalChange(createEmptyData());
          setSelectedProjectId(null);
        }}
        onRestoreDemo={() => {
          applyLocalChange(createDemoData());
          setSelectedProjectId(null);
        }}
        onNotify={notify}
      />

      <SupabaseSettingsModal
        open={supabaseModalOpen}
        syncStatus={syncStatus}
        realtimeStatus={realtimeStatus}
        hasPendingChanges={syncMeta.hasPendingChanges}
        pendingCount={syncMeta.pendingCount}
        localUpdatedAt={syncMeta.localUpdatedAt}
        lastSyncedAt={syncMeta.lastSyncedAt}
        isSyncing={isSyncing}
        lastSyncError={lastSyncError}
        onClose={() => setSupabaseModalOpen(false)}
        onConfigApplied={() => setSyncGeneration((g) => g + 1)}
        onForcePushLocalToCloud={handleForcePushLocalToCloud}
        onNotify={notify}
      />

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        danger={confirmState.danger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
