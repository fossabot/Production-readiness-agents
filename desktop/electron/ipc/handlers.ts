import { ipcMain, dialog, BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import path from "node:path";
import { IPC_CHANNELS, BROADCAST_CHANNELS } from "./channels.js";
import * as settingsStore from "../persistence/settings-store.js";
import * as runStore from "../persistence/run-store.js";
import * as reportStore from "../persistence/report-store.js";
import * as traceStore from "../persistence/trace-store.js";
import * as modelPolicyStore from "../persistence/model-policy-store.js";
import { BUILT_IN_PROFILES, buildSnapshotFromProfile } from "../policy/catalog.js";
import { buildProfilePreview } from "../policy/diff.js";
import { getReviewStatus, resolvePolicy } from "../policy/resolver.js";
import type { CrewEvent } from "../../../src/tracing/tracer.js";
import type { CrewRunRecord } from "../types/run.js";
import type { CrewWorkerEvent } from "../types/events.js";
import type {
  ModelPolicySnapshot,
  ModelPolicyState,
  PolicyAgentId,
} from "../types/model-policy.js";
import type {
  ApplyProfileInput,
  CancelRunInput,
  ClearOverrideInput,
  DeleteRunInput,
  ExportReportInput,
  GetReportInput,
  GetRunInput,
  ListRunsInput,
  PreviewProfileInput,
  PublishSnapshotOutput,
  SetOverrideInput,
  StartRunInput,
} from "./contracts.js";

let activeWorker: Worker | null = null;
let activeRunId: string | null = null;
let runTimeoutId: ReturnType<typeof setTimeout> | null = null;

function broadcast(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    win.webContents.send(channel, data);
  }
}

function getPolicyEnabledAgents(settings: ReturnType<typeof settingsStore.getSettings>): PolicyAgentId[] {
  const enabledAgents = Object.values(settings.agents)
    .filter((agent) => agent.enabled)
    .map((agent) => agent.agentId as PolicyAgentId);

  if (settings.modelPolicy.constraints.includeGeneralPurposeFallback) {
    enabledAgents.push("general-purpose");
  }

  return enabledAgents;
}

function syncAgentModels(
  settings: ReturnType<typeof settingsStore.getSettings>,
  snapshot: ModelPolicySnapshot,
  keepOverrides: boolean,
): ReturnType<typeof settingsStore.getSettings>["agents"] {
  const nextAgents = { ...settings.agents };

  for (const [agentId, agentConfig] of Object.entries(nextAgents)) {
    const assignment = snapshot.assignments[agentId as PolicyAgentId];
    if (!assignment) {
      continue;
    }
    const override = settings.modelPolicy.manualOverrides[agentId as PolicyAgentId] ?? null;
    nextAgents[agentId] = {
      ...agentConfig,
      model: keepOverrides && override ? override.modelId : assignment.primaryModelId,
    };
  }

  return nextAgents;
}

function buildPolicyState(settingsInput?: ReturnType<typeof settingsStore.getSettings>): ModelPolicyState {
  const settings = settingsInput ?? settingsStore.getSettings();
  const activeSnapshot = modelPolicyStore.getActiveSnapshot();
  const resolution = resolvePolicy({
    settings,
    snapshot: activeSnapshot,
    enabledAgentIds: getPolicyEnabledAgents(settings),
  });

  const visibleAgents = settings.modelPolicy.constraints.includeGeneralPurposeFallback
    ? [...Object.keys(settings.agents), "general-purpose"]
    : Object.keys(settings.agents);

  const agentViews = visibleAgents
    .filter((agentId): agentId is PolicyAgentId => agentId in activeSnapshot.assignments)
    .map((agentId) => {
      const assignment = activeSnapshot.assignments[agentId];
      const override = settings.modelPolicy.manualOverrides[agentId] ?? null;
      const resolutionRecord = resolution.snapshot.agents[agentId];
      const constraints = [
        ...(resolutionRecord?.validationNotes ?? []),
        ...(resolutionRecord?.blockedReason ? [resolutionRecord.blockedReason.message] : []),
      ];

      return {
        agentId,
        enabled: agentId === "general-purpose"
          ? settings.modelPolicy.constraints.includeGeneralPurposeFallback
          : Boolean(settings.agents[agentId]?.enabled),
        recommended: assignment,
        currentModelId: override?.modelId ?? settings.agents[agentId]?.model ?? assignment.primaryModelId,
        currentFallbackModelIds: assignment.fallbackModelIds,
        override,
        reviewStatus: getReviewStatus(activeSnapshot.reviewByDate),
        reviewByDate: activeSnapshot.reviewByDate,
        constraints,
        effectiveSource: resolutionRecord?.selectedSource ?? "policy",
        fallbackUsed: resolutionRecord?.fallbackUsed ?? false,
      };
    });

  return {
    activeSnapshot,
    snapshots: modelPolicyStore.listSnapshots(),
    profiles: BUILT_IN_PROFILES,
    agentViews,
    preflight: resolution.preflight,
    constraints: settings.modelPolicy.constraints,
    manualOverrides: settings.modelPolicy.manualOverrides,
  };
}

function emitPolicyTrace(runId: string, event: CrewEvent, persistRawTraces: boolean): void {
  const traceEvent: CrewWorkerEvent = {
    kind: "trace.event",
    runId,
    timestamp: new Date().toISOString(),
    traceId: `policy-${runId}-${Date.now()}`,
    spanName: event.type,
    crewEvent: event,
  };
  broadcast(BROADCAST_CHANNELS.CREW_RUN_EVENT, traceEvent);
  if (persistRawTraces) {
    traceStore.appendTraceEvent(runId, traceEvent);
  }
}

function buildPreflightErrorMessage(state: ModelPolicyState): string {
  return state.preflight.blockedReasons
    .map((reason) => `${reason.agentId}: ${reason.message}`)
    .join("\n");
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CREW_START_RUN, async (_event, input: StartRunInput) => {
    // FR-017: Concurrent-run prevention via both in-memory and persisted state
    if (activeWorker) {
      throw new Error("RUN_ALREADY_ACTIVE: A run is already in progress");
    }
    const existingActiveRun = await runStore.getActiveRun();
    if (existingActiveRun) {
      throw new Error(`RUN_ALREADY_ACTIVE: Run ${existingActiveRun.runId} is still active (status: ${existingActiveRun.status})`);
    }

    const { repoPath } = input;
    const runId = randomUUID();
    const settings = settingsStore.getSettings();
    const activeSnapshot = modelPolicyStore.getActiveSnapshot();
    const enabledAgents = Object.values(settings.agents)
      .filter((agent) => agent.enabled)
      .map((agent) => agent.agentId);
    const preflightStart = Date.now();
    const resolved = resolvePolicy({
      settings,
      snapshot: activeSnapshot,
      enabledAgentIds: getPolicyEnabledAgents(settings),
    });
    const preflightDurationMs = Date.now() - preflightStart;
    broadcast(BROADCAST_CHANNELS.CREW_RUN_LOG, {
      runId: "system",
      level: "info",
      message: `policy.preflight completed in ${preflightDurationMs}ms`,
      timestamp: new Date().toISOString(),
    });

    const modelSnapshot: Record<string, string> = {};
    for (const agent of Object.values(settings.agents)) {
      modelSnapshot[agent.agentId] = resolved.resolvedModels[agent.agentId] ?? agent.model;
    }

    const record: CrewRunRecord = {
      runId,
      repoPath,
      status: resolved.preflight.canRun ? "queued" : "failed",
      startedAt: new Date().toISOString(),
      finishedAt: resolved.preflight.canRun ? null : new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      selectedAgents: enabledAgents,
      modelConfigSnapshot: modelSnapshot,
      agentStates: {},
      findingsSummary: { critical: 0, high: 0, medium: 0, low: 0 },
      reportPaths: {},
      policyResolutionSnapshot: resolved.snapshot,
      error: resolved.preflight.canRun
        ? null
        : {
            code: "CONFIG_ERROR",
            message: buildPreflightErrorMessage(buildPolicyState(settings)),
          },
      durationMs: resolved.preflight.canRun ? null : 0,
    };

    if (settings.runtime.persistRawTraces) {
      const tracePath = await traceStore.openTraceLog(runId);
      record.reportPaths.traces = tracePath;
    }

    await runStore.saveRun(record);

    for (const agent of Object.values(resolved.snapshot.agents)) {
      if (agent.selectedSource === "fallback" || agent.selectedSource === "override-fallback") {
        emitPolicyTrace(runId, {
          type: "policy:fallback",
          agent: agent.agentId,
          timestamp: new Date().toISOString(),
          from_model: agent.overrideModelId ?? agent.recommendedModelId,
          to_model: agent.effectiveModelId ?? "unknown",
          reason: agent.validationNotes[0] ?? "استخدام بديل معتمد",
        }, settings.runtime.persistRawTraces);
      } else if (agent.selectedSource === "blocked" && agent.blockedReason) {
        emitPolicyTrace(runId, {
          type: "policy:blocked",
          agent: agent.agentId,
          timestamp: new Date().toISOString(),
          reason: agent.blockedReason.message,
        }, settings.runtime.persistRawTraces);
      } else if (agent.effectiveModelId) {
        emitPolicyTrace(runId, {
          type: "policy:resolved",
          agent: agent.agentId,
          timestamp: new Date().toISOString(),
          model: agent.effectiveModelId,
          source: agent.selectedSource,
        }, settings.runtime.persistRawTraces);
      }
    }

    if (!resolved.preflight.canRun) {
      throw new Error(record.error?.message ?? "Run blocked by model policy");
    }

    const workerPath = path.join(__dirname, "../../worker/crew-worker.js");
    activeWorker = new Worker(workerPath);
    activeRunId = runId;

    activeWorker.on("message", async (event: CrewWorkerEvent | { kind: string; runId: string; result?: unknown }) => {
      broadcast(BROADCAST_CHANNELS.CREW_RUN_EVENT, event);

      if ("kind" in event && settings.runtime.persistRawTraces) {
        traceStore.appendTraceEvent(runId, event as CrewWorkerEvent);
      }

      if ("kind" in event && event.kind === "run.completed" && event.result && typeof event.result === "object") {
        const result = event.result as {
          markdownReport?: string;
          jsonReport?: string;
          severitySummary?: CrewRunRecord["findingsSummary"];
        };
        const current = await runStore.getRun(runId);
        if (current) {
          if (result.markdownReport) {
            current.reportPaths.markdown = await reportStore.saveReport(runId, "markdown", result.markdownReport);
          }
          if (result.jsonReport) {
            current.reportPaths.json = await reportStore.saveReport(runId, "json", result.jsonReport);
          }
          if (result.severitySummary) {
            current.findingsSummary = result.severitySummary;
          }
          await runStore.saveRun(current);
        }
      }

      if ("kind" in event && event.kind !== "run.completed") {
        const current = await runStore.getRun(runId);
        if (!current) {
          return;
        }

        const workerEvent = event as CrewWorkerEvent;
        if (workerEvent.kind === "run.lifecycle") {
          current.status = workerEvent.phase;
          current.lastUpdatedAt = new Date().toISOString();
          if (["completed", "failed", "cancelled"].includes(workerEvent.phase)) {
            current.finishedAt = new Date().toISOString();
            current.durationMs = new Date(current.finishedAt).getTime() - new Date(current.startedAt).getTime();
            cleanupWorker();
          }
        } else if (workerEvent.kind === "agent.status") {
          current.agentStates[workerEvent.agentId] = {
            agentId: workerEvent.agentId,
            status: workerEvent.status,
            startedAt: workerEvent.timing.startedAt,
            finishedAt: workerEvent.timing.finishedAt,
            durationMs: workerEvent.timing.durationMs,
            findingsCount: current.agentStates[workerEvent.agentId]?.findingsCount ?? 0,
            errorMessage: null,
          };
          current.lastUpdatedAt = new Date().toISOString();
        } else if (workerEvent.kind === "agent.finding") {
          const severity = workerEvent.findingSummary.severity.toLowerCase() as keyof typeof current.findingsSummary;
          if (severity in current.findingsSummary) {
            current.findingsSummary = {
              ...current.findingsSummary,
              [severity]: current.findingsSummary[severity] + 1,
            };
          }
          if (current.agentStates[workerEvent.agentId]) {
            current.agentStates[workerEvent.agentId] = {
              ...current.agentStates[workerEvent.agentId],
              findingsCount: current.agentStates[workerEvent.agentId].findingsCount + 1,
            };
          }
          current.lastUpdatedAt = new Date().toISOString();
        } else if (workerEvent.kind === "run.error") {
          const nextError: {
            code: typeof workerEvent.error.code;
            message: string;
            details?: string;
          } = {
            code: workerEvent.error.code,
            message: workerEvent.error.message,
          };
          if (workerEvent.error.details) {
            nextError.details = workerEvent.error.details;
          }
          current.error = nextError;
          current.lastUpdatedAt = new Date().toISOString();
          if (current.policyResolutionSnapshot) {
            current.policyResolutionSnapshot = {
              ...current.policyResolutionSnapshot,
              runtimeFailure: {
                message: workerEvent.error.message,
                recordedAt: new Date().toISOString(),
              },
            };
            emitPolicyTrace(runId, {
              type: "policy:runtime-failed",
              agent: workerEvent.error.agentId ?? "runtime-verifier",
              timestamp: new Date().toISOString(),
              reason: workerEvent.error.message,
            }, settings.runtime.persistRawTraces);
          }
        }

        await runStore.saveRun(current);
      }
    });

    activeWorker.on("error", async (err) => {
      const current = await runStore.getRun(runId);
      if (current && !["completed", "failed", "cancelled"].includes(current.status)) {
        current.status = "failed";
        current.error = { code: "WORKER_CRASH", message: err.message };
        current.finishedAt = new Date().toISOString();
        current.durationMs = new Date(current.finishedAt).getTime() - new Date(current.startedAt).getTime();
        current.lastUpdatedAt = new Date().toISOString();
        if (current.policyResolutionSnapshot) {
          current.policyResolutionSnapshot = {
            ...current.policyResolutionSnapshot,
            runtimeFailure: {
              message: err.message,
              recordedAt: new Date().toISOString(),
            },
          };
        }
        await runStore.saveRun(current);
      }
      broadcast(BROADCAST_CHANNELS.CREW_RUN_EVENT, {
        kind: "run.error",
        runId,
        timestamp: new Date().toISOString(),
        error: { code: "WORKER_CRASH", message: err.message },
      });
      cleanupWorker();
    });

    activeWorker.on("exit", (code) => {
      if (code !== 0) {
        cleanupWorker();
      }
    });

    if (settings.runtime.maxRunDurationMs > 0) {
      runTimeoutId = setTimeout(async () => {
        if (activeWorker && activeRunId === runId) {
          activeWorker.postMessage({ type: "CANCEL" });
          setTimeout(() => {
            if (activeWorker && activeRunId === runId) {
              activeWorker.terminate();
              cleanupWorker();
            }
          }, 30_000);
        }
      }, settings.runtime.maxRunDurationMs);
    }

    activeWorker.postMessage({
      type: "START_RUN",
      runId,
      repoPath,
      agents: enabledAgents,
      models: resolved.resolvedModels,
      policy: settings.runtime,
      policyResolutionSnapshot: resolved.snapshot,
    });

    return { runId };
  });

  ipcMain.handle(IPC_CHANNELS.CREW_CANCEL_RUN, async (_event, input: CancelRunInput) => {
    if (!activeWorker || activeRunId !== input.runId) {
      return { success: false };
    }
    activeWorker.postMessage({ type: "CANCEL" });
    setTimeout(() => {
      if (activeWorker && activeRunId === input.runId) {
        activeWorker.terminate();
        cleanupWorker();
      }
    }, 30_000);

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CREW_GET_RUN, async (_event, input: GetRunInput) => {
    const record = await runStore.getRun(input.runId);
    if (!record) {
      throw new Error(`Run ${input.runId} not found`);
    }
    return record;
  });

  ipcMain.handle(IPC_CHANNELS.CREW_LIST_RUNS, async (_event, input: ListRunsInput) => {
    return runStore.listRuns(input.filter, input.limit, input.offset);
  });

  ipcMain.handle(IPC_CHANNELS.CREW_GET_REPORT, async (_event, input: GetReportInput) => {
    const report = await reportStore.getReport(input.runId, input.format);
    if (!report) {
      throw new Error(`Report for run ${input.runId} (${input.format}) not found`);
    }
    return report;
  });

  ipcMain.handle(IPC_CHANNELS.CREW_EXPORT_REPORT, async (_event, input: ExportReportInput) => {
    return reportStore.exportReport(input.runId, input.format, input.destinationPath);
  });

  ipcMain.handle(IPC_CHANNELS.CREW_DELETE_RUN, async (_event, input: DeleteRunInput) => {
    const success = await runStore.deleteRun(input.runId);
    if (success) {
      await reportStore.deleteReports(input.runId);
      await traceStore.deleteTraces(input.runId);
    }
    return { success };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => settingsStore.getSettings());

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_event, partial) => {
    return settingsStore.updateSettings(partial);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    return settingsStore.resetSettings();
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_GET_STATE, async () => {
    const start = Date.now();
    const result = buildPolicyState();
    const durationMs = Date.now() - start;
    broadcast(BROADCAST_CHANNELS.CREW_RUN_LOG, {
      runId: "system",
      level: "info",
      message: `policy.load completed in ${durationMs}ms`,
      timestamp: new Date().toISOString(),
    });
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, async (_event, input: PreviewProfileInput) => {
    const start = Date.now();
    const settings = settingsStore.getSettings();
    const currentSnapshot = modelPolicyStore.getActiveSnapshot();
    const nextSnapshot = buildSnapshotFromProfile(input.profileId);
    const result = buildProfilePreview(currentSnapshot, nextSnapshot, settings.modelPolicy.manualOverrides, input.keepOverrides);
    const durationMs = Date.now() - start;
    broadcast(BROADCAST_CHANNELS.CREW_RUN_LOG, {
      runId: "system",
      level: "info",
      message: `policy.previewProfile completed in ${durationMs}ms`,
      timestamp: new Date().toISOString(),
    });
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, async (_event, input: ApplyProfileInput) => {
    const snapshot = modelPolicyStore.applyProfile(input.profileId);
    const currentSettings = settingsStore.getSettings();
    const manualOverrides = input.keepOverrides ? currentSettings.modelPolicy.manualOverrides : {};
    const updatedSettings = settingsStore.updateSettings({
      agents: syncAgentModels(
        {
          ...currentSettings,
          modelPolicy: {
            ...currentSettings.modelPolicy,
            manualOverrides,
          },
        },
        snapshot,
        input.keepOverrides,
      ),
      modelPolicy: {
        ...currentSettings.modelPolicy,
        activeSnapshotId: snapshot.snapshotId,
        lastAppliedProfileId: input.profileId,
        manualOverrides,
      },
    });
    return buildPolicyState(updatedSettings);
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS, async () => {
    return modelPolicyStore.listSnapshots();
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, async (_event, input): Promise<PublishSnapshotOutput> => {
    const reviewer = typeof input?.reviewer === "string" ? input.reviewer.trim() : "";
    const sourceLinks = Array.isArray(input?.sourceLinks)
      ? input.sourceLinks.map((item: string) => item.trim()).filter(Boolean)
      : [];

    if (!reviewer) {
      throw new Error("اسم المراجع مطلوب قبل نشر السياسة.");
    }
    if (sourceLinks.length === 0) {
      throw new Error("يجب توفير مصدر رسمي واحد على الأقل قبل النشر.");
    }

    const snapshot = modelPolicyStore.publishActiveSnapshot({
      reviewer,
      approvalNotes: typeof input?.approvalNotes === "string" ? input.approvalNotes.trim() || null : null,
      reviewByDate: typeof input?.reviewByDate === "string" && input.reviewByDate
        ? input.reviewByDate
        : modelPolicyStore.getActiveSnapshot().reviewByDate,
      sourceLinks,
    });
    const updatedSettings = settingsStore.updateSettings({
      modelPolicy: {
        ...settingsStore.getSettings().modelPolicy,
        activeSnapshotId: snapshot.snapshotId,
      },
    });
    return {
      snapshot,
      state: buildPolicyState(updatedSettings),
    };
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, async (_event, input: SetOverrideInput) => {
    settingsStore.setManualOverride(input.agentId, input.modelId, input.note ?? null);
    return buildPolicyState();
  });

  ipcMain.handle(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, async (_event, input: ClearOverrideInput) => {
    const activeSnapshot = modelPolicyStore.getActiveSnapshot();
    const assignment = activeSnapshot.assignments[input.agentId];
    settingsStore.clearManualOverride(input.agentId, assignment.primaryModelId);
    return buildPolicyState();
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return { path: result.canceled ? null : result.filePaths[0] ?? null };
  });
}

function cleanupWorker(): void {
  if (runTimeoutId) {
    clearTimeout(runTimeoutId);
    runTimeoutId = null;
  }
  if (activeRunId) {
    traceStore.closeTraceLog(activeRunId);
  }
  activeWorker = null;
  activeRunId = null;
}
