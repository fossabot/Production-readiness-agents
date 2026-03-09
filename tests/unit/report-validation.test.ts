/**
 * Report validation — unit tests
 *
 * Covers the three public exports from src/report/validator.ts:
 *   - validateReport()
 *   - validateParity()
 *   - extractMarkdownFindingIds()
 *
 * All tests operate purely on in-memory data; no file I/O is required.
 */

import { describe, it, expect } from "vitest";
import {
  validateReport,
  validateParity,
  extractMarkdownFindingIds,
} from "../../src/report/validator.js";
import type { FinalReport } from "../../src/contracts/report-schema.js";
import type { Finding, Observation, CoverageEntry } from "../../src/types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALL_REQUIRED_AXES = [
  "Structure",
  "Performance",
  "Security",
  "Testing",
  "Infrastructure",
  "Documentation",
  "Runtime",
  "Synthesis",
] as const;

function makeEvidence() {
  return [
    { type: "file" as const, location: "src/index.ts", snippet: "const x = 1;" },
  ];
}

function makeFinding(id: string, overrides: Partial<Finding> = {}): Finding {
  return {
    id,
    title: `Finding ${id}`,
    severity: "High",
    category: "Performance",
    description: "A test finding",
    evidence: makeEvidence(),
    recommendation: "Fix it",
    effort: "medium",
    source_agent: "code-performance-auditor",
    ...overrides,
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    title: "Observation",
    description: "Something was noted",
    source_agent: "structural-scout",
    ...overrides,
  };
}

function makeCoverageEntry(
  axis: string,
  overrides: Partial<CoverageEntry> = {},
): CoverageEntry {
  return {
    axis,
    agent: "structural-scout",
    status: "completed",
    reason: null,
    ...overrides,
  };
}

function makeFullCoverageReport(): CoverageEntry[] {
  return ALL_REQUIRED_AXES.map((axis) => makeCoverageEntry(axis));
}

function makeDelegationRecord(to: string) {
  return {
    from: "supervisor",
    to,
    timestamp: "2026-01-01T00:00:00.000Z",
    duration_ms: 1000,
    status: "completed" as const,
  };
}

function makeValidReport(overrides: Partial<FinalReport> = {}): FinalReport {
  const finding = makeFinding("PERF-001");
  const agentsUsed = ["structural-scout", "code-performance-auditor"];

  return {
    version: "1.0.0",
    project: "test-project",
    timestamp: "2026-01-01T00:00:00.000Z",
    duration_seconds: 120,
    overall_assessment: "ready_with_conditions",
    executiveSummary: "The project is mostly ready for production.",
    overallScore: "7/10",
    findings: [finding],
    observations: [makeObservation()],
    coverageReport: makeFullCoverageReport(),
    remediationPlan: [
      {
        priority: 1,
        finding_ids: ["PERF-001"],
        action: "Optimize database queries",
        effort: "medium",
      },
    ],
    gaps: [],
    metadata: {
      crew_version: "0.1.0",
      agents_used: agentsUsed,
      batches: null,
      subprojects_scanned: null,
    },
    tracing: {
      delegations: agentsUsed.map((a) => makeDelegationRecord(a)),
      tool_calls: 5,
      retries: 0,
      total_duration_ms: 120_000,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// extractMarkdownFindingIds
// ---------------------------------------------------------------------------

describe("extractMarkdownFindingIds", () => {
  it("returns an empty array for an empty string", () => {
    const result = extractMarkdownFindingIds("");
    expect(result).toEqual([]);
  });

  it("returns an empty array when no finding headings are present", () => {
    const md = "# Report\n\nSome text without findings.";
    const result = extractMarkdownFindingIds(md);
    expect(result).toEqual([]);
  });

  it("extracts a single finding ID from a markdown string", () => {
    const md = "#### [PERF-001] Slow database queries\n\nDetails here.";
    const result = extractMarkdownFindingIds(md);
    expect(result).toEqual(["PERF-001"]);
  });

  it("extracts multiple finding IDs in document order", () => {
    const md = [
      "#### [SEC-001] SQL Injection risk",
      "Some description.",
      "#### [PERF-002] N+1 query problem",
      "More details.",
      "#### [INFRA-003] Missing health check",
    ].join("\n");

    const result = extractMarkdownFindingIds(md);
    expect(result).toEqual(["SEC-001", "PERF-002", "INFRA-003"]);
  });

  it("matches the heading pattern exactly — #### [ID] format only", () => {
    const md = [
      "## [PERF-001] Wrong heading level",
      "### [SEC-001] Still wrong",
      "#### INFRA-001 No brackets",
      "#### [DOCS-001] Correct format",
    ].join("\n");

    const result = extractMarkdownFindingIds(md);
    expect(result).toEqual(["DOCS-001"]);
  });

  it("handles IDs with various uppercase prefixes", () => {
    const md = [
      "#### [SEC-001] Security finding",
      "#### [PERF-001] Performance finding",
      "#### [TEST-001] Testing finding",
      "#### [INFRA-001] Infrastructure finding",
      "#### [DOCS-001] Documentation finding",
      "#### [ARCH-001] Architecture finding",
      "#### [RUNTIME-001] Runtime finding",
    ].join("\n");

    const result = extractMarkdownFindingIds(md);
    expect(result).toHaveLength(7);
    expect(result).toContain("SEC-001");
    expect(result).toContain("PERF-001");
    expect(result).toContain("TEST-001");
    expect(result).toContain("INFRA-001");
    expect(result).toContain("DOCS-001");
    expect(result).toContain("ARCH-001");
    expect(result).toContain("RUNTIME-001");
  });

  it("preserves document order of finding IDs", () => {
    const md = [
      "#### [PERF-003] Third",
      "#### [PERF-001] First",
      "#### [PERF-002] Second",
    ].join("\n");

    const result = extractMarkdownFindingIds(md);
    expect(result[0]).toBe("PERF-003");
    expect(result[1]).toBe("PERF-001");
    expect(result[2]).toBe("PERF-002");
  });

  it("returns a readonly-compatible array", () => {
    const md = "#### [PERF-001] A finding\n";
    const result = extractMarkdownFindingIds(md);
    expect(result.length).toBe(1);
    expect(result[0]).toBe("PERF-001");
  });

  it("does not match #### [ID] text that appears mid-line", () => {
    const md = "Some text #### [SEC-001] not at line start";
    const result = extractMarkdownFindingIds(md);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateReport — coverage completeness (Rule 1)
// ---------------------------------------------------------------------------

describe("validateReport — coverage completeness", () => {
  it("returns valid:true for a report with all 8 required axes", () => {
    const report = makeValidReport();
    const result = validateReport(report);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns an error when a coverage axis is missing", () => {
    const report = makeValidReport({
      coverageReport: makeFullCoverageReport().filter(
        (c) => c.axis !== "Security",
      ),
    });

    const result = validateReport(report);
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.rule === "coverage-completeness");
    expect(error).toBeDefined();
    expect(error?.message).toContain("Security");
  });

  it("reports a separate error for each missing axis", () => {
    const report = makeValidReport({
      coverageReport: [makeCoverageEntry("Structure")],
    });

    const result = validateReport(report);
    const coverageErrors = result.errors.filter(
      (e) => e.rule === "coverage-completeness",
    );
    expect(coverageErrors.length).toBe(7);
  });

  it("errors include the rule name 'coverage-completeness'", () => {
    const report = makeValidReport({
      coverageReport: makeFullCoverageReport().filter(
        (c) => c.axis !== "Runtime",
      ),
    });

    const result = validateReport(report);
    expect(result.errors.some((e) => e.rule === "coverage-completeness")).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// validateReport — finding evidence required (Rule 2)
// ---------------------------------------------------------------------------

describe("validateReport — finding evidence required", () => {
  it("passes when every finding has at least one evidence item", () => {
    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-001")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const evidenceErrors = result.errors.filter(
      (e) => e.rule === "finding-evidence-required",
    );
    expect(evidenceErrors).toHaveLength(0);
  });

  it("fails when a finding has an empty evidence array", () => {
    const report = makeValidReport({
      findings: [makeFinding("PERF-001", { evidence: [] })],
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "finding-evidence-required",
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("PERF-001");
  });

  it("reports individual errors for each evidenceless finding", () => {
    const report = makeValidReport({
      findings: [
        makeFinding("PERF-001", { evidence: [] }),
        makeFinding("SEC-001", { evidence: [] }),
      ],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const evidenceErrors = result.errors.filter(
      (e) => e.rule === "finding-evidence-required",
    );
    expect(evidenceErrors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// validateReport — finding severity required (Rule 3)
// ---------------------------------------------------------------------------

describe("validateReport — finding severity required", () => {
  it("passes when all findings have a severity value", () => {
    const report = makeValidReport({
      findings: [makeFinding("PERF-001", { severity: "Critical" })],
    });

    const result = validateReport(report);
    const severityErrors = result.errors.filter(
      (e) => e.rule === "finding-severity-required",
    );
    expect(severityErrors).toHaveLength(0);
  });

  it("fails when a finding has a falsy severity", () => {
    const report = makeValidReport({
      findings: [
        makeFinding("PERF-001", {
          severity: "" as unknown as "Critical",
        }),
      ],
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "finding-severity-required",
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("PERF-001");
  });
});

// ---------------------------------------------------------------------------
// validateReport — no duplicate finding IDs (Rule 4)
// ---------------------------------------------------------------------------

describe("validateReport — no duplicate finding IDs", () => {
  it("passes when all finding IDs are unique", () => {
    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-001")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const dupErrors = result.errors.filter(
      (e) => e.rule === "no-duplicate-finding-ids",
    );
    expect(dupErrors).toHaveLength(0);
  });

  it("fails when the same finding ID appears twice", () => {
    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("PERF-001")],
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "no-duplicate-finding-ids",
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("PERF-001");
  });

  it("reports only one deduplication error even if an ID appears three times", () => {
    const report = makeValidReport({
      findings: [
        makeFinding("PERF-001"),
        makeFinding("PERF-001"),
        makeFinding("PERF-001"),
      ],
    });

    const result = validateReport(report);
    const dupErrors = result.errors.filter(
      (e) => e.rule === "no-duplicate-finding-ids",
    );
    expect(dupErrors).toHaveLength(1);
  });

  it("includes all distinct duplicated IDs in the error message", () => {
    const report = makeValidReport({
      findings: [
        makeFinding("PERF-001"),
        makeFinding("PERF-001"),
        makeFinding("SEC-002"),
        makeFinding("SEC-002"),
      ],
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "no-duplicate-finding-ids",
    );
    expect(error?.message).toContain("PERF-001");
    expect(error?.message).toContain("SEC-002");
  });
});

// ---------------------------------------------------------------------------
// validateReport — observation source required (Rule 5)
// ---------------------------------------------------------------------------

describe("validateReport — observation source required", () => {
  it("passes when all observations have a source_agent", () => {
    const report = makeValidReport({
      observations: [makeObservation({ source_agent: "structural-scout" })],
    });

    const result = validateReport(report);
    const obsErrors = result.errors.filter(
      (e) => e.rule === "observation-source-required",
    );
    expect(obsErrors).toHaveLength(0);
  });

  it("fails when an observation is missing source_agent", () => {
    const report = makeValidReport({
      observations: [makeObservation({ source_agent: "" })],
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "observation-source-required",
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("source_agent");
  });
});

// ---------------------------------------------------------------------------
// validateReport — tracing delegation required (Rule 6)
// ---------------------------------------------------------------------------

describe("validateReport — tracing delegation required", () => {
  it("passes when every non-supervisor agent in agents_used has a delegation record", () => {
    const report = makeValidReport();
    const result = validateReport(report);
    const tracingErrors = result.errors.filter(
      (e) => e.rule === "tracing-delegation-required",
    );
    expect(tracingErrors).toHaveLength(0);
  });

  it("skips the supervisor agent — it is never delegated to", () => {
    const report = makeValidReport({
      metadata: {
        crew_version: "0.1.0",
        agents_used: ["supervisor", "structural-scout"],
        batches: null,
        subprojects_scanned: null,
      },
      tracing: {
        delegations: [makeDelegationRecord("structural-scout")],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const tracingErrors = result.errors.filter(
      (e) => e.rule === "tracing-delegation-required",
    );
    expect(tracingErrors).toHaveLength(0);
  });

  it("fails when an agent listed in agents_used has no delegation record", () => {
    const report = makeValidReport({
      metadata: {
        crew_version: "0.1.0",
        agents_used: ["structural-scout", "code-performance-auditor"],
        batches: null,
        subprojects_scanned: null,
      },
      tracing: {
        delegations: [makeDelegationRecord("structural-scout")],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const error = result.errors.find(
      (e) => e.rule === "tracing-delegation-required",
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain("code-performance-auditor");
  });

  it("reports a separate error for each agent missing a delegation", () => {
    const report = makeValidReport({
      metadata: {
        crew_version: "0.1.0",
        agents_used: [
          "structural-scout",
          "code-performance-auditor",
          "testing-auditor",
        ],
        batches: null,
        subprojects_scanned: null,
      },
      tracing: {
        delegations: [],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateReport(report);
    const tracingErrors = result.errors.filter(
      (e) => e.rule === "tracing-delegation-required",
    );
    expect(tracingErrors).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// validateReport — ValidationResult shape
// ---------------------------------------------------------------------------

describe("validateReport — ValidationResult shape", () => {
  it("returns an object with valid and errors fields", () => {
    const report = makeValidReport();
    const result = validateReport(report);

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("errors");
  });

  it("valid is a boolean", () => {
    const report = makeValidReport();
    const result = validateReport(report);
    expect(typeof result.valid).toBe("boolean");
  });

  it("errors is an array", () => {
    const report = makeValidReport();
    const result = validateReport(report);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("each error has a rule string and message string", () => {
    const report = makeValidReport({
      coverageReport: [],
    });

    const result = validateReport(report);
    for (const err of result.errors) {
      expect(typeof err.rule).toBe("string");
      expect(err.rule.length).toBeGreaterThan(0);
      expect(typeof err.message).toBe("string");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("valid is false exactly when errors is non-empty", () => {
    const validReport = makeValidReport();
    const validResult = validateReport(validReport);
    expect(validResult.valid).toBe(validResult.errors.length === 0);

    const invalidReport = makeValidReport({ coverageReport: [] });
    const invalidResult = validateReport(invalidReport);
    expect(invalidResult.valid).toBe(invalidResult.errors.length === 0);
  });
});

// ---------------------------------------------------------------------------
// validateParity
// ---------------------------------------------------------------------------

describe("validateParity", () => {
  it("returns valid:true when markdown and JSON have the same findings in the same order", () => {
    const md = [
      "#### [PERF-001] First finding",
      "#### [SEC-002] Second finding",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-002")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(md, report);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns an error when markdown has more findings than JSON", () => {
    const md = [
      "#### [PERF-001] Finding one",
      "#### [SEC-002] Finding two",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001")],
    });

    const result = validateParity(md, report);
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.rule === "md-json-parity-count");
    expect(error).toBeDefined();
  });

  it("returns an error when JSON has more findings than markdown", () => {
    const md = "#### [PERF-001] Finding one\n";

    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-002")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(md, report);
    expect(result.valid).toBe(false);
    const error = result.errors.find((e) => e.rule === "md-json-parity-count");
    expect(error).toBeDefined();
  });

  it("returns an error when finding IDs are in different order", () => {
    const md = [
      "#### [SEC-002] Security first",
      "#### [PERF-001] Performance second",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-002")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(md, report);
    expect(result.valid).toBe(false);
    const orderError = result.errors.find(
      (e) => e.rule === "md-json-parity-order",
    );
    expect(orderError).toBeDefined();
  });

  it("parity-order error includes position and both IDs", () => {
    const md = [
      "#### [SEC-002] Security first",
      "#### [PERF-001] Performance second",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-002")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(md, report);
    const orderError = result.errors.find(
      (e) => e.rule === "md-json-parity-order",
    );
    expect(orderError?.message).toContain("SEC-002");
    expect(orderError?.message).toContain("PERF-001");
  });

  it("parity-count error message states how many findings each format has", () => {
    const md = [
      "#### [PERF-001] First",
      "#### [SEC-002] Second",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001")],
    });

    const result = validateParity(md, report);
    const countError = result.errors.find(
      (e) => e.rule === "md-json-parity-count",
    );
    expect(countError?.message).toContain("2");
    expect(countError?.message).toContain("1");
  });

  it("returns valid:true when both markdown and JSON have zero findings", () => {
    const md = "# Report\n\nNo findings.";
    const report = makeValidReport({ findings: [] });

    const result = validateParity(md, report);
    expect(result.valid).toBe(true);
  });

  it("accepts a pre-extracted readonly string array instead of a raw markdown string", () => {
    const ids = ["PERF-001", "SEC-002"] as const;
    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-002")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(ids, report);
    expect(result.valid).toBe(true);
  });

  it("early-returns after count mismatch without generating order errors", () => {
    const md = [
      "#### [PERF-001] First",
      "#### [SEC-002] Second",
      "#### [INFRA-003] Third",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001")],
    });

    const result = validateParity(md, report);
    expect(
      result.errors.every((e) => e.rule !== "md-json-parity-order"),
    ).toBe(true);
  });

  it("reports one order error per mismatched position", () => {
    const md = [
      "#### [SEC-001] Wrong order one",
      "#### [PERF-001] Wrong order two",
    ].join("\n");

    const report = makeValidReport({
      findings: [makeFinding("PERF-001"), makeFinding("SEC-001")],
      tracing: {
        delegations: [
          makeDelegationRecord("structural-scout"),
          makeDelegationRecord("code-performance-auditor"),
        ],
        tool_calls: 0,
        retries: 0,
        total_duration_ms: 0,
      },
    });

    const result = validateParity(md, report);
    const orderErrors = result.errors.filter(
      (e) => e.rule === "md-json-parity-order",
    );
    expect(orderErrors).toHaveLength(2);
  });
});
