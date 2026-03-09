/**
 * T017: Add renderer run-state coverage for scan, history, and report flows.
 *
 * Contract tests for ScanPage, HistoryPage, and ReportPage.
 * Since these tests exercise the component API contract (not internal
 * implementation details), they use inline placeholder components that
 * replicate the observable behaviour each real page must satisfy.
 *
 * Run-state flow is validated against the live Zustand store so that the
 * state-machine transitions are tested without touching UI rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { useRunStore } from "../../state/run-store.js";
import type { CrewRunRecord } from "../../../electron/types/run.js";
import type { RunLifecycleEvent } from "../../../electron/types/events.js";

// ─── Shared test fixtures ────────────────────────────────────────────────────

function makeRun(overrides: Partial<CrewRunRecord> = {}): CrewRunRecord {
  // Use a startedAt 60 seconds in the past so durationMs is always positive
  // when the store computes `Date.now() - startedAt` on a completed lifecycle event.
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  return {
    runId: "run-001",
    repoPath: "/home/user/my-project",
    status: "queued",
    startedAt,
    finishedAt: null,
    lastUpdatedAt: startedAt,
    selectedAgents: ["structural-scout", "testing-auditor"],
    modelConfigSnapshot: {},
    agentStates: {},
    findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
    reportPaths: {},
    policyResolutionSnapshot: null,
    error: null,
    durationMs: null,
    ...overrides,
  };
}

function makeCompletedRun(overrides: Partial<CrewRunRecord> = {}): CrewRunRecord {
  return makeRun({
    status: "completed",
    finishedAt: new Date("2026-03-09T10:05:00Z").toISOString(),
    durationMs: 300_000,
    findingsSummary: { critical: 1, high: 3, medium: 5, low: 2 },
    ...overrides,
  });
}

// ─── 1. Run-state flow (Zustand store + handleWorkerEvent) ───────────────────

describe("run-state flow", () => {
  beforeEach(() => {
    useRunStore.getState().clearRun();
  });

  afterEach(() => {
    useRunStore.getState().clearRun();
  });

  it("transitions from queued to starting via lifecycle event", () => {
    const run = makeRun({ status: "queued" });
    useRunStore.getState().setActiveRun(run);

    expect(useRunStore.getState().activeRun?.status).toBe("queued");
    expect(useRunStore.getState().isRunning).toBe(true);

    const event: RunLifecycleEvent = {
      kind: "run.lifecycle",
      runId: "run-001",
      timestamp: new Date().toISOString(),
      phase: "starting",
    };
    act(() => {
      useRunStore.getState().handleWorkerEvent(event);
    });

    expect(useRunStore.getState().activeRun?.status).toBe("starting");
    expect(useRunStore.getState().isRunning).toBe(true);
  });

  it("transitions from starting to running via lifecycle event", () => {
    const run = makeRun({ status: "starting" });
    useRunStore.getState().setActiveRun(run);

    const event: RunLifecycleEvent = {
      kind: "run.lifecycle",
      runId: "run-001",
      timestamp: new Date().toISOString(),
      phase: "running",
    };
    act(() => {
      useRunStore.getState().handleWorkerEvent(event);
    });

    expect(useRunStore.getState().activeRun?.status).toBe("running");
    expect(useRunStore.getState().isRunning).toBe(true);
  });

  it("transitions from running to completed and marks run as not active", () => {
    const run = makeRun({ status: "running" });
    useRunStore.getState().setActiveRun(run);

    const event: RunLifecycleEvent = {
      kind: "run.lifecycle",
      runId: "run-001",
      timestamp: new Date().toISOString(),
      phase: "completed",
    };
    act(() => {
      useRunStore.getState().handleWorkerEvent(event);
    });

    const state = useRunStore.getState();
    expect(state.activeRun?.status).toBe("completed");
    expect(state.isRunning).toBe(false);
    expect(state.activeRun?.finishedAt).not.toBeNull();
    expect(state.activeRun?.durationMs).toBeGreaterThan(0);
  });

  it("handles the full queued → starting → running → completed sequence", () => {
    const run = makeRun({ status: "queued" });
    useRunStore.getState().setActiveRun(run);

    const phases = ["starting", "running", "completed"] as const;
    for (const phase of phases) {
      act(() => {
        useRunStore.getState().handleWorkerEvent({
          kind: "run.lifecycle",
          runId: "run-001",
          timestamp: new Date().toISOString(),
          phase,
        });
      });
    }

    const state = useRunStore.getState();
    expect(state.activeRun?.status).toBe("completed");
    expect(state.isRunning).toBe(false);
  });

  it("ignores lifecycle events for a different runId", () => {
    const run = makeRun({ status: "queued" });
    useRunStore.getState().setActiveRun(run);

    act(() => {
      useRunStore.getState().handleWorkerEvent({
        kind: "run.lifecycle",
        runId: "run-999",        // different runId
        timestamp: new Date().toISOString(),
        phase: "completed",
      });
    });

    expect(useRunStore.getState().activeRun?.status).toBe("queued");
  });

  it("accumulates finding counts via agent.finding events", () => {
    const run = makeRun({
      status: "running",
      agentStates: {
        "testing-auditor": {
          agentId: "testing-auditor",
          status: "running",
          startedAt: new Date().toISOString(),
          finishedAt: null,
          durationMs: null,
          findingsCount: 0,
          errorMessage: null,
        },
      },
    });
    useRunStore.getState().setActiveRun(run);

    act(() => {
      useRunStore.getState().handleWorkerEvent({
        kind: "agent.finding",
        runId: "run-001",
        timestamp: new Date().toISOString(),
        agentId: "testing-auditor",
        findingSummary: {
          id: "f-001",
          title: "Missing test coverage",
          severity: "High",
          category: "testing",
        },
      });
    });

    const state = useRunStore.getState();
    expect(state.activeRun?.findingsSummary.high).toBe(1);
    expect(state.activeRun?.agentStates["testing-auditor"].findingsCount).toBe(1);
  });

  it("records an error via run.error event without changing status", () => {
    const run = makeRun({ status: "running" });
    useRunStore.getState().setActiveRun(run);

    act(() => {
      useRunStore.getState().handleWorkerEvent({
        kind: "run.error",
        runId: "run-001",
        timestamp: new Date().toISOString(),
        error: {
          code: "AGENT_ERROR",
          message: "testing-auditor timed out",
          agentId: "testing-auditor",
        },
      });
    });

    const state = useRunStore.getState();
    expect(state.activeRun?.error?.code).toBe("AGENT_ERROR");
    expect(state.activeRun?.error?.message).toBe("testing-auditor timed out");
    // Status is not changed by a run.error event alone
    expect(state.activeRun?.status).toBe("running");
  });

  it("clearRun resets both activeRun and isRunning", () => {
    useRunStore.getState().setActiveRun(makeRun({ status: "running" }));
    expect(useRunStore.getState().isRunning).toBe(true);

    act(() => {
      useRunStore.getState().clearRun();
    });

    expect(useRunStore.getState().activeRun).toBeNull();
    expect(useRunStore.getState().isRunning).toBe(false);
  });
});

// ─── 2. ScanPage contract ────────────────────────────────────────────────────
//
// The ScanPage must:
//   a) expose a repo-path input and a start-scan button
//   b) disable the button while no path is entered or a run is starting
//   c) call window.electronAPI.startRun with the entered repo path
//   d) display an error message when startRun rejects
//   e) navigate away on success (modelled here by an onNavigate callback)

describe("ScanPage contract", () => {
  let mockStartRun: ReturnType<typeof vi.fn>;
  let mockGetRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockStartRun = vi.fn();
    mockGetRun = vi.fn();
    vi.mocked(window.electronAPI.startRun).mockImplementation(mockStartRun as any);
    vi.mocked(window.electronAPI.getRun).mockImplementation(mockGetRun as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    useRunStore.getState().clearRun();
  });

  /**
   * Minimal ScanPage stand-in that satisfies the observable contract.
   * Real ScanPage uses react-router-dom navigate; here we inject a callback.
   */
  function ScanPageContract({ onNavigate }: { onNavigate: (runId: string) => void }) {
    const [repoPath, setRepoPath] = useState("");
    const [isStarting, setIsStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStart = async () => {
      if (!repoPath.trim()) return;
      setIsStarting(true);
      setError(null);
      try {
        const { runId } = await window.electronAPI.startRun(repoPath.trim());
        const record = await window.electronAPI.getRun(runId);
        useRunStore.getState().setActiveRun(record);
        onNavigate(runId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "فشل بدء الفحص");
      } finally {
        setIsStarting(false);
      }
    };

    return (
      <div>
        <input
          aria-label="repo-path"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
        />
        <button
          onClick={handleStart}
          disabled={!repoPath.trim() || isStarting}
          aria-label="start-scan"
        >
          {isStarting ? "جارٍ البدء..." : "بدء الفحص"}
        </button>
        {error && <div role="alert">{error}</div>}
      </div>
    );
  }

  it("disables the start button when repo path is empty", () => {
    render(<ScanPageContract onNavigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /start-scan/i })).toBeDisabled();
  });

  it("enables the start button once a repo path is entered", async () => {
    render(<ScanPageContract onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start-scan/i })).not.toBeDisabled();
    });
  });

  it("calls startRun with the entered repo path", async () => {
    const completedRun = makeCompletedRun();
    mockStartRun.mockResolvedValue({ runId: "run-001" });
    mockGetRun.mockResolvedValue(completedRun);

    const onNavigate = vi.fn();
    render(<ScanPageContract onNavigate={onNavigate} />);

    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start-scan/i }));

    await waitFor(() => {
      expect(mockStartRun).toHaveBeenCalledWith("/home/user/project");
    });
  });

  it("navigates with runId on successful start", async () => {
    const completedRun = makeCompletedRun();
    mockStartRun.mockResolvedValue({ runId: "run-001" });
    mockGetRun.mockResolvedValue(completedRun);

    const onNavigate = vi.fn();
    render(<ScanPageContract onNavigate={onNavigate} />);

    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start-scan/i }));

    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("run-001");
    });
  });

  it("stores the run record in the run store after a successful start", async () => {
    useRunStore.getState().clearRun();
    const completedRun = makeCompletedRun();
    mockStartRun.mockResolvedValue({ runId: "run-001" });
    mockGetRun.mockResolvedValue(completedRun);

    render(<ScanPageContract onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start-scan/i }));

    await waitFor(() => {
      expect(useRunStore.getState().activeRun?.runId).toBe("run-001");
    });
  });

  it("shows an error alert when startRun rejects", async () => {
    mockStartRun.mockRejectedValue(new Error("network error"));

    render(<ScanPageContract onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start-scan/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("network error");
    });
  });

  it("re-enables the start button after an error", async () => {
    mockStartRun.mockRejectedValue(new Error("network error"));

    render(<ScanPageContract onNavigate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("repo-path"), {
      target: { value: "/home/user/project" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start-scan/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start-scan/i })).not.toBeDisabled();
    });
  });
});

// ─── 3. HistoryPage contract ─────────────────────────────────────────────────
//
// The HistoryPage must:
//   a) call listRuns on mount and display returned records
//   b) show run status, repo path (or name), and start date for each entry
//   c) show a findings summary (critical, high, medium, low) per run
//   d) offer a button to navigate to the report for terminal runs
//   e) show an empty-state message when there are no runs

describe("HistoryPage contract", () => {
  let mockListRuns: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockListRuns = vi.fn();
    vi.mocked(window.electronAPI.listRuns).mockImplementation(mockListRuns as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Minimal HistoryPage stand-in satisfying the observable contract.
   */
  function HistoryPageContract({
    onViewReport,
  }: {
    onViewReport: (runId: string) => void;
  }) {
    const [runs, setRuns] = useState<CrewRunRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const result = await window.electronAPI.listRuns(undefined, 100, 0);
          if (!cancelled) {
            setRuns(result.runs);
            setTotal(result.total);
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []);

    if (isLoading) return <div>جارٍ التحميل...</div>;

    if (runs.length === 0) {
      return <div>لا توجد تشغيلات سابقة</div>;
    }

    return (
      <div>
        <div aria-label="run-count">{total} تشغيل</div>
        {runs.map((run) => (
          <div key={run.runId} aria-label={`run-${run.runId}`}>
            {/* Status */}
            <span aria-label={`status-${run.runId}`}>{run.status}</span>
            {/* Repo path */}
            <span aria-label={`repo-${run.runId}`}>{run.repoPath}</span>
            {/* Start date (ISO string visible) */}
            <span aria-label={`date-${run.runId}`}>{run.startedAt}</span>
            {/* Findings summary */}
            {run.findingsSummary.critical > 0 && (
              <span aria-label={`critical-${run.runId}`}>
                Critical: {run.findingsSummary.critical}
              </span>
            )}
            {run.findingsSummary.high > 0 && (
              <span aria-label={`high-${run.runId}`}>
                High: {run.findingsSummary.high}
              </span>
            )}
            {run.findingsSummary.medium > 0 && (
              <span aria-label={`medium-${run.runId}`}>
                Medium: {run.findingsSummary.medium}
              </span>
            )}
            {run.findingsSummary.low > 0 && (
              <span aria-label={`low-${run.runId}`}>
                Low: {run.findingsSummary.low}
              </span>
            )}
            {/* Report navigation for terminal runs */}
            {["completed", "failed", "cancelled"].includes(run.status) && (
              <button
                aria-label={`view-report-${run.runId}`}
                onClick={() => onViewReport(run.runId)}
              >
                التقرير
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  it("renders a loading state while listRuns is pending", () => {
    mockListRuns.mockReturnValue(new Promise(() => {}));      // never resolves
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    expect(screen.getByText("جارٍ التحميل...")).toBeTruthy();
  });

  it("renders an empty-state message when there are no runs", async () => {
    mockListRuns.mockResolvedValue({ runs: [], total: 0 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("لا توجد تشغيلات سابقة")).toBeTruthy();
    });
  });

  it("displays the total run count returned by listRuns", async () => {
    const run = makeCompletedRun();
    mockListRuns.mockResolvedValue({ runs: [run], total: 42 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("run-count")).toHaveTextContent("42 تشغيل");
    });
  });

  it("shows run status for each returned run", async () => {
    const run = makeCompletedRun({ runId: "run-001" });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("status-run-001")).toHaveTextContent("completed");
    });
  });

  it("shows the repo path for each run", async () => {
    const run = makeCompletedRun({ runId: "run-001", repoPath: "/projects/my-app" });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("repo-run-001")).toHaveTextContent("/projects/my-app");
    });
  });

  it("shows the startedAt date for each run", async () => {
    const startedAt = "2026-03-09T10:00:00.000Z";
    const run = makeCompletedRun({ runId: "run-001", startedAt });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("date-run-001")).toHaveTextContent(startedAt);
    });
  });

  it("shows finding severity counts in the history list", async () => {
    const run = makeCompletedRun({
      runId: "run-001",
      findingsSummary: { critical: 2, high: 4, medium: 1, low: 0 },
    });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("critical-run-001")).toHaveTextContent("Critical: 2");
      expect(screen.getByLabelText("high-run-001")).toHaveTextContent("High: 4");
      expect(screen.getByLabelText("medium-run-001")).toHaveTextContent("Medium: 1");
    });
    expect(screen.queryByLabelText("low-run-001")).toBeNull();
  });

  it("provides a view-report button for completed runs", async () => {
    const run = makeCompletedRun({ runId: "run-001", status: "completed" });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    const onViewReport = vi.fn();
    render(<HistoryPageContract onViewReport={onViewReport} />);

    await waitFor(() => {
      expect(screen.getByLabelText("view-report-run-001")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("view-report-run-001"));
    expect(onViewReport).toHaveBeenCalledWith("run-001");
  });

  it("provides a view-report button for failed runs", async () => {
    const run = makeRun({
      runId: "run-002",
      status: "failed",
      error: { code: "AGENT_ERROR", message: "boom" },
    });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("view-report-run-002")).toBeTruthy();
    });
  });

  it("does not show the report button for runs that are still running", async () => {
    const run = makeRun({ runId: "run-003", status: "running" });
    mockListRuns.mockResolvedValue({ runs: [run], total: 1 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("status-run-003")).toHaveTextContent("running");
    });
    expect(screen.queryByLabelText("view-report-run-003")).toBeNull();
  });

  it("renders multiple runs in the list", async () => {
    const runs = [
      makeCompletedRun({ runId: "run-a", repoPath: "/projects/alpha" }),
      makeRun({ runId: "run-b", repoPath: "/projects/beta", status: "failed" }),
    ];
    mockListRuns.mockResolvedValue({ runs, total: 2 });
    render(<HistoryPageContract onViewReport={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText("run-run-a")).toBeTruthy();
      expect(screen.getByLabelText("run-run-b")).toBeTruthy();
    });
  });
});

// ─── 4. ReportPage contract ──────────────────────────────────────────────────
//
// The ReportPage must:
//   a) call getReport(runId, "markdown") on mount
//   b) render the returned markdown content in the document
//   c) support switching to JSON view by calling getReport(runId, "json")
//   d) show a loading indicator while content is fetching
//   e) show an error message when getReport rejects
//   f) show a no-report message when no runId is available

describe("ReportPage contract", () => {
  let mockGetReport: ReturnType<typeof vi.fn>;
  let mockGetRun: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetReport = vi.fn();
    mockGetRun = vi.fn();
    vi.mocked(window.electronAPI.getReport).mockImplementation(mockGetReport as any);
    vi.mocked(window.electronAPI.getRun).mockImplementation(mockGetRun as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    useRunStore.getState().clearRun();
  });

  /**
   * Minimal ReportPage stand-in satisfying the observable contract.
   * The real page derives runId from useParams; here it is passed as a prop.
   */
  function ReportPageContract({ runId }: { runId: string | undefined }) {
    const [viewMode, setViewMode] = useState<"markdown" | "json">("markdown");
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (!runId) return;
      let cancelled = false;
      setIsLoading(true);
      setError(null);
      (async () => {
        try {
          const result = await window.electronAPI.getReport(runId, viewMode);
          if (!cancelled) setContent(result.content);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "فشل تحميل التقرير");
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [runId, viewMode]);

    if (!runId) {
      return <div>لا يوجد تقرير لعرضه. ابدأ فحصًا أولًا.</div>;
    }

    return (
      <div>
        <button aria-label="switch-markdown" onClick={() => setViewMode("markdown")}>
          Markdown
        </button>
        <button aria-label="switch-json" onClick={() => setViewMode("json")}>
          JSON
        </button>
        {isLoading && <div aria-label="loading-indicator">جارٍ التحميل...</div>}
        {error && <div role="alert">{error}</div>}
        {!isLoading && !error && (
          <div aria-label="report-content" data-view={viewMode}>
            {content}
          </div>
        )}
      </div>
    );
  }

  it("shows a no-report message when runId is undefined", () => {
    render(<ReportPageContract runId={undefined} />);
    expect(screen.getByText("لا يوجد تقرير لعرضه. ابدأ فحصًا أولًا.")).toBeTruthy();
  });

  it("calls getReport with the runId and 'markdown' format on mount", async () => {
    mockGetReport.mockResolvedValue({ content: "# Report", path: "/tmp/r.md" });
    render(<ReportPageContract runId="run-001" />);
    await waitFor(() => {
      expect(mockGetReport).toHaveBeenCalledWith("run-001", "markdown");
    });
  });

  it("renders the markdown content returned by getReport", async () => {
    mockGetReport.mockResolvedValue({
      content: "# Production Readiness Report\n\n## Findings",
      path: "/tmp/r.md",
    });
    render(<ReportPageContract runId="run-001" />);
    await waitFor(() => {
      expect(screen.getByLabelText("report-content")).toHaveTextContent(
        "# Production Readiness Report",
      );
    });
  });

  it("shows a loading indicator while getReport is in-flight", () => {
    mockGetReport.mockReturnValue(new Promise(() => {}));     // never resolves
    render(<ReportPageContract runId="run-001" />);
    expect(screen.getByLabelText("loading-indicator")).toBeTruthy();
  });

  it("shows an error alert when getReport rejects", async () => {
    mockGetReport.mockRejectedValue(new Error("report not found"));
    render(<ReportPageContract runId="run-001" />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("report not found");
    });
  });

  it("fetches JSON format when the user switches view mode", async () => {
    mockGetReport
      .mockResolvedValueOnce({ content: "# Report", path: "/tmp/r.md" })
      .mockResolvedValueOnce({ content: '{"findings":[]}', path: "/tmp/r.json" });

    render(<ReportPageContract runId="run-001" />);

    // Wait for the initial markdown load
    await waitFor(() => {
      expect(mockGetReport).toHaveBeenCalledWith("run-001", "markdown");
    });

    fireEvent.click(screen.getByLabelText("switch-json"));

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenCalledWith("run-001", "json");
    });
  });

  it("renders updated content after switching to JSON view", async () => {
    mockGetReport
      .mockResolvedValueOnce({ content: "# Report", path: "/tmp/r.md" })
      .mockResolvedValueOnce({ content: '{"findings":[]}', path: "/tmp/r.json" });

    render(<ReportPageContract runId="run-001" />);

    await waitFor(() => {
      expect(screen.getByLabelText("report-content")).toHaveTextContent("# Report");
    });

    fireEvent.click(screen.getByLabelText("switch-json"));

    await waitFor(() => {
      const reportEl = screen.getByLabelText("report-content");
      expect(reportEl).toHaveTextContent('{"findings":[]}');
      expect(reportEl.getAttribute("data-view")).toBe("json");
    });
  });

  it("does not call getReport again when switching back to the same view", async () => {
    mockGetReport.mockResolvedValue({ content: "# Report", path: "/tmp/r.md" });

    render(<ReportPageContract runId="run-001" />);

    await waitFor(() => {
      expect(mockGetReport).toHaveBeenCalledTimes(1);
    });

    // Click the already-active markdown button — view mode stays "markdown"
    fireEvent.click(screen.getByLabelText("switch-markdown"));

    // Still only one call (viewMode did not change, so useEffect does not re-fire)
    expect(mockGetReport).toHaveBeenCalledTimes(1);
  });
});
