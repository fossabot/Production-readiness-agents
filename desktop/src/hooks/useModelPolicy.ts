import { useEffect } from "react";
import { useModelPolicyStore } from "../state/model-policy-store.js";

export function useModelPolicy() {
  const {
    state,
    preview,
    isLoading,
    isApplying,
    error,
    loadState,
    previewProfile,
    applyProfile,
    publishSnapshot,
    setOverride,
    clearOverride,
    clearPreview,
  } = useModelPolicyStore();

  useEffect(() => {
    if (!state && !isLoading) {
      loadState();
    }
  }, [state, isLoading, loadState]);

  return {
    state,
    preview,
    isLoading,
    isApplying,
    error,
    refresh: loadState,
    previewProfile,
    applyProfile,
    publishSnapshot,
    setOverride,
    clearOverride,
    clearPreview,
  };
}
