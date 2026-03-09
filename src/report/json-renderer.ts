import type { FinalReport } from "../contracts/report-schema.js";
import type {
  CoverageEntry,
  EffortLevel,
  Evidence,
  Finding,
  GapDeclaration,
  Observation,
  RemediationStep,
  ReportMetadata,
} from "../types.js";

// ─── JSON Renderer ───────────────────────────────────────────────────────────

export type JsonSeverity = "critical" | "high" | "medium" | "low";

export interface JsonFinding {
  readonly id: string;
  readonly title: string;
  readonly severity: JsonSeverity;
  readonly category: string;
  readonly description: string;
  readonly evidence: readonly Evidence[];
  readonly recommendation: string;
  readonly effort: EffortLevel | null;
  readonly source_agent: string;
}

export interface JsonCoverageEntry {
  readonly axis: string;
  readonly agent: string;
  readonly status: CoverageEntry["status"];
  readonly reason: string | null;
}

export interface JsonObservation {
  readonly title: string;
  readonly description: string;
  readonly source_agent: string;
}

export interface JsonRemediationStep {
  readonly priority: number;
  readonly finding_ids: readonly string[];
  readonly action: string;
  readonly effort: EffortLevel;
}

export interface JsonGapDeclaration {
  readonly axis: string;
  readonly agent: string;
  readonly reason: string;
}

export interface JsonFinalReport {
  readonly version: string;
  readonly project: string;
  readonly timestamp: string;
  readonly duration_seconds: number;
  readonly overall_assessment: FinalReport["overall_assessment"];
  readonly executive_summary: string;
  readonly overall_score?: string;
  readonly coverage: readonly JsonCoverageEntry[];
  readonly findings: readonly JsonFinding[];
  readonly observations: readonly JsonObservation[];
  readonly remediation_plan: readonly JsonRemediationStep[];
  readonly gaps: readonly JsonGapDeclaration[];
  readonly tracing: FinalReport["tracing"];
  readonly metadata: ReportMetadata;
}

function toJsonSeverity(severity: Finding["severity"]): JsonSeverity {
  switch (severity) {
    case "Critical":
      return "critical";
    case "High":
      return "high";
    case "Medium":
      return "medium";
    case "Low":
      return "low";
  }
}

function fromJsonSeverity(
  severity: JsonSeverity | Finding["severity"],
): Finding["severity"] {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return severity;
  }
}

function toJsonFinding(finding: Finding): JsonFinding {
  return {
    id: finding.id,
    title: finding.title,
    severity: toJsonSeverity(finding.severity),
    category: finding.category,
    description: finding.description,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    effort: finding.effort ?? null,
    source_agent: finding.source_agent,
  };
}

function fromJsonFinding(finding: JsonFinding): Finding {
  return {
    id: finding.id,
    title: finding.title,
    severity: fromJsonSeverity(finding.severity),
    category: finding.category,
    description: finding.description,
    evidence: finding.evidence,
    recommendation: finding.recommendation,
    ...(finding.effort !== null && finding.effort !== undefined && {
      effort: finding.effort,
    }),
    source_agent: finding.source_agent,
  };
}

function normalizeCoverageEntries(
  coverage: readonly JsonCoverageEntry[] | readonly CoverageEntry[] | undefined,
): readonly CoverageEntry[] {
  return (coverage ?? []).map((entry) => ({
    axis: entry.axis,
    agent: entry.agent,
    status: entry.status,
    reason: entry.reason,
  }));
}

function normalizeObservations(
  observations: readonly JsonObservation[] | readonly Observation[] | undefined,
): readonly Observation[] {
  return (observations ?? []).map((observation) => ({
    title: observation.title,
    description: observation.description,
    source_agent: observation.source_agent,
  }));
}

function normalizeRemediationPlan(
  plan: readonly JsonRemediationStep[] | readonly RemediationStep[] | undefined,
): readonly RemediationStep[] {
  return (plan ?? []).map((step) => ({
    priority: step.priority,
    finding_ids: [...step.finding_ids],
    action: step.action,
    effort: step.effort,
  }));
}

function normalizeGaps(
  gaps: readonly JsonGapDeclaration[] | readonly GapDeclaration[] | undefined,
): readonly GapDeclaration[] {
  return (gaps ?? []).map((gap) => ({
    axis: gap.axis,
    agent: gap.agent,
    reason: gap.reason,
  }));
}

export function toJsonReport(report: FinalReport): JsonFinalReport {
  return {
    version: report.version,
    project: report.project,
    timestamp: report.timestamp,
    duration_seconds: report.duration_seconds,
    overall_assessment: report.overall_assessment,
    executive_summary: report.executiveSummary,
    ...(report.overallScore !== undefined && {
      overall_score: report.overallScore,
    }),
    coverage: report.coverageReport.map((entry) => ({
      axis: entry.axis,
      agent: entry.agent,
      status: entry.status,
      reason: entry.reason,
    })),
    findings: report.findings.map(toJsonFinding),
    observations: report.observations.map((observation) => ({
      title: observation.title,
      description: observation.description,
      source_agent: observation.source_agent,
    })),
    remediation_plan: report.remediationPlan.map((step) => ({
      priority: step.priority,
      finding_ids: [...step.finding_ids],
      action: step.action,
      effort: step.effort,
    })),
    gaps: report.gaps.map((gap) => ({
      axis: gap.axis,
      agent: gap.agent,
      reason: gap.reason,
    })),
    tracing: report.tracing,
    metadata: report.metadata,
  };
}

export function renderJson(report: FinalReport, indent = 2): string {
  return JSON.stringify(toJsonReport(report), null, indent);
}

export function parseJsonReport(json: string): FinalReport {
  const parsed = JSON.parse(json) as
    | JsonFinalReport
    | (FinalReport & {
        readonly coverage?: readonly JsonCoverageEntry[];
        readonly remediation_plan?: readonly JsonRemediationStep[];
        readonly executive_summary?: string;
      });

  if ("executiveSummary" in parsed && "coverageReport" in parsed) {
    return parsed;
  }

  return {
    version: parsed.version,
    project: parsed.project,
    timestamp: parsed.timestamp,
    duration_seconds: parsed.duration_seconds,
    overall_assessment: parsed.overall_assessment,
    executiveSummary: parsed.executive_summary,
    ...(parsed.overall_score !== undefined && {
      overallScore: parsed.overall_score,
    }),
    findings: (parsed.findings ?? []).map(fromJsonFinding),
    observations: normalizeObservations(parsed.observations),
    coverageReport: normalizeCoverageEntries(parsed.coverage),
    remediationPlan: normalizeRemediationPlan(parsed.remediation_plan),
    gaps: normalizeGaps(parsed.gaps),
    metadata: parsed.metadata,
    tracing: parsed.tracing,
  };
}
