import { parentPort } from "node:worker_threads";
import type { CrewWorkerEvent } from "../types/events.js";

/**
 * Sends CrewWorkerEvent messages from the worker thread to the main process.
 */
export function emitWorkerEvent(event: CrewWorkerEvent): void {
  parentPort?.postMessage(event);
}

export function emitLifecycle(runId: string, phase: CrewWorkerEvent extends { kind: "run.lifecycle" } ? CrewWorkerEvent["phase"] : string): void {
  emitWorkerEvent({
    kind: "run.lifecycle",
    runId,
    timestamp: new Date().toISOString(),
    phase: phase as any,
  });
}

export function emitAgentStatus(
  runId: string,
  agentId: string,
  status: string,
  timing: { startedAt: string | null; finishedAt: string | null; durationMs: number | null },
): void {
  emitWorkerEvent({
    kind: "agent.status",
    runId,
    timestamp: new Date().toISOString(),
    agentId,
    status: status as any,
    timing,
  });
}

export function emitAgentFinding(
  runId: string,
  agentId: string,
  findingSummary: { id: string; title: string; severity: any; category: string },
): void {
  emitWorkerEvent({
    kind: "agent.finding",
    runId,
    timestamp: new Date().toISOString(),
    agentId,
    findingSummary,
  });
}

export function emitRunError(
  runId: string,
  code: string,
  message: string,
  agentId?: string,
  details?: string,
): void {
  const errorPayload: {
    code: any;
    message: string;
    agentId?: string;
    details?: string;
  } = { code: code as any, message };

  if (agentId) {
    errorPayload.agentId = agentId;
  }
  if (details) {
    errorPayload.details = details;
  }

  emitWorkerEvent({
    kind: "run.error",
    runId,
    timestamp: new Date().toISOString(),
    error: errorPayload,
  });
}
