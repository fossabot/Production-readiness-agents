# Data Model: Agent Model Policy

**Feature Branch**: `003-agent-model-policy`  
**Created**: 2026-03-08  
**Status**: Draft  
**Scope**: سياسة ربط النماذج داخل تطبيق سطح المكتب ولقطات الحل الفعلي داخل سجل التشغيل

---

## Overview

هذا النموذج يضيف طبقة سياسة فوق الإعدادات الحالية. الفكرة الأساسية هي أن التطبيق يحتفظ بفهرس نماذج غني بالقدرات، ويخزن نسخ سياسة منشورة ومؤرخة، ويطبق ملفًا جاهزًا أو تخصيصات يدوية، ثم يحل النموذج الفعلي لكل وكيل قبل التشغيل ويحفظ هذا القرار داخل سجل التشغيل.

---

## Entity Relationship Summary

```text
ModelCatalogEntry ─────┐
                       ├── referenced by ── AgentModelAssignment ──┐
PolicySnapshot ────────┘                                            │
                                                                    ├── selected by ── ModelPolicySettings
PolicyProfile ─────────────── contains assignments ──────────────────┘

ModelPolicySettings ── has many ── PolicyOverride
ModelPolicySettings ── points to ── active PolicySnapshot

CrewRunRecord ── stores ── RunPolicyResolutionSnapshot
RunPolicyResolutionSnapshot ── stores many ── AgentModelResolution
```

---

## 1. ModelCatalogEntry

الكيان المرجعي لكل نموذج قابل للعرض أو الاختيار أو التوصية.

```ts
type ModelLifecycle =
  | "active"
  | "preview"
  | "deprecated"
  | "retired";

type ModelTier =
  | "economy"
  | "balanced"
  | "frontier"
  | "specialized-coding";

type WorkloadTag =
  | "exploration"
  | "coding-agentic"
  | "deep-reasoning"
  | "report-synthesis"
  | "docs-analysis"
  | "budget";

interface ModelSourceRef {
  readonly label: string;
  readonly url: string;
  readonly reviewedAt: string; // ISO-8601
}

interface ModelCatalogEntry {
  readonly id: string;                    // exact runtime model identifier
  readonly provider: string;              // openai | anthropic | google | ...
  readonly displayName: string;
  readonly contextWindowTokens: number;
  readonly supportsTools: boolean;
  readonly tier: ModelTier;
  readonly lifecycle: ModelLifecycle;
  readonly workloadTags: WorkloadTag[];
  readonly reviewedAt: string;
  readonly sunsetAt: string | null;
  readonly sourceRefs: ModelSourceRef[];
}
```

### Validation Rules

- `id` يجب أن يكون فريدًا داخل الفهرس.
- `contextWindowTokens` يجب أن يكون أكبر من صفر.
- `sourceRefs` يجب ألا تكون فارغة لأي نموذج مضمّن في سياسة منشورة.
- `lifecycle="retired"` يمنع استخدام النموذج في سياسة جديدة.

---

## 2. AgentModelAssignment

يمثل الربط المعياري لوكيل واحد داخل نسخة سياسة منشورة.

```ts
type AgentRiskLevel = "standard" | "high-sensitivity";

interface MinimumRequirements {
  readonly supportsTools: boolean;
  readonly minContextWindowTokens: number;
  readonly allowPreview: boolean;
}

interface AgentModelAssignment {
  readonly agentId: string;
  readonly riskLevel: AgentRiskLevel;
  readonly primaryModelId: string;
  readonly fallbackModelIds: string[];
  readonly minimumRequirements: MinimumRequirements;
  readonly rationale: string;
  readonly confidence: "high" | "medium" | "low";
}
```

### Validation Rules

- `primaryModelId` و `fallbackModelIds[*]` يجب أن تشير إلى نماذج موجودة في الفهرس.
- `fallbackModelIds` يجب ألا تحتوي على `primaryModelId`.
- الأدوار:
  `security-resilience-auditor`
  و
  `report-synthesizer`
  يجب أن تحمل `riskLevel="high-sensitivity"`.
- إذا كانت `minimumRequirements.supportsTools=true` فلا يجوز تعيين نموذج `supportsTools=false` كخيار أساسي أو بديل.

---

## 3. PolicyProfile

ملف جاهز يعرض طريقة توزيع معتمدة للنماذج على جميع الوكلاء.

```ts
type PolicyProfileId = "accuracy" | "balanced" | "budget";

interface PolicyProfile {
  readonly profileId: PolicyProfileId;
  readonly displayName: string;
  readonly description: string;
  readonly assignments: AgentModelAssignment[];
}
```

### Validation Rules

- كل ملف يجب أن يغطي جميع الوكلاء المفعّلين افتراضيًا.
- يجب أن يحتوي على تعيين واحد فقط لكل `agentId`.

---

## 4. PolicySnapshot

نسخة سياسة منشورة ومؤرخة وغير قابلة للتعديل بعد النشر.

```ts
type PolicySnapshotStatus = "published" | "expired" | "retired";

interface PolicySnapshot {
  readonly policyId: string;             // e.g. policy-2026-03-08-balanced-v1
  readonly status: PolicySnapshotStatus;
  readonly effectiveDate: string;
  readonly reviewByDate: string;
  readonly approvedBy: string;
  readonly basedOnProfileId: PolicyProfileId;
  readonly assignments: AgentModelAssignment[];
  readonly notes: string | null;
  readonly sourceRefs: ModelSourceRef[];
  readonly supersedesPolicyId: string | null;
}
```

### State Transitions

```text
published -> expired   (when reviewByDate passes)
published -> retired   (when a newer snapshot supersedes it or owner retires it)
expired   -> retired   (manual archival)
```

### Validation Rules

- `effectiveDate <= reviewByDate`
- `assignments` يجب أن تغطي مجموعة الوكلاء المطلوبة للنسخة المنشورة.
- `sourceRefs` يجب أن تشير إلى مصادر رسمية أو معتمدة.

---

## 5. PolicyOverride

استثناء يدوي محلي على مستوى الوكيل.

```ts
interface PolicyOverride {
  readonly agentId: string;
  readonly modelId: string;
  readonly reason: string;
  readonly createdAt: string;
}
```

### Validation Rules

- `modelId` يجب أن يوجد في الفهرس.
- لا يجوز حفظ أكثر من استثناء واحد نشط لنفس الوكيل.

---

## 6. ModelPolicySettings

الجزء الجديد الذي يضاف إلى كائن الإعدادات الحالي.

```ts
interface LocalPolicyConstraints {
  readonly allowedProviders: string[];   // empty => no restriction
  readonly allowedModelIds: string[];    // empty => no restriction
  readonly disallowPreview: boolean;
}

interface ModelPolicySettings {
  readonly activePolicyId: string;
  readonly selectedProfileId: PolicyProfileId;
  overrides: Record<string, PolicyOverride>;
  constraints: LocalPolicyConstraints;
}

interface Settings {
  readonly schemaVersion: number;
  agents: Record<string, AgentConfig>;
  models: ModelCatalogEntry[];
  modelPolicy: ModelPolicySettings;
  secrets: SecretsConfig;
  runtime: RuntimePolicy;
  ui: UiPreferences;
}
```

### Validation Rules

- `activePolicyId` يجب أن يشير إلى نسخة سياسة منشورة موجودة.
- `selectedProfileId` يجب أن يطابق ملفًا جاهزًا معروفًا.
- إذا قيّدت المؤسسة قائمة النماذج أو المزودين، فيجب أن تُطبق هذه القيود أثناء الحل الفعلي لا أثناء تخزين النسخة المرجعية.

---

## 7. PolicyDiffPreview

كيان مشتق غير دائم يستخدم قبل التطبيق أو النشر.

```ts
interface AgentPolicyDelta {
  readonly agentId: string;
  readonly currentModelId: string | null;
  readonly nextModelId: string;
  readonly source: "profile" | "override-reset" | "publish";
}

interface PolicyDiffPreview {
  readonly previewId: string;
  readonly profileId: PolicyProfileId | null;
  readonly generatedAt: string;
  readonly deltas: AgentPolicyDelta[];
}
```

---

## 8. AgentModelResolution

القرار الفعلي الذي يستخدمه النظام أثناء التشغيل.

```ts
type ResolutionSource =
  | "policy-primary"
  | "policy-fallback"
  | "manual-override";

interface AgentModelResolution {
  readonly agentId: string;
  readonly requestedModelId: string;
  readonly resolvedModelId: string;
  readonly resolutionSource: ResolutionSource;
  readonly fallbackFromModelId: string | null;
  readonly fallbackReason: string | null;
}

interface RunPolicyResolutionSnapshot {
  readonly policyId: string;
  readonly profileId: PolicyProfileId;
  readonly generatedAt: string;
  readonly agentResolutions: Record<string, AgentModelResolution>;
}
```

### Validation Rules

- `resolvedModelId` يجب أن يكون صالحًا عند وقت بدء التشغيل.
- إذا كانت `resolutionSource="policy-fallback"` فيجب أن تكون `fallbackFromModelId` غير فارغة.

---

## 9. CrewRunRecord Extension

يمتد سجل التشغيل الحالي بدل استبداله.

```ts
interface CrewRunRecord {
  readonly runId: string;
  readonly repoPath: string;
  status: CrewRunStatus;
  readonly startedAt: string;
  finishedAt: string | null;
  lastUpdatedAt: string;
  readonly selectedAgents: string[];
  readonly modelConfigSnapshot: Record<string, string>; // user-facing configured values
  readonly policyResolutionSnapshot?: RunPolicyResolutionSnapshot;
  agentStates: Record<string, AgentRunState>;
  findingsSummary: FindingsSummary;
  reportPaths: {
    markdown?: string;
    json?: string;
    traces?: string;
  };
  error: RunError | null;
  durationMs: number | null;
}
```

### Why both snapshots remain

- `modelConfigSnapshot` يحفظ ما كان ظاهرًا في الإعدادات قبل الحل.
- `policyResolutionSnapshot` يحفظ ما استُخدم فعليًا بعد تطبيق السياسة والقيود والبدائل.

---

## 10. Storage Layout

```text
userData/
├── settings.json
├── model-policies/
│   ├── policy-2026-03-08-balanced-v1.json
│   ├── policy-2026-03-08-accuracy-v1.json
│   └── policy-2026-03-08-budget-v1.json
├── runs/
│   └── <runId>.json
├── reports/
│   └── ...
└── traces/
    └── ...
```

---

## 11. Derived Views for UI

```ts
interface AgentPolicyView {
  readonly agentId: string;
  readonly recommendedPrimaryModelId: string;
  readonly recommendedFallbackModelIds: string[];
  readonly effectiveModelId: string;
  readonly state: "policy-default" | "manual-override";
  readonly isStalePolicy: boolean;
  readonly hasPreviewDependency: boolean;
}
```

هذا الكيان مشتق، ويُستخدم لعرض واجهة المستخدم من دون تحميلها بتفاصيل التخزين الداخلية.
