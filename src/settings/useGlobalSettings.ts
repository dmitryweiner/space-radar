import { useSyncExternalStore } from 'react';
import { GLOBAL_SETTINGS_STORAGE_KEY, defaultGlobalSettings, sanitizeGlobalSettings } from './globalSettings';
import type { GlobalSettings } from './globalSettings';

// General settings live in a module-level store rather than React state, so
// non-component code — formatters building a layer's describe() text,
// useApiResource's poll interval — reads the same values the popup edits.
// Components subscribe with useGlobalSettings().

let current: GlobalSettings | null = null;
const listeners = new Set<() => void>();

function load(): GlobalSettings {
  try {
    const raw = window.localStorage.getItem(GLOBAL_SETTINGS_STORAGE_KEY);
    return raw === null ? { ...defaultGlobalSettings } : sanitizeGlobalSettings(JSON.parse(raw));
  } catch {
    return { ...defaultGlobalSettings };
  }
}

export function getGlobalSettings(): GlobalSettings {
  current ??= load();
  return current;
}

export function updateGlobalSettings(patch: Partial<GlobalSettings>): void {
  current = { ...getGlobalSettings(), ...patch };
  try {
    window.localStorage.setItem(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage full/blocked — the setting just won't persist.
  }
  for (const listener of listeners) listener();
}

/** Drops the in-memory copy so the next read re-loads from storage (tests). */
export function reloadGlobalSettings(): void {
  current = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGlobalSettings(): GlobalSettings {
  return useSyncExternalStore(subscribe, getGlobalSettings);
}

/** Every key this app writes is prefixed with this. */
export const STORAGE_PREFIX = 'space-radar:';

/** "Reset everything": drops all of the app's stored state (layers, settings,
 * cached API responses) — the caller reloads the page afterwards. */
export function clearAppStorage(storage: Storage = window.localStorage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
