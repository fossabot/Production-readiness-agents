import type {
  Finding,
  Observation,
  CoverageEntry,
  RemediationStep,
  GapDeclaration,
  ReportMetadata,
} from "../types.js";

// ─── TracingData ────────────────────────────────────────────────────────────

export interface DelegationRecord {
  readonly from: string;
  readonly to: string;
  readonly timestamp: string;
  readonly duration_ms: number;
  readonly status: "completed" | "failed" | "retried";
}

export interface TracingData {
  readonly delegations: readonly DelegationRecord[];
  readonly tool_calls: number;
  readonly retries: number;
  readonly total_duration_ms: number;
}

// ─── FinalReport ────────────────────────────────────────────────────────────

export interface FinalReport {
  readonly version: string;
  readonly project: string;
  readonly timestamp: string;
  readonly duration_seconds: number;
  readonly overall_assessment: "ready" | "ready_with_conditions" | "not_ready";
  readonly executiveSummary: string;
  readonly overallScore?: string;
  readonly findings: readonly Finding[];
  readonly observations: readonly Observation[];
  readonly coverageReport: readonly CoverageEntry[];
  readonly remediationPlan: readonly RemediationStep[];
  readonly gaps: readonly GapDeclaration[];
  readonly metadata: ReportMetadata;
  readonly tracing: TracingData;
}
