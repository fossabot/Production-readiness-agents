import { useParams, useNavigate } from "react-router-dom";
import { useRunStore } from "../state/run-store.js";
import { useCrewRun } from "../hooks/useCrewRun.js";
import { AgentCard } from "../components/AgentCard.js";
import { FindingBadge } from "../components/FindingBadge.js";
import type { Severity } from "../../../src/types.js";

export function ProgressPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const activeRun = useRunStore((s) => s.activeRun);
  const { cancelRun, isCancelling } = useCrewRun();

  if (!activeRun) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem", color: "#666" }}>
        <p>لا يوجد فحص نشط حالياً</p>
        <button
          onClick={() => navigate("/")}
          style={{ marginTop: "1rem", padding: "0.5rem 1.5rem", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
        >
          بدء فحص جديد
        </button>
      </div>
    );
  }

  const agentStates = Object.values(activeRun.agentStates);
  const isActive = ["queued", "starting", "running", "cancelling"].includes(activeRun.status);
  const canCancel = activeRun.status === "running";
  const isTerminal = ["completed", "failed", "cancelled"].includes(activeRun.status);

  const handleCancel = async () => {
    await cancelRun();
  };

  const severities: Severity[] = ["Critical", "High", "Medium", "Low"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem" }}>تقدم الفحص</h1>
          <p style={{ color: "#666", fontSize: "0.85rem", direction: "ltr", textAlign: "left" }}>{activeRun.repoPath}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              style={{
                padding: "0.5rem 1.2rem",
                background: "#e53e3e",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isCancelling ? "not-allowed" : "pointer",
                opacity: isCancelling ? 0.7 : 1,
              }}
            >
              {isCancelling ? "جارٍ الإلغاء..." : "إلغاء"}
            </button>
          )}
          {isTerminal && (
            <button
              onClick={() => navigate(`/report/${activeRun.runId}`)}
              style={{ padding: "0.5rem 1.2rem", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              عرض التقرير
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        padding: "0.6rem 1rem",
        marginBottom: "1rem",
        borderRadius: "6px",
        background: isActive ? "#bee3f8" : isTerminal && activeRun.status === "completed" ? "#c6f6d5" : "#fed7d7",
        fontSize: "0.9rem",
      }}>
        الحالة: {activeRun.status}
        {activeRun.status === "cancelling" && " — جارٍ إيقاف الوكلاء..."}
      </div>

      {/* Findings summary */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {severities.map((sev) => {
          const count = activeRun.findingsSummary[sev.toLowerCase() as keyof typeof activeRun.findingsSummary];
          return <FindingBadge key={sev} severity={sev} count={count} />;
        })}
      </div>

      {/* Agent cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: "1rem",
      }}>
        {agentStates.length > 0 ? (
          agentStates.map((agent) => <AgentCard key={agent.agentId} agent={agent} />)
        ) : (
          activeRun.selectedAgents.map((agentId) => (
            <AgentCard
              key={agentId}
              agent={{
                agentId,
                status: "pending",
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                findingsCount: 0,
                errorMessage: null,
              }}
            />
          ))
        )}
      </div>

      {/* Error display */}
      {activeRun.error && (
        <div style={{
          marginTop: "1.5rem",
          padding: "1rem",
          background: "#fed7d7",
          borderRadius: "6px",
          color: "#c53030",
        }}>
          <strong>{activeRun.error.code}</strong>: {activeRun.error.message}
          {activeRun.error.details && <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>{activeRun.error.details}</p>}
        </div>
      )}
    </div>
  );
}
