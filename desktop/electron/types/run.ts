import type { ErrorCode } from "./errors.js";
import type { RunPolicyResolutionSnapshot } from "./model-policy.js";

export type CrewRunStatus =
  | "queued"
  | "starting"
  | "running"
  | "cancelling"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "timeout";

export interface AgentRunState {
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly findingsCount: number;
  readonly errorMessage: string | null;
}

export interface FindingsSummary {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

export interface RunError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: string;
}

export interface CrewRunRecord {
  readonly runId: string;
  readonly repoPath: string;
  status: CrewRunStatus;
  readonly startedAt: string;
  finishedAt: string | null;
  lastUpdatedAt: string;
  readonly selectedAgents: string[];
  readonly modelConfigSnapshot: Record<string, string>;
  agentStates: Record<string, AgentRunState>;
  findingsSummary: FindingsSummary;
  reportPaths: {
    markdown?: string;
    json?: string;
    traces?: string;
  };
  policyResolutionSnapshot: RunPolicyResolutionSnapshot | null;
  error: RunError | null;
  durationMs: number | null;
  /** Runtime version from the crew library at execution time */
  readonly runtimeVersion?: string;
  /** True when the run was executed from a packaged Electron build */
  readonly packagedExecution?: boolean;
  /** Overall assessment from the crew run */
  overallAssessment?: "ready" | "ready_with_conditions" | "not_ready";
}
