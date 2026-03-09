import type { Severity } from "../../../src/types.js";
import type { CrewEvent } from "../../../src/tracing/tracer.js";
import type { CrewRunStatus, AgentStatus } from "./run.js";
import type { ErrorCode } from "./errors.js";

interface WorkerEventBase {
  readonly runId: string;
  readonly timestamp: string;
}

export interface RunLifecycleEvent extends WorkerEventBase {
  readonly kind: "run.lifecycle";
  readonly phase: CrewRunStatus;
}

export interface AgentStatusEvent extends WorkerEventBase {
  readonly kind: "agent.status";
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly timing: {
    readonly startedAt: string | null;
    readonly finishedAt: string | null;
    readonly durationMs: number | null;
  };
}

export interface AgentFindingEvent extends WorkerEventBase {
  readonly kind: "agent.finding";
  readonly agentId: string;
  readonly findingSummary: {
    readonly id: string;
    readonly title: string;
    readonly severity: Severity;
    readonly category: string;
  };
}

export interface TraceEvent extends WorkerEventBase {
  readonly kind: "trace.event";
  readonly traceId: string;
  readonly spanName: string;
  readonly crewEvent: CrewEvent;
}

export interface RunErrorEvent extends WorkerEventBase {
  readonly kind: "run.error";
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly agentId?: string;
    readonly details?: string;
  };
}

export type CrewWorkerEvent =
  | RunLifecycleEvent
  | AgentStatusEvent
  | AgentFindingEvent
  | TraceEvent
  | RunErrorEvent;
