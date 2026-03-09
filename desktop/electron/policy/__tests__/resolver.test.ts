/**
 * T027 — Policy resolver unit tests
 *
 * Validates:
 *  1. resolvePolicy resolves models from snapshot assignments
 *  2. Fallback chain is traversed when primary model is invalid
 *  3. Agent is blocked when no valid model exists in the chain
 *  4. Manual overrides are respected and take priority
 *  5. getReviewStatus returns correct status based on date
 *  6. Various blocking checks (provider disabled, preview not allowed, etc.)
 */

import { describe, it, expect } from "vitest";
import { resolvePolicy, getReviewStatus } from "../resolver.js";
import type { ModelPolicySnapshot } from "../../types/model-policy.js";
import type { Settings, ModelConfig } from "../../types/settings.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeModelConfig(overrides: Partial<ModelConfig> = {}): ModelConfig {
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

function makeSnapshot(overrides: Partial<ModelPolicySnapshot> = {}): ModelPolicySnapshot {
  return {
    snapshotId: "snap-1",
    title: "Test",
    description: "Test snapshot",
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
    assignments: {
      "structural-scout": {
        agentId: "structural-scout",
        primaryModelId: "claude-sonnet-4.6",
        fallbackModelIds: ["gpt-4o"],
        rationale: "Default",
        confidence: "high",
        role: "analysis",
        requiresTools: false,
      },
    } as unknown as ModelPolicySnapshot["assignments"],
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
    },
    models: [
      makeModelConfig({ id: "claude-sonnet-4.6", provider: "anthropic" }),
      makeModelConfig({ id: "gpt-4o", provider: "openai", displayName: "GPT-4o" }),
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
    ui: { theme: "system", language: "ar", showRawTraces: false, defaultReportExportPath: null },
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("resolvePolicy", () => {
  it("resolves the primary model when it passes all checks", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.resolvedModels["structural-scout"]).toBe("claude-sonnet-4.6");
    expect(result.preflight.canRun).toBe(true);
    expect(result.snapshot.agents["structural-scout"]?.selectedSource).toBe("policy");
    expect(result.snapshot.agents["structural-scout"]?.fallbackUsed).toBe(false);
  });

  it("falls back to the next model when primary model provider is disabled", () => {
    const settings = makeSettings({
      modelPolicy: {
        ...makeSettings().modelPolicy,
        constraints: {
          ...makeSettings().modelPolicy.constraints,
          disabledProviderIds: ["anthropic"],
        },
      },
    });
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.resolvedModels["structural-scout"]).toBe("gpt-4o");
    expect(result.preflight.canRun).toBe(true);
    expect(result.snapshot.agents["structural-scout"]?.selectedSource).toBe("fallback");
    expect(result.snapshot.agents["structural-scout"]?.fallbackUsed).toBe(true);
    expect(result.preflight.fallbackAgentIds).toContain("structural-scout");
  });

  it("blocks agent when no valid model exists in the candidate chain", () => {
    const settings = makeSettings({
      modelPolicy: {
        ...makeSettings().modelPolicy,
        constraints: {
          ...makeSettings().modelPolicy.constraints,
          disabledProviderIds: ["anthropic", "openai"],
        },
      },
    });
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.preflight.canRun).toBe(false);
    expect(result.preflight.blockedReasons.length).toBeGreaterThan(0);
    expect(result.snapshot.agents["structural-scout"]?.selectedSource).toBe("blocked");
    expect(result.snapshot.agents["structural-scout"]?.effectiveModelId).toBeNull();
  });

  it("respects manual override and uses override model first", () => {
    const settings = makeSettings({
      modelPolicy: {
        ...makeSettings().modelPolicy,
        manualOverrides: {
          "structural-scout": {
            agentId: "structural-scout",
            modelId: "gpt-4o",
            note: "Manual choice",
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.resolvedModels["structural-scout"]).toBe("gpt-4o");
    expect(result.snapshot.agents["structural-scout"]?.selectedSource).toBe("manual-override");
    expect(result.snapshot.agents["structural-scout"]?.overrideModelId).toBe("gpt-4o");
  });

  it("falls through to policy model when override model is invalid", () => {
    const settings = makeSettings({
      modelPolicy: {
        ...makeSettings().modelPolicy,
        manualOverrides: {
          "structural-scout": {
            agentId: "structural-scout",
            modelId: "nonexistent-model",
            note: null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    // Falls through from nonexistent override to primary model
    expect(result.resolvedModels["structural-scout"]).toBe("claude-sonnet-4.6");
    expect(result.snapshot.agents["structural-scout"]?.selectedSource).toBe("override-fallback");
  });

  it("blocks preview models when allowPreviewModels is false", () => {
    const settings = makeSettings({
      models: [
        makeModelConfig({ id: "preview-model", provider: "anthropic", isPreview: true }),
      ],
    });
    const snapshot = makeSnapshot({
      assignments: {
        "structural-scout": {
          agentId: "structural-scout",
          primaryModelId: "preview-model",
          fallbackModelIds: [],
          rationale: "Default",
          confidence: "high",
          role: "analysis",
          requiresTools: false,
        },
      } as unknown as ModelPolicySnapshot["assignments"],
    });

    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.preflight.canRun).toBe(false);
    expect(result.preflight.blockedReasons[0]?.code).toBe("PREVIEW_NOT_ALLOWED");
  });

  it("blocks when credential key is missing from configured secrets", () => {
    const settings = makeSettings({
      models: [
        makeModelConfig({ id: "paid-model", provider: "openai", credentialKey: "OPENAI_API_KEY" }),
      ],
      secrets: { storageBackend: "electron-safeStorage", configuredKeys: [] },
    });
    const snapshot = makeSnapshot({
      assignments: {
        "structural-scout": {
          agentId: "structural-scout",
          primaryModelId: "paid-model",
          fallbackModelIds: [],
          rationale: "Default",
          confidence: "high",
          role: "analysis",
          requiresTools: false,
        },
      } as unknown as ModelPolicySnapshot["assignments"],
    });

    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: ["structural-scout"],
    });

    expect(result.preflight.canRun).toBe(false);
    expect(result.preflight.blockedReasons[0]?.code).toBe("CREDENTIAL_MISSING");
  });

  it("skips agents that are not in the enabledAgentIds list", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const result = resolvePolicy({
      settings,
      snapshot,
      enabledAgentIds: [],
    });

    expect(Object.keys(result.resolvedModels)).toHaveLength(0);
    expect(result.preflight.canRun).toBe(true);
  });
});

describe("getReviewStatus", () => {
  it("returns 'fresh' when review date is far in the future", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(getReviewStatus(futureDate)).toBe("fresh");
  });

  it("returns 'review-soon' when review date is within 14 days", () => {
    const soonDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(getReviewStatus(soonDate)).toBe("review-soon");
  });

  it("returns 'stale' when review date is in the past", () => {
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    expect(getReviewStatus(pastDate)).toBe("stale");
  });

  it("returns 'stale' when review date is exactly now", () => {
    const now = new Date();
    expect(getReviewStatus(now.toISOString(), now)).toBe("stale");
  });

  it("returns 'review-soon' at exactly 14 days boundary", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const boundary = new Date("2026-03-15T00:00:00Z").toISOString();
    expect(getReviewStatus(boundary, now)).toBe("review-soon");
  });
});
