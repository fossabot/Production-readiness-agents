import { useEffect, useState } from "react";
import type { AgentRunState } from "../../electron/types/run.js";
import { FindingBadge } from "./FindingBadge.js";

interface AgentCardProps {
  agent: AgentRunState;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "في الانتظار", color: "#718096", bg: "#edf2f7" },
  running: { label: "يعمل", color: "#2b6cb0", bg: "#bee3f8" },
  completed: { label: "اكتمل", color: "#276749", bg: "#c6f6d5" },
  failed: { label: "فشل", color: "#c53030", bg: "#fed7d7" },
  skipped: { label: "تخطى", color: "#975a16", bg: "#fefcbf" },
  timeout: { label: "انتهت المهلة", color: "#c05621", bg: "#feebc8" },
};

export function AgentCard({ agent }: AgentCardProps) {
  const [elapsed, setElapsed] = useState(0);
  const statusInfo = STATUS_LABELS[agent.status] ?? STATUS_LABELS.pending;

  useEffect(() => {
    if (agent.status !== "running" || !agent.startedAt) {
      if (agent.durationMs) setElapsed(Math.floor(agent.durationMs / 1000));
      return;
    }

    const startTime = new Date(agent.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [agent.status, agent.startedAt, agent.durationMs]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      background: "#fff",
      borderRadius: "8px",
      padding: "1rem",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: agent.status === "running" ? "2px solid #2b6cb0" : "1px solid #e2e8f0",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{agent.agentId}</span>
        <span style={{
          padding: "0.15rem 0.5rem",
          borderRadius: "10px",
          fontSize: "0.75rem",
          fontWeight: 500,
          background: statusInfo.bg,
          color: statusInfo.color,
        }}>
          {statusInfo.label}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "#666" }}>
        <span>{formatTime(elapsed)}</span>
        {agent.findingsCount > 0 && (
          <span>{agent.findingsCount} نتيجة</span>
        )}
      </div>
      {agent.errorMessage && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#c53030" }}>
          {agent.errorMessage}
        </div>
      )}
    </div>
  );
}
