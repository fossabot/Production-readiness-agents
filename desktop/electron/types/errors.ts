// ErrorCode taxonomy for all IPC and worker errors
export type ErrorCode =
  | "CONFIG_ERROR"   // bad settings or missing repo path
  | "INPUT_ERROR"    // invalid repo (not a git repo, unreadable)
  | "TOOL_ERROR"     // agent tool execution failure
  | "AGENT_ERROR"    // agent logic / timeout failure
  | "TRACE_ERROR"    // tracing subsystem failure
  | "REPORT_ERROR"   // report generation / write failure
  | "STORE_ERROR"    // disk I/O failure
  | "WORKER_CRASH";  // worker thread exited unexpectedly

export interface IpcError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: string;
}

// Error taxonomy for desktop runtime (IPC Contract §Error Taxonomy)

export type RuntimeErrorCode =
  | 'CONFIG_ERROR'
  | 'RUNTIME_ASSET_ERROR'
  | 'AGENT_ERROR'
  | 'WORKER_CRASH'
  | 'REPORT_STORE_ERROR'
  | 'TRACE_STORE_ERROR'
  | 'RUN_ALREADY_ACTIVE';

export interface RuntimeError {
  readonly code: RuntimeErrorCode;
  readonly message: string;
  readonly details?: string;
  readonly affectedPath?: string;
  readonly remediationHint?: string;
}

export function createRuntimeError(
  code: RuntimeErrorCode,
  message: string,
  options?: {
    details?: string;
    affectedPath?: string;
    remediationHint?: string;
  },
): RuntimeError {
  return {
    code,
    message,
    ...options,
  };
}

export const ERROR_MESSAGES: Record<RuntimeErrorCode, string> = {
  CONFIG_ERROR: 'Invalid configuration or missing credentials',
  RUNTIME_ASSET_ERROR: 'Missing or unresolved runtime dependency',
  AGENT_ERROR: 'Crew execution failed during agent work',
  WORKER_CRASH: 'Worker thread exited unexpectedly',
  REPORT_STORE_ERROR: 'Report persistence failed',
  TRACE_STORE_ERROR: 'Trace persistence failed',
  RUN_ALREADY_ACTIVE: 'A run is already in progress',
};
