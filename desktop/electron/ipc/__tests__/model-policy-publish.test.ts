/**
 * T027 — MODEL_POLICY_PUBLISH_SNAPSHOT IPC handler
 *
 * Validates:
 *  1. Requires a non-empty reviewer name
 *  2. Requires at least one sourceLink
 *  3. Publishes the active snapshot with approval notes
 *  4. Updates the activeSnapshotId in settings
 *  5. Returns both the snapshot and the policy state
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
  mockPublishActiveSnapshot,
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
    snapshotId: "snap-published",
    title: "Balanced",
    description: "Default balanced policy",
    profileId: "balanced" as const,
    status: "active" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-03-09T12:00:00.000Z",
    reviewByDate: "2099-01-01T00:00:00.000Z",
    reviewer: "Ahmad",
    approvalNotes: "Reviewed and approved",
    sourceLinks: ["https://docs.example.com/model-policy"],
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

  const mockResolvePolicy = vi.fn().mockReturnValue({
    resolvedModels: { "structural-scout": "claude-sonnet-4.6" },
    snapshot: {
      snapshotId: "snap-published",
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

  const mockPublishActiveSnapshot = vi.fn().mockReturnValue(mockSnapshot);

  return {
    mockHandlers,
    ipcMain,
    mockWebContents,
    mockBrowserWindow,
    mockSnapshot,
    mockSettings,
    mockResolvePolicy,
    mockPublishActiveSnapshot,
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
  listSnapshots: vi.fn().mockReturnValue([mockSnapshot]),
  applyProfile: vi.fn().mockReturnValue(mockSnapshot),
  publishActiveSnapshot: mockPublishActiveSnapshot,
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

describe("MODEL_POLICY_PUBLISH_SNAPSHOT handler", () => {
  beforeEach(() => {
    mockHandlers.clear();
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws when reviewer name is empty", async () => {
    await expect(
      callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
        reviewer: "",
        sourceLinks: ["https://docs.example.com"],
        approvalNotes: null,
        reviewByDate: null,
      }),
    ).rejects.toThrow("اسم المراجع مطلوب");
  });

  it("throws when reviewer name is whitespace only", async () => {
    await expect(
      callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
        reviewer: "   ",
        sourceLinks: ["https://docs.example.com"],
        approvalNotes: null,
        reviewByDate: null,
      }),
    ).rejects.toThrow("اسم المراجع مطلوب");
  });

  it("throws when sourceLinks is empty", async () => {
    await expect(
      callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
        reviewer: "Ahmad",
        sourceLinks: [],
        approvalNotes: null,
        reviewByDate: null,
      }),
    ).rejects.toThrow("يجب توفير مصدر رسمي واحد على الأقل");
  });

  it("throws when sourceLinks contains only whitespace entries", async () => {
    await expect(
      callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
        reviewer: "Ahmad",
        sourceLinks: ["  ", ""],
        approvalNotes: null,
        reviewByDate: null,
      }),
    ).rejects.toThrow("يجب توفير مصدر رسمي واحد على الأقل");
  });

  it("calls publishActiveSnapshot with the correct parameters", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
      reviewer: "Ahmad",
      sourceLinks: ["https://docs.example.com/policy"],
      approvalNotes: "Looks good",
      reviewByDate: "2099-06-01T00:00:00.000Z",
    });

    expect(mockPublishActiveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewer: "Ahmad",
        sourceLinks: ["https://docs.example.com/policy"],
        approvalNotes: "Looks good",
      }),
    );
  });

  it("updates activeSnapshotId in settings after publishing", async () => {
    const { updateSettings } = await import("../../persistence/settings-store.js");

    await callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
      reviewer: "Ahmad",
      sourceLinks: ["https://docs.example.com"],
      approvalNotes: null,
      reviewByDate: null,
    });

    expect(updateSettings).toHaveBeenCalled();
    const updateCall = (updateSettings as Mock).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const modelPolicy = updateCall?.modelPolicy as Record<string, unknown>;
    expect(modelPolicy?.activeSnapshotId).toBe("snap-published");
  });

  it("returns an object with both snapshot and state properties", async () => {
    const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
      reviewer: "Ahmad",
      sourceLinks: ["https://docs.example.com"],
      approvalNotes: null,
      reviewByDate: null,
    }) as Record<string, unknown>;

    expect(result).toHaveProperty("snapshot");
    expect(result).toHaveProperty("state");
    expect((result.snapshot as Record<string, unknown>).snapshotId).toBe("snap-published");
  });

  it("trims whitespace from reviewer and sourceLinks", async () => {
    await callHandler(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, {
      reviewer: "  Ahmad  ",
      sourceLinks: ["  https://docs.example.com  "],
      approvalNotes: null,
      reviewByDate: null,
    });

    const call = mockPublishActiveSnapshot.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call?.reviewer).toBe("Ahmad");
    expect(call?.sourceLinks).toEqual(["https://docs.example.com"]);
  });
});
