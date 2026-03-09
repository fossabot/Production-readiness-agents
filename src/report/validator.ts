import type { FinalReport } from "../contracts/report-schema.js";

// ─── Validation Result ───────────────────────────────────────────────────────

export interface ValidationError {
  readonly rule: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}

export function extractMarkdownFindingIds(markdown: string): readonly string[] {
  return [...markdown.matchAll(/^#### \[([A-Z]+-\d+)\]/gm)].map(
    (match) => match[1],
  );
}

// ─── Required coverage axes ──────────────────────────────────────────────────

const REQUIRED_AXES = [
  "Structure",
  "Performance",
  "Security",
  "Testing",
  "Infrastructure",
  "Documentation",
  "Runtime",
  "Synthesis",
] as const;

// ─── Validator ───────────────────────────────────────────────────────────────

export function validateReport(report: FinalReport): ValidationResult {
  const errors: ValidationError[] = [];

  // Rule 1: coverage entry for each of the 8 required axes
  const coveredAxes = new Set(report.coverageReport.map((c) => c.axis));
  for (const axis of REQUIRED_AXES) {
    if (!coveredAxes.has(axis)) {
      errors.push({
        rule: "coverage-completeness",
        message: `Missing coverage entry for axis: ${axis}`,
      });
    }
  }

  // Rule 2: every finding must have at least one evidence item
  for (const finding of report.findings) {
    if (finding.evidence.length === 0) {
      errors.push({
        rule: "finding-evidence-required",
        message: `Finding ${finding.id} has no evidence items`,
      });
    }
  }

  // Rule 3: no findings without severity
  for (const finding of report.findings) {
    if (!finding.severity) {
      errors.push({
        rule: "finding-severity-required",
        message: `Finding ${finding.id} is missing a severity value`,
      });
    }
  }

  // Rule 4: no duplicate finding IDs
  const ids = report.findings.map((f) => f.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    errors.push({
      rule: "no-duplicate-finding-ids",
      message: `Duplicate finding IDs: ${[...new Set(duplicates)].join(", ")}`,
    });
  }

  // Rule 5: observations must not have severity (structural — enforced by type system,
  // but we confirm source_agent is set)
  for (const obs of report.observations) {
    if (!obs.source_agent) {
      errors.push({
        rule: "observation-source-required",
        message: `Observation "${obs.title}" is missing source_agent`,
      });
    }
  }

  // Rule 6: tracing must contain at least one delegation per used agent
  const agentsUsed = new Set(report.metadata.agents_used);
  const delegatedAgents = new Set(
    report.tracing.delegations.map((d) => d.to),
  );
  for (const agent of agentsUsed) {
    if (agent === "supervisor") continue; // supervisor is orchestrator, not delegated to
    if (!delegatedAgents.has(agent)) {
      errors.push({
        rule: "tracing-delegation-required",
        message: `Agent "${agent}" listed in agents_used but has no tracing delegation record`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates that Markdown and JSON representations contain the same number of
 * findings in the same order (by ID).
 */
export function validateParity(
  markdown: string | readonly string[],
  jsonReport: FinalReport,
): ValidationResult {
  const errors: ValidationError[] = [];
  const markdownIds =
    typeof markdown === "string"
      ? extractMarkdownFindingIds(markdown)
      : markdown;
  const jsonIds = jsonReport.findings.map((f) => f.id);

  if (markdownIds.length !== jsonIds.length) {
    errors.push({
      rule: "md-json-parity-count",
      message: `Markdown has ${markdownIds.length} findings, JSON has ${jsonIds.length}`,
    });
    return { valid: false, errors };
  }

  for (let i = 0; i < markdownIds.length; i++) {
    if (markdownIds[i] !== jsonIds[i]) {
      errors.push({
        rule: "md-json-parity-order",
        message: `Finding at position ${i} differs: Markdown="${markdownIds[i]}", JSON="${jsonIds[i]}"`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
