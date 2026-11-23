import { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';
import {
  createSupabaseClientForConfig,
  getActiveSupabaseConfig,
  getSupabaseClient,
  supabase,
} from '../supabaseClient';
import { AppData } from '../types';

export type SyncStatus = 'connecting' | 'online' | 'syncing' | 'offline';
export type RealtimeStatus = 'idle' | 'connecting' | 'subscribed' | 'error';

export interface SupabaseSyncError {
  code?: string;
  status?: number;
  message: string;
  details?: string;
  hint?: string;
  humanHint: string;
}

export { supabase };

const TABLE_NAME = 'studio_state';
const ROW_ID = 'main';

export function formatSupabaseError(
  err: PostgrestError | Error | unknown,
  httpStatus?: number
): SupabaseSyncError {
  const pgErr = err as Partial<PostgrestError> & { status?: number; statusCode?: number };
  const code = typeof pgErr?.code === 'string' ? pgErr.code : undefined;
  const status =
    typeof httpStatus === 'number'
      ? httpStatus
      : typeof pgErr?.status === 'number'
      ? pgErr.status
      : typeof pgErr?.statusCode === 'number'
      ? pgErr.statusCode
      : undefined;
  const message =
    typeof pgErr?.message === 'string' && pgErr.message
      ? pgErr.message
      : err instanceof Error
      ? err.message
      : 'Неизвестная ошибка сети или Supabase';
  const details = typeof pgErr?.details === 'string' ? pgErr.details : undefined;
  const hint = typeof pgErr?.hint === 'string' ? pgErr.hint : undefined;

  const lower = `${code || ''} ${message} ${details || ''}`.toLowerCase();

  let humanHint = 'Проверьте Project URL, Anon Key и политики доступа в Supabase.';

  if (
    lower.includes('supabase client is not initialized') ||
    lower.includes('missing project url')
  ) {
    humanHint =
      'Не заданы переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Укажите их в .env / GitHub Secrets или введите вручную в настройках Supabase.';
  } else if (
    code === 'PGRST125' ||
    lower.includes('invalid path specified in request url')
  ) {
    humanHint =
      'Неверный формат Project URL: укажите базовый адрес проекта https://<project-ref>.supabase.co (без /rest/v1/).';
  } else if (
    code === '42P01' ||
    code === 'PGRST205' ||
    lower.includes('could not find the table') ||
    (lower.includes('relation') && lower.includes('does not exist'))
  ) {
    humanHint =
      'Таблица public.studio_state не найдена в базе. Выполните SQL-скрипт в Supabase SQL Editor.';
  } else if (
    code === '42501' ||
    status === 401 ||
    status === 403 ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    humanHint =
      'Запрос заблокирован политиками RLS или правами доступа (401/403). Выполните блок GRANT и CREATE POLICY в SQL Editor.';
  } else if (
    lower.includes('invalid api key') ||
    lower.includes('apikey') ||
    lower.includes('jwt')
  ) {
    humanHint =
      'Неверный Anon / Publishable Key. Скопируйте актуальный ключ из Supabase → Project Settings → API.';
  } else if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('offline') ||
    lower.includes('timeout') ||
    lower.includes('load failed') ||
    lower.includes('cors')
  ) {
    humanHint =
      'Нет ответа от сервера Supabase (офлайн или таймаут). Все правки надёжно сохранены локально и отправятся при восстановлении связи.';
  }

  return {
    code,
    status,
    message,
    details,
    hint,
    humanHint,
  };
}

function logSupabaseError(operation: string, formatted: SupabaseSyncError, rawError: unknown) {
  const cfg = getActiveSupabaseConfig();
  console.error(`[Студия Пульс][Supabase][${operation}] Request failed`, {
    url: cfg.url,
    configSource: cfg.source,
    code: formatted.code || 'NONE',
    status: formatted.status ?? 'N/A',
    message: formatted.message,
    details: formatted.details || null,
    hint: formatted.hint || null,
    diagnosis: formatted.humanHint,
    rawError,
  });
}

function normalizePayload(raw: unknown): AppData | null {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const candidate = parsed as Partial<AppData>;

  // Treat empty object {} or missing core arrays as uninitialized payload
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.team)) {
    return null;
  }

  return {
    version: typeof candidate.version === 'number' ? candidate.version : 2,
    settings:
      candidate.settings && typeof candidate.settings === 'object'
        ? {
            defaultFotLimitPercent:
              typeof candidate.settings.defaultFotLimitPercent === 'number' &&
              Number.isFinite(candidate.settings.defaultFotLimitPercent)
                ? candidate.settings.defaultFotLimitPercent
                : 45,
            studioName:
              typeof candidate.settings.studioName === 'string' && candidate.settings.studioName.trim()
                ? candidate.settings.studioName
                : 'Студия Пульс',
          }
        : {
            defaultFotLimitPercent: 45,
            studioName: 'Студия Пульс',
          },
    team: candidate.team,
    projects: candidate.projects,
    worklogs: Array.isArray(candidate.worklogs) ? candidate.worklogs : [],
    expenses: Array.isArray(candidate.expenses) ? candidate.expenses : [],
    proposals: Array.isArray(candidate.proposals) ? candidate.proposals : [],
  };
}

const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Превышено время ожидания ответа от Supabase (timeout)'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

export async function fetchStudioState(): Promise<{
  ok: boolean;
  data: AppData | null;
  rowExists?: boolean;
  error?: SupabaseSyncError;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const formatted = formatSupabaseError(new Error('Network offline (navigator.onLine === false)'));
    return { ok: false, data: null, error: formatted };
  }

  const client = getSupabaseClient();
  if (!client) {
    const formatted = formatSupabaseError(
      new Error('Supabase client is not initialized (invalid or missing URL / Anon Key)')
    );
    logSupabaseError('fetchStudioState', formatted, null);
    return { ok: false, data: null, error: formatted };
  }

  try {
    const { data, error, status } = await withTimeout(
      client
        .from(TABLE_NAME)
        .select('id, payload')
        .eq('id', ROW_ID)
        .maybeSingle()
    );

    if (error) {
      // PGRST116 = 0 rows returned on empty table -> treat safely as uninitialized DB, not a crash/error
      if (error.code === 'PGRST116') {
        return { ok: true, data: null, rowExists: false };
      }
      const formatted = formatSupabaseError(error, status);
      logSupabaseError('fetchStudioState', formatted, error);
      return { ok: false, data: null, error: formatted };
    }

    if (!data) {
      return { ok: true, data: null, rowExists: false };
    }

    if (!data.payload) {
      return { ok: true, data: null, rowExists: true };
    }

    return { ok: true, data: normalizePayload(data.payload), rowExists: true };
  } catch (err) {
    const formatted = formatSupabaseError(err);
    logSupabaseError('fetchStudioState', formatted, err);
    return {
      ok: false,
      data: null,
      error: formatted,
    };
  }
}

export async function saveStudioStateRemote(data: AppData): Promise<{
  ok: boolean;
  error?: SupabaseSyncError;
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const formatted = formatSupabaseError(new Error('Network offline (navigator.onLine === false)'));
    return { ok: false, error: formatted };
  }

  const client = getSupabaseClient();
  if (!client) {
    const formatted = formatSupabaseError(
      new Error('Supabase client is not initialized (invalid or missing URL / Anon Key)')
    );
    logSupabaseError('saveStudioStateRemote', formatted, null);
    return { ok: false, error: formatted };
  }

  try {
    const { error, status } = await withTimeout(
      client
        .from(TABLE_NAME)
        .upsert(
          {
            id: ROW_ID,
            payload: data,
          },
          { onConflict: 'id' }
        )
    );

    if (error) {
      const formatted = formatSupabaseError(error, status);
      logSupabaseError('saveStudioStateRemote', formatted, error);
      return { ok: false, error: formatted };
    }
    return { ok: true };
  } catch (err) {
    const formatted = formatSupabaseError(err);
    logSupabaseError('saveStudioStateRemote', formatted, err);
    return {
      ok: false,
      error: formatted,
    };
  }
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{
  ok: boolean;
  latencyMs: number;
  rowExists?: boolean;
  error?: SupabaseSyncError;
}> {
  const startedAt = performance.now();
  const testClient = createSupabaseClientForConfig(url, anonKey);
  if (!testClient) {
    const formatted = formatSupabaseError(
      new Error('Некорректный формат Project URL (ожидается https://....supabase.co) или пустой Anon Key')
    );
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startedAt),
      error: formatted,
    };
  }

  try {
    const { data, error, status } = await testClient
      .from(TABLE_NAME)
      .select('id')
      .eq('id', ROW_ID)
      .maybeSingle();

    const latencyMs = Math.round(performance.now() - startedAt);

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          ok: true,
          latencyMs,
          rowExists: false,
        };
      }
      const formatted = formatSupabaseError(error, status);
      console.error('[Студия Пульс][Supabase][testConnection] Failed:', {
        url,
        code: formatted.code || 'NONE',
        status: formatted.status ?? 'N/A',
        message: formatted.message,
        details: formatted.details || null,
        hint: formatted.hint || null,
        rawError: error,
      });
      return { ok: false, latencyMs, error: formatted };
    }

    return {
      ok: true,
      latencyMs,
      rowExists: Boolean(data),
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const formatted = formatSupabaseError(err);
    console.error('[Студия Пульс][Supabase][testConnection] Network exception:', {
      url,
      message: formatted.message,
      rawError: err,
    });
    return { ok: false, latencyMs, error: formatted };
  }
}

export function subscribeStudioState(
  onRemoteData: (data: AppData) => void,
  onRealtimeStatus?: (status: RealtimeStatus, err?: unknown) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    onRealtimeStatus?.('error');
    return () => {};
  }

  let channel: RealtimeChannel | null = null;
  onRealtimeStatus?.('connecting');

  try {
    channel = client
      .channel(`supabase_realtime:studio_state:main:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_NAME,
          filter: `id=eq.${ROW_ID}`,
        },
        (payload) => {
          try {
            const nextRow = payload.new as { id?: string; payload?: unknown } | undefined;
            if (!nextRow || !nextRow.payload) return;
            const normalized = normalizePayload(nextRow.payload);
            if (normalized) {
              onRemoteData(normalized);
            }
          } catch (err) {
            console.error('[Студия Пульс][Supabase][Realtime] Malformed payload:', err);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          onRealtimeStatus?.('subscribed');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Студия Пульс][Supabase][Realtime] Subscription fallback to REST:', {
            status,
            error: err || 'Check Realtime publication (supabase_realtime) and RLS SELECT policy on studio_state',
          });
          onRealtimeStatus?.('error', err);
        } else if (status === 'CLOSED') {
          onRealtimeStatus?.('idle');
        }
      });
  } catch (err) {
    console.error('[Студия Пульс][Supabase][Realtime] Failed to subscribe:', err);
    onRealtimeStatus?.('error', err);
    return () => {};
  }

  return () => {
    try {
      if (channel) {
        void client.removeChannel(channel);
      }
    } catch {
      // Safe cleanup ignore
    }
  };
}
