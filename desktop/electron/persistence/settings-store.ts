import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_POLICY_PROFILE_ID,
  MODEL_CATALOG,
  getDefaultAgentModelIds,
} from "../policy/catalog.js";
import {
  bootstrapActiveSnapshot,
  getActiveSnapshot,
} from "./model-policy-store.js";
import type { AgentConfig, Settings } from "../types/settings.js";
import {
  DEFAULT_MODEL_POLICY_SETTINGS,
  DEFAULT_RUNTIME_POLICY,
  DEFAULT_UI_PREFERENCES,
} from "../types/settings.js";
import type { PolicyAgentId } from "../types/model-policy.js";
import { credentialStore, CREDENTIAL_ACCOUNTS, type CredentialAccount } from "../runtime/credential-store.js";

const SCHEMA_VERSION = 2;
const DEFAULT_AGENT_MODELS = getDefaultAgentModelIds();

function createDefaultAgents(): Record<string, AgentConfig> {
  return {
    "structural-scout": { agentId: "structural-scout", enabled: true, model: DEFAULT_AGENT_MODELS["structural-scout"], enabledTools: [], enabledSkills: [] },
    "code-performance-auditor": { agentId: "code-performance-auditor", enabled: true, model: DEFAULT_AGENT_MODELS["code-performance-auditor"], enabledTools: [], enabledSkills: [] },
    "security-resilience-auditor": { agentId: "security-resilience-auditor", enabled: true, model: DEFAULT_AGENT_MODELS["security-resilience-auditor"], enabledTools: [], enabledSkills: [] },
    "testing-auditor": { agentId: "testing-auditor", enabled: true, model: DEFAULT_AGENT_MODELS["testing-auditor"], enabledTools: [], enabledSkills: [] },
    "infrastructure-auditor": { agentId: "infrastructure-auditor", enabled: true, model: DEFAULT_AGENT_MODELS["infrastructure-auditor"], enabledTools: [], enabledSkills: [] },
    "docs-compliance-auditor": { agentId: "docs-compliance-auditor", enabled: true, model: DEFAULT_AGENT_MODELS["docs-compliance-auditor"], enabledTools: [], enabledSkills: [] },
    "runtime-verifier": { agentId: "runtime-verifier", enabled: true, model: DEFAULT_AGENT_MODELS["runtime-verifier"], enabledTools: [], enabledSkills: [] },
    "report-synthesizer": { agentId: "report-synthesizer", enabled: true, model: DEFAULT_AGENT_MODELS["report-synthesizer"], enabledTools: [], enabledSkills: [] },
  };
}

function createDefaultSettings(): Settings {
  const activeSnapshot = bootstrapActiveSnapshot();

  return {
    schemaVersion: SCHEMA_VERSION,
    agents: createDefaultAgents(),
    models: MODEL_CATALOG,
    secrets: {
      storageBackend: "electron-safeStorage",
      configuredKeys: [],
    },
    runtime: DEFAULT_RUNTIME_POLICY,
    ui: DEFAULT_UI_PREFERENCES,
    modelPolicy: {
      ...DEFAULT_MODEL_POLICY_SETTINGS,
      activeSnapshotId: activeSnapshot.snapshotId,
      lastAppliedProfileId: activeSnapshot.profileId ?? DEFAULT_POLICY_PROFILE_ID,
    },
  };
}

const DEFAULT_SETTINGS: Settings = createDefaultSettings();

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function saveToDisk(settings: Settings): void {
  const dir = path.dirname(getSettingsPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");
}

function migrateSettings(raw: unknown): Settings {
  const currentDefaults = createDefaultSettings();
  if (!raw || typeof raw !== "object") {
    return currentDefaults;
  }

  const parsed = raw as Partial<Settings> & {
    agents?: Record<string, Partial<AgentConfig>>;
    modelPolicy?: Partial<Settings["modelPolicy"]>;
  };

  const activeSnapshot = getActiveSnapshot();
  const models = Array.isArray(parsed.models) && parsed.models.length > 0 ? parsed.models : currentDefaults.models;
  const defaultModels = getDefaultAgentModelIds();

  const mergedAgents = Object.fromEntries(
    Object.entries(currentDefaults.agents).map(([agentId, defaults]) => {
      const existing = parsed.agents?.[agentId];
      return [
        agentId,
        {
          ...defaults,
          ...existing,
          model: existing?.model ?? defaultModels[agentId] ?? defaults.model,
          enabledTools: existing?.enabledTools ?? defaults.enabledTools,
          enabledSkills: existing?.enabledSkills ?? defaults.enabledSkills,
        } satisfies AgentConfig,
      ];
    }),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    agents: mergedAgents,
    models,
    secrets: parsed.secrets ?? currentDefaults.secrets,
    runtime: { ...currentDefaults.runtime, ...(parsed.runtime ?? {}) },
    ui: { ...currentDefaults.ui, ...(parsed.ui ?? {}) },
    modelPolicy: {
      ...currentDefaults.modelPolicy,
      ...(parsed.modelPolicy ?? {}),
      activeSnapshotId: parsed.modelPolicy?.activeSnapshotId ?? activeSnapshot.snapshotId,
      lastAppliedProfileId: parsed.modelPolicy?.lastAppliedProfileId ?? activeSnapshot.profileId ?? DEFAULT_POLICY_PROFILE_ID,
      constraints: {
        ...currentDefaults.modelPolicy.constraints,
        ...(parsed.modelPolicy?.constraints ?? {}),
      },
      manualOverrides: parsed.modelPolicy?.manualOverrides ?? currentDefaults.modelPolicy.manualOverrides,
    },
  };
}

function loadFromDisk(): Settings {
  try {
    const data = readFileSync(getSettingsPath(), "utf-8");
    return migrateSettings(JSON.parse(data));
  } catch {
    return createDefaultSettings();
  }
}

let cachedSettings: Settings | null = null;

export function getSettings(): Settings {
  if (!cachedSettings) {
    cachedSettings = loadFromDisk();
  }
  return cachedSettings;
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const current = getSettings();
  const updated: Settings = {
    ...current,
    ...partial,
    runtime: partial.runtime ? { ...current.runtime, ...partial.runtime } : current.runtime,
    ui: partial.ui ? { ...current.ui, ...partial.ui } : current.ui,
    modelPolicy: partial.modelPolicy
      ? {
          ...current.modelPolicy,
          ...partial.modelPolicy,
          constraints: partial.modelPolicy.constraints
            ? { ...current.modelPolicy.constraints, ...partial.modelPolicy.constraints }
            : current.modelPolicy.constraints,
          manualOverrides: partial.modelPolicy.manualOverrides
            ? { ...current.modelPolicy.manualOverrides, ...partial.modelPolicy.manualOverrides }
            : current.modelPolicy.manualOverrides,
        }
      : current.modelPolicy,
  };
  cachedSettings = updated;
  saveToDisk(updated);
  return updated;
}

export function setManualOverride(agentId: PolicyAgentId, modelId: string, note: string | null): Settings {
  const current = getSettings();
  const nextOverrides = {
    ...current.modelPolicy.manualOverrides,
    [agentId]: {
      agentId,
      modelId,
      note,
      updatedAt: new Date().toISOString(),
    },
  };
  return updateSettings({
    agents: {
      ...current.agents,
      [agentId]: current.agents[agentId]
        ? { ...current.agents[agentId], model: modelId }
        : current.agents[agentId],
    },
    modelPolicy: {
      ...current.modelPolicy,
      manualOverrides: nextOverrides,
    },
  });
}

export function clearManualOverride(agentId: PolicyAgentId, fallbackModelId: string): Settings {
  const current = getSettings();
  const nextOverrides = { ...current.modelPolicy.manualOverrides };
  delete nextOverrides[agentId];

  return updateSettings({
    agents: {
      ...current.agents,
      [agentId]: current.agents[agentId]
        ? { ...current.agents[agentId], model: fallbackModelId }
        : current.agents[agentId],
    },
    modelPolicy: {
      ...current.modelPolicy,
      manualOverrides: nextOverrides,
    },
  });
}

export function resetSettings(): Settings {
  cachedSettings = createDefaultSettings();
  saveToDisk(cachedSettings);
  return cachedSettings;
}

export { DEFAULT_SETTINGS };

// ─── FR-016: Credential management via OS keychain ──────────────────────────

/**
 * Stores an API key in the OS keychain and updates the configured keys list.
 * Credentials are NEVER stored in settings.json (plaintext).
 */
export async function setApiKey(account: CredentialAccount, apiKey: string): Promise<Settings> {
  await credentialStore.set(account, apiKey);
  const current = getSettings();
  const configuredKeys = [...new Set([...current.secrets.configuredKeys, account])];
  return updateSettings({
    secrets: { ...current.secrets, configuredKeys },
  });
}

/**
 * Retrieves an API key from the OS keychain.
 */
export async function getApiKey(account: CredentialAccount): Promise<string | null> {
  return credentialStore.get(account);
}

/**
 * Removes an API key from the OS keychain and updates the configured keys list.
 */
export async function deleteApiKey(account: CredentialAccount): Promise<Settings> {
  await credentialStore.delete(account);
  const current = getSettings();
  const configuredKeys = current.secrets.configuredKeys.filter((k) => k !== account);
  return updateSettings({
    secrets: { ...current.secrets, configuredKeys },
  });
}

export { CREDENTIAL_ACCOUNTS };
