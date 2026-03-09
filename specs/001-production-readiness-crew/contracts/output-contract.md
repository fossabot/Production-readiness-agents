# Output Contract: Production Readiness Crew

**Feature**: 001-production-readiness-crew
**Date**: 2026-03-08

## 1. Subagent Output Contract (Inter-Agent)

كل وكيل فرعي يجب أن يُرجع خلاصة تنفيذية مضغوطة بالصيغة التالية.
هذا العقد مُلزم لجميع الوكلاء التسعة (8 تخصصيين + 1 احتياطي).

### Required Fields

```
Summary:     ملخص قصير للمهمة المنجزة (1-3 جمل)
Findings:    قائمة النتائج الجوهرية، كل نتيجة تتضمن:
             - معرف فريد (PREFIX-NNN)
             - عنوان
             - شدة (Critical/High/Medium/Low)
             - وصف
             - دليل (ملف:سطر أو أمر:نتيجة)
             - توصية
Evidence:    الأدلة المرجعية الأساسية (ملفات، أسطر، أوامر)
Uncertainties: حالات عدم اليقين — ما لم يمكن التحقق منه ولماذا
Handoff:     ما الذي يحتاجه الوكيل التالي أو report-synthesizer
```

### Rules

- لا مخرجات خام من الأدوات
- لا stack traces كاملة
- لا تخمين عند نقص الأدلة — يُسجّل تحت Uncertainties
- الحجم: مضغوط بما يكفي لعدم إغراق نافذة سياق الوكيل الرئيسي

### Finding ID Prefixes

| Prefix | Agent |
| --- | --- |
| STR | structural-scout |
| PERF | code-performance-auditor |
| SEC | security-resilience-auditor |
| TEST | testing-auditor |
| INFRA | infrastructure-auditor |
| DOCS | docs-compliance-auditor |
| RUN | runtime-verifier |
| GEN | general-purpose |

## 2. Final Report Contract (User-Facing)

التقرير النهائي يُسلّم بصيغتين متزامنتين. كلاهما يحتوي نفس البيانات.

### 2a. Markdown Report Structure

```markdown
# Production Readiness Report: [Project Name]

## Executive Summary
[ملخص تنفيذي: 3-5 جمل]

## Overall Assessment
[تقييم إجمالي: Ready / Ready with Conditions / Not Ready]

## Coverage
| Axis | Agent | Status |
| --- | --- | --- |
| Structure | structural-scout | Completed / Partial / Failed |
| Performance | code-performance-auditor | ... |
| Security | security-resilience-auditor | ... |
| Testing | testing-auditor | ... |
| Infrastructure | infrastructure-auditor | ... |
| Documentation | docs-compliance-auditor | ... |
| Runtime | runtime-verifier | ... |
| Synthesis | report-synthesizer | ... |

## Findings
### Critical
[نتائج مرتبة بالشدة → الأثر → الجهد]

### High
...

### Medium
...

### Low
...

## Observations
[ملاحظات معلوماتية — لا تتطلب إجراء]

## Remediation Plan
[خطة معالجة مرحلية مرتبة بالأولوية]

## Gaps
[محاور لم تُفحص مع السبب]

## Tracing
[ملخص التتبع: وكلاء مُفوّضون، أدوات مستدعاة، أزمنة]

## Metadata
- Date: [ISO 8601]
- Duration: [seconds]
- Agents used: [list]
- Batches (if monorepo): [count]
```

### 2b. JSON Report Schema

```json
{
  "version": "1.0.0",
  "project": "string",
  "timestamp": "ISO 8601",
  "duration_seconds": "number",
  "overall_assessment": "ready | ready_with_conditions | not_ready",
  "executive_summary": "string",
  "coverage": [
    {
      "axis": "string",
      "agent": "string",
      "status": "completed | partial | failed | skipped",
      "reason": "string | null"
    }
  ],
  "findings": [
    {
      "id": "string (PREFIX-NNN)",
      "title": "string",
      "severity": "critical | high | medium | low",
      "category": "string",
      "description": "string",
      "evidence": [
        {
          "type": "file | command | reference",
          "location": "string",
          "snippet": "string | null"
        }
      ],
      "recommendation": "string",
      "effort": "low | medium | high | null",
      "source_agent": "string"
    }
  ],
  "observations": [
    {
      "title": "string",
      "description": "string",
      "source_agent": "string"
    }
  ],
  "remediation_plan": [
    {
      "priority": "number",
      "finding_ids": ["string"],
      "action": "string",
      "effort": "low | medium | high"
    }
  ],
  "gaps": [
    {
      "axis": "string",
      "agent": "string",
      "reason": "string"
    }
  ],
  "tracing": {
    "delegations": [
      {
        "from": "string",
        "to": "string",
        "timestamp": "ISO 8601",
        "duration_ms": "number",
        "status": "completed | failed | retried"
      }
    ],
    "tool_calls": "number",
    "retries": "number",
    "total_duration_ms": "number"
  },
  "metadata": {
    "crew_version": "string",
    "agents_used": ["string"],
    "batches": "number | null",
    "subprojects_scanned": "number | null"
  }
}
```

## 3. Validation Rules

- التقرير النهائي يجب أن يحتوي على coverage entry لكل محور من الثمانية
- كل finding يجب أن يحتوي على evidence واحد على الأقل
- لا توجد findings بدون severity
- لا توجد findings مكررة (نفس id)
- Observations لا تحمل severity
- Markdown و JSON يجب أن يحتويا على نفس عدد findings بنفس الترتيب
- tracing يجب أن يحتوي على delegation واحد على الأقل لكل وكيل مُستدعى
