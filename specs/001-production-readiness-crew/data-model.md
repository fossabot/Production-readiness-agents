# Data Model: Production Readiness Crew

**Feature**: 001-production-readiness-crew
**Date**: 2026-03-08

## Entities

### 1. SubAgent

الوحدة الأساسية في الفريق.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| name | string | Yes | معرف فريد (e.g., `structural-scout`) |
| description | string | Yes | وصف للتفويض — يستخدمه supervisor لاتخاذ قرار |
| systemPrompt | string | Yes | تعليمات النظام الكاملة (عربي) |
| tools | Tool[] | Yes | مصفوفة الأدوات المخصصة |
| model | ModelRef | No | نموذج مخصص |
| skills | string[] | No | مسارات المهارات |
| middleware | Middleware | No | طبقة وسيطة |
| interruptOn | InterruptConfig | No | شروط المقاطعة |

**Relationships**: ينتمي لـ CrewConfiguration (1:N). يُنتج SubagentOutput (1:1 لكل تشغيل).

### 2. ProductionReadinessCrewTools

تخصيص الأدوات لكل وكيل فرعي.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| structuralScout | Tool[] | Yes | أدوات الاستكشاف البنيوي |
| codePerformanceAuditor | Tool[] | Yes | أدوات تدقيق الكود والأداء |
| securityResilienceAuditor | Tool[] | Yes | أدوات تدقيق الأمان |
| testingAuditor | Tool[] | Yes | أدوات تدقيق الاختبارات |
| infrastructureAuditor | Tool[] | Yes | أدوات تدقيق البنية التحتية |
| docsComplianceAuditor | Tool[] | Yes | أدوات تدقيق التوثيق |
| runtimeVerifier | Tool[] | Yes | أدوات التحقق التشغيلي (تنفيذ فعلي) |
| reportSynthesizer | Tool[] | Yes | أدوات تجميع التقرير |
| generalPurposeFallback | Tool[] | No | أدوات الوكيل الاحتياطي |

### 3. ProductionReadinessCrewModels

تخصيص النماذج اختيارياً لكل وكيل.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| [agentName] | ModelRef | No | نموذج مخصص لكل وكيل (camelCase) |

**Note**: جميع الحقول اختيارية. الوكلاء بدون نموذج مخصص يستخدمون النموذج الافتراضي.

### 4. ProductionReadinessCrewSkills

تخصيص المهارات اختيارياً لكل وكيل.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| [agentName] | string[] | No | مسارات المهارات لكل وكيل |

### 5. ProductionReadinessCrewOptions

كائن التكوين العام.

| Field | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| models | ProductionReadinessCrewModels | No | {} | تخصيص النماذج |
| skills | ProductionReadinessCrewSkills | No | {} | تخصيص المهارات |
| includeGeneralPurposeFallback | boolean | No | false | تضمين الوكيل الاحتياطي |

### 6. SubagentOutput (عقد الإخراج الموحد)

مخرج كل وكيل فرعي.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| summary | string | Yes | ملخص قصير للمهمة المنجزة |
| findings | Finding[] | Yes | النتائج الجوهرية |
| evidence | Evidence[] | Yes | الأدلة المرجعية (ملفات، أسطر، أوامر) |
| uncertainties | string[] | Yes | حالات عدم اليقين |
| handoff | string | Yes | ما يحتاجه الوكيل التالي |

### 7. Finding

نتيجة فردية من وكيل تدقيق.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| id | string | Yes | معرف فريد (e.g., `SEC-001`) |
| title | string | Yes | عنوان قصير |
| severity | Severity | Yes | Critical / High / Medium / Low |
| category | string | Yes | تصنيف (security, performance, etc.) |
| description | string | Yes | وصف تفصيلي |
| evidence | Evidence[] | Yes | أدلة مرتبطة |
| recommendation | string | Yes | توصية للمعالجة |
| effort | EffortLevel | No | تقدير الجهد (low/medium/high) |
| source_agent | string | Yes | اسم الوكيل المُنتِج |

### 8. ProjectManifest

مخرج structural-scout.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| appType | string | Yes | نوع التطبيق (web, cli, library, etc.) |
| packageManager | string | No | مدير الحزم (npm, yarn, pnpm, pip, etc.) |
| entryPoints | string[] | Yes | نقاط الدخول الرئيسية |
| configFiles | string[] | Yes | ملفات التكوين المكتشفة |
| isMonorepo | boolean | Yes | هل هو monorepo |
| subprojects | SubprojectInfo[] | No | المشاريع الفرعية (إذا monorepo) |
| languages | string[] | Yes | لغات البرمجة المكتشفة |

### 9. ExecutionContext

مخرج structural-scout — سياق التنفيذ.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| commands | CommandSpec[] | Yes | الأوامر القابلة للتنفيذ |
| environment | Record<string, string> | No | متغيرات البيئة المطلوبة |
| constraints | string[] | No | القيود التشغيلية |
| allowedCommands | string[] | Yes | الأوامر المسموح بها (install, build, test, lint) |

### 10. FinalReport

التقرير النهائي الموحد.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| executiveSummary | string | Yes | ملخص تنفيذي |
| overallScore | string | No | تقييم إجمالي |
| findings | Finding[] | Yes | جميع النتائج (بعد إزالة التكرارات) |
| observations | Observation[] | Yes | الملاحظات المعلوماتية |
| coverageReport | CoverageEntry[] | Yes | تغطية المحاور الثمانية |
| remediationPlan | RemediationStep[] | Yes | خطة المعالجة المرحلية |
| gaps | GapDeclaration[] | Yes | الفجوات (محاور لم تُفحص) |
| metadata | ReportMetadata | Yes | بيانات وصفية (تاريخ، مدة، وكلاء) |
| tracing | TracingData | Yes | بيانات التتبع (FR-016) |

## Enums

### Severity

```
Critical | High | Medium | Low
```

### EffortLevel

```
low | medium | high
```

## State Transitions

### Crew Execution Lifecycle

```
idle → planning → scouting → auditing → synthesizing → complete
                                 ↓
                           failed (partial)
                                 ↓
                           complete (with gaps)
```

1. **idle**: لم يبدأ التشغيل
2. **planning**: supervisor يقرأ الطلب ويكتب خطة العمل
3. **scouting**: structural-scout يُنتج ProjectManifest + ExecutionContext
4. **auditing**: الوكلاء التخصصيون يعملون بالتوازي + runtime-verifier
5. **synthesizing**: report-synthesizer يدمج النتائج
6. **complete**: التقرير النهائي جاهز (Markdown + JSON)
7. **failed (partial)**: وكيل واحد أو أكثر فشل → يُسجّل كفجوة → ينتقل إلى synthesizing
