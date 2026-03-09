import type { FinalReport } from "../contracts/report-schema.js";
import type { Finding } from "../types.js";

// ─── Markdown Renderer ───────────────────────────────────────────────────────

export function renderMarkdown(report: FinalReport): string {
  const lines: string[] = [];

  lines.push(`# Production Readiness Report: ${report.project}`);
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push(report.executiveSummary);
  lines.push("");

  // Overall Assessment
  const assessmentLabel =
    report.overall_assessment === "ready"
      ? "✅ Ready"
      : report.overall_assessment === "ready_with_conditions"
        ? "⚠️ Ready with Conditions"
        : "❌ Not Ready";
  lines.push("## Overall Assessment");
  lines.push(assessmentLabel);
  if (report.overallScore) {
    lines.push(`**Score**: ${report.overallScore}`);
  }
  lines.push("");

  // Coverage
  lines.push("## Coverage");
  lines.push("| Axis | Agent | Status |");
  lines.push("| --- | --- | --- |");
  for (const entry of report.coverageReport) {
    const statusIcon =
      entry.status === "completed"
        ? "✅ Completed"
        : entry.status === "partial"
          ? "⚠️ Partial"
          : entry.status === "failed"
            ? "❌ Failed"
            : "⏭️ Skipped";
    lines.push(`| ${entry.axis} | ${entry.agent} | ${statusIcon} |`);
  }
  lines.push("");

  // Findings by severity
  lines.push("## Findings");
  const bySeverity: Record<string, Finding[]> = {
    Critical: [],
    High: [],
    Medium: [],
    Low: [],
  };
  for (const f of report.findings) {
    bySeverity[f.severity]?.push(f);
  }

  for (const [severity, findings] of Object.entries(bySeverity)) {
    if (findings.length === 0) continue;
    lines.push(`### ${severity}`);
    for (const f of findings) {
      lines.push(`#### [${f.id}] ${f.title}`);
      lines.push(`**Category**: ${f.category}  `);
      lines.push(`**Effort**: ${f.effort ?? "—"}  `);
      lines.push(`**Source**: ${f.source_agent}`);
      lines.push("");
      lines.push(f.description);
      lines.push("");
      if (f.evidence.length > 0) {
        lines.push("**Evidence**:");
        for (const ev of f.evidence) {
          const snippet = ev.snippet ? ` — \`${ev.snippet}\`` : "";
          lines.push(`- [${ev.type}] \`${ev.location}\`${snippet}`);
        }
        lines.push("");
      }
      lines.push(`**Recommendation**: ${f.recommendation}`);
      lines.push("");
    }
  }

  // Observations
  if (report.observations.length > 0) {
    lines.push("## Observations");
    for (const obs of report.observations) {
      lines.push(`### ${obs.title}`);
      lines.push(`*Source: ${obs.source_agent}*`);
      lines.push("");
      lines.push(obs.description);
      lines.push("");
    }
  }

  // Remediation Plan
  if (report.remediationPlan.length > 0) {
    lines.push("## Remediation Plan");
    for (const step of report.remediationPlan) {
      const ids = step.finding_ids.join(", ");
      lines.push(
        `${step.priority}. **${step.action}** *(effort: ${step.effort})*`,
      );
      lines.push(`   Findings: ${ids}`);
      lines.push("");
    }
  }

  // Gaps
  if (report.gaps.length > 0) {
    lines.push("## Gaps");
    for (const gap of report.gaps) {
      lines.push(`- **${gap.axis}** (${gap.agent}): ${gap.reason}`);
    }
    lines.push("");
  }

  if (
    report.metadata.batches !== null ||
    report.metadata.subprojects_scanned !== null
  ) {
    lines.push("## Monorepo Batches");
    if (report.metadata.batches !== null) {
      lines.push(`- Batches executed: **${report.metadata.batches}**`);
    }
    if (report.metadata.subprojects_scanned !== null) {
      lines.push(
        `- Subprojects scanned: **${report.metadata.subprojects_scanned}**`,
      );
    }
    lines.push("");
  }

  // Tracing
  lines.push("## Tracing");
  lines.push(
    `- Tool calls: **${report.tracing.tool_calls}**`,
  );
  lines.push(`- Retries: **${report.tracing.retries}**`);
  lines.push(
    `- Total duration: **${(report.tracing.total_duration_ms / 1000).toFixed(1)}s**`,
  );
  if (report.tracing.delegations.length > 0) {
    lines.push("");
    lines.push("| From | To | Status | Duration |");
    lines.push("| --- | --- | --- | --- |");
    for (const d of report.tracing.delegations) {
      lines.push(
        `| ${d.from} | ${d.to} | ${d.status} | ${d.duration_ms}ms |`,
      );
    }
  }
  lines.push("");

  // Metadata
  lines.push("## Metadata");
  lines.push(`- **Date**: ${report.timestamp}`);
  lines.push(`- **Duration**: ${report.duration_seconds}s`);
  lines.push(
    `- **Agents used**: ${report.metadata.agents_used.join(", ")}`,
  );
  if (report.metadata.batches !== null) {
    lines.push(`- **Batches**: ${report.metadata.batches}`);
  }
  if (report.metadata.subprojects_scanned !== null) {
    lines.push(
      `- **Subprojects scanned**: ${report.metadata.subprojects_scanned}`,
    );
  }
  lines.push(`- **Crew version**: ${report.metadata.crew_version}`);
  lines.push("");

  return lines.join("\n");
}
