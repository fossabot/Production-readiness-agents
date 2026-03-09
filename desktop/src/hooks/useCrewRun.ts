import { useState, useCallback } from "react";
import { useRunStore } from "../state/run-store.js";
import { ipc } from "../lib/ipc-client.js";
import type { RuntimeErrorCode } from "../../electron/types/errors.js";

/** Renderer-side error code: canonical RuntimeErrorCode plus fallback UNKNOWN. */
export type RunErrorCode = RuntimeErrorCode | 'UNKNOWN';

interface UseCrewRunResult {
  startRun: (repoPath: string, selectedAgents?: string[]) => Promise<string | null>;
  cancelRun: () => Promise<boolean>;
  isStarting: boolean;
  isCancelling: boolean;
  error: string | null;
  errorCode: RunErrorCode | null;
}

function parseErrorCode(message: string): RunErrorCode {
  if (message.startsWith('RUN_ALREADY_ACTIVE')) return 'RUN_ALREADY_ACTIVE';
  if (message.startsWith('CONFIG_ERROR') || message.includes('model policy')) return 'CONFIG_ERROR';
  if (message.startsWith('RUNTIME_ASSET_ERROR')) return 'RUNTIME_ASSET_ERROR';
  return 'UNKNOWN';
}

export function useCrewRun(): UseCrewRunResult {
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RunErrorCode | null>(null);
  const setActiveRun = useRunStore((s) => s.setActiveRun);
  const activeRun = useRunStore((s) => s.activeRun);

  const startRun = useCallback(async (repoPath: string, selectedAgents?: string[]): Promise<string | null> => {
    setIsStarting(true);
    setError(null);
    setErrorCode(null);
    try {
      const { runId } = await ipc.startRun(repoPath, selectedAgents);
      const record = await ipc.getRun(runId);
      setActiveRun(record);
      return runId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "فشل بدء الفحص";
      setError(message);
      setErrorCode(parseErrorCode(message));
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [setActiveRun]);

  const cancelRun = useCallback(async (): Promise<boolean> => {
    if (!activeRun) return false;
    setIsCancelling(true);
    try {
      const result = await ipc.cancelRun(activeRun.runId);
      return result.success;
    } catch {
      return false;
    } finally {
      setIsCancelling(false);
    }
  }, [activeRun]);

  return { startRun, cancelRun, isStarting, isCancelling, error, errorCode };
}
