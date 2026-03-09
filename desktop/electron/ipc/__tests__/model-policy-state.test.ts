/**
 * MODEL_POLICY_GET_STATE IPC handler — contract tests
 *
 * Verifies that the handler registered for the "model-policy:get-state"
 * channel returns a well-formed ModelPolicyState value with the required
 * top-level fields: activeSnapshot, snapshots, profiles, agentViews,
 * preflight, constraints, and manualOverrides.
 *
 * All store modules, the policy resolver, and Electron itself are fully
 * mocked so this test suite runs without any binary dependency.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted state — available inside vi.mock() factory functions
// ---------------------------------------------------------------------------

const {
  mockHandlers,
  ipcMain,
  mockSnapshot,
  mockSettings,
  mockResolvePolicyOutput,
  mockGetActiveSnapshot,
  mockListSnapshots,
  mockGetSettings,
  mockResolvePolicy,
  mockGetReviewStatus,
} = vi.hoisted(() => {
  // ------- IPC tracking ---------------------------------------------------
  const mockHandlers = new Map<
    string,
    (event: unknown, input?: unknown) => Promise<unknown>
  >();

  const ipcMain = {
    handle: vi.fn(
      (
        channel: string,
        handler: (event: unknown, input?: unknown) => Promise<unknown>,
      ) => {
        mockHandlers.set(channel, handler);
      },
    ),
  };

  // ------- Mock snapshot --------------------------------------------------
  const mockSnapshot = {
    snapshotId: "policy-balanced-test-001",
    title: "Balanced (Test)",
    description: "Test policy snapshot for unit tests",
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
      "structural-scout": {
        agentId: "structural-scout" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: ["claude-haiku-4.5"],
        rationale: "Wide-context scan",
        confidence: "high" as const,
        role: "wide-context" as const,
        requiresTools: true,
      },
      "code-performance-auditor": {
        agentId: "code-performance-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Coding analysis",
        confidence: "high" as const,
        role: "coding" as const,
        requiresTools: true,
      },
      "security-resilience-auditor": {
        agentId: "security-resilience-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Sensitive workloads",
        confidence: "high" as const,
        role: "sensitive" as const,
        requiresTools: true,
      },
      "testing-auditor": {
        agentId: "testing-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Testing coverage",
        confidence: "high" as const,
        role: "coding" as const,
        requiresTools: true,
      },
      "infrastructure-auditor": {
        agentId: "infrastructure-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Infrastructure review",
        confidence: "high" as const,
        role: "analysis" as const,
        requiresTools: true,
      },
      "docs-compliance-auditor": {
        agentId: "docs-compliance-auditor" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Documentation review",
        confidence: "medium" as const,
        role: "wide-context" as const,
        requiresTools: true,
      },
      "runtime-verifier": {
        agentId: "runtime-verifier" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Runtime verification",
        confidence: "high" as const,
        role: "coding" as const,
        requiresTools: true,
      },
      "report-synthesizer": {
        agentId: "report-synthesizer" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "Report synthesis",
        confidence: "high" as const,
        role: "synthesis" as const,
        requiresTools: true,
      },
      "general-purpose": {
        agentId: "general-purpose" as const,
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: [],
        rationale: "General tasks",
        confidence: "medium" as const,
        role: "general" as const,
        requiresTools: true,
      },
    },
  };

  // ------- Mock settings --------------------------------------------------
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
      "security-resilience-auditor": {
        agentId: "security-resilience-auditor",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
      "testing-auditor": {
        agentId: "testing-auditor",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
      "infrastructure-auditor": {
        agentId: "infrastructure-auditor",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
      "docs-compliance-auditor": {
        agentId: "docs-compliance-auditor",
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
      {
        id: "claude-haiku-4.5",
        provider: "anthropic",
        displayName: "Claude Haiku 4.5",
        contextWindowTokens: 200000,
        supportsTools: true,
        supportsLongContext: true,
        supportsCode: false,
        supportsSensitiveWorkloads: false,
        recommendedRoles: ["wide-context"],
        credentialKey: "ANTHROPIC_API_KEY",
        releasedAt: "2025-10-01T00:00:00.000Z",
        lastReviewedAt: "2026-01-01T00:00:00.000Z",
        deprecatedAt: null,
        isPreview: false,
        isDefault: false,
      },
    ],
    secrets: {
      storageBackend: "electron-safeStorage" as const,
      configuredKeys: ["ANTHROPIC_API_KEY"],
    },
    runtime: {
      maxRunDurationMs: 0,
      agentTimeoutMs: 300_000,
      maxConcurrency: 5,
      enableTracing: false,
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
      activeSnapshotId: "policy-balanced-test-001",
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

  // ------- Mock resolve policy output ------------------------------------
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
      snapshotId: "policy-balanced-test-001",
      profileId: "balanced" as const,
      title: "Balanced (Test)",
      resolvedAt: "2026-01-01T00:00:00.000Z",
      reviewByDate: "2026-12-01T00:00:00.000Z",
      warnings: [] as string[],
      blockedReasons: [] as unknown[],
      agents: {} as Record<
        string,
        {
          agentId: string;
          selectedSource: string;
          validationNotes: string[];
          blockedReason: null;
          fallbackUsed: boolean;
        }
      >,
      runtimeFailure: null,
    },
    preflight: {
      canRun: true,
      warnings: [] as string[],
      blockedReasons: [] as unknown[],
      fallbackAgentIds: [] as string[],
    },
  };

  // ------- vi.fn() wrappers for store functions --------------------------
  const mockGetActiveSnapshot = vi.fn().mockReturnValue(mockSnapshot);
  const mockListSnapshots = vi.fn().mockReturnValue([mockSnapshot]);
  const mockGetSettings = vi.fn().mockReturnValue(mockSettings);
  const mockResolvePolicy = vi.fn().mockReturnValue(mockResolvePolicyOutput);
  const mockGetReviewStatus = vi.fn().mockReturnValue("fresh");

  return {
    mockHandlers,
    ipcMain,
    mockSnapshot,
    mockSettings,
    mockResolvePolicyOutput,
    mockGetActiveSnapshot,
    mockListSnapshots,
    mockGetSettings,
    mockResolvePolicy,
    mockGetReviewStatus,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("electron", () => ({
  ipcMain,
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
  },
}));

vi.mock("node:worker_threads", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
  })),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-model-policy"),
}));

vi.mock("node:path", () => ({
  default: {
    join: (...parts: string[]) => parts.join("/"),
    dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
  },
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
      writeFile: vi.fn().mockResolvedValue(undefined),
      rename: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
    },
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    readFileSync: vi.fn().mockReturnValue("{}"),
    createWriteStream: vi.fn().mockReturnValue({ write: vi.fn(), end: vi.fn() }),
  };
});

vi.mock("../../persistence/settings-store.js", () => ({
  getSettings: mockGetSettings,
  updateSettings: vi.fn().mockImplementation((partial: unknown) => ({
    ...mockSettings,
    ...(partial as object),
  })),
  resetSettings: vi.fn().mockReturnValue(mockSettings),
  setManualOverride: vi.fn(),
  clearManualOverride: vi.fn(),
}));

vi.mock("../../persistence/run-store.js", () => ({
  saveRun: vi.fn().mockResolvedValue(undefined),
  getRun: vi.fn().mockResolvedValue(null),
  listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
  deleteRun: vi.fn().mockResolvedValue(true),
  getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi.fn().mockResolvedValue("/mock/report.md"),
  getReport: vi.fn().mockResolvedValue(null),
  deleteReports: vi.fn().mockResolvedValue(undefined),
  exportReport: vi.fn().mockResolvedValue({ success: true, path: "/mock/export.md" }),
}));

vi.mock("../../persistence/trace-store.js", () => ({
  openTraceLog: vi.fn().mockResolvedValue("/mock/traces.jsonl"),
  appendTraceEvent: vi.fn(),
  closeTraceLog: vi.fn(),
  deleteTraces: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../persistence/model-policy-store.js", () => ({
  getActiveSnapshot: mockGetActiveSnapshot,
  listSnapshots: mockListSnapshots,
  applyProfile: vi.fn().mockReturnValue(mockSnapshot),
  publishActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  bootstrapActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  saveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  getSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  activateSnapshot: vi.fn().mockReturnValue(mockSnapshot),
}));

vi.mock("../../policy/catalog.js", () => ({
  BUILT_IN_PROFILES: [
    {
      profileId: "balanced",
      title: "Balanced",
      description: "Default balanced profile",
      rationale: "Good for daily use",
      reviewWindowDays: 90,
      sourceLinks: [],
      assignments: mockSnapshot.assignments,
    },
  ],
  buildSnapshotFromProfile: vi.fn().mockReturnValue(mockSnapshot),
  buildDefaultActiveSnapshot: vi.fn().mockReturnValue(mockSnapshot),
  getBuiltInProfile: vi
    .fn()
    .mockReturnValue({ title: "Balanced", description: "Default" }),
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
  getReviewStatus: mockGetReviewStatus,
}));

// ---------------------------------------------------------------------------
// Import module under test — after all mocks
// ---------------------------------------------------------------------------

import { IPC_CHANNELS } from "../channels.js";
import { registerIpcHandlers } from "../handlers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callHandler(channel: string, input?: unknown): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel "${channel}"`);
  }
  return handler({} /* IpcMainInvokeEvent stub */, input);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("MODEL_POLICY_GET_STATE IPC handler — ModelPolicyState contract", () => {
  beforeEach(() => {
    mockHandlers.clear();
    vi.clearAllMocks();

    // Reset to clean happy-path defaults before each test.
    mockGetSettings.mockReturnValue(mockSettings);
    mockGetActiveSnapshot.mockReturnValue(mockSnapshot);
    mockListSnapshots.mockReturnValue([mockSnapshot]);
    mockResolvePolicy.mockReturnValue(mockResolvePolicyOutput);
    mockGetReviewStatus.mockReturnValue("fresh");

    registerIpcHandlers();
  });

  // -------------------------------------------------------------------------
  // Top-level structure
  // -------------------------------------------------------------------------

  describe("top-level shape", () => {
    it("returns an object (not null or undefined)", async () => {
      const result = await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(typeof result).toBe("object");
    });

    it("result includes all seven required top-level keys", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(result).toHaveProperty("activeSnapshot");
      expect(result).toHaveProperty("snapshots");
      expect(result).toHaveProperty("profiles");
      expect(result).toHaveProperty("agentViews");
      expect(result).toHaveProperty("preflight");
      expect(result).toHaveProperty("constraints");
      expect(result).toHaveProperty("manualOverrides");
    });
  });

  // -------------------------------------------------------------------------
  // activeSnapshot
  // -------------------------------------------------------------------------

  describe("activeSnapshot field", () => {
    it("activeSnapshot is an object", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(typeof result.activeSnapshot).toBe("object");
      expect(result.activeSnapshot).not.toBeNull();
    });

    it("activeSnapshot has a snapshotId string", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const snapshot = result.activeSnapshot as Record<string, unknown>;

      expect(typeof snapshot.snapshotId).toBe("string");
      expect((snapshot.snapshotId as string).length).toBeGreaterThan(0);
    });

    it("activeSnapshot.snapshotId matches the mock snapshot id", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const snapshot = result.activeSnapshot as Record<string, unknown>;

      expect(snapshot.snapshotId).toBe("policy-balanced-test-001");
    });

    it("activeSnapshot has a status field", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const snapshot = result.activeSnapshot as Record<string, unknown>;

      expect(snapshot.status).toBeDefined();
    });

    it("activeSnapshot has an assignments object", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const snapshot = result.activeSnapshot as Record<string, unknown>;

      expect(typeof snapshot.assignments).toBe("object");
      expect(snapshot.assignments).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // snapshots
  // -------------------------------------------------------------------------

  describe("snapshots field", () => {
    it("snapshots is an array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(Array.isArray(result.snapshots)).toBe(true);
    });

    it("snapshots array contains at least the active snapshot", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect((result.snapshots as unknown[]).length).toBeGreaterThanOrEqual(1);
    });

    it("snapshots array items have snapshotId strings", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const snapshots = result.snapshots as Record<string, unknown>[];

      for (const snap of snapshots) {
        expect(typeof snap.snapshotId).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // profiles
  // -------------------------------------------------------------------------

  describe("profiles field", () => {
    it("profiles is an array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(Array.isArray(result.profiles)).toBe(true);
    });

    it("profiles items each have a profileId and title", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const profiles = result.profiles as Record<string, unknown>[];

      for (const profile of profiles) {
        expect(typeof profile.profileId).toBe("string");
        expect(typeof profile.title).toBe("string");
      }
    });
  });

  // -------------------------------------------------------------------------
  // agentViews
  // -------------------------------------------------------------------------

  describe("agentViews field", () => {
    it("agentViews is an array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(Array.isArray(result.agentViews)).toBe(true);
    });

    it("each agentView has the required contract fields", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];

      for (const view of agentViews) {
        // Core identity
        expect(typeof view.agentId).toBe("string");
        expect(typeof view.enabled).toBe("boolean");

        // Model assignment fields
        expect(view.recommended).toBeDefined();
        expect(view.currentFallbackModelIds).toBeDefined();
        expect(Array.isArray(view.currentFallbackModelIds)).toBe(true);

        // Policy review fields
        expect(typeof view.reviewStatus).toBe("string");
        expect(typeof view.reviewByDate).toBe("string");

        // Constraint notes
        expect(Array.isArray(view.constraints)).toBe(true);

        // Resolution metadata
        expect(typeof view.effectiveSource).toBe("string");
        expect(typeof view.fallbackUsed).toBe("boolean");
      }
    });

    it("each agentView has an override field (null or object)", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];

      for (const view of agentViews) {
        // override must be null or an object — never undefined
        const isNullOrObject =
          view.override === null ||
          (typeof view.override === "object" && view.override !== undefined);
        expect(isNullOrObject).toBe(true);
      }
    });

    it("agentViews contains entries only for agents that appear in the active snapshot assignments", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];
      const snapshotAgentIds = Object.keys(mockSnapshot.assignments);

      for (const view of agentViews) {
        expect(snapshotAgentIds).toContain(view.agentId);
      }
    });

    it("agentViews excludes general-purpose agent when includeGeneralPurposeFallback is false", async () => {
      // The default mock settings have includeGeneralPurposeFallback: false
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];
      const agentIds = agentViews.map((v) => v.agentId);

      expect(agentIds).not.toContain("general-purpose");
    });

    it("agentViews includes general-purpose agent when includeGeneralPurposeFallback is true", async () => {
      const settingsWithGP = {
        ...mockSettings,
        modelPolicy: {
          ...mockSettings.modelPolicy,
          constraints: {
            ...mockSettings.modelPolicy.constraints,
            includeGeneralPurposeFallback: true,
          },
        },
      };
      mockGetSettings.mockReturnValue(settingsWithGP);

      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];
      const agentIds = agentViews.map((v) => v.agentId);

      expect(agentIds).toContain("general-purpose");
    });

    it("reviewStatus on each agentView matches the value returned by getReviewStatus", async () => {
      mockGetReviewStatus.mockReturnValue("review-soon");

      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const agentViews = result.agentViews as Record<string, unknown>[];

      for (const view of agentViews) {
        expect(view.reviewStatus).toBe("review-soon");
      }
    });
  });

  // -------------------------------------------------------------------------
  // preflight
  // -------------------------------------------------------------------------

  describe("preflight field", () => {
    it("preflight is an object", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(typeof result.preflight).toBe("object");
      expect(result.preflight).not.toBeNull();
    });

    it("preflight has a boolean canRun field", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect(typeof preflight.canRun).toBe("boolean");
    });

    it("preflight canRun is true when resolvePolicy reports no blocked reasons", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect(preflight.canRun).toBe(true);
    });

    it("preflight has a blockedReasons array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect(Array.isArray(preflight.blockedReasons)).toBe(true);
    });

    it("preflight blockedReasons is empty when policy resolves cleanly", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect((preflight.blockedReasons as unknown[]).length).toBe(0);
    });

    it("preflight has a warnings array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect(Array.isArray(preflight.warnings)).toBe(true);
    });

    it("preflight has a fallbackAgentIds array", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const preflight = result.preflight as Record<string, unknown>;

      expect(Array.isArray(preflight.fallbackAgentIds)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // constraints
  // -------------------------------------------------------------------------

  describe("constraints field", () => {
    it("constraints is an object", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(typeof result.constraints).toBe("object");
      expect(result.constraints).not.toBeNull();
    });

    it("constraints reflects the current settings.modelPolicy.constraints", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const constraints = result.constraints as Record<string, unknown>;

      expect(typeof constraints.allowPreviewModels).toBe("boolean");
      expect(typeof constraints.requireToolSupport).toBe("boolean");
      expect(typeof constraints.includeGeneralPurposeFallback).toBe("boolean");
      expect(Array.isArray(constraints.disabledProviderIds)).toBe(true);
      expect(Array.isArray(constraints.disabledModelIds)).toBe(true);
    });

    it("constraints.includeGeneralPurposeFallback matches settings value", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const constraints = result.constraints as Record<string, unknown>;

      expect(constraints.includeGeneralPurposeFallback).toBe(
        mockSettings.modelPolicy.constraints.includeGeneralPurposeFallback,
      );
    });
  });

  // -------------------------------------------------------------------------
  // manualOverrides
  // -------------------------------------------------------------------------

  describe("manualOverrides field", () => {
    it("manualOverrides is an object", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(typeof result.manualOverrides).toBe("object");
      expect(result.manualOverrides).not.toBeNull();
    });

    it("manualOverrides is empty when no overrides are set in settings", async () => {
      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;

      expect(Object.keys(result.manualOverrides as object)).toHaveLength(0);
    });

    it("manualOverrides reflects overrides present in settings", async () => {
      const settingsWithOverride = {
        ...mockSettings,
        modelPolicy: {
          ...mockSettings.modelPolicy,
          manualOverrides: {
            "structural-scout": {
              agentId: "structural-scout" as const,
              modelId: "claude-haiku-4.5",
              note: "Cost reduction test",
              updatedAt: "2026-01-15T00:00:00.000Z",
            },
          },
        },
      };
      mockGetSettings.mockReturnValue(settingsWithOverride);

      const result = (await callHandler(
        IPC_CHANNELS.MODEL_POLICY_GET_STATE,
      )) as Record<string, unknown>;
      const overrides = result.manualOverrides as Record<string, unknown>;

      expect(overrides["structural-scout"]).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Store integration — verifies mocks are called correctly
  // -------------------------------------------------------------------------

  describe("store and resolver interactions", () => {
    it("calls getSettings() to read current settings", async () => {
      await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      expect(mockGetSettings).toHaveBeenCalled();
    });

    it("calls getActiveSnapshot() to read the active policy snapshot", async () => {
      await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      expect(mockGetActiveSnapshot).toHaveBeenCalled();
    });

    it("calls listSnapshots() to populate the snapshots list", async () => {
      await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      expect(mockListSnapshots).toHaveBeenCalled();
    });

    it("calls resolvePolicy() to compute the preflight summary", async () => {
      await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      expect(mockResolvePolicy).toHaveBeenCalled();
    });

    it("passes the active snapshot to resolvePolicy", async () => {
      await callHandler(IPC_CHANNELS.MODEL_POLICY_GET_STATE);
      const callArg = mockResolvePolicy.mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(callArg?.snapshot).toBeDefined();
    });
  });
});
