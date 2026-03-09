# Data Model: Desktop Production Hardening

**Feature Branch**: `codex/004-production-hardening`  
**Created**: 2026-03-08  
**Status**: Draft

## Overview

This feature extends the existing desktop persistence model with explicit runtime execution evidence, release-gate evidence, packaged-artifact metadata, smoke-validation records, and release sign-off state. The design intentionally reuses the current `CrewRunRecord`, report store, trace store, and model-policy snapshot structures while adding the missing entities required for production-readiness decisions.

## Entity Relationship Summary

```text
ReleaseCandidateArtifact ── has one ── RuntimeAssetManifest
ReleaseCandidateArtifact ── has many ── SmokeValidationRecord
ReleaseCandidateArtifact ── has one ── ReleaseGateResult
ReleaseGateResult ── has many ── ReleaseGateCheck
ReleaseGateResult ── references many ── RuntimeExecutionSession
ReleaseSignOffChecklist ── references one ── ReleaseCandidateArtifact
ReleaseSignOffChecklist ── references one ── ReleaseGateResult

RuntimeExecutionSession ── has many ── RuntimeExecutionStep
RuntimeExecutionSession ── stores one ── RunPolicyResolutionSnapshot
RuntimeExecutionSession ── stores many ── TraceEvent / report paths
```

## 1. RuntimeExecutionSession

Represents a single user-initiated desktop run from UI start through final report or controlled failure.

```ts
// "completed" covers both full and partial success (FR-018).
// When some agents fail but others succeed, the session is still
// "completed"; inspect findingsSummary and error/failures for details.
type RuntimeExecutionStatus =
  | "queued"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

interface RuntimeExecutionSession {
  readonly runId: string;
  readonly repoPath: string;
  readonly startedAt: string;
  finishedAt: string | null;
  status: RuntimeExecutionStatus;
  readonly selectedAgents: string[];
  readonly modelConfigSnapshot: Record<string, string>;
  readonly policyResolutionSnapshot: RunPolicyResolutionSnapshot | null;
  readonly runtimeVersion: string;
  readonly packagedExecution: boolean;
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
  error: {
    code: string;
    message: string;
    details?: string;
  } | null;
}
```

### Validation Rules

- `repoPath` must exist before the session can move from `queued` to `starting`.
- `policyResolutionSnapshot` must be present for every non-cancelled session.
- `packagedExecution=true` requires a resolved runtime asset path from the staged build.
- A session must never finish with placeholder runtime text recorded as the primary error.
- **Concurrent run prevention (FR-017):** Only one session may be in an active state (`queued`, `starting`, or `running`) at any time. A new session must not be created while an active session exists.
- **Partial completion (FR-018):** A session with status `completed` may have a mix of successful and failed agent results. The `findingsSummary` reflects only successful agent outputs. Failed agents must be recorded in the `error` field or a dedicated failures list.
- If a completed session produces an empty or structurally invalid report (missing required sections, zero findings with no explanation, or unparseable JSON/Markdown), the session status must be updated to `failed` with error code `REPORT_STORE_ERROR` and the malformed report file must be preserved at its original path for debugging purposes.

### State Transitions

```text
queued -> starting -> running -> completed
                         ├-> failed
                         └-> cancelled
queued -> failed         (preflight or runtime-asset failure before worker start)
```

## 2. RuntimeExecutionStep

Represents one important execution step inside a session, including runtime setup, crew invocation, persistence, and export.

```ts
type RuntimeStepKind =
  | "resolve-assets"
  | "resolve-policy"
  | "create-worker"
  | "run-crew"
  | "persist-report"
  | "persist-trace"
  | "finalize-run";

interface RuntimeExecutionStep {
  readonly runId: string;
  readonly stepId: string;
  readonly kind: RuntimeStepKind;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly durationMs: number | null;
  readonly success: boolean;
  readonly logExcerpt: string | null;
  readonly errorMessage: string | null;
}
```

### Validation Rules

- Steps must be ordered by actual execution time.
- Any failed `persist-report` or `persist-trace` step must surface a user-visible error in the session.
- At least one `run-crew` step is required for every session that reaches `running`.

## 3. ReleaseGateResult

Captures the outcome of a single release-gate invocation for a specific candidate.

```ts
type ReleaseGateStatus = "pending" | "running" | "passed" | "failed" | "cancelled";
// Storage lifecycle type. The release-gate output artifact (see release-gate-contract.md)
// uses only terminal states: "passed" | "failed" | "cancelled".
// "pending" and "running" are transient states that appear only in persisted lifecycle records.

interface ReleaseGateResult {
  readonly gateRunId: string;
  readonly candidateId: string;
  readonly startedAt: string;
  finishedAt: string | null;
  status: ReleaseGateStatus;
  readonly platform: "win" | "mac" | "linux" | "current";
  readonly summary: string;
  readonly blockingReasons: string[];
  readonly checkIds: string[];
  readonly runtimeSessionIds: string[];
  readonly generatedFiles: string[];
}
```

### Validation Rules

- `status="passed"` requires zero blocking reasons.
- `runtimeSessionIds` must include at least one real session or one controlled blocked-run session for the candidate.
- A gate result must reference every required check that was executed.

### State Transitions

```text
pending -> running -> passed
                 ├-> failed
                 └-> cancelled
```

## 4. ReleaseGateCheck

Represents one check inside the release gate.

```ts
type ReleaseGateCheckStage =
  | "root-static"
  | "root-tests"
  | "desktop-static"
  | "desktop-tests"
  | "desktop-build"
  | "package"
  | "smoke"
  | "performance"
  | "docs";

type ReleaseGateCheckStatus = "passed" | "failed" | "skipped";

interface ReleaseGateCheck {
  readonly checkId: string;
  readonly gateRunId: string;
  readonly stage: ReleaseGateCheckStage;
  readonly label: string;
  readonly command: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly status: ReleaseGateCheckStatus;
  readonly required: boolean;
  readonly evidencePath: string | null;
  readonly details: string | null;
}
```

### Validation Rules

- Every required check must produce `passed` before the gate can pass.
- `status="skipped"` is allowed only for non-required platform-specific checks with documented reasons.
- `evidencePath` is required for `smoke`, `performance`, and `docs` stages.

## 5. RuntimeAssetManifest

Tracks the assets staged for desktop execution in both development and packaged modes.

```ts
interface RuntimeAssetManifest {
  readonly manifestId: string;
  readonly candidateId: string | null;
  readonly generatedAt: string;
  readonly libraryEntryPath: string;
  readonly workerEntryPath: string;
  readonly packaged: boolean;
  readonly sourceDistVersion: string;
  readonly copiedFiles: string[];
}
```

### Validation Rules

- `libraryEntryPath` and `workerEntryPath` must exist before packaged smoke validation begins.
- `packaged=true` requires copied assets to live under the packaged output tree.
- `sourceDistVersion` must be compared against the expected version range at resolution time. If the root `dist/` bundle version does not match the expected range defined in `desktop/package.json`, the asset resolver must reject the assets with a `RUNTIME_ASSET_ERROR` and include the version mismatch details in the error message.

## 6. ReleaseCandidateArtifact

Represents a packaged candidate ready for smoke validation and sign-off.

```ts
type CandidateStatus =
  | "staged"
  | "packaged"
  | "smoke-validated"
  | "approved"
  | "rejected";

interface ReleaseCandidateArtifact {
  readonly candidateId: string;
  readonly version: string;
  readonly platform: "win" | "mac" | "linux";
  readonly createdAt: string;
  status: CandidateStatus;
  readonly artifactPath: string;
  readonly unpackedPath: string | null;
  readonly checksum: string | null;
  readonly runtimeAssetManifestId: string;
  readonly releaseGateRunId: string | null;
  readonly smokeRecordIds: string[];
}
```

### Validation Rules

- `status="approved"` requires a linked passed release gate and at least one passed smoke record.
- `artifactPath` must point to a real packaged output for the target platform.
- `unpackedPath` is required whenever scripted smoke validation is performed.

### State Transitions

```text
staged -> packaged -> smoke-validated -> approved
                               └-> rejected
packaged -> rejected
```

## 7. SmokeValidationRecord

Evidence that a packaged candidate launched and exercised the required happy-path or controlled blocked-path flows.

```ts
type SmokeValidationStatus = "passed" | "failed";

interface SmokeValidationRecord {
  readonly smokeId: string;
  readonly candidateId: string;
  readonly platform: "win" | "mac" | "linux" | "current";
  readonly recordedAt: string;
  readonly status: SmokeValidationStatus;
  readonly launched: boolean;
  readonly settingsLoaded: boolean;
  readonly policyViewOpened: boolean;
  readonly runStartedOrBlocked: boolean;
  readonly reportOrHistoryVisible: boolean;
  readonly issues: string[];
  readonly evidencePath: string;
}
```

### Validation Rules

- `status="passed"` requires all boolean checkpoints to be `true` and `issues.length === 0`.
- A failed smoke record must include at least one issue and a persisted evidence file.
- When `platform="current"`, the concrete platform name should be resolved and recorded alongside for auditing purposes.
- When multiple smoke records exist for the same candidate with conflicting statuses, the **most recent** record (by `recordedAt`) determines the candidate's effective smoke status. Earlier records are retained for auditing but do not override the latest result.

## 8. ReleaseSignOffChecklist

Operator-facing record of final approval readiness.

```ts
type SignOffStatus = "draft" | "approved" | "rejected";

interface ReleaseSignOffChecklist {
  readonly signOffId: string;
  readonly candidateId: string;
  readonly releaseGateRunId: string;
  readonly operator: string;
  readonly reviewedAt: string;
  status: SignOffStatus;
  readonly checklistVersion: string;
  readonly docsVersion: string;
  readonly unresolvedItems: string[];
  readonly notes: string | null;
}
```

### Validation Rules

- `status="approved"` requires zero unresolved items.
- `docsVersion` must correspond to the permanent production docs checked during the release gate.
- A sign-off record must never approve a candidate with a failed smoke record or failed release gate.

### State Transitions

```text
draft -> approved
draft -> rejected
```

## Storage Layout

```text
desktop/release/
└── validation/
    └── <candidate-id>/
        ├── release-gate.json
        ├── release-gate.md
        ├── smoke-validation.json
        ├── smoke-validation.md
        └── performance-notes.md

userData/
├── runs/
├── reports/
├── traces/
├── settings.json
└── model-policies/
```

> **Credential storage (FR-016):** API keys and provider tokens are stored via the OS keychain (Keytar / DPAPI on Windows, Keychain Services on macOS, libsecret on Linux). Credentials are **never** persisted in `settings.json` or any other plaintext JSON file under `userData/`.

## Data Retention Policy

**Auto-cleanup (FR-019):** Run history, reports, and trace files stored under `userData/` are automatically cleaned up when **either** of the following thresholds is reached, whichever comes first:

1. **Age threshold** — records older than **90 days** since creation.
2. **Count threshold** — more than **100 total runs** exist.

When cleanup is triggered, the oldest records are removed first (FIFO). Cleanup applies to the `runs/`, `reports/`, and `traces/` directories. Release-gate evidence under `desktop/release/validation/` is exempt from automatic cleanup and must be removed manually.

## Existing Entity Extensions

- `CrewRunRecord` becomes the persisted form of `RuntimeExecutionSession`.
- `AgentRunState` remains valid and continues to summarize per-agent progress inside a session.
- `RunPolicyResolutionSnapshot` remains the authoritative policy evidence attached to every run and release validation.
