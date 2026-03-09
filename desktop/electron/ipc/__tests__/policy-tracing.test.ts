/**
 * T027 — Policy event tracing during CREW_START_RUN
 *
 * Validates:
 *  1. Emits policy:resolved trace for agents with a normal resolution
 *  2. Emits policy:fallback trace when a fallback model is used
 *  3. Emits policy:blocked trace for blocked agents
 *  4. Persists trace events via traceStore when persistRawTraces is true
 *  5. Does not persist trace events when persistRawTraces is false
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { EventEmitter } from "node:events";

// ---------------------------------------------------------------------------
// Hoisted state
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
  mockAppendTraceEvent,
  mockSnapshot,
  mockSettings,
} = vi.hoisted(() => {
  const { EventEmitter: HoistedEventEmitter } = require("node:events") as { EventEmitter: typeof import("node:events").EventEmitter };

  const mockHandlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
      mockHandlers.set(channel, handler);
    }),
  };

  const mockWebContents = { send: vi.fn() };
  const mockBrowserWindow = { webContents: mockWebContents };
  const storedRuns = new Map<string, object>();

  let _workerInstance: InstanceType<typeof MockWorker> | null = null;

  class MockWorker extends HoistedEventEmitter {
    postMessage = vi.fn();
    terminate = vi.fn();
  }

  function getWorkerInstance() { return _workerInstance; }
  function setWorkerInstance(w: InstanceType<typeof MockWorker> | null) { _workerInstance = w; }

  const mockSnapshot = {
    snapshotId: "snap-1",
    title: "Balanced",
    description: "Default",
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
    },
  };

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
    ui: { theme: "system" as const, language: "ar" as const, showRawTraces: false, defaultReportExportPath: null },
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

  function makeAgentSnapshot(
    selectedSource: "policy" | "fallback" | "override-fallback" | "blocked",
    options: { effectiveModelId?: string | null; blockedReason?: { message: string } | null; overrideModelId?: string | null } = {},
  ) {
    return {
      agentId: "structural-scout",
      recommendedModelId: "claude-sonnet-4.6",
      effectiveModelId: options.effectiveModelId ?? (selectedSource === "blocked" ? null : "claude-sonnet-4.6"),
      effectiveFallbackModelIds: [],
      selectedSource,
      fallbackUsed: selectedSource === "fallback" || selectedSource === "override-fallback",
      overrideModelId: options.overrideModelId ?? null,
      blockedReason: options.blockedReason ?? null,
      validationNotes: selectedSource !== "policy" ? ["Validation note"] : [],
      rationale: "Default",
      confidence: "high" as const,
      reviewByDate: "2099-01-01T00:00:00.000Z",
    };
  }

  const mockResolvePolicy = vi.fn().mockReturnValue({
    resolvedModels: { "structural-scout": "claude-sonnet-4.6" },
    snapshot: {
      snapshotId: "snap-1",
      profileId: "balanced",
      title: "Balanced",
      resolvedAt: new Date().toISOString(),
      reviewByDate: "2099-01-01T00:00:00.000Z",
      warnings: [],
      blockedReasons: [],
      agents: {
        "structural-scout": makeAgentSnapshot("policy"),
      },
      runtimeFailure: null,
    },
    preflight: { canRun: true, warnings: [], blockedReasons: [], fallbackAgentIds: [] },
  });

  const mockAppendTraceEvent = vi.fn();

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
    mockAppendTraceEvent,
    mockSnapshot,
    mockSettings,
    makeAgentSnapshot,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("electron", () => ({
  ipcMain,
  dialog: { showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ["/path"] }) },
  BrowserWindow: { getAllWindows: vi.fn().mockReturnValue([mockBrowserWindow]) },
}));

vi.mock("node:worker_threads", () => ({
  Worker: vi.fn().mockImplementation(() => {
    const instance = new MockWorker();
    setWorkerInstance(instance);
    return instance;
  }),
}));

vi.mock("../../persistence/settings-store.js", () => ({
  getSettings: vi.fn().mockImplementation(() => mockSettings),
  updateSettings: vi.fn().mockImplementation((partial: unknown) => ({ ...mockSettings, ...(partial as object) })),
  resetSettings: vi.fn().mockReturnValue(mockSettings),
  setManualOverride: vi.fn(),
  clearManualOverride: vi.fn(),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn().mockImplementation(async (record: object & { runId: string }) => {
    storedRuns.set(record.runId, record);
  }),
  getRun: vi.fn().mockImplementation(async (runId: string) => storedRuns.get(runId) ?? null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn(),
  getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn(), getReport: vi.fn(), exportReport: vi.fn(), deleteReports: vi.fn(),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn().mockResolvedValue("/tmp/trace.jsonl"),
  appendTraceEvent: mockAppendTraceEvent,
  closeTraceLog: vi.fn(),
  deleteTraces: vi.fn(),
}));

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  listSnapshots: vi.fn().mockReturnValue([mockSnapshot]),
  applyProfile: vi.fn().mockReturnValue(mockSnapshot),
  publishActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  bootstrapActiveSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  activateSnapshot: vi.fn(),
}));

vi.mock("../../policy/catalog.js", () => ({
  BUILT_IN_PROFILES: [],
  buildSnapshotFromProfile: vi.fn().mockReturnValue(mockSnapshot),
  buildDefaultActiveSnapshot: vi.fn(),
  getBuiltInProfile: vi.fn(),
  getDefaultAgentModelIds: vi.fn(),
  MODEL_CATALOG: [],
  DEFAULT_POLICY_PROFILE_ID: "balanced",
}));

vi.mock("../../policy/diff.js", () => ({
  buildProfilePreview: vi.fn().mockReturnValue({
    profileId: "balanced", title: "Balanced", description: "Default",
    keepOverrides: false, generatedAt: new Date().toISOString(),
    diff: [], changedAgentIds: [], unchangedAgentIds: [],
  }),
}));

vi.mock("../../policy/resolver.js", () => ({
  resolvePolicy: mockResolvePolicy,
  getReviewStatus: vi.fn().mockReturnValue("fresh"),
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { IPC_CHANNELS, BROADCAST_CHANNELS } from "../channels.js";
import { registerIpcHandlers } from "../handlers.js";

async function callHandler(channel: string, input?: unknown): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) throw new Error(`No handler for "${channel}"`);
  return handler({}, input);
}

function findTraceBroadcasts(spanName: string) {
  return mockWebContents.send.mock.calls.filter(
    (call) =>
      call[0] === BROADCAST_CHANNELS.CREW_RUN_EVENT &&
      call[1] != null &&
      typeof call[1] === "object" &&
      (call[1] as Record<string, unknown>).kind === "trace.event" &&
      (call[1] as Record<string, unknown>).spanName === spanName,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Policy tracing during CREW_START_RUN", () => {
  beforeEach(async () => {
    const priorWorker = getWorkerInstance();
    if (priorWorker) {
      const firstRunId = [...storedRuns.keys()][0];
      if (firstRunId) {
        const { getRun } = await import("../../persistence/run-store.js");
        (getRun as Mock).mockResolvedValueOnce({ ...storedRuns.get(firstRunId), status: "running" });
        priorWorker.emit("message", {
          kind: "run.lifecycle", runId: firstRunId,
          timestamp: new Date().toISOString(), phase: "completed",
        });
        await new Promise<void>((r) => setTimeout(r, 10));
      }
    }

    mockHandlers.clear();
    storedRuns.clear();
    setWorkerInstance(null);
    mockAppendTraceEvent.mockClear();

    const { getActiveRun } = await import("../../persistence/run-store.js");
    (getActiveRun as Mock).mockResolvedValue(null);

    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("emits policy:resolved for agents resolved via primary model", async () => {
    const { makeAgentSnapshot } = await vi.hoisted(() => {
      return { makeAgentSnapshot: null };
    }) as any;
    // The default mockResolvePolicy already returns policy source for structural-scout

    mockWebContents.send.mockClear();

    await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/app" });

    const resolved = findTraceBroadcasts("policy:resolved");
    expect(resolved.length).toBeGreaterThanOrEqual(1);

    const tracePayload = resolved[0]![1] as Record<string, unknown>;
    const crewEvent = tracePayload.crewEvent as Record<string, unknown>;
    expect(crewEvent.type).toBe("policy:resolved");
    expect(crewEvent.agent).toBe("structural-scout");
  });

  it("emits policy:fallback when an agent uses a fallback model", async () => {
    mockResolvePolicy.mockReturnValueOnce({
      resolvedModels: { "structural-scout": "gpt-4o" },
      snapshot: {
        snapshotId: "snap-1",
        profileId: "balanced",
        title: "Balanced",
        resolvedAt: new Date().toISOString(),
        reviewByDate: "2099-01-01T00:00:00.000Z",
        warnings: [],
        blockedReasons: [],
        agents: {
          "structural-scout": {
            agentId: "structural-scout",
            recommendedModelId: "claude-sonnet-4.6",
            effectiveModelId: "gpt-4o",
            effectiveFallbackModelIds: ["gpt-4o"],
            selectedSource: "fallback",
            fallbackUsed: true,
            overrideModelId: null,
            blockedReason: null,
            validationNotes: ["Primary model unavailable"],
            rationale: "Default",
            confidence: "high",
            reviewByDate: "2099-01-01T00:00:00.000Z",
          },
        },
        runtimeFailure: null,
      },
      preflight: { canRun: true, warnings: [], blockedReasons: [], fallbackAgentIds: ["structural-scout"] },
    });

    mockWebContents.send.mockClear();

    await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/app" });

    const fallback = findTraceBroadcasts("policy:fallback");
    expect(fallback.length).toBeGreaterThanOrEqual(1);

    const crewEvent = (fallback[0]![1] as Record<string, unknown>).crewEvent as Record<string, unknown>;
    expect(crewEvent.type).toBe("policy:fallback");
    expect(crewEvent.agent).toBe("structural-scout");
  });

  it("emits policy:blocked for blocked agents and run fails", async () => {
    mockResolvePolicy.mockReturnValueOnce({
      resolvedModels: {},
      snapshot: {
        snapshotId: "snap-1",
        profileId: "balanced",
        title: "Balanced",
        resolvedAt: new Date().toISOString(),
        reviewByDate: "2099-01-01T00:00:00.000Z",
        warnings: [],
        blockedReasons: [{ agentId: "structural-scout", candidateModelId: null, code: "NO_VALID_MODEL", message: "No model" }],
        agents: {
          "structural-scout": {
            agentId: "structural-scout",
            recommendedModelId: "claude-sonnet-4.6",
            effectiveModelId: null,
            effectiveFallbackModelIds: [],
            selectedSource: "blocked",
            fallbackUsed: false,
            overrideModelId: null,
            blockedReason: { agentId: "structural-scout", candidateModelId: null, code: "NO_VALID_MODEL", message: "No model" },
            validationNotes: [],
            rationale: "Default",
            confidence: "high",
            reviewByDate: "2099-01-01T00:00:00.000Z",
          },
        },
        runtimeFailure: null,
      },
      preflight: {
        canRun: false,
        warnings: [],
        blockedReasons: [{ agentId: "structural-scout", candidateModelId: null, code: "NO_VALID_MODEL", message: "No model" }],
        fallbackAgentIds: [],
      },
    });

    mockWebContents.send.mockClear();

    await expect(
      callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/app" }),
    ).rejects.toThrow();

    const blocked = findTraceBroadcasts("policy:blocked");
    expect(blocked.length).toBeGreaterThanOrEqual(1);

    const crewEvent = (blocked[0]![1] as Record<string, unknown>).crewEvent as Record<string, unknown>;
    expect(crewEvent.type).toBe("policy:blocked");
    expect(crewEvent.agent).toBe("structural-scout");
  });

  it("persists trace events when persistRawTraces is true", async () => {
    // Temporarily make persistRawTraces true
    mockSettings.runtime.persistRawTraces = true;

    mockWebContents.send.mockClear();
    mockAppendTraceEvent.mockClear();

    await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/app" });

    expect(mockAppendTraceEvent).toHaveBeenCalled();

    // Restore
    mockSettings.runtime.persistRawTraces = false;
  });

  it("does not persist trace events when persistRawTraces is false", async () => {
    mockSettings.runtime.persistRawTraces = false;

    mockWebContents.send.mockClear();
    mockAppendTraceEvent.mockClear();

    await callHandler(IPC_CHANNELS.CREW_START_RUN, { repoPath: "/projects/app" });

    expect(mockAppendTraceEvent).not.toHaveBeenCalled();
  });
});
