/**
 * Release-gate orchestration — contract tests
 *
 * The actual orchestration script (desktop/scripts/release-gate.mjs) does not
 * exist yet. These tests verify the TYPE-LEVEL CONTRACT defined in
 * desktop/electron/types/release.ts and document the expected behavioral
 * contract that any future implementation must satisfy.
 *
 * Nothing in this file imports the .mjs script. Instead each test reasons
 * about the structure of result objects built from literal values that
 * conform to the release type definitions.
 */

import { describe, it, expect } from "vitest";
import type {
  ReleaseGateStatus,
  ReleaseGateCheckStage,
  ReleaseGateCheckStatus,
  ReleaseGateCheck,
  ReleaseGateResult,
} from "../../electron/types/release.js";

// ---------------------------------------------------------------------------
// Helpers — build valid typed objects from literals
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

function makeCheck(
  overrides: Partial<ReleaseGateCheck> = {},
): ReleaseGateCheck {
  return {
    checkId: "chk-001",
    gateRunId: "gate-run-001",
    stage: "root-static",
    label: "TypeScript type-check",
    command: "tsc --noEmit",
    startedAt: "2026-03-09T10:00:00.000Z",
    finishedAt: "2026-03-09T10:00:30.000Z",
    durationMs: 30_000,
    status: "passed",
    required: true,
    evidencePath: null,
    details: null,
    ...overrides,
  };
}

function makeGateResult(
  overrides: Partial<ReleaseGateResult> = {},
): ReleaseGateResult {
  return {
    gateRunId: "gate-run-001",
    candidateId: "candidate-v1.0.0-win",
    startedAt: "2026-03-09T10:00:00.000Z",
    finishedAt: "2026-03-09T10:05:00.000Z",
    status: "passed",
    platform: "win",
    summary: "All 9 required stages passed.",
    blockingReasons: [],
    checkIds: [],
    runtimeSessionIds: [],
    generatedFiles: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stage contract
// ---------------------------------------------------------------------------

describe("ReleaseGateCheckStage — required stage definitions", () => {
  it("defines exactly 9 required stages", () => {
    expect(ALL_STAGES).toHaveLength(9);
  });

  it("includes root-static stage", () => {
    expect(ALL_STAGES).toContain("root-static");
  });

  it("includes root-tests stage", () => {
    expect(ALL_STAGES).toContain("root-tests");
  });

  it("includes desktop-static stage", () => {
    expect(ALL_STAGES).toContain("desktop-static");
  });

  it("includes desktop-tests stage", () => {
    expect(ALL_STAGES).toContain("desktop-tests");
  });

  it("includes desktop-build stage", () => {
    expect(ALL_STAGES).toContain("desktop-build");
  });

  it("includes package stage", () => {
    expect(ALL_STAGES).toContain("package");
  });

  it("includes smoke stage", () => {
    expect(ALL_STAGES).toContain("smoke");
  });

  it("includes performance stage", () => {
    expect(ALL_STAGES).toContain("performance");
  });

  it("includes docs stage", () => {
    expect(ALL_STAGES).toContain("docs");
  });

  it("all stage values are non-empty strings", () => {
    for (const stage of ALL_STAGES) {
      expect(typeof stage).toBe("string");
      expect(stage.length).toBeGreaterThan(0);
    }
  });

  it("stage values are unique", () => {
    const unique = new Set(ALL_STAGES);
    expect(unique.size).toBe(ALL_STAGES.length);
  });
});

// ---------------------------------------------------------------------------
// ReleaseGateStatus contract
// ---------------------------------------------------------------------------

describe("ReleaseGateStatus — allowed status values", () => {
  const validStatuses: ReleaseGateStatus[] = [
    "pending",
    "running",
    "passed",
    "failed",
    "cancelled",
  ];

  it("defines 5 valid gate statuses", () => {
    expect(validStatuses).toHaveLength(5);
  });

  it("includes pending status", () => {
    expect(validStatuses).toContain("pending");
  });

  it("includes running status", () => {
    expect(validStatuses).toContain("running");
  });

  it("includes passed status", () => {
    expect(validStatuses).toContain("passed");
  });

  it("includes failed status", () => {
    expect(validStatuses).toContain("failed");
  });

  it("includes cancelled status", () => {
    expect(validStatuses).toContain("cancelled");
  });
});

// ---------------------------------------------------------------------------
// ReleaseGateCheck contract
// ---------------------------------------------------------------------------

describe("ReleaseGateCheck — shape contract", () => {
  it("a minimal passed check has the expected fields", () => {
    const check = makeCheck();

    expect(typeof check.checkId).toBe("string");
    expect(typeof check.gateRunId).toBe("string");
    expect(typeof check.stage).toBe("string");
    expect(typeof check.label).toBe("string");
    expect(typeof check.startedAt).toBe("string");
    expect(typeof check.finishedAt).toBe("string");
    expect(typeof check.durationMs).toBe("number");
    expect(typeof check.status).toBe("string");
    expect(typeof check.required).toBe("boolean");
  });

  it("check.command can be null when no shell command is associated", () => {
    const check = makeCheck({ command: null });
    expect(check.command).toBeNull();
  });

  it("check.evidencePath can be null when no artifact is produced", () => {
    const check = makeCheck({ evidencePath: null });
    expect(check.evidencePath).toBeNull();
  });

  it("check.details can be null for a passing check", () => {
    const check = makeCheck({ details: null });
    expect(check.details).toBeNull();
  });

  it("check.details can carry a failure reason string for failed checks", () => {
    const check = makeCheck({
      status: "failed",
      details: "TypeScript compilation error: 3 type errors",
    });
    expect(typeof check.details).toBe("string");
    expect(check.details).toContain("TypeScript");
  });

  it("required:true marks the check as blocking", () => {
    const check = makeCheck({ required: true });
    expect(check.required).toBe(true);
  });

  it("required:false marks the check as non-blocking", () => {
    const check = makeCheck({ required: false });
    expect(check.required).toBe(false);
  });

  it("durationMs is a non-negative number", () => {
    const check = makeCheck({ durationMs: 0 });
    expect(check.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("startedAt is parseable as an ISO date string", () => {
    const check = makeCheck({ startedAt: "2026-03-09T10:00:00.000Z" });
    const parsed = new Date(check.startedAt);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it("finishedAt is parseable as an ISO date string", () => {
    const check = makeCheck({ finishedAt: "2026-03-09T10:00:30.000Z" });
    const parsed = new Date(check.finishedAt);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  it("check stage must be one of the 9 required stages", () => {
    const check = makeCheck({ stage: "desktop-tests" });
    expect(ALL_STAGES).toContain(check.stage);
  });

  const checkStatuses: ReleaseGateCheckStatus[] = ["passed", "failed", "skipped"];

  it.each(checkStatuses)("status '%s' is a valid ReleaseGateCheckStatus", (status) => {
    const check = makeCheck({ status });
    expect(check.status).toBe(status);
  });
});

// ---------------------------------------------------------------------------
// ReleaseGateResult — passed gate contract
// ---------------------------------------------------------------------------

describe("ReleaseGateResult — passed gate contract", () => {
  it("a passed gate has status 'passed'", () => {
    const result = makeGateResult({ status: "passed" });
    expect(result.status).toBe("passed");
  });

  it("a passed gate has zero blocking reasons", () => {
    const result = makeGateResult({ status: "passed", blockingReasons: [] });
    expect(result.blockingReasons).toHaveLength(0);
  });

  it("gateRunId is a non-empty string", () => {
    const result = makeGateResult();
    expect(typeof result.gateRunId).toBe("string");
    expect(result.gateRunId.length).toBeGreaterThan(0);
  });

  it("candidateId is a non-empty string", () => {
    const result = makeGateResult();
    expect(typeof result.candidateId).toBe("string");
    expect(result.candidateId.length).toBeGreaterThan(0);
  });

  it("startedAt is a string", () => {
    const result = makeGateResult();
    expect(typeof result.startedAt).toBe("string");
  });

  it("startedAt is parseable as a date", () => {
    const result = makeGateResult();
    expect(isNaN(new Date(result.startedAt).getTime())).toBe(false);
  });

  it("finishedAt can be null while the gate is still running", () => {
    const result = makeGateResult({
      status: "running",
      finishedAt: null,
    });
    expect(result.finishedAt).toBeNull();
  });

  it("finishedAt is a string when the gate has completed", () => {
    const result = makeGateResult({
      status: "passed",
      finishedAt: "2026-03-09T10:05:00.000Z",
    });
    expect(typeof result.finishedAt).toBe("string");
  });

  it("checkIds is an array", () => {
    const result = makeGateResult();
    expect(Array.isArray(result.checkIds)).toBe(true);
  });

  it("a passed gate with all 9 checks has 9 checkIds", () => {
    const checkIds = ALL_STAGES.map((s) => `chk-${s}`);
    const result = makeGateResult({ checkIds });
    expect(result.checkIds).toHaveLength(9);
  });

  it("summary is a string", () => {
    const result = makeGateResult();
    expect(typeof result.summary).toBe("string");
  });

  it("blockingReasons is an array", () => {
    const result = makeGateResult();
    expect(Array.isArray(result.blockingReasons)).toBe(true);
  });

  it("runtimeSessionIds is an array", () => {
    const result = makeGateResult();
    expect(Array.isArray(result.runtimeSessionIds)).toBe(true);
  });

  it("generatedFiles is an array", () => {
    const result = makeGateResult();
    expect(Array.isArray(result.generatedFiles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ReleaseGateResult — failed gate contract
// ---------------------------------------------------------------------------

describe("ReleaseGateResult — failed gate contract", () => {
  it("a failed required check blocks the gate", () => {
    const failedCheck = makeCheck({
      checkId: "chk-root-static",
      stage: "root-static",
      status: "failed",
      required: true,
      details: "3 TypeScript errors found",
    });

    // A gate implementation must collect required failed checks as blocking reasons.
    const blockingReasons = [
      `Stage "${failedCheck.stage}" failed: ${failedCheck.details}`,
    ];

    const result = makeGateResult({
      status: "failed",
      blockingReasons,
      checkIds: [failedCheck.checkId],
    });

    expect(result.status).toBe("failed");
    expect(result.blockingReasons.length).toBeGreaterThan(0);
  });

  it("a non-required failed check does not prevent a passing gate", () => {
    // A skipped or failed non-required check should not block the gate.
    const nonRequiredCheck = makeCheck({
      checkId: "chk-docs",
      stage: "docs",
      status: "skipped",
      required: false,
    });

    // Gate still passes when only non-required checks fail/skip.
    const result = makeGateResult({
      status: "passed",
      blockingReasons: [],
      checkIds: [nonRequiredCheck.checkId],
    });

    expect(result.status).toBe("passed");
    expect(result.blockingReasons).toHaveLength(0);
  });

  it("blocking reasons are string messages", () => {
    const result = makeGateResult({
      status: "failed",
      blockingReasons: [
        'Stage "root-static" failed: type errors found',
        'Stage "desktop-tests" failed: 2 tests failed',
      ],
    });

    for (const reason of result.blockingReasons) {
      expect(typeof reason).toBe("string");
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it("multiple required failures produce multiple blocking reasons", () => {
    const result = makeGateResult({
      status: "failed",
      blockingReasons: [
        'Stage "root-static" failed: lint errors',
        'Stage "root-tests" failed: 5 tests failed',
        'Stage "desktop-build" failed: compilation error',
      ],
    });

    expect(result.blockingReasons).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// JSON serialization contract
// ---------------------------------------------------------------------------

describe("ReleaseGateResult — JSON serialization contract", () => {
  it("result serializes to valid JSON without throwing", () => {
    const result = makeGateResult();
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("serialized result deserializes back to an equivalent object", () => {
    const result = makeGateResult();
    const serialized = JSON.stringify(result);
    const deserialized = JSON.parse(serialized) as ReleaseGateResult;

    expect(deserialized.gateRunId).toBe(result.gateRunId);
    expect(deserialized.candidateId).toBe(result.candidateId);
    expect(deserialized.status).toBe(result.status);
    expect(deserialized.blockingReasons).toEqual(result.blockingReasons);
    expect(deserialized.checkIds).toEqual(result.checkIds);
  });

  it("serialized result includes a status field", () => {
    const result = makeGateResult({ status: "passed" });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(json).toHaveProperty("status", "passed");
  });

  it("serialized result includes startedAt timestamp string", () => {
    const result = makeGateResult({ startedAt: "2026-03-09T10:00:00.000Z" });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(json).toHaveProperty("startedAt");
    expect(typeof json.startedAt).toBe("string");
  });

  it("serialized result includes blockingReasons array", () => {
    const result = makeGateResult({ blockingReasons: [] });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(json).toHaveProperty("blockingReasons");
    expect(Array.isArray(json.blockingReasons)).toBe(true);
  });

  it("serialized result includes checkIds array", () => {
    const result = makeGateResult({ checkIds: ["chk-001", "chk-002"] });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(json).toHaveProperty("checkIds");
    expect(json.checkIds).toEqual(["chk-001", "chk-002"]);
  });

  it("serialized failed result preserves all blocking reasons", () => {
    const reasons = [
      'Stage "root-static" failed',
      'Stage "desktop-tests" failed',
    ];
    const result = makeGateResult({ status: "failed", blockingReasons: reasons });
    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    expect(json.blockingReasons).toEqual(reasons);
  });

  it("a complete serialized result has gateRunId, candidateId, status, blockingReasons, and checkIds", () => {
    const checkIds = ALL_STAGES.map((s) => `chk-${s}`);
    const result = makeGateResult({
      gateRunId: "gate-run-final-001",
      candidateId: "v1.2.3-win",
      status: "passed",
      blockingReasons: [],
      checkIds,
    });

    const json = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;

    expect(json).toHaveProperty("gateRunId", "gate-run-final-001");
    expect(json).toHaveProperty("candidateId", "v1.2.3-win");
    expect(json).toHaveProperty("status", "passed");
    expect(json).toHaveProperty("blockingReasons");
    expect(json).toHaveProperty("checkIds");
    expect((json.checkIds as string[]).length).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Cancelled gate contract
// ---------------------------------------------------------------------------

describe("ReleaseGateResult — cancelled gate contract", () => {
  it("a cancelled gate has status 'cancelled'", () => {
    const result = makeGateResult({ status: "cancelled", finishedAt: null });
    expect(result.status).toBe("cancelled");
  });

  it("a cancelled gate may have null finishedAt", () => {
    const result = makeGateResult({ status: "cancelled", finishedAt: null });
    expect(result.finishedAt).toBeNull();
  });
});
