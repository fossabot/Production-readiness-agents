# Implementation Plan: Desktop Production Hardening

**Branch**: `codex/004-production-hardening` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/codex/004-production-hardening/spec.md`

## Summary

Complete the desktop application's production hardening by replacing the placeholder runtime path with a real end-to-end execution flow, closing the remaining production-blocking work from the model-policy feature, and introducing one repeatable release gate that covers automated verification, packaged-artifact smoke validation, performance evidence, and operator-facing sign-off documentation. The approach keeps the existing root crew library as the source of truth for subagents and tracing, while the Electron app gains a runtime adapter, staged runtime assets for packaged builds, desktop-local test infrastructure, credential security via OS keychain, concurrent-run prevention, partial-completion resilience, data retention policy, and release scripts that produce auditable validation records.

## Technical Context

**Language/Version**: TypeScript 5.4, React 19, Electron 34, Node.js 20 typings
**Primary Dependencies**: deepagents (pinned), langchain, electron ≥34, electron-vite, electron-builder ≥24, react ≥19, react-router-dom, zustand, react-markdown, Vitest, jsdom, @testing-library/react, @testing-library/jest-dom, keytar (OS keychain, must match Electron ABI)
**Storage**: JSON files in `app.getPath("userData")` for settings, runs, reports, traces, and model policies; credentials in OS keychain via Keytar/DPAPI (never plaintext); build-time validation artifacts under `desktop/release/validation/`; packaged runtime assets staged from the root `dist/` output
**Testing**: Root Vitest for crew-library contracts and report utilities; desktop-local Vitest for Electron main-process, policy, persistence, worker-adapter, and renderer component tests; scripted release-gate and smoke validation runs
**Target Platform**: Electron desktop on Windows first, with existing builder targets retained for macOS and Linux packaging
**Project Type**: desktop-app plus reusable TypeScript library in the repository root
**Performance Goals**: Policy load ≤500ms (blocking), preset preview generation ≤200ms (blocking), preflight policy validation ≤1s (blocking), one real run from UI to report or controlled failure without placeholder behavior, operator setup and first readiness decision within 15 minutes using docs only
**Constraints**: Preserve existing agent topology and explicit contracts, keep tracing mandatory, do not regress current model-policy behavior or persisted history/report views, remove all placeholder runtime behavior from the main execution path, stage runtime assets for both development and packaged builds, close or explicitly supersede all production-critical open work from `003-agent-model-policy`, single active run at a time (no concurrent runs), auto-cleanup of run data after 90 days or 100 runs
**Dependency Version Constraints**: `deepagents` is pinned to an exact version in package.json to prevent unexpected behavioral changes in agent execution. `electron-builder` requires ≥24.0.0 for current packaging targets. `keytar` must be compiled against the target Electron ABI version for native module compatibility. All other dependencies follow semver ranges defined in package.json.
**Scale/Scope**: Root crew library exports, Electron main process, worker runtime, renderer pages, desktop test harness, release-gate scripts, packaging configuration, and operator documentation across one desktop application with 8 specialist agents plus optional `general-purpose`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Preserve required crew topology | PASS | The feature uses the existing root crew factory and does not add, remove, or rename subagents. |
| Keep subagent contracts explicit | PASS | Source-of-truth prompts, tools, and model fields remain in the root crew library; the desktop runtime only consumes those definitions through an adapter. |
| Restrict real command execution to `runtime-verifier` | PASS | The runtime design routes bounded execution through the existing crew runtime flow instead of creating a second command runner in Electron UI code. |
| Maintain mandatory tracing | PASS | The hardening plan keeps trace persistence and extends it through packaged execution, release-gate evidence, and failure reporting. |
| Avoid hidden operational state | PASS | Runtime assets, validation artifacts, smoke records, sign-off records, and credentials (via OS keychain) are all explicitly managed rather than implicit operator knowledge. |
| Least-privilege tools per agent | PASS | No agent receives tools beyond its role. The desktop adapter consumes crew output without expanding agent permissions. |
| Inter-agent output contract | PASS | PARENT_RESULT_CONTRACT remains the standard. Partial completion (FR-018) records failed agents alongside successful ones without changing the contract structure. |
| Skills policy unchanged | PASS | This feature does not add, modify, or remove any agent skill definition or SKILL.md file. Existing skill paths are unaffected. |
| Persistent memory paths unchanged | PASS | This feature operates on desktop `userData` paths only. No changes to `/memories/production-readiness/` paths. Agent memory structure is unaffected. |

**Post-Phase 1 re-check**: PASS — the design keeps the library as the sole definition of the Production Readiness Crew, stages runtime assets instead of forking the crew implementation, secures credentials via OS keychain, enforces single-run concurrency, supports partial completion resilience, adds auditable release workflows without weakening tracing or introducing hidden execution paths, leaves agent skills and persistent memory paths unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/codex/004-production-hardening/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── desktop-runtime-ipc-contract.md
│   └── release-gate-contract.md
├── checklists/
│   ├── production-hardening.md
│   ├── production-readiness.md
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── ipc/
│   │   ├── channels.ts
│   │   ├── contracts.ts
│   │   └── handlers.ts
│   ├── persistence/
│   │   ├── model-policy-store.ts
│   │   ├── report-store.ts
│   │   ├── run-store.ts
│   │   ├── settings-store.ts
│   │   ├── trace-store.ts
│   │   └── data-retention.ts          # NEW: auto-cleanup logic (FR-019)
│   ├── runtime/
│   │   ├── asset-resolver.ts
│   │   ├── crew-adapter.ts
│   │   └── credential-store.ts        # NEW: Keytar/DPAPI wrapper (FR-016)
│   ├── worker/
│   │   ├── crew-runtime.ts
│   │   ├── crew-worker.ts
│   │   ├── event-bus.ts
│   │   └── cancellation.ts
│   ├── types/
│   │   ├── events.ts
│   │   ├── run.ts
│   │   ├── settings.ts
│   │   └── model-policy.ts
│   └── main.ts
├── scripts/
│   ├── prepare-runtime-assets.mjs
│   ├── release-gate.mjs
│   └── smoke-validate.mjs
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── state/
│   └── test/
├── docs/
│   ├── production-readiness.md
│   └── release-signoff.md
├── electron-builder.yml
├── electron.vite.config.ts
├── package.json
└── vitest.config.ts

src/
├── contracts/
├── report/
├── tracing/
├── types.ts
└── index.ts

tests/
├── integration/
└── unit/

production-readiness-crew.subagents.ts
index.ts
package.json
```

**Structure Decision**: Keep the feature centered in the existing `desktop/` application while treating the repository-root crew library as a reusable runtime dependency that must be built and staged for Electron execution. New logic is split into three concerns: runtime integration inside `desktop/electron/runtime/`, release automation in `desktop/scripts/`, and permanent operator documentation in `desktop/docs/`. Two new modules added: `credential-store.ts` for OS keychain integration (FR-016) and `data-retention.ts` for auto-cleanup (FR-019). This avoids duplicating subagent definitions and keeps packaged-asset handling explicit.

## Phase 0: Research Decisions

All research decisions are documented in [research.md](research.md). Key decisions:

1. **Real runtime execution**: In-process adapter connecting Electron worker to root crew library (rejected: external CLI, mock runtime)
2. **Runtime asset resolution**: Explicit resolver + staged assets for packaged builds (rejected: process.cwd(), re-implementation)
3. **Desktop verification stack**: Split Vitest — Node for main-process, jsdom for renderer (rejected: manual-only, Playwright-first)
4. **Release gate orchestration**: Single Node script aggregating all checks (rejected: PowerShell-only, CI-only)
5. **Packaged smoke validation**: Unpacked packaged build validation with structured records (rejected: dev-only, installer-only)
6. **Open blockers from 003**: Treated as hard dependencies, closed through shared test tooling (rejected: independent tracking, copy-without-integrate)
7. **Operational documentation**: Permanent docs under `desktop/docs/`, not in feature-spec folders (rejected: spec-only, ad-hoc)

## Phase 1: Design Artifacts

All design artifacts are complete and located in:

- **Data model**: [data-model.md](data-model.md) — 8 entities (RuntimeExecutionSession, RuntimeExecutionStep, ReleaseGateResult, ReleaseGateCheck, RuntimeAssetManifest, ReleaseCandidateArtifact, SmokeValidationRecord, ReleaseSignOffChecklist) + data retention policy + credential storage notes
- **IPC contract**: [contracts/desktop-runtime-ipc-contract.md](contracts/desktop-runtime-ipc-contract.md) — 7 command channels, broadcast events, error taxonomy (7 codes including RUN_ALREADY_ACTIVE), compatibility rules
- **Release gate contract**: [contracts/release-gate-contract.md](contracts/release-gate-contract.md) — 9 required stages, output schema, failure semantics, sign-off handoff
- **Quickstart**: [quickstart.md](quickstart.md) — Development verification flow, release gate flow, smoke validation, performance evidence, operator sign-off
- **Traceability matrix**: [traceability-matrix.md](traceability-matrix.md) — FR-to-entity, FR-to-IPC, FR-to-gate-stage, FR-to-task cross-reference

## Phase 2: Implementation Scope

> Phase 2 task decomposition is produced by `/speckit.tasks`, not by this plan.

### Work Streams

**Stream A — Runtime Integration (FR-001, FR-002, FR-004, FR-012, FR-013, FR-017, FR-018)**
- Replace placeholder in `crew-runtime.ts` with real crew adapter
- Implement `asset-resolver.ts` for dev/packaged path resolution
- Implement `crew-adapter.ts` bridging worker to root crew factory
- Add concurrent-run prevention (RUN_ALREADY_ACTIVE error)
- Add partial-completion logic for provider failures
- Wire human-readable error display in renderer

**Stream B — Credential Security (FR-016)**
- Implement `credential-store.ts` with Keytar/DPAPI
- Migrate settings flow from plaintext to keychain storage
- Update settings page to use secure credential retrieval

**Stream C — Persistence & Retention (FR-003, FR-014, FR-019)**
- Ensure run/report/trace persistence across all 6 states
- Implement `data-retention.ts` auto-cleanup (90 days / 100 runs)
- Verify persistence survives app restart and packaged execution

**Stream D — Verification & Testing (FR-006, FR-011)**
- Set up desktop-local Vitest (Node + jsdom)
- Write critical-path tests: policy logic, IPC channels, runtime paths, failure states, renderer
- Close open test gaps from 003-agent-model-policy (FR-005)
- Stream D outputs feed into Stream E's release gate (FR-007)

**Stream E — Release Gate & Packaging (FR-007, FR-008, FR-009)**
- Implement `release-gate.mjs` orchestration script
- Implement `prepare-runtime-assets.mjs` for asset staging
- Implement `smoke-validate.mjs` for packaged candidate validation
- Add performance measurement and threshold enforcement
- Configure electron-builder for Windows packaging

**Stream F — Documentation & Sign-off (FR-010, FR-015)**
- Write `desktop/docs/production-readiness.md`
- Write `desktop/docs/release-signoff.md`
- Ensure 15-minute operator onboarding target (SC-006)

### Dependency Order

```text
Stream A (runtime) ──┐
Stream B (credentials)├── Stream D (testing) ── Stream E (release gate) ── Stream F (docs)
Stream C (persistence)┘
```

Streams A, B, C can proceed in parallel. Stream D depends on A, B, C being functional. Stream E depends on D passing. Stream F can start early but must finalize after E.

### Stream-to-Phase Mapping

| Stream | Primary Phase(s) | Key Task IDs |
|--------|-----------------|--------------|
| A — Runtime Integration | Phase 2 (T008, T012, T013), Phase 3/US1 (T018-T024) | T008, T012, T013, T018-T024 |
| B — Credential Security | Phase 2 (T056), Phase 3/US1 (T062, T063) | T056, T062, T063 |
| C — Persistence & Retention | Phase 2 (T011, T057), Phase 7 (T064) | T011, T057, T064 |
| D — Verification & Testing | Phase 3/US1 (T014-T017), Phase 4/US2 (T025-T028, T033-T034) | T014-T017, T025-T028, T033-T034 |
| E — Release Gate & Packaging | Phase 4/US2 (T029-T032), Phase 5/US3 (T036-T044) | T029-T032, T036-T044 |
| F — Documentation & Sign-off | Phase 6/US4 (T045-T051) | T045-T051 |

## Complexity Tracking

> No constitution violations detected. No complexity justifications required.
