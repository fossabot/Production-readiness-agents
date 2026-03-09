import { create } from "zustand";
import type {
  ModelPolicyPreview,
  ModelPolicyState,
  PolicyAgentId,
  PolicyProfileId,
  PublishSnapshotInput,
} from "../../electron/types/model-policy.js";
import { ipc } from "../lib/ipc-client.js";

interface RendererModelPolicyState {
  state: ModelPolicyState | null;
  preview: ModelPolicyPreview | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;
  loadState: () => Promise<void>;
  previewProfile: (profileId: PolicyProfileId, keepOverrides: boolean) => Promise<void>;
  applyProfile: (profileId: PolicyProfileId, keepOverrides: boolean) => Promise<void>;
  publishSnapshot: (input: PublishSnapshotInput) => Promise<void>;
  setOverride: (agentId: PolicyAgentId, modelId: string, note?: string | null) => Promise<void>;
  clearOverride: (agentId: PolicyAgentId) => Promise<void>;
  clearPreview: () => void;
}

export const useModelPolicyStore = create<RendererModelPolicyState>((set) => ({
  state: null,
  preview: null,
  isLoading: false,
  isApplying: false,
  error: null,

  loadState: async () => {
    set({ isLoading: true, error: null });
    try {
      const state = await ipc.getModelPolicyState();
      set({ state, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "تعذر تحميل حالة سياسة النماذج.",
      });
    }
  },

  previewProfile: async (profileId, keepOverrides) => {
    set({ isApplying: true, error: null });
    try {
      const preview = await ipc.previewPolicyProfile(profileId, keepOverrides);
      set({ preview, isApplying: false });
    } catch (error) {
      set({
        isApplying: false,
        error: error instanceof Error ? error.message : "تعذر إنشاء معاينة الملف الجاهز.",
      });
    }
  },

  applyProfile: async (profileId, keepOverrides) => {
    set({ isApplying: true, error: null });
    try {
      const state = await ipc.applyPolicyProfile(profileId, keepOverrides);
      set({ state, preview: null, isApplying: false });
    } catch (error) {
      set({
        isApplying: false,
        error: error instanceof Error ? error.message : "تعذر تطبيق الملف الجاهز.",
      });
    }
  },

  publishSnapshot: async (input) => {
    set({ isApplying: true, error: null });
    try {
      const result = await ipc.publishPolicySnapshot(input);
      set({ state: result.state, preview: null, isApplying: false });
    } catch (error) {
      set({
        isApplying: false,
        error: error instanceof Error ? error.message : "تعذر نشر النسخة الحالية.",
      });
    }
  },

  setOverride: async (agentId, modelId, note) => {
    set({ isApplying: true, error: null });
    try {
      const state = await ipc.setPolicyOverride(agentId, modelId, note);
      set({ state, isApplying: false });
    } catch (error) {
      set({
        isApplying: false,
        error: error instanceof Error ? error.message : "تعذر حفظ التخصيص اليدوي.",
      });
    }
  },

  clearOverride: async (agentId) => {
    set({ isApplying: true, error: null });
    try {
      const state = await ipc.clearPolicyOverride(agentId);
      set({ state, isApplying: false });
    } catch (error) {
      set({
        isApplying: false,
        error: error instanceof Error ? error.message : "تعذر إعادة الوكيل إلى السياسة الأصلية.",
      });
    }
  },

  clearPreview: () => set({ preview: null }),
}));
