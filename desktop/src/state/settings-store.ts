import { create } from "zustand";
import type { Settings } from "../../electron/types/settings.js";
import { ipc } from "../lib/ipc-client.js";

interface SettingsState {
  settings: Settings | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await ipc.getSettings();
      set({ settings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    try {
      const updated = await ipc.updateSettings(partial);
      set({ settings: updated });
    } catch {
      // keep current state
    }
  },

  resetSettings: async () => {
    try {
      const defaults = await ipc.resetSettings();
      set({ settings: defaults });
    } catch {
      // keep current state
    }
  },
}));
