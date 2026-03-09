/**
 * T058 — Concurrent-run prevention coverage [FR-017]
 *
 * Two distinct describe blocks:
 *
 * 1. "CREW_START_RUN concurrent-run prevention" — IPC handler tests that
 *    verify the `activeWorker` guard in handlers.ts rejects duplicate starts
 *    and permits new runs after the previous one reaches a terminal state.
 *
 * 2. "getActiveRun()" — unit tests for the persistence helper that scans
 *    the runs directory for records whose status is "queued", "starting",
 *    or "running".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MockedFunction } from "vitest";
import type { IpcMain } from "electron";

// ---------------------------------------------------------------------------
// Stable vi.fn() handles for node:fs — defined at module scope so the same
// references are returned every time the mock factory runs (even after
// vi.resetModules).  Individual tests mutate these via mockResolvedValue /
// mockImplementation.
// ---------------------------------------------------------------------------

const fsMkdir = vi.fn().mockResolvedValue(undefined);
const fsReaddir = vi.fn().mockResolvedValue([]);
const fsReadFile = vi.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
const fsWriteFile = vi.fn().mockResolvedValue(undefined);
const fsRename = vi.fn().mockResolvedValue(undefined);
const fsUnlink = vi.fn().mockResolvedValue(undefined);
const fsMkdirSync = vi.fn();
const fsWriteFileSync = vi.fn();
const fsReadFileSync = vi.fn().mockReturnValue("{}");
const fsReaddirSync = vi.fn().mockReturnValue([]);
const fsExistsSync = vi.fn().mockReturnValue(false);
const fsCreateWriteStream = vi.fn().mockReturnValue({ write: vi.fn(), end: vi.fn() });

vi.mock("node:fs", () => ({
  promises: {
    mkdir: fsMkdir,
    readdir: fsReaddir,
    readFile: fsReadFile,
    writeFile: fsWriteFile,
    rename: fsRename,
    unlink: fsUnlink,
  },
  mkdirSync: fsMkdirSync,
  writeFileSync: fsWriteFileSync,
  readFileSync: fsReadFileSync,
  readdirSync: fsReaddirSync,
  existsSync: fsExistsSync,
  createWriteStream: fsCreateWriteStream,
}));

// ---------------------------------------------------------------------------
// Electron mock
// ---------------------------------------------------------------------------

const mockIpcMainHandlers: Map<string, (...args: unknown[]) => Promise<unknown>> = new Map();
const mockGetAllWindows = vi.fn(() => []);

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      mockIpcMainHandlers.set(channel, handler);
    }),
  } satisfies Partial<IpcMain>,
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

// ---------------------------------------------------------------------------
// Worker mock
// ---------------------------------------------------------------------------

type WorkerEventMap = Record<string, Array<(...args: unknown[]) => void>>;

interface MockWorkerInstance {
  on: MockedFunction<(event: string, listener: (...args: unknown[]) => void) => MockWorkerInstance>;
  postMessage: MockedFunction<(value: unknown) => void>;
  terminate: MockedFunction<() => void>;
  _listeners: WorkerEventMap;
  _emit: (event: string, ...args: unknown[]) => void;
}

function createMockWorker(): MockWorkerInstance {
  const listeners: WorkerEventMap = {};
  const worker: MockWorkerInstance = {
    _listeners: listeners,
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(listener);
      return worker;
    }),
    postMessage: vi.fn(),
    terminate: vi.fn(),
    _emit(event: string, ...args: unknown[]) {
      for (const listener of listeners[event] ?? []) {
        listener(...args);
      }
    },
  };
  return worker;
}

let currentMockWorker: MockWorkerInstance | null = null;

vi.mock("node:worker_threads", () => ({
  Worker: vi.fn().mockImplementation(() => {
    currentMockWorker = createMockWorker();
    return currentMockWorker;
  }),
}));

// ---------------------------------------------------------------------------
// Crypto mock
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => `test-uuid-${(uuidCounter += 1)}`),
}));

// ---------------------------------------------------------------------------
// Path mock
// ---------------------------------------------------------------------------

vi.mock("node:path", () => ({
  default: {
    join: (...parts: string[]) => parts.join("/"),
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
  },
}));

// ---------------------------------------------------------------------------
// Store mocks — paths are relative to THIS test file.
// Test file:  electron/ipc/__tests__/crew-start-run-concurrency.test.ts
// Stores at:  electron/persistence/...   → "../../persistence/..."
// ---------------------------------------------------------------------------

const mockSaveRun = vi.fn().mockResolvedValue(undefined);
const mockGetRun = vi.fn().mockResolvedValue(null);
const mockListRuns = vi.fn().mockResolvedValue({ runs: [], total: 0 });
const mockDeleteRun = vi.fn().mockResolvedValue(true);
const mockGetActiveRun = vi.fn().mockResolvedValue(null);

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: mockSaveRun,
  getRun: mockGetRun,
  listRuns: mockListRuns,
  deleteRun: mockDeleteRun,
  getActiveRun: mockGetActiveRun,
}));

const mockGetSettings = vi.fn();
const mockUpdateSettings = vi.fn();
const mockResetSettings = vi.fn();
const mockSetManualOverride = vi.fn();
const mockClearManualOverride = vi.fn();

vi.mock("../../persistence/settings-store.js", () => ({
  getSettings: mockGetSettings,
  updateSettings: mockUpdateSettings,
  resetSettings: mockResetSettings,
  setManualOverride: mockSetManualOverride,
  clearManualOverride: mockClearManualOverride,
}));

const mockGetActiveSnapshot = vi.fn();
const mockListSnapshots = vi.fn().mockReturnValue([]);
const mockApplyProfile = vi.fn();
const mockPublishActiveSnapshot = vi.fn();

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: mockGetActiveSnapshot,
  listSnapshots: mockListSnapshots,
  applyProfile: mockApplyProfile,
  publishActiveSnapshot: mockPublishActiveSnapshot,
  bootstrapActiveSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  activateSnapshot: vi.fn(),
}));

const mockSaveReport = vi.fn().mockResolvedValue("/mock/report.md");
const mockGetReport = vi.fn().mockResolvedValue(null);
const mockDeleteReports = vi.fn().mockResolvedValue(undefined);
const mockExportReport = vi.fn().mockResolvedValue({ success: true, path: "/mock/export.md" });

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: mockSaveReport,
  getReport: mockGetReport,
  deleteReports: mockDeleteReports,
  exportReport: mockExportReport,
}));

const mockOpenTraceLog = vi.fn().mockResolvedValue("/mock/traces/run.jsonl");
const mockAppendTraceEvent = vi.fn();
const mockCloseTraceLog = vi.fn();
const mockDeleteTraces = vi.fn().mockResolvedValue(undefined);

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: mockOpenTraceLog,
  appendTraceEvent: mockAppendTraceEvent,
  closeTraceLog: mockCloseTraceLog,
  deleteTraces: mockDeleteTraces,
}));

// ---------------------------------------------------------------------------
// Policy mocks — "../../policy/..."
// ---------------------------------------------------------------------------

const MOCK_SNAPSHOT_ID = "policy-balanced-test";

const mockSnapshot = {
  snapshotId: MOCK_SNAPSHOT_ID,
  title: "Balanced (Test)",
  description: "Test snapshot",
  profileId: "balanced" as const,
  status: "active" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  publishedAt: null,
  reviewByDate: "2026-12-01T00:00:00.000Z",
  reviewer: null,
  approvalNotes: null,
  sourceLinks: [],
  supersedesSnapshotId: null,
  supersededBySnapshotId: null,
  assignments: {
    "structural-scout": { agentId: "structural-scout" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "wide-context" as const, requiresTools: true },
    "code-performance-auditor": { agentId: "code-performance-auditor" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "coding" as const, requiresTools: true },
    "security-resilience-auditor": { agentId: "security-resilience-auditor" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "sensitive" as const, requiresTools: true },
    "testing-auditor": { agentId: "testing-auditor" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "coding" as const, requiresTools: true },
    "infrastructure-auditor": { agentId: "infrastructure-auditor" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "analysis" as const, requiresTools: true },
    "docs-compliance-auditor": { agentId: "docs-compliance-auditor" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "wide-context" as const, requiresTools: true },
    "runtime-verifier": { agentId: "runtime-verifier" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "coding" as const, requiresTools: true },
    "report-synthesizer": { agentId: "report-synthesizer" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "high" as const, role: "synthesis" as const, requiresTools: true },
    "general-purpose": { agentId: "general-purpose" as const, primaryModelId: "claude-sonnet-4.6", fallbackModelIds: [], rationale: "test", confidence: "medium" as const, role: "general" as const, requiresTools: true },
  },
};

const mockResolvePolicyOutput = {
  resolvedModels: {
    "structural-scout": "claude-sonnet-4.6",
    "code-performance-auditor": "claude-sonnet-4.6",
    "security-resilience-auditor": "claude-sonnet-4.6",
    "testing-auditor": "claude-sonnet-4.6",
    "infrastructure-auditor": "claude-sonnet-4.6",
    "docs-compliance-auditor": "claude-sonnet-4.6",
    "runtime-verifier": "claude-sonnet-4.6",
    "report-synthesizer": "claude-sonnet-4.6",
  },
  snapshot: {
    snapshotId: MOCK_SNAPSHOT_ID,
    profileId: "balanced" as const,
    title: "Balanced (Test)",
    resolvedAt: "2026-01-01T00:00:00.000Z",
    reviewByDate: "2026-12-01T00:00:00.000Z",
    warnings: [],
    blockedReasons: [] as unknown[],
    agents: {},
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
const mockGetReviewStatus = vi.fn().mockReturnValue("fresh");

vi.mock("../../policy/resolver.js", () => ({
  resolvePolicy: mockResolvePolicy,
  getReviewStatus: mockGetReviewStatus,
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
  buildProfilePreview: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeDefaultSettings() {
  return {
    schemaVersion: 2,
    agents: {
      "structural-scout": { agentId: "structural-scout", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "code-performance-auditor": { agentId: "code-performance-auditor", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "security-resilience-auditor": { agentId: "security-resilience-auditor", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "testing-auditor": { agentId: "testing-auditor", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "infrastructure-auditor": { agentId: "infrastructure-auditor", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "docs-compliance-auditor": { agentId: "docs-compliance-auditor", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "runtime-verifier": { agentId: "runtime-verifier", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
      "report-synthesizer": { agentId: "report-synthesizer", enabled: true, model: "claude-sonnet-4.6", enabledTools: [], enabledSkills: [] },
    },
    models: [
      {
        id: "claude-sonnet-4.6",
        provider: "anthropic",
        displayName: "Claude Sonnet 4.6",
        contextWindowTokens: 200000,
        supportsTools: true,
        supportsLongContext: true,
        supportsCode: true,
        supportsSensitiveWorkloads: true,
        recommendedRoles: ["analysis"],
        credentialKey: "ANTHROPIC_API_KEY",
        releasedAt: "2026-01-01T00:00:00.000Z",
        lastReviewedAt: "2026-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isPreview: false,
        isDefault: true,
      },
    ],
    secrets: { storageBackend: "electron-safeStorage" as const, configuredKeys: ["ANTHROPIC_API_KEY"] },
    runtime: {
      maxRunDurationMs: 0,
      agentTimeoutMs: 300_000,
      maxConcurrency: 5,
      enableTracing: false,
      persistRawTraces: false,
      allowNetworkTools: true,
      autoOpenReportOnCompletion: false,
    },
    ui: { theme: "system" as const, language: "ar" as const, showRawTraces: false, defaultReportExportPath: null },
    modelPolicy: {
      activeSnapshotId: MOCK_SNAPSHOT_ID,
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
}

async function invokeHandler(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = mockIpcMainHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return handler({} /* _event */, ...args);
}

/** Flush all queued microtasks so async message handlers finish. */
async function flushMicrotasks(ticks = 10): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Describe 1 — IPC handler: concurrent-run prevention [FR-017]
//
// Each test re-registers IPC handlers from a fresh module so that the
// module-level `activeWorker` variable resets to null between tests.
// ---------------------------------------------------------------------------

describe("CREW_START_RUN concurrent-run prevention [FR-017]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    uuidCounter = 0;
    currentMockWorker = null;
    mockIpcMainHandlers.clear();

    mockGetSettings.mockReturnValue(makeDefaultSettings());
    mockGetActiveSnapshot.mockReturnValue(mockSnapshot);
    mockListSnapshots.mockReturnValue([mockSnapshot]);
    mockGetActiveRun.mockResolvedValue(null);

    // Reset mutable preflight fields.
    mockResolvePolicyOutput.preflight.canRun = true;
    mockResolvePolicyOutput.preflight.blockedReasons = [];
    mockResolvePolicyOutput.snapshot.blockedReasons = [];
    mockResolvePolicy.mockReturnValue(mockResolvePolicyOutput);

    mockSaveRun.mockResolvedValue(undefined);
    mockGetRun.mockResolvedValue(null);

    // Re-register handlers from a fresh module instance so that the
    // module-level activeWorker/activeRunId state starts as null.
    vi.resetModules();
    const { registerIpcHandlers } = await import("../handlers.js");
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("throws when a second run is started while the first is still active", async () => {
    // Start the first run successfully.
    const firstResult = await invokeHandler("crew:start-run", { repoPath: "/repo/alpha" });
    expect(firstResult).toMatchObject({ runId: expect.any(String) });
    expect(currentMockWorker).not.toBeNull();

    // While the worker is active, any further start must throw.
    await expect(
      invokeHandler("crew:start-run", { repoPath: "/repo/beta" }),
    ).rejects.toThrow();
  });

  it("error message indicates a run is already in progress", async () => {
    await invokeHandler("crew:start-run", { repoPath: "/repo/alpha" });

    let thrownError: Error | null = null;
    try {
      await invokeHandler("crew:start-run", { repoPath: "/repo/beta" });
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    // The guard message contains "already in progress" regardless of whether
    // the prefix is "RUN_ALREADY_ACTIVE:" or not.
    expect(thrownError?.message).toMatch(/already in progress/i);
  });

  it("allows a new run after the previous run completes", async () => {
    const firstResult = await invokeHandler("crew:start-run", { repoPath: "/repo/alpha" }) as { runId: string };
    const firstRunId = firstResult.runId;
    const firstWorker = currentMockWorker!;

    // Provide a run record so the message handler's getRun call succeeds.
    const runRecord = {
      runId: firstRunId,
      repoPath: "/repo/alpha",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastUpdatedAt: new Date().toISOString(),
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };
    mockGetRun.mockResolvedValue(runRecord);

    // Emit the terminal lifecycle event — this triggers cleanupWorker() inside
    // the handlers module, which sets activeWorker back to null.
    firstWorker._emit("message", {
      kind: "run.lifecycle",
      runId: firstRunId,
      timestamp: new Date().toISOString(),
      phase: "completed",
    });

    // Drain the async handler: the message listener calls await getRun()
    // before calling cleanupWorker(), so we need multiple microtask ticks.
    await flushMicrotasks();

    // activeWorker is null; a new run must be accepted.
    const secondResult = await invokeHandler("crew:start-run", { repoPath: "/repo/beta" });
    expect(secondResult).toMatchObject({ runId: expect.any(String) });
  });

  it("allows a new run after the previous run fails", async () => {
    const firstResult = await invokeHandler("crew:start-run", { repoPath: "/repo/alpha" }) as { runId: string };
    const firstRunId = firstResult.runId;
    const firstWorker = currentMockWorker!;

    mockGetRun.mockResolvedValue({
      runId: firstRunId,
      repoPath: "/repo/alpha",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastUpdatedAt: new Date().toISOString(),
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    });

    firstWorker._emit("message", {
      kind: "run.lifecycle",
      runId: firstRunId,
      timestamp: new Date().toISOString(),
      phase: "failed",
    });

    await flushMicrotasks();

    const secondResult = await invokeHandler("crew:start-run", { repoPath: "/repo/beta" });
    expect(secondResult).toMatchObject({ runId: expect.any(String) });
  });

  it("allows a new run after the previous run is cancelled", async () => {
    const firstResult = await invokeHandler("crew:start-run", { repoPath: "/repo/alpha" }) as { runId: string };
    const firstRunId = firstResult.runId;
    const firstWorker = currentMockWorker!;

    mockGetRun.mockResolvedValue({
      runId: firstRunId,
      repoPath: "/repo/alpha",
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastUpdatedAt: new Date().toISOString(),
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    });

    firstWorker._emit("message", {
      kind: "run.lifecycle",
      runId: firstRunId,
      timestamp: new Date().toISOString(),
      phase: "cancelled",
    });

    await flushMicrotasks();

    const secondResult = await invokeHandler("crew:start-run", { repoPath: "/repo/beta" });
    expect(secondResult).toMatchObject({ runId: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// Describe 2 — getActiveRun() unit tests
//
// These tests exercise run-store.getActiveRun() directly.  They use the
// stable fs mock handles defined at module scope to control what the
// filesystem "returns" for each scenario.
//
// No vi.resetModules() is used here — the run-store module is imported once
// at the top of each test via dynamic import.  The stable fs mock handles
// ensure consistent mock identity.
// ---------------------------------------------------------------------------

describe("getActiveRun()", () => {
  beforeEach(() => {
    // Reset all stable fs mock call history and implementations.
    vi.clearAllMocks();
    fsReaddir.mockResolvedValue([]);
    fsReadFile.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    fsMkdir.mockResolvedValue(undefined);
  });

  it("returns null when no run files exist in the runs directory", async () => {
    fsReaddir.mockResolvedValue([]);

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).toBeNull();
  });

  it("returns null when all existing runs have a terminal status", async () => {
    const completedRun = {
      runId: "run-completed",
      repoPath: "/repo",
      status: "completed",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T01:00:00.000Z",
      lastUpdatedAt: "2026-01-01T01:00:00.000Z",
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: 3600000,
    };

    fsReaddir.mockResolvedValue(["run-completed.json"]);
    fsReadFile.mockResolvedValue(JSON.stringify(completedRun));

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).toBeNull();
  });

  it("returns the run record when a run with status 'running' exists", async () => {
    const runningRecord = {
      runId: "run-running-123",
      repoPath: "/repo/live",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      lastUpdatedAt: "2026-01-01T00:05:00.000Z",
      selectedAgents: ["structural-scout"],
      modelConfigSnapshot: { "structural-scout": "claude-sonnet-4.6" },
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };

    fsReaddir.mockResolvedValue(["run-running-123.json"]);
    fsReadFile.mockResolvedValue(JSON.stringify(runningRecord));

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-running-123");
    expect(result?.status).toBe("running");
  });

  it("returns the run record when a run with status 'queued' exists", async () => {
    const queuedRecord = {
      runId: "run-queued-456",
      repoPath: "/repo/pending",
      status: "queued",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      lastUpdatedAt: "2026-01-01T00:00:01.000Z",
      selectedAgents: ["structural-scout"],
      modelConfigSnapshot: { "structural-scout": "claude-sonnet-4.6" },
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };

    fsReaddir.mockResolvedValue(["run-queued-456.json"]);
    fsReadFile.mockResolvedValue(JSON.stringify(queuedRecord));

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-queued-456");
    expect(result?.status).toBe("queued");
  });

  it("returns the run record when a run with status 'starting' exists", async () => {
    const startingRecord = {
      runId: "run-starting-789",
      repoPath: "/repo/booting",
      status: "starting",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      lastUpdatedAt: "2026-01-01T00:00:02.000Z",
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };

    fsReaddir.mockResolvedValue(["run-starting-789.json"]);
    fsReadFile.mockResolvedValue(JSON.stringify(startingRecord));

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-starting-789");
    expect(result?.status).toBe("starting");
  });

  it("skips non-JSON files and returns null when no active run exists among them", async () => {
    // Only non-JSON entries — readFile must never be called.
    fsReaddir.mockResolvedValue(["README.txt", ".DS_Store", "somefile"]);

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    expect(result).toBeNull();
    expect(fsReadFile).not.toHaveBeenCalled();
  });

  it("skips corrupted run files without throwing and continues scanning", async () => {
    const validRunningRecord = {
      runId: "run-valid-running",
      repoPath: "/repo/valid",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: null,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };

    fsReaddir.mockResolvedValue(["corrupted.json", "run-valid-running.json"]);
    fsReadFile.mockImplementation(async (p: unknown) => {
      if (typeof p === "string" && p.includes("corrupted")) {
        return "{ INVALID JSON {{";
      }
      return JSON.stringify(validRunningRecord);
    });

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    // The corrupted file is silently skipped; the valid running record is returned.
    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-valid-running");
  });

  it("returns first active run found when multiple run files coexist", async () => {
    const completedRecord = {
      runId: "run-old-completed",
      repoPath: "/repo/old",
      status: "completed",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T01:00:00.000Z",
      lastUpdatedAt: "2026-01-01T01:00:00.000Z",
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: 3600000,
    };

    const queuedRecord = {
      runId: "run-new-queued",
      repoPath: "/repo/new",
      status: "queued",
      startedAt: "2026-01-02T00:00:00.000Z",
      finishedAt: null,
      lastUpdatedAt: "2026-01-02T00:00:00.000Z",
      selectedAgents: [],
      modelConfigSnapshot: {},
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: null,
      error: null,
      durationMs: null,
    };

    fsReaddir.mockResolvedValue(["run-old-completed.json", "run-new-queued.json"]);
    fsReadFile.mockImplementation(async (p: unknown) => {
      if (typeof p === "string" && p.includes("run-old-completed")) {
        return JSON.stringify(completedRecord);
      }
      return JSON.stringify(queuedRecord);
    });

    const { getActiveRun } = await vi.importActual<typeof import("../../persistence/run-store.js")>("../../persistence/run-store.js");
    const result = await getActiveRun();

    // The queued run is active; the completed one is not.
    expect(result).not.toBeNull();
    expect(result?.runId).toBe("run-new-queued");
    expect(result?.status).toBe("queued");
  });
});
