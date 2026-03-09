import type { CrewRunRecord } from "../types/run.js";
import type { CrewWorkerEvent } from "../types/events.js";
import type { Settings } from "../types/settings.js";
import type { RuntimeErrorCode } from "../types/errors.js";
import type {
  ModelPolicyPreview,
  ModelPolicySnapshot,
  ModelPolicyState,
  PolicyAgentId,
  PolicyProfileId,
  PublishSnapshotInput,
} from "../types/model-policy.js";

// ─── Command Input/Output Types ────────────────────────────────────────────

export interface StartRunInput {
  repoPath: string;
  selectedAgents?: string[];
}

export interface StartRunOutput {
  runId: string;
}

export interface CancelRunInput {
  runId: string;
}

export interface CancelRunOutput {
  success: boolean;
}

export interface GetRunInput {
  runId: string;
}

export interface ListRunsInput {
  filter?: { repoPath?: string };
  limit?: number;
  offset?: number;
}

export interface ListRunsOutput {
  runs: CrewRunRecord[];
  total: number;
}

export interface GetReportInput {
  runId: string;
  format: "markdown" | "json";
}

export interface GetReportOutput {
  content: string;
  path: string;
}

export interface ExportReportInput {
  runId: string;
  format: "markdown" | "json";
  destinationPath: string;
}

export interface ExportReportOutput {
  success: boolean;
  path: string;
}

export interface DeleteRunInput {
  runId: string;
}

export interface DeleteRunOutput {
  success: boolean;
}

export interface SelectFolderOutput {
  path: string | null;
}

export interface PreviewProfileInput {
  profileId: PolicyProfileId;
  keepOverrides: boolean;
}

export interface ApplyProfileInput extends PreviewProfileInput {}

export interface SetOverrideInput {
  agentId: PolicyAgentId;
  modelId: string;
  note?: string | null;
}

export interface ClearOverrideInput {
  agentId: PolicyAgentId;
}

export interface PublishSnapshotOutput {
  snapshot: ModelPolicySnapshot;
  state: ModelPolicyState;
}

// ─── Broadcast Payloads ────────────────────────────────────────────────────

export interface RunLogEntry {
  runId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

// ─── Runtime Execution Types (production hardening) ────────────────────────

export type RuntimeStepKind =
  | 'resolve-assets'
  | 'resolve-policy'
  | 'create-worker'
  | 'run-crew'
  | 'persist-report'
  | 'persist-trace'
  | 'finalize-run';

export interface RuntimeExecutionStep {
  readonly runId: string;
  readonly stepId: string;
  readonly kind: RuntimeStepKind;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly success: boolean;
  readonly logExcerpt: string | null;
  readonly errorMessage: string | null;
}

// ─── Preload API (exposed via contextBridge) ───────────────────────────────

export interface ElectronAPI {
  // Commands
  startRun(repoPath: string, selectedAgents?: string[]): Promise<StartRunOutput>;
  cancelRun(runId: string): Promise<CancelRunOutput>;
  getRun(runId: string): Promise<CrewRunRecord>;
  listRuns(filter?: ListRunsInput["filter"], limit?: number, offset?: number): Promise<ListRunsOutput>;
  getReport(runId: string, format: "markdown" | "json"): Promise<GetReportOutput>;
  exportReport(runId: string, format: "markdown" | "json", dest: string): Promise<ExportReportOutput>;
  deleteRun(runId: string): Promise<DeleteRunOutput>;
  getSettings(): Promise<Settings>;
  updateSettings(partial: Partial<Settings>): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  getModelPolicyState(): Promise<ModelPolicyState>;
  previewPolicyProfile(profileId: PolicyProfileId, keepOverrides: boolean): Promise<ModelPolicyPreview>;
  applyPolicyProfile(profileId: PolicyProfileId, keepOverrides: boolean): Promise<ModelPolicyState>;
  listPolicySnapshots(): Promise<ModelPolicySnapshot[]>;
  publishPolicySnapshot(input: PublishSnapshotInput): Promise<PublishSnapshotOutput>;
  setPolicyOverride(agentId: PolicyAgentId, modelId: string, note?: string | null): Promise<ModelPolicyState>;
  clearPolicyOverride(agentId: PolicyAgentId): Promise<ModelPolicyState>;
  selectFolder(): Promise<SelectFolderOutput>;

  // Subscriptions
  onRunEvent(callback: (event: CrewWorkerEvent) => void): () => void;
  onRunLog(callback: (log: RunLogEntry) => void): () => void;
}
