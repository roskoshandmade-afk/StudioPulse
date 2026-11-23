import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare const __LIMUR_SUPABASE_URL__: string | undefined;
declare const __LIMUR_SUPABASE_ANON_KEY__: string | undefined;

export const DEFAULT_SANDBOX_SUPABASE_URL = 'https://vrnyoyezgtbijnwlsflc.supabase.co';
export const SUPABASE_CONFIG_STORAGE_KEY = 'limur_supabase_config_sandbox_v1';

export type SupabaseConfigSource = 'custom' | 'env' | 'unconfigured';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: SupabaseConfigSource;
}

function readNonEmpty(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = readNonEmpty(rawUrl).replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return trimmed;
    }

    // Standard Supabase hosted project URLs always use the origin (e.g. https://<ref>.supabase.co),
    // never /rest/v1, /realtime/v1, /auth/v1, etc.
    if (/\.supabase\.(co|in|net)$/i.test(parsed.hostname)) {
      return parsed.origin;
    }

    // For self-hosted or proxied Supabase instances, strip accidental Supabase API subpaths
    const cleanPath = parsed.pathname
      .replace(/\/(rest|realtime|auth|storage|functions|graphql)\/v1(\/.*)?$/i, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${cleanPath}`;
  } catch {
    return trimmed
      .replace(/\/(rest|realtime|auth|storage|functions|graphql)\/v1(\/.*)?$/i, '')
      .replace(/\/+$/, '');
  }
}

function readCustomConfigFromStorage(): { url: string; anonKey: string } | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(SUPABASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: unknown; anonKey?: unknown };
    const url = normalizeSupabaseUrl(readNonEmpty(parsed.url));
    const anonKey = readNonEmpty(parsed.anonKey);
    if (!url || !anonKey) return null;
    return { url, anonKey };
  } catch {
    return null;
  }
}

export function getBuildSupabaseConfig(): {
  url: string;
  anonKey: string;
  source: 'env' | 'unconfigured';
} {
  const rawEnvUrl =
    readNonEmpty(import.meta.env.VITE_SUPABASE_URL) ||
    readNonEmpty(typeof __LIMUR_SUPABASE_URL__ !== 'undefined' ? __LIMUR_SUPABASE_URL__ : '') ||
    DEFAULT_SANDBOX_SUPABASE_URL;
  const envUrl = normalizeSupabaseUrl(rawEnvUrl) || DEFAULT_SANDBOX_SUPABASE_URL;
  const envKey =
    readNonEmpty(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
    readNonEmpty(
      typeof __LIMUR_SUPABASE_ANON_KEY__ !== 'undefined' ? __LIMUR_SUPABASE_ANON_KEY__ : ''
    );

  if (envUrl && envKey) {
    return {
      url: envUrl,
      anonKey: envKey,
      source: 'env',
    };
  }

  return {
    url: envUrl,
    anonKey: envKey,
    source: 'unconfigured',
  };
}

export function getActiveSupabaseConfig(): SupabaseConfig {
  const custom = readCustomConfigFromStorage();
  if (custom) {
    return {
      url: custom.url,
      anonKey: custom.anonKey,
      source: 'custom',
    };
  }
  return getBuildSupabaseConfig();
}

export function createSupabaseClientForConfig(
  url: string,
  anonKey: string
): SupabaseClient | null {
  try {
    const cleanUrl = normalizeSupabaseUrl(url);
    const cleanKey = readNonEmpty(anonKey);

    if (!cleanUrl || !cleanKey) {
      console.warn('[LIMUR STUDIO OS][Supabase] Missing Project URL or Anon Key — running in local offline mode.', {
        url: cleanUrl || null,
        hasAnonKey: Boolean(cleanKey),
      });
      return null;
    }

    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }

    return createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch (err) {
    console.error(
      '[LIMUR STUDIO OS][Supabase] Failed to initialize client, falling back to localStorage:',
      err
    );
    return null;
  }
}

export let supabase: SupabaseClient | null = null;

export function reinitializeSupabaseClient(): SupabaseClient | null {
  const config = getActiveSupabaseConfig();
  supabase = createSupabaseClientForConfig(config.url, config.anonKey);
  return supabase;
}

export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): SupabaseClient | null {
  const cleanUrl = normalizeSupabaseUrl(url);
  const cleanKey = anonKey.trim();
  try {
    window.localStorage.setItem(
      SUPABASE_CONFIG_STORAGE_KEY,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  } catch (err) {
    console.error('[LIMUR STUDIO OS][Supabase] Failed to persist custom config in localStorage:', err);
  }
  return reinitializeSupabaseClient();
}

export function clearCustomSupabaseConfig(): SupabaseClient | null {
  try {
    window.localStorage.removeItem(SUPABASE_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  return reinitializeSupabaseClient();
}

// Initial safe creation at module load
reinitializeSupabaseClient();

export const SUPABASE_URL = getActiveSupabaseConfig().url;
export const SUPABASE_ANON_KEY = getActiveSupabaseConfig().anonKey;
