# Implementation Plan: Agent Model Policy

**Branch**: `003-agent-model-policy` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-agent-model-policy/spec.md`

## Summary

إضافة طبقة سياسة نماذج مؤرخة وقابلة للتدقيق فوق إعدادات فريق
Production Readiness Crew
داخل تطبيق سطح المكتب. النهج التقني هو فصل "التوصية المعتمدة" عن "التخصيص اليدوي" عن "الحل الفعلي وقت التشغيل"، مع تخزين نسخ سياسة غير قابلة للتعديل بعد النشر، وحسم النموذج الفعلي لكل وكيل داخل العملية الرئيسية قبل تشغيل العامل الخلفي، ثم تمرير خريطة النماذج الفعلية وسجل الحل إلى التشغيل والتاريخ. تطبيق الملف الجاهز يبقي التخصيصات اليدوية قائمة افتراضيًا ما لم يطلب المستخدم استبدالها صراحة، كما تُرسل قرارات الحل والتحويل والمنع إلى منظومة التتبع الخارجي الحالية بدل الاكتفاء بسجل التشغيل المحلي.

## Technical Context

**Language/Version**: TypeScript 5.4, React 19, Electron 34, Node.js 20 typings  
**Primary Dependencies**: Electron, React, Zustand, electron-vite, electron-builder, TypeScript, طبقة الفريق الحالية المبنية على `deepagents` و `langchain`  
**Storage**: ملفات JSON داخل `userData/` مع توسيع `settings.json` وإضافة دليل `model-policies/` للنسخ المؤرخة، مع استمرار استخدام `runs/` لحفظ لقطات التشغيل  
**Testing**: Vitest لاختبارات منطق الحل والتحقق والتخزين وطبقة `IPC`، مع اختبارات تكامل على مستوى الوحدات الحالية، وفحص يدوي لواجهة Electron  
**Target Platform**: تطبيق سطح مكتب Electron على Windows وmacOS وLinux  
**Project Type**: desktop-app يوسع التطبيق الحالي ولا يغير مكتبة الفريق الأساسية  
**Performance Goals**: تحميل سياسة النماذج خلال أقل من 500ms، ومعاينة أي ملف ربط خلال أقل من 200ms، والتحقق المسبق وحل النماذج قبل التشغيل خلال أقل من 1s، ومن دون زيادة ملحوظة في زمن بدء التشغيل  
**Performance Verification**: يجب التحقق من هذه الحدود عبر اختبارات زمنية خفيفة أو قياسات موثقة أثناء التطوير  
**Constraints**: لا تغيير في طوبولوجيا الوكلاء، العملية الرئيسية وحدها تكتب ملفات السياسة، يجب الحفاظ على تتبع قابل لإعادة الإنتاج لكل تشغيل، ويجب ربط قرارات حل السياسة بالتتبع الخارجي الحالي لا الاكتفاء بسجل التشغيل المحلي، ويعتمد تنبيه التقادم في النسخة الأولى على مقارنة التاريخ الحالي مع `reviewByDate` داخل النسخة النشطة، ويجب ألا تتحول السياسة إلى ربط جامد بمزود واحد  
**Scale/Scope**: 8 وكلاء تخصصيين + وكيل احتياطي اختياري، 3 ملفات ربط جاهزة في النسخة الأولى، 10-20 سجل نموذج في الفهرس، وعشرات نسخ السياسة المؤرشفة محليًا

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| عدم تغيير طوبولوجيا الفريق | PASS | الميزة تضيف طبقة سياسة فوق الإعدادات الحالية ولا تضيف وكلاء أو تحذفهم |
| العقود الصريحة لكل وكيل | PASS | تعريفات الوكلاء في المكتبة الأساسية لا تتغير؛ الجديد هو ربط خارجي بالنماذج فقط |
| عزل السياق والحد الأدنى من الصلاحيات | PASS | حل السياسة يتم في العملية الرئيسية قبل التشغيل، والعامل الخلفي يستقبل خريطة نماذج محلولة فقط |
| سياسة النماذج بحسب المهمة لا بحسب المزود | PASS | السياسة المقترحة تدعم ملفات ربط هجينة ومتعددة المزودين ولا تنقل الربط إلى الدستور |
| التتبع الإلزامي | PASS | التصميم يوسّع سجل التشغيل لحفظ السياسة الفعالة وقرار التحويل إلى البديل عند اللزوم |
| عدم الوراثة الضمنية | PASS | سيظل كل وكيل يملك ربطًا صريحًا ظاهرًا، ولن يعتمد على قيمة عامة غير محلولة |
| سلامة الحوكمة والتحديث | PASS | التوصيات المؤرخة ستعيش في نسخ سياسة محلية قابلة للمقارنة والمراجعة قبل الاعتماد |

**Post-Phase 1 re-check**: PASS — التصميم المقترح يحافظ على نفس عدد الوكلاء، ويجعل قرار اختيار النموذج قابلاً للتدقيق من الإعدادات إلى التشغيل إلى السجل التاريخي، من دون نقل سياسة المزود إلى الدستور أو إلى المكتبة الأساسية.

## Project Structure

### Documentation (this feature)

```text
specs/003-agent-model-policy/
├── plan.md                         # This file
├── research.md                     # Phase 0: policy, storage, and model-selection decisions
├── data-model.md                   # Phase 1: policy entities and run-resolution model
├── quickstart.md                   # Phase 1: developer and operator verification flow
├── contracts/
│   └── model-policy-ipc-contract.md
└── tasks.md                        # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── ipc/
│   │   ├── channels.ts                  # add policy-related channel names
│   │   ├── contracts.ts                 # extend IPC request/response types
│   │   └── handlers.ts                  # preview/apply/override/publish policy handlers
│   ├── persistence/
│   │   ├── settings-store.ts            # extend Settings with active policy + overrides
│   │   ├── run-store.ts                 # persist effective model resolution snapshot
│   │   └── model-policy-store.ts        # new immutable snapshot file store
│   ├── policy/
│   │   ├── catalog.ts                   # seeded model catalog and built-in profiles
│   │   ├── resolver.ts                  # preflight validation + effective-model resolution
│   │   └── diff.ts                      # derive preview/diff output before apply/publish
│   ├── types/
│   │   ├── settings.ts                  # extend model and policy settings types
│   │   ├── run.ts                       # add actual policy/model resolution snapshot
│   │   └── model-policy.ts              # new policy-specific entities and derived views
│   └── worker/
│       ├── crew-worker.ts               # receive resolved models + policy snapshot metadata
│       └── crew-runtime.ts              # consume effective per-agent models only
├── src/
│   ├── components/
│   │   ├── ModelPicker.tsx              # show recommendation and compatibility state
│   │   ├── PolicyProfilePanel.tsx       # built-in profile cards and preview
│   │   ├── AgentPolicyTable.tsx         # per-agent primary/fallback/override view
│   │   └── PolicyStatusBadge.tsx        # age, preview, review, and constraint markers
│   ├── hooks/
│   │   └── useModelPolicy.ts            # load/apply/override/publish policy state
│   ├── state/
│   │   └── model-policy-store.ts        # renderer-side policy state and preview results
│   └── pages/
│       ├── SettingsPage.tsx             # add policy tab and integrate previews/overrides/publish
│       ├── ScanPage.tsx                 # show preflight blocking and fallback messaging before run start
│       ├── HistoryPage.tsx              # show policy resolution outcomes for completed runs
│       └── ReportPage.tsx               # expose effective policy summary in completed run details
├── package.json
└── tsconfig.json

src/
└── types.ts                            # untouched contract for ProductionReadinessCrewModels
```

**Structure Decision**: تنفيذ الميزة سيبقى داخل تطبيق سطح المكتب في `desktop/` مع إضافة وحدة سياسة محلية في العملية الرئيسية. مكتبة الفريق الأساسية في الجذر تظل مسؤولة عن تعريف الوكلاء وقبول خريطة النماذج، بينما التطبيق المكتبي يصبح مسؤولًا عن توصية السياسة، والتحقق المسبق، وحل النماذج الفعلي، وسجل التدقيق.

## Complexity Tracking

> No constitution violations detected. No complexity justifications needed.
