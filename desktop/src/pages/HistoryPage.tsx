import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ipc } from "../lib/ipc-client.js";
import { FindingBadge } from "../components/FindingBadge.js";
import type { CrewRunRecord } from "../../electron/types/run.js";
import type { Severity } from "../../../src/types.js";

export function HistoryPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<CrewRunRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [repoFilter, setRepoFilter] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const filter = repoFilter ? { repoPath: repoFilter } : undefined;
      const result = await ipc.listRuns(filter, 100, 0);
      setRuns(result.runs);
      setTotal(result.total);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRuns();
  }, [repoFilter]);

  const handleDelete = async (runId: string) => {
    await ipc.deleteRun(runId);
    setDeleteConfirm(null);
    await loadRuns();
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleString("ar-EG");
  const formatDuration = (ms: number | null) => {
    if (!ms) {
      return "—";
    }
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}د ${seconds % 60}ث` : `${seconds}ث`;
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: "#276749",
    failed: "#c53030",
    cancelled: "#975a16",
    running: "#2b6cb0",
    queued: "#475569",
    starting: "#475569",
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>سجل التشغيلات</h1>

      <input
        type="text"
        value={repoFilter}
        onChange={(event) => setRepoFilter(event.target.value)}
        placeholder="تصفية حسب مسار المستودع..."
        style={{ width: "100%", padding: "0.5rem 1rem", border: "1px solid #ddd", borderRadius: "6px", marginBottom: "1rem", direction: "ltr", textAlign: "left" }}
      />

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>جارٍ التحميل...</div>
      ) : runs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>لا توجد تشغيلات سابقة</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>{total} تشغيل</div>
          {runs.map((run) => (
            <div
              key={run.runId}
              style={{ background: "#fff", borderRadius: "10px", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}
            >
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.95rem", direction: "ltr" }}>{run.repoPath.split(/[/\\]/).pop()}</span>
                  <span style={{ color: STATUS_COLORS[run.status] ?? "#666", fontSize: "0.8rem", fontWeight: 500 }}>{run.status}</span>
                  {run.policyResolutionSnapshot?.blockedReasons.length ? (
                    <span style={{ fontSize: "0.75rem", color: "#b91c1c", background: "#fee2e2", borderRadius: "999px", padding: "0.2rem 0.5rem" }}>
                      منع مسبق
                    </span>
                  ) : null}
                  {run.policyResolutionSnapshot?.warnings.length ? (
                    <span style={{ fontSize: "0.75rem", color: "#92400e", background: "#fef3c7", borderRadius: "999px", padding: "0.2rem 0.5rem" }}>
                      مع بدائل
                    </span>
                  ) : null}
                </div>

                <div style={{ fontSize: "0.8rem", color: "#666", direction: "ltr", textAlign: "left" }}>{run.repoPath}</div>
                <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem", color: "#888", flexWrap: "wrap" }}>
                  <span>{formatDate(run.startedAt)}</span>
                  <span>{formatDuration(run.durationMs)}</span>
                  {run.runtimeVersion && <span>v{run.runtimeVersion}</span>}
                  {run.packagedExecution && <span style={{ color: "#6b21a8", background: "#f3e8ff", borderRadius: "999px", padding: "0.1rem 0.4rem" }}>packaged</span>}
                  {run.overallAssessment && (
                    <span style={{
                      color: run.overallAssessment === "ready" ? "#166534" : run.overallAssessment === "not_ready" ? "#b91c1c" : "#92400e",
                      fontWeight: 500,
                    }}>
                      {run.overallAssessment === "ready" ? "جاهز" : run.overallAssessment === "not_ready" ? "غير جاهز" : "جاهز بشروط"}
                    </span>
                  )}
                  {run.policyResolutionSnapshot && (
                    <span>مراجعة السياسة حتى {new Date(run.policyResolutionSnapshot.reviewByDate).toLocaleDateString("ar-EG")}</span>
                  )}
                </div>

                {run.policyResolutionSnapshot && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem" }}>
                    {run.policyResolutionSnapshot.blockedReasons.map((reason) => (
                      <span key={`${reason.agentId}-${reason.code}`} style={{ color: "#b91c1c" }}>
                        {reason.agentId}: {reason.message}
                      </span>
                    ))}
                    {run.policyResolutionSnapshot.warnings.map((warning) => (
                      <span key={warning} style={{ color: "#92400e" }}>{warning}</span>
                    ))}
                    {run.policyResolutionSnapshot.runtimeFailure && (
                      <span style={{ color: "#b91c1c" }}>
                        فشل أثناء التشغيل: {run.policyResolutionSnapshot.runtimeFailure.message}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                  {(["Critical", "High", "Medium", "Low"] as Severity[]).map((severity) => {
                    const count = run.findingsSummary[severity.toLowerCase() as keyof typeof run.findingsSummary];
                    return count > 0 ? <FindingBadge key={severity} severity={severity} count={count} /> : null;
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["completed", "cancelled", "failed"].includes(run.status) && (
                  <button
                    onClick={() => navigate(`/report/${run.runId}`)}
                    style={{ padding: "0.3rem 0.8rem", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    التقرير
                  </button>
                )}
                {deleteConfirm === run.runId ? (
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    <button onClick={() => void handleDelete(run.runId)} style={{ padding: "0.3rem 0.6rem", background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>تأكيد</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ padding: "0.3rem 0.6rem", background: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}>إلغاء</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(run.runId)}
                    style={{ padding: "0.3rem 0.8rem", background: "#fed7d7", color: "#c53030", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
