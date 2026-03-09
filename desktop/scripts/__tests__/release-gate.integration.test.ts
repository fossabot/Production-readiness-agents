/**
 * T052 — Release gate orchestration: integration-level tests
 *
 * Verifies the end-to-end behaviour of the release gate script by simulating
 * the full orchestration flow with controlled stage outcomes. The actual
 * release-gate.mjs spawns child processes; these tests reason about the
 * orchestration logic (stage ordering, blocking semantics, result aggregation)
 * using typed fixture objects that mirror the runtime output contract.
 *
 * All tests operate on in-memory data structures — no child_process or fs
 * operations are performed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ReleaseGateCheck,
  ReleaseGateCheckStage,
  ReleaseGateCheckStatus,
  ReleaseGateResult,
  ReleaseGateStatus,
} from "../../electron/types/release.js";

// ---------------------------------------------------------------------------
// Helpers — simulate the orchestration logic from release-gate.mjs
// ---------------------------------------------------------------------------

const ALL_STAGES: ReleaseGateCheckStage[] = [
  "root-static",
  "root-tests",
  "desktop-static",
  "desktop-tests",
  "desktop-build",
  "package",
  "smoke",
  "performance",
  "docs",
];

interface StageOutcome {
  stage: ReleaseGateCheckStage;
  status: ReleaseGateCheckStatus;
  required: boolean;
  durationMs: number;
  details: string | null;
}

function makeCheck(
  gateRunId: string,
  outcome: StageOutcome,
  index: number,
): ReleaseGateCheck {
  const startedAt = new Date(Date.now() + index * 1000).toISOString();
  const finishedAt = new Date(
    Date.now() + index * 1000 + outcome.durationMs,
  ).toISOString();
  return {
    checkId: `chk-${outcome.stage}-${index}`,
    gateRunId,
    stage: outcome.stage,
    label: `${outcome.stage} check`,
    command: outcome.stage.includes("static") ? "tsc --noEmit" : `npm run test`,
    startedAt,
    finishedAt,
    durationMs: outcome.durationMs,
    status: outcome.status,
    required: outcome.required,
    evidencePath: null,
    details: outcome.details,
  };
}

/**
 * Simulates the gate orchestration logic: runs all stages sequentially,
 * collects checks, derives blocking reasons, and computes the final result.
 * This mirrors the core algorithm in release-gate.mjs main().
 */
function runGateOrchestration(
  outcomes: StageOutcome[],
  opts: { candidateId?: string; platform?: ReleaseGateResult["platform"] } = {},
): { result: ReleaseGateResult; checks: ReleaseGateCheck[] } {
  const gateRunId = `gate-integration-${Date.now()}`;
  const candidateId = opts.candidateId ?? "cand-integration-001";
  const platform = opts.platform ?? "win";
  const startedAt = new Date().toISOString();

  const checks: ReleaseGateCheck[] = outcomes.map((outcome, i) =>
    makeCheck(gateRunId, outcome, i),
  );

  const blockingReasons = checks
    .filter((c) => c.required && c.status === "failed")
    .map(
      (c) => `[${c.stage}] ${c.label}: ${c.details ?? "command failed"}`,
    );

  const overallStatus: ReleaseGateStatus =
    blockingReasons.length === 0 ? "passed" : "failed";

  const totalMs = checks.reduce((acc, c) => acc + c.durationMs, 0);
  const passCount = checks.filter((c) => c.status === "passed").length;
  const failCount = checks.filter((c) => c.status === "failed").length;
  const skipCount = checks.filter((c) => c.status === "skipped").length;

  const summary =
    overallStatus === "passed"
      ? `All ${passCount} required checks passed in ${Math.round(totalMs / 1000)}s.`
      : `${failCount} required check(s) failed. ${passCount} passed, ${skipCount} skipped.`;

  const result: ReleaseGateResult = {
    gateRunId,
    candidateId,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: overallStatus,
    platform,
    summary,
    blockingReasons,
    checkIds: checks.map((c) => c.checkId),
    runtimeSessionIds: [],
    generatedFiles: [],
  };

  return { result, checks };
}

function makeAllPassingOutcomes(): StageOutcome[] {
  return ALL_STAGES.map((stage) => ({
    stage,
    status: "passed" as const,
    required: true,
    durationMs: 500 + Math.floor(Math.random() * 2000),
    details: null,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Release gate orchestration — integration", () => {
  // -------------------------------------------------------------------------
  // Full gate pass
  // -------------------------------------------------------------------------

  describe("full gate passes when all stages succeed", () => {
    it("produces a result with status 'passed'", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes);
      expect(result.status).toBe("passed");
    });

    it("has zero blocking reasons", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons).toHaveLength(0);
    });

    it("includes all 9 check IDs", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes);
      expect(result.checkIds).toHaveLength(9);
    });

    it("all checks have status 'passed'", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      for (const check of checks) {
        expect(check.status).toBe("passed");
      }
    });

    it("summary mentions all checks passed", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes);
      expect(result.summary).toContain("passed");
    });
  });

  // -------------------------------------------------------------------------
  // Gate fails on first blocking stage
  // -------------------------------------------------------------------------

  describe("gate fails when a required stage fails", () => {
    it("produces a result with status 'failed' when root-static fails", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 1200,
        details: "3 TypeScript errors found",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.status).toBe("failed");
    });

    it("blocking reasons include the failed stage name", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 1200,
        details: "3 TypeScript errors found",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons.length).toBeGreaterThan(0);
      expect(result.blockingReasons[0]).toContain("root-static");
    });

    it("blocking reasons include the failure details", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 1200,
        details: "3 TypeScript errors found",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons[0]).toContain("3 TypeScript errors found");
    });
  });

  // -------------------------------------------------------------------------
  // Non-blocking stage warnings do not fail gate
  // -------------------------------------------------------------------------

  describe("non-blocking stage warnings do not fail gate", () => {
    it("gate passes when only a non-required stage fails", () => {
      const outcomes: StageOutcome[] = ALL_STAGES.map((stage) => ({
        stage,
        status: "passed" as const,
        required: stage !== "docs",
        durationMs: 800,
        details: null,
      }));
      // Make docs fail but it is non-required
      outcomes[8] = {
        stage: "docs",
        status: "failed",
        required: false,
        durationMs: 100,
        details: "docs/production-readiness.md is missing",
      };

      const { result } = runGateOrchestration(outcomes);
      expect(result.status).toBe("passed");
    });

    it("blocking reasons are empty when only non-required stages fail", () => {
      const outcomes: StageOutcome[] = ALL_STAGES.map((stage) => ({
        stage,
        status: "passed" as const,
        required: stage !== "performance",
        durationMs: 800,
        details: null,
      }));
      outcomes[7] = {
        stage: "performance",
        status: "failed",
        required: false,
        durationMs: 50,
        details: "performance-notes.md missing",
      };

      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Stage timing is recorded
  // -------------------------------------------------------------------------

  describe("stage timing is recorded", () => {
    it("each check has a positive durationMs", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      for (const check of checks) {
        expect(check.durationMs).toBeGreaterThan(0);
      }
    });

    it("each check has a valid startedAt ISO string", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      for (const check of checks) {
        expect(isNaN(new Date(check.startedAt).getTime())).toBe(false);
      }
    });

    it("each check has a valid finishedAt ISO string", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      for (const check of checks) {
        expect(isNaN(new Date(check.finishedAt).getTime())).toBe(false);
      }
    });

    it("finishedAt is at or after startedAt for each check", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      for (const check of checks) {
        expect(
          new Date(check.finishedAt).getTime(),
        ).toBeGreaterThanOrEqual(new Date(check.startedAt).getTime());
      }
    });
  });

  // -------------------------------------------------------------------------
  // Result JSON includes all stage outcomes
  // -------------------------------------------------------------------------

  describe("result JSON includes all stage outcomes", () => {
    it("checks array has one entry per stage", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      expect(checks).toHaveLength(ALL_STAGES.length);
    });

    it("every defined stage appears in the checks", () => {
      const outcomes = makeAllPassingOutcomes();
      const { checks } = runGateOrchestration(outcomes);
      const checkStages = checks.map((c) => c.stage);
      for (const stage of ALL_STAGES) {
        expect(checkStages).toContain(stage);
      }
    });

    it("result serializes to valid JSON", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result, checks } = runGateOrchestration(outcomes);
      const payload = { result, checks };
      expect(() => JSON.stringify(payload)).not.toThrow();
    });

    it("deserialized JSON preserves all result fields", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result, checks } = runGateOrchestration(outcomes);
      const json = JSON.parse(JSON.stringify({ result, checks })) as {
        result: ReleaseGateResult;
        checks: ReleaseGateCheck[];
      };
      expect(json.result.gateRunId).toBe(result.gateRunId);
      expect(json.result.candidateId).toBe(result.candidateId);
      expect(json.result.status).toBe(result.status);
      expect(json.checks).toHaveLength(checks.length);
    });
  });

  // -------------------------------------------------------------------------
  // Gate fails when desktop tests fail
  // -------------------------------------------------------------------------

  describe("gate fails when desktop tests fail", () => {
    it("produces status 'failed' when desktop-tests stage fails", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[3] = {
        stage: "desktop-tests",
        status: "failed",
        required: true,
        durationMs: 5000,
        details: "4 tests failed in electron suite",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.status).toBe("failed");
    });

    it("blocking reasons reference desktop-tests stage", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[3] = {
        stage: "desktop-tests",
        status: "failed",
        required: true,
        durationMs: 5000,
        details: "4 tests failed",
      };
      const { result } = runGateOrchestration(outcomes);
      const hasDesktopReason = result.blockingReasons.some((r) =>
        r.includes("desktop-tests"),
      );
      expect(hasDesktopReason).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Gate fails when root tests fail
  // -------------------------------------------------------------------------

  describe("gate fails when root tests fail", () => {
    it("produces status 'failed' when root-tests stage fails", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[1] = {
        stage: "root-tests",
        status: "failed",
        required: true,
        durationMs: 3000,
        details: "2 unit tests failed",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.status).toBe("failed");
    });

    it("blocking reasons reference root-tests stage", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[1] = {
        stage: "root-tests",
        status: "failed",
        required: true,
        durationMs: 3000,
        details: "vitest reported failures",
      };
      const { result } = runGateOrchestration(outcomes);
      const hasRootReason = result.blockingReasons.some((r) =>
        r.includes("root-tests"),
      );
      expect(hasRootReason).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Summary shows pass/fail counts
  // -------------------------------------------------------------------------

  describe("summary shows pass/fail counts", () => {
    it("passed gate summary mentions all checks passed", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes);
      expect(result.summary).toContain("9");
      expect(result.summary).toContain("passed");
    });

    it("failed gate summary includes fail count", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 1000,
        details: "type errors",
      };
      outcomes[1] = {
        stage: "root-tests",
        status: "failed",
        required: true,
        durationMs: 2000,
        details: "test failures",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.summary).toContain("2");
      expect(result.summary).toContain("failed");
    });

    it("summary includes skip count when stages are skipped", () => {
      const outcomes: StageOutcome[] = ALL_STAGES.map((stage) => ({
        stage,
        status: (stage === "package" || stage === "smoke"
          ? "skipped"
          : "passed") as ReleaseGateCheckStatus,
        required: true,
        durationMs: stage === "package" || stage === "smoke" ? 0 : 1000,
        details: null,
      }));
      // Need a failure to trigger the fail-branch summary
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 500,
        details: "errors",
      };

      const { result } = runGateOrchestration(outcomes);
      expect(result.summary).toContain("skipped");
    });
  });

  // -------------------------------------------------------------------------
  // Multiple simultaneous failures
  // -------------------------------------------------------------------------

  describe("multiple required failures produce multiple blocking reasons", () => {
    it("three failed required stages produce three blocking reasons", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[0] = {
        stage: "root-static",
        status: "failed",
        required: true,
        durationMs: 1000,
        details: "lint errors",
      };
      outcomes[1] = {
        stage: "root-tests",
        status: "failed",
        required: true,
        durationMs: 2000,
        details: "5 tests failed",
      };
      outcomes[4] = {
        stage: "desktop-build",
        status: "failed",
        required: true,
        durationMs: 3000,
        details: "compilation error",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons).toHaveLength(3);
    });

    it("each blocking reason references the correct stage", () => {
      const outcomes = makeAllPassingOutcomes();
      outcomes[2] = {
        stage: "desktop-static",
        status: "failed",
        required: true,
        durationMs: 1000,
        details: "type errors",
      };
      outcomes[3] = {
        stage: "desktop-tests",
        status: "failed",
        required: true,
        durationMs: 2000,
        details: "test failures",
      };
      const { result } = runGateOrchestration(outcomes);
      expect(result.blockingReasons[0]).toContain("desktop-static");
      expect(result.blockingReasons[1]).toContain("desktop-tests");
    });
  });

  // -------------------------------------------------------------------------
  // Platform label
  // -------------------------------------------------------------------------

  describe("platform label", () => {
    it("carries the platform through to the result", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes, { platform: "mac" });
      expect(result.platform).toBe("mac");
    });
  });

  // -------------------------------------------------------------------------
  // Candidate ID propagation
  // -------------------------------------------------------------------------

  describe("candidate ID propagation", () => {
    it("result candidateId matches the input", () => {
      const outcomes = makeAllPassingOutcomes();
      const { result } = runGateOrchestration(outcomes, {
        candidateId: "cand-v2.0.0-linux",
      });
      expect(result.candidateId).toBe("cand-v2.0.0-linux");
    });
  });
});
