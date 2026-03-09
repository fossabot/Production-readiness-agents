import { useState } from "react";
import type { CSSProperties } from "react";
import { useSettings } from "../hooks/useSettings.js";
import { useModelPolicy } from "../hooks/useModelPolicy.js";
import { ModelPicker } from "../components/ModelPicker.js";
import { PolicyProfilePanel } from "../components/PolicyProfilePanel.js";
import { AgentPolicyTable } from "../components/AgentPolicyTable.js";
import { PolicyStatusBadge } from "../components/PolicyStatusBadge.js";
import type { RuntimePolicy } from "../../electron/types/settings.js";

type SettingsTab = "agents" | "model-policy" | "models" | "tools" | "skills" | "secrets" | "runtime";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "model-policy", label: "سياسة النماذج" },
  { id: "agents", label: "الوكلاء" },
  { id: "models", label: "النماذج" },
  { id: "tools", label: "الأدوات" },
  { id: "skills", label: "المهارات" },
  { id: "secrets", label: "المفاتيح" },
  { id: "runtime", label: "التشغيل" },
];

export function SettingsPage() {
  const { settings, isLoading, updateSettings, resetSettings } = useSettings();
  const {
    state: policyState,
    preview,
    isLoading: isPolicyLoading,
    isApplying: isPolicyApplying,
    error: policyError,
    refresh: refreshPolicy,
    previewProfile,
    applyProfile,
    publishSnapshot,
    setOverride,
    clearOverride,
    clearPreview,
  } = useModelPolicy();

  const [activeTab, setActiveTab] = useState<SettingsTab>("model-policy");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [keepOverrides, setKeepOverrides] = useState(true);
  const [publishForm, setPublishForm] = useState({
    reviewer: "",
    approvalNotes: "",
    reviewByDate: "",
    sourceLinks: "",
  });

  if (isLoading || !settings) {
    return <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>جارٍ التحميل...</div>;
  }

  const providerOptions = Array.from(new Set(settings.models.map((model) => model.provider)));

  const handleAgentToggle = (agentId: string, enabled: boolean) => {
    const agents = { ...settings.agents };
    agents[agentId] = { ...agents[agentId], enabled };
    void updateSettings({ agents });
  };

  const handleAgentModel = (agentId: string, model: string) => {
    const agents = { ...settings.agents };
    agents[agentId] = { ...agents[agentId], model };
    void updateSettings({ agents });
  };

  const handleRuntimeChange = (key: keyof RuntimePolicy, value: number | boolean) => {
    void updateSettings({ runtime: { ...settings.runtime, [key]: value } });
  };

  const handleConstraintToggle = async (provider: string) => {
    const current = settings.modelPolicy.constraints.disabledProviderIds;
    const disabledProviderIds = current.includes(provider)
      ? current.filter((item) => item !== provider)
      : [...current, provider];

    await updateSettings({
      modelPolicy: {
        ...settings.modelPolicy,
        constraints: {
          ...settings.modelPolicy.constraints,
          disabledProviderIds,
        },
      },
    });
    await refreshPolicy();
  };

  const handleConstraintFlag = async (key: "allowPreviewModels" | "requireToolSupport" | "includeGeneralPurposeFallback", value: boolean) => {
    await updateSettings({
      modelPolicy: {
        ...settings.modelPolicy,
        constraints: {
          ...settings.modelPolicy.constraints,
          [key]: value,
        },
      },
    });
    await refreshPolicy();
  };

  const handleReset = () => {
    void resetSettings();
    void refreshPolicy();
    setShowResetConfirm(false);
  };

  const handlePublish = async () => {
    const sourceLinks = publishForm.sourceLinks
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    await publishSnapshot({
      reviewer: publishForm.reviewer,
      approvalNotes: publishForm.approvalNotes || null,
      reviewByDate: publishForm.reviewByDate
        ? new Date(publishForm.reviewByDate).toISOString()
        : policyState?.activeSnapshot.reviewByDate ?? new Date().toISOString(),
      sourceLinks,
    });
    setPublishForm({ reviewer: "", approvalNotes: "", reviewByDate: "", sourceLinks: "" });
  };

  return (
    <div>
      <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#f8fafc", padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "1rem" }}>
        For operator documentation, see <code>desktop/docs/production-readiness.md</code>. API keys are stored securely via OS keychain.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.3rem" }}>الإعدادات</h1>
        <button
          onClick={() => setShowResetConfirm(true)}
          style={{ padding: "0.4rem 1rem", background: "#e53e3e", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          إعادة التعيين
        </button>
      </div>

      {showResetConfirm && (
        <div style={{ padding: "1rem", background: "#fefcbf", borderRadius: "6px", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>هل أنت متأكد من إعادة جميع الإعدادات إلى القيم الافتراضية؟</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleReset} style={{ padding: "0.3rem 0.8rem", background: "#e53e3e", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>نعم</button>
            <button onClick={() => setShowResetConfirm(false)} style={{ padding: "0.3rem 0.8rem", background: "#e2e8f0", border: "none", borderRadius: "4px", cursor: "pointer" }}>لا</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.5rem", borderBottom: "2px solid #e2e8f0", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.5rem 1rem",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #2b6cb0" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.id ? "#2b6cb0" : "#666",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              marginBottom: "-2px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        {activeTab === "model-policy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {isPolicyLoading || !policyState ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>جارٍ تحميل سياسة النماذج...</div>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(240px, 1.2fr) minmax(260px, 1fr)",
                  gap: "1rem",
                  padding: "1rem",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <strong>{policyState.activeSnapshot.title}</strong>
                    <span style={{ color: "#475569", fontSize: "0.86rem", lineHeight: 1.5 }}>
                      {policyState.activeSnapshot.description}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
                      المراجع: {policyState.activeSnapshot.reviewer ?? "نسخة محلية غير منشورة"}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
                      المصادر الرسمية: {policyState.activeSnapshot.sourceLinks.length}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <PolicyStatusBadge
                      status={policyState.agentViews[0]?.reviewStatus ?? "fresh"}
                      reviewByDate={policyState.activeSnapshot.reviewByDate}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: 220 }}>
                      <strong style={{ fontSize: "0.9rem" }}>التحقق المسبق</strong>
                      <span style={{ color: policyState.preflight.canRun ? "#166534" : "#b91c1c", fontSize: "0.82rem" }}>
                        {policyState.preflight.canRun ? "يمكن البدء دون منع مسبق." : "سيتم منع التشغيل قبل البدء حتى تُحل الأسباب التالية."}
                      </span>
                      {policyState.preflight.warnings.map((warning) => (
                        <span key={warning} style={{ color: "#92400e", fontSize: "0.8rem" }}>{warning}</span>
                      ))}
                      {policyState.preflight.blockedReasons.map((reason) => (
                        <span key={`${reason.agentId}-${reason.code}`} style={{ color: "#b91c1c", fontSize: "0.8rem" }}>
                          {reason.agentId}: {reason.message}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {policyError && (
                  <div style={{ padding: "0.75rem 1rem", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c", fontSize: "0.85rem" }}>
                    {policyError}
                  </div>
                )}

                <PolicyProfilePanel
                  state={policyState}
                  preview={preview}
                  keepOverrides={keepOverrides}
                  disabled={isPolicyApplying}
                  onToggleKeepOverrides={setKeepOverrides}
                  onPreview={(profileId) => void previewProfile(profileId, keepOverrides)}
                  onApply={(profileId) => void applyProfile(profileId, keepOverrides)}
                  onClearPreview={clearPreview}
                />

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem" }}>
                  <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>قيود محلية</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={settings.modelPolicy.constraints.allowPreviewModels}
                          onChange={(event) => void handleConstraintFlag("allowPreviewModels", event.target.checked)}
                        />
                        السماح بالنماذج التجريبية
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={settings.modelPolicy.constraints.requireToolSupport}
                          onChange={(event) => void handleConstraintFlag("requireToolSupport", event.target.checked)}
                        />
                        فرض دعم الأدوات لكل الأدوار التنفيذية
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <input
                          type="checkbox"
                          checked={settings.modelPolicy.constraints.includeGeneralPurposeFallback}
                          onChange={(event) => void handleConstraintFlag("includeGeneralPurposeFallback", event.target.checked)}
                        />
                        تفعيل الوكيل الاحتياطي العام
                      </label>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                      <strong style={{ fontSize: "0.88rem" }}>تعطيل مزودين محليًا</strong>
                      {providerOptions.map((provider) => (
                        <label key={provider} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="checkbox"
                            checked={settings.modelPolicy.constraints.disabledProviderIds.includes(provider)}
                            onChange={() => void handleConstraintToggle(provider)}
                          />
                          {provider}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem" }}>
                  <h2 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>الخريطة الفعالة لكل وكيل</h2>
                  <AgentPolicyTable
                    agentViews={policyState.agentViews}
                    models={settings.models}
                    disabled={isPolicyApplying}
                    onOverride={(agentId, modelId) => void setOverride(agentId, modelId)}
                    onClearOverride={(agentId) => void clearOverride(agentId)}
                  />
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1rem", display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1fr)", gap: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                    <h2 style={{ fontSize: "1rem" }}>نشر نسخة مراجعة</h2>
                    <input
                      type="text"
                      placeholder="اسم المراجع"
                      value={publishForm.reviewer}
                      onChange={(event) => setPublishForm((current) => ({ ...current, reviewer: event.target.value }))}
                      style={inputStyle}
                    />
                    <input
                      type="date"
                      value={publishForm.reviewByDate}
                      onChange={(event) => setPublishForm((current) => ({ ...current, reviewByDate: event.target.value }))}
                      style={inputStyle}
                    />
                    <textarea
                      placeholder="ملاحظات الاعتماد"
                      value={publishForm.approvalNotes}
                      onChange={(event) => setPublishForm((current) => ({ ...current, approvalNotes: event.target.value }))}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                    <textarea
                      placeholder={"ضع كل رابط مصدر رسمي في سطر مستقل"}
                      value={publishForm.sourceLinks}
                      onChange={(event) => setPublishForm((current) => ({ ...current, sourceLinks: event.target.value }))}
                      rows={5}
                      style={{ ...inputStyle, resize: "vertical", direction: "ltr", textAlign: "left" }}
                    />
                    <button
                      onClick={() => void handlePublish()}
                      disabled={isPolicyApplying}
                      style={{
                        padding: "0.6rem 1rem",
                        background: isPolicyApplying ? "#cbd5e1" : "#1d4ed8",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: isPolicyApplying ? "not-allowed" : "pointer",
                      }}
                    >
                      نشر النسخة الحالية
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <h2 style={{ fontSize: "1rem" }}>سجل النسخ</h2>
                    {policyState.snapshots.map((snapshot) => (
                      <div key={snapshot.snapshotId} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "0.75rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                          <strong>{snapshot.title}</strong>
                          <span style={{ fontSize: "0.75rem", color: snapshot.status === "active" ? "#166534" : "#64748b" }}>
                            {snapshot.status === "active" ? "نشطة" : "مؤرشفة"}
                          </span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.4rem" }}>
                          {new Date(snapshot.createdAt).toLocaleString("ar-EG")}
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.35rem" }}>
                          المراجع: {snapshot.reviewer ?? "غير منشور"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "agents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            {Object.values(settings.agents).map((agent) => (
              <div key={agent.agentId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem", borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                  <input type="checkbox" checked={agent.enabled} onChange={(event) => handleAgentToggle(agent.agentId, event.target.checked)} />
                  <span style={{ fontWeight: 500 }}>{agent.agentId}</span>
                </div>
                <ModelPicker models={settings.models} value={agent.model} onChange={(modelId) => handleAgentModel(agent.agentId, modelId)} />
              </div>
            ))}
          </div>
        )}

        {activeTab === "models" && (
          <div>
            <p style={{ color: "#666", marginBottom: "1rem" }}>النماذج المتاحة للاستخدام:</p>
            {settings.models.map((model) => (
              <div key={model.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span>{model.displayName}</span>
                  <span style={{ color: "#666", fontSize: "0.8rem" }}>{model.provider}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", color: "#666", fontSize: "0.8rem" }}>
                  <span>{model.contextWindowTokens.toLocaleString()} tokens</span>
                  <span>{model.isPreview ? "تجريبي" : "مستقر"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "tools" && (
          <div>
            <p style={{ color: "#666" }}>الأدوات المسموح بها لكل وكيل تضبط من مكتبة الطاقم مباشرة.</p>
            {Object.values(settings.agents).map((agent) => (
              <div key={agent.agentId} style={{ padding: "0.6rem", borderBottom: "1px solid #eee" }}>
                <span style={{ fontWeight: 500 }}>{agent.agentId}</span>
                <span style={{ color: "#666", marginInlineStart: "0.5rem" }}>
                  {agent.enabledTools.length > 0 ? agent.enabledTools.join("، ") : "الافتراضية"}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "skills" && (
          <div>
            <p style={{ color: "#666" }}>المهارات المسجلة لكل وكيل:</p>
            {Object.values(settings.agents).map((agent) => (
              <div key={agent.agentId} style={{ padding: "0.6rem", borderBottom: "1px solid #eee" }}>
                <span style={{ fontWeight: 500 }}>{agent.agentId}</span>
                <span style={{ color: "#666", marginInlineStart: "0.5rem" }}>
                  {agent.enabledSkills.length > 0 ? agent.enabledSkills.join("، ") : "بدون مهارات"}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "secrets" && (
          <div>
            <p style={{ color: "#666", marginBottom: "1rem" }}>المفاتيح المهيأة بالأسماء فقط والقيم مخفية:</p>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>نوع التخزين: {settings.secrets.storageBackend}</p>
            {settings.secrets.configuredKeys.length > 0 ? (
              settings.secrets.configuredKeys.map((key) => (
                <div key={key} style={{ padding: "0.4rem 0.6rem", borderBottom: "1px solid #eee" }}>
                  {key}: ••••••••
                </div>
              ))
            ) : (
              <p style={{ marginTop: "0.5rem", color: "#975a16" }}>لم تُهيأ أي مفاتيح بعد</p>
            )}
          </div>
        )}

        {activeTab === "runtime" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>أقصى مدة تشغيل بالدقائق</label>
              <input type="number" value={Math.round(settings.runtime.maxRunDurationMs / 60000)} onChange={(event) => handleRuntimeChange("maxRunDurationMs", Number(event.target.value) * 60000)} min={1} style={numberInputStyle} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>مهلة الوكيل بالدقائق</label>
              <input type="number" value={Math.round(settings.runtime.agentTimeoutMs / 60000)} onChange={(event) => handleRuntimeChange("agentTimeoutMs", Number(event.target.value) * 60000)} min={1} style={numberInputStyle} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>أقصى تزامن</label>
              <input type="number" value={settings.runtime.maxConcurrency} onChange={(event) => handleRuntimeChange("maxConcurrency", Number(event.target.value))} min={1} max={10} style={numberInputStyle} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>تمكين التتبع</label>
              <input type="checkbox" checked={settings.runtime.enableTracing} onChange={(event) => handleRuntimeChange("enableTracing", event.target.checked)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>حفظ التتبع الخام</label>
              <input type="checkbox" checked={settings.runtime.persistRawTraces} onChange={(event) => handleRuntimeChange("persistRawTraces", event.target.checked)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>السماح بأدوات الشبكة</label>
              <input type="checkbox" checked={settings.runtime.allowNetworkTools} onChange={(event) => handleRuntimeChange("allowNetworkTools", event.target.checked)} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>فتح التقرير تلقائيًا</label>
              <input type="checkbox" checked={settings.runtime.autoOpenReportOnCompletion} onChange={(event) => handleRuntimeChange("autoOpenReportOnCompletion", event.target.checked)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "0.9rem",
};

const numberInputStyle: CSSProperties = {
  width: 90,
  padding: "0.3rem",
  borderRadius: "4px",
  border: "1px solid #ddd",
  textAlign: "center",
};
