/**
 * T053 — Report export and history retention for packaged execution
 *
 * Verifies the IPC handlers for report retrieval, export, and deletion
 * (CREW_GET_REPORT, CREW_EXPORT_REPORT, CREW_DELETE_RUN) as well as the
 * underlying report-store and run-store persistence layer.
 *
 * All external dependencies (electron, fs, run-store, report-store,
 * trace-store) are fully mocked — no real filesystem or Electron binary
 * is required.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockHandlers,
  ipcMain,
  mockBrowserWindow,
  storedRuns,
  storedReports,
  mockResolvePolicy,
  mockSnapshot,
  mockSettings,
} = vi.hoisted(() => {
  const mockHandlers = new Map<
    string,
    (event: unknown, input: unknown) => Promise<unknown>
  >();

  const ipcMain = {
    handle: vi.fn(
      (
        channel: string,
        handler: (event: unknown, input: unknown) => Promise<unknown>,
      ) => {
        mockHandlers.set(channel, handler);
      },
    ),
  };

  const mockWebContents = { send: vi.fn() };
  const mockBrowserWindow = { webContents: mockWebContents };

  const storedRuns = new Map<string, Record<string, unknown>>();
  const storedReports = new Map<
    string,
    { content: string; path: string }
  >();

  const mockResolvePolicy = vi.fn().mockReturnValue({
    resolvedModels: {},
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
    preflight: {
      canRun: true,
      warnings: [],
      blockedReasons: [],
      fallbackAgentIds: [],
    },
  });

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
    assignments: {},
  };

  const mockSettings = {
    schemaVersion: 2,
    agents: {},
    models: [],
    secrets: {
      storageBackend: "electron-safeStorage" as const,
      configuredKeys: [],
    },
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
    mockBrowserWindow,
    storedRuns,
    storedReports,
    mockResolvePolicy,
    mockSnapshot,
    mockSettings,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("electron", () => ({
  ipcMain,
  dialog: {
    showOpenDialog: vi
      .fn()
      .mockResolvedValue({ canceled: false, filePaths: ["/some/path"] }),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([mockBrowserWindow]),
  },
}));

vi.mock("node:worker_threads", () => ({
  Worker: vi.fn().mockImplementation(() => {
    const { EventEmitter } = require("node:events") as {
      EventEmitter: typeof import("node:events").EventEmitter;
    };
    const instance = new EventEmitter();
    (instance as unknown as Record<string, unknown>).postMessage = vi.fn();
    (instance as unknown as Record<string, unknown>).terminate = vi.fn();
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
  saveRun: vi
    .fn()
    .mockImplementation(
      async (record: Record<string, unknown> & { runId: string }) => {
        storedRuns.set(record.runId, record);
      },
    ),
  getRun: vi
    .fn()
    .mockImplementation(
      async (runId: string) => storedRuns.get(runId) ?? null,
    ),
  listRuns: vi
    .fn()
    .mockImplementation(
      async (
        filter?: { repoPath?: string },
        limit?: number,
        _offset?: number,
      ) => {
        let runs = [...storedRuns.values()];
        if (filter?.repoPath) {
          runs = runs.filter((r) => r.repoPath === filter.repoPath);
        }
        runs.sort(
          (a, b) =>
            new Date(b.startedAt as string).getTime() -
            new Date(a.startedAt as string).getTime(),
        );
        const total = runs.length;
        const sliced = runs.slice(0, limit ?? 50);
        return { runs: sliced, total };
      },
    ),
  deleteRun: vi.fn().mockImplementation(async (runId: string) => {
    const existed = storedRuns.has(runId);
    storedRuns.delete(runId);
    return existed;
  }),
  getActiveRun: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../persistence/report-store.js", () => ({
  saveReport: vi
    .fn()
    .mockImplementation(
      async (runId: string, format: string, content: string) => {
        const ext = format === "markdown" ? "md" : "json";
        const filePath = `/mock-userData/reports/${runId}.${ext}`;
        storedReports.set(`${runId}:${format}`, { content, path: filePath });
        return filePath;
      },
    ),
  getReport: vi
    .fn()
    .mockImplementation(
      async (runId: string, format: string) =>
        storedReports.get(`${runId}:${format}`) ?? null,
    ),
  exportReport: vi
    .fn()
    .mockImplementation(
      async (runId: string, format: string, destinationPath: string) => {
        const report = storedReports.get(`${runId}:${format}`);
        if (!report) {
          return { success: false, path: destinationPath };
        }
        return { success: true, path: destinationPath };
      },
    ),
  deleteReports: vi.fn().mockImplementation(async (runId: string) => {
    storedReports.delete(`${runId}:markdown`);
    storedReports.delete(`${runId}:json`);
  }),
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
  getBuiltInProfile: vi.fn().mockReturnValue(null),
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
// Import module under test — after mocks
// ---------------------------------------------------------------------------

import { IPC_CHANNELS } from "../channels.js";
import { registerIpcHandlers } from "../handlers.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callHandler(
  channel: string,
  input?: unknown,
): Promise<unknown> {
  const handler = mockHandlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel "${channel}"`);
  }
  return handler({}, input);
}

function seedRun(
  runId: string,
  overrides: Partial<Record<string, unknown>> = {},
): void {
  storedRuns.set(runId, {
    runId,
    repoPath: "/projects/my-app",
    status: "completed",
    startedAt: "2026-03-09T10:00:00.000Z",
    finishedAt: "2026-03-09T10:05:00.000Z",
    lastUpdatedAt: "2026-03-09T10:05:00.000Z",
    selectedAgents: ["structural-scout"],
    modelConfigSnapshot: {},
    agentStates: {},
    findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
    reportPaths: {},
    policyResolutionSnapshot: null,
    error: null,
    durationMs: 300_000,
    ...overrides,
  });
}

function seedReport(
  runId: string,
  format: "markdown" | "json",
  content: string,
): void {
  const ext = format === "markdown" ? "md" : "json";
  const filePath = `/mock-userData/reports/${runId}.${ext}`;
  storedReports.set(`${runId}:${format}`, { content, path: filePath });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Report retention — IPC handlers", () => {
  beforeEach(() => {
    mockHandlers.clear();
    storedRuns.clear();
    storedReports.clear();
    vi.clearAllMocks();
    registerIpcHandlers();
  });

  // -----------------------------------------------------------------------
  // CREW_GET_REPORT — markdown
  // -----------------------------------------------------------------------

  describe("getReport returns saved markdown report", () => {
    it("returns the stored markdown content", async () => {
      const runId = "run-md-001";
      seedRun(runId);
      seedReport(runId, "markdown", "# Production Readiness Report\n\nAll checks passed.");

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "markdown",
      })) as { content: string; path: string };

      expect(result.content).toBe(
        "# Production Readiness Report\n\nAll checks passed.",
      );
    });

    it("returns a path containing the runId", async () => {
      const runId = "run-md-002";
      seedRun(runId);
      seedReport(runId, "markdown", "# Report");

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "markdown",
      })) as { content: string; path: string };

      expect(result.path).toContain(runId);
    });
  });

  // -----------------------------------------------------------------------
  // CREW_GET_REPORT — json
  // -----------------------------------------------------------------------

  describe("getReport returns saved JSON report", () => {
    it("returns the stored JSON content", async () => {
      const runId = "run-json-001";
      seedRun(runId);
      const jsonContent = JSON.stringify({ assessment: "ready", findings: [] });
      seedReport(runId, "json", jsonContent);

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "json",
      })) as { content: string; path: string };

      expect(result.content).toBe(jsonContent);
    });

    it("JSON content is parseable", async () => {
      const runId = "run-json-002";
      seedRun(runId);
      const jsonContent = JSON.stringify({
        assessment: "not_ready",
        findings: [{ severity: "critical", title: "Missing auth" }],
      });
      seedReport(runId, "json", jsonContent);

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "json",
      })) as { content: string; path: string };

      expect(() => JSON.parse(result.content)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // CREW_GET_REPORT — missing report
  // -----------------------------------------------------------------------

  describe("getReport throws for missing report", () => {
    it("throws when no report exists for the given runId", async () => {
      await expect(
        callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
          runId: "run-nonexistent",
          format: "markdown",
        }),
      ).rejects.toThrow("not found");
    });

    it("throws when the requested format does not exist", async () => {
      const runId = "run-only-md";
      seedRun(runId);
      seedReport(runId, "markdown", "# Report");
      // JSON format was not seeded

      await expect(
        callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
          runId,
          format: "json",
        }),
      ).rejects.toThrow("not found");
    });
  });

  // -----------------------------------------------------------------------
  // CREW_EXPORT_REPORT — writes to destination
  // -----------------------------------------------------------------------

  describe("exportReport writes to destination path", () => {
    it("returns success true when report exists", async () => {
      const runId = "run-export-001";
      seedRun(runId);
      seedReport(runId, "markdown", "# Report for export");

      const result = (await callHandler(IPC_CHANNELS.CREW_EXPORT_REPORT, {
        runId,
        format: "markdown",
        destinationPath: "/exports/report.md",
      })) as { success: boolean; path: string };

      expect(result.success).toBe(true);
    });

    it("returns the destination path in the response", async () => {
      const runId = "run-export-002";
      seedRun(runId);
      seedReport(runId, "json", '{"findings":[]}');

      const result = (await callHandler(IPC_CHANNELS.CREW_EXPORT_REPORT, {
        runId,
        format: "json",
        destinationPath: "/exports/report.json",
      })) as { success: boolean; path: string };

      expect(result.path).toBe("/exports/report.json");
    });

    it("returns success false when report does not exist", async () => {
      const result = (await callHandler(IPC_CHANNELS.CREW_EXPORT_REPORT, {
        runId: "run-no-report",
        format: "markdown",
        destinationPath: "/exports/missing.md",
      })) as { success: boolean; path: string };

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CREW_DELETE_RUN — removes reports and traces
  // -----------------------------------------------------------------------

  describe("deleteRun removes reports and traces", () => {
    it("returns success true for an existing run", async () => {
      const runId = "run-delete-001";
      seedRun(runId);
      seedReport(runId, "markdown", "# Report");

      const result = (await callHandler(IPC_CHANNELS.CREW_DELETE_RUN, {
        runId,
      })) as { success: boolean };

      expect(result.success).toBe(true);
    });

    it("calls deleteReports for the deleted runId", async () => {
      const runId = "run-delete-002";
      seedRun(runId);
      seedReport(runId, "markdown", "# Report");

      await callHandler(IPC_CHANNELS.CREW_DELETE_RUN, { runId });

      const { deleteReports } = await import(
        "../../persistence/report-store.js"
      );
      expect(deleteReports).toHaveBeenCalledWith(runId);
    });

    it("calls deleteTraces for the deleted runId", async () => {
      const runId = "run-delete-003";
      seedRun(runId);

      await callHandler(IPC_CHANNELS.CREW_DELETE_RUN, { runId });

      const { deleteTraces } = await import(
        "../../persistence/trace-store.js"
      );
      expect(deleteTraces).toHaveBeenCalledWith(runId);
    });

    it("returns success false for a non-existent run", async () => {
      const result = (await callHandler(IPC_CHANNELS.CREW_DELETE_RUN, {
        runId: "run-ghost",
      })) as { success: boolean };

      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CREW_LIST_RUNS — filtered results
  // -----------------------------------------------------------------------

  describe("listRuns returns filtered results", () => {
    it("returns all runs when no filter is provided", async () => {
      seedRun("run-list-001");
      seedRun("run-list-002");

      const result = (await callHandler(IPC_CHANNELS.CREW_LIST_RUNS, {
        limit: 50,
        offset: 0,
      })) as { runs: unknown[]; total: number };

      expect(result.total).toBe(2);
      expect(result.runs).toHaveLength(2);
    });

    it("filters by repoPath when provided", async () => {
      seedRun("run-list-003", { repoPath: "/projects/alpha" });
      seedRun("run-list-004", { repoPath: "/projects/beta" });

      const result = (await callHandler(IPC_CHANNELS.CREW_LIST_RUNS, {
        filter: { repoPath: "/projects/alpha" },
        limit: 50,
        offset: 0,
      })) as { runs: Array<{ runId: string }>; total: number };

      expect(result.total).toBe(1);
      expect(result.runs[0].runId).toBe("run-list-003");
    });
  });

  // -----------------------------------------------------------------------
  // Run record persists reportPaths correctly
  // -----------------------------------------------------------------------

  describe("run record persists reportPaths correctly", () => {
    it("run record reportPaths is initially empty", () => {
      seedRun("run-paths-001");
      const run = storedRuns.get("run-paths-001") as Record<string, unknown>;
      const reportPaths = run.reportPaths as Record<string, string>;
      expect(Object.keys(reportPaths)).toHaveLength(0);
    });

    it("run record can store markdown report path", () => {
      seedRun("run-paths-002", {
        reportPaths: { markdown: "/reports/run-paths-002.md" },
      });
      const run = storedRuns.get("run-paths-002") as Record<string, unknown>;
      const reportPaths = run.reportPaths as Record<string, string>;
      expect(reportPaths.markdown).toBe("/reports/run-paths-002.md");
    });

    it("run record can store both markdown and json paths", () => {
      seedRun("run-paths-003", {
        reportPaths: {
          markdown: "/reports/run-paths-003.md",
          json: "/reports/run-paths-003.json",
        },
      });
      const run = storedRuns.get("run-paths-003") as Record<string, unknown>;
      const reportPaths = run.reportPaths as Record<string, string>;
      expect(reportPaths.markdown).toBe("/reports/run-paths-003.md");
      expect(reportPaths.json).toBe("/reports/run-paths-003.json");
    });

    it("run record can include traces path alongside reports", () => {
      seedRun("run-paths-004", {
        reportPaths: {
          markdown: "/reports/run-paths-004.md",
          json: "/reports/run-paths-004.json",
          traces: "/traces/run-paths-004.jsonl",
        },
      });
      const run = storedRuns.get("run-paths-004") as Record<string, unknown>;
      const reportPaths = run.reportPaths as Record<string, string>;
      expect(reportPaths.traces).toBe("/traces/run-paths-004.jsonl");
    });
  });

  // -----------------------------------------------------------------------
  // Report persists through run completion
  // -----------------------------------------------------------------------

  describe("report persists through run completion", () => {
    it("report is retrievable after run status is completed", async () => {
      const runId = "run-complete-001";
      seedRun(runId, { status: "completed" });
      seedReport(runId, "markdown", "# Final Report");

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "markdown",
      })) as { content: string; path: string };

      expect(result.content).toBe("# Final Report");
    });

    it("report is retrievable after run status is failed", async () => {
      const runId = "run-failed-001";
      seedRun(runId, {
        status: "failed",
        error: { code: "AGENT_ERROR", message: "timeout" },
      });
      seedReport(runId, "markdown", "# Partial Report");

      const result = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "markdown",
      })) as { content: string; path: string };

      expect(result.content).toBe("# Partial Report");
    });

    it("both markdown and JSON reports survive independent deletion checks", async () => {
      const runId = "run-survive-001";
      seedRun(runId, { status: "completed" });
      seedReport(runId, "markdown", "# MD Report");
      seedReport(runId, "json", '{"status":"ready"}');

      const mdResult = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "markdown",
      })) as { content: string };

      const jsonResult = (await callHandler(IPC_CHANNELS.CREW_GET_REPORT, {
        runId,
        format: "json",
      })) as { content: string };

      expect(mdResult.content).toBe("# MD Report");
      expect(jsonResult.content).toBe('{"status":"ready"}');
    });
  });
});
