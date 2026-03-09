# Research: Production Readiness Crew

**Feature**: 001-production-readiness-crew
**Date**: 2026-03-08

## R1: deepagents SubAgent Interface

**Decision**: استخدام نوع `SubAgent` من مكتبة `deepagents` كنوع أساسي لتعريف
الوكلاء الفرعيين.

**Rationale**: الكود الحالي يستورد `SubAgent` من `deepagents` ويبني عليه.
المكتبة توفر: تفويض عبر `task()`, عزل السياق, progressive disclosure للمهارات.

**Alternatives considered**:
- `@anthropic-ai/claude-agent-sdk` (AgentDefinition type): أكثر رسمية لكن
  واجهة مختلفة (description/prompt بدلاً من name/description/systemPrompt).
  الترحيل ممكن مستقبلاً لكن يكسر الكود الحالي.
- تعريف أنواع محلية بدون إطار عمل: يفقد ميزة التفويض المدمج والتخطيط.

**SubAgent fields المستخدمة**:
- `name` (required): معرف الوكيل
- `description` (required): وصف للتفويض
- `systemPrompt` (required): تعليمات النظام الكاملة
- `tools` (required): مصفوفة الأدوات المخصصة
- `model` (optional): نموذج مخصص عبر `ModelRef`
- `skills` (optional): مسارات المهارات
- `middleware` (optional): طبقة وسيطة
- `interruptOn` (optional): شروط المقاطعة

## R2: Testing Framework

**Decision**: `vitest` كإطار اختبار.

**Rationale**: متوافق أصلياً مع TypeScript وESM. لا يحتاج تكوين Babel أو
ts-jest. سريع (HMR-based). يدعم mocking مدمج.

**Alternatives considered**:
- Jest + ts-jest: أكثر انتشاراً لكن يحتاج تكوين إضافي لـ ESM + TypeScript.
- Node.js built-in test runner: لا يدعم TypeScript مباشرة.

## R3: Report Dual Format (Markdown + JSON)

**Decision**: إنتاج التقرير النهائي بصيغتين: Markdown للبشر و JSON للأنظمة.

**Rationale**: Markdown يوفر قراءة فورية. JSON يمكّن: الاختبارات الآلية
(التحقق من SC-002 coverage)، التجميع عبر تشغيلات متعددة، الأرشفة، والتكامل
مع واجهات خارجية.

**Alternatives considered**:
- Markdown فقط: جيد للبشر لكن يصعب التحليل الآلي.
- JSON فقط: جيد للأنظمة لكن غير مقروء بسرعة.
- نص في المحادثة فقط: يضعف الأرشفة والاختبار.

**Implementation approach**: report-synthesizer يُنتج كائن بيانات موحد داخلياً
(في TypeScript). ثم يُمرر لـ `markdown-renderer` و `json-renderer` لإنتاج
الصيغتين. هذا يضمن تطابق المحتوى.

## R4: Execution Tracing (FR-016)

**Decision**: تتبع خفيف الوزن قائم على الأحداث (event-based tracing).

**Rationale**: الدستور (§8) يفرض التتبع كشرط تشغيل. `deepagents` لا يوفر
تتبعاً مدمجاً كاملاً. الحل: طبقة تتبع محلية تسجل الأحداث (تفويض، أدوات،
فشل، أزمنة) وتُصدّرها كجزء من التقرير النهائي.

**Alternatives considered**:
- OpenTelemetry integration: شامل لكن ثقيل لمكتبة. يُضاف لاحقاً كطبقة
  اختيارية.
- LangSmith/LangFuse: خدمات خارجية. لا تُفرض كتبعية إجبارية.

**Tracing events**:
- `crew:start` — بداية التشغيل
- `agent:delegated` — تفويض مهمة لوكيل فرعي
- `agent:completed` — اكتمال وكيل فرعي
- `agent:failed` — فشل وكيل فرعي
- `agent:retried` — إعادة محاولة
- `tool:called` — استدعاء أداة
- `crew:completed` — اكتمال التشغيل

## R5: Monorepo Multi-Pass Strategy (FR-018)

**Decision**: فحص كامل لجميع المشاريع الفرعية عبر دفعات محدودة.

**Rationale**: المستخدم اختار الفحص الشامل (لا اختيار جزئي). عند تجاوز
نافذة السياق، يُقسّم الفحص إلى دفعات مع تجديد السياق بين الدفعات.

**Implementation approach**:
1. `structural-scout` يكتشف جميع المشاريع الفرعية في المرحلة الأولى.
2. supervisor يقسّمها إلى دفعات بحجم مناسب لنافذة السياق.
3. كل دفعة تُنفذ كتشغيل كامل (استكشاف → تدقيق → نتائج).
4. النتائج التراكمية تُحفظ في ذاكرة عابرة بين الدفعات.
5. report-synthesizer يدمج نتائج جميع الدفعات في التقرير النهائي.
6. التقرير يُصرّح بعدد المشاريع والدفعات المفحوصة.

**Alternatives considered**:
- اختيار المشاريع الأهم تلقائياً: يخاطر بتجاهل مشاريع حرجة.
- اختيار يدوي من المستخدم: يضيف حاجزاً تفاعلياً غير مرغوب.

## R6: Severity Scale

**Decision**: 4 مستويات: Critical, High, Medium, Low + قسم Observations منفصل.

**Rationale**: اختيار المستخدم في مرحلة التوضيح. يوازن بين الدقة والبساطة.
الملاحظات المعلوماتية لا تُمثّل كنتائج ذات شدة.

**Scale definitions**:
- **Critical**: مانع إطلاق مباشر — يمنع النشر الإنتاجي
- **High**: يجب إصلاحه قبل الإنتاج — خطر عالي لكن لا يمنع الإطلاق وحده
- **Medium**: مؤثر على الجودة — لا يمنع الإطلاق وحده لكن يؤثر على الاستقرار
- **Low**: تحسين محدود التأثير — ممارسة أفضل لكن ليس ضرورياً للإطلاق
- **Observations**: ملاحظات معلوماتية — لا تتطلب إجراء فوري
