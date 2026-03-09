# Contract: Desktop Runtime IPC

**Feature Branch**: `codex/004-production-hardening`  
**Scope**: Renderer-to-main-process runtime execution and reporting after production hardening

## Overview

The desktop app already exposes run, report, and settings IPC APIs. This feature does not replace those channels; it strengthens their guarantees. The hardened contract ensures that `CREW_START_RUN` triggers a real end-to-end execution path, packaged/runtime asset failures are surfaced explicitly, and persisted run/report state is sufficient for history, report, and release-gate evidence.

## Command Channels

| Channel | Request | Response | Hardening expectation |
|---------|---------|----------|-----------------------|
| `CREW_START_RUN` | `StartRunInput` | `StartRunOutput` | Starts a real run or fails early with a concrete runtime/config error. It must not throw the placeholder "not yet implemented" path. |
| `CREW_CANCEL_RUN` | `CancelRunInput` | `CancelRunOutput` | Cancels the active run and finalizes state consistently. |
| `CREW_GET_RUN` | `GetRunInput` | `CrewRunRecord` | Returns the latest persisted run state including policy snapshot, errors, and report paths. |
| `CREW_LIST_RUNS` | `ListRunsInput` | `ListRunsOutput` | Lists persisted run history for the repo or all repos. |
| `CREW_GET_REPORT` | `GetReportInput` | `GetReportOutput` | Returns stored Markdown or JSON report content. |
| `CREW_EXPORT_REPORT` | `ExportReportInput` | `ExportReportOutput` | Writes a stored report to a user-selected destination. |
| `CREW_DELETE_RUN` | `DeleteRunInput` | `DeleteRunOutput` | Deletes run, report, and trace artifacts together. |

## Request / Response Types

### `CREW_START_RUN`

```ts
interface StartRunInput {
  readonly repoPath: string;
  readonly selectedAgents?: string[];  // Defaults to full crew topology if omitted
}

interface StartRunOutput {
  readonly runId: string;
}
```

### Run record returned by `CREW_GET_RUN`

```ts
interface CrewRunRecord {
  readonly runId: string;
  readonly repoPath: string;
  readonly status: "queued" | "starting" | "running" | "completed" | "failed" | "cancelled";
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly lastUpdatedAt: string;
  readonly selectedAgents: string[];
  readonly modelConfigSnapshot: Record<string, string>;
  readonly policyResolutionSnapshot: RunPolicyResolutionSnapshot | null;
  readonly reportPaths: {
    markdown?: string;
    json?: string;
    traces?: string;
  };
  readonly findingsSummary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  readonly error: RunError | null;
  readonly durationMs: number | null;
}
```

### Report retrieval

```ts
interface GetReportInput {
  readonly runId: string;
  readonly format: "markdown" | "json";
}

interface GetReportOutput {
  readonly content: string;
  readonly path: string;
}
```

## Broadcast Events

The main process must continue to publish worker progress through the existing broadcast channel used by the renderer:

```ts
type CrewWorkerEvent =
  | RunLifecycleEvent
  | AgentStatusEvent
  | AgentFindingEvent
  | TraceEvent
  | RunErrorEvent;
```

### Required event semantics

- `run.lifecycle` must move through `starting`, `running`, and one terminal state.
- `trace.event` must include policy-resolution and runtime-failure evidence when tracing is enabled.
- `run.error` must be emitted for runtime asset failures, worker crashes, report persistence failures, and agent failures.
- `run.completed` must only be sent after report persistence is attempted and the run record is updated.
- `run.completed` may indicate partial completion where some agents succeeded and others failed (e.g., due to provider unavailability). In this case, `CrewRunRecord.findingsSummary` reflects only successful agent outputs. Failed agents must be recorded with their failure reason in the run record.

## Error Taxonomy

| Code | Meaning | Expected renderer behavior |
|------|---------|----------------------------|
| `CONFIG_ERROR` | Invalid repo input, missing credentials, or blocked policy state | Show actionable error before or during run start. |
| `RUNTIME_ASSET_ERROR` | Missing or unresolved crew-library asset, worker entry, or packaged runtime dependency | Block execution and identify the missing asset path. |
| `AGENT_ERROR` | Crew execution failed during agent work | Persist failed run and surface the message in history/report. |
| `WORKER_CRASH` | Worker thread exited unexpectedly | Persist failed run and mark as blocking. |
| `REPORT_STORE_ERROR` | Markdown/JSON report persistence failed | Keep failure evidence and expose it in run details. |
| `TRACE_STORE_ERROR` | Trace persistence failed after tracing was requested | Surface as failure or blocking warning depending on release context. |
| `RUN_ALREADY_ACTIVE` | A run is already in progress for this application instance | Block the new run request and show the active run status. |

## Compatibility Rules

- Renderer code must remain able to call the API through `window.electronAPI` and `desktop/src/lib/ipc-client.ts`.
- A run must always persist a `CrewRunRecord` before worker execution begins so release and history flows can audit blocked runs.
- The runtime contract must remain valid for both development and packaged execution.
- Credentials (API keys, tokens) must be stored via OS keychain integration (Keytar / DPAPI) and must never be persisted as plaintext in `settings.json` or any file on disk.
- Only one active run (queued, starting, or running) is permitted at any time. `CREW_START_RUN` must return `RUN_ALREADY_ACTIVE` if an active run exists.
