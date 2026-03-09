import type { Evidence, Finding, Severity, EffortLevel } from "../types.js";

// ─── SubagentOutput ───────────────────────────────────────────────────────────

export interface SubagentOutput {
  readonly summary: string;
  readonly findings: readonly Finding[];
  readonly evidence: readonly Evidence[];
  readonly uncertainties: readonly string[];
  readonly handoff: string;
}

// ─── Finding ID Prefixes ──────────────────────────────────────────────────────

export const FINDING_ID_PREFIXES = {
  "structural-scout": "STR",
  "code-performance-auditor": "PERF",
  "security-resilience-auditor": "SEC",
  "testing-auditor": "TEST",
  "infrastructure-auditor": "INFRA",
  "docs-compliance-auditor": "DOCS",
  "runtime-verifier": "RUN",
  "general-purpose": "GEN",
} as const satisfies Record<string, string>;

export type AgentName = keyof typeof FINDING_ID_PREFIXES;
export type FindingPrefix = (typeof FINDING_ID_PREFIXES)[AgentName];

// ─── PARENT_RESULT_CONTRACT ───────────────────────────────────────────────────

export const PARENT_RESULT_CONTRACT = `
أعد النتيجة إلى الوكيل الأب بصيغة موجزة ومنظمة فقط.

يجب أن تتضمن النتيجة الأقسام التالية بهذا الترتيب:
1) Summary
2) Findings (كل نتيجة بصيغة: [PREFIX-NNN] العنوان • الشدة • الوصف • الدليل • التوصية)
3) Evidence (أدلة مرجعية: ملف:سطر أو أمر:نتيجة)
4) Uncertainties (ما لم يمكن التحقق منه ولماذا — يجب ذكر هذا القسم دائماً حتى لو فارغ)
5) Handoff (ما يحتاجه الوكيل التالي أو report-synthesizer)

قواعد الإخراج:
- لا تُرجع مخرجات الأدوات الخام كاملة.
- لا تُرجع سجلات طويلة أو stack traces كاملة إلا إذا طُلب ذلك صراحة داخل المهمة.
- عند ذكر مشكلة، اربطها بملف أو أمر أو دليل محدد متى أمكن.
- إذا لم تستطع التحقق من نقطة ما، اذكر ذلك صراحة تحت Uncertainties — لا تختلق حقائق.
- ركّز على ما يحتاجه الوكيل الأب لاتخاذ القرار التالي.
- استخدم معرفات النتائج بادئة وكيلك (مثال: PERF-001، SEC-001) وفق جدول الأسبقيات.
`.trim();

// ─── SHARED_SAFETY_RULES ─────────────────────────────────────────────────────

export const SHARED_SAFETY_RULES = `
قواعد حاكمة:
- لا تختلق حقائق غير مدعومة بأدلة حقيقية من الأدوات.
- لا تتجاوز نطاق دورك إلى أدوار الوكلاء الآخرين إلا بقدر ضئيل يخص التسليم.
- استخدم أدواتك فقط؛ لا تتصرف كما لو أن لديك أدوات غير موجودة.
- إذا كانت الأداة تُرجع بيانات كثيرة، استخرج منها الجوهر فقط.
- قسم Uncertainties إلزامي دائماً — إذا لم يكن هناك عدم يقين، اكتب "لا يوجد".
`.trim();

// ─── Type-safe schema shapes for validation ───────────────────────────────────

export type SubagentOutputSchema = {
  readonly summary: string;
  readonly findings: readonly {
    readonly id: string;
    readonly title: string;
    readonly severity: Severity;
    readonly category: string;
    readonly description: string;
    readonly evidence: readonly {
      readonly type: "file" | "command" | "reference";
      readonly location: string;
      readonly snippet: string | null;
    }[];
    readonly recommendation: string;
    readonly effort?: EffortLevel;
    readonly source_agent: string;
  }[];
  readonly evidence: readonly {
    readonly type: "file" | "command" | "reference";
    readonly location: string;
    readonly snippet: string | null;
  }[];
  readonly uncertainties: readonly string[];
  readonly handoff: string;
};
