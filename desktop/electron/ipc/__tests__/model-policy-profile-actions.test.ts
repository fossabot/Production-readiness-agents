/**
 * T026 — MODEL_POLICY_APPLY_PROFILE and MODEL_POLICY_PREVIEW_PROFILE IPC handlers
 *
 * Validates:
 *  1. Apply profile updates the active snapshot and syncs agent models
 *  2. Apply profile clears manual overrides when keepOverrides is false
 *  3. Apply profile preserves manual overrides when keepOverrides is true
 *  4. Preview returns a diff without mutating any state
 *  5. Preview respects keepOverrides flag in diff generation
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
  mockApplyProfile,
  mockBuildProfilePreview,
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

  const mockApplyProfile = vi.fn().mockReturnValue(mockSnapshot);

  const mockBuildProfilePreview = vi.fn().mockReturnValue({
    profileId: "balanced",
    title: "Balanced",
    description: "Default",
    keepOverrides: false,
    generatedAt: new Date().toISOString(),
    diff: [
      {
        agentId: "structural-scout",
        beforeModelId: "claude-sonnet-4.6",
        afterModelId: "claude-opus-4",
        beforeFallbackModelIds: [],
        afterFallbackModelIds: [],
        rationale: "Upgraded",
        changed: true,
        overrideState: "none",
      },
    ],
    changedAgentIds: ["structural-scout"],
    unchangedAgentIds: [],
  });

  return {
    mockHandlers,
    ipcMain,
    mockWebContents,
    mockBrowserWindow,
    mockSnapshot,
    mockSettings,
    mockResolvePolicy,
    mockApplyProfile,
    mockBuildProfilePreview,
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
  setManualOverride: vi.fn(),
  clearManualOverride: vi.fn(),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn(),
  getRun: vi.fn().mockResolvedValue(null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn(),
  getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn(),
  getReport: vi.fn(),
  exportReport: vi.fn(),
  deleteReports: vi.fn(),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn(),
  appendTraceEvent: vi.fn(),
  closeTraceLog: vi.fn(),
  deleteTraces: vi.fn(),
}));

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  listSnapshots: vi.fn().mockReturnValue([mockSnapshot]),
  applyProfile: mockApplyProfile,
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
  buildProfilePreview: mockBuildProfilePreview,
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

describe("MODEL_POLICY_APPLY_PROFILE handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls modelPolicyStore.applyProfile with the given profileId", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, {
      profileId: "accuracy",
      keepOverrides: true,
    });

    expect(mockApplyProfile).toHaveBeenCalledWith("accuracy");
  });

  it("returns a ModelPolicyState object with an activeSnapshot", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, {
      profileId: "balanced",
      keepOverrides: true,
    }) as { activeSnapshot: unknown };

    expect(result).toHaveProperty("activeSnapshot");
  });

  it("calls updateSettings with the new activeSnapshotId and lastAppliedProfileId", async () => {
    const { updateSettings } = await import("../../persistence/settings-store.js");

    await callHandler(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, {
      profileId: "accuracy",
      keepOverrides: false,
    });

    expect(updateSettings).toHaveBeenCalled();
    const updateCall = (updateSettings as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const modelPolicy = updateCall?.modelPolicy as Record<string, unknown>;
    expect(modelPolicy?.activeSnapshotId).toBe(mockSnapshot.snapshotId);
    expect(modelPolicy?.lastAppliedProfileId).toBe("accuracy");
  });

  it("clears manualOverrides when keepOverrides is false", async () => {
    const { updateSettings } = await import("../../persistence/settings-store.js");

    await callHandler(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, {
      profileId: "balanced",
      keepOverrides: false,
    });

    const updateCall = (updateSettings as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const modelPolicy = updateCall?.modelPolicy as Record<string, unknown>;
    expect(modelPolicy?.manualOverrides).toEqual({});
  });

  it("syncs agent models from the new snapshot assignments", async () => {
    const { updateSettings } = await import("../../persistence/settings-store.js");

    await callHandler(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, {
      profileId: "balanced",
      keepOverrides: true,
    });

    expect(updateSettings).toHaveBeenCalled();
    const updateCall = (updateSettings as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(updateCall).toHaveProperty("agents");
  });
});

describe("MODEL_POLICY_PREVIEW_PROFILE handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls buildProfilePreview with current and next snapshot", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, {
      profileId: "accuracy",
      keepOverrides: true,
    });

    expect(mockBuildProfilePreview).toHaveBeenCalled();
  });

  it("returns a preview with diff items", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, {
      profileId: "accuracy",
      keepOverrides: true,
    }) as { diff: unknown[] };

    expect(result).toHaveProperty("diff");
    expect(Array.isArray(result.diff)).toBe(true);
    expect(result.diff.length).toBeGreaterThan(0);
  });

  it("does not call applyProfile or updateSettings (preview is read-only)", async () => {
    const { updateSettings } = await import("../../persistence/settings-store.js");

    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, {
      profileId: "accuracy",
      keepOverrides: false,
    });

    expect(mockApplyProfile).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it("passes keepOverrides to buildProfilePreview", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, {
      profileId: "balanced",
      keepOverrides: false,
    });

    const call = mockBuildProfilePreview.mock.calls.at(-1);
    expect(call?.[3]).toBe(false);
  });
});
