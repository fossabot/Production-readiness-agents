import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, BROADCAST_CHANNELS } from "../ipc/channels.js";
import type { ElectronAPI } from "../ipc/contracts.js";
import type { CrewWorkerEvent } from "../types/events.js";
import type { RunLogEntry } from "../ipc/contracts.js";

const electronAPI: ElectronAPI = {
  // Commands
  startRun: (repoPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_START_RUN, { repoPath }),
  cancelRun: (runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_CANCEL_RUN, { runId }),
  getRun: (runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_GET_RUN, { runId }),
  listRuns: (filter, limit, offset) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_LIST_RUNS, { filter, limit, offset }),
  getReport: (runId, format) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_GET_REPORT, { runId, format }),
  exportReport: (runId, format, dest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_EXPORT_REPORT, { runId, format, destinationPath: dest }),
  deleteRun: (runId) =>
    ipcRenderer.invoke(IPC_CHANNELS.CREW_DELETE_RUN, { runId }),
  getSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  updateSettings: (partial) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, partial),
  resetSettings: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  getModelPolicyState: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_GET_STATE),
  previewPolicyProfile: (profileId, keepOverrides) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_PREVIEW_PROFILE, { profileId, keepOverrides }),
  applyPolicyProfile: (profileId, keepOverrides) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_APPLY_PROFILE, { profileId, keepOverrides }),
  listPolicySnapshots: () =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_LIST_SNAPSHOTS),
  publishPolicySnapshot: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_PUBLISH_SNAPSHOT, input),
  setPolicyOverride: (agentId, modelId, note) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_SET_OVERRIDE, { agentId, modelId, note }),
  clearPolicyOverride: (agentId) =>
    ipcRenderer.invoke(IPC_CHANNELS.MODEL_POLICY_CLEAR_OVERRIDE, { agentId }),
  selectFolder: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER),

  // Subscriptions
  onRunEvent: (callback: (event: CrewWorkerEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: CrewWorkerEvent) => callback(data);
    ipcRenderer.on(BROADCAST_CHANNELS.CREW_RUN_EVENT, handler);
    return () => { ipcRenderer.removeListener(BROADCAST_CHANNELS.CREW_RUN_EVENT, handler); };
  },
  onRunLog: (callback: (log: RunLogEntry) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: RunLogEntry) => callback(data);
    ipcRenderer.on(BROADCAST_CHANNELS.CREW_RUN_LOG, handler);
    return () => { ipcRenderer.removeListener(BROADCAST_CHANNELS.CREW_RUN_LOG, handler); };
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
