import { useEffect } from "react";
import { useSettingsStore } from "../state/settings-store.js";

export function useSettings() {
  const { settings, isLoading, loadSettings, updateSettings, resetSettings } = useSettingsStore();

  useEffect(() => {
    if (!settings && !isLoading) {
      loadSettings();
    }
  }, [settings, isLoading, loadSettings]);

  return {
    settings,
    isLoading,
    updateSettings,
    resetSettings,
  };
}
