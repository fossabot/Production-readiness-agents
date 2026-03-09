import {
  POLICY_AGENT_IDS,
  type ManualModelOverride,
  type ModelPolicyPreview,
  type ModelPolicySnapshot,
  type PolicyAgentId,
  type PolicyDiffItem,
  type PolicyProfileId,
} from "../types/model-policy.js";

function buildDiffItem(
  agentId: PolicyAgentId,
  currentSnapshot: ModelPolicySnapshot,
  nextSnapshot: ModelPolicySnapshot,
  override: ManualModelOverride | null,
  keepOverrides: boolean,
): PolicyDiffItem {
  const current = currentSnapshot.assignments[agentId];
  const next = nextSnapshot.assignments[agentId];
  const effectiveAfterModelId = keepOverrides && override ? override.modelId : next.primaryModelId;

  return {
    agentId,
    beforeModelId: current.primaryModelId,
    afterModelId: effectiveAfterModelId,
    beforeFallbackModelIds: current.fallbackModelIds,
    afterFallbackModelIds: next.fallbackModelIds,
    rationale: next.rationale,
    changed:
      current.primaryModelId !== effectiveAfterModelId
      || current.fallbackModelIds.join("|") !== next.fallbackModelIds.join("|"),
    overrideState: override ? (keepOverrides ? "kept" : "replaced") : "none",
  };
}

export function buildProfilePreview(
  currentSnapshot: ModelPolicySnapshot,
  nextSnapshot: ModelPolicySnapshot,
  manualOverrides: Partial<Record<PolicyAgentId, ManualModelOverride>>,
  keepOverrides: boolean,
): ModelPolicyPreview {
  const diff = POLICY_AGENT_IDS.map((agentId) =>
    buildDiffItem(agentId, currentSnapshot, nextSnapshot, manualOverrides[agentId] ?? null, keepOverrides),
  );

  return {
    profileId: (nextSnapshot.profileId ?? "balanced") as PolicyProfileId,
    title: nextSnapshot.title,
    description: nextSnapshot.description,
    keepOverrides,
    generatedAt: new Date().toISOString(),
    diff,
    changedAgentIds: diff.filter((item) => item.changed).map((item) => item.agentId),
    unchangedAgentIds: diff.filter((item) => !item.changed).map((item) => item.agentId),
  };
}

export function buildSnapshotComparison(
  currentSnapshot: ModelPolicySnapshot,
  nextSnapshot: ModelPolicySnapshot,
): PolicyDiffItem[] {
  return POLICY_AGENT_IDS.map((agentId) => {
    const current = currentSnapshot.assignments[agentId];
    const next = nextSnapshot.assignments[agentId];
    return {
      agentId,
      beforeModelId: current.primaryModelId,
      afterModelId: next.primaryModelId,
      beforeFallbackModelIds: current.fallbackModelIds,
      afterFallbackModelIds: next.fallbackModelIds,
      rationale: next.rationale,
      changed:
        current.primaryModelId !== next.primaryModelId
        || current.fallbackModelIds.join("|") !== next.fallbackModelIds.join("|"),
      overrideState: "none",
    };
  });
}
