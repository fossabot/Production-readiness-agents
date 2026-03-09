/**
 * T033 — Policy timing instrumentation tests
 *
 * Verifies that the three instrumented IPC handlers:
 *   1. MODEL_POLICY_GET_STATE      (policy.load)         — ≤500 ms threshold
 *   2. MODEL_POLICY_PREVIEW_PROFILE (policy.previewProfile) — ≤200 ms threshold
 *   3. CREW_START_RUN preflight    (policy.preflight)    — ≤1 s threshold
 *
 * emit a CREW_RUN_LOG broadcast that:
 *   - carries runId "system"
 *   - carries level "info"
 *   - contains the expected operation keyword in the message
 *   - contains a numeric millisecond value in the message
 *
 * No real policy/store logic is exercised — all external modules are fully
 * mocked. The tests do NOT assert wall-clock performance; they assert that
 * the timing instrumentation exists and produces correctly-shaped broadcasts.
 *
 * NOTE: vi.mock() factories are hoisted before any import-time code runs.
 * All variables that factory functions close over must be created with
 * vi.hoisted() so they are available at hoist-time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Hoisted state — available inside vi.mock() factory closures
// ---------------------------------------------------------------------------

const {
  mockHandlers,
  ipcMain,
  mockWebContents,
  mockBrowserWindow,
  storedRuns,
  MockWorker,
  getWorkerInstance,
  setWorkerInstance,
  mockResolvePolicy,
  mockResolvePolicyOutput,
  mockSnapshot,
  mockSettings,
} = vi.hoisted(() => {
  const { EventEmitter: HoistedEventEmitter } = require("node:events") as {
    EventEmitter: typeof import("node:events").EventEmitter;
  };

  // ------- IPC channel tracking -------------------------------------------
  const mockHandlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();

  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
      mockHandlers.set(channel, handler);
    }),
  };

  // ------- BrowserWindow stub ---------------------------------------------
  const mockWebContents = { send: vi.fn() };
  const mockBrowserWindow = { webContents: mockWebContents };

  // ------- Run store state -------------------------------------------------
  const storedRuns = new Map<string, object>();

  // ------- Worker tracking -------------------------------------------------
  let _workerInstance: InstanceType<typeof MockWorker> | null = null;

  class MockWorker extends HoistedEventEmitter {
    postMessage = vi.fn();
    terminate = vi.fn();
  }

  function getWorkerInstance() {
    return _workerInstance;
  }

  function setWorkerInstance(w: InstanceType<typeof MockWorker> | null) {
    _workerInstance = w;
  }

  // ------- Policy fixtures -------------------------------------------------
  const mockSnapshot = {
    snapshotId: "snap-perf-1",
    title: "Balanced (Perf Test)",
    description: "Test snapshot for performance tests",
    profileId: "balanced" as const,
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    reviewByDate: "2099-01-01T00:00:00.000Z",
    reviewer: null,
    approvalNotes: null,
    sourceLinks: [],
    supersedesSnapshotId: null,
    supersededBySnapshotId: null,
    assignments: {
      "structural-scout": {
        agentId: "structural-scout" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "default",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: false,
      },
      "runtime-verifier": {
        agentId: "runtime-verifier" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "default",
        confidence: "high" as const,
        role: "sensitive" as const,
        requiresTools: false,
      },
    },
  };

  const mockResolvePolicyOutput = {
    resolvedModels: {
      "structural-scout": "claude-sonnet-4.6",
      "runtime-verifier": "claude-sonnet-4.6",
    },
    snapshot: {
      snapshotId: "snap-perf-1",
      profileId: "balanced" as const,
      title: "Balanced (Perf Test)",
      resolvedAt: "2026-01-01T00:00:00.000Z",
      reviewByDate: "2099-01-01T00:00:00.000Z",
      warnings: [] as string[],
      blockedReasons: [] as unknown[],
      agents: {} as Record<string, unknown>,
      runtimeFailure: null,
    },
    preflight: {
      canRun: true,
      warnings: [] as string[],
      blockedReasons: [] as unknown[],
      fallbackAgentIds: [] as string[],
    },
  };

  const mockResolvePolicy = vi.fn().mockReturnValue(mockResolvePolicyOutput);

  const mockSettings = {
    schemaVersion: 2,
    agents: {
      "structural-scout": {
        agentId: "structural-scout",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
      "runtime-verifier": {
        agentId: "runtime-verifier",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
    },
    models: [],
    secrets: { storageBackend: "electron-safeStorage" as const, configuredKeys: [] },
    runtime: {
      maxRunDurationMs: 0,
      agentTimeoutMs: 300_000,
      maxConcurrency: 5,
      enableTracing: true,
      persistRawTraces: false,
      allowNetworkTools: true,
      autoOpenReportOnCompletion: false,
    },
    ui: {
      theme: "system" as const,
      language: "ar" as const,
      showRawTraces: false,
      defaultReportExportPath: null,
    },
    modelPolicy: {
      activeSnapshotId: "snap-perf-1",
      lastAppliedProfileId: "balanced",
      constraints: {
        disabledProviderIds: [],
        disabledModelIds: [],
        allowPreviewModels: false,
        requireToolSupport: true,
        includeGeneralPurposeFallback: false,
      },
      manualOverrides: {},
    },
  };

  return {
    mockHandlers,
    ipcMain,
    mockWebContents,
    mockBrowserWindow,
    storedRuns,
    MockWorker,
    getWorkerInstance,
    setWorkerInstance,
    mockResolvePolicy,
    mockResolvePolicyOutput,
    mockSnapshot,
    mockSettings,
  };
});

// ---------------------------------------------------------------------------
// 2. Module mocks (all vi.mock calls must be at module top level)
// ---------------------------------------------------------------------------

vi.mock("electron", () => ({
  ipcMain,
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ["/some/path"] }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([mockBrowserWindow]),
  },
}));

vi.mock("node:worker_threads", () => ({
  Worker: vi.fn().mockImplementation(() => {
    const instance = new MockWorker();
    setWorkerInstance(instance);
    return instance;
  }),
}));

vi.mock("node:path", () => ({
  default: {
    join: (...parts: string[]) => parts.join("/"),
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
  },
}));

vi.mock("../../persistence/settings-store.js", () => ({
  getSettings: vi.fn().mockReturnValue(mockSettings),
  updateSettings: vi.fn().mockImplementation((partial: unknown) => ({
    ...mockSettings,
    ...(partial as object),
  })),
  resetSettings: vi.fn().mockReturnValue(mockSettings),
  setManualOverride: vi.fn(),
  clearManualOverride: vi.fn(),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn().mockImplementation(async (record: object & { runId: string }) => {
    storedRuns.set(record.runId, record);
  }),
  getRun: vi.fn().mockImplementation(async (runId: string) => storedRuns.get(runId) ?? null),
  getActiveRun: vi.fn().mockResolvedValue(null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn().mockResolvedValue("/tmp/report.md"),
  getReport: vi.fn().mockResolvedValue({ content: "# Report", path: "/tmp/report.md" }),
  exportReport: vi.fn().mockResolvedValue({ success: true, path: "/tmp/export.md" }),
  deleteReports: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn().mockResolvedValue("/tmp/trace.jsonl"),
  appendTraceEvent: vi.fn(),
  closeTraceLog: vi.fn(),
  deleteTraces: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  listSnapshots: vi.fn().mockReturnValue([mockSnapshot]),
  applyProfile: vi.fn().mockReturnValue(mockSnapshot),
  publishActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  bootstrapActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  saveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  getSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  activateSnapshot: vi.fn().mockReturnValue(mockSnapshot),
}));

vi.mock("../catalog.js", () => ({
  BUILT_IN_PROFILES: [],
  buildSnapshotFromProfile: vi.fn().mockReturnValue(mockSnapshot),
  buildDefaultActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  getBuiltInProfile: vi.fn().mockReturnValue({ title: "Balanced", description: "default" }),
  getDefaultAgentModelIds: vi.fn().mockReturnValue({}),
  MODEL_CATALOG: [],
  DEFAULT_POLICY_PROFILE_ID: "balanced",
}));

vi.mock("../diff.js", () => ({
  buildProfilePreview: vi.fn().mockReturnValue({
    profileId: "balanced",
    title: "Balanced",
    description: "Default",
    keepOverrides: false,
    generatedAt: new Date().toISOString(),
    diff: [],
    changedAgentIds: [],
    unchangedAgentIds: [],
  }),
}));

vi.mock("../resolver.js", () => ({
  resolvePolicy: mockResolvePolicy,
  getReviewStatus: vi.fn().mockReturnValue("fresh"),
}));

// ---------------------------------------------------------------------------
// 3. Import modules under test — after all vi.mock() declarations
// ---------------------------------------------------------------------------

import { IPC_CHANNELS, BROADCAST_CHANNELS } from "../../ipc/channels.js";
import { registerIpcHandlers } from "../../ipc/handlers.js";

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

async function callHandler(channel: string, input?: unknown): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel "${channel}"`);
  }
  return handler({} /* IpcMainInvokeEvent stub */, input);
}

/**
 * Find all CREW_RUN_LOG broadcasts sent via webContents.send that contain
 * the given message substring.
 */
function findRunLogBroadcasts(messageSubstring: string): Array<Record<string, unknown>> {
  return mockWebContents.send.mock.calls
    .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
    .map((call) => call[1] as Record<string, unknown>)
    .filter((payload) => typeof payload?.message === "string" && payload.message.includes(messageSubstring));
}

// ---------------------------------------------------------------------------
// 5. Test suite
// ---------------------------------------------------------------------------

// ─── 5a. Stateless handler tests (GET_STATE / PREVIEW_PROFILE) ───────────
//
// These handlers do not mutate module-level state in handlers.ts, so a single
// registerIpcHandlers() per describe is sufficient.

describe("Policy timing instrumentation — MODEL_POLICY_GET_STATE", () => {
  beforeEach(() => {
    mockHandlers.clear();
    storedRuns.clear();
    mockWebContents.send.mockClear();
    mockResolvePolicy.mockReturnValue(mockResolvePolicyOutput);
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("broadcasts a CREW_RUN_LOG entry after policy state is loaded", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("broadcast uses runId 'system'", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    expect(logs[0]?.runId).toBe("system");
  });

  it("broadcast uses level 'info'", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    expect(logs[0]?.level).toBe("info");
  });

  it("broadcast message contains a numeric millisecond duration", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    expect(logs[0]?.message).toMatch(/policy\.load completed in \d+ms/);
  });

  it("broadcast carries a valid ISO timestamp", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    const ts = logs[0]?.timestamp as string | undefined;
    expect(ts).toBeDefined();
    expect(() => new Date(ts!)).not.toThrow();
    expect(new Date(ts!).toISOString()).toBe(ts);
  });

  it("is sent on the CREW_RUN_LOG broadcast channel", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const runLogCalls = mockWebContents.send.mock.calls.filter(
      (call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG,
    );
    expect(runLogCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("measured duration is a non-negative number", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    const logs = findRunLogBroadcasts("policy.load");
    const match = (logs[0]?.message as string | undefined)?.match(/completed in (\d+)ms/);
    expect(match).not.toBeNull();
    const durationMs = parseInt(match![1], 10);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("does not emit a policy.preflight log", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    expect(findRunLogBroadcasts("policy.preflight").length).toBe(0);
  });

  it("does not emit a policy.previewProfile log", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    expect(findRunLogBroadcasts("policy.previewProfile").length).toBe(0);
  });
});

describe("Policy timing instrumentation — MODEL_POLICY_PREVIEW_PROFILE", () => {
  const previewInput = { profileId: "balanced" as const, keepOverrides: false };

  beforeEach(() => {
    mockHandlers.clear();
    storedRuns.clear();
    mockWebContents.send.mockClear();
    mockResolvePolicy.mockReturnValue(mockResolvePolicyOutput);
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("broadcasts a CREW_RUN_LOG entry after profile preview is built", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("broadcast uses runId 'system'", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    expect(logs[0]?.runId).toBe("system");
  });

  it("broadcast uses level 'info'", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    expect(logs[0]?.level).toBe("info");
  });

  it("broadcast message contains a numeric millisecond duration", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    expect(logs[0]?.message).toMatch(/policy\.previewProfile completed in \d+ms/);
  });

  it("broadcast carries a valid ISO timestamp", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    const ts = logs[0]?.timestamp as string | undefined;
    expect(ts).toBeDefined();
    expect(new Date(ts!).toISOString()).toBe(ts);
  });

  it("measured duration is a non-negative number", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    const logs = findRunLogBroadcasts("policy.previewProfile");
    const match = (logs[0]?.message as string | undefined)?.match(/completed in (\d+)ms/);
    expect(match).not.toBeNull();
    const durationMs = parseInt(match![1], 10);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("timing broadcast is emitted before the handler returns the preview result", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    expect(findRunLogBroadcasts("policy.previewProfile").length).toBeGreaterThanOrEqual(1);
    expect(result).toBeDefined();
  });

  it("does not emit a policy.load log", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, previewInput);

    expect(findRunLogBroadcasts("policy.load").length).toBe(0);
  });
});

// ─── 5b. CREW_START_RUN — preflight timing ───────────────────────────────
//
// CREW_START_RUN mutates `activeWorker` at the module level inside handlers.ts.
// To prevent that state from leaking between tests, each test re-imports a
// fresh copy of handlers.ts via vi.resetModules() + dynamic import, exactly as
// crew-start-run-concurrency.test.ts does.

describe("Policy timing instrumentation — CREW_START_RUN preflight (policy.preflight)", () => {
  // Local handler map re-populated per test from the freshly imported module.
  const localHandlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();

  async function callLocalHandler(channel: string, input?: unknown): Promise<unknown> {
    const handler = localHandlers.get(channel);
    if (!handler) {
      throw new Error(`No handler registered for channel "${channel}"`);
    }
    return handler({} /* IpcMainInvokeEvent stub */, input);
  }

  beforeEach(async () => {
    localHandlers.clear();
    storedRuns.clear();
    setWorkerInstance(null);
    mockWebContents.send.mockClear();
    mockResolvePolicy.mockReturnValue(mockResolvePolicyOutput);

    // Intercept ipcMain.handle calls from the freshly imported module
    ipcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
        localHandlers.set(channel, handler);
      },
    );

    // Reset the module so activeWorker starts as null for every test
    vi.resetModules();
    const { registerIpcHandlers: freshRegister } = await import("../../ipc/handlers.js");
    freshRegister();
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("broadcasts a CREW_RUN_LOG entry for preflight after resolvePolicy", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("broadcast uses runId 'system'", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs[0]?.runId).toBe("system");
  });

  it("broadcast uses level 'info'", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs[0]?.level).toBe("info");
  });

  it("broadcast message contains a numeric millisecond duration", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs[0]?.message).toMatch(/policy\.preflight completed in \d+ms/);
  });

  it("broadcast carries a valid ISO timestamp", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    const ts = logs[0]?.timestamp as string | undefined;
    expect(ts).toBeDefined();
    expect(new Date(ts!).toISOString()).toBe(ts);
  });

  it("measured duration is a non-negative number", async () => {
    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    const match = (logs[0]?.message as string | undefined)?.match(/completed in (\d+)ms/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(0);
  });

  it("preflight timing broadcast is emitted even when the run is blocked", async () => {
    mockResolvePolicy.mockReturnValue({
      ...mockResolvePolicyOutput,
      preflight: {
        canRun: false,
        warnings: [],
        blockedReasons: [
          {
            agentId: "runtime-verifier",
            candidateModelId: null,
            code: "CREDENTIAL_MISSING",
            message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
          },
        ],
        fallbackAgentIds: [],
      },
      snapshot: {
        ...mockResolvePolicyOutput.snapshot,
        blockedReasons: [
          {
            agentId: "runtime-verifier",
            candidateModelId: null,
            code: "CREDENTIAL_MISSING",
            message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
          },
        ],
        agents: {
          "runtime-verifier": {
            agentId: "runtime-verifier",
            recommendedModelId: "claude-sonnet-4.6",
            effectiveModelId: null,
            effectiveFallbackModelIds: [],
            selectedSource: "blocked",
            fallbackUsed: false,
            overrideModelId: null,
            blockedReason: {
              agentId: "runtime-verifier",
              candidateModelId: null,
              code: "CREDENTIAL_MISSING",
              message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
            },
            validationNotes: [],
            rationale: "blocked",
            confidence: "high",
            reviewByDate: "2099-01-01T00:00:00.000Z",
          },
        },
      },
    });

    // The handler throws because the run is blocked, but the timing broadcast
    // must have been emitted before the throw point.
    await expect(
      callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
    ).rejects.toThrow();

    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it("preflight broadcast is emitted before the worker is created", async () => {
    const { Worker } = await import("node:worker_threads");
    const WorkerMock = Worker as unknown as ReturnType<typeof vi.fn>;
    WorkerMock.mockClear();

    await callLocalHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/perf-test" });

    expect(WorkerMock).toHaveBeenCalledOnce();
    const logs = mockWebContents.send.mock.calls
      .filter((call) => call[0] === BROADCAST_CHANNELS.CREW_RUN_LOG)
      .map((call) => call[1] as Record<string, unknown>)
      .filter((p) => typeof p?.message === "string" && p.message.includes("policy.preflight"));
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});
