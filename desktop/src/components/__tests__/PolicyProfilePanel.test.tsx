/**
 * T026 — PolicyProfilePanel component tests
 *
 * Validates:
 *  1. Renders all profiles from state.profiles
 *  2. Preview button calls onPreview with the correct profileId
 *  3. Apply button calls onApply with the correct profileId
 *  4. keepOverrides checkbox calls onToggleKeepOverrides
 *  5. When preview is non-null, renders the diff section
 *  6. Active profile gets highlighted badge
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PolicyProfilePanel } from "../PolicyProfilePanel.js";
import type {
  ModelPolicyState,
  ModelPolicyPreview,
  ModelPolicySnapshot,
  ModelPolicyProfileDefinition,
  PolicyAgentView,
} from "../../../electron/types/model-policy.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ModelPolicySnapshot> = {}): ModelPolicySnapshot {
  return {
    snapshotId: "snap-1",
    title: "Balanced",
    description: "Default",
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

function makeProfile(overrides: Partial<ModelPolicyProfileDefinition> = {}): ModelPolicyProfileDefinition {
  return {
    profileId: "balanced",
    title: "Balanced",
    description: "Default balanced profile",
    rationale: "Default",
    reviewWindowDays: 90,
    sourceLinks: [],
    assignments: {} as ModelPolicyProfileDefinition["assignments"],
    ...overrides,
  };
}

function makeState(overrides: Partial<ModelPolicyState> = {}): ModelPolicyState {
  return {
    activeSnapshot: makeSnapshot(),
    snapshots: [makeSnapshot()],
    profiles: [
      makeProfile({ profileId: "balanced", title: "Balanced" }),
      makeProfile({ profileId: "accuracy", title: "Accuracy" }),
      makeProfile({ profileId: "budget", title: "Budget" }),
    ],
    agentViews: [],
    preflight: { canRun: true, warnings: [], blockedReasons: [], fallbackAgentIds: [] },
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

function makePreview(overrides: Partial<ModelPolicyPreview> = {}): ModelPolicyPreview {
  return {
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
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PolicyProfilePanel", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders all profiles from state.profiles", () => {
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    expect(screen.getByText("Balanced")).toBeTruthy();
    expect(screen.getByText("Accuracy")).toBeTruthy();
    expect(screen.getByText("Budget")).toBeTruthy();
  });

  it("shows 'active' badge only for the profile matching activeSnapshot.profileId", () => {
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    // The active badge text is "نشط" (Arabic for "active")
    const activeBadges = screen.getAllByText("نشط");
    expect(activeBadges.length).toBe(1);
  });

  it("calls onPreview with the correct profileId when preview button is clicked", () => {
    const onPreview = vi.fn();
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={onPreview}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    // There are 3 "معاينة" (preview) buttons — click the second one (accuracy)
    const previewButtons = screen.getAllByText("معاينة");
    fireEvent.click(previewButtons[1]!);

    expect(onPreview).toHaveBeenCalledWith("accuracy");
  });

  it("calls onApply with the correct profileId when apply button is clicked", () => {
    const onApply = vi.fn();
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={onApply}
        onClearPreview={vi.fn()}
      />,
    );

    // There are 3 "تطبيق" (apply) buttons — click the first one (balanced)
    const applyButtons = screen.getAllByText("تطبيق");
    fireEvent.click(applyButtons[0]!);

    expect(onApply).toHaveBeenCalledWith("balanced");
  });

  it("calls onToggleKeepOverrides when the checkbox is toggled", () => {
    const onToggleKeepOverrides = vi.fn();
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={onToggleKeepOverrides}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    // The checkbox label text includes "الإبقاء على التخصيصات اليدوية"
    const checkbox = screen.getByText("الإبقاء على التخصيصات اليدوية").closest("label")?.querySelector("input");
    expect(checkbox).toBeTruthy();
    fireEvent.click(checkbox!);

    expect(onToggleKeepOverrides).toHaveBeenCalled();
  });

  it("does not render diff section when preview is null", () => {
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    expect(screen.queryByText("إغلاق")).toBeNull();
  });

  it("renders diff section when preview is non-null", () => {
    const preview = makePreview();
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={preview}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    // The preview title is shown
    // (note: "Accuracy" also appears as a profile title, so we find it in the diff section)
    expect(screen.getByText("إغلاق")).toBeTruthy();
    expect(screen.getByText("structural-scout")).toBeTruthy();
  });

  it("calls onClearPreview when the close button in the diff section is clicked", () => {
    const onClearPreview = vi.fn();
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={makePreview()}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={onClearPreview}
      />,
    );

    fireEvent.click(screen.getByText("إغلاق"));
    expect(onClearPreview).toHaveBeenCalled();
  });

  it("disables all interactive elements when disabled prop is true", () => {
    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={null}
        keepOverrides={true}
        disabled={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    const applyButtons = screen.getAllByText("تطبيق");
    const previewButtons = screen.getAllByText("معاينة");

    for (const button of [...applyButtons, ...previewButtons]) {
      expect(button).toBeDisabled();
    }
  });

  it("shows override state text in diff items when overrideState is not 'none'", () => {
    const preview = makePreview({
      diff: [
        {
          agentId: "structural-scout",
          beforeModelId: "claude-sonnet-4.6",
          afterModelId: "claude-opus-4",
          beforeFallbackModelIds: [],
          afterFallbackModelIds: [],
          rationale: "Upgraded",
          changed: true,
          overrideState: "kept",
        },
      ],
    });

    render(
      <PolicyProfilePanel
        state={makeState()}
        preview={preview}
        keepOverrides={true}
        onToggleKeepOverrides={vi.fn()}
        onPreview={vi.fn()}
        onApply={vi.fn()}
        onClearPreview={vi.fn()}
      />,
    );

    expect(screen.getByText(/إبقاء تخصيص/)).toBeTruthy();
  });
});
