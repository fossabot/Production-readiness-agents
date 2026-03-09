# Tasks: Agent Model Policy

**Input**: Design documents from `/specs/003-agent-model-policy/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/model-policy-ipc-contract.md`, `quickstart.md`

**Tests**: Explicitly requested via the feature spec user scenarios, acceptance criteria, preflight behavior, and quickstart validation. Include Vitest coverage for policy logic, IPC handlers, and renderer behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches separate files and has no dependency on unfinished work in the same phase
- **[Story]**: User story label for traceability
- Include exact file paths in every task description

## Path Conventions

- Desktop main-process code lives in `desktop/electron/`
- Desktop renderer code lives in `desktop/src/`
- Desktop Vitest files live beside the feature code under `__tests__/`

---

## Phase 1: Setup (Shared Test and Tooling Infrastructure)

**Purpose**: Prepare the desktop workspace for policy-focused implementation and automated validation

- [ ] T001 Update desktop test dependencies and scripts for policy work in `desktop/package.json`
- [ ] T002 [P] Create desktop Vitest configuration for Electron main and renderer tests in `desktop/vitest.config.ts`
- [ ] T003 [P] Create shared renderer test bootstrap and mocks in `desktop/src/test/setup.ts`

**Checkpoint**: Desktop feature work can add executable tests without changing the root package workflow.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish policy data structures, persistence, contracts, and bootstrap plumbing required by every user story

**CRITICAL**: No user story work should begin until this phase is complete

- [x] T004 [P] Define policy entities, view models, and resolution records in `desktop/electron/types/model-policy.ts`
- [x] T005 [P] Extend model catalog and settings types with policy metadata and constraints in `desktop/electron/types/settings.ts`
- [x] T006 [P] Extend run record types with `RunPolicyResolutionSnapshot` support in `desktop/electron/types/run.ts`
- [x] T007 Implement active snapshot bootstrap and JSON file CRUD helpers in `desktop/electron/persistence/model-policy-store.ts`
- [x] T008 [P] Seed dated model catalog entries and built-in `accuracy`/`balanced`/`budget` profiles, including explicit `general-purpose` coverage when enabled, in `desktop/electron/policy/catalog.ts`
- [x] T009 [P] Implement preview delta builders for per-agent policy comparisons in `desktop/electron/policy/diff.ts`
- [x] T010 [P] Define resolver result, blocking reason, and fallback decision types in `desktop/electron/policy/resolver.ts`
- [x] T011 Implement default policy migration and policy-aware settings persistence in `desktop/electron/persistence/settings-store.ts`
- [x] T012 Define model policy IPC channels and payload contracts in `desktop/electron/ipc/channels.ts` and `desktop/electron/ipc/contracts.ts`
- [x] T013 Extend the preload bridge with model policy methods in `desktop/electron/security/preload.ts`
- [ ] T014 Extend renderer IPC typing and proxy access for model policy commands in `desktop/src/lib/ipc-client.ts`

**Checkpoint**: Policy snapshots, catalog metadata, and IPC contracts exist and are ready for story-level behavior.

---

## Phase 3: User Story 1 - عرض ربط صريح لكل وكيل (Priority: P1) MVP

**Goal**: Show every enabled agent with an explicit primary model, fallback model, rationale, confidence, and policy review date instead of a generic unresolved default.

**Independent Test**: Open the settings policy view and verify that every enabled agent displays a primary model, at least one fallback model, a short rationale, confidence/review status, and no unresolved `default` placeholder.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add active policy state handler coverage, including explicit `general-purpose` mapping when enabled, in `desktop/electron/ipc/__tests__/model-policy-state.test.ts`
- [ ] T016 [P] [US1] Add policy tab rendering coverage for explicit agent mappings in `desktop/src/pages/__tests__/SettingsPage.model-policy.test.tsx`

### Implementation for User Story 1

- [x] T017 [P] [US1] Create renderer policy state store for loading active policy data in `desktop/src/state/model-policy-store.ts`
- [x] T018 [P] [US1] Create policy loading hook for state hydration and refresh in `desktop/src/hooks/useModelPolicy.ts`
- [x] T019 [P] [US1] Create review-status badge component for policy freshness and confidence in `desktop/src/components/PolicyStatusBadge.tsx`
- [x] T020 [P] [US1] Create per-agent policy table with primary, fallback, rationale, and confidence columns in `desktop/src/components/AgentPolicyTable.tsx`
- [x] T021 [US1] Implement `MODEL_POLICY_GET_STATE` state assembly and validation in `desktop/electron/ipc/handlers.ts`
- [x] T022 [US1] Add a dedicated `model-policy` tab and active snapshot summary to `desktop/src/pages/SettingsPage.tsx`

**Checkpoint**: User Story 1 is complete when the policy tab alone can explain the current recommended model map for all enabled agents.

---

## Phase 4: User Story 2 - تطبيق ملفات اختيار جاهزة بحسب الهدف (Priority: P1)

**Goal**: Let the user preview and apply built-in profile presets across all enabled agents with clear diff output before saving.

**Independent Test**: Open the policy tab with an existing manual override, preview the `balanced` profile, review every proposed per-agent change, choose whether to keep or replace the override during confirmation, and verify that the resulting crew mapping matches the selected behavior in one operation.

### Tests for User Story 2

- [ ] T023 [P] [US2] Add preview/apply profile handler coverage in `desktop/electron/ipc/__tests__/model-policy-profile-actions.test.ts`
- [ ] T024 [P] [US2] Add profile preview interaction coverage in `desktop/src/components/__tests__/PolicyProfilePanel.test.tsx`

### Implementation for User Story 2

- [x] T025 [P] [US2] Create preset profile cards and diff preview UI in `desktop/src/components/PolicyProfilePanel.tsx`
- [x] T026 [US2] Implement `MODEL_POLICY_PREVIEW_PROFILE` diff generation in `desktop/electron/ipc/handlers.ts`
- [x] T027 [US2] Implement `MODEL_POLICY_APPLY_PROFILE` persistence and response shaping in `desktop/electron/ipc/handlers.ts`
- [x] T028 [US2] Implement explicit override-retention policy during preset apply in `desktop/electron/ipc/handlers.ts`
- [x] T029 [US2] Extend renderer policy store with preview/apply state and optimistic refresh handling in `desktop/src/state/model-policy-store.ts`
- [x] T030 [US2] Expose preview/apply actions from the policy hook in `desktop/src/hooks/useModelPolicy.ts`
- [x] T031 [US2] Add apply-confirmation UI for keeping or replacing manual overrides in `desktop/src/pages/SettingsPage.tsx`
- [x] T032 [US2] Integrate preset preview, replacement warnings, and bulk apply confirmation in `desktop/src/pages/SettingsPage.tsx`

**Checkpoint**: User Story 2 is complete when presets can be previewed and applied without manual per-agent edits.

---

## Phase 5: User Story 3 - السقوط الآمن عند تعذر النموذج الأساسي (Priority: P1)

**Goal**: Validate every enabled agent before launch, fall back to an approved secondary model when possible, and block the run early with a precise explanation when no valid option exists.

**Independent Test**: Simulate an unavailable primary model, a missing provider credential, an unsupported-tools mismatch, and a provider failure after execution starts, then verify that the system either switches to the approved fallback, blocks the run before worker execution begins, or records the in-run failure with explicit policy/runtime metadata and trace events.

### Tests for User Story 3

- [ ] T033 [P] [US3] Add resolver fallback, capability, and role-policy matrix coverage for sensitive, coding, and wide-context agents in `desktop/electron/policy/__tests__/resolver.test.ts`
- [ ] T034 [P] [US3] Add preflight run-blocking coverage for invalid policy assignments in `desktop/electron/ipc/__tests__/crew-start-run-policy.test.ts`
- [ ] T035 [P] [US3] Add trace payload coverage for policy decisions in `desktop/electron/ipc/__tests__/policy-tracing.test.ts`
- [ ] T036 [P] [US3] Add coverage for post-start provider failure reporting in `desktop/electron/ipc/__tests__/crew-run-provider-failure.test.ts`

### Implementation for User Story 3

- [x] T037 [US3] Implement capability, lifecycle, credential, preview, and constraint checks in `desktop/electron/policy/resolver.ts`
- [x] T038 [US3] Persist `policyResolutionSnapshot` alongside run records in `desktop/electron/persistence/run-store.ts`
- [x] T039 [US3] Integrate policy preflight, fallback selection, and blocking errors into run start handling in `desktop/electron/ipc/handlers.ts`
- [x] T040 [US3] Emit external trace events for policy resolution, fallback, and preflight blocking in `desktop/electron/ipc/handlers.ts`
- [x] T041 [US3] Extend worker start messages to accept resolved model metadata in `desktop/electron/worker/crew-worker.ts`
- [x] T042 [US3] Consume resolved models without re-deriving policy in `desktop/electron/worker/crew-runtime.ts`
- [x] T043 [US3] Add local provider/model constraint controls and validation messaging in `desktop/src/pages/SettingsPage.tsx`
- [x] T044 [US3] Surface fallback and blocked-run explanations before launch in `desktop/src/pages/ScanPage.tsx`
- [x] T045 [US3] Show run-time policy resolution outcomes and fallback reasons in `desktop/src/pages/HistoryPage.tsx`
- [x] T046 [US3] Record in-run provider failure as explicit policy/runtime failure metadata in `desktop/electron/ipc/handlers.ts`

**Checkpoint**: User Story 3 is complete when run start is policy-safe and every fallback or block decision is visible and auditable.

---

## Phase 6: User Story 4 - تحديث توصية مؤرخة وقابلة للمراجعة (Priority: P2)

**Goal**: Publish dated policy snapshots with source-backed review metadata, see diffs against the current snapshot, and warn when the active recommendation becomes stale.

**Independent Test**: Prepare a new snapshot with reviewer identity and official source references, compare it against the current active snapshot, publish it, and verify that the previous snapshot remains archived while the new one becomes active with visible review dates and source metadata.

### Tests for User Story 4

- [ ] T047 [P] [US4] Add snapshot storage and listing coverage, including `reviewByDate` stale-state rules, in `desktop/electron/persistence/__tests__/model-policy-store.test.ts`
- [ ] T048 [P] [US4] Add stale badge and publish review coverage driven by `reviewByDate` in `desktop/src/components/__tests__/PolicyStatusBadge.test.tsx`
- [ ] T049 [P] [US4] Add publish validation coverage for reviewer identity and source references in `desktop/electron/ipc/__tests__/model-policy-publish.test.ts`

### Implementation for User Story 4

- [x] T050 [US4] Implement snapshot listing plus publish/supersede persistence flows in `desktop/electron/persistence/model-policy-store.ts`
- [x] T051 [US4] Extend publish diff generation and supersession metadata in `desktop/electron/policy/diff.ts`
- [x] T052 [US4] Implement `MODEL_POLICY_LIST_SNAPSHOTS` in `desktop/electron/ipc/handlers.ts`
- [x] T053 [US4] Implement `MODEL_POLICY_PUBLISH_SNAPSHOT` in `desktop/electron/ipc/handlers.ts`
- [x] T054 [US4] Validate reviewer identity and non-empty official source references before publish in `desktop/electron/ipc/handlers.ts`
- [x] T055 [US4] Enhance stale, review-by, and preview-dependency states derived from `reviewByDate` in `desktop/src/components/PolicyStatusBadge.tsx`
- [x] T056 [US4] Add publish form fields for reviewer identity, approval notes, and official sources in `desktop/src/pages/SettingsPage.tsx`
- [x] T057 [US4] Add snapshot history, diff review, and publish workflow UI to `desktop/src/pages/SettingsPage.tsx`

**Checkpoint**: User Story 4 is complete when policy owners can review and publish dated recommendations without losing historical snapshots.

---

## Phase 7: User Story 5 - التخصيص اليدوي دون فقدان الأصل المعتمد (Priority: P2)

**Goal**: Allow a user to override one agent locally while preserving the recommended mapping, visible deviation status, and one-click return to policy defaults.

**Independent Test**: Apply a preset profile, override one agent manually, verify that the UI marks it as a manual exception with the original recommendation still visible, then restore that agent back to policy without affecting other agents.

### Tests for User Story 5

- [ ] T058 [P] [US5] Add override set/clear handler coverage in `desktop/electron/ipc/__tests__/model-policy-override.test.ts`
- [ ] T059 [P] [US5] Add per-agent override interaction coverage in `desktop/src/components/__tests__/AgentPolicyTable.override.test.tsx`

### Implementation for User Story 5

- [x] T060 [US5] Implement `MODEL_POLICY_SET_OVERRIDE` and `MODEL_POLICY_CLEAR_OVERRIDE` in `desktop/electron/ipc/handlers.ts`
- [x] T061 [US5] Persist manual overrides and restore-to-policy behavior in `desktop/electron/persistence/settings-store.ts`
- [x] T062 [US5] Add per-agent override actions and deviation copy in `desktop/src/components/AgentPolicyTable.tsx`
- [x] T063 [US5] Extend renderer policy store with override mutations in `desktop/src/state/model-policy-store.ts`
- [x] T064 [US5] Expose override save/reset actions in `desktop/src/hooks/useModelPolicy.ts`
- [x] T065 [US5] Show manual override state and reset affordances in `desktop/src/pages/SettingsPage.tsx`
- [x] T066 [US5] Render recommended-versus-current model context in `desktop/src/components/ModelPicker.tsx`

**Checkpoint**: User Story 5 is complete when a manual exception remains visible, reversible, and clearly separated from the policy recommendation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete policy lifecycle across renderer, main process, and run history surfaces

- [ ] T067 [P] Add policy lifecycle regression coverage across preview, apply, publish, and run snapshot flows in `desktop/electron/ipc/__tests__/model-policy-lifecycle.test.ts`
- [x] T068 [P] Add effective policy resolution summary to completed-run detail views in `desktop/src/pages/ReportPage.tsx`
- [ ] T069 [P] Add lightweight performance coverage for policy load and preview generation in `desktop/electron/policy/__tests__/performance.test.ts`
- [ ] T070 Add preflight timing instrumentation for policy load, preview generation, and validation in `desktop/electron/ipc/handlers.ts`
- [ ] T071 Run quickstart smoke validation and record desktop-specific performance verification notes in `specs/003-agent-model-policy/quickstart.md`
- [ ] T072 Add timed usability validation notes for 30-second policy comprehension and 1-minute preset review in `specs/003-agent-model-policy/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story
- **US1 (Phase 3)**: Depends on Foundational and defines the MVP surface
- **US2 (Phase 4)**: Depends on US1 because preset workflows build on the policy tab and shared renderer policy state
- **US3 (Phase 5)**: Depends on Foundational; recommended after US1 because both touch `desktop/src/pages/SettingsPage.tsx` and shared policy state
- **US4 (Phase 6)**: Depends on US2 because publish review reuses diff and preset comparison flows
- **US5 (Phase 7)**: Depends on US2 because manual overrides must coexist with preset-driven policy state
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 -> US2 -> US4
                   \        \
                    \        -> US5
                     \
                      -> US3

Polish depends on: US1 + US2 + US3 + US4 + US5
```

### Within Each User Story

- Story tests should be written before implementation and fail before the related code is added
- Policy state and data models should exist before renderer integration
- Main-process handlers should be complete before renderer actions are wired
- UI integration should be the last step in each story so the story can be demonstrated end-to-end

### Parallel Opportunities

- **Phase 1**: T002 and T003 can run in parallel after T001
- **Phase 2**: T004, T005, T006, T008, T009, and T010 can run in parallel once file scaffolding is agreed
- **US1**: T015, T016, T017, T018, T019, and T020 can run in parallel across tests, store, hook, and components
- **US2**: T023, T024, and T025 can run in parallel while handler work is queued
- **US3**: T033, T034, T035, and T036 can run in parallel; T041, T044, and T045 can be split once T039 lands
- **US4**: T047, T048, and T049 can run in parallel; T050 and T051 can proceed in parallel before handler/UI wiring
- **US5**: T058 and T059 can run in parallel; T062 and T063 can proceed in parallel after T060 and T061
- **Polish**: T067, T068, and T069 can run in parallel before T070 and T071

---

## Parallel Example: User Story 1

```text
Task: "Add active policy state handler coverage in desktop/electron/ipc/__tests__/model-policy-state.test.ts"
Task: "Add policy tab rendering coverage in desktop/src/pages/__tests__/SettingsPage.model-policy.test.tsx"
Task: "Create renderer policy state store in desktop/src/state/model-policy-store.ts"
Task: "Create policy loading hook in desktop/src/hooks/useModelPolicy.ts"
Task: "Create review-status badge component in desktop/src/components/PolicyStatusBadge.tsx"
Task: "Create per-agent policy table in desktop/src/components/AgentPolicyTable.tsx"
```

## Parallel Example: User Story 2

```text
Task: "Add preview/apply profile handler coverage in desktop/electron/ipc/__tests__/model-policy-profile-actions.test.ts"
Task: "Add profile preview interaction coverage in desktop/src/components/__tests__/PolicyProfilePanel.test.tsx"
Task: "Create preset profile cards and diff preview UI in desktop/src/components/PolicyProfilePanel.tsx"
```

## Parallel Example: User Story 3

```text
Task: "Add resolver fallback and capability coverage in desktop/electron/policy/__tests__/resolver.test.ts"
Task: "Add preflight run-blocking coverage in desktop/electron/ipc/__tests__/crew-start-run-policy.test.ts"

After run-start integration lands:
Task: "Extend worker start messages in desktop/electron/worker/crew-worker.ts"
Task: "Surface fallback and blocked-run explanations in desktop/src/pages/ScanPage.tsx"
Task: "Show run-time policy resolution outcomes in desktop/src/pages/HistoryPage.tsx"
```

## Parallel Example: User Story 4

```text
Task: "Add snapshot storage and listing coverage in desktop/electron/persistence/__tests__/model-policy-store.test.ts"
Task: "Add stale badge and publish review coverage in desktop/src/components/__tests__/PolicyStatusBadge.test.tsx"
Task: "Implement snapshot listing plus publish/supersede persistence flows in desktop/electron/persistence/model-policy-store.ts"
Task: "Extend publish diff generation in desktop/electron/policy/diff.ts"
```

## Parallel Example: User Story 5

```text
Task: "Add override set/clear handler coverage in desktop/electron/ipc/__tests__/model-policy-override.test.ts"
Task: "Add per-agent override interaction coverage in desktop/src/components/__tests__/AgentPolicyTable.override.test.tsx"

After override handlers land:
Task: "Add per-agent override actions in desktop/src/components/AgentPolicyTable.tsx"
Task: "Extend renderer policy store with override mutations in desktop/src/state/model-policy-store.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate the explicit mapping view end-to-end
5. Demo the model-policy tab before layering presets and runtime safety

### Incremental Delivery

1. Setup + Foundational -> policy infrastructure ready
2. US1 -> explicit mapping visibility
3. US2 -> preset-driven bulk operations
4. US3 -> safe runtime resolution and run blocking
5. US4 -> governed, dated policy publication
6. US5 -> advanced local exceptions without losing the baseline

### Suggested MVP Scope

- **Recommended MVP**: Phase 1 + Phase 2 + Phase 3
- This scope delivers the first user-visible value by replacing unresolved defaults with explicit, reviewable per-agent mappings

---

## Notes

- Every task uses the required checklist format with checkbox, sequential ID, optional `[P]`, required story label inside story phases, and explicit file path
- `desktop/src/pages/SettingsPage.tsx` is intentionally touched across multiple stories, so stories should be sequenced carefully to avoid merge conflicts
- `desktop/electron/ipc/handlers.ts` is a shared hotspot for US1, US2, US3, US4, and US5 and should be implemented in story order
- Keep the policy recommendation, manual override, and effective runtime resolution visibly separate in every UI and persistence change
