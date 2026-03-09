/**
 * T027 — MODEL_POLICY_GET_STATE and MODEL_POLICY_LIST_SNAPSHOTS handlers
 *
 * Validates:
 *  1. GET_STATE returns a complete ModelPolicyState object
 *  2. GET_STATE includes preflight results with canRun and blockedReasons
 *  3. GET_STATE includes agentViews with all required fields
 *  4. LIST_SNAPSHOTS returns all snapshots from the store
 *  5. State includes profiles, constraints, and manualOverrides
 *  6. agentViews include reviewStatus, effectiveSource, and constraints
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
  mockArchivedSnapshot,
  mockSettings,
  mockResolvePolicy,
  mockListSnapshots,
  mockProfiles,
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
        fallbackModelIds: ["gpt-4o"],
        rationale: "Default analysis model",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: false,
      },
      "code-performance-auditor": {
        agentId: "code-performance-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Default coding model",
        confidence: "high" as const,
        role: "coding" as const,
        requiresTools: false,
      },
    },
  };

  const mockArchivedSnapshot = {
    ...mockSnapshot,
    snapshotId: "snap-0",
    status: "archived" as const,
    title: "Old Balanced",
    createdAt: "2025-06-01T00:00:00.000Z",
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
    resolvedModels: {
      "structural-scout": "claude-sonnet-4.6",
      "code-performance-auditor": "claude-sonnet-4.6",
    },
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
          effectiveModelId: "claude-sonnet-4.6",
          effectiveFallbackModelIds: ["gpt-4o"],
          selectedSource: "policy",
          fallbackUsed: false,
          overrideModelId: null,
          blockedReason: null,
          validationNotes: [],
          rationale: "Default analysis model",
          confidence: "high",
          reviewByDate: "2099-01-01T00:00:00.000Z",
        },
        "code-performance-auditor": {
          agentId: "code-performance-auditor",
          recommendedModelId: "claude-sonnet-4.6",
          effectiveModelId: "claude-sonnet-4.6",
          effectiveFallbackModelIds: [],
          selectedSource: "policy",
          fallbackUsed: false,
          overrideModelId: null,
          blockedReason: null,
          validationNotes: [],
          rationale: "Default coding model",
          confidence: "high",
          reviewByDate: "2099-01-01T00:00:00.000Z",
        },
      },
      runtimeFailure: null,
    },
    preflight: { canRun: true, warnings: [], blockedReasons: [], fallbackAgentIds: [] },
  });

  const mockListSnapshots = vi.fn().mockReturnValue([mockSnapshot, mockArchivedSnapshot]);

  const mockProfiles = [
    { profileId: "balanced", title: "Balanced", description: "Default balanced", rationale: "Default", reviewWindowDays: 90, sourceLinks: [], assignments: {} },
    { profileId: "accuracy", title: "Accuracy", description: "High accuracy", rationale: "High", reviewWindowDays: 60, sourceLinks: [], assignments: {} },
  ];

  return {
    mockHandlers,
    ipcMain,
    mockWebContents,
    mockBrowserWindow,
    mockSnapshot,
    mockArchivedSnapshot,
    mockSettings,
    mockResolvePolicy,
    mockListSnapshots,
    mockProfiles,
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
  updateSettings: vi.fn().mockImplementation((partial: unknown) => ({ ...mockSettings, ...(partial as object) })),
  resetSettings: vi.fn().mockReturnValue(mockSettings),
  setManualOverride: vi.fn(),
  clearManualOverride: vi.fn(),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn(), getRun: vi.fn().mockResolvedValue(null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn(), getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn(), getReport: vi.fn(), exportReport: vi.fn(), deleteReports: vi.fn(),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn(), appendTraceEvent: vi.fn(), closeTraceLog: vi.fn(), deleteTraces: vi.fn(),
}));

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  listSnapshots: mockListSnapshots,
  applyProfile: vi.fn().mockReturnValue(mockSnapshot),
  publishActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  bootstrapActiveSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  activateSnapshot: vi.fn(),
}));

vi.mock("../../policy/catalog.js", () => ({
  BUILT_IN_PROFILES: mockProfiles,
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

describe("MODEL_POLICY_GET_STATE handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a complete ModelPolicyState with all required top-level keys", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE) as Record<string, unknown>;

    expect(result).toHaveProperty("activeSnapshot");
    expect(result).toHaveProperty("snapshots");
    expect(result).toHaveProperty("profiles");
    expect(result).toHaveProperty("agentViews");
    expect(result).toHaveProperty("preflight");
    expect(result).toHaveProperty("constraints");
    expect(result).toHaveProperty("manualOverrides");
  });

  it("returns preflight with canRun and blockedReasons fields", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE) as Record<string, unknown>;
    const preflight = result.preflight as Record<string, unknown>;

    expect(preflight).toHaveProperty("canRun");
    expect(preflight).toHaveProperty("blockedReasons");
    expect(preflight).toHaveProperty("warnings");
    expect(preflight).toHaveProperty("fallbackAgentIds");
    expect(preflight.canRun).toBe(true);
  });

  it("returns agentViews with all required fields for each agent", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE) as Record<string, unknown>;
    const agentViews = result.agentViews as Array<Record<string, unknown>>;

    expect(agentViews.length).toBeGreaterThan(0);

    const firstView = agentViews[0]!;
    expect(firstView).toHaveProperty("agentId");
    expect(firstView).toHaveProperty("enabled");
    expect(firstView).toHaveProperty("recommended");
    expect(firstView).toHaveProperty("currentModelId");
    expect(firstView).toHaveProperty("currentFallbackModelIds");
    expect(firstView).toHaveProperty("override");
    expect(firstView).toHaveProperty("reviewStatus");
    expect(firstView).toHaveProperty("reviewByDate");
    expect(firstView).toHaveProperty("constraints");
    expect(firstView).toHaveProperty("effectiveSource");
    expect(firstView).toHaveProperty("fallbackUsed");
  });

  it("includes the correct profiles from BUILT_IN_PROFILES", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE) as Record<string, unknown>;
    const profiles = result.profiles as Array<Record<string, unknown>>;

    expect(profiles).toEqual(mockProfiles);
  });

  it("includes the current constraints from settings", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE) as Record<string, unknown>;
    const constraints = result.constraints as Record<string, unknown>;

    expect(constraints.allowPreviewModels).toBe(false);
    expect(constraints.requireToolSupport).toBe(true);
    expect(constraints.includeGeneralPurposeFallback).toBe(false);
  });

  it("calls resolvePolicy to compute the current resolution", async () => {
    mockResolvePolicy.mockClear();

    await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);

    expect(mockResolvePolicy).toHaveBeenCalled();
  });
});

describe("MODEL_POLICY_LIST_SNAPSHOTS handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns all snapshots from the model policy store", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS) as unknown[];

    expect(result).toHaveLength(2);
  });

  it("includes both active and archived snapshots", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS) as Array<Record<string, unknown>>;

    const statuses = result.map((snapshot) => snapshot.status);
    expect(statuses).toContain("active");
    expect(statuses).toContain("archived");
  });

  it("returns snapshots with their snapshotId fields", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS) as Array<Record<string, unknown>>;

    expect(result[0]?.snapshotId).toBe("snap-1");
    expect(result[1]?.snapshotId).toBe("snap-0");
  });

  it("calls modelPolicyStore.listSnapshots", async () => {
    mockListSnapshots.mockClear();

    await callHandler(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS);

    expect(mockListSnapshots).toHaveBeenCalled();
  });
});
