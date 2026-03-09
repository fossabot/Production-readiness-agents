import {
  POLICY_AGENT_IDS,
  type ModelPolicyAssignment,
  type ModelPolicyProfileDefinition,
  type ModelPolicySnapshot,
  type PolicyAgentId,
  type PolicyProfileId,
} from "../types/model-policy.js";
import type { ModelConfig } from "../types/settings.js";

const REVIEWED_AT = "2026-03-08T00:00:00.000Z";
const DEFAULT_REVIEW_BY = "2026-06-08T00:00:00.000Z";

export const DEFAULT_POLICY_PROFILE_ID: PolicyProfileId = "balanced";

export const MODEL_CATALOG: ModelConfig[] = [
  {
    id: "claude-opus-4.6",
    provider: "anthropic",
    displayName: "Claude Opus 4.6",
    contextWindowTokens: 200000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: true,
    recommendedRoles: ["sensitive", "analysis", "synthesis"],
    credentialKey: "ANTHROPIC_API_KEY",
    releasedAt: "2026-01-01T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "claude-sonnet-4.6",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    contextWindowTokens: 200000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: true,
    recommendedRoles: ["analysis", "wide-context", "synthesis", "general"],
    credentialKey: "ANTHROPIC_API_KEY",
    releasedAt: "2026-01-01T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: true,
  },
  {
    id: "claude-haiku-4.5",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    contextWindowTokens: 200000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: false,
    supportsSensitiveWorkloads: false,
    recommendedRoles: ["analysis", "wide-context", "general"],
    credentialKey: "ANTHROPIC_API_KEY",
    releasedAt: "2025-10-01T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "gpt-5.4",
    provider: "openai",
    displayName: "GPT-5.4",
    contextWindowTokens: 256000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: true,
    recommendedRoles: ["synthesis", "analysis"],
    credentialKey: "OPENAI_API_KEY",
    releasedAt: "2026-02-01T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "gpt-5.2-codex",
    provider: "openai",
    displayName: "GPT-5.2 Codex",
    contextWindowTokens: 256000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: false,
    recommendedRoles: ["coding", "analysis"],
    credentialKey: "OPENAI_API_KEY",
    releasedAt: "2026-01-15T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    displayName: "GPT-5 mini",
    contextWindowTokens: 128000,
    supportsTools: true,
    supportsLongContext: false,
    supportsCode: true,
    supportsSensitiveWorkloads: false,
    recommendedRoles: ["coding", "general"],
    credentialKey: "OPENAI_API_KEY",
    releasedAt: "2025-12-01T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "gemini-2.5-pro",
    provider: "google",
    displayName: "Gemini 2.5 Pro",
    contextWindowTokens: 1000000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: false,
    recommendedRoles: ["wide-context", "analysis", "general"],
    credentialKey: "GOOGLE_API_KEY",
    releasedAt: "2025-12-15T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
  {
    id: "gemini-2.5-flash",
    provider: "google",
    displayName: "Gemini 2.5 Flash",
    contextWindowTokens: 1000000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: false,
    supportsSensitiveWorkloads: false,
    recommendedRoles: ["wide-context", "general"],
    credentialKey: "GOOGLE_API_KEY",
    releasedAt: "2025-12-15T00:00:00.000Z",
    lastReviewedAt: REVIEWED_AT,
    deprecatedAt: null,
    isPreview: false,
    isDefault: false,
  },
];

function assignment(
  agentId: PolicyAgentId,
  primaryModelId: string,
  fallbackModelIds: string[],
  rationale: string,
  confidence: ModelPolicyAssignment["confidence"],
  role: ModelPolicyAssignment["role"],
): ModelPolicyAssignment {
  return {
    agentId,
    primaryModelId,
    fallbackModelIds,
    rationale,
    confidence,
    role,
    requiresTools: true,
  };
}

export const BUILT_IN_PROFILES: ModelPolicyProfileDefinition[] = [
  {
    profileId: "accuracy",
    title: "تركيز على الدقة",
    description: "أفضل دقة عملية للأدوار الحساسة والتحليلية مع قبول تكلفة أعلى.",
    rationale: "يلائم المراجعات الحرجة حيث تكون الجودة وتعدد البدائل أهم من خفض التكلفة.",
    reviewWindowDays: 90,
    sourceLinks: [
      "https://developers.openai.com/api/docs/models/gpt-5.4",
      "https://platform.openai.com/docs/models/gpt-5.2-codex",
      "https://www.anthropic.com/claude/opus",
      "https://www.anthropic.com/claude/sonnet",
      "https://www.anthropic.com/claude/haiku",
    ],
    assignments: {
      "structural-scout": assignment("structural-scout", "claude-haiku-4.5", ["gemini-2.5-flash", "claude-sonnet-4.6"], "قراءة سريعة واسعة السياق مع تكلفة أقل.", "medium", "wide-context"),
      "code-performance-auditor": assignment("code-performance-auditor", "gpt-5.2-codex", ["claude-sonnet-4.6", "gpt-5-mini"], "أفضل مواءمة لمهام الكود والتحليل البرمجي.", "high", "coding"),
      "security-resilience-auditor": assignment("security-resilience-auditor", "claude-opus-4.6", ["claude-sonnet-4.6", "gpt-5.4"], "دقة أعلى للأدوار الحساسة التي تحتاج استدلالًا متأنيا.", "high", "sensitive"),
      "testing-auditor": assignment("testing-auditor", "gpt-5.2-codex", ["claude-sonnet-4.6", "gpt-5-mini"], "قوي في توليد ومراجعة الاختبارات وتحليل الإخفاقات.", "high", "coding"),
      "infrastructure-auditor": assignment("infrastructure-auditor", "claude-sonnet-4.6", ["gpt-5.4", "gemini-2.5-pro"], "توازن جيد بين الدقة وقراءة ملفات البنية والتهيئة.", "high", "analysis"),
      "docs-compliance-auditor": assignment("docs-compliance-auditor", "claude-sonnet-4.6", ["gpt-5.4", "claude-haiku-4.5"], "قراءة الوثائق وربطها بالسياق بشكل واضح.", "medium", "wide-context"),
      "runtime-verifier": assignment("runtime-verifier", "gpt-5.2-codex", ["gpt-5-mini", "claude-sonnet-4.6"], "أفضل مواءمة للتعامل مع الأوامر والتحقق التشغيلي.", "high", "coding"),
      "report-synthesizer": assignment("report-synthesizer", "gpt-5.4", ["claude-opus-4.6", "claude-sonnet-4.6"], "أقوى في التجميع النهائي وصياغة التقرير التنفيذي.", "high", "synthesis"),
      "general-purpose": assignment("general-purpose", "claude-sonnet-4.6", ["gpt-5-mini", "gemini-2.5-flash"], "بديل مرن للأعمال الثانوية متعددة الخطوات.", "medium", "general"),
    },
  },
  {
    profileId: "balanced",
    title: "متوازن",
    description: "توازن بين التكلفة والدقة مع الحفاظ على أمان الأدوار الحساسة.",
    rationale: "الملف الافتراضي المقترح لمعظم التشغيلات اليومية.",
    reviewWindowDays: 90,
    sourceLinks: [
      "https://developers.openai.com/api/docs/models/gpt-5.4",
      "https://platform.openai.com/docs/models/gpt-5.2-codex",
      "https://platform.openai.com/docs/models/gpt-5-mini",
      "https://www.anthropic.com/claude/sonnet",
      "https://www.anthropic.com/claude/haiku",
    ],
    assignments: {
      "structural-scout": assignment("structural-scout", "claude-haiku-4.5", ["gemini-2.5-flash", "claude-sonnet-4.6"], "استكشاف سريع واسع السياق دون تكلفة عالية.", "medium", "wide-context"),
      "code-performance-auditor": assignment("code-performance-auditor", "gpt-5.2-codex", ["gpt-5-mini", "claude-sonnet-4.6"], "أفضل مواءمة للأدوار البرمجية مع بديل أقل كلفة.", "high", "coding"),
      "security-resilience-auditor": assignment("security-resilience-auditor", "claude-opus-4.6", ["claude-sonnet-4.6", "gpt-5.4"], "يبقي الأدوار الحساسة على نموذج عالي الاعتمادية.", "high", "sensitive"),
      "testing-auditor": assignment("testing-auditor", "gpt-5.2-codex", ["gpt-5-mini", "claude-sonnet-4.6"], "فعال في تحليل التغطية والثغرات البرمجية.", "high", "coding"),
      "infrastructure-auditor": assignment("infrastructure-auditor", "claude-sonnet-4.6", ["gpt-5.4", "gemini-2.5-pro"], "قراءة جيدة للبنية وسياق طويل عند الحاجة.", "medium", "analysis"),
      "docs-compliance-auditor": assignment("docs-compliance-auditor", "claude-sonnet-4.6", ["claude-haiku-4.5", "gpt-5-mini"], "واضح في التوثيق والامتثال مع بدائل أخف.", "medium", "wide-context"),
      "runtime-verifier": assignment("runtime-verifier", "gpt-5.2-codex", ["gpt-5-mini", "claude-sonnet-4.6"], "أفضل توازن للتحقق التشغيلي والأوامر.", "high", "coding"),
      "report-synthesizer": assignment("report-synthesizer", "gpt-5.4", ["claude-sonnet-4.6", "claude-opus-4.6"], "تجميع نهائي أوضح مع بديل قوي.", "high", "synthesis"),
      "general-purpose": assignment("general-purpose", "gpt-5-mini", ["claude-sonnet-4.6", "gemini-2.5-flash"], "مهام ثانوية بتكلفة أقل مع بديل أوسع.", "medium", "general"),
    },
  },
  {
    profileId: "budget",
    title: "اقتصادي",
    description: "خفض التكلفة إلى أدنى حد ممكن مع الحفاظ على حد أمان للأدوار الحساسة.",
    rationale: "يناسب التشغيلات المتكررة عندما تكون الكلفة عاملًا أساسيًا.",
    reviewWindowDays: 60,
    sourceLinks: [
      "https://platform.openai.com/docs/models/gpt-5-mini",
      "https://www.anthropic.com/claude/haiku",
      "https://ai.google.dev/gemini-api/docs/models",
    ],
    assignments: {
      "structural-scout": assignment("structural-scout", "claude-haiku-4.5", ["gemini-2.5-flash", "gpt-5-mini"], "قراءة هيكلية سريعة بأقل تكلفة.", "medium", "wide-context"),
      "code-performance-auditor": assignment("code-performance-auditor", "gpt-5-mini", ["gpt-5.2-codex", "claude-sonnet-4.6"], "تقليل الكلفة مع إبقاء بديل أقوى متاحًا.", "low", "coding"),
      "security-resilience-auditor": assignment("security-resilience-auditor", "claude-sonnet-4.6", ["claude-opus-4.6", "gpt-5.4"], "لا يتم خفض الدور الحساس إلى نموذج غير مناسب أمنيًا.", "high", "sensitive"),
      "testing-auditor": assignment("testing-auditor", "gpt-5-mini", ["gpt-5.2-codex", "claude-sonnet-4.6"], "تكلفة أقل للاختبارات مع بديل برمجي متخصص.", "low", "coding"),
      "infrastructure-auditor": assignment("infrastructure-auditor", "gemini-2.5-flash", ["claude-sonnet-4.6", "gpt-5-mini"], "ملائم لقراءة ملفات كثيرة وسياق طويل اقتصاديًا.", "medium", "wide-context"),
      "docs-compliance-auditor": assignment("docs-compliance-auditor", "claude-haiku-4.5", ["gemini-2.5-flash", "gpt-5-mini"], "قراءة وثائق سريعة بتكلفة منخفضة.", "medium", "wide-context"),
      "runtime-verifier": assignment("runtime-verifier", "gpt-5-mini", ["gpt-5.2-codex", "claude-sonnet-4.6"], "يبقي دور التشغيل ضمن نماذج قادرة على الأدوات.", "medium", "coding"),
      "report-synthesizer": assignment("report-synthesizer", "claude-sonnet-4.6", ["gpt-5.4", "gpt-5-mini"], "يبقي تجميع التقرير واضحًا دون اللجوء لأغلى خيار افتراضيًا.", "medium", "synthesis"),
      "general-purpose": assignment("general-purpose", "gemini-2.5-flash", ["gpt-5-mini", "claude-haiku-4.5"], "بديل عام اقتصادي مع سياق واسع.", "medium", "general"),
    },
  },
];

export function getBuiltInProfile(profileId: PolicyProfileId): ModelPolicyProfileDefinition {
  const profile = BUILT_IN_PROFILES.find((item) => item.profileId === profileId);
  if (!profile) {
    throw new Error(`Unknown policy profile: ${profileId}`);
  }
  return profile;
}

export function buildSnapshotFromProfile(
  profileId: PolicyProfileId,
  now = new Date(),
  overrides?: Partial<Pick<ModelPolicySnapshot, "reviewByDate" | "reviewer" | "approvalNotes" | "sourceLinks">>,
): ModelPolicySnapshot {
  const profile = getBuiltInProfile(profileId);
  const reviewByDate = overrides?.reviewByDate
    ?? new Date(now.getTime() + profile.reviewWindowDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    snapshotId: `policy-${profileId}-${now.getTime()}`,
    title: profile.title,
    description: profile.description,
    profileId,
    status: "active",
    createdAt: now.toISOString(),
    publishedAt: null,
    reviewByDate,
    reviewer: overrides?.reviewer ?? null,
    approvalNotes: overrides?.approvalNotes ?? profile.rationale,
    sourceLinks: overrides?.sourceLinks ?? profile.sourceLinks,
    supersedesSnapshotId: null,
    supersededBySnapshotId: null,
    assignments: profile.assignments,
  };
}

export function buildDefaultActiveSnapshot(): ModelPolicySnapshot {
  const snapshot = buildSnapshotFromProfile(DEFAULT_POLICY_PROFILE_ID, new Date("2026-03-08T00:00:00.000Z"), {
    reviewByDate: DEFAULT_REVIEW_BY,
    reviewer: "Spec Kit Seed",
  });
  return snapshot;
}

export function getDefaultAgentModelIds(): Record<string, string> {
  const snapshot = buildDefaultActiveSnapshot();
  const entries = POLICY_AGENT_IDS.map((agentId) => [agentId, snapshot.assignments[agentId].primaryModelId]);
  return Object.fromEntries(entries);
}

export function listPolicyProfiles(): { profileId: PolicyProfileId; title: string; description: string }[] {
  return BUILT_IN_PROFILES.map((profile) => ({
    profileId: profile.profileId,
    title: profile.title,
    description: profile.description,
  }));
}
