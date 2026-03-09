# IPC Contract: Desktop Electron UI

**Feature Branch**: `002-desktop-electron-ui`
**Created**: 2026-03-08

## Commands (Renderer → Main)

All commands use `ipcRenderer.invoke` / `ipcMain.handle` pattern (request/response).

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `crew:start-run` | `{ repoPath: string }` | `{ runId: string }` | Start a new production readiness audit |
| `crew:cancel-run` | `{ runId: string }` | `{ success: boolean }` | Cancel an active run |
| `crew:get-run` | `{ runId: string }` | `CrewRunRecord` | Get current state of a run |
| `crew:list-runs` | `{ filter?: { repoPath?: string }, limit?: number, offset?: number }` | `{ runs: CrewRunRecord[], total: number }` | List historical runs |
| `crew:get-report` | `{ runId: string, format: "markdown" \| "json" }` | `{ content: string, path: string }` | Read report file content |
| `crew:export-report` | `{ runId: string, format: "markdown" \| "json", destinationPath: string }` | `{ success: boolean, path: string }` | Export report to user-chosen path |
| `crew:delete-run` | `{ runId: string }` | `{ success: boolean }` | Delete run record and associated files |
| `settings:get` | `void` | `Settings` | Get current settings |
| `settings:update` | `Partial<Settings>` | `Settings` | Update and persist settings |
| `settings:reset` | `void` | `Settings` | Reset to defaults |
| `dialog:select-folder` | `void` | `{ path: string \| null }` | Open native folder picker |

## Broadcast Channels (Main → Renderer)

All channels use `ipcMain.send` / `ipcRenderer.on` pattern (push).

| Channel | Payload | Description |
|---------|---------|-------------|
| `crew:run-event` | `CrewWorkerEvent` | All worker events (lifecycle, agent status, findings, traces, errors) |
| `crew:run-log` | `{ runId: string, level: "info" \| "warn" \| "error", message: string, timestamp: string }` | Structured log entries |

## Error Responses

All commands may return an error envelope:

```typescript
interface IpcError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: string;
}
```

Error codes: `CONFIG_ERROR`, `INPUT_ERROR`, `TOOL_ERROR`, `AGENT_ERROR`, `TRACE_ERROR`, `REPORT_ERROR`, `STORE_ERROR`, `WORKER_CRASH`.

## Worker Messages (Main ↔ Worker Thread)

### Main → Worker

| Message Type | Payload | Description |
|-------------|---------|-------------|
| `START_RUN` | `{ runId: string, repoPath: string, agents: AgentConfig[], models: Record<string,string>, policy: RuntimePolicy }` | Begin audit |
| `CANCEL` | `void` | Request graceful cancellation |

### Worker → Main

All messages are `CrewWorkerEvent` (see data-model.md §6).

## Preload API (contextBridge)

```typescript
interface ElectronAPI {
  // Commands
  startRun(repoPath: string): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<{ success: boolean }>;
  getRun(runId: string): Promise<CrewRunRecord>;
  listRuns(filter?: RunFilter): Promise<{ runs: CrewRunRecord[]; total: number }>;
  getReport(runId: string, format: "markdown" | "json"): Promise<{ content: string; path: string }>;
  exportReport(runId: string, format: "markdown" | "json", dest: string): Promise<{ success: boolean; path: string }>;
  deleteRun(runId: string): Promise<{ success: boolean }>;
  getSettings(): Promise<Settings>;
  updateSettings(partial: Partial<Settings>): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  selectFolder(): Promise<{ path: string | null }>;

  // Subscriptions
  onRunEvent(callback: (event: CrewWorkerEvent) => void): () => void;
  onRunLog(callback: (log: RunLog) => void): () => void;
}
```
