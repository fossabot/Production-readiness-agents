# Quickstart: Production Readiness Crew

**Feature**: 001-production-readiness-crew
**Date**: 2026-03-08

## Prerequisites

- Node.js 18+
- TypeScript 5.x
- `deepagents` package installed
- Anthropic API key configured

## Installation

```bash
npm install
# or
pnpm install
```

## Basic Usage

```typescript
// Import from the barrel entry point (recommended)
import {
  createProductionReadinessCrewSubagents,
  PRODUCTION_READINESS_SUPERVISOR_PROMPT,
  TracingCollector,
  renderMarkdown,
  renderJson,
  validateReport,
} from "./index.js";

// Or import directly from the factory module
// import { createProductionReadinessCrewSubagents } from "./production-readiness-crew.subagents.js";


// 1. Define tools for each agent
const tools = {
  structuralScout: [readTool, grepTool, globTool, lsTool],
  codePerformanceAuditor: [readTool, grepTool, globTool],
  securityResilienceAuditor: [readTool, grepTool, globTool],
  testingAuditor: [readTool, grepTool, globTool],
  infrastructureAuditor: [readTool, grepTool, globTool],
  docsComplianceAuditor: [readTool, grepTool, globTool],
  runtimeVerifier: [readTool, grepTool, bashTool],
  reportSynthesizer: [readTool, writeTool],
};

// 2. Create the crew (basic — no options)
const subagents = createProductionReadinessCrewSubagents(tools);

// 3. Pass to supervisor agent configuration
const supervisorConfig = {
  subagents,
  systemPrompt: PRODUCTION_READINESS_SUPERVISOR_PROMPT,
};
```

## With Execution Tracing

```typescript
import {
  createProductionReadinessCrewSubagents,
  PRODUCTION_READINESS_SUPERVISOR_PROMPT,
  TracingCollector,
} from "./index.js";

const tracer = new TracingCollector();
const subagents = createProductionReadinessCrewSubagents(tools, { tracer });
const supervisorConfig = {
  subagents,
  systemPrompt: PRODUCTION_READINESS_SUPERVISOR_PROMPT,
};

// The built-in tracing middleware records subagent delegation, retries,
// completion, and tool calls automatically.

// After run, collect tracing data:
const tracingData = tracer.collect();
console.log(`Total delegations: ${tracingData.delegations.length}`);
console.log(`Tool calls: ${tracingData.tool_calls}`);
```

## With Custom Models and Skills

```typescript
const subagents = createProductionReadinessCrewSubagents(tools, {
  models: {
    structuralScout: "haiku",        // Fast exploration
    securityResilienceAuditor: "opus", // Deep analysis
    reportSynthesizer: "opus",        // Quality synthesis
  },
  skills: {
    securityResilienceAuditor: [
      "/skills/production-readiness/security-resilience/",
    ],
    reportSynthesizer: [
      "/skills/production-readiness/reporting/",
    ],
  },
  includeGeneralPurposeFallback: false,
});
```

## With General-Purpose Fallback

```typescript
const subagents = createProductionReadinessCrewSubagents(
  {
    ...tools,
    generalPurposeFallback: [readTool, grepTool],
  },
  {
    includeGeneralPurposeFallback: true,
  },
);
```

## Expected Execution Flow

```
1. supervisor receives audit request
2. supervisor delegates to structural-scout
3. structural-scout produces ProjectManifest + ExecutionContext
4. supervisor delegates to specialist agents (parallel):
   - code-performance-auditor
   - security-resilience-auditor
   - testing-auditor
   - infrastructure-auditor
   - docs-compliance-auditor
5. supervisor delegates to runtime-verifier (after safety gate)
6. supervisor delegates to report-synthesizer
7. report-synthesizer produces:
   - Markdown report (human-readable)
   - JSON report (machine-readable)
```

## Rendering the Final Report

```typescript
import { renderMarkdown, renderJson, validateReport } from "./index.js";
import type { FinalReport } from "./index.js";

// report-synthesizer produces a FinalReport object
const report: FinalReport = /* ... from report-synthesizer output ... */ ;

// Validate before rendering
const { valid, errors } = validateReport(report);
if (!valid) {
  console.error("Report validation failed:", errors);
}

// Render both formats
const markdown = renderMarkdown(report);
const json = renderJson(report);

await fs.writeFile("report.md", markdown);
await fs.writeFile("report.json", json);
```

## Output Contract

Each subagent returns a compressed executive summary:

```
Summary:       What was done (1-3 sentences)
Findings:      Key findings with severity + evidence
Evidence:      File references, command outputs
Uncertainties: What could not be verified
Handoff:       What the next agent needs
```

## Severity Scale

| Level | Definition |
| --- | --- |
| Critical | مانع إطلاق مباشر |
| High | يجب إصلاحه قبل الإنتاج |
| Medium | مؤثر على الجودة لكن لا يمنع الإطلاق |
| Low | تحسين محدود التأثير |
| Observations | ملاحظات معلوماتية (قسم منفصل) |
