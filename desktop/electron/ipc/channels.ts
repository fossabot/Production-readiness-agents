// Command channels (Renderer → Main, request/response)
export const IPC_CHANNELS = {
  // Crew run commands
  CREW_START_RUN: "crew:start-run",
  CREW_CANCEL_RUN: "crew:cancel-run",
  CREW_GET_RUN: "crew:get-run",
  CREW_LIST_RUNS: "crew:list-runs",
  CREW_GET_REPORT: "crew:get-report",
  CREW_EXPORT_REPORT: "crew:export-report",
  CREW_DELETE_RUN: "crew:delete-run",

  // Settings commands
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",
  SETTINGS_RESET: "settings:reset",

  // Model policy commands
  MODEL_POLICY_GET_STATE: "model-policy:get-state",
  MODEL_POLICY_PREVIEW_PROFILE: "model-policy:preview-profile",
  MODEL_POLICY_APPLY_PROFILE: "model-policy:apply-profile",
  MODEL_POLICY_LIST_SNAPSHOTS: "model-policy:list-snapshots",
  MODEL_POLICY_PUBLISH_SNAPSHOT: "model-policy:publish-snapshot",
  MODEL_POLICY_SET_OVERRIDE: "model-policy:set-override",
  MODEL_POLICY_CLEAR_OVERRIDE: "model-policy:clear-override",

  // Dialog commands
  DIALOG_SELECT_FOLDER: "dialog:select-folder",
} as const;

// Broadcast channels (Main → Renderer, push)
export const BROADCAST_CHANNELS = {
  CREW_RUN_EVENT: "crew:run-event",
  CREW_RUN_LOG: "crew:run-log",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[keyof typeof BROADCAST_CHANNELS];
