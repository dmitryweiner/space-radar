import { useCallback, useEffect, useState } from 'react';
import { GLOBAL_SETTINGS_STORAGE_KEY, defaultGlobalSettings, sanitizeGlobalSettings } from './globalSettings';
import type { CardDensity, GlobalSettings } from './globalSettings';

function loadInitialSettings(storageKey: string): GlobalSettings {
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) {
    return { ...defaultGlobalSettings };
  }
  try {
    return sanitizeGlobalSettings(JSON.parse(raw));
  } catch {
    return { ...defaultGlobalSettings };
  }
}

export function useGlobalSettings(storageKey: string = GLOBAL_SETTINGS_STORAGE_KEY) {
  const [settings, setSettings] = useState<GlobalSettings>(() => loadInitialSettings(storageKey));

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [settings, storageKey]);

  const updateLabelScale = useCallback((labelScale: number) => {
    setSettings((prev) => ({ ...prev, labelScale }));
  }, []);

  const updateRotateSpeed = useCallback((rotateSpeed: number) => {
    setSettings((prev) => ({ ...prev, rotateSpeed }));
  }, []);

  const updateDensity = useCallback((density: CardDensity) => {
    setSettings((prev) => ({ ...prev, density }));
  }, []);

  return { settings, updateLabelScale, updateRotateSpeed, updateDensity };
}
