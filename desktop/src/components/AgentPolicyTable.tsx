import { useState } from "react";
import type { ModelConfig } from "../../electron/types/settings.js";
import type { PolicyAgentView } from "../../electron/types/model-policy.js";
import { ModelPicker } from "./ModelPicker.js";
import { PolicyStatusBadge } from "./PolicyStatusBadge.js";

interface AgentPolicyTableProps {
  agentViews: PolicyAgentView[];
  models: ModelConfig[];
  disabled?: boolean;
  onOverride: (agentId: PolicyAgentView["agentId"], modelId: string) => void;
  onClearOverride: (agentId: PolicyAgentView["agentId"]) => void;
}

function agentLabel(agentId: string): string {
  return agentId.replace(/-/g, " ");
}

export function AgentPolicyTable({ agentViews, models, disabled = false, onOverride, onClearOverride }: AgentPolicyTableProps) {
  const [draftSelections, setDraftSelections] = useState<Record<string, string>>({});
  const modelById = new Map(models.map((model) => [model.id, model]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
      {agentViews.map((view) => {
        const draftModelId = draftSelections[view.agentId] ?? view.currentModelId ?? view.recommended.primaryModelId;
        const currentModel = view.currentModelId ? modelById.get(view.currentModelId) : null;
        const recommendedModel = modelById.get(view.recommended.primaryModelId) ?? null;

        return (
          <div
            key={view.agentId}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "1rem",
              background: view.override ? "#fffaf0" : "#ffffff",
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1.4fr) minmax(220px, 1fr) minmax(220px, 1fr)",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.95rem" }}>{agentLabel(view.agentId)}</strong>
                {!view.enabled && (
                  <span style={{ fontSize: "0.75rem", color: "#666" }}>غير مفعل</span>
                )}
                {view.override && (
                  <span style={{ fontSize: "0.75rem", color: "#975a16", background: "#feebc8", borderRadius: "999px", padding: "0.2rem 0.5rem" }}>
                    تخصيص يدوي
                  </span>
                )}
                {view.fallbackUsed && (
                  <span style={{ fontSize: "0.75rem", color: "#1d4ed8", background: "#dbeafe", borderRadius: "999px", padding: "0.2rem 0.5rem" }}>
                    يعمل حاليًا على بديل
                  </span>
                )}
              </div>

              <span style={{ color: "#4b5563", fontSize: "0.84rem" }}>{view.recommended.rationale}</span>

              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                الأساسي المقترح: {recommendedModel?.displayName ?? view.recommended.primaryModelId}
              </div>

              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                البدائل: {view.recommended.fallbackModelIds.length > 0 ? view.recommended.fallbackModelIds.join("، ") : "لا يوجد"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <PolicyStatusBadge
                status={view.reviewStatus}
                reviewByDate={view.reviewByDate}
                confidence={view.recommended.confidence}
                previewDependency={view.constraints.some((item) => item.includes("تجريبي"))}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#4b5563" }}>النموذج الفعال</span>
                <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{currentModel?.displayName ?? view.currentModelId ?? "غير محسوم"}</span>
                <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>المصدر: {view.effectiveSource}</span>
              </div>

              {view.constraints.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem", color: "#92400e" }}>
                  {view.constraints.map((constraint) => (
                    <span key={constraint}>{constraint}</span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#4b5563" }}>تخصيص محلي</span>
              <ModelPicker
                models={models}
                value={draftModelId}
                recommendedModelId={view.recommended.primaryModelId}
                currentModelId={view.currentModelId}
                disabled={disabled}
                onChange={(modelId) => setDraftSelections((current) => ({ ...current, [view.agentId]: modelId }))}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => onOverride(view.agentId, draftModelId)}
                  disabled={disabled || draftModelId === view.currentModelId}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "none",
                    background: disabled || draftModelId === view.currentModelId ? "#cbd5e1" : "#2b6cb0",
                    color: "#fff",
                    cursor: disabled || draftModelId === view.currentModelId ? "not-allowed" : "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  حفظ التخصيص
                </button>
                <button
                  onClick={() => onClearOverride(view.agentId)}
                  disabled={disabled || !view.override}
                  style={{
                    padding: "0.45rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    background: "#fff",
                    color: disabled || !view.override ? "#9ca3af" : "#1f2937",
                    cursor: disabled || !view.override ? "not-allowed" : "pointer",
                    fontSize: "0.8rem",
                  }}
                >
                  الرجوع للسياسة
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
