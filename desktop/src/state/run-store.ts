import { create } from "zustand";
import type { CrewRunRecord, FindingsSummary } from "../../electron/types/run.js";
import type { CrewWorkerEvent } from "../../electron/types/events.js";

interface RunState {
  activeRun: CrewRunRecord | null;
  isRunning: boolean;
  setActiveRun: (run: CrewRunRecord | null) => void;
  handleWorkerEvent: (event: CrewWorkerEvent) => void;
  clearRun: () => void;
}

export const useRunStore = create<RunState>((set, get) => ({
  activeRun: null,
  isRunning: false,

  setActiveRun: (run) =>
    set({ activeRun: run, isRunning: run ? !["completed", "failed", "cancelled"].includes(run.status) : false }),

  handleWorkerEvent: (event) => {
    const { activeRun } = get();
    if (!activeRun || activeRun.runId !== event.runId) return;

    const now = new Date().toISOString();

    switch (event.kind) {
      case "run.lifecycle": {
        const isTerminal = ["completed", "failed", "cancelled"].includes(event.phase);
        set({
          activeRun: {
            ...activeRun,
            status: event.phase,
            lastUpdatedAt: now,
            finishedAt: isTerminal ? now : activeRun.finishedAt,
            durationMs: isTerminal
              ? new Date(now).getTime() - new Date(activeRun.startedAt).getTime()
              : activeRun.durationMs,
          },
          isRunning: !isTerminal,
        });
        break;
      }
      case "agent.status": {
        const updatedStates = { ...activeRun.agentStates };
        updatedStates[event.agentId] = {
          agentId: event.agentId,
          status: event.status,
          startedAt: event.timing.startedAt,
          finishedAt: event.timing.finishedAt,
          durationMs: event.timing.durationMs,
          findingsCount: updatedStates[event.agentId]?.findingsCount ?? 0,
          errorMessage: null,
        };
        set({ activeRun: { ...activeRun, agentStates: updatedStates, lastUpdatedAt: now } });
        break;
      }
      case "agent.finding": {
        const severity = event.findingSummary.severity.toLowerCase() as keyof FindingsSummary;
        const updatedSummary = { ...activeRun.findingsSummary };
        if (severity in updatedSummary) {
          (updatedSummary as Record<string, number>)[severity]++;
        }
        const updatedAgentStates = { ...activeRun.agentStates };
        if (updatedAgentStates[event.agentId]) {
          updatedAgentStates[event.agentId] = {
            ...updatedAgentStates[event.agentId],
            findingsCount: updatedAgentStates[event.agentId].findingsCount + 1,
          };
        }
        set({
          activeRun: {
            ...activeRun,
            findingsSummary: updatedSummary,
            agentStates: updatedAgentStates,
            lastUpdatedAt: now,
          },
        });
        break;
      }
      case "run.error": {
        const nextError: {
          code: typeof event.error.code;
          message: string;
          details?: string;
        } = {
          code: event.error.code,
          message: event.error.message,
        };
        if (event.error.details) {
          nextError.details = event.error.details;
        }
        set({
          activeRun: {
            ...activeRun,
            error: nextError,
            lastUpdatedAt: now,
          },
        });
        break;
      }
    }
  },

  clearRun: () => set({ activeRun: null, isRunning: false }),
}));
