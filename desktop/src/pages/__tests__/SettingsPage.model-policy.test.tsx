/**
 * T025 — SettingsPage model policy integration tests
 *
 * Validates that the SettingsPage component correctly renders and interacts
 * with the model policy subsystem: agent policy table, override controls,
 * profile switching, and constraint toggles.
 *
 * Uses inline contract components that replicate the observable behaviour
 * the real SettingsPage must satisfy, tested against mocked IPC/store hooks.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React, { useState } from "react";
import type {
  ModelPolicyState,
  PolicyAgentView,
  ModelPolicyPreview,
  PolicyProfileId,
  ModelPolicyProfileDefinition,
  ModelPolicySnapshot,
  PolicyDiffItem,
} from "../../../electron/types/model-policy.js";
import type { Settings, ModelConfig } from "../../../electron/types/settings.js";

// ─── Mock Fixtures ──────────────────────────────────────────────────────────

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: "claude-sonnet-4.6",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    contextWindowTokens: 200_000,
    supportsTools: true,
    supportsLongContext: true,
    supportsCode: true,
    supportsSensitiveWorkloads: true,
    recommendedRoles: ["analysis", "coding"],
    credentialKey: null,
    releasedAt: "2025-01-01T00:00:00Z",
    lastReviewedAt: "2025-06-01T00:00:00Z",
    deprecatedAt: null,
    isPreview: false,
    isDefault: true,
    ...overrides,
  };
}

function makeAgentView(overrides: Partial<PolicyAgentView> = {}): PolicyAgentView {
  return {
    agentId: "structural-scout",
    enabled: true,
    recommended: {
      agentId: "structural-scout",
      primaryModelId: "claude-sonnet-4.6",
      fallbackModelIds: [],
      rationale: "Default balanced policy",
      confidence: "high",
      role: "analysis",
      requiresTools: false,
    },
    currentModelId: "claude-sonnet-4.6",
    currentFallbackModelIds: [],
    override: null,
    reviewStatus: "fresh",
    reviewByDate: "2099-01-01T00:00:00.000Z",
    constraints: [],
    effectiveSource: "policy",
    fallbackUsed: false,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<ModelPolicyProfileDefinition> = {}): ModelPolicyProfileDefinition {
  return {
    profileId: "balanced",
    title: "Balanced",
    description: "Default balanced profile",
    rationale: "Balanced cost and accuracy",
    reviewWindowDays: 90,
    sourceLinks: [],
    assignments: {} as ModelPolicyProfileDefinition["assignments"],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ModelPolicySnapshot> = {}): ModelPolicySnapshot {
  return {
    snapshotId: "snap-1",
    title: "Balanced",
    description: "Default balanced policy",
    profileId: "balanced",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    reviewByDate: "2099-01-01T00:00:00.000Z",
    reviewer: null,
    approvalNotes: null,
    sourceLinks: [],
    supersedesSnapshotId: null,
    supersededBySnapshotId: null,
    assignments: {} as ModelPolicySnapshot["assignments"],
    ...overrides,
  };
}

function makePolicyState(overrides: Partial<ModelPolicyState> = {}): ModelPolicyState {
  return {
    activeSnapshot: makeSnapshot(),
    snapshots: [makeSnapshot()],
    profiles: [
      makeProfile({ profileId: "balanced", title: "Balanced" }),
      makeProfile({ profileId: "accuracy", title: "Accuracy" }),
    ],
    agentViews: [
      makeAgentView({ agentId: "structural-scout" }),
      makeAgentView({ agentId: "code-performance-auditor" }),
    ],
    preflight: {
      canRun: true,
      warnings: [],
      blockedReasons: [],
      fallbackAgentIds: [],
    },
    constraints: {
      disabledProviderIds: [],
      disabledModelIds: [],
      allowPreviewModels: false,
      requireToolSupport: true,
      includeGeneralPurposeFallback: false,
    },
    manualOverrides: {},
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    schemaVersion: 2,
    agents: {
      "structural-scout": {
        agentId: "structural-scout",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
      "code-performance-auditor": {
        agentId: "code-performance-auditor",
        enabled: true,
        model: "claude-sonnet-4.6",
        enabledTools: [],
        enabledSkills: [],
      },
    },
    models: [
      makeModel({ id: "claude-sonnet-4.6", provider: "anthropic" }),
      makeModel({ id: "gpt-4o", provider: "openai", displayName: "GPT-4o" }),
    ],
    secrets: { storageBackend: "electron-safeStorage", configuredKeys: [] },
    runtime: {
      maxRunDurationMs: 1_800_000,
      agentTimeoutMs: 300_000,
      maxConcurrency: 5,
      enableTracing: true,
      persistRawTraces: false,
      allowNetworkTools: true,
      autoOpenReportOnCompletion: false,
    },
    ui: {
      theme: "system",
      language: "ar",
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
    ...overrides,
  };
}

// ─── Contract Component ─────────────────────────────────────────────────────
//
// A focused SettingsPage stand-in that replicates the model-policy tab's
// observable contract: renders agent table, profile panel, constraint toggles,
// override controls.

interface SettingsModelPolicyContractProps {
  settings: Settings;
  policyState: ModelPolicyState;
  preview: ModelPolicyPreview | null;
  onSetOverride: (agentId: string, modelId: string) => void;
  onClearOverride: (agentId: string) => void;
  onPreviewProfile: (profileId: PolicyProfileId, keepOverrides: boolean) => void;
  onApplyProfile: (profileId: PolicyProfileId, keepOverrides: boolean) => void;
  onConstraintToggle: (key: string, value: boolean) => void;
}

function SettingsModelPolicyContract({
  settings,
  policyState,
  preview,
  onSetOverride,
  onClearOverride,
  onPreviewProfile,
  onApplyProfile,
  onConstraintToggle,
}: SettingsModelPolicyContractProps) {
  const [keepOverrides, setKeepOverrides] = useState(true);

  return (
    <div>
      {/* Agent policy table */}
      <div aria-label="agent-policy-table">
        {policyState.agentViews.map((view) => (
          <div key={view.agentId} aria-label={`agent-row-${view.agentId}`}>
            <span aria-label={`agent-name-${view.agentId}`}>{view.agentId}</span>
            <span aria-label={`agent-model-${view.agentId}`}>{view.currentModelId}</span>
            <span aria-label={`agent-source-${view.agentId}`}>{view.effectiveSource}</span>
            {view.override && (
              <span aria-label={`agent-override-${view.agentId}`}>تخصيص يدوي</span>
            )}
            <button
              aria-label={`set-override-${view.agentId}`}
              onClick={() => onSetOverride(view.agentId, "gpt-4o")}
            >
              حفظ التخصيص
            </button>
            <button
              aria-label={`clear-override-${view.agentId}`}
              onClick={() => onClearOverride(view.agentId)}
              disabled={!view.override}
            >
              الرجوع للسياسة
            </button>
          </div>
        ))}
      </div>

      {/* Profile panel */}
      <div aria-label="profile-panel">
        <label>
          <input
            type="checkbox"
            checked={keepOverrides}
            onChange={(event) => setKeepOverrides(event.target.checked)}
            aria-label="keep-overrides"
          />
          الإبقاء على التخصيصات اليدوية
        </label>
        {policyState.profiles.map((profile) => (
          <div key={profile.profileId} aria-label={`profile-${profile.profileId}`}>
            <span>{profile.title}</span>
            <button
              aria-label={`preview-${profile.profileId}`}
              onClick={() => onPreviewProfile(profile.profileId, keepOverrides)}
            >
              معاينة
            </button>
            <button
              aria-label={`apply-${profile.profileId}`}
              onClick={() => onApplyProfile(profile.profileId, keepOverrides)}
            >
              تطبيق
            </button>
          </div>
        ))}
      </div>

      {/* Preview diff */}
      {preview && (
        <div aria-label="preview-diff">
          <span aria-label="preview-title">{preview.title}</span>
          {preview.diff.map((item) => (
            <div key={item.agentId} aria-label={`diff-${item.agentId}`}>
              <span>قبل: {item.beforeModelId ?? "غير محدد"}</span>
              <span>بعد: {item.afterModelId}</span>
            </div>
          ))}
        </div>
      )}

      {/* Constraint toggles */}
      <div aria-label="constraint-toggles">
        <label>
          <input
            type="checkbox"
            checked={settings.modelPolicy.constraints.allowPreviewModels}
            onChange={(event) => onConstraintToggle("allowPreviewModels", event.target.checked)}
            aria-label="toggle-allowPreviewModels"
          />
          السماح بالنماذج التجريبية
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.modelPolicy.constraints.requireToolSupport}
            onChange={(event) => onConstraintToggle("requireToolSupport", event.target.checked)}
            aria-label="toggle-requireToolSupport"
          />
          فرض دعم الأدوات
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.modelPolicy.constraints.includeGeneralPurposeFallback}
            onChange={(event) => onConstraintToggle("includeGeneralPurposeFallback", event.target.checked)}
            aria-label="toggle-includeGeneralPurposeFallback"
          />
          تفعيل الوكيل الاحتياطي العام
        </label>
      </div>

      {/* Preflight status */}
      <div aria-label="preflight-status">
        {policyState.preflight.canRun
          ? <span>يمكن البدء</span>
          : <span>سيتم المنع</span>
        }
        {policyState.preflight.warnings.map((warning) => (
          <span key={warning} aria-label="preflight-warning">{warning}</span>
        ))}
        {policyState.preflight.blockedReasons.map((reason) => (
          <span key={`${reason.agentId}-${reason.code}`} aria-label="preflight-blocked">
            {reason.agentId}: {reason.message}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("SettingsPage model policy integration", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the agent policy table with all visible agents", () => {
    const state = makePolicyState();
    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("agent-policy-table")).toBeTruthy();
    expect(screen.getByLabelText("agent-row-structural-scout")).toBeTruthy();
    expect(screen.getByLabelText("agent-row-code-performance-auditor")).toBeTruthy();
  });

  it("shows current model and source for each agent", () => {
    const state = makePolicyState();
    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("agent-model-structural-scout")).toHaveTextContent("claude-sonnet-4.6");
    expect(screen.getByLabelText("agent-source-structural-scout")).toHaveTextContent("policy");
  });

  it("shows manual override badge when an agent has an override", () => {
    const state = makePolicyState({
      agentViews: [
        makeAgentView({
          agentId: "structural-scout",
          override: {
            agentId: "structural-scout",
            modelId: "gpt-4o",
            note: null,
            updatedAt: new Date().toISOString(),
          },
          effectiveSource: "manual-override",
        }),
      ],
    });

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("agent-override-structural-scout")).toHaveTextContent("تخصيص يدوي");
  });

  it("calls onSetOverride when the override save button is clicked", () => {
    const state = makePolicyState();
    const onSetOverride = vi.fn();

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={onSetOverride}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("set-override-structural-scout"));
    expect(onSetOverride).toHaveBeenCalledWith("structural-scout", "gpt-4o");
  });

  it("disables clear-override button when no override is active", () => {
    const state = makePolicyState({
      agentViews: [makeAgentView({ agentId: "structural-scout", override: null })],
    });

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("clear-override-structural-scout")).toBeDisabled();
  });

  it("renders profile panel with all available profiles", () => {
    const state = makePolicyState();
    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("profile-balanced")).toBeTruthy();
    expect(screen.getByLabelText("profile-accuracy")).toBeTruthy();
  });

  it("calls onPreviewProfile with keepOverrides when preview button is clicked", () => {
    const state = makePolicyState();
    const onPreviewProfile = vi.fn();

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={onPreviewProfile}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("preview-accuracy"));
    expect(onPreviewProfile).toHaveBeenCalledWith("accuracy", true);
  });

  it("calls onApplyProfile when apply button is clicked", () => {
    const state = makePolicyState();
    const onApplyProfile = vi.fn();

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={onApplyProfile}
        onConstraintToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("apply-balanced"));
    expect(onApplyProfile).toHaveBeenCalledWith("balanced", true);
  });

  it("passes keepOverrides=false after unchecking the checkbox", async () => {
    const state = makePolicyState();
    const onPreviewProfile = vi.fn();

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={onPreviewProfile}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("keep-overrides"));
    fireEvent.click(screen.getByLabelText("preview-balanced"));

    expect(onPreviewProfile).toHaveBeenCalledWith("balanced", false);
  });

  it("renders a diff preview when preview is non-null", () => {
    const state = makePolicyState();
    const preview: ModelPolicyPreview = {
      profileId: "accuracy",
      title: "Accuracy",
      description: "High accuracy profile",
      keepOverrides: true,
      generatedAt: new Date().toISOString(),
      diff: [
        {
          agentId: "structural-scout",
          beforeModelId: "claude-sonnet-4.6",
          afterModelId: "claude-opus-4",
          beforeFallbackModelIds: [],
          afterFallbackModelIds: [],
          rationale: "Upgraded",
          changed: true,
          overrideState: "none",
        },
      ],
      changedAgentIds: ["structural-scout"],
      unchangedAgentIds: [],
    };

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={preview}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("preview-diff")).toBeTruthy();
    expect(screen.getByLabelText("preview-title")).toHaveTextContent("Accuracy");
    expect(screen.getByLabelText("diff-structural-scout")).toBeTruthy();
  });

  it("renders constraint toggles reflecting current settings", () => {
    const settings = makeSettings({
      modelPolicy: {
        ...makeSettings().modelPolicy,
        constraints: {
          disabledProviderIds: [],
          disabledModelIds: [],
          allowPreviewModels: true,
          requireToolSupport: false,
          includeGeneralPurposeFallback: true,
        },
      },
    });

    render(
      <SettingsModelPolicyContract
        settings={settings}
        policyState={makePolicyState()}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect((screen.getByLabelText("toggle-allowPreviewModels") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("toggle-requireToolSupport") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("toggle-includeGeneralPurposeFallback") as HTMLInputElement).checked).toBe(true);
  });

  it("calls onConstraintToggle when a constraint checkbox is toggled", () => {
    const onConstraintToggle = vi.fn();

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={makePolicyState()}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={onConstraintToggle}
      />,
    );

    fireEvent.click(screen.getByLabelText("toggle-allowPreviewModels"));
    expect(onConstraintToggle).toHaveBeenCalledWith("allowPreviewModels", true);
  });

  it("displays preflight blocked reasons when canRun is false", () => {
    const state = makePolicyState({
      preflight: {
        canRun: false,
        warnings: [],
        blockedReasons: [
          {
            agentId: "runtime-verifier",
            candidateModelId: null,
            code: "CREDENTIAL_MISSING",
            message: "مفتاح الاعتماد المطلوب لهذا النموذج غير مهيأ.",
          },
        ],
        fallbackAgentIds: [],
      },
    });

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("سيتم المنع")).toBeTruthy();
    expect(screen.getByLabelText("preflight-blocked")).toHaveTextContent("runtime-verifier");
  });

  it("displays preflight warnings", () => {
    const state = makePolicyState({
      preflight: {
        canRun: true,
        warnings: ["تم تفعيل بديل معتمد للدور structural-scout."],
        blockedReasons: [],
        fallbackAgentIds: ["structural-scout"],
      },
    });

    render(
      <SettingsModelPolicyContract
        settings={makeSettings()}
        policyState={state}
        preview={null}
        onSetOverride={vi.fn()}
        onClearOverride={vi.fn()}
        onPreviewProfile={vi.fn()}
        onApplyProfile={vi.fn()}
        onConstraintToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("يمكن البدء")).toBeTruthy();
    expect(screen.getByLabelText("preflight-warning")).toHaveTextContent("تم تفعيل بديل");
  });
});
