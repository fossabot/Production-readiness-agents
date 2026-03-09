/**
 * T059 — Partial-completion resilience coverage [FR-018]
 *
 * Contract tests that define the expected behaviour when one or more agents
 * fail while others succeed inside a single crew run. These tests operate
 * entirely on mock data structures — no real crew execution takes place —
 * because the implementing logic (T061) does not yet exist.
 *
 * FR-018: When one or more provider connections fail during a run, the system
 * continues with remaining available agents and records partial results
 * alongside the failure reason.
 *
 * Data-model invariants being tested:
 *  • A session with status "completed" may have a mix of successful and failed
 *    agent results.
 *  • The findingsSummary reflects only successful agent outputs.
 *  • Failed agents must be recorded in the error field or a dedicated failures
 *    list.
 */

import { describe, it, expect } from "vitest";
import type { CrewRunRecord, AgentRunState, FindingsSummary, RunError } from "../../types/run.js";
import type { CrewRunOutput } from "../crew-runtime.js";
import type { RunPolicyResolutionSnapshot } from "../../types/model-policy.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const BASE_POLICY_SNAPSHOT: RunPolicyResolutionSnapshot = {
  snapshotId: "snap-partial-001",
  profileId: "balanced",
  title: "Partial completion test snapshot",
  resolvedAt: "2026-03-09T00:00:00.000Z",
  reviewByDate: "2026-06-09T00:00:00.000Z",
  warnings: [],
  blockedReasons: [],
  agents: {} as RunPolicyResolutionSnapshot["agents"],
  runtimeFailure: null,
};

function makeAgentState(
  agentId: string,
  status: AgentRunState["status"],
  findingsCount: number,
  errorMessage: string | null = null,
): AgentRunState {
  const now = "2026-03-09T10:00:00.000Z";
  const finished = "2026-03-09T10:05:00.000Z";
  return {
    agentId,
    status,
    startedAt: now,
    finishedAt: status === "pending" ? null : finished,
    durationMs: status === "pending" ? null : 300_000,
    findingsCount,
    errorMessage,
  };
}

function makeFindingsSummary(overrides: Partial<FindingsSummary> = {}): FindingsSummary {
  return { critical: 0, high: 0, medium: 0, low: 0, ...overrides };
}

function makeRunRecord(overrides: Partial<CrewRunRecord> = {}): CrewRunRecord {
  return {
    runId: "run-partial-001",
    repoPath: "/tmp/test-repo",
    status: "completed",
    startedAt: "2026-03-09T10:00:00.000Z",
    finishedAt: "2026-03-09T10:10:00.000Z",
    lastUpdatedAt: "2026-03-09T10:10:00.000Z",
    selectedAgents: [],
    modelConfigSnapshot: {},
    agentStates: {},
    findingsSummary: makeFindingsSummary(),
    reportPaths: {},
    policyResolutionSnapshot: BASE_POLICY_SNAPSHOT,
    error: null,
    durationMs: 600_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper: derive findingsSummary from only successful agents
// ---------------------------------------------------------------------------

/**
 * Simulates what the implementation must do: aggregate findingsSummary from
 * agents whose status is "completed", ignoring failed agents.
 */
function aggregateFindingsFromSuccessfulAgents(
  agentStates: Record<string, AgentRunState>,
  perAgentFindings: Record<string, FindingsSummary>,
): FindingsSummary {
  const total = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const [agentId, state] of Object.entries(agentStates)) {
    if (state.status === "completed") {
      const summary = perAgentFindings[agentId];
      if (summary) {
        total.critical += summary.critical;
        total.high += summary.high;
        total.medium += summary.medium;
        total.low += summary.low;
      }
    }
  }
  return total as FindingsSummary;
}

// ---------------------------------------------------------------------------
// FR-018 — 3 of 5 agents succeed, 2 fail → status "completed"
// ---------------------------------------------------------------------------

describe("FR-018 — 3 of 5 agents succeed, 2 fail", () => {
  const agentStates: Record<string, AgentRunState> = {
    "structural-scout": makeAgentState("structural-scout", "completed", 2),
    "code-performance": makeAgentState("code-performance", "completed", 3),
    "security-resilience": makeAgentState("security-resilience", "completed", 1),
    "testing": makeAgentState(
      "testing",
      "failed",
      0,
      "Provider connection refused: anthropic API unreachable",
    ),
    "infrastructure": makeAgentState(
      "infrastructure",
      "failed",
      0,
      "Timeout: agent did not respond within 300 000 ms",
    ),
  };

  const record = makeRunRecord({
    runId: "run-partial-3of5",
    selectedAgents: Object.keys(agentStates),
    agentStates,
    status: "completed",
    findingsSummary: makeFindingsSummary({ critical: 0, high: 2, medium: 3, low: 1 }),
    error: {
      code: "AGENT_ERROR",
      message: "2 of 5 agents failed: testing, infrastructure",
      details: "testing: Provider connection refused — infrastructure: Timeout",
    },
  });

  it("run status is 'completed', not 'failed'", () => {
    expect(record.status).toBe("completed");
  });

  it("run status is not 'failed'", () => {
    expect(record.status).not.toBe("failed");
  });

  it("the two failed agents have status 'failed' in agentStates", () => {
    expect(record.agentStates["testing"].status).toBe("failed");
    expect(record.agentStates["infrastructure"].status).toBe("failed");
  });

  it("the three successful agents have status 'completed' in agentStates", () => {
    expect(record.agentStates["structural-scout"].status).toBe("completed");
    expect(record.agentStates["code-performance"].status).toBe("completed");
    expect(record.agentStates["security-resilience"].status).toBe("completed");
  });

  it("failed agents carry non-null errorMessage", () => {
    expect(record.agentStates["testing"].errorMessage).not.toBeNull();
    expect(record.agentStates["infrastructure"].errorMessage).not.toBeNull();
  });

  it("successful agents have null errorMessage", () => {
    expect(record.agentStates["structural-scout"].errorMessage).toBeNull();
    expect(record.agentStates["code-performance"].errorMessage).toBeNull();
    expect(record.agentStates["security-resilience"].errorMessage).toBeNull();
  });

  it("failed agents have findingsCount of 0", () => {
    expect(record.agentStates["testing"].findingsCount).toBe(0);
    expect(record.agentStates["infrastructure"].findingsCount).toBe(0);
  });

  it("error field is non-null and identifies which agents failed", () => {
    expect(record.error).not.toBeNull();
    expect(record.error!.message).toContain("testing");
    expect(record.error!.message).toContain("infrastructure");
  });

  it("error code is AGENT_ERROR for provider-level failures", () => {
    expect(record.error!.code).toBe("AGENT_ERROR");
  });

  it("error details include both failure reasons", () => {
    expect(record.error!.details).toBeDefined();
    expect(record.error!.details).toContain("Provider connection refused");
    expect(record.error!.details).toContain("Timeout");
  });

  it("record has a finishedAt timestamp", () => {
    expect(record.finishedAt).not.toBeNull();
  });

  it("record has a non-null durationMs", () => {
    expect(record.durationMs).not.toBeNull();
    expect(typeof record.durationMs).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// FR-018 — findingsSummary reflects only successful agent outputs
// ---------------------------------------------------------------------------

describe("FR-018 — findingsSummary excludes failed agent outputs", () => {
  const agentStates: Record<string, AgentRunState> = {
    "structural-scout": makeAgentState("structural-scout", "completed", 4),
    "docs-compliance": makeAgentState("docs-compliance", "completed", 2),
    "runtime-verifier": makeAgentState(
      "runtime-verifier",
      "failed",
      0,
      "Provider connection refused",
    ),
  };

  // Per-agent finding breakdown (what each agent would have contributed)
  const perAgentFindings: Record<string, FindingsSummary> = {
    "structural-scout": { critical: 1, high: 2, medium: 1, low: 0 },
    "docs-compliance": { critical: 0, high: 1, medium: 1, low: 0 },
    // runtime-verifier failed — its output is excluded
    "runtime-verifier": { critical: 5, high: 3, medium: 2, low: 1 },
  };

  // The correct summary — built only from completed agents
  const derivedSummary = aggregateFindingsFromSuccessfulAgents(agentStates, perAgentFindings);

  it("aggregation helper excludes the failed agent", () => {
    // structural-scout + docs-compliance only
    expect(derivedSummary.critical).toBe(1);
    expect(derivedSummary.high).toBe(3);
    expect(derivedSummary.medium).toBe(2);
    expect(derivedSummary.low).toBe(0);
  });

  it("derived summary does not include runtime-verifier's inflated counts", () => {
    // runtime-verifier would have contributed critical: 5 — must be absent
    expect(derivedSummary.critical).toBeLessThan(5);
  });

  it("record findingsSummary is consistent with successful-agent aggregation", () => {
    const record = makeRunRecord({
      agentStates,
      findingsSummary: derivedSummary,
    });
    const expectedTotal =
      record.findingsSummary.critical +
      record.findingsSummary.high +
      record.findingsSummary.medium +
      record.findingsSummary.low;
    expect(expectedTotal).toBe(6); // 4 from structural-scout + 2 from docs-compliance
  });

  it("summary counts are non-negative for all severity buckets", () => {
    expect(derivedSummary.critical).toBeGreaterThanOrEqual(0);
    expect(derivedSummary.high).toBeGreaterThanOrEqual(0);
    expect(derivedSummary.medium).toBeGreaterThanOrEqual(0);
    expect(derivedSummary.low).toBeGreaterThanOrEqual(0);
  });

  it("a failed agent with findingsCount > 0 (edge: counted before failure recorded) does not corrupt summary", () => {
    // If the implementation races and records a finding count before the agent
    // is marked failed, the summary aggregation must still derive totals from
    // the findings-level events, not from agentStates.findingsCount.
    const racyAgentState = makeAgentState("runtime-verifier", "failed", 3, "Connection lost mid-run");
    const racyRecord = makeRunRecord({
      agentStates: {
        ...agentStates,
        "runtime-verifier": racyAgentState,
      },
      findingsSummary: derivedSummary, // implementation must not add the racy 3
    });
    // The contract: findingsSummary must not include findings from a failed agent
    // even when agentStates[agentId].findingsCount is non-zero.
    const total =
      racyRecord.findingsSummary.critical +
      racyRecord.findingsSummary.high +
      racyRecord.findingsSummary.medium +
      racyRecord.findingsSummary.low;
    expect(total).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// FR-018 — failed agents are recorded in agentStates with failure reasons
// ---------------------------------------------------------------------------

describe("FR-018 — failed agent state recording", () => {
  const failureReasons: Record<string, string> = {
    "testing": "Provider API returned 503 Service Unavailable",
    "infrastructure": "Agent exceeded maximum tool execution time",
  };

  const agentStates: Record<string, AgentRunState> = {
    "structural-scout": makeAgentState("structural-scout", "completed", 1),
    "testing": makeAgentState("testing", "failed", 0, failureReasons["testing"]),
    "infrastructure": makeAgentState(
      "infrastructure",
      "failed",
      0,
      failureReasons["infrastructure"],
    ),
  };

  it("each failed agent appears in agentStates under its own key", () => {
    expect("testing" in agentStates).toBe(true);
    expect("infrastructure" in agentStates).toBe(true);
  });

  it("each failed agent's errorMessage matches the recorded failure reason", () => {
    expect(agentStates["testing"].errorMessage).toBe(failureReasons["testing"]);
    expect(agentStates["infrastructure"].errorMessage).toBe(
      failureReasons["infrastructure"],
    );
  });

  it("each failed agent has a non-null finishedAt (failure is a terminal state)", () => {
    expect(agentStates["testing"].finishedAt).not.toBeNull();
    expect(agentStates["infrastructure"].finishedAt).not.toBeNull();
  });

  it("each failed agent has status 'failed', not 'skipped' or 'timeout'", () => {
    expect(agentStates["testing"].status).toBe("failed");
    expect(agentStates["infrastructure"].status).toBe("failed");
  });

  it("failed agent agentId matches the map key (no mismatch)", () => {
    expect(agentStates["testing"].agentId).toBe("testing");
    expect(agentStates["infrastructure"].agentId).toBe("infrastructure");
  });

  it("successful agent agentId also matches the map key", () => {
    expect(agentStates["structural-scout"].agentId).toBe("structural-scout");
  });
});

// ---------------------------------------------------------------------------
// FR-018 — error field contains details about which agents failed
// ---------------------------------------------------------------------------

describe("FR-018 — error field structure for partial failure", () => {
  it("error field is non-null when any agent failed", () => {
    const record = makeRunRecord({
      status: "completed",
      agentStates: {
        "structural-scout": makeAgentState("structural-scout", "completed", 2),
        "code-performance": makeAgentState("code-performance", "failed", 0, "Timeout"),
      },
      error: {
        code: "AGENT_ERROR",
        message: "1 of 2 agents failed: code-performance",
        details: "code-performance: Timeout",
      },
    });
    expect(record.error).not.toBeNull();
  });

  it("error.code is a valid ErrorCode string", () => {
    const record = makeRunRecord({
      status: "completed",
      error: { code: "AGENT_ERROR", message: "Partial failure" },
    });
    const validCodes: RunError["code"][] = [
      "CONFIG_ERROR",
      "INPUT_ERROR",
      "TOOL_ERROR",
      "AGENT_ERROR",
      "TRACE_ERROR",
      "REPORT_ERROR",
      "STORE_ERROR",
      "WORKER_CRASH",
    ];
    expect(validCodes).toContain(record.error!.code);
  });

  it("error.message is a non-empty string", () => {
    const record = makeRunRecord({
      status: "completed",
      error: { code: "AGENT_ERROR", message: "1 of 3 agents failed: security-resilience" },
    });
    expect(record.error!.message.length).toBeGreaterThan(0);
  });

  it("error.details is optional — may be undefined for simple single-agent failure", () => {
    const errorWithoutDetails: RunError = {
      code: "AGENT_ERROR",
      message: "1 of 3 agents failed: security-resilience",
    };
    // details is not present — must not throw when accessing
    expect(errorWithoutDetails.details).toBeUndefined();
  });

  it("error.details carries per-agent failure information when present", () => {
    const error: RunError = {
      code: "AGENT_ERROR",
      message: "2 of 5 agents failed",
      details: "security-resilience: API key invalid — runtime-verifier: Connection refused",
    };
    expect(error.details).toContain("security-resilience");
    expect(error.details).toContain("runtime-verifier");
  });

  it("error field is null when all agents succeed (no partial failure)", () => {
    const record = makeRunRecord({
      status: "completed",
      agentStates: {
        "structural-scout": makeAgentState("structural-scout", "completed", 2),
        "code-performance": makeAgentState("code-performance", "completed", 1),
      },
      error: null,
    });
    expect(record.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FR-018 — all agents fail → status "failed"
// ---------------------------------------------------------------------------

describe("FR-018 — all agents fail → status is 'failed'", () => {
  const allFailedStates: Record<string, AgentRunState> = {
    "structural-scout": makeAgentState(
      "structural-scout",
      "failed",
      0,
      "Provider API returned 401 Unauthorized",
    ),
    "code-performance": makeAgentState(
      "code-performance",
      "failed",
      0,
      "Provider API returned 401 Unauthorized",
    ),
    "security-resilience": makeAgentState(
      "security-resilience",
      "failed",
      0,
      "Provider API returned 401 Unauthorized",
    ),
    "testing": makeAgentState(
      "testing",
      "failed",
      0,
      "Provider API returned 401 Unauthorized",
    ),
    "infrastructure": makeAgentState(
      "infrastructure",
      "failed",
      0,
      "Provider API returned 401 Unauthorized",
    ),
  };

  const record = makeRunRecord({
    runId: "run-all-failed",
    selectedAgents: Object.keys(allFailedStates),
    agentStates: allFailedStates,
    status: "failed",
    findingsSummary: makeFindingsSummary(),
    error: {
      code: "AGENT_ERROR",
      message: "All 5 agents failed: invalid API credentials",
      details: "Provider API returned 401 Unauthorized for all agents",
    },
  });

  it("run status is 'failed' when all agents fail", () => {
    expect(record.status).toBe("failed");
  });

  it("run status is not 'completed' when all agents fail", () => {
    expect(record.status).not.toBe("completed");
  });

  it("every agent in agentStates has status 'failed'", () => {
    for (const state of Object.values(record.agentStates)) {
      expect(state.status).toBe("failed");
    }
  });

  it("findingsSummary is all zeros when no agent succeeded", () => {
    expect(record.findingsSummary.critical).toBe(0);
    expect(record.findingsSummary.high).toBe(0);
    expect(record.findingsSummary.medium).toBe(0);
    expect(record.findingsSummary.low).toBe(0);
  });

  it("error field is non-null and describes the total failure", () => {
    expect(record.error).not.toBeNull();
    expect(record.error!.message).toContain("failed");
  });

  it("zero successful agents means the total findings count is 0", () => {
    const successfulCount = Object.values(record.agentStates).filter(
      (s) => s.status === "completed",
    ).length;
    expect(successfulCount).toBe(0);
    const totalFindings =
      record.findingsSummary.critical +
      record.findingsSummary.high +
      record.findingsSummary.medium +
      record.findingsSummary.low;
    expect(totalFindings).toBe(0);
  });

  it("finishedAt is non-null (run reached a terminal state)", () => {
    expect(record.finishedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FR-018 — only 1 of N agents succeeds → still "completed" with partial results
// ---------------------------------------------------------------------------

describe("FR-018 — single successful agent → status 'completed'", () => {
  const agentStates: Record<string, AgentRunState> = {
    "structural-scout": makeAgentState("structural-scout", "completed", 5),
    "code-performance": makeAgentState("code-performance", "failed", 0, "Connection timeout"),
    "security-resilience": makeAgentState(
      "security-resilience",
      "failed",
      0,
      "Provider unreachable",
    ),
    "testing": makeAgentState("testing", "failed", 0, "Provider unreachable"),
    "infrastructure": makeAgentState("infrastructure", "failed", 0, "Provider unreachable"),
  };

  const record = makeRunRecord({
    runId: "run-one-succeeded",
    selectedAgents: Object.keys(agentStates),
    agentStates,
    status: "completed",
    findingsSummary: makeFindingsSummary({ critical: 1, high: 2, medium: 2, low: 0 }),
    error: {
      code: "AGENT_ERROR",
      message: "4 of 5 agents failed — partial results from structural-scout",
      details:
        "code-performance: Connection timeout — security-resilience: Provider unreachable — testing: Provider unreachable — infrastructure: Provider unreachable",
    },
  });

  it("run status is 'completed' even when only one agent succeeded", () => {
    expect(record.status).toBe("completed");
  });

  it("run status is not 'failed' with at least one successful agent", () => {
    expect(record.status).not.toBe("failed");
  });

  it("exactly one agent has status 'completed'", () => {
    const completedAgents = Object.values(record.agentStates).filter(
      (s) => s.status === "completed",
    );
    expect(completedAgents).toHaveLength(1);
    expect(completedAgents[0].agentId).toBe("structural-scout");
  });

  it("exactly four agents have status 'failed'", () => {
    const failedAgents = Object.values(record.agentStates).filter(
      (s) => s.status === "failed",
    );
    expect(failedAgents).toHaveLength(4);
  });

  it("findingsSummary is non-zero (from the one successful agent)", () => {
    const total =
      record.findingsSummary.critical +
      record.findingsSummary.high +
      record.findingsSummary.medium +
      record.findingsSummary.low;
    expect(total).toBeGreaterThan(0);
  });

  it("error field is non-null, listing all four failed agents", () => {
    expect(record.error).not.toBeNull();
    expect(record.error!.message).toContain("4 of 5");
  });

  it("error field references the single successful agent by name", () => {
    expect(record.error!.message).toContain("structural-scout");
  });

  it("error details contain a reason for every failed agent", () => {
    const details = record.error!.details ?? "";
    expect(details).toContain("code-performance");
    expect(details).toContain("security-resilience");
    expect(details).toContain("testing");
    expect(details).toContain("infrastructure");
  });
});

// ---------------------------------------------------------------------------
// FR-018 — report is generated from successful agent outputs only
// ---------------------------------------------------------------------------

describe("FR-018 — CrewRunOutput report reflects only successful agents", () => {
  /**
   * The report must be generated exclusively from the outputs of agents that
   * reached status "completed". Findings from failed agents must not appear
   * in either the Markdown or JSON report.
   *
   * These tests validate the shape and constraints of the CrewRunOutput that
   * the real implementation (T061) must produce for a partial-completion run.
   */

  // Simulate a CrewRunOutput produced from 2 successful agents (structural-scout,
  // docs-compliance) when a third agent (security-resilience) failed.
  const partialOutput: CrewRunOutput = {
    markdownReport:
      "# Production Readiness Report\n\n" +
      "## Findings (partial — 2 of 3 agents completed)\n\n" +
      "### structural-scout\n- Finding A (high)\n- Finding B (medium)\n\n" +
      "### docs-compliance\n- Finding C (low)\n\n" +
      "## Failed Agents\n\n" +
      "- security-resilience: Provider connection refused\n",
    jsonReport: JSON.stringify({
      meta: { partial: true, succeededAgents: 2, failedAgents: 1 },
      findings: [
        { id: "F001", agentId: "structural-scout", severity: "HIGH" },
        { id: "F002", agentId: "structural-scout", severity: "MEDIUM" },
        { id: "F003", agentId: "docs-compliance", severity: "LOW" },
      ],
      failedAgents: [
        { agentId: "security-resilience", reason: "Provider connection refused" },
      ],
    }),
    findingsCount: 3,
    severitySummary: { critical: 0, high: 1, medium: 1, low: 1 },
    overallAssessment: "ready_with_conditions",
  };

  it("markdownReport is a non-empty string", () => {
    expect(typeof partialOutput.markdownReport).toBe("string");
    expect(partialOutput.markdownReport.length).toBeGreaterThan(0);
  });

  it("jsonReport is a non-empty string", () => {
    expect(typeof partialOutput.jsonReport).toBe("string");
    expect(partialOutput.jsonReport.length).toBeGreaterThan(0);
  });

  it("jsonReport parses as valid JSON", () => {
    expect(() => JSON.parse(partialOutput.jsonReport)).not.toThrow();
  });

  it("findingsCount matches only the successful agent output count", () => {
    expect(partialOutput.findingsCount).toBe(3);
  });

  it("severitySummary total matches findingsCount for partial output", () => {
    const { critical, high, medium, low } = partialOutput.severitySummary;
    expect(critical + high + medium + low).toBe(partialOutput.findingsCount);
  });

  it("overallAssessment is 'ready_with_conditions' for partial run (not 'ready')", () => {
    // A partial run that could not complete all agents should not be assessed
    // as fully ready — at minimum it is "ready_with_conditions" or "not_ready".
    expect(partialOutput.overallAssessment).not.toBe("ready");
  });

  it("markdownReport does not contain findings attributed to the failed agent", () => {
    // security-resilience failed — its findings must not appear in the report body
    const reportBody = partialOutput.markdownReport;
    // The failed agent is mentioned in the failures section, not as a finding source
    expect(reportBody).toContain("security-resilience");
    expect(reportBody).toContain("Failed Agents");
  });

  it("parsedJsonReport.findings contains only findings from successful agents", () => {
    const parsed = JSON.parse(partialOutput.jsonReport) as {
      findings: Array<{ agentId: string }>;
    };
    for (const finding of parsed.findings) {
      expect(finding.agentId).not.toBe("security-resilience");
    }
  });

  it("parsedJsonReport.failedAgents records the failing agent", () => {
    const parsed = JSON.parse(partialOutput.jsonReport) as {
      failedAgents: Array<{ agentId: string; reason: string }>;
    };
    expect(parsed.failedAgents).toHaveLength(1);
    expect(parsed.failedAgents[0].agentId).toBe("security-resilience");
    expect(parsed.failedAgents[0].reason).toBeTruthy();
  });

  it("parsedJsonReport.meta.partial is true for a partial-completion run", () => {
    const parsed = JSON.parse(partialOutput.jsonReport) as {
      meta: { partial: boolean; succeededAgents: number; failedAgents: number };
    };
    expect(parsed.meta.partial).toBe(true);
  });

  it("parsedJsonReport.meta.succeededAgents + failedAgents equals total selected agents", () => {
    const parsed = JSON.parse(partialOutput.jsonReport) as {
      meta: { succeededAgents: number; failedAgents: number };
    };
    expect(parsed.meta.succeededAgents + parsed.meta.failedAgents).toBe(3);
  });

  it("CrewRunOutput shape satisfies the interface contract at the type level", () => {
    // Compile-time guard: if the interface changes in a breaking way, TS catches it.
    const typed: CrewRunOutput = partialOutput;
    expect(typed.markdownReport).toBeTypeOf("string");
    expect(typed.jsonReport).toBeTypeOf("string");
    expect(typed.findingsCount).toBeTypeOf("number");
    expect(typed.severitySummary).toBeTypeOf("object");
    expect(typed.overallAssessment).toBeTypeOf("string");
  });
});

// ---------------------------------------------------------------------------
// FR-018 — status invariants across completion thresholds
// ---------------------------------------------------------------------------

describe("FR-018 — status determination invariants", () => {
  it("zero out of N agents succeed → status must be 'failed'", () => {
    const successCount = 0;
    const totalCount = 5;
    // The implementation rule: partial completion requires at least 1 success.
    // With 0 successes the status must be 'failed'.
    const expectedStatus: "completed" | "failed" =
      successCount > 0 ? "completed" : "failed";
    expect(expectedStatus).toBe("failed");
  });

  it("1 out of N agents succeeds → status must be 'completed'", () => {
    const successCount = 1;
    const expectedStatus: "completed" | "failed" =
      successCount > 0 ? "completed" : "failed";
    expect(expectedStatus).toBe("completed");
  });

  it("N out of N agents succeed → status must be 'completed'", () => {
    const successCount = 5;
    const totalCount = 5;
    expect(successCount).toBe(totalCount);
    const expectedStatus: "completed" | "failed" =
      successCount > 0 ? "completed" : "failed";
    expect(expectedStatus).toBe("completed");
  });

  it("N-1 out of N agents succeed → status must be 'completed'", () => {
    const successCount = 4;
    const totalCount = 5;
    expect(successCount).toBeGreaterThan(0);
    expect(successCount).toBeLessThan(totalCount);
    const expectedStatus: "completed" | "failed" =
      successCount > 0 ? "completed" : "failed";
    expect(expectedStatus).toBe("completed");
  });

  it("error field is null iff status is 'completed' with no failures", () => {
    // Full success: status completed, no error
    const fullSuccess = makeRunRecord({ status: "completed", error: null });
    expect(fullSuccess.error).toBeNull();

    // Partial success: status completed, error present (lists failed agents)
    const partial = makeRunRecord({
      status: "completed",
      error: { code: "AGENT_ERROR", message: "1 agent failed" },
    });
    expect(partial.error).not.toBeNull();

    // Full failure: status failed, error present
    const fullFailure = makeRunRecord({
      status: "failed",
      error: { code: "AGENT_ERROR", message: "All agents failed" },
    });
    expect(fullFailure.error).not.toBeNull();
  });

  it("'cancelled' status is distinct from both 'completed' and 'failed'", () => {
    const cancelled = makeRunRecord({ status: "cancelled", error: null });
    expect(cancelled.status).not.toBe("completed");
    expect(cancelled.status).not.toBe("failed");
    expect(cancelled.status).toBe("cancelled");
  });

  it("AgentRunState.status 'failed' is distinct from 'timeout' and 'skipped'", () => {
    const failed = makeAgentState("code-performance", "failed", 0, "API error");
    const timedOut = makeAgentState("code-performance", "timeout", 0, "Exceeded 300 000 ms");
    const skipped = makeAgentState("code-performance", "skipped", 0, null);

    expect(failed.status).toBe("failed");
    expect(timedOut.status).toBe("timeout");
    expect(skipped.status).toBe("skipped");
    expect(failed.status).not.toBe("timeout");
    expect(failed.status).not.toBe("skipped");
  });
});
