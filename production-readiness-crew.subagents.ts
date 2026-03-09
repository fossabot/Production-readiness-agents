import type { SubAgent } from "deepagents";
import { createMiddleware } from "langchain";

import type {
  ProductionReadinessCrewTools,
  ProductionReadinessCrewModels,
  ProductionReadinessCrewSkills,
  ProductionReadinessCrewOptions,
} from "./src/types.js";

import {
  PARENT_RESULT_CONTRACT,
  SHARED_SAFETY_RULES,
} from "./src/contracts/output-contract.js";

import { TracingCollector } from "./src/tracing/tracer.js";

// ─── Re-exports (public API surface) ─────────────────────────────────────────

export type {
  ProductionReadinessCrewTools,
  ProductionReadinessCrewModels,
  ProductionReadinessCrewSkills,
  ProductionReadinessCrewOptions,
};

type CrewSubagentName =
  | "general-purpose"
  | "structural-scout"
  | "code-performance-auditor"
  | "security-resilience-auditor"
  | "testing-auditor"
  | "infrastructure-auditor"
  | "docs-compliance-auditor"
  | "runtime-verifier"
  | "report-synthesizer";

export const PRODUCTION_READINESS_SUPERVISOR_PROMPT = `
أنت المشرف الرئيسي (supervisor) لفريق Production Readiness Crew.

دورك إشرافي وتنسيقي فقط. لا تنفذ عملاً تخصصياً بنفسك ما دام يمكن تفويضه إلى الوكلاء الفرعيين المناسبين.

قواعد التشغيل الإلزامية:
1. ابدأ دائماً مع structural-scout أولاً. لا تنتقل إلى التدقيق العميق قبل أن تستلم ProjectManifest وExecutionContext بشكل صريح.
2. بعد اكتمال structural-scout:
   - أطلق الوكلاء التخصصيين بالتوازي كلما كانت المهام مستقلة:
     code-performance-auditor
     security-resilience-auditor
     testing-auditor
     infrastructure-auditor
     docs-compliance-auditor
   - شغّل runtime-verifier فقط بعد تحقق بوابة السلامة واعتماد allowedCommands.
3. شغّل report-synthesizer أخيراً فقط بعد تجميع نتائج الاستكشاف والتدقيق والتشغيل.

قواعد الموثوقية:
- إذا فشل وكيل فرعي، أعد المحاولة مرة واحدة فقط مع توضيح سبب إعادة المحاولة.
- إذا فشل مرة ثانية أو بقيت الأدلة غير كافية، لا تختلق نتائج؛ سجّل ذلك كـ Gap واضح في التقرير النهائي.
- عند وجود Uncertainties من وكيل فرعي، انقلها بوضوح إلى التقرير النهائي أو اطلب تغطية تكميلية من الوكيل الأنسب.

قواعد النطاق:
- نطاقك الحصري هو فحص جاهزية الإنتاج (Production Readiness) فقط. إذا تلقيت طلباً خارج هذا النطاق (مثلاً: كتابة كود جديد، إصلاح أخطاء، مراجعة تصميم، أو أي مهمة لا تتعلق بتقييم جاهزية مستودع للنشر الإنتاجي)، ارفض الطلب بأدب مع توضيح أن النظام مخصص لفحص جاهزية الإنتاج فقط، ولا تفوض أي مهمة للوكلاء الفرعيين.
- لا تسمح لأي وكيل بأن يتجاوز نطاقه التخصصي.
- لا تستخدم general-purpose إلا عندما تكون المهمة ثانوية متعددة الخطوات ولا يوجد وكيل تخصصي أوضح.
- لا تسمح لأي وكيل غير runtime-verifier بتنفيذ أوامر تشغيل فعلية.

قواعد monorepo:
- إذا أعلن structural-scout أن المستودع monorepo أو متعدد المشاريع الفرعية، فافحص جميع المشاريع الفرعية الواقعة ضمن النطاق.
- إذا كان الحجم يتجاوز نافذة سياق واحدة، قسّم التنفيذ إلى batches متتالية، واحتفظ بالنتائج التراكمية بين الدفعات.
- يجب التصريح بعدد الدفعات والمشاريع الفرعية المفحوصة فعلياً في التقرير النهائي.

قواعد التتبع والدستور:
- اعتبر .specify/memory/constitution.md السلطة الحاكمة لأي قرار سياسة.
- حافظ على سجل تتبع واضح للتفويضات، استدعاءات الأدوات، الإخفاقات، وإعادة المحاولة.
- اعتبر أي تشغيل بلا tracing أو بلا coverage كامل للمحاور الأساسية تشغيلًا غير مكتمل.

هدفك النهائي: تقرير Production Readiness موحد، موجز، مدعوم بالأدلة، بلا تكرار، وبلا ادعاءات غير مثبتة.
`.trim();

function createTracingMiddlewareFactory(
  tracer: TracingCollector | undefined,
): (agentName: CrewSubagentName) => ReturnType<typeof createMiddleware>[] | undefined {
  if (!tracer) {
    return () => undefined;
  }

  const attempts = new Map<CrewSubagentName, number>();
  const startTimes = new Map<CrewSubagentName, number>();
  let autoCrewStartRecorded = tracer
    .getEvents()
    .some((event) => event.type === "crew:start");
  let autoCrewCompletedRecorded = tracer
    .getEvents()
    .some((event) => event.type === "crew:completed");
  let crewStartMs: number | null = null;

  return (agentName) => [
    createMiddleware({
      name: `production-readiness-tracing:${agentName}`,
      beforeAgent: async () => {
        const now = new Date();
        const timestamp = now.toISOString();
        const attempt = attempts.get(agentName) ?? 0;

        if (!autoCrewStartRecorded) {
          autoCrewStartRecorded = true;
          crewStartMs = now.getTime();
          tracer.record({ type: "crew:start", timestamp });
        }

        if (attempt > 0) {
          tracer.record({
            type: "agent:retried",
            agent: agentName,
            timestamp,
          });
        }

        attempts.set(agentName, attempt + 1);
        tracer.record({
          type: "agent:delegated",
          from: "supervisor",
          to: agentName,
          timestamp,
        });
        startTimes.set(agentName, now.getTime());
      },
      wrapToolCall: async (request, handler) => {
        tracer.record({
          type: "tool:called",
          agent: agentName,
          tool: String(request.tool?.name ?? request.toolCall.name),
          timestamp: new Date().toISOString(),
        });

        return handler(request);
      },
      wrapModelCall: async (request, handler) => {
        try {
          return await handler(request);
        } catch (error) {
          const startTime = startTimes.get(agentName);
          startTimes.delete(agentName);

          tracer.record({
            type: "agent:failed",
            agent: agentName,
            timestamp: new Date().toISOString(),
            duration_ms: startTime === undefined ? 0 : Date.now() - startTime,
            reason: error instanceof Error ? error.message : String(error),
          });

          throw error;
        }
      },
      afterAgent: async () => {
        const now = Date.now();
        const startTime = startTimes.get(agentName);
        startTimes.delete(agentName);

        tracer.record({
          type: "agent:completed",
          agent: agentName,
          timestamp: new Date(now).toISOString(),
          duration_ms: startTime === undefined ? 0 : now - startTime,
        });

        if (
          agentName === "report-synthesizer" &&
          !autoCrewCompletedRecorded
        ) {
          autoCrewCompletedRecorded = true;
          tracer.record({
            type: "crew:completed",
            timestamp: new Date(now).toISOString(),
            total_duration_ms:
              crewStartMs === null ? 0 : Math.max(0, now - crewStartMs),
          });
        }
      },
    }),
  ];
}

// ─── Extended options ────────────────────────────────────────────────────────

export interface ProductionReadinessCrewFullOptions
  extends ProductionReadinessCrewOptions {
  /**
   * TracingCollector instance for execution tracing.
   * If not provided, a new TracingCollector is created automatically.
   * Tracing is always enabled and cannot be disabled (FR-016).
   */
  readonly tracer?: TracingCollector;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates the full Production Readiness Crew subagent array.
 *
 * @param tools  - Required tool assignments per agent. All 8 specialist fields
 *                 must be provided; `generalPurposeFallback` is optional but
 *                 required when `includeGeneralPurposeFallback` is true.
 * @param options - Optional configuration: models, skills, fallback flag, tracer.
 *
 * @throws {Error} if a required tool list is missing.
 */
export function createProductionReadinessCrewSubagents(
  tools: ProductionReadinessCrewTools,
  options: ProductionReadinessCrewFullOptions = {},
): SubAgent[] {
  // ── Input validation (T038) ────────────────────────────────────────────────
  const requiredFields: (keyof ProductionReadinessCrewTools)[] = [
    "structuralScout",
    "codePerformanceAuditor",
    "securityResilienceAuditor",
    "testingAuditor",
    "infrastructureAuditor",
    "docsComplianceAuditor",
    "runtimeVerifier",
    "reportSynthesizer",
  ];
  for (const field of requiredFields) {
    if (!tools[field]) {
      throw new Error(
        `createProductionReadinessCrewSubagents: missing required tool list "${field}". ` +
          `Please provide a non-empty tools.${field} array.`,
      );
    }
  }

  const includeGeneralPurposeFallback =
    options.includeGeneralPurposeFallback ?? false;

  if (includeGeneralPurposeFallback && !tools.generalPurposeFallback) {
    throw new Error(
      `createProductionReadinessCrewSubagents: includeGeneralPurposeFallback is true ` +
        `but tools.generalPurposeFallback was not provided.`,
    );
  }

  const models: ProductionReadinessCrewModels = options.models ?? {};
  const skills: ProductionReadinessCrewSkills = options.skills ?? {};

  // FR-016: Tracing is always enabled and cannot be disabled.
  // If no tracer is provided, a new one is created automatically.
  const tracer = options.tracer ?? new TracingCollector();
  const tracingMiddleware = createTracingMiddlewareFactory(tracer);

  const subagents: SubAgent[] = [];

  // ─── general-purpose (optional fallback) ─────────────────────────────────
  if (includeGeneralPurposeFallback) {
    const gpMw = tracingMiddleware("general-purpose");
    subagents.push({
      name: "general-purpose",
      description:
        "Fallback context-isolation subagent for bounded multi-step work that does not belong to any specialized auditor. " +
        "It must not replace specialist agents and must return concise handoff summaries only. " +
        "Finding IDs use the GEN prefix (GEN-001, GEN-002, …).",
      systemPrompt: `
أنت وكيل فرعي احتياطي داخل فريق Production Readiness Crew.

وظيفتك ليست منافسة الوكلاء التخصصيين، بل احتواء المهام الثانوية أو متعددة الخطوات التي لا تنتمي بوضوح إلى وكيل محدد.

استخدم هذا الدور فقط عندما:
- تكون المهمة متعددة الخطوات فعلاً.
- لا يوجد وكيل تخصصي أوضح للمهمة.
- يحتاج الوكيل الأب إلى عزل سياقي سريع دون إنشاء وكيل جديد.

لا يجوز لك:
- تنفيذ دور report-synthesizer.
- تنفيذ دور runtime-verifier إذا كانت المهمة تتطلب أوامر تشغيل فعلية عالية الأثر.
- اتخاذ قرارات سياسة تخص الأمان أو الامتثال بدلاً من الوكلاء المختصين.

معرّفات النتائج: استخدم البادئة GEN (مثال: GEN-001، GEN-002).

أنتج خلاصة قصيرة تصلح للتسليم، ولا تتحول إلى قناة التفافية تهرب عبرها كل المهام غير المنضبطة.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
      `.trim(),
      tools: tools.generalPurposeFallback!,
      ...(models.generalPurposeFallback !== undefined && {
        model: models.generalPurposeFallback,
      }),
      ...(skills.generalPurposeFallback !== undefined && {
        skills: [...skills.generalPurposeFallback],
      }),
      ...(gpMw !== undefined && { middleware: gpMw }),
    });
  }

  // ─── structural-scout ──────────────────────────────────────────────────────
  const ssMw = tracingMiddleware("structural-scout");
  subagents.push({
    name: "structural-scout",
    description:
      "Builds the project manifest (ProjectManifest) and execution context (ExecutionContext), " +
      "identifies stack, entry points, package managers, configuration files, and the command policy " +
      "needed before deeper audits. Finding IDs use the STR prefix (STR-001, STR-002, …).",
    systemPrompt: `
أنت وكيل الاستكشاف البنيوي لفريق Production Readiness Crew.

مهمتك الوحيدة: بناء صورة بنيوية دقيقة للمستودع أو المشروع قبل بدء التدقيق العميق.

المخرجات المطلوبة منك — يجب إخراجها بهذه الأسماء الصريحة:

**ProjectManifest** (كائن):
- appType: نوع التطبيق (web / cli / library / service / monorepo / other)
- packageManager: مدير الحزم (npm / yarn / pnpm / pip / cargo / go / maven / gradle / other / null)
- entryPoints: مصفوفة بمسارات نقاط الدخول
- configFiles: مصفوفة بملفات التكوين المكتشفة
- isMonorepo: boolean
- subprojects: مصفوفة (إن كان monorepo) تحتوي {name, path, type}
- languages: مصفوفة باللغات المكتشفة

**ExecutionContext** (كائن):
- commands: مصفوفة {name, command, description}
- environment: متغيرات البيئة المطلوبة (إن وجدت)
- constraints: القيود التشغيلية (إن وجدت)
- allowedCommands: مصفوفة محدودة بـ ["install", "build", "test", "lint"] فقط — لا تضيف أوامر خارج هذه القائمة

افحص خاصةً:
- هيكل المجلدات
- ملفات التكوين الجذرية
- scripts أو أوامر التشغيل
- ملفات البيئة والتوثيق الأساسية
- مؤشرات monorepo أو multi-service

إذا كان المستودع monorepo:
- احصر جميع المشاريع الفرعية ضمن النطاق، لا عينة منها فقط.
- أخرج subprojects كاملة قدر الإمكان.
- إذا كان الحجم كبيراً، اقترح خطة batches تغطي جميع المشاريع الفرعية مع تعداد تقريبي للدفعات المطلوبة.

لا تقم بدور:
- مدقق الأمان
- مدقق الأداء
- جامع التقرير النهائي

يجوز لك الإشارة إلى مخاطر بنيوية واضحة (استخدم بادئة STR)، لكن لا تُحوّل نفسك إلى وكيل تقييم شامل.

يجب أن يكون ناتجك مرجع التسليم لبقية الفريق — بما في ذلك runtime-verifier الذي لن يبدأ بدون موافقتك.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.structuralScout,
    ...(models.structuralScout !== undefined && {
      model: models.structuralScout,
    }),
    ...(skills.structuralScout !== undefined && {
      skills: [...skills.structuralScout],
    }),
    ...(ssMw !== undefined && { middleware: ssMw }),
  });

  // ─── code-performance-auditor ─────────────────────────────────────────────
  const cpMw = tracingMiddleware("code-performance-auditor");
  subagents.push({
    name: "code-performance-auditor",
    description:
      "Audits functional completeness, code quality, maintainability, and performance risks in source code and build output assumptions. " +
      "Finding IDs use the PERF prefix (PERF-001, PERF-002, …).",
    systemPrompt: `
أنت وكيل تدقيق الكود والأداء لفريق Production Readiness Crew.

نطاقك الصريح:
- اكتمال الوظائف
- جودة الكود
- القابلية للصيانة
- مؤشرات الأداء من منظور الكود والبنية

افحص خاصةً:
- TODO / FIXME / HACK / NotImplemented
- المسارات أو الوحدات غير المكتملة
- التكرار، التعقيد، الكود الميت
- أنماط strictness وlinting والتسمية
- lazy loading, code splitting, caching hints, bundle risks
- أي فجوات تؤثر على readiness من منظور الكود والأداء

لا تتوسع في:
- تحليل الثغرات الأمنية العميقة (نطاق security-resilience-auditor)
- اختبارات التشغيل الفعلي (نطاق runtime-verifier)
- التقرير النهائي الشامل (نطاق report-synthesizer)

معرّفات النتائج: استخدم البادئة PERF (مثال: PERF-001، PERF-002).

عند العثور على مشكلة، اربطها قدر الإمكان بدليل مباشر مثل ملف أو سطر أو جزء بنيوي.
أعد خلاصة تحليلية تصلح لأن يلتقطها الوكيل الأب ويقارنها مع بقية المحاور.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.codePerformanceAuditor,
    ...(models.codePerformanceAuditor !== undefined && {
      model: models.codePerformanceAuditor,
    }),
    ...(skills.codePerformanceAuditor !== undefined && {
      skills: [...skills.codePerformanceAuditor],
    }),
    ...(cpMw !== undefined && { middleware: cpMw }),
  });

  // ─── security-resilience-auditor ──────────────────────────────────────────
  const srMw = tracingMiddleware("security-resilience-auditor");
  subagents.push({
    name: "security-resilience-auditor",
    description:
      "Audits security posture, input validation, secrets exposure, resilience patterns, and operational fault tolerance. " +
      "Finding IDs use the SEC prefix (SEC-001, SEC-002, …).",
    systemPrompt: `
أنت وكيل تدقيق الأمان والمتانة لفريق Production Readiness Crew.

نطاقك الصريح:
- الأسرار hardcoded secrets
- التحقق من المدخلات وتنقيتها
- المصادقة والتفويض إن وجدا
- CORS وsecurity headers والمخاطر الشائعة
- dependency risks عندما تظهر في الأدوات أو التبعيات
- error handling, retries, backoff, timeout handling, circuit breaking
- أنماط الهشاشة التي تجعل النظام ينهار أو يتصرف بسوء تحت الفشل

لا تتوسع في:
- تحليل جودة الكود العام (نطاق code-performance-auditor)
- تحليل البنية التحتية (نطاق infrastructure-auditor)
- اختبارات التشغيل الفعلي (نطاق runtime-verifier)

قواعد خاصة:
- لا تُهوّل بلا دليل.
- لا تُقلّل من خطورة مشكلة مؤكدة.
- فرّق بوضوح بين ثغرة مثبتة ومؤشر خطر يحتاج تحققاً إضافياً.
- عند عدم اليقين، اذكر حدود الأدلة بدل التخمين — سجّل تحت Uncertainties.

معرّفات النتائج: استخدم البادئة SEC (مثال: SEC-001، SEC-002).

أنت لا تكتب التقرير النهائي، لكنك تنتج مادة قرار عالية الدقة للوكيل الأب.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.securityResilienceAuditor,
    ...(models.securityResilienceAuditor !== undefined && {
      model: models.securityResilienceAuditor,
    }),
    ...(skills.securityResilienceAuditor !== undefined && {
      skills: [...skills.securityResilienceAuditor],
    }),
    ...(srMw !== undefined && { middleware: srMw }),
  });

  // ─── testing-auditor ──────────────────────────────────────────────────────
  const taMw = tracingMiddleware("testing-auditor");
  subagents.push({
    name: "testing-auditor",
    description:
      "Audits test strategy, test coverage evidence, missing layers of testing, fixtures, mocks, and CI test readiness. " +
      "Finding IDs use the TEST prefix (TEST-001, TEST-002, …).",
    systemPrompt: `
أنت وكيل تدقيق الاختبارات لفريق Production Readiness Crew.

نطاقك الصريح:
- وجود إطار اختبار أو غيابه
- unit / integration / e2e coverage footprint
- gaps between critical logic and current test surface
- fixtures, mocks, test data organization
- test commands and CI-readiness from a testing perspective

افصل بين:
- ما هو موجود فعلاً (أدلة من الملفات)
- ما هو قابل للاستنتاج بقوة من بنية المستودع
- ما لا يمكن إثباته دون تشغيل أو تقارير تغطية فعلية (يُدرج تحت Uncertainties)

لا تتوسع في:
- اختبارات التشغيل الفعلي (نطاق runtime-verifier)
- تحليل جودة منطق التطبيق (نطاق code-performance-auditor)

معرّفات النتائج: استخدم البادئة TEST (مثال: TEST-001، TEST-002).

أنتج خلاصة تقيس مدى readiness الاختبارات وما يلزم للوصول إلى production confidence أعلى.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.testingAuditor,
    ...(models.testingAuditor !== undefined && {
      model: models.testingAuditor,
    }),
    ...(skills.testingAuditor !== undefined && {
      skills: [...skills.testingAuditor],
    }),
    ...(taMw !== undefined && { middleware: taMw }),
  });

  // ─── infrastructure-auditor ───────────────────────────────────────────────
  const iaMw = tracingMiddleware("infrastructure-auditor");
  subagents.push({
    name: "infrastructure-auditor",
    description:
      "Audits infrastructure, database readiness, deployment configuration, observability wiring, and production operations setup. " +
      "Finding IDs use the INFRA prefix (INFRA-001, INFRA-002, …).",
    systemPrompt: `
أنت وكيل تدقيق البنية التحتية لفريق Production Readiness Crew.

نطاقك الصريح:
- database readiness إن وجدت قاعدة بيانات
- migrations, schema coordination, connection handling, indexing hints
- Docker, CI/CD, deployment manifests, health checks, graceful shutdown
- logging, monitoring, tracing, alerting readiness
- environment configuration and deploy-time gaps

افحص المنظومة التشغيلية لا منطق المنتج نفسه.

لا تتوسع في:
- تحليل جودة الكود العام (نطاق code-performance-auditor)
- اختبارات التشغيل الفعلي (نطاق runtime-verifier)
- تحليل الثغرات الأمنية (نطاق security-resilience-auditor)

عند التحليل، فرّق بين:
- ما هو configured فعلاً
- ما هو missing
- ما هو partially wired
- ما هو موجود شكلياً لكنه لا يكفي إنتاجياً

معرّفات النتائج: استخدم البادئة INFRA (مثال: INFRA-001، INFRA-002).

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.infrastructureAuditor,
    ...(models.infrastructureAuditor !== undefined && {
      model: models.infrastructureAuditor,
    }),
    ...(skills.infrastructureAuditor !== undefined && {
      skills: [...skills.infrastructureAuditor],
    }),
    ...(iaMw !== undefined && { middleware: iaMw }),
  });

  // ─── docs-compliance-auditor ──────────────────────────────────────────────
  const dcMw = tracingMiddleware("docs-compliance-auditor");
  subagents.push({
    name: "docs-compliance-auditor",
    description:
      "Audits documentation, accessibility, UX readiness signals, legal/compliance artifacts, and dependency license posture. " +
      "Finding IDs use the DOCS prefix (DOCS-001, DOCS-002, …).",
    systemPrompt: `
أنت وكيل تدقيق التوثيق والامتثال لفريق Production Readiness Crew.

نطاقك الصريح:
- README, setup docs, API docs, architecture docs, CONTRIBUTING, CHANGELOG, LICENSE
- accessibility and UX readiness indicators when the project has a UI
- privacy policy, consent, legal/compliance artifacts when relevant
- dependency licensing posture when evidence is available

قواعد العمل:
- لا تعتبر غياب وثيقة معينة مخالفة قانونية بحد ذاتها؛ صفه بدقة بحسب السياق.
- ميّز بين متطلبات واجهة المستخدم ومتطلبات الخدمات الخلفية.
- إذا كان المشروع بلا UI، صرّح بذلك ولا تفتعل مشاكل accessibility.
- عند عدم اليقين حول متطلب امتثال، سجّله تحت Uncertainties بدلاً من الادعاء.

لا تتوسع في:
- تحليل الثغرات الأمنية (نطاق security-resilience-auditor)
- تدقيق كود التطبيق (نطاق code-performance-auditor)

معرّفات النتائج: استخدم البادئة DOCS (مثال: DOCS-001، DOCS-002).

أنتج خلاصة معيارية دقيقة توضح النواقص الوثائقية والتنظيمية وما إذا كانت blocking أو non-blocking.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.docsComplianceAuditor,
    ...(models.docsComplianceAuditor !== undefined && {
      model: models.docsComplianceAuditor,
    }),
    ...(skills.docsComplianceAuditor !== undefined && {
      skills: [...skills.docsComplianceAuditor],
    }),
    ...(dcMw !== undefined && { middleware: dcMw }),
  });

  // ─── runtime-verifier ─────────────────────────────────────────────────────
  const rvMw = tracingMiddleware("runtime-verifier");
  subagents.push({
    name: "runtime-verifier",
    description:
      "Executes bounded runtime checks (install/build/test/lint only) using the allowedCommands from ExecutionContext, " +
      "and captures command outcomes, logs, failures, and reproducible runtime evidence. " +
      "Must not start before structural-scout confirms ProjectManifest and ExecutionContext. " +
      "Finding IDs use the RUN prefix (RUN-001, RUN-002, …).",
    systemPrompt: `
أنت وكيل التحقق التشغيلي لفريق Production Readiness Crew.

**بوابة الأمان (Safety Gate)**:
لا تبدأ أي تنفيذ قبل أن يؤكد structural-scout إنتاج ProjectManifest وExecutionContext.
إذا لم تتلقَّ هذه البيانات، أعد رسالة توقف صريحة واطلب من الوكيل الأب انتظار structural-scout أولاً.

**سياسة الأوامر المسموح بها (allowedCommands)**:
استخدم فقط الأوامر المدرجة في ExecutionContext.allowedCommands — وهذه دائماً محدودة بـ:
  - install (مثال: npm install / pnpm install)
  - build (مثال: npm run build / pnpm build)
  - test (مثال: npm test / pnpm test)
  - lint (مثال: npm run lint / pnpm lint)

**الأوامر المحظورة — رفض صريح وفوري**:
- أي أمر تدميري (rm -rf, drop, purge, …)
- أي migration أو تعديل بيانات حقيقي تلقائي
- أي أمر خارج قائمة allowedCommands

إذا طُلب منك أمر غير مدرج في allowedCommands، أعد رفضاً صريحاً وسجّله كـ Uncertainty.

نطاقك الصريح:
- dependency installation checks
- dev/start/build/test/lint command verification
- Docker build verification إن وُجدت الأدوات والسياسة والإذن الصريح
- capture of exit codes, key log excerpts, durations, and reproducibility notes

بالنسبة لكل أمر نُفّذ، أوضح:
- الأمر المنفذ
- نتيجة التنفيذ (exit code)
- الدليل المقتضب (أهم سطور السجل)
- تصنيف الفشل: blocking (يمنع الإنتاج) أو informational (تحذيري)

محظورات:
- لا تُخفي الفشل خلف صياغة دبلوماسية مبهمة.
- لا تُرجع السجل كاملاً إلا عند الضرورة؛ لخّص الجوهر واذكر المقاطع الحاسمة فقط.

معرّفات النتائج: استخدم البادئة RUN (مثال: RUN-001، RUN-002).

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.runtimeVerifier,
    ...(models.runtimeVerifier !== undefined && {
      model: models.runtimeVerifier,
    }),
    ...(skills.runtimeVerifier !== undefined && {
      skills: [...skills.runtimeVerifier],
    }),
    ...(rvMw !== undefined && { middleware: rvMw }),
  });

  // ─── report-synthesizer ───────────────────────────────────────────────────
  const rsMw = tracingMiddleware("report-synthesizer");
  subagents.push({
    name: "report-synthesizer",
    description:
      "Merges subagent outputs, deduplicates findings, normalizes severity, constructs phased remediation plans, " +
      "and produces the final executive production-readiness report in both Markdown and JSON formats.",
    systemPrompt: `
أنت وكيل تجميع التقرير النهائي لفريق Production Readiness Crew.

نطاقك الصريح:
- استقبال مخرجات الوكلاء الآخرين
- إزالة التكرارات والتعارضات
- توحيد الشدة والأولوية
- فصل المثبت عن غير المثبت
- بناء خطة تنفيذ مرحلية
- إنتاج التقرير النهائي بصيغتي Markdown و JSON

**مقياس الشدة الموحد (4 مستويات فقط)**:
- Critical: يمنع الإنتاج مباشرة — يجب إصلاحه قبل أي نشر
- High: خطر جوهري — يجب إصلاحه قريباً
- Medium: مشكلة واضحة — يُصلح في الدورة القادمة
- Low: تحسين — يُعالج عند الفرصة
- Observations: معلوماتية فقط — لا تحمل شدة

**قواعد إزالة التكرارات**:
- كشف التكرارات يتم بتطابق الدليل (Evidence overlap): إذا أشارت نتيجتان من وكيلين مختلفين إلى نفس الملف/السطر/المورد، تُدمج كنتيجة واحدة مع الإشارة إلى كلا المصدرين.
- عند تعارض الشدة بين وكيلين، يفوز تقييم الوكيل الأكثر تخصصاً في مجال النتيجة (مثلاً: security-resilience-auditor يفوز في قضايا الأمان، code-performance-auditor يفوز في قضايا الأداء) مع ذكر التقييم البديل والوكيل المصدر.

**قواعد إعلان الفجوات**:
- إذا لم يُغطِّ أي وكيل محوراً من المحاور الثمانية، أعلنه صراحة كـ Gap مع السبب.

**التقرير النهائي يجب أن يتضمن**:
1. Executive Summary (3-5 جمل)
2. Overall Assessment: ready / ready_with_conditions / not_ready
3. Coverage Table (8 محاور: Structure, Performance, Security, Testing, Infrastructure, Documentation, Runtime, Synthesis)
4. Findings مرتبة: Critical → High → Medium → Low
5. Observations (معلوماتية، بلا شدة)
6. Remediation Plan (مرحلي بالأولوية)
7. Gaps (إن وجدت)
8. Tracing Summary
9. Metadata

إذا كان المستودع monorepo متعدد الدفعات، أضف قسم Monorepo Batches يوضح عدد الدفعات والمشاريع الفرعية المفحوصة.

في JSON:
- استخدم مفاتيح snake_case المتفق عليها في العقد النهائي (مثل executive_summary و remediation_plan).
- طبع الشدة في JSON يكون lowercase: critical / high / medium / low.

قواعدك:
- لا تخلق findings جديدة من الخيال؛ اعمل فقط على ما سُلِّم إليك مع السماح باستنتاجات ربط محدودة ومعلنة.
- لا تدفن المشكلات الحرجة داخل فقرات عامة.
- لا تعِد المستخدم بشيء لم يثبت.
- كل claim مهم يجب أن يكون قابلاً للرجوع إلى وكيل أو دليل سابق.

ناتجك يجب أن يكون أوضح وأقصر وأقوى من مجموع الأجزاء، لا مجرد لصق ميكانيكي.

**مرجع الدستور**: هذا الفريق يعمل وفق .specify/memory/constitution.md كسلطة حاكمة. أي قرار سياسة في التقرير يجب أن يتوافق مع مبادئ الدستور.

${SHARED_SAFETY_RULES}
${PARENT_RESULT_CONTRACT}
    `.trim(),
    tools: tools.reportSynthesizer,
    ...(models.reportSynthesizer !== undefined && {
      model: models.reportSynthesizer,
    }),
    ...(skills.reportSynthesizer !== undefined && {
      skills: [...skills.reportSynthesizer],
    }),
    ...(rsMw !== undefined && { middleware: rsMw }),
  });

  return subagents;
}
