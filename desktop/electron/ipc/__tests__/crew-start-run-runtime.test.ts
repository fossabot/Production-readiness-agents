/**
 * T016 — CREW_START_RUN IPC handler: runtime execution paths
 *
 * Coverage goals:
 *  1. registerIpcHandlers() registers all expected IPC channels
 *  2. CREW_START_RUN: happy path creates a queued run and returns { runId }
 *  3. CREW_START_RUN: policy-blocked run gets status "failed" and throws
 *  4. CREW_START_RUN: concurrent call rejected while worker is active
 *  5. Worker "message" event — run.lifecycle phase updates persisted run
 *  6. Worker "message" event — agent.status updates agentStates
 *  7. Worker "message" event — run.error persists error + emits policy trace
 *  8. Worker "error" event marks run failed with WORKER_CRASH
 *
 * All external dependencies are fully mocked; no Electron binary is needed.
 *
 * NOTE: vi.mock() factories are hoisted to the top of the file by vitest,
 * so any variables referenced inside them must also be declared via
 * vi.hoisted(). Regular const/let declarations are NOT accessible inside
 * vi.mock() factories even when they appear earlier in the source.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// 1. Hoisted state — available inside vi.mock() factory functions
// ---------------------------------------------------------------------------

const {
  mockHandlers,
  ipcMain,
  mockWebContents,
  mockBrowserWindow,
  storedRuns,
  getWorkerInstance,
  setWorkerInstance,
  MockWorker,
  mockResolvePolicy,
  makeResolvePolicyOutput,
  mockSnapshot,
  mockSettings,
} = vi.hoisted(() => {
  const { EventEmitter: HoistedEventEmitter } = require("node:events") as { EventEmitter: typeof import("node:events").EventEmitter };

  // ------- IPC tracking -------------------------------------------------
  const mockHandlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();

  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
      mockHandlers.set(channel, handler);
    }),
  };

  const mockWebContents = { send: vi.fn() };
  const mockBrowserWindow = { webContents: mockWebContents };

  // ------- Run store state ----------------------------------------------
  const storedRuns = new Map<string, object>();

  // ------- Worker instance tracking ------------------------------------
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

  // ------- Policy resolution helpers -----------------------------------
  type PolicyResolutionOutput = {
    resolvedModels: Record<string, string>;
    snapshot: {
      snapshotId: string;
      profileId: "balanced";
      title: string;
      resolvedAt: string;
      reviewByDate: string;
      warnings: string[];
      blockedReasons: Array<{
        agentId: string;
        candidateModelId: null;
        code: "CREDENTIAL_MISSING";
        message: string;
      }>;
      agents: Record<string, {
        agentId: string;
        recommendedModelId: string;
        effectiveModelId: string | null;
        effectiveFallbackModelIds: string[];
        selectedSource: "policy" | "blocked";
        fallbackUsed: boolean;
        overrideModelId: null;
        blockedReason: null;
        validationNotes: string[];
        rationale: string;
        confidence: "high";
        reviewByDate: string;
      }>;
      runtimeFailure: null;
    };
    preflight: {
      canRun: boolean;
      warnings: string[];
      blockedReasons: Array<{
        agentId: string;
        candidateModelId: null;
        code: "CREDENTIAL_MISSING";
        message: string;
      }>;
      fallbackAgentIds: string[];
    };
  };

  function makeResolvePolicyOutput(canRun: boolean, blockedAgentId?: string): PolicyResolutionOutput {
    return {
      resolvedModels: {
        "structural-scout": "claude-sonnet-4.6",
        "code-performance-auditor": "claude-sonnet-4.6",
        "runtime-verifier": "claude-sonnet-4.6",
        "report-synthesizer": "claude-sonnet-4.6",
      },
      snapshot: {
        snapshotId: "snap-1",
        profileId: "balanced",
        title: "Balanced",
        resolvedAt: new Date().toISOString(),
        reviewByDate: "2099-01-01T00:00:00.000Z",
        warnings: [],
        blockedReasons: canRun
          ? []
          : [
              {
                agentId: blockedAgentId ?? "runtime-verifier",
                candidateModelId: null,
                code: "CREDENTIAL_MISSING" as const,
                message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
              },
            ],
        agents: {
          "structural-scout": {
            agentId: "structural-scout",
            recommendedModelId: "claude-sonnet-4.6",
            effectiveModelId: canRun ? "claude-sonnet-4.6" : null,
            effectiveFallbackModelIds: [],
            selectedSource: canRun ? "policy" : "blocked",
            fallbackUsed: false,
            overrideModelId: null,
            blockedReason: null,
            validationNotes: [],
            rationale: "Default",
            confidence: "high",
            reviewByDate: "2099-01-01T00:00:00.000Z",
          },
        },
        runtimeFailure: null,
      },
      preflight: {
        canRun,
        warnings: [],
        blockedReasons: canRun
          ? []
          : [
              {
                agentId: blockedAgentId ?? "runtime-verifier",
                candidateModelId: null,
                code: "CREDENTIAL_MISSING" as const,
                message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
              },
            ],
        fallbackAgentIds: [],
      },
    };
  }

  const mockResolvePolicy = vi.fn().mockReturnValue(makeResolvePolicyOutput(true));

  // ------- Mock snapshot -----------------------------------------------
  const mockSnapshot = {
    snapshotId: "snap-1",
    title: "Balanced",
    description: "Default balanced policy",
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
        rationale: "Default",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: false,
      },
      "code-performance-auditor": {
        agentId: "code-performance-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "coding" as const,
        requiresTools: false,
      },
      "runtime-verifier": {
        agentId: "runtime-verifier" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "sensitive" as const,
        requiresTools: false,
      },
      "report-synthesizer": {
        agentId: "report-synthesizer" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "synthesis" as const,
        requiresTools: false,
      },
      "security-resilience-auditor": {
        agentId: "security-resilience-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "sensitive" as const,
        requiresTools: false,
      },
      "testing-auditor": {
        agentId: "testing-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: false,
      },
      "infrastructure-auditor": {
        agentId: "infrastructure-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: false,
      },
      "docs-compliance-auditor": {
        agentId: "docs-compliance-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "general" as const,
        requiresTools: false,
      },
      "general-purpose": {
        agentId: "general-purpose" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default",
        confidence: "high" as const,
        role: "general" as const,
        requiresTools: false,
      },
    },
  };

  // ------- Mock settings -----------------------------------------------
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
      "code-performance-auditor": {
        agentId: "code-performance-auditor",
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
      "report-synthesizer": {
        agentId: "report-synthesizer",
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
      activeSnapshotId: "snap-1",
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
    getWorkerInstance,
    setWorkerInstance,
    MockWorker,
    mockResolvePolicy,
    makeResolvePolicyOutput,
    mockSnapshot,
    mockSettings,
  };
});

// ---------------------------------------------------------------------------
// 2. Module mocks — factories only reference hoisted variables
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

vi.mock("../../persistence/settings-store.js", () => ({
  getSettings: vi.fn().mockReturnValue(mockSettings),
  updateSettings: vi.fn().mockImplementation((partial: unknown) => ({
    ...mockSettings,
    ...(partial as object),
  })),
  resetSettings: vi.fn().mockReturnValue(mockSettings),
  setManualOverride: vi.fn().mockReturnValue(mockSettings),
  clearManualOverride: vi.fn().mockReturnValue(mockSettings),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn().mockImplementation(async (record: object & { runId: string }) => {
    storedRuns.set(record.runId, record);
  }),
  getRun: vi.fn().mockImplementation(async (runId: string) => storedRuns.get(runId) ?? null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn().mockResolvedValue(true),
  // FR-017: getActiveRun is used by the handler to detect orphaned active runs
  getActiveRun: vi.fn().mockResolvedValue(null),
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

vi.mock("../../policy/catalog.js", () => ({
  BUILT_IN_PROFILES: [],
  buildSnapshotFromProfile: vi.fn().mockReturnValue(mockSnapshot),
  buildDefaultActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  getBuiltInProfile: vi.fn().mockReturnValue({ title: "Balanced", description: "default" }),
  getDefaultAgentModelIds: vi.fn().mockReturnValue({}),
  MODEL_CATALOG: [],
  DEFAULT_POLICY_PROFILE_ID: "balanced",
}));

vi.mock("../../policy/diff.js", () => ({
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

vi.mock("../../policy/resolver.js", () => ({
  resolvePolicy: mockResolvePolicy,
  getReviewStatus: vi.fn().mockReturnValue("fresh"),
}));

// ---------------------------------------------------------------------------
// 3. Import the module under test — after all mocks are declared
// ---------------------------------------------------------------------------

import { IPC_CHANNELS } from "../channels.js";
import { registerIpcHandlers } from "../handlers.js";

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

/** Invoke a registered handler as if called by Electron's IPC layer. */
async function callHandler(channel: string, input?: unknown): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel "${channel}"`);
  }
  return handler({} /* IpcMainInvokeEvent stub */, input);
}

/** Return the run record that was last saved for a given runId. */
function getSavedRun(runId: string): Record<string, unknown> | undefined {
  return storedRuns.get(runId) as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// 5. Test suite
// ---------------------------------------------------------------------------

describe("registerIpcHandlers — CREW_START_RUN runtime execution paths", () => {
  beforeEach(async () => {
    // If a prior test left an active worker alive in the handlers.ts module-level
    // state, drain it by emitting a terminal lifecycle event so cleanupWorker()
    // is called and activeWorker is reset to null.
    const priorWorker = getWorkerInstance();
    if (priorWorker) {
      // Feed a completed lifecycle event — the message handler calls cleanupWorker()
      // for terminal phases which sets activeWorker = null inside handlers.ts
      const firstRunId = [...storedRuns.keys()][0];
      if (firstRunId) {
        const { getRun } = await import("../../persistence/run-store.js");
        (getRun as Mock).mockResolvedValueOnce({
          ...storedRuns.get(firstRunId),
          status: "running",
        });
        priorWorker.emit("message", {
          kind: "run.lifecycle",
          runId: firstRunId,
          timestamp: new Date().toISOString(),
          phase: "completed",
        });
        // Drain async microtasks
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
    }

    mockHandlers.clear();
    storedRuns.clear();
    setWorkerInstance(null);

    // Reset to happy-path policy resolution before each test
    mockResolvePolicy.mockReturnValue(makeResolvePolicyOutput(true));

    // Re-mock getActiveRun to return null (no orphaned runs) for each test
    const { getActiveRun } = await import("../../persistence/run-store.js");
    (getActiveRun as Mock).mockResolvedValue(null);

    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Channel registration
  // -----------------------------------------------------------------------

  describe("channel registration", () => {
    it("registers all expected IPC channels", () => {
      const expectedChannels = Object.values(IPC_CHANNELS);

      for (const channel of expectedChannels) {
        expect(
          mockHandlers.has(channel),
          `Expected channel "${channel}" to be registered`,
        ).toBe(true);
      }
    });

    it("registers the correct number of handlers", () => {
      expect(mockHandlers.size).toBe(Object.keys(IPC_CHANNELS).length);
    });
  });

  // -----------------------------------------------------------------------
  // CREW_START_RUN: happy path
  // -----------------------------------------------------------------------

  describe("CREW_START_RUN — successful run start", () => {
    it("returns an object with a non-empty runId string", async () => {
      const result = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      expect(result).toHaveProperty("runId");
      expect(typeof result.runId).toBe("string");
      expect(result.runId.length).toBeGreaterThan(0);
    });

    it("persists a run record with status 'queued'", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const record = getSavedRun(runId);
      expect(record).toBeDefined();
      expect(record?.status).toBe("queued");
    });

    it("stores the repoPath on the run record", async () => {
      const repoPath = "/projects/my-app";
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath,
      }) as { runId: string };

      const record = getSavedRun(runId);
      expect(record?.repoPath).toBe(repoPath);
    });

    it("creates a Worker thread after saving the run record", async () => {
      const { Worker } = await import("node:worker_threads");
      const WorkerMock = Worker as unknown as Mock;
      WorkerMock.mockClear();

      await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/my-app" });

      expect(WorkerMock).toHaveBeenCalledOnce();
    });

    it("posts a START_RUN message to the worker", async () => {
      await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/my-app" });

      expect(getWorkerInstance()?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "START_RUN" }),
      );
    });

    it("includes runId and repoPath in the START_RUN message", async () => {
      const repoPath = "/projects/my-app";
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath }) as { runId: string };

      expect(getWorkerInstance()?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ runId, repoPath }),
      );
    });

    it("run record has no error on the happy path", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const record = getSavedRun(runId);
      expect(record?.error).toBeNull();
    });

    it("run record initialises findingsSummary to all zeros", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const record = getSavedRun(runId) as { findingsSummary: Record<string, number> };
      expect(record.findingsSummary).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    });
  });

  // -----------------------------------------------------------------------
  // CREW_START_RUN: concurrent-run guard
  // -----------------------------------------------------------------------

  describe("CREW_START_RUN — concurrent run rejection", () => {
    it("throws when a worker is already active", async () => {
      // First call creates the worker
      await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/my-app" });

      // Second call while worker is still alive must throw (FR-017 guard)
      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/other" }),
      ).rejects.toThrow("RUN_ALREADY_ACTIVE");
    });
  });

  // -----------------------------------------------------------------------
  // CREW_START_RUN: policy-blocked run
  // -----------------------------------------------------------------------

  describe("CREW_START_RUN — policy-blocked run", () => {
    beforeEach(() => {
      mockResolvePolicy.mockReturnValue(makeResolvePolicyOutput(false, "runtime-verifier"));
    });

    it("saves the run record before throwing", async () => {
      const sizeBeforeCall = storedRuns.size;

      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
      ).rejects.toThrow();

      // The default saveRun mock writes into storedRuns — verify it was called
      expect(storedRuns.size).toBeGreaterThan(sizeBeforeCall);
    });

    it("persists the run with status 'failed'", async () => {
      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
      ).rejects.toThrow();

      // The run record should have been written to storedRuns by the default mock
      const savedEntries = [...storedRuns.values()] as Record<string, unknown>[];
      expect(savedEntries.length).toBeGreaterThan(0);
      const record = savedEntries[0];
      expect(record?.status).toBe("failed");
    });

    it("sets an error with code CONFIG_ERROR on the run record", async () => {
      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
      ).rejects.toThrow();

      const savedEntries = [...storedRuns.values()] as Record<string, unknown>[];
      expect(savedEntries.length).toBeGreaterThan(0);
      const record = savedEntries[0];
      expect((record?.error as Record<string, unknown>)?.code).toBe("CONFIG_ERROR");
    });

    it("does not create a Worker thread for a blocked run", async () => {
      const { Worker } = await import("node:worker_threads");
      const WorkerMock = Worker as unknown as Mock;
      WorkerMock.mockClear();

      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
      ).rejects.toThrow();

      expect(WorkerMock).not.toHaveBeenCalled();
    });

    it("throws with a message containing the blocking reason", async () => {
      await expect(
        callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/blocked" }),
      ).rejects.toThrow("runtime-verifier");
    });
  });

  // -----------------------------------------------------------------------
  // Worker event processing — run.lifecycle
  // -----------------------------------------------------------------------

  describe("Worker message events — run.lifecycle", () => {
    it("updates run status to 'running' when lifecycle phase is 'running'", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = getSavedRun(runId) as Record<string, unknown>;
      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce({ ...existingRecord, status: "queued" });

      getWorkerInstance()!.emit("message", {
        kind: "run.lifecycle",
        runId,
        timestamp: new Date().toISOString(),
        phase: "running",
      });

      // Allow async microtasks queued by the message handler to settle
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      expect(savedCall?.status).toBe("running");
    });

    it("sets finishedAt and durationMs when lifecycle phase is 'completed'", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = getSavedRun(runId) as Record<string, unknown>;
      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce({ ...existingRecord, status: "running" });

      getWorkerInstance()!.emit("message", {
        kind: "run.lifecycle",
        runId,
        timestamp: new Date().toISOString(),
        phase: "completed",
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      expect(savedCall?.status).toBe("completed");
      expect(savedCall?.finishedAt).not.toBeNull();
      expect(typeof savedCall?.durationMs).toBe("number");
    });

    it("broadcasts run.lifecycle events to all BrowserWindows", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(getSavedRun(runId));

      mockWebContents.send.mockClear();

      getWorkerInstance()!.emit("message", {
        kind: "run.lifecycle",
        runId,
        timestamp: new Date().toISOString(),
        phase: "starting",
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(mockWebContents.send).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Worker event processing — agent.status
  // -----------------------------------------------------------------------

  describe("Worker message events — agent.status", () => {
    it("updates agentStates for the relevant agentId", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        agentStates: {},
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      getWorkerInstance()!.emit("message", {
        kind: "agent.status",
        runId,
        timestamp: new Date().toISOString(),
        agentId: "structural-scout",
        status: "running",
        timing: {
          startedAt: new Date().toISOString(),
          finishedAt: null,
          durationMs: null,
        },
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      const agentStates = savedCall?.agentStates as Record<string, unknown> | undefined;
      expect(agentStates?.["structural-scout"]).toBeDefined();
      expect((agentStates?.["structural-scout"] as Record<string, unknown>)?.status).toBe("running");
    });

    it("preserves existing findingsCount when updating agent status", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        agentStates: {
          "structural-scout": {
            agentId: "structural-scout",
            status: "running",
            startedAt: new Date().toISOString(),
            finishedAt: null,
            durationMs: null,
            findingsCount: 3,
            errorMessage: null,
          },
        },
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      getWorkerInstance()!.emit("message", {
        kind: "agent.status",
        runId,
        timestamp: new Date().toISOString(),
        agentId: "structural-scout",
        status: "completed",
        timing: {
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 1234,
        },
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      const agentStates = savedCall?.agentStates as Record<string, unknown> | undefined;
      expect((agentStates?.["structural-scout"] as Record<string, unknown>)?.findingsCount).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Worker event processing — run.error
  // -----------------------------------------------------------------------

  describe("Worker message events — run.error", () => {
    it("persists the error code and message to the run record", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        policyResolutionSnapshot: null,
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      getWorkerInstance()!.emit("message", {
        kind: "run.error",
        runId,
        timestamp: new Date().toISOString(),
        error: {
          code: "AGENT_ERROR",
          message: "Agent timed out",
          agentId: "structural-scout",
        },
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      const error = savedCall?.error as Record<string, unknown> | undefined;
      expect(error?.code).toBe("AGENT_ERROR");
      expect(error?.message).toBe("Agent timed out");
    });

    it("emits a policy:runtime-failed trace event when policyResolutionSnapshot is present", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        policyResolutionSnapshot: {
          snapshotId: "snap-1",
          profileId: "balanced",
          title: "Balanced",
          resolvedAt: new Date().toISOString(),
          reviewByDate: "2099-01-01T00:00:00.000Z",
          warnings: [],
          blockedReasons: [],
          agents: {},
          runtimeFailure: null,
        },
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      mockWebContents.send.mockClear();

      getWorkerInstance()!.emit("message", {
        kind: "run.error",
        runId,
        timestamp: new Date().toISOString(),
        error: {
          code: "AGENT_ERROR",
          message: "Agent timed out",
          agentId: "structural-scout",
        },
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      // The handler calls broadcast() for the raw event AND for the policy trace
      expect(mockWebContents.send.mock.calls.length).toBeGreaterThanOrEqual(1);

      // Verify one of the broadcasts carried a trace.event with spanName "policy:runtime-failed"
      const traceCall = mockWebContents.send.mock.calls.find(
        (call) =>
          call[1] != null &&
          typeof call[1] === "object" &&
          (call[1] as Record<string, unknown>).kind === "trace.event" &&
          (call[1] as Record<string, unknown>).spanName === "policy:runtime-failed",
      );
      expect(traceCall).toBeDefined();
    });

    it("records runtimeFailure on policyResolutionSnapshot", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        policyResolutionSnapshot: {
          snapshotId: "snap-1",
          profileId: "balanced",
          title: "Balanced",
          resolvedAt: new Date().toISOString(),
          reviewByDate: "2099-01-01T00:00:00.000Z",
          warnings: [],
          blockedReasons: [],
          agents: {},
          runtimeFailure: null,
        },
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      getWorkerInstance()!.emit("message", {
        kind: "run.error",
        runId,
        timestamp: new Date().toISOString(),
        error: {
          code: "TOOL_ERROR",
          message: "Tool execution failed",
        },
      });

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      const snapshot = savedCall?.policyResolutionSnapshot as Record<string, unknown> | undefined;
      expect(snapshot?.runtimeFailure).not.toBeNull();
      expect((snapshot?.runtimeFailure as Record<string, unknown>)?.message).toBe(
        "Tool execution failed",
      );
    });
  });

  // -----------------------------------------------------------------------
  // Worker "error" event (unhandled Worker exception)
  // -----------------------------------------------------------------------

  describe("Worker 'error' event — WORKER_CRASH", () => {
    it("marks the run as failed with WORKER_CRASH when the worker throws", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        status: "running",
        policyResolutionSnapshot: null,
      } as Record<string, unknown>;

      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      getWorkerInstance()!.emit("error", new Error("segmentation fault"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const { saveRun } = await import("../../persistence/run-store.js");
      const savedCall = (saveRun as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
      expect(savedCall?.status).toBe("failed");
      expect((savedCall?.error as Record<string, unknown>)?.code).toBe("WORKER_CRASH");
      expect((savedCall?.error as Record<string, unknown>)?.message).toBe("segmentation fault");
    });

    it("broadcasts a run.error event with WORKER_CRASH code", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      const existingRecord = {
        ...getSavedRun(runId),
        status: "running",
        policyResolutionSnapshot: null,
      };
      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      mockWebContents.send.mockClear();

      getWorkerInstance()!.emit("error", new Error("Out of memory"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const crashBroadcast = mockWebContents.send.mock.calls.find(
        (call) =>
          call[1] != null &&
          typeof call[1] === "object" &&
          (call[1] as Record<string, unknown>).kind === "run.error" &&
          ((call[1] as Record<string, unknown>).error as Record<string, unknown>)?.code ===
            "WORKER_CRASH",
      );
      expect(crashBroadcast).toBeDefined();
    });

    it("does not overwrite a terminal status with WORKER_CRASH", async () => {
      const { runId } = await callHandler(IPC_CHANNELS.CREW_START_RUN, {
        repoPath: "/projects/my-app",
      }) as { runId: string };

      // Simulate the run is already in a terminal state
      const existingRecord = {
        ...getSavedRun(runId),
        status: "completed",
        policyResolutionSnapshot: null,
      };
      const { getRun } = await import("../../persistence/run-store.js");
      (getRun as Mock).mockResolvedValueOnce(existingRecord);

      const { saveRun } = await import("../../persistence/run-store.js");
      const saveCallsBefore = (saveRun as Mock).mock.calls.length;

      getWorkerInstance()!.emit("error", new Error("late crash"));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      // saveRun must NOT have been called for an already-terminal run
      expect((saveRun as Mock).mock.calls.length).toBe(saveCallsBefore);
    });
  });
});
