import type {
  AgentPolicyResolution,
  PolicyAssignmentRole,
  ModelPolicyConstraints,
  ModelPolicyPreflightSummary,
  ModelPolicySnapshot,
  PolicyAgentId,
  PolicyBlockingCode,
  PolicyBlockingReason,
  PolicyReviewStatus,
  RunPolicyResolutionSnapshot,
} from "../types/model-policy.js";
import type { ModelConfig, Settings } from "../types/settings.js";

interface ResolvePolicyInput {
  readonly settings: Settings;
  readonly snapshot: ModelPolicySnapshot;
  readonly enabledAgentIds: string[];
}

interface CandidateCheckResult {
  readonly valid: boolean;
  readonly blockingReason: PolicyBlockingReason | null;
}

export interface ResolvePolicyOutput {
  readonly resolvedModels: Record<string, string>;
  readonly snapshot: RunPolicyResolutionSnapshot;
  readonly preflight: ModelPolicyPreflightSummary;
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildModelMap(models: ModelConfig[]): Map<string, ModelConfig> {
  return new Map(models.map((model) => [model.id, model]));
}

function buildBlockingReason(
  agentId: PolicyAgentId,
  candidateModelId: string | null,
  code: PolicyBlockingCode,
  message: string,
): PolicyBlockingReason {
  return { agentId, candidateModelId, code, message };
}

export function getReviewStatus(reviewByDate: string, now = new Date()): PolicyReviewStatus {
  const reviewDate = new Date(reviewByDate).getTime();
  const diffMs = reviewDate - now.getTime();
  if (diffMs <= 0) {
    return "stale";
  }
  if (diffMs <= 14 * 24 * 60 * 60 * 1000) {
    return "review-soon";
  }
  return "fresh";
}

function checkCandidate(
  model: ModelConfig | undefined,
  agentId: PolicyAgentId,
  constraints: ModelPolicyConstraints,
  settings: Settings,
  role: PolicyAssignmentRole,
  requiresTools: boolean,
): CandidateCheckResult {
  if (!model) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, null, "MODEL_MISSING", "النموذج المطلوب غير موجود في الفهرس المحلي."),
    };
  }

  if (constraints.disabledModelIds.includes(model.id)) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "MODEL_DISABLED", "النموذج معطل محليًا ضمن قيود السياسة."),
    };
  }

  if (constraints.disabledProviderIds.includes(model.provider)) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "PROVIDER_DISABLED", "المزوّد معطل محليًا ضمن قيود التشغيل."),
    };
  }

  if (model.deprecatedAt && new Date(model.deprecatedAt).getTime() <= Date.now()) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "MODEL_DEPRECATED", "النموذج خارج نافذة الدعم المحلية."),
    };
  }

  if (model.isPreview && !constraints.allowPreviewModels) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "PREVIEW_NOT_ALLOWED", "النموذج تجريبي والقيود المحلية تمنع استخدام النماذج التجريبية."),
    };
  }

  if (constraints.requireToolSupport && requiresTools && !model.supportsTools) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "TOOLS_UNSUPPORTED", "النموذج لا يدعم الأدوات المطلوبة لهذا الدور."),
    };
  }

  if (model.credentialKey && !settings.secrets.configuredKeys.includes(model.credentialKey)) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "CREDENTIAL_MISSING", "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ."),
    };
  }

  if (role === "sensitive" && !model.supportsSensitiveWorkloads) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "ROLE_POLICY_MISMATCH", "الدور الحساس يتطلب نموذجًا مناسبًا للمهام الحساسة."),
    };
  }

  if (role === "coding" && !model.supportsCode) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "ROLE_POLICY_MISMATCH", "دور البرمجة يتطلب نموذجًا ملائمًا لمهام الكود."),
    };
  }

  if (role === "wide-context" && !model.supportsLongContext) {
    return {
      valid: false,
      blockingReason: buildBlockingReason(agentId, model.id, "ROLE_POLICY_MISMATCH", "هذا الدور يحتاج نافذة سياق واسعة."),
    };
  }

  return { valid: true, blockingReason: null };
}

export function resolvePolicy(input: ResolvePolicyInput): ResolvePolicyOutput {
  const { settings, snapshot, enabledAgentIds } = input;
  const constraints = settings.modelPolicy.constraints;
  const modelMap = buildModelMap(settings.models);
  const warnings = new Set<string>();
  const blockedReasons: PolicyBlockingReason[] = [];
  const fallbackAgentIds: PolicyAgentId[] = [];
  const resolvedModels: Record<string, string> = {};
  const agentSnapshots = {} as RunPolicyResolutionSnapshot["agents"];

  for (const enabledAgentId of enabledAgentIds) {
    const assignment = snapshot.assignments[enabledAgentId as PolicyAgentId];
    if (!assignment) {
      continue;
    }

    const override = settings.modelPolicy.manualOverrides[enabledAgentId as PolicyAgentId] ?? null;
    const candidates = override
      ? [override.modelId, assignment.primaryModelId, ...assignment.fallbackModelIds]
      : [assignment.primaryModelId, ...assignment.fallbackModelIds];

    let selectedModelId: string | null = null;
    let selectedSource: AgentPolicyResolution["selectedSource"] = "blocked";
    let selectedBlockingReason: PolicyBlockingReason | null = null;
    const validationNotes: string[] = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidateModelId = candidates[index] ?? null;
      const candidateModel = candidateModelId ? modelMap.get(candidateModelId) : undefined;
      const check = checkCandidate(
        candidateModel,
        enabledAgentId as PolicyAgentId,
        constraints,
        settings,
        assignment.role,
        assignment.requiresTools,
      );

      if (check.valid && candidateModelId) {
        selectedModelId = candidateModelId;
        if (override && index === 0) {
          selectedSource = "manual-override";
        } else if (override && index > 0) {
          selectedSource = "override-fallback";
        } else if (index === 0) {
          selectedSource = "policy";
        } else {
          selectedSource = "fallback";
        }
        if (index > 0) {
          fallbackAgentIds.push(enabledAgentId as PolicyAgentId);
          warnings.add(`تم تفعيل بديل معتمد للدور ${enabledAgentId}.`);
        }
        break;
      }

      if (check.blockingReason) {
        validationNotes.push(check.blockingReason.message);
        selectedBlockingReason = check.blockingReason;
      }
    }

    if (!selectedModelId) {
      const finalReason = selectedBlockingReason
        ?? buildBlockingReason(
          enabledAgentId as PolicyAgentId,
          null,
          "NO_VALID_MODEL",
          "تعذر العثور على نموذج صالح لهذا الدور ضمن القيود الحالية.",
        );
      blockedReasons.push(finalReason);
      agentSnapshots[enabledAgentId as PolicyAgentId] = {
        agentId: enabledAgentId as PolicyAgentId,
        recommendedModelId: assignment.primaryModelId,
        effectiveModelId: null,
        effectiveFallbackModelIds: assignment.fallbackModelIds,
        selectedSource: "blocked",
        fallbackUsed: false,
        overrideModelId: override?.modelId ?? null,
        blockedReason: finalReason,
        validationNotes,
        rationale: assignment.rationale,
        confidence: assignment.confidence,
        reviewByDate: snapshot.reviewByDate,
      };
      continue;
    }

    resolvedModels[enabledAgentId] = selectedModelId;
    agentSnapshots[enabledAgentId as PolicyAgentId] = {
      agentId: enabledAgentId as PolicyAgentId,
      recommendedModelId: assignment.primaryModelId,
      effectiveModelId: selectedModelId,
      effectiveFallbackModelIds: assignment.fallbackModelIds,
      selectedSource,
      fallbackUsed: selectedSource === "fallback" || selectedSource === "override-fallback",
      overrideModelId: override?.modelId ?? null,
      blockedReason: null,
      validationNotes,
      rationale: assignment.rationale,
      confidence: assignment.confidence,
      reviewByDate: snapshot.reviewByDate,
    };
  }

  const resolutionSnapshot: RunPolicyResolutionSnapshot = {
    snapshotId: snapshot.snapshotId,
    profileId: snapshot.profileId,
    title: snapshot.title,
    resolvedAt: nowIso(),
    reviewByDate: snapshot.reviewByDate,
    warnings: [...warnings],
    blockedReasons,
    agents: agentSnapshots,
    runtimeFailure: null,
  };

  return {
    resolvedModels,
    snapshot: resolutionSnapshot,
    preflight: {
      canRun: blockedReasons.length === 0,
      warnings: [...warnings],
      blockedReasons,
      fallbackAgentIds,
    },
  };
}
