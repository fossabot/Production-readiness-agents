# Implementation Plan: Production Readiness Crew

**Branch**: `001-production-readiness-crew` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-production-readiness-crew/spec.md`

## Summary

تنفيذ فريق Production Readiness Crew كنظام وكلاء متعددين يتكون من وكيل
رئيسي (supervisor) وثمانية وكلاء فرعيين متخصصين بالإضافة لوكيل احتياطي
اختياري. النظام يستخدم مكتبة `deepagents` (LangChain wrapper) التي توفر نوع
`SubAgent` لتعريف الوكلاء الفرعيين وتفويض المهام عبر أداة `task()`. الكود
الحالي يحتوي على دالة المصنع `createProductionReadinessCrewSubagents()` التي
تُنتج مصفوفة `SubAgent[]` مع عقد إخراج موحد وقواعد سلامة مشتركة. التنفيذ
يتطلب استكمال: تكامل التتبع (FR-016)، صيغة التقرير المزدوجة Markdown+JSON
(FR-017)، ودعم monorepo متعدد الدفعات (FR-018).

## Technical Context

**Language/Version**: TypeScript (ES2022+ target, strict mode)
**Primary Dependencies**: `deepagents` (LangChain JS wrapper — provides `SubAgent` type, `task()` delegation)
**Storage**: Filesystem-based (no database). ذاكرة عابرة عبر `StateBackend`، ذاكرة دائمة عبر `StoreBackend` تحت `/memories/`
**Testing**: لا يوجد إطار اختبار محدد حالياً — يجب إنشاؤه. المرشح: `vitest` (متوافق مع TypeScript ولا يحتاج تكوين معقد)
**Target Platform**: Node.js (CLI / programmatic API)
**Project Type**: Library — تُصدّر دالة مصنع `createProductionReadinessCrewSubagents()` + أنواع TypeScript
**Performance Goals**: إنتاج تقرير كامل لمستودع متوسط (< 50K LOC) في جلسة واحدة. التنفيذ المتوازي يقلل الزمن مقارنة بالتسلسلي.
**Constraints**: حجم مخرجات كل وكيل محدود بعقد الإخراج المضغوط (PARENT_RESULT_CONTRACT). نافذة سياق محدودة — monorepo يتطلب دفعات.
**Scale/Scope**: مستودعات من مشروع واحد إلى monorepo متعدد المشاريع الفرعية.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| المبدأ | الحالة | التبرير |
|--------|--------|---------|
| I. الإشراف أولاً لا التنفيذ أولاً | ✅ Pass | supervisor يخطط ويفوض فقط، لا يُنفذ مهام مباشرة (FR-001) |
| II. عقود صريحة ومنع الوراثة الضمنية | ✅ Pass | كل وكيل مُعرّف صريحاً بـ name, description, systemPrompt, tools (FR-004). الكود الحالي يُطبّق هذا |
| III. عزل السياق والحد الأدنى من الصلاحيات | ✅ Pass | FR-011 يفرض الحد الأدنى. FR-007 يحصر التنفيذ في runtime-verifier. الكود الحالي يُطبّق أدوات مخصصة لكل وكيل |
| IV. المهارات للمعرفة الكبيرة عند الطلب | ✅ Pass | skills اختيارية لكل وكيل عبر `ProductionReadinessCrewSkills`. لا وراثة تلقائية |
| V. ذاكرة تشغيلية دائمة وقابلة للتدقيق | ⚠️ Deferred | لا يوجد تكامل ذاكرة دائمة في الكود الحالي. يُؤجل لمرحلة لاحقة — التشغيل الأول يعمل بذاكرة عابرة فقط |
| §1. التكوين الإجباري للفريق | ✅ Pass | 8 وكلاء + general-purpose اختياري مُطبّق في الكود (FR-002, FR-003) |
| §2. طوبولوجيا التنفيذ الإلزامية | ✅ Pass | structural-scout أولاً → تخصصيون بالتوازي → report-synthesizer أخيراً (FR-005, FR-006) |
| §3. سياسة الأدوات | ✅ Pass | كل وكيل يحصل على أدواته فقط عبر `ProductionReadinessCrewTools` |
| §4. سياسة المهارات | ✅ Pass | مسارات المهارات مُحددة في الدستور. التنفيذ يدعمها عبر `ProductionReadinessCrewSkills` |
| §5. سياسة الذاكرة الدائمة | ⚠️ Deferred | مسارات الذاكرة مُحددة في الدستور لكن غير مُنفذة بعد. يُؤجل لمرحلة لاحقة |
| §6. سياسة الإخراج بين الوكلاء | ✅ Pass | `PARENT_RESULT_CONTRACT` يفرض خلاصة مضغوطة (FR-008) |
| §7. سياسة النماذج | ✅ Pass | النماذج قابلة للتخصيص عبر `ProductionReadinessCrewModels` — لا ربط بمزود واحد |
| §8. التتبع والمراقبة | 🔧 New | FR-016 يفرض التتبع. يجب تنفيذه في هذه الدورة |

**نتيجة البوابة**: ✅ PASS — مبدأان مؤجلان (V, §5) لا يمنعان التقدم. مبدأ واحد جديد (§8) يُنفذ في هذه الدورة.

## Project Structure

### Documentation (this feature)

```text
specs/001-production-readiness-crew/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── output-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
production-readiness-crew.subagents.ts    # Main factory (existing — to be enhanced)
src/
├── types.ts                              # Shared TypeScript types/interfaces
├── contracts/
│   ├── output-contract.ts                # PARENT_RESULT_CONTRACT as typed schema
│   └── report-schema.ts                  # Final report JSON schema
├── tracing/
│   └── tracer.ts                         # Execution tracing (FR-016)
└── report/
    ├── markdown-renderer.ts              # Markdown report generator
    ├── json-renderer.ts                  # JSON report generator
    └── validator.ts                      # Report validation (FR-017 parity checks)

tests/
├── unit/
│   ├── subagent-definitions.test.ts      # Validate all 9 subagent configs
│   ├── output-contract.test.ts           # Contract compliance
│   └── report-renderers.test.ts          # Markdown + JSON rendering
└── integration/
    └── crew-assembly.test.ts             # Full crew creation + config
```

**Structure Decision**: بنية مكتبة (library) مع الملف الرئيسي في الجذر
(`production-readiness-crew.subagents.ts`) وملفات دعم في `src/`. الاختبارات
في `tests/`. هذا يحافظ على التوافق مع الملف الموجود حالياً ويضيف البنية
اللازمة للمتطلبات الجديدة (FR-016, FR-017, FR-018).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| ⚠️ Deferred: Persistent Memory (V, §5) | النظام يعمل بذاكرة عابرة أولاً | التشغيل الأول لا يحتاج ذاكرة عبر جلسات — يُضاف لاحقاً عند الحاجة |
