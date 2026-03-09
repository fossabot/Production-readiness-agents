import type {
  ModelPolicyPreview,
  ModelPolicyState,
  PolicyProfileId,
} from "../../electron/types/model-policy.js";

interface PolicyProfilePanelProps {
  state: ModelPolicyState;
  preview: ModelPolicyPreview | null;
  keepOverrides: boolean;
  disabled?: boolean;
  onToggleKeepOverrides: (value: boolean) => void;
  onPreview: (profileId: PolicyProfileId) => void;
  onApply: (profileId: PolicyProfileId) => void;
  onClearPreview: () => void;
}

export function PolicyProfilePanel({
  state,
  preview,
  keepOverrides,
  disabled = false,
  onToggleKeepOverrides,
  onPreview,
  onApply,
  onClearPreview,
}: PolicyProfilePanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "0.9rem 1rem",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <strong>الملفات الجاهزة</strong>
          <span style={{ color: "#64748b", fontSize: "0.82rem" }}>
            اختر ملفًا جاهزًا، راجع الفروقات، ثم طبقه دفعة واحدة على الوكلاء المفعّلين.
          </span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem", color: "#334155" }}>
          <input
            type="checkbox"
            checked={keepOverrides}
            onChange={(event) => onToggleKeepOverrides(event.target.checked)}
            disabled={disabled}
          />
          الإبقاء على التخصيصات اليدوية
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.8rem" }}>
        {state.profiles.map((profile) => (
          <div key={profile.profileId} style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "1rem",
            background: state.activeSnapshot.profileId === profile.profileId ? "#eff6ff" : "#fff",
            display: "flex",
            flexDirection: "column",
            gap: "0.7rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <strong>{profile.title}</strong>
              {state.activeSnapshot.profileId === profile.profileId && (
                <span style={{ fontSize: "0.75rem", color: "#1d4ed8", background: "#dbeafe", borderRadius: "999px", padding: "0.2rem 0.5rem" }}>
                  نشط
                </span>
              )}
            </div>
            <span style={{ color: "#64748b", fontSize: "0.82rem", lineHeight: 1.45 }}>{profile.description}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => onPreview(profile.profileId)}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: "0.45rem 0.7rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                معاينة
              </button>
              <button
                onClick={() => onApply(profile.profileId)}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: "0.45rem 0.7rem",
                  borderRadius: "8px",
                  border: "none",
                  background: disabled ? "#cbd5e1" : "#0f766e",
                  color: "#fff",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                تطبيق
              </button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div style={{ border: "1px solid #bfdbfe", background: "#f8fbff", borderRadius: "12px", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <strong>{preview.title}</strong>
              <span style={{ color: "#64748b", fontSize: "0.82rem" }}>{preview.description}</span>
            </div>
            <button
              onClick={onClearPreview}
              style={{ border: "none", background: "transparent", color: "#1d4ed8", cursor: "pointer" }}
            >
              إغلاق
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {preview.diff.map((item) => (
              <div key={item.agentId} style={{
                display: "grid",
                gridTemplateColumns: "minmax(200px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)",
                gap: "0.8rem",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "0.55rem",
              }}>
                <strong>{item.agentId}</strong>
                <span style={{ color: "#64748b", fontSize: "0.83rem" }}>
                  قبل: {item.beforeModelId ?? "غير محدد"}
                </span>
                <span style={{ color: item.changed ? "#0f766e" : "#64748b", fontSize: "0.83rem" }}>
                  بعد: {item.afterModelId}
                  {item.overrideState !== "none" ? ` • ${item.overrideState === "kept" ? "إبقاء تخصيص" : "استبدال تخصيص"}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
