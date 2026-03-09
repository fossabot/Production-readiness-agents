export const POLICY_AGENT_IDS = [
  "structural-scout",
  "code-performance-auditor",
  "security-resilience-auditor",
  "testing-auditor",
  "infrastructure-auditor",
  "docs-compliance-auditor",
  "runtime-verifier",
  "report-synthesizer",
  "general-purpose",
] as const;

export type PolicyAgentId = (typeof POLICY_AGENT_IDS)[number];

export type SpecialistAgentId = Exclude<PolicyAgentId, "general-purpose">;

export const SPECIALIST_AGENT_IDS = POLICY_AGENT_IDS.filter(
  (agentId): agentId is SpecialistAgentId => agentId !== "general-purpose",
);

export type PolicyProfileId = "accuracy" | "balanced" | "budget";

export type PolicyAssignmentRole =
  | "analysis"
  | "coding"
  | "sensitive"
  | "wide-context"
  | "synthesis"
  | "general";

export type PolicyConfidence = "high" | "medium" | "low";

export type PolicySnapshotStatus = "active" | "archived";

export type PolicyReviewStatus = "fresh" | "review-soon" | "stale";

export type PolicyDiffOverrideState = "kept" | "replaced" | "none";

export type PolicyResolutionSource =
  | "policy"
  | "manual-override"
  | "fallback"
  | "override-fallback"
  | "blocked";

export type PolicyBlockingCode =
  | "MODEL_MISSING"
  | "MODEL_DISABLED"
  | "PROVIDER_DISABLED"
  | "MODEL_DEPRECATED"
  | "CREDENTIAL_MISSING"
  | "PREVIEW_NOT_ALLOWED"
  | "TOOLS_UNSUPPORTED"
  | "ROLE_POLICY_MISMATCH"
  | "NO_VALID_MODEL";

export interface ModelPolicyAssignment {
  readonly agentId: PolicyAgentId;
  readonly primaryModelId: string;
  readonly fallbackModelIds: string[];
  readonly rationale: string;
  readonly confidence: PolicyConfidence;
  readonly role: PolicyAssignmentRole;
  readonly requiresTools: boolean;
}

export interface ModelPolicySnapshot {
  readonly snapshotId: string;
  readonly title: string;
  readonly description: string;
  readonly profileId: PolicyProfileId | null;
  readonly status: PolicySnapshotStatus;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly reviewByDate: string;
  readonly reviewer: string | null;
  readonly approvalNotes: string | null;
  readonly sourceLinks: string[];
  readonly supersedesSnapshotId: string | null;
  readonly supersededBySnapshotId: string | null;
  readonly assignments: Record<PolicyAgentId, ModelPolicyAssignment>;
}

export interface ManualModelOverride {
  readonly agentId: PolicyAgentId;
  readonly modelId: string;
  readonly note: string | null;
  readonly updatedAt: string;
}

export interface ModelPolicyConstraints {
  readonly disabledProviderIds: string[];
  readonly disabledModelIds: string[];
  readonly allowPreviewModels: boolean;
  readonly requireToolSupport: boolean;
  readonly includeGeneralPurposeFallback: boolean;
}

export interface ModelPolicyProfileDefinition {
  readonly profileId: PolicyProfileId;
  readonly title: string;
  readonly description: string;
  readonly rationale: string;
  readonly reviewWindowDays: number;
  readonly sourceLinks: string[];
  readonly assignments: Record<PolicyAgentId, ModelPolicyAssignment>;
}

export interface PolicyDiffItem {
  readonly agentId: PolicyAgentId;
  readonly beforeModelId: string | null;
  readonly afterModelId: string;
  readonly beforeFallbackModelIds: string[];
  readonly afterFallbackModelIds: string[];
  readonly rationale: string;
  readonly changed: boolean;
  readonly overrideState: PolicyDiffOverrideState;
}

export interface ModelPolicyPreview {
  readonly profileId: PolicyProfileId;
  readonly title: string;
  readonly description: string;
  readonly keepOverrides: boolean;
  readonly generatedAt: string;
  readonly diff: PolicyDiffItem[];
  readonly changedAgentIds: PolicyAgentId[];
  readonly unchangedAgentIds: PolicyAgentId[];
}

export interface PolicyBlockingReason {
  readonly agentId: PolicyAgentId;
  readonly candidateModelId: string | null;
  readonly code: PolicyBlockingCode;
  readonly message: string;
}

export interface AgentPolicyResolution {
  readonly agentId: PolicyAgentId;
  readonly recommendedModelId: string;
  readonly effectiveModelId: string | null;
  readonly effectiveFallbackModelIds: string[];
  readonly selectedSource: PolicyResolutionSource;
  readonly fallbackUsed: boolean;
  readonly overrideModelId: string | null;
  readonly blockedReason: PolicyBlockingReason | null;
  readonly validationNotes: string[];
  readonly rationale: string;
  readonly confidence: PolicyConfidence;
  readonly reviewByDate: string;
}

export interface RunPolicyResolutionSnapshot {
  readonly snapshotId: string;
  readonly profileId: PolicyProfileId | null;
  readonly title: string;
  readonly resolvedAt: string;
  readonly reviewByDate: string;
  readonly warnings: string[];
  readonly blockedReasons: PolicyBlockingReason[];
  readonly agents: Record<PolicyAgentId, AgentPolicyResolution>;
  readonly runtimeFailure: {
    readonly message: string;
    readonly recordedAt: string;
  } | null;
}

export interface PolicyAgentView {
  readonly agentId: PolicyAgentId;
  readonly enabled: boolean;
  readonly recommended: ModelPolicyAssignment;
  readonly currentModelId: string | null;
  readonly currentFallbackModelIds: string[];
  readonly override: ManualModelOverride | null;
  readonly reviewStatus: PolicyReviewStatus;
  readonly reviewByDate: string;
  readonly constraints: string[];
  readonly effectiveSource: PolicyResolutionSource;
  readonly fallbackUsed: boolean;
}

export interface ModelPolicyPreflightSummary {
  readonly canRun: boolean;
  readonly warnings: string[];
  readonly blockedReasons: PolicyBlockingReason[];
  readonly fallbackAgentIds: PolicyAgentId[];
}

export interface ModelPolicyState {
  readonly activeSnapshot: ModelPolicySnapshot;
  readonly snapshots: ModelPolicySnapshot[];
  readonly profiles: ModelPolicyProfileDefinition[];
  readonly agentViews: PolicyAgentView[];
  readonly preflight: ModelPolicyPreflightSummary;
  readonly constraints: ModelPolicyConstraints;
  readonly manualOverrides: Partial<Record<PolicyAgentId, ManualModelOverride>>;
}

export interface PublishSnapshotInput {
  readonly reviewer: string;
  readonly approvalNotes: string | null;
  readonly reviewByDate: string;
  readonly sourceLinks: string[];
}

export interface ApplyProfileOptions {
  readonly keepOverrides: boolean;
}

export interface PolicyCatalogSummary {
  readonly profileId: PolicyProfileId;
  readonly title: string;
  readonly description: string;
}
