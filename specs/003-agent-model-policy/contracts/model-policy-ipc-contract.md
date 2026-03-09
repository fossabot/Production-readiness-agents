# Contract: Model Policy IPC

**Feature Branch**: `003-agent-model-policy`  
**Scope**: العقود الجديدة بين
renderer
و
main process
المتعلقة بسياسة ربط النماذج

---

## Overview

العقود الحالية الخاصة بالإعدادات ستبقى موجودة، لكن هذه الميزة تحتاج أوامر مخصصة للمعاينة والتطبيق والاستثناءات والنشر، بدل حشر جميع السلوكيات داخل تحديث عام للإعدادات.

---

## New Channels

| Channel | Request | Response | Purpose |
|---------|---------|----------|---------|
| `MODEL_POLICY_GET_STATE` | `{}` | `ModelPolicyStateView` | تحميل السياسة النشطة والفهرس والملفات الجاهزة والاستثناءات |
| `MODEL_POLICY_PREVIEW_PROFILE` | `{ profileId }` | `PolicyDiffPreview` | معاينة أثر ملف جاهز قبل التطبيق |
| `MODEL_POLICY_APPLY_PROFILE` | `{ profileId }` | `ModelPolicyStateView` | تطبيق ملف جاهز وتحديث الإعدادات |
| `MODEL_POLICY_SET_OVERRIDE` | `{ agentId, modelId, reason }` | `ModelPolicyStateView` | حفظ استثناء يدوي لوكيل واحد |
| `MODEL_POLICY_CLEAR_OVERRIDE` | `{ agentId }` | `ModelPolicyStateView` | إزالة الاستثناء اليدوي والرجوع إلى السياسة |
| `MODEL_POLICY_LIST_SNAPSHOTS` | `{}` | `{ snapshots: PolicySnapshotSummary[] }` | عرض النسخ المؤرشفة |
| `MODEL_POLICY_PUBLISH_SNAPSHOT` | `PublishPolicySnapshotInput` | `PublishPolicySnapshotOutput` | نشر نسخة سياسة جديدة بعد مراجعة الفروقات |

---

## Request / Response Types

### 1. `MODEL_POLICY_GET_STATE`

```ts
interface ModelPolicyStateView {
  readonly activePolicy: PolicySnapshotSummary;
  readonly profiles: PolicyProfileSummary[];
  readonly modelCatalog: ModelCatalogSummary[];
  readonly overrides: Record<string, PolicyOverride>;
  readonly constraints: LocalPolicyConstraints;
  readonly perAgentView: AgentPolicyView[];
  readonly isStale: boolean;
}
```

### 2. `MODEL_POLICY_PREVIEW_PROFILE`

```ts
interface PreviewProfileInput {
  readonly profileId: "accuracy" | "balanced" | "budget";
}
```

```ts
interface PolicyDiffPreview {
  readonly previewId: string;
  readonly generatedAt: string;
  readonly deltas: AgentPolicyDelta[];
}
```

### 3. `MODEL_POLICY_APPLY_PROFILE`

```ts
interface ApplyProfileInput {
  readonly profileId: "accuracy" | "balanced" | "budget";
}
```

تعيد:

```ts
type ApplyProfileOutput = ModelPolicyStateView;
```

### 4. `MODEL_POLICY_SET_OVERRIDE`

```ts
interface SetOverrideInput {
  readonly agentId: string;
  readonly modelId: string;
  readonly reason: string;
}
```

تعيد:

```ts
type SetOverrideOutput = ModelPolicyStateView;
```

### 5. `MODEL_POLICY_CLEAR_OVERRIDE`

```ts
interface ClearOverrideInput {
  readonly agentId: string;
}
```

تعيد:

```ts
type ClearOverrideOutput = ModelPolicyStateView;
```

### 6. `MODEL_POLICY_LIST_SNAPSHOTS`

```ts
interface PolicySnapshotSummary {
  readonly policyId: string;
  readonly effectiveDate: string;
  readonly reviewByDate: string;
  readonly basedOnProfileId: string;
  readonly status: "published" | "expired" | "retired";
}
```

### 7. `MODEL_POLICY_PUBLISH_SNAPSHOT`

```ts
interface PublishPolicySnapshotInput {
  readonly basedOnProfileId: "accuracy" | "balanced" | "budget";
  readonly assignments: AgentModelAssignment[];
  readonly notes: string | null;
  readonly approvedBy: string;
}

interface PublishPolicySnapshotOutput {
  readonly policyId: string;
  readonly diffFromPrevious: AgentPolicyDelta[];
  readonly activePolicy: PolicySnapshotSummary;
}
```

---

## Start Run Integration

الأمر الحالي:

`CREW_START_RUN`

لا يحتاج تغييرًا في واجهة
renderer
الأساسية، لكنه يحتاج سلوكًا داخليًا جديدًا داخل العملية الرئيسية:

1. تحميل السياسة النشطة والقيود المحلية.
2. بناء
   `RunPolicyResolutionSnapshot`
   قبل إنشاء العامل الخلفي.
3. حفظ اللقطة في
   `CrewRunRecord`
   قبل بدء التشغيل.
4. تمرير خريطة النماذج الفعلية فقط إلى العامل الخلفي.

---

## Error Cases

| Code | When emitted | Meaning |
|------|--------------|---------|
| `CONFIG_ERROR` | لا توجد سياسة نشطة أو يوجد وكيل دون ربط صالح | يمنع بدء التشغيل |
| `CONFIG_ERROR` | النموذج الأساسي والبديل غير صالحين لوكيل مفعّل | يمنع بدء التشغيل |
| `INPUT_ERROR` | نموذج غير موجود في الفهرس | رفض تحديث أو استثناء |
| `STORE_ERROR` | فشل حفظ نسخة سياسة أو تحديث الإعدادات | فشل طبقة التخزين |

---

## Compatibility Rule

كل الاستجابات يجب أن تكون قابلة للبناء من
`ModelPolicyStateView`
حتى تبقى الواجهة الرسومية بسيطة، وتستطيع تحديث جميع المساحات المعروضة من حمولة واحدة متسقة.
