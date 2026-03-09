# Data Model: Desktop Electron UI (Feature 002)

**Feature Branch**: `002-desktop-electron-ui`
**Created**: 2026-03-08
**Status**: Draft
**Scope**: Electron main process + renderer IPC layer data contracts

---

## Overview

This document defines the canonical data model for the Electron desktop application that wraps the Production Readiness Crew system. All entities are TypeScript-first. Persistence uses the main process (JSON via `electron-store`); the renderer never writes to disk directly.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Settings                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ AgentConfig[] │  │ ModelConfig[]│  │RuntimePolicy │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────┬────────────────────────────────────────┘
                             │ snapshot at run-start
                             ▼
                    ┌─────────────────┐
                    │  CrewRunRecord  │◄────────── CrewWorkerEvent stream
                    │  (one per run)  │
                    └────────┬────────┘
                             │ produces
                             ▼
                  ┌──────────────────────┐
                  │  FinalReportArtifacts│
                  └──────────────────────┘

CrewWorkerEvent (discriminated union)
  ├── run.lifecycle   → updates CrewRunRecord.status
  ├── agent.status    → updates CrewRunRecord.agentStates[id]
  ├── agent.finding   → increments CrewRunRecord.findingsSummary
  ├── trace.event     → appended to raw trace log
  └── run.error       → sets CrewRunRecord.error
```

---

## 1. CrewRunStatus

```typescript
type CrewRunStatus =
  | "queued"      // accepted, not yet handed to worker
  | "starting"    // worker spawned, pre-flight checks running
  | "running"     // agents actively executing
  | "cancelling"  // cancellation requested, draining agents
  | "completed"   // all agents finished, report generated
  | "failed"      // unrecoverable error, partial report may exist
  | "cancelled";  // clean stop; partial report saved
```

### State Transition Table

| From       | To          | Trigger                                          |
|------------|-------------|--------------------------------------------------|
| —          | queued      | User presses "Start Run"                         |
| queued     | starting    | Worker thread spawned successfully               |
| queued     | failed      | Worker spawn failed (WORKER_CRASH)               |
| starting   | running     | Pre-flight checks passed                         |
| starting   | failed      | Pre-flight checks failed (CONFIG_ERROR)          |
| running    | cancelling  | User requests cancellation                       |
| running    | completed   | All agents finished, report written              |
| running    | failed      | Worker crashed mid-run (WORKER_CRASH)            |
| cancelling | cancelled   | Workers drained within 30 s                      |
| cancelling | failed      | Worker unresponsive after 30 s timeout           |

Terminal states: `completed`, `failed`, `cancelled`.

---

## 2. ErrorCode

```typescript
type ErrorCode =
  | "CONFIG_ERROR"   // bad settings or missing repo path
  | "INPUT_ERROR"    // invalid repo (not a git repo, unreadable)
  | "TOOL_ERROR"     // agent tool execution failure
  | "AGENT_ERROR"    // agent logic / timeout failure
  | "TRACE_ERROR"    // tracing subsystem failure
  | "REPORT_ERROR"   // report generation / write failure
  | "STORE_ERROR"    // disk I/O failure
  | "WORKER_CRASH";  // worker thread exited unexpectedly
```

---

## 3. CrewRunRecord

Primary persistence record. One per run.

```typescript
interface AgentRunState {
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly findingsCount: number;
  readonly errorMessage: string | null;
}

type AgentStatus =
  | "pending" | "running" | "completed" | "failed" | "skipped" | "timeout";

interface FindingsSummary {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

interface RunError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: string;
}

interface CrewRunRecord {
  readonly runId: string;               // UUID v4
  readonly repoPath: string;            // absolute local path
  status: CrewRunStatus;
  readonly startedAt: string;           // ISO-8601
  finishedAt: string | null;
  lastUpdatedAt: string;
  readonly selectedAgents: string[];
  readonly modelConfigSnapshot: Record<string, string>;
  agentStates: Record<string, AgentRunState>;
  findingsSummary: FindingsSummary;
  reportPaths: {
    markdown?: string;
    json?: string;
    traces?: string;
  };
  error: RunError | null;
  durationMs: number | null;
}
```

### Validation Rules

| Field | Rule |
|-------|------|
| `runId` | UUID v4. No duplicates. |
| `repoPath` | Absolute path. Must exist and contain `.git/`. |
| `startedAt` | Valid ISO-8601. Immutable after set. |
| `finishedAt` | Must be >= `startedAt`. Null until terminal state. |
| `findingsSummary.*` | All counts >= 0. |
| `error` | Required when `status` is `"failed"`. Null when `"completed"`. |

### Concurrency Constraint

Only one `CrewRunRecord` with a non-terminal status may exist at any time.

---

## 4. Settings

```typescript
interface AgentConfig {
  readonly agentId: string;
  enabled: boolean;
  model: string;                        // references ModelConfig.id
  enabledTools: string[];
  enabledSkills: string[];
}

interface ModelConfig {
  readonly id: string;
  readonly provider: string;
  readonly displayName: string;
  readonly contextWindowTokens: number;
  readonly supportsTools: boolean;
  readonly isDefault: boolean;
}

interface SecretsConfig {
  readonly storageBackend: "electron-safeStorage" | "system-keychain";
  readonly configuredKeys: string[];    // key names only, never values
}

interface Settings {
  readonly schemaVersion: number;
  agents: Record<string, AgentConfig>;
  models: ModelConfig[];
  secrets: SecretsConfig;
  runtime: RuntimePolicy;
  ui: UiPreferences;
}
```

### Validation Rules

| Field | Rule |
|-------|------|
| `agents[*].model` | Must match a `ModelConfig.id` in `models[]`. |
| `models` | At least one entry. Exactly one `isDefault=true` per provider. |
| `runtime.maxRunDurationMs` | >= 60000. Must be > `agentTimeoutMs`. |
| `runtime.agentTimeoutMs` | >= 10000. |
| `runtime.maxConcurrency` | Integer 1–10. |

---

## 5. RuntimePolicy

```typescript
interface RuntimePolicy {
  maxRunDurationMs: number;             // default: 1_800_000 (30 min)
  agentTimeoutMs: number;               // default: 300_000 (5 min)
  maxConcurrency: number;               // default: 5
  enableTracing: boolean;               // default: true
  persistRawTraces: boolean;            // default: false
  allowNetworkTools: boolean;           // default: true
  autoOpenReportOnCompletion: boolean;  // default: true
}
```

### Enforcement Points

- `agentTimeoutMs`: enforced per agent inside worker thread
- `maxRunDurationMs`: enforced by main process with `setTimeout`
- `maxConcurrency`: enforced by worker-side scheduler using semaphore

---

## 5.1 UiPreferences

```typescript
interface UiPreferences {
  theme: "system" | "light" | "dark";   // default: "system"
  language: "ar" | "en";                // default: "ar"
  showRawTraces: boolean;               // default: false
  defaultReportExportPath: string | null;// default: null (OS Downloads)
}
```

---

## 6. CrewWorkerEvent

Discriminated union of all Worker → Main process messages.

```typescript
interface WorkerEventBase {
  readonly runId: string;
  readonly timestamp: string;           // ISO-8601
}

// 6.1 run.lifecycle
interface RunLifecycleEvent extends WorkerEventBase {
  readonly kind: "run.lifecycle";
  readonly phase: CrewRunStatus;
}

// 6.2 agent.status
interface AgentStatusEvent extends WorkerEventBase {
  readonly kind: "agent.status";
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly timing: {
    readonly startedAt: string | null;
    readonly finishedAt: string | null;
    readonly durationMs: number | null;
  };
}

// 6.3 agent.finding
interface AgentFindingEvent extends WorkerEventBase {
  readonly kind: "agent.finding";
  readonly agentId: string;
  readonly findingSummary: {
    readonly id: string;
    readonly title: string;
    readonly severity: Severity;        // from src/types.ts
    readonly category: string;
  };
}

// 6.4 trace.event
interface TraceEvent extends WorkerEventBase {
  readonly kind: "trace.event";
  readonly traceId: string;
  readonly spanName: string;
  readonly crewEvent: CrewEvent;        // from src/tracing/tracer.ts
}

// 6.5 run.error
interface RunErrorEvent extends WorkerEventBase {
  readonly kind: "run.error";
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly agentId?: string;
    readonly details?: string;
  };
}

type CrewWorkerEvent =
  | RunLifecycleEvent
  | AgentStatusEvent
  | AgentFindingEvent
  | TraceEvent
  | RunErrorEvent;
```

---

## 7. FinalReportArtifacts

```typescript
interface FinalReportArtifacts {
  readonly runId: string;
  readonly markdownPath: string;
  readonly jsonPath: string;
  readonly tracesPath: string | null;
  readonly generatedAt: string;
  readonly findingsCount: number;
  readonly severitySummary: FindingsSummary;
  readonly overallAssessment: "ready" | "ready_with_conditions" | "not_ready";
}
```

---

## 8. Type Import Map

Types imported from the existing library (not redefined here):

| Type | Source |
|------|--------|
| `Severity` | `src/types.ts` |
| `Finding` | `src/types.ts` |
| `Evidence` | `src/types.ts` |
| `FinalReport` | `src/contracts/report-schema.ts` |
| `TracingData` | `src/contracts/report-schema.ts` |
| `CrewEvent` | `src/tracing/tracer.ts` |
| `ProductionReadinessCrewModels` | `src/types.ts` |

No type in this data model duplicates these definitions.

---

## 9. Storage Layout

```
userData/
├── settings.json           ← Settings (electron-store)
├── runs/
│   ├── <runId>.json        ← CrewRunRecord
│   └── ...
├── reports/
│   ├── <runId>.md          ← Markdown report
│   ├── <runId>.json        ← JSON report
│   └── ...
├── traces/
│   ├── <runId>.jsonl       ← Raw trace events (if persistRawTraces=true)
│   └── ...
└── logs/
    └── app.log             ← Application log
```
