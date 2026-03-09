import type {
  ManualModelOverride,
  ModelPolicyConstraints,
  PolicyAssignmentRole,
  PolicyAgentId,
} from "./model-policy.js";

export interface AgentConfig {
  readonly agentId: string;
  enabled: boolean;
  model: string;
  enabledTools: string[];
  enabledSkills: string[];
}

export interface ModelConfig {
  readonly id: string;
  readonly provider: string;
  readonly displayName: string;
  readonly contextWindowTokens: number;
  readonly supportsTools: boolean;
  readonly supportsLongContext: boolean;
  readonly supportsCode: boolean;
  readonly supportsSensitiveWorkloads: boolean;
  readonly recommendedRoles: PolicyAssignmentRole[];
  readonly credentialKey: string | null;
  readonly releasedAt: string;
  readonly lastReviewedAt: string;
  readonly deprecatedAt: string | null;
  readonly isPreview: boolean;
  readonly isDefault: boolean;
}

export interface SecretsConfig {
  readonly storageBackend: "electron-safeStorage" | "system-keychain";
  readonly configuredKeys: string[];
}

export interface RuntimePolicy {
  maxRunDurationMs: number;
  agentTimeoutMs: number;
  maxConcurrency: number;
  enableTracing: boolean;
  persistRawTraces: boolean;
  allowNetworkTools: boolean;
  autoOpenReportOnCompletion: boolean;
}

export interface UiPreferences {
  theme: "system" | "light" | "dark";
  language: "ar" | "en";
  showRawTraces: boolean;
  defaultReportExportPath: string | null;
}

export interface ModelPolicySettings {
  activeSnapshotId: string | null;
  lastAppliedProfileId: string | null;
  constraints: ModelPolicyConstraints;
  manualOverrides: Partial<Record<PolicyAgentId, ManualModelOverride>>;
}

export interface Settings {
  readonly schemaVersion: number;
  agents: Record<string, AgentConfig>;
  models: ModelConfig[];
  secrets: SecretsConfig;
  runtime: RuntimePolicy;
  ui: UiPreferences;
  modelPolicy: ModelPolicySettings;
}

export const DEFAULT_RUNTIME_POLICY: RuntimePolicy = {
  maxRunDurationMs: 1_800_000,
  agentTimeoutMs: 300_000,
  maxConcurrency: 5,
  enableTracing: true,
  persistRawTraces: false,
  allowNetworkTools: true,
  autoOpenReportOnCompletion: true,
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "system",
  language: "ar",
  showRawTraces: false,
  defaultReportExportPath: null,
};

export const DEFAULT_MODEL_POLICY_CONSTRAINTS: ModelPolicyConstraints = {
  disabledProviderIds: [],
  disabledModelIds: [],
  allowPreviewModels: false,
  requireToolSupport: true,
  includeGeneralPurposeFallback: false,
};

export const DEFAULT_MODEL_POLICY_SETTINGS: ModelPolicySettings = {
  activeSnapshotId: null,
  lastAppliedProfileId: null,
  constraints: DEFAULT_MODEL_POLICY_CONSTRAINTS,
  manualOverrides: {},
};
