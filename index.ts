/**
 * Production Readiness Crew — Public API
 *
 * Main entry point. Re-exports the factory function, all types, all contracts,
 * tracing utilities, report renderers, and the report validator.
 */

// ─── Factory ─────────────────────────────────────────────────────────────────

export {
  createProductionReadinessCrewSubagents,
  PRODUCTION_READINESS_SUPERVISOR_PROMPT,
} from "./production-readiness-crew.subagents.js";

export type {
  ProductionReadinessCrewFullOptions,
} from "./production-readiness-crew.subagents.js";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type {
  ToolList,
  ModelRef,
  Severity,
  EffortLevel,
  Evidence,
  Finding,
  Observation,
  CoverageEntry,
  RemediationStep,
  GapDeclaration,
  ReportMetadata,
  SubprojectInfo,
  CommandSpec,
  ProjectManifest,
  ExecutionContext,
  ProductionReadinessCrewTools,
  ProductionReadinessCrewModels,
  ProductionReadinessCrewSkills,
  ProductionReadinessCrewOptions,
} from "./src/types.js";

// ─── Contracts ────────────────────────────────────────────────────────────────

export type {
  SubagentOutput,
  SubagentOutputSchema,
  AgentName,
  FindingPrefix,
} from "./src/contracts/output-contract.js";

export {
  PARENT_RESULT_CONTRACT,
  SHARED_SAFETY_RULES,
  FINDING_ID_PREFIXES,
} from "./src/contracts/output-contract.js";

// ─── Report Schema ────────────────────────────────────────────────────────────

export type {
  DelegationRecord,
  TracingData,
  FinalReport,
} from "./src/contracts/report-schema.js";

// ─── Tracing ─────────────────────────────────────────────────────────────────

export { TracingCollector } from "./src/tracing/tracer.js";
export type { CrewEvent } from "./src/tracing/tracer.js";

// ─── Report Renderers ─────────────────────────────────────────────────────────

export { renderMarkdown } from "./src/report/markdown-renderer.js";
export {
  renderJson,
  parseJsonReport,
  toJsonReport,
} from "./src/report/json-renderer.js";

export type {
  JsonSeverity,
  JsonFinding,
  JsonCoverageEntry,
  JsonObservation,
  JsonRemediationStep,
  JsonGapDeclaration,
  JsonFinalReport,
} from "./src/report/json-renderer.js";

// ─── Report Validator ─────────────────────────────────────────────────────────

export {
  validateReport,
  validateParity,
  extractMarkdownFindingIds,
} from "./src/report/validator.js";

export type {
  ValidationError,
  ValidationResult,
} from "./src/report/validator.js";
