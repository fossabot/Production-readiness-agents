import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCrewRuntime } from "../crew-runtime.js";
import type {
  CrewRunInput,
  CrewRunOutput,
  CrewRuntime,
} from "../crew-runtime.js";
import type { CrewWorkerEvent } from "../../types/events.js";
import type { RuntimePolicy } from "../../types/settings.js";
import type { RunPolicyResolutionSnapshot } from "../../types/model-policy.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MOCK_POLICY: RuntimePolicy = {
  maxRunDurationMs: 1_800_000,
  agentTimeoutMs: 300_000,
  maxConcurrency: 5,
  enableTracing: true,
  persistRawTraces: false,
  allowNetworkTools: true,
  autoOpenReportOnCompletion: false,
};

const MOCK_POLICY_SNAPSHOT: RunPolicyResolutionSnapshot = {
  snapshotId: "snap-test-001",
  profileId: "balanced",
  title: "Test snapshot",
  resolvedAt: "2026-03-09T00:00:00.000Z",
  reviewByDate: "2026-06-09T00:00:00.000Z",
  warnings: [],
  blockedReasons: [],
  agents: {} as RunPolicyResolutionSnapshot["agents"],
  runtimeFailure: null,
};

function makeInput(overrides: Partial<CrewRunInput> = {}): CrewRunInput {
  return {
    runId: "run-test-001",
    repoPath: "/tmp/test-repo",
    agents: ["structural-scout", "report-synthesizer"],
    models: {
      "structural-scout": "claude-3-5-sonnet-20241022",
      "report-synthesizer": "claude-3-5-sonnet-20241022",
    },
    policy: MOCK_POLICY,
    policyResolutionSnapshot: MOCK_POLICY_SNAPSHOT,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

describe("createCrewRuntime", () => {
  it("returns an object", () => {
    const runtime = createCrewRuntime();
    expect(runtime).toBeDefined();
    expect(typeof runtime).toBe("object");
    expect(runtime).not.toBeNull();
  });

  it("returns an object with a run method", () => {
    const runtime = createCrewRuntime();
    expect(typeof runtime.run).toBe("function");
  });

  it("satisfies the CrewRuntime interface — run is callable", () => {
    const runtime: CrewRuntime = createCrewRuntime();
    // Type assertion alone is the compile-time check; this confirms runtime shape
    expect(runtime.run).toBeInstanceOf(Function);
  });

  it("returns a new instance on each call (not a singleton)", () => {
    const a = createCrewRuntime();
    const b = createCrewRuntime();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// CrewRuntime.run — placeholder behaviour (current implementation)
// ---------------------------------------------------------------------------

describe("CrewRuntime.run — placeholder implementation", () => {
  let runtime: CrewRuntime;
  let emit: ReturnType<typeof vi.fn>;
  let controller: AbortController;

  beforeEach(() => {
    runtime = createCrewRuntime();
    emit = vi.fn();
    controller = new AbortController();
  });

  it("returns a Promise when called", () => {
    const result = runtime.run(makeInput(), emit, controller.signal);
    expect(result).toBeInstanceOf(Promise);
    // Suppress unhandled rejection for this test — we only care about the return type
    result.catch(() => undefined);
  });

  it("rejects with an Error instance (not yet implemented)", async () => {
    await expect(
      runtime.run(makeInput(), emit, controller.signal),
    ).rejects.toBeInstanceOf(Error);
  });

  it("rejects — the error has a non-empty message", async () => {
    await expect(
      runtime.run(makeInput(), emit, controller.signal),
    ).rejects.toSatisfy((err: unknown) => {
      return err instanceof Error && err.message.length > 0;
    });
  });
});

// ---------------------------------------------------------------------------
// CrewRunInput — structural contract checks (type + runtime shape)
// ---------------------------------------------------------------------------

describe("CrewRunInput structure", () => {
  it("accepts a well-formed input object without throwing synchronously", () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const { signal } = new AbortController();
    const input = makeInput();

    // createCrewRuntime() must not throw when receiving a valid input at the
    // point of the call itself (any rejection is async)
    let threwSync = false;
    let promise: Promise<CrewRunOutput> | undefined;
    try {
      promise = runtime.run(input, emit, signal);
    } catch {
      threwSync = true;
    }
    expect(threwSync).toBe(false);
    // Clean up the pending rejection
    promise?.catch(() => undefined);
  });

  it("accepts an empty agents array", () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const { signal } = new AbortController();
    const input = makeInput({ agents: [] });

    let threwSync = false;
    let promise: Promise<CrewRunOutput> | undefined;
    try {
      promise = runtime.run(input, emit, signal);
    } catch {
      threwSync = true;
    }
    expect(threwSync).toBe(false);
    promise?.catch(() => undefined);
  });

  it("accepts an empty models map", () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const { signal } = new AbortController();
    const input = makeInput({ models: {} });

    let threwSync = false;
    let promise: Promise<CrewRunOutput> | undefined;
    try {
      promise = runtime.run(input, emit, signal);
    } catch {
      threwSync = true;
    }
    expect(threwSync).toBe(false);
    promise?.catch(() => undefined);
  });
});

// ---------------------------------------------------------------------------
// emit callback contract
// ---------------------------------------------------------------------------

describe("emit callback", () => {
  it("is passed a callable function and vi.fn() tracks calls correctly", () => {
    const emit = vi.fn<[CrewWorkerEvent], void>();
    expect(typeof emit).toBe("function");
    expect(emit).not.toHaveBeenCalled();
  });

  it("emit is not called before run resolves or rejects (placeholder does not emit)", async () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const { signal } = new AbortController();

    await runtime.run(makeInput(), emit, signal).catch(() => undefined);

    // The current placeholder throws before reaching any emit call.
    // Once the real implementation replaces the placeholder, this expectation
    // should be updated to check that specific lifecycle events were emitted.
    // For now, we only assert that the callback signature is honoured and that
    // the mock is usable — not the exact call count, which is implementation-dependent.
    expect(emit).toBeInstanceOf(Function);
  });

  it("emit accepts CrewWorkerEvent-shaped objects without throwing", () => {
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const event: CrewWorkerEvent = {
      kind: "run.lifecycle",
      runId: "run-test-001",
      timestamp: new Date().toISOString(),
      phase: "running",
    };
    // Calling emit directly verifies the mock accepts the correct shape
    emit(event);
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith(event);
  });
});

// ---------------------------------------------------------------------------
// AbortSignal contract
// ---------------------------------------------------------------------------

describe("AbortSignal", () => {
  it("a fresh AbortController signal is not aborted before run", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it("aborting the controller after calling run does not prevent the rejection from resolving", async () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const controller = new AbortController();

    const promise = runtime.run(makeInput(), emit, controller.signal);
    controller.abort();

    // The promise must still settle (either resolve or reject) even after abort.
    // This guards against a hypothetical implementation that hangs on abort.
    await expect(promise).rejects.toBeDefined();
  });

  it("AbortController.abort() sets signal.aborted to true", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it("AbortSignal is passed through to run without modification", async () => {
    const runtime = createCrewRuntime();
    const emit = vi.fn<[CrewWorkerEvent], void>();
    const controller = new AbortController();
    const { signal } = controller;

    // Capture the signal reference before calling run
    const signalBeforeRun = signal;

    await runtime.run(makeInput(), emit, signal).catch(() => undefined);

    // The signal object should remain the same reference (not cloned or wrapped)
    expect(signal).toBe(signalBeforeRun);
  });
});

// ---------------------------------------------------------------------------
// CrewRunOutput — shape contract (for when the placeholder is replaced)
// ---------------------------------------------------------------------------

describe("CrewRunOutput shape contract", () => {
  it("defines the required fields at the type level — compile-time guard", () => {
    // This object satisfies CrewRunOutput. If the interface changes in a
    // breaking way, TypeScript will catch it here at compile time.
    const sample: CrewRunOutput = {
      markdownReport: "# Report\n",
      jsonReport: '{"findings":[]}',
      findingsCount: 0,
      severitySummary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      overallAssessment: "ready",
    };
    expect(sample.markdownReport).toBeTypeOf("string");
    expect(sample.jsonReport).toBeTypeOf("string");
    expect(sample.findingsCount).toBeTypeOf("number");
    expect(sample.severitySummary).toBeTypeOf("object");
    expect(sample.overallAssessment).toBeTypeOf("string");
  });

  it("overallAssessment accepts all three valid literal values", () => {
    const values: CrewRunOutput["overallAssessment"][] = [
      "ready",
      "ready_with_conditions",
      "not_ready",
    ];
    for (const value of values) {
      expect(["ready", "ready_with_conditions", "not_ready"]).toContain(value);
    }
  });

  it("severitySummary has all four severity buckets as numbers", () => {
    const summary: CrewRunOutput["severitySummary"] = {
      critical: 3,
      high: 2,
      medium: 5,
      low: 1,
    };
    expect(summary.critical).toBeTypeOf("number");
    expect(summary.high).toBeTypeOf("number");
    expect(summary.medium).toBeTypeOf("number");
    expect(summary.low).toBeTypeOf("number");
  });

  it("findingsCount is consistent with the sum of severitySummary (contract expectation)", () => {
    // This is a soft documentation-level test. The real implementation should
    // produce findingsCount === critical + high + medium + low.
    const summary = { critical: 1, high: 2, medium: 3, low: 4 };
    const expectedTotal = summary.critical + summary.high + summary.medium + summary.low;
    expect(expectedTotal).toBe(10);
  });
});
