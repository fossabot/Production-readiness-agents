/**
 * T026 — MODEL_POLICY_SET_OVERRIDE and MODEL_POLICY_CLEAR_OVERRIDE IPC handlers
 *
 * Validates:
 *  1. SET_OVERRIDE calls settingsStore.setManualOverride with correct args
 *  2. SET_OVERRIDE returns an updated ModelPolicyState
 *  3. CLEAR_OVERRIDE reverts agent model to the recommended assignment
 *  4. CLEAR_OVERRIDE calls settingsStore.clearManualOverride
 *  5. Both handlers return a freshly built PolicyState (re-resolved)
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted state
// ---------------------------------------------------------------------------

const {
  mockHandlers,
  ipcMain,
  mockWebContents,
  mockBrowserWindow,
  mockSnapshot,
  mockSettings,
  mockResolvePolicy,
  mockSetManualOverride,
  mockClearManualOverride,
} = vi.hoisted(() => {
  const mockHandlers = new Map<string, (event: unknown, input: unknown) => Promise<unknown>>();

  const ipcMain = {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
      mockHandlers.set(channel, handler);
    }),
  };

  const mockWebContents = { send: vi.fn() };
  const mockBrowserWindow = { webContents: mockWebContents };

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
      "code-performance-auditor": {
        agentId: "code-performance-auditor",
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
      agents: {},
      runtimeFailure: null,
    },
    preflight: { canRun: true, warnings: [], blockedReasons: [], fallbackAgentIds: [] },
  });

  const mockSetManualOverride = vi.fn();
  const mockClearManualOverride = vi.fn();

  return {
    mockHandlers,
    ipcMain,
    mockWebContents,
    mockBrowserWindow,
    mockSnapshot,
    mockSettings,
    mockResolvePolicy,
    mockSetManualOverride,
    mockClearManualOverride,
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
    const { EventEmitter } = require("node:events");
    const instance = new EventEmitter();
    instance.postMessage = vi.fn();
    instance.terminate = vi.fn();
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
  setManualOverride: mockSetManualOverride,
  clearManualOverride: mockClearManualOverride,
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn(),
  getRun: vi.fn().mockResolvedValue(null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn(),
  getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn(), getReport: vi.fn(), exportReport: vi.fn(), deleteReports: vi.fn(),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn(), appendTraceEvent: vi.fn(), closeTraceLog: vi.fn(), deleteTraces: vi.fn(),
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

import { IPC_CHANNELS } from "../channels.js";
import { registerIpcHandlers } from "../handlers.js";

async function callHandler(channel: string, input?: unknown): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) throw new Error(`No handler for "${channel}"`);
  return handler({}, input);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MODEL_POLICY_SET_OVERRIDE handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls settingsStore.setManualOverride with agentId, modelId, and note", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, {
      agentId: "structural-scout",
      modelId: "gpt-4o",
      note: "testing override",
    });

    expect(mockSetManualOverride).toHaveBeenCalledWith(
      "structural-scout",
      "gpt-4o",
      "testing override",
    );
  });

  it("passes null for note when no note is provided", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, {
      agentId: "structural-scout",
      modelId: "gpt-4o",
    });

    expect(mockSetManualOverride).toHaveBeenCalledWith(
      "structural-scout",
      "gpt-4o",
      null,
    );
  });

  it("returns an object with activeSnapshot and preflight properties", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, {
      agentId: "structural-scout",
      modelId: "gpt-4o",
    }) as Record<string, unknown>;

    expect(result).toHaveProperty("activeSnapshot");
    expect(result).toHaveProperty("preflight");
  });

  it("calls resolvePolicy to rebuild the state after the override", async () => {
    mockResolvePolicy.mockClear();

    await callHandler(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, {
      agentId: "code-performance-auditor",
      modelId: "gpt-4o",
    });

    expect(mockResolvePolicy).toHaveBeenCalled();
  });
});

describe("MODEL_POLICY_CLEAR_OVERRIDE handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls settingsStore.clearManualOverride with the agentId", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, {
      agentId: "structural-scout",
    });

    expect(mockClearManualOverride).toHaveBeenCalledWith(
      "structural-scout",
      "claude-sonnet-4.6",
    );
  });

  it("reverts to the recommended primaryModelId from the snapshot assignment", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, {
      agentId: "structural-scout",
    });

    // The second argument to clearManualOverride is the recommended model
    const revertModelId = mockClearManualOverride.mock.calls[0]?.[1];
    expect(revertModelId).toBe(mockSnapshot.assignments["structural-scout"].primaryModelId);
  });

  it("returns an object with activeSnapshot after clearing", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, {
      agentId: "structural-scout",
    }) as Record<string, unknown>;

    expect(result).toHaveProperty("activeSnapshot");
  });

  it("calls resolvePolicy to rebuild state after clearing the override", async () => {
    mockResolvePolicy.mockClear();

    await callHandler(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, {
      agentId: "structural-scout",
    });

    expect(mockResolvePolicy).toHaveBeenCalled();
  });

  it("reads the correct assignment for code-performance-auditor", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, {
      agentId: "code-performance-auditor",
    });

    expect(mockClearManualOverride).toHaveBeenCalledWith(
      "code-performance-auditor",
      "claude-sonnet-4.6",
    );
  });
});
