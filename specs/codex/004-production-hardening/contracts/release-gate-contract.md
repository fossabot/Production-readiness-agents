# Contract: Release Gate

**Feature Branch**: `codex/004-production-hardening`  
**Scope**: Local release-readiness orchestration and emitted validation artifacts

## Overview

This feature introduces one repeatable release-gate command that a developer or operator can run on the current host platform to determine whether the desktop app is ready to package and sign off. The gate must aggregate root-library verification, desktop verification, packaging, smoke validation, performance evidence, and documentation checks into a single pass/fail outcome.

## Invocation

The gate is exposed through a desktop package script that wraps a Node entry point.

```text
npm run release:gate -- --platform current --output desktop/release/validation
```

### Optional flags

```ts
interface ReleaseGateOptions {
  readonly platform?: "current" | "win" | "mac" | "linux";
  readonly packageArtifacts?: boolean;
  readonly runSmoke?: boolean;
  readonly outputDir?: string;
  readonly candidateId?: string | null;
}
```

## Required stages

| Stage | Purpose | Blocking |
|-------|---------|----------|
| `root-static` | Root `typecheck` and buildability | Yes |
| `root-tests` | Root unit/integration tests for the crew library | Yes |
| `desktop-static` | Desktop `typecheck` and configuration validation | Yes |
| `desktop-tests` | Desktop Vitest coverage for main, policy, renderer, and runtime integration | Yes |
| `desktop-build` | Electron Vite build plus runtime asset staging | Yes |
| `package` | Produce packaged candidate for the current platform | Yes |
| `smoke` | Validate packaged candidate launch and core flows | Yes |
| `performance` | Record or validate policy timing thresholds | Yes |
| `docs` | Verify permanent production docs and sign-off checklist inputs | Yes |

## Output artifacts

Each invocation must create a candidate-specific folder.

```text
desktop/release/validation/<candidate-id>/
├── release-gate.json
├── release-gate.md
├── smoke-validation.json
├── smoke-validation.md
└── performance-notes.md
```

### Output schema

```ts
interface ReleaseGateResult {
  readonly gateRunId: string;
  readonly candidateId: string;
  readonly platform: "current" | "win" | "mac" | "linux";
  readonly status: "passed" | "failed" | "cancelled";
  readonly summary: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly checks: ReleaseGateCheck[];
  readonly blockingReasons: string[];
  readonly runtimeSessionIds: string[];
  readonly generatedFiles: string[];
}
```

> **Note**: This is the output artifact schema emitted by the release-gate script. The full lifecycle schema (including transient `pending` and `running` states) is defined in [data-model.md](../data-model.md) §3. The output artifact uses only terminal states.

## Failure semantics

- The command must exit non-zero if any required stage fails.
- A failed gate must still emit `release-gate.json` and `release-gate.md`.
- If packaging succeeds but smoke validation fails, the candidate remains rejected and the smoke record must explain why.
- Documentation or performance evidence gaps are blocking, not informational, for production-ready status.

## Sign-off handoff

The gate does not itself approve a release. Instead, it provides the evidence consumed by the operator sign-off checklist.

```ts
interface ReleaseSignOffInput {
  readonly candidateId: string;
  readonly gateRunId: string;
  readonly operator: string;
  readonly docsVersion: string;
  readonly notes?: string | null;
}
```

Approval is valid only if the referenced gate result is passed and the candidate has a passed smoke-validation record.
