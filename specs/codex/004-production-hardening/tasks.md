# Tasks: Desktop Production Hardening

**Input**: Design documents from `/specs/codex/004-production-hardening/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/desktop-runtime-ipc-contract.md`, `contracts/release-gate-contract.md`, `quickstart.md`

**Tests**: Explicitly requested in the feature specification through independent tests, acceptance scenarios, release-gate expectations, smoke validation, and operator sign-off validation. Include both root-library and desktop-local automated coverage.

**Organization**: Tasks are grouped by user story so each story can be implemented, validated, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches separate files with no dependency on unfinished work in the same phase
- **[Story]**: User story label for traceability
- Every task includes exact file paths

## Path Conventions

- Root crew-library code lives in `production-readiness-crew.subagents.ts`, `index.ts`, `src/`, and `tests/`
- Desktop main-process code lives in `desktop/electron/`
- Desktop renderer code lives in `desktop/src/`
- Desktop scripts and release automation live in `desktop/scripts/`
- Permanent operator documentation lives in `desktop/docs/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared test, script, and workspace foundations for production-hardening work

- [x] T001 Update root repository test scripts and shared verification dependencies in `package.json`
- [x] T002 [P] Update desktop test, packaging, and release-gate scripts in `desktop/package.json`
- [x] T003 [P] Create desktop Vitest configuration for Electron main-process and renderer suites in `desktop/vitest.config.ts`
- [x] T004 [P] Create shared renderer test bootstrap and mocks in `desktop/src/test/setup.ts`
- [x] T005 [P] Create root and desktop test entry placeholders in `tests/unit/.gitkeep`, `tests/integration/.gitkeep`, `desktop/electron/__tests__/.gitkeep`, and `desktop/src/__tests__/.gitkeep`

**Checkpoint**: Shared commands and test structure exist for both the root crew library and the desktop app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish runtime asset handling, release-validation models, and persistence needed by every user story

**CRITICAL**: No user story work should begin until this phase is complete

- [x] T006 [P] Define release-gate, release-candidate, smoke-validation, and sign-off entities in `desktop/electron/types/release.ts`
- [x] T007 [P] Extend desktop error taxonomy for runtime asset, trace, and report persistence failures in `desktop/electron/types/errors.ts`
- [x] T008 [P] Create development and packaged runtime asset resolution helpers in `desktop/electron/runtime/asset-resolver.ts`
- [x] T009 [P] Create release-validation persistence helpers for gate and smoke artifacts in `desktop/electron/persistence/release-validation-store.ts`
- [x] T010 Extend hardened run and release-validation IPC types in `desktop/electron/ipc/contracts.ts`
- [x] T011 Extend run persistence normalization for runtime metadata and release evidence links in `desktop/electron/persistence/run-store.ts`
- [x] T012 Implement runtime asset preparation and staging helper in `desktop/scripts/prepare-runtime-assets.mjs`
- [x] T013 Wire staged runtime assets into desktop build and package configuration in `desktop/package.json`, `desktop/electron.vite.config.ts`, and `desktop/electron-builder.yml` (depends on T002 completing desktop/package.json scripts first)
- [x] T056 [P] Define credential storage interface and Keytar/DPAPI wrapper in `desktop/electron/runtime/credential-store.ts` and add `keytar` dependency to `desktop/package.json` [FR-016]
- [x] T057 [P] Implement data retention auto-cleanup logic in `desktop/electron/persistence/data-retention.ts` with 90-day age threshold and 100-run count threshold [FR-019]

**Checkpoint**: Runtime assets, release-validation records, and shared persistence/contracts are ready for story-level implementation.

---

## Phase 3: User Story 1 - تشغيل حقيقي من الواجهة إلى التقرير (Priority: P1) MVP

**Goal**: Replace the placeholder desktop runtime with a real execution path that produces a persisted report or a controlled persisted failure.

**Independent Test**: Select a known local repository, start a run from the desktop UI, and verify that the run completes or fails in a controlled way with visible status, trace, and report evidence from inside the app.

### Tests for User Story 1

- [x] T014 [P] [US1] Add root crew runtime contract coverage in `tests/integration/production-readiness-crew.runtime.test.ts`
- [x] T015 [P] [US1] Add worker runtime happy-path and controlled-failure coverage in `desktop/electron/worker/__tests__/crew-runtime.test.ts`
- [x] T016 [P] [US1] Add start-run IPC coverage for real runtime execution in `desktop/electron/ipc/__tests__/crew-start-run-runtime.test.ts`
- [x] T017 [P] [US1] Add renderer run-state coverage for scan, history, and report flows in `desktop/src/pages/__tests__/runtime-flow.test.tsx`
- [x] T058 [P] [US1] Add concurrent-run prevention coverage in `desktop/electron/ipc/__tests__/crew-start-run-concurrency.test.ts` [FR-017]
- [x] T059 [P] [US1] Add partial-completion resilience coverage in `desktop/electron/worker/__tests__/crew-partial-completion.test.ts` [FR-018]
- [x] T062 [P] [US1] Add credential store read/write coverage in `desktop/electron/runtime/__tests__/credential-store.test.ts` [FR-016]

### Implementation for User Story 1

- [x] T018 [P] [US1] Implement the desktop crew-library adapter in `desktop/electron/runtime/crew-adapter.ts`
- [x] T019 [US1] Replace placeholder worker execution with real crew invocation in `desktop/electron/worker/crew-runtime.ts`
- [x] T020 [US1] Extend worker lifecycle and result mapping for hardened runtime output in `desktop/electron/worker/crew-worker.ts`
- [x] T021 [US1] Integrate runtime asset resolution, concrete error codes, and execution-step persistence into `desktop/electron/ipc/handlers.ts` (depends on T010 for IPC types)
- [x] T022 [US1] Persist runtime execution metadata and packaged-execution flags in `desktop/electron/persistence/run-store.ts` and `desktop/electron/types/run.ts`
- [x] T023 [US1] Surface runtime start, blocked-run, and failure details in `desktop/src/hooks/useCrewRun.ts` and `desktop/src/pages/ScanPage.tsx`
- [x] T024 [US1] Render persisted runtime evidence and report availability in `desktop/src/pages/HistoryPage.tsx` and `desktop/src/pages/ReportPage.tsx`
- [x] T060 [US1] Implement RUN_ALREADY_ACTIVE concurrency guard in `desktop/electron/ipc/handlers.ts` to reject new runs while an active session exists (queued, starting, or running) [FR-017]
- [x] T061 [US1] Implement partial-completion branching in `desktop/electron/worker/crew-runtime.ts` to continue available agents on provider failure and record failed agents with failure reason [FR-018]
- [x] T063 [US1] Migrate settings flow from plaintext API key storage to OS keychain via credential-store.ts in `desktop/electron/persistence/settings-store.ts` and `desktop/src/pages/SettingsPage.tsx` [FR-016]

**Checkpoint**: User Story 1 is complete when the desktop app can perform a real run from UI start through persisted result without the placeholder runtime failure.

---

## Phase 4: User Story 2 - بوابة تحقق آلية تمنع الانحدار (Priority: P1)

**Goal**: Provide an automated release-readiness gate that catches runtime, policy, IPC, and UI regressions and formally closes the remaining production blockers from the model-policy feature.

**Independent Test**: Run the standard verification workflow and confirm that it executes the critical automated checks, fails clearly on any broken core path, and produces evidence that prior model-policy production blockers are closed or replaced.

### Tests for User Story 2

- [x] T025 [P] [US2] Add model-policy state and settings-page coverage in `desktop/electron/ipc/__tests__/model-policy-state.test.ts` and `desktop/src/pages/__tests__/SettingsPage.model-policy.test.tsx`
- [x] T026 [P] [US2] Add model-policy profile and override coverage in `desktop/electron/ipc/__tests__/model-policy-profile-actions.test.ts`, `desktop/electron/ipc/__tests__/model-policy-override.test.ts`, and `desktop/src/components/__tests__/PolicyProfilePanel.test.tsx`
- [x] T027 [P] [US2] Add resolver, tracing, publish, and lifecycle regression coverage in `desktop/electron/policy/__tests__/resolver.test.ts`, `desktop/electron/ipc/__tests__/policy-tracing.test.ts`, `desktop/electron/ipc/__tests__/model-policy-publish.test.ts`, and `desktop/electron/ipc/__tests__/model-policy-lifecycle.test.ts`
- [x] T028 [P] [US2] Add release-gate orchestration coverage in `desktop/scripts/__tests__/release-gate.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] Add desktop automated verification command set in `desktop/package.json` (depends on T013 completing desktop/package.json configuration first)
- [x] T030 [US2] Implement root and desktop release-gate orchestration in `desktop/scripts/release-gate.mjs`
- [x] T031 [US2] Serialize release-gate results and blocking reasons in `desktop/scripts/release-gate.mjs` and `desktop/electron/persistence/release-validation-store.ts`
- [x] T032 [US2] Instrument policy load, preset preview, and preflight timing collection in `desktop/electron/ipc/handlers.ts` (depends on T021 completing handlers.ts changes first)
- [x] T033 [US2] Add automated policy performance coverage in `desktop/electron/policy/__tests__/performance.test.ts`
- [x] T034 [US2] Add root-library verification coverage for report and tracing invariants in `tests/unit/report-validation.test.ts` and `tests/unit/tracing-collector.test.ts`
- [x] T035 [US2] Record closure or approved replacement of remaining model-policy production blockers in `specs/003-agent-model-policy/quickstart.md`

**Checkpoint**: User Story 2 is complete when one automated workflow can reject broken builds and demonstrate closure of the remaining model-policy production blockers.

---

## Phase 5: User Story 3 - تغليف وإقلاع وإثبات دخاني للإصدار (Priority: P2)

**Goal**: Produce a packaged desktop candidate that launches successfully with staged runtime assets and emits a smoke-validation record for release review.

**Independent Test**: Build a release candidate, run the smoke validator against the packaged output, and verify successful launch plus either a real run path or a controlled blocked-run path with saved evidence.

### Tests for User Story 3

- [x] T036 [P] [US3] Add development and packaged asset-resolution coverage in `desktop/electron/runtime/__tests__/asset-resolver.test.ts`
- [x] T037 [P] [US3] Add smoke-validation script coverage in `desktop/scripts/__tests__/smoke-validate.test.ts`
- [x] T038 [P] [US3] Add release-candidate and smoke-record persistence coverage in `desktop/electron/persistence/__tests__/release-validation-store.test.ts`

### Implementation for User Story 3

- [x] T039 [US3] Integrate staged runtime assets into packaged startup in `desktop/electron/main.ts` and `desktop/electron/runtime/asset-resolver.ts` (extends T008 asset-resolver.ts; review T008 API surface first)
- [x] T040 [US3] Implement packaged smoke-validation flow and candidate evidence generation in `desktop/scripts/smoke-validate.mjs`
- [x] T041 [US3] Persist release-candidate and smoke-validation records in `desktop/electron/persistence/release-validation-store.ts` and `desktop/electron/types/release.ts`
- [x] T042 [US3] Extend packaged build and smoke stages in `desktop/scripts/release-gate.mjs` (depends on T030-T031 completing release-gate.mjs first)
- [x] T043 [US3] Surface packaged-startup and runtime-asset failure messaging in `desktop/electron/ipc/handlers.ts` and `desktop/src/pages/ScanPage.tsx` (depends on T032 completing handlers.ts changes first)
- [x] T044 [US3] Finalize current-platform packaging outputs and artifact naming in `desktop/package.json` and `desktop/electron-builder.yml`

**Checkpoint**: User Story 3 is complete when a packaged candidate can be built, launched, and evaluated through a documented smoke record.

---

## Phase 6: User Story 4 - توثيق وتشغيل واعتماد نهائي يمكن تسليمه (Priority: P2)

**Goal**: Provide permanent operator documentation and a sign-off workflow that a new reviewer can follow without undocumented tribal knowledge.

**Independent Test**: Give the documentation to a reviewer new to the project and verify that they can configure prerequisites, run the release gate, review smoke evidence, and reach an approval or rejection decision in one session.

### Tests for User Story 4

- [x] T045 [P] [US4] Add release-signoff and docs-stage gate coverage in `desktop/scripts/__tests__/release-signoff.test.ts`
- [x] T046 [P] [US4] Add operator-flow validation notes for the 15-minute setup scenario in `specs/codex/004-production-hardening/quickstart.md`

### Implementation for User Story 4

- [x] T047 [US4] Write the permanent operator runbook in `desktop/docs/production-readiness.md`
- [x] T048 [US4] Write the release sign-off checklist and approval procedure in `desktop/docs/release-signoff.md`
- [x] T049 [US4] Add documentation and sign-off validation stages to `desktop/scripts/release-gate.mjs` (depends on T042 completing release-gate.mjs changes first)
- [x] T050 [US4] Record smoke, performance, and usability evidence expectations in `specs/codex/004-production-hardening/quickstart.md` and `specs/003-agent-model-policy/quickstart.md` (depends on T035 completing 003-agent-model-policy quickstart first)
- [x] T051 [US4] Surface operator documentation references in `desktop/src/pages/SettingsPage.tsx` and `desktop/src/pages/ReportPage.tsx`

**Checkpoint**: User Story 4 is complete when release readiness can be reviewed and signed off from documentation and generated evidence alone.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final cross-story validation and cleanup for the complete production-readiness workflow

- [x] T052 [P] Add end-to-end release-gate regression coverage across runtime, packaging, smoke, and docs stages in `desktop/scripts/__tests__/release-gate.integration.test.ts`
- [x] T053 [P] Add report export and history-retention regression coverage for packaged execution in `desktop/electron/ipc/__tests__/report-retention.test.ts`
- [x] T054 [P] Consolidate shared runtime and error-copy constants in `desktop/electron/ipc/handlers.ts`, `desktop/src/hooks/useCrewRun.ts`, and `desktop/src/components/ErrorBoundary.tsx`
- [x] T064 [P] Add data retention auto-cleanup coverage in `desktop/electron/persistence/__tests__/data-retention.test.ts` [FR-019]
- [x] T055 Run quickstart validation and record final production-readiness notes in `specs/codex/004-production-hardening/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can begin immediately
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story
- **US1 (Phase 3)**: Depends on Foundational and delivers the first real production value
- **US2 (Phase 4)**: Depends on Foundational and US1 because the gate must validate the real runtime path
- **US3 (Phase 5)**: Depends on Foundational and US1 for packaged runtime execution, and on US2 for gate integration
- **US4 (Phase 6)**: Depends on US2 and US3 because documentation and sign-off must reflect the real gate and packaged smoke evidence
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 -> US2 -> US4
                    \      \
                     \      -> US3 -> US4
                      \
                       -> US2

Polish depends on: US1 + US2 + US3 + US4
```

### Within Each User Story

- Story tests should be written before implementation and should fail before the related code is added
- Shared runtime and persistence pieces come before UI and release automation wiring
- Main-process and worker implementation should land before renderer integration for the same story
- Each story should end with one independently executable validation path matching the story's independent test

### Parallel Opportunities

- **Phase 1**: T002, T003, T004, and T005 can run in parallel after T001
- **Phase 2**: T006, T007, T008, T009, T056, and T057 can run in parallel before T010-T013
- **US1**: T014, T015, T016, T017, T018, T058, T059, and T062 can run in parallel before runtime wiring converges
- **US2**: T025, T026, T027, and T028 can run in parallel while release-gate scaffolding is prepared
- **US3**: T036, T037, and T038 can run in parallel before packaging and smoke-flow implementation
- **US4**: T045 and T046 can run in parallel before the permanent docs and sign-off flow are finalized
- **Polish**: T052, T053, and T054 can run in parallel before T055

---

## Parallel Example: User Story 1

```text
Task: "Add root crew runtime contract coverage in tests/integration/production-readiness-crew.runtime.test.ts"
Task: "Add worker runtime happy-path and controlled-failure coverage in desktop/electron/worker/__tests__/crew-runtime.test.ts"
Task: "Add start-run IPC coverage in desktop/electron/ipc/__tests__/crew-start-run-runtime.test.ts"
Task: "Add renderer run-state coverage in desktop/src/pages/__tests__/runtime-flow.test.tsx"
Task: "Implement the desktop crew-library adapter in desktop/electron/runtime/crew-adapter.ts"
```

## Parallel Example: User Story 2

```text
Task: "Add model-policy state and settings-page coverage in desktop/electron/ipc/__tests__/model-policy-state.test.ts and desktop/src/pages/__tests__/SettingsPage.model-policy.test.tsx"
Task: "Add model-policy profile and override coverage in desktop/electron/ipc/__tests__/model-policy-profile-actions.test.ts, desktop/electron/ipc/__tests__/model-policy-override.test.ts, and desktop/src/components/__tests__/PolicyProfilePanel.test.tsx"
Task: "Add resolver, tracing, publish, and lifecycle regression coverage in desktop/electron/policy/__tests__/resolver.test.ts, desktop/electron/ipc/__tests__/policy-tracing.test.ts, desktop/electron/ipc/__tests__/model-policy-publish.test.ts, and desktop/electron/ipc/__tests__/model-policy-lifecycle.test.ts"
Task: "Add release-gate orchestration coverage in desktop/scripts/__tests__/release-gate.test.ts"
```

## Parallel Example: User Story 3

```text
Task: "Add development and packaged asset-resolution coverage in desktop/electron/runtime/__tests__/asset-resolver.test.ts"
Task: "Add smoke-validation script coverage in desktop/scripts/__tests__/smoke-validate.test.ts"
Task: "Add release-candidate and smoke-record persistence coverage in desktop/electron/persistence/__tests__/release-validation-store.test.ts"
```

## Parallel Example: User Story 4

```text
Task: "Add release-signoff and docs-stage gate coverage in desktop/scripts/__tests__/release-signoff.test.ts"
Task: "Add operator-flow validation notes in specs/codex/004-production-hardening/quickstart.md"
Task: "Write the permanent operator runbook in desktop/docs/production-readiness.md"
Task: "Write the release sign-off checklist in desktop/docs/release-signoff.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the real runtime path from UI start to persisted result
5. Demo the desktop run flow before layering release automation and packaging

### Incremental Delivery

1. Setup + Foundational -> shared runtime, persistence, and asset handling are ready
2. US1 -> the desktop app can execute a real run
3. US2 -> regressions are caught automatically and prior model-policy blockers are closed
4. US3 -> packaged candidates can be built and smoke-validated
5. US4 -> operators can run and sign off the process without hidden knowledge

### Suggested MVP Scope

- **Recommended MVP**: Phase 1 + Phase 2 + Phase 3
- This scope delivers the first essential production outcome by removing the placeholder runtime path and proving the core desktop flow works end-to-end

---

## Notes

- Every task follows the required checklist format with checkbox, sequential ID, optional `[P]`, required story label inside story phases, and explicit file paths
- The remaining open production blockers from `003-agent-model-policy` are intentionally folded into User Story 2 and User Story 4 so this feature can declare production readiness credibly
- `desktop/electron/ipc/handlers.ts`, `desktop/scripts/release-gate.mjs`, and `desktop/electron/worker/crew-runtime.ts` are shared hotspots and should be sequenced carefully to avoid merge conflicts
- Tasks T056-T064 were added after the `/speckit.analyze` pass to close coverage gaps for FR-016 (credential security), FR-017 (concurrent-run prevention), FR-018 (partial-completion resilience), and FR-019 (data retention auto-cleanup)
