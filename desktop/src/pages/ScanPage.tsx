import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RepoSelector } from "../components/RepoSelector.js";
import { useCrewRun } from "../hooks/useCrewRun.js";
import { useModelPolicy } from "../hooks/useModelPolicy.js";

export function ScanPage() {
  const [repoPath, setRepoPath] = useState("");
  const { startRun, isStarting, error, errorCode } = useCrewRun();
  const { state: policyState } = useModelPolicy();
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!repoPath.trim()) {
      return;
    }
    const runId = await startRun(repoPath.trim());
    if (runId) {
      navigate(`/progress/${runId}`);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "2rem auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>فحص جاهزية الإنتاج</h1>
        <p style={{ color: "#666", marginBottom: "0.5rem" }}>
          اختر مستودعًا محليًا لبدء فحص شامل للجاهزية الإنتاجية.
        </p>
      </div>

      {policyState && (
        <div style={{
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}>
          <strong>التحقق المسبق لسياسة النماذج</strong>
          <span style={{ color: policyState.preflight.canRun ? "#166534" : "#b91c1c", fontSize: "0.9rem" }}>
            {policyState.preflight.canRun ? "لا يوجد سبب يمنع البدء الآن." : "يوجد منع مسبق قبل تشغيل العامل الخلفي."}
          </span>
          {policyState.preflight.warnings.map((warning) => (
            <span key={warning} style={{ color: "#92400e", fontSize: "0.84rem" }}>{warning}</span>
          ))}
          {policyState.preflight.blockedReasons.map((reason) => (
            <span key={`${reason.agentId}-${reason.code}`} style={{ color: "#b91c1c", fontSize: "0.84rem" }}>
              {reason.agentId}: {reason.message}
            </span>
          ))}
        </div>
      )}

      <RepoSelector value={repoPath} onChange={setRepoPath} disabled={isStarting} />

      <button
        onClick={handleStart}
        disabled={!repoPath.trim() || isStarting}
        style={{
          width: "100%",
          padding: "0.8rem",
          fontSize: "1rem",
          fontWeight: 600,
          background: !repoPath.trim() || isStarting ? "#a0aec0" : "#2b6cb0",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: !repoPath.trim() || isStarting ? "not-allowed" : "pointer",
        }}
      >
        {isStarting ? "جارٍ البدء..." : "بدء الفحص"}
      </button>

      {error && (
        <div style={{
          padding: "0.8rem",
          background: errorCode === 'RUN_ALREADY_ACTIVE' ? "#fefcbf" : "#fed7d7",
          color: errorCode === 'RUN_ALREADY_ACTIVE' ? "#975a16" : "#c53030",
          borderRadius: "6px",
          fontSize: "0.9rem",
          whiteSpace: "pre-wrap",
        }}>
          {errorCode === 'RUN_ALREADY_ACTIVE' && <strong style={{ display: "block", marginBottom: "0.3rem" }}>A run is already in progress</strong>}
          {errorCode === 'RUNTIME_ASSET_ERROR' && <strong style={{ display: "block", marginBottom: "0.3rem" }}>Runtime assets not found</strong>}
          {errorCode === 'CONFIG_ERROR' && <strong style={{ display: "block", marginBottom: "0.3rem" }}>Configuration error</strong>}
          {error}
          {errorCode === 'RUNTIME_ASSET_ERROR' && (
            <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.8rem" }}>
              Run &quot;npm run build&quot; from the repository root first.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
