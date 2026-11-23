import { createDemoData } from '../data/demoData';
import { AppData } from '../types';

export const STORAGE_KEY = 'limur_studio_os_sandbox_data_v1';
export const SYNC_META_KEY = 'limur_studio_os_sandbox_sync_meta_v1';

export interface LocalSyncMeta {
  localUpdatedAt: number;
  hasPendingChanges: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
}

const DEFAULT_SYNC_META: LocalSyncMeta = {
  localUpdatedAt: 0,
  hasPendingChanges: false,
  pendingCount: 0,
  lastSyncedAt: null,
};

export function loadSyncMeta(): LocalSyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { ...DEFAULT_SYNC_META };
    const parsed = JSON.parse(raw) as Partial<LocalSyncMeta>;
    const hasPendingChanges = Boolean(parsed?.hasPendingChanges);
    const rawPendingCount =
      typeof parsed?.pendingCount === 'number' && Number.isFinite(parsed.pendingCount)
        ? Math.max(0, Math.floor(parsed.pendingCount))
        : 0;

    return {
      localUpdatedAt:
        typeof parsed?.localUpdatedAt === 'number' && Number.isFinite(parsed.localUpdatedAt)
          ? parsed.localUpdatedAt
          : 0,
      hasPendingChanges,
      pendingCount: hasPendingChanges ? Math.max(1, rawPendingCount) : 0,
      lastSyncedAt:
        typeof parsed?.lastSyncedAt === 'number' && Number.isFinite(parsed.lastSyncedAt)
          ? parsed.lastSyncedAt
          : null,
    };
  } catch {
    return { ...DEFAULT_SYNC_META };
  }
}

export function saveSyncMeta(meta: LocalSyncMeta): void {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const demo = createDemoData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (
      !parsed ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.team) ||
      !Array.isArray(parsed.worklogs) ||
      !Array.isArray(parsed.expenses)
    ) {
      const demo = createDemoData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }

    // Seamlessly upgrade untouched v1 single demo project to the new v2 3-project studio portfolio
    const syncMeta = loadSyncMeta();
    const isUntouchedLegacyDemo =
      !syncMeta.hasPendingChanges &&
      (parsed.version || 1) < 2 &&
      parsed.projects.length === 1 &&
      parsed.projects[0]?.id === 'proj_demo_presnya';
    if (isUntouchedLegacyDemo) {
      const demo = createDemoData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
      return demo;
    }

    return {
      version: parsed.version || 2,
      settings: parsed.settings || {
        defaultFotLimitPercent: 45,
        studioName: 'LIMUR STUDIO OS',
      },
      team: parsed.team,
      projects: parsed.projects,
      worklogs: parsed.worklogs,
      expenses: parsed.expenses,
    };
  } catch {
    return createDemoData();
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Immediately persists a local user mutation to localStorage together with
 * exact timestamp, dirty flag (`hasPendingChanges: true`), and incremented `pendingCount`.
 */
export function saveLocalMutation(data: AppData, incrementPending = true): LocalSyncMeta {
  const prev = loadSyncMeta();
  const nextMeta: LocalSyncMeta = {
    localUpdatedAt: Date.now(),
    hasPendingChanges: true,
    pendingCount: incrementPending ? prev.pendingCount + 1 : Math.max(1, prev.pendingCount),
    lastSyncedAt: prev.lastSyncedAt,
  };
  saveAppData(data);
  saveSyncMeta(nextMeta);
  return nextMeta;
}

/**
 * Marks local changes as successfully synced to Supabase (`hasPendingChanges = false`, `pendingCount = 0`).
 */
export function markSyncCompleted(syncedAt = Date.now()): LocalSyncMeta {
  const prev = loadSyncMeta();
  const nextMeta: LocalSyncMeta = {
    localUpdatedAt: prev.localUpdatedAt || syncedAt,
    hasPendingChanges: false,
    pendingCount: 0,
    lastSyncedAt: syncedAt,
  };
  saveSyncMeta(nextMeta);
  return nextMeta;
}

/**
 * Persists a clean snapshot fetched from Supabase (only called when `hasPendingChanges === false`).
 */
export function saveRemoteSnapshot(data: AppData): LocalSyncMeta {
  const now = Date.now();
  const nextMeta: LocalSyncMeta = {
    localUpdatedAt: now,
    hasPendingChanges: false,
    pendingCount: 0,
    lastSyncedAt: now,
  };
  saveAppData(data);
  saveSyncMeta(nextMeta);
  return nextMeta;
}

export function exportDataToJson(data: AppData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `limur-studio-os-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseImportedJson(rawText: string): { ok: true; data: AppData } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText) as Partial<AppData>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Файл не является корректным JSON-объектом.' };
    }
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.team)) {
      return { ok: false, error: 'В файле отсутствуют обязательные разделы projects или team.' };
    }
    return {
      ok: true,
      data: {
        version: parsed.version || 1,
        settings: parsed.settings || {
          defaultFotLimitPercent: 40,
          studioName: 'LIMUR STUDIO OS',
        },
        team: parsed.team,
        projects: parsed.projects,
        worklogs: Array.isArray(parsed.worklogs) ? parsed.worklogs : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      },
    };
  } catch {
    return { ok: false, error: 'Не удалось прочитать JSON. Проверьте формат файла.' };
  }
}

export interface ClientSnapshot {
  id: string;
  name: string;
  address: string;
  areaSqm: number;
  status: AppData['projects'][number]['status'];
  links: AppData['projects'][number]['links'];
  paymentStages: AppData['projects'][number]['paymentStages'];
  workStages: Array<{
    id: string;
    paymentStageId: string;
    title: string;
    planStart: string;
    planEnd: string;
    actualStart: string;
    actualEnd: string;
    progress: number;
    delayReason: AppData['projects'][number]['workStages'][number]['delayReason'];
  }>;
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Utf8(encoded: string): string {
  const pad = encoded.length % 4 === 0 ? '' : '='.repeat(4 - (encoded.length % 4));
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function buildClientShareUrl(project: AppData['projects'][number]): string {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('view', 'client');
  url.searchParams.set('project', project.id);

  // Strip all internal notes, team/salary/cost info — strictly client-visible data
  const snapshot: ClientSnapshot = {
    id: project.id,
    name: project.name,
    address: project.address,
    areaSqm: project.areaSqm,
    status: project.status,
    links: project.links,
    paymentStages: project.paymentStages,
    workStages: project.workStages.map((ws) => ({
      id: ws.id,
      paymentStageId: ws.paymentStageId,
      title: ws.title,
      planStart: ws.planStart,
      planEnd: ws.planEnd,
      actualStart: ws.actualStart,
      actualEnd: ws.actualEnd,
      progress: ws.progress,
      delayReason: ws.delayReason,
    })),
  };

  try {
    const encoded = encodeBase64Utf8(JSON.stringify(snapshot));
    if (encoded.length < 6000) {
      url.hash = `snapshot=${encoded}`;
    }
  } catch {
    // Fallback to query params only
  }

  return url.toString();
}

export function parseClientUrlParams(): {
  isLockedClient: boolean;
  projectId: string | null;
  snapshot: ClientSnapshot | null;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const projectId = params.get('project');
    let snapshot: ClientSnapshot | null = null;

    if (window.location.hash.startsWith('#snapshot=')) {
      const encoded = window.location.hash.slice('#snapshot='.length);
      const parsed = JSON.parse(decodeBase64Utf8(encoded)) as ClientSnapshot;
      if (parsed && parsed.id && parsed.name) {
        snapshot = parsed;
      }
    }

    return {
      isLockedClient: view === 'client',
      projectId,
      snapshot,
    };
  } catch {
    return { isLockedClient: false, projectId: null, snapshot: null };
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
