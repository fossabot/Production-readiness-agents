import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ipc } from "../lib/ipc-client.js";
import { useRunStore } from "../state/run-store.js";
import { FindingBadge } from "../components/FindingBadge.js";
import type { CrewRunRecord } from "../../electron/types/run.js";
import type { Severity } from "../../../src/types.js";

type ViewMode = "markdown" | "json";

export function ReportPage() {
  const { runId: paramRunId } = useParams();
  const activeRun = useRunStore((state) => state.activeRun);
  const runId = paramRunId ?? activeRun?.runId;

  const [viewMode, setViewMode] = useState<ViewMode>("markdown");
  const [content, setContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<CrewRunRecord | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }
    void loadReport(runId, viewMode);
    void loadRunInfo(runId);
  }, [runId, viewMode]);

  async function loadRunInfo(id: string) {
    try {
      const record = await ipc.getRun(id);
      setRun(record);
    } catch {
      // ignore
    }
  }

  async function loadReport(id: string, format: ViewMode) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ipc.getReport(id, format);
      setContent(result.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "فشل تحميل التقرير");
      setContent("");
    } finally {
      setIsLoading(false);
    }
  }

  const handleExport = async (format: "markdown" | "json") => {
    if (!runId) {
      return;
    }
    setExportMessage(null);
    try {
      const folder = await ipc.selectFolder();
      if (!folder.path) {
        return;
      }
      const ext = format === "markdown" ? "md" : "json";
      const dest = `${folder.path}/report-${runId.slice(0, 8)}.${ext}`;
      const result = await ipc.exportReport(runId, format, dest);
      setExportMessage(result.success ? `تم التصدير: ${result.path}` : "فشل التصدير");
    } catch {
      setExportMessage("فشل التصدير");
    }
  };

  if (!runId) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem", color: "#666" }}>
        لا يوجد تقرير لعرضه. ابدأ فحصًا أولًا.
      </div>
    );
  }

  const isCancelled = run?.status === "cancelled";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.3rem" }}>التقرير</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => void handleExport("markdown")}
            style={{ padding: "0.4rem 1rem", background: "#2d3748", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
          >
            تصدير Markdown
          </button>
          <button
            onClick={() => void handleExport("json")}
            style={{ padding: "0.4rem 1rem", background: "#2d3748", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
          >
            تصدير JSON
          </button>
        </div>
      </div>

      {isCancelled && (
        <div style={{ padding: "0.6rem 1rem", background: "#fefcbf", color: "#975a16", borderRadius: "6px", fontSize: "0.9rem" }}>
          هذا التقرير غير مكتمل لأن التشغيل ألغي قبل الانتهاء.
        </div>
      )}

      {run && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {(["Critical", "High", "Medium", "Low"] as Severity[]).map((severity) => {
              const count = run.findingsSummary[severity.toLowerCase() as keyof typeof run.findingsSummary];
              return <FindingBadge key={severity} severity={severity} count={count} />;
            })}
            {run.overallAssessment && (
              <span style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.8rem",
                fontWeight: 600,
                background: run.overallAssessment === "ready" ? "#dcfce7" : run.overallAssessment === "not_ready" ? "#fee2e2" : "#fef3c7",
                color: run.overallAssessment === "ready" ? "#166534" : run.overallAssessment === "not_ready" ? "#b91c1c" : "#92400e",
              }}>
                {run.overallAssessment === "ready" ? "جاهز للإنتاج" : run.overallAssessment === "not_ready" ? "غير جاهز" : "جاهز بشروط"}
              </span>
            )}
            {run.packagedExecution && (
              <span style={{ padding: "0.2rem 0.5rem", borderRadius: "999px", fontSize: "0.75rem", background: "#f3e8ff", color: "#6b21a8" }}>packaged</span>
            )}
            {run.runtimeVersion && (
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>v{run.runtimeVersion}</span>
            )}
          </div>

          {run.policyResolutionSnapshot && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <strong>{run.policyResolutionSnapshot.title}</strong>
                  <span style={{ color: "#64748b", fontSize: "0.82rem" }}>
                    حُلّت السياسة في {new Date(run.policyResolutionSnapshot.resolvedAt).toLocaleString("ar-EG")}
                  </span>
                  <span style={{ color: "#64748b", fontSize: "0.82rem" }}>
                    المراجعة حتى {new Date(run.policyResolutionSnapshot.reviewByDate).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", minWidth: 220 }}>
                  {run.policyResolutionSnapshot.warnings.map((warning) => (
                    <span key={warning} style={{ color: "#92400e", fontSize: "0.82rem" }}>{warning}</span>
                  ))}
                  {run.policyResolutionSnapshot.runtimeFailure && (
                    <span style={{ color: "#b91c1c", fontSize: "0.82rem" }}>
                      فشل أثناء التشغيل: {run.policyResolutionSnapshot.runtimeFailure.message}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "0.9rem" }}>
                {Object.values(run.policyResolutionSnapshot.agents).map((agent) => (
                  <div key={agent.agentId} style={{ border: "1px solid #dbeafe", background: "#fff", borderRadius: "10px", padding: "0.75rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.35rem" }}>{agent.agentId}</strong>
                    <span style={{ display: "block", fontSize: "0.82rem", color: "#1f2937" }}>
                      الفعال: {agent.effectiveModelId ?? "محجوب"}
                    </span>
                    <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b" }}>
                      المصدر: {agent.selectedSource}
                    </span>
                    {agent.blockedReason && (
                      <span style={{ display: "block", fontSize: "0.8rem", color: "#b91c1c", marginTop: "0.35rem" }}>
                        {agent.blockedReason.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {(["markdown", "json"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "0.4rem 1rem",
              background: viewMode === mode ? "#2b6cb0" : "#e2e8f0",
              color: viewMode === mode ? "#fff" : "#2d3748",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {mode === "markdown" ? "Markdown" : "JSON"}
          </button>
        ))}
      </div>

      {exportMessage && (
        <div style={{ padding: "0.5rem 1rem", background: "#c6f6d5", borderRadius: "6px", fontSize: "0.85rem" }}>
          {exportMessage}
        </div>
      )}

      <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#f8fafc", padding: "0.6rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
        For release sign-off procedures, see <code>desktop/docs/release-signoff.md</code>. For the full operator runbook, see <code>desktop/docs/production-readiness.md</code>.
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>جارٍ التحميل...</div>
      ) : error ? (
        <div style={{ padding: "1rem", background: "#fed7d7", color: "#c53030", borderRadius: "6px" }}>{error}</div>
      ) : viewMode === "markdown" ? (
        <div style={{ background: "#fff", padding: "2rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <pre style={{
          background: "#1a1a2e",
          color: "#e2e8f0",
          padding: "1.5rem",
          borderRadius: "8px",
          overflow: "auto",
          fontSize: "0.85rem",
          lineHeight: 1.5,
          direction: "ltr",
          textAlign: "left",
        }}>
          {content}
        </pre>
      )}
    </div>
  );
}
