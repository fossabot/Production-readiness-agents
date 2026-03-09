# Tasks: Desktop Electron UI

**Input**: Design documents from `/specs/002-desktop-electron-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-contract.md

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization using electron-vite + React + TypeScript

- [x] T001 Scaffold Electron project with `npm create @quick-start/electron` (React + TypeScript template) in `desktop/`
- [x] T002 Configure `desktop/electron.vite.config.ts` for main, preload, and renderer with strict TypeScript
- [x] T003 [P] Configure `desktop/tsconfig.json` with ES2022, NodeNext, strict, exactOptionalPropertyTypes
- [x] T004 [P] Configure `desktop/electron-builder.yml` for Windows (NSIS), macOS (DMG), Linux (AppImage)
- [x] T005 [P] Add project dependencies: React 19, Zustand, electron-store, electron-trpc, react-router-dom, react-markdown

**Checkpoint**: Electron app starts with blank window in dev mode (`npm run dev`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, IPC layer, persistence, and worker infrastructure that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

### Shared Types

- [x] T006 [P] Define ErrorCode enum and IpcError type in `desktop/electron/types/errors.ts` per data-model.md §2
- [x] T007 [P] Define CrewRunStatus, AgentStatus, AgentRunState, FindingsSummary, RunError, CrewRunRecord in `desktop/electron/types/run.ts` per data-model.md §1-§3
- [x] T008 [P] Define CrewWorkerEvent discriminated union (5 variants) in `desktop/electron/types/events.ts` per data-model.md §6
- [x] T009 [P] Define Settings, AgentConfig, ModelConfig, SecretsConfig, RuntimePolicy, UiPreferences in `desktop/electron/types/settings.ts` per data-model.md §4-§5.1

### IPC Infrastructure

- [x] T010 Define IPC channel name constants in `desktop/electron/ipc/channels.ts` per ipc-contract.md (11 commands + 2 broadcast channels)
- [x] T011 Define IPC input/output type contracts in `desktop/electron/ipc/contracts.ts` per ipc-contract.md Preload API
- [x] T012 Implement contextBridge preload exposing ElectronAPI in `desktop/electron/security/preload.ts` per ipc-contract.md
- [x] T013 Create type-safe IPC client wrapper in `desktop/src/lib/ipc-client.ts` consuming window.electronAPI

### Persistence Layer

- [x] T014 [P] Implement settings-store (electron-store wrapper with defaults and schema validation) in `desktop/electron/persistence/settings-store.ts`
- [x] T015 [P] Implement run-store (CRUD for CrewRunRecord JSON files in userData/runs/) in `desktop/electron/persistence/run-store.ts`
- [x] T016 [P] Implement report-store (read/write/export report files in userData/reports/) in `desktop/electron/persistence/report-store.ts`
- [x] T017 [P] Implement trace-store (append-only JSONL writer in userData/traces/) in `desktop/electron/persistence/trace-store.ts`

### Worker Infrastructure

- [x] T018 Implement cancellation module (AbortController + CANCEL message protocol) in `desktop/electron/worker/cancellation.ts`
- [x] T019 Implement event-bus (bridges TracingCollector events to CrewWorkerEvent postMessage) in `desktop/electron/worker/event-bus.ts`
- [x] T020 Implement CrewRuntime adapter interface in `desktop/electron/worker/crew-runtime.ts` importing from `../../dist/index.js`
- [x] T021 Implement crew-worker entry point (receives START_RUN/CANCEL, uses CrewRuntime, emits CrewWorkerEvent) in `desktop/electron/worker/crew-worker.ts`

### Electron Main Process

- [x] T022 Implement Electron main entry (BrowserWindow with security config, CSP headers, navigation blocking) in `desktop/electron/main.ts`
- [x] T023 Implement IPC handlers skeleton (all 11 commands wired to persistence stores and worker) in `desktop/electron/ipc/handlers.ts`

### Renderer Foundation

- [x] T024 [P] Create Zustand run-store (active run state synced from IPC events) in `desktop/src/state/run-store.ts`
- [x] T025 [P] Create Zustand settings-store (settings state synced from IPC) in `desktop/src/state/settings-store.ts`
- [x] T026 Create App.tsx with react-router-dom routing (5 pages: /, /progress, /report, /settings, /history) in `desktop/src/App.tsx`

**Checkpoint**: Foundation ready — app starts, IPC channels respond, settings load with defaults, worker can be spawned

---

## Phase 3: User Story 1 - تشغيل فحص جاهزية الإنتاج (Priority: P1) MVP

**Goal**: User selects a repository, starts an audit, and the crew runs in a Worker Thread without freezing the UI

**Independent Test**: Select a real repo, press Start, observe status transition queued → starting → running. UI stays responsive.

### Implementation for User Story 1

- [x] T027 [P] [US1] Create RepoSelector component (path input + Browse button calling dialog:select-folder) in `desktop/src/components/RepoSelector.tsx`
- [x] T028 [P] [US1] Create FindingBadge component (severity color badge: Critical/High/Medium/Low) in `desktop/src/components/FindingBadge.tsx`
- [x] T029 [US1] Create ScanPage (RepoSelector + Start button + validation + error display) in `desktop/src/pages/ScanPage.tsx`
- [x] T030 [US1] Create useCrewRun hook (startRun, subscribe to crew:run-event, update Zustand run-store) in `desktop/src/hooks/useCrewRun.ts`
- [x] T031 [US1] Wire crew:start-run IPC handler to spawn worker, validate repo path, create CrewRunRecord in `desktop/electron/ipc/handlers.ts`
- [x] T032 [US1] Wire crew:run-event broadcast (forward worker postMessage events to renderer via IPC) in `desktop/electron/ipc/handlers.ts`
- [x] T033 [US1] Add pre-flight validation (repo exists, is git, API keys present) in `desktop/electron/ipc/handlers.ts` crew:start-run handler

**Checkpoint**: User can select repo, start audit, see status change to running. UI does not freeze.

---

## Phase 4: User Story 2 - متابعة تقدم الوكلاء في الوقت الفعلي (Priority: P1)

**Goal**: Live display of agent status cards with real-time updates during audit execution

**Independent Test**: Start audit on small repo, observe agent cards updating live with status, timer, and findings count.

### Implementation for User Story 2

- [x] T034 [P] [US2] Create AgentCard component (name, status badge, duration timer, findings count) in `desktop/src/components/AgentCard.tsx`
- [x] T035 [US2] Create ProgressPage (grid of AgentCards + live findings sidebar + cancel button) in `desktop/src/pages/ProgressPage.tsx`
- [x] T036 [US2] Wire agent.status and agent.finding events from Zustand run-store to ProgressPage components in `desktop/src/pages/ProgressPage.tsx`
- [x] T037 [US2] Handle concurrent agent events (independent card updates, no data loss) in `desktop/src/state/run-store.ts`

**Checkpoint**: Agent cards show live status, timer counts up, findings appear with severity badges. Multiple agents update independently.

---

## Phase 5: User Story 3 - عرض التقرير النهائي (Priority: P1)

**Goal**: Display comprehensive report after audit completion with findings sorted by severity

**Independent Test**: Load a pre-existing JSON report and view it formatted in the UI, or complete a full audit run.

### Implementation for User Story 3

- [x] T038 [US3] Create ReportPage with executive summary, severity distribution, findings list, and detail panel in `desktop/src/pages/ReportPage.tsx`
- [x] T039 [US3] Implement finding detail view (description, evidence, recommendation, source agent) in `desktop/src/pages/ReportPage.tsx`
- [x] T040 [US3] Implement severity and agent filters for findings list in `desktop/src/pages/ReportPage.tsx`
- [x] T041 [US3] Wire crew:get-report IPC handler to read markdown/json from report-store in `desktop/electron/ipc/handlers.ts`
- [x] T042 [US3] Add Markdown rendering for report content using react-markdown in `desktop/src/pages/ReportPage.tsx`
- [x] T043 [US3] Add auto-navigation to ReportPage on run completion (when autoOpenReportOnCompletion is true) in `desktop/src/hooks/useCrewRun.ts`

**Checkpoint**: Full report displays after audit. Findings are filterable by severity. Markdown renders correctly.

---

## Phase 6: User Story 4 - تكوين النماذج والأدوات لكل وكيل (Priority: P2)

**Goal**: Advanced users can configure AI model, tools, and skills per agent before running an audit

**Independent Test**: Open Settings, change one agent's model, verify setting persists and applies to next run.

### Implementation for User Story 4

- [x] T044 [P] [US4] Create ModelPicker component (dropdown with provider grouping) in `desktop/src/components/ModelPicker.tsx`
- [x] T045 [US4] Create useSettings hook (getSettings, updateSettings, resetSettings via IPC) in `desktop/src/hooks/useSettings.ts`
- [x] T046 [US4] Create SettingsPage with 6 tabs (Agents, Models, Tools, Skills, Secrets, Runtime) in `desktop/src/pages/SettingsPage.tsx`
- [x] T047 [US4] Implement Agents tab (enable/disable agents, model selection per agent) in `desktop/src/pages/SettingsPage.tsx`
- [x] T048 [US4] Implement Tools tab (enable/disable tools per agent) in `desktop/src/pages/SettingsPage.tsx`
- [x] T049 [US4] Implement Skills tab (register and assign skills per agent) in `desktop/src/pages/SettingsPage.tsx`
- [x] T050 [US4] Implement Secrets tab (API key management with masked display) in `desktop/src/pages/SettingsPage.tsx`
- [x] T051 [US4] Wire settings:get, settings:update, settings:reset IPC handlers to settings-store in `desktop/electron/ipc/handlers.ts`
- [x] T052 [US4] Implement "Reset to Defaults" with confirmation dialog in `desktop/src/pages/SettingsPage.tsx`

**Checkpoint**: All 6 setting tabs work. Changes persist across app restarts. Reset to defaults works.

---

## Phase 7: User Story 5 - تصفح تاريخ التشغيلات السابقة (Priority: P2)

**Goal**: Browse past runs, filter by repo, re-open reports without re-running audits

**Independent Test**: View list of saved runs, click one to open its report, filter by repository path.

### Implementation for User Story 5

- [x] T053 [US5] Create HistoryPage (sortable list with repo path, date, duration, status, severity summary) in `desktop/src/pages/HistoryPage.tsx`
- [x] T054 [US5] Implement repo path filter and date sorting in `desktop/src/pages/HistoryPage.tsx`
- [x] T055 [US5] Implement "Open Report" action (navigate to ReportPage with historical runId) in `desktop/src/pages/HistoryPage.tsx`
- [x] T056 [US5] Implement "Delete Run" action with confirmation dialog (deletes record + report + traces) in `desktop/src/pages/HistoryPage.tsx`
- [x] T057 [US5] Wire crew:list-runs, crew:delete-run IPC handlers to run-store in `desktop/electron/ipc/handlers.ts`

**Checkpoint**: History shows all past runs. Open report works. Delete removes all associated files.

---

## Phase 8: User Story 6 - إلغاء تشغيل جارٍ (Priority: P2)

**Goal**: User can cancel a running audit with clean shutdown, partial report preserved

**Independent Test**: Start audit, press Cancel within 10 seconds, verify status transitions to cancelled within 30s.

### Implementation for User Story 6

- [x] T058 [US6] Add Cancel button to ProgressPage (disabled when not running or already cancelling) in `desktop/src/pages/ProgressPage.tsx`
- [x] T059 [US6] Wire crew:cancel-run IPC handler (sends CANCEL to worker, starts 30s timeout) in `desktop/electron/ipc/handlers.ts`
- [x] T060 [US6] Implement cancellation propagation in crew-worker (check isCancelled flag, graceful agent shutdown) in `desktop/electron/worker/crew-worker.ts`
- [x] T061 [US6] Handle cancelling → cancelled state transition with partial report generation in `desktop/electron/ipc/handlers.ts`
- [x] T062 [US6] Display partial report with "incomplete" banner for cancelled runs in `desktop/src/pages/ReportPage.tsx`

**Checkpoint**: Cancel completes within 30s. Partial results are preserved and viewable.

---

## Phase 9: User Story 7 - تصدير التقارير (Priority: P3)

**Goal**: Export reports as Markdown or JSON files to user-chosen location

**Independent Test**: Open a completed report, click "Export Markdown", save to desktop, verify file content.

### Implementation for User Story 7

- [x] T063 [US7] Add Export Markdown and Export JSON buttons to ReportPage in `desktop/src/pages/ReportPage.tsx`
- [x] T064 [US7] Wire crew:export-report IPC handler (open save dialog, copy report file) in `desktop/electron/ipc/handlers.ts`
- [x] T065 [US7] Add success/error feedback messages after export attempt in `desktop/src/pages/ReportPage.tsx`

**Checkpoint**: Both Markdown and JSON exports work. Exported files match displayed content.

---

## Phase 10: User Story 8 - إدارة سياسات التشغيل (Priority: P3)

**Goal**: Configure runtime policies: timeouts, concurrency, tracing, auto-open report

**Independent Test**: Set a low agent timeout, run audit, verify agent is stopped when it exceeds the timeout.

### Implementation for User Story 8

- [x] T066 [US8] Implement Runtime tab in SettingsPage (maxRunDuration, agentTimeout, maxConcurrency, tracing toggles, autoOpen) in `desktop/src/pages/SettingsPage.tsx`
- [x] T067 [US8] Apply maxRunDurationMs enforcement (setTimeout in main process, force cancel on expiry) in `desktop/electron/ipc/handlers.ts`
- [x] T068 [US8] Apply agentTimeoutMs enforcement per agent in crew-worker in `desktop/electron/worker/crew-worker.ts`
- [x] T069 [US8] Apply maxConcurrency semaphore in crew-worker agent scheduler in `desktop/electron/worker/crew-worker.ts`
- [x] T070 [US8] Apply persistRawTraces toggle (conditional trace-store writing) in `desktop/electron/worker/event-bus.ts`

**Checkpoint**: Runtime policies enforce correctly. Timeout stops agents. Concurrency limit respected.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T071 [P] Add error boundary component wrapping all pages with user-friendly error display in `desktop/src/components/ErrorBoundary.tsx`
- [x] T072 [P] Add app-wide navigation sidebar/header with links to all 5 pages in `desktop/src/App.tsx`
- [x] T073 Implement WORKER_CRASH detection (worker exit event → run status failed → partial report) in `desktop/electron/ipc/handlers.ts`
- [x] T074 Add CSP headers via session.defaultSession.webRequest.onHeadersReceived in `desktop/electron/main.ts`
- [x] T075 [P] Add application logging (structured logs to userData/logs/app.log) in `desktop/electron/persistence/trace-store.ts`
- [x] T076 Verify electron-builder packaging produces working installers for Windows/macOS/Linux
- [x] T077 Run quickstart.md validation (npm install, npm run dev, npm run build all succeed)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — MVP
- **US2 (Phase 4)**: Depends on US1 (needs run-store events and ProgressPage routing)
- **US3 (Phase 5)**: Depends on US1 (needs completed run to display report)
- **US4 (Phase 6)**: Depends on Foundational only (settings are independent)
- **US5 (Phase 7)**: Depends on US3 (needs ReportPage for re-opening reports)
- **US6 (Phase 8)**: Depends on US2 (needs ProgressPage with cancel button)
- **US7 (Phase 9)**: Depends on US3 (needs ReportPage with export buttons)
- **US8 (Phase 10)**: Depends on US4 (needs SettingsPage Runtime tab)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Foundational ──► US1 (P1) ──► US2 (P1) ──► US6 (P2)
                    │
                    └──► US3 (P1) ──► US5 (P2)
                              │
                              └──► US7 (P3)

Foundational ──► US4 (P2) ──► US8 (P3)
```

### Parallel Opportunities

- **Phase 1**: T003, T004, T005 can run in parallel
- **Phase 2**: T006-T009 (types), T014-T017 (persistence), T024-T025 (state) can run in parallel
- **Phase 3**: T027, T028 (components) can run in parallel
- **Phase 6**: US4 can run in parallel with US2/US3 (independent settings path)

---

## Parallel Example: User Story 1

```bash
# Launch components in parallel:
Task: "Create RepoSelector component in desktop/src/components/RepoSelector.tsx"
Task: "Create FindingBadge component in desktop/src/components/FindingBadge.tsx"

# Then sequentially:
Task: "Create ScanPage in desktop/src/pages/ScanPage.tsx"
Task: "Create useCrewRun hook in desktop/src/hooks/useCrewRun.ts"
Task: "Wire crew:start-run IPC handler"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (start audit)
4. **STOP and VALIDATE**: Select repo → Start → See status running
5. Demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (start audit) → MVP!
3. US2 (live progress) → Core experience
4. US3 (report view) → Complete audit cycle
5. US4 (settings) → Advanced configuration
6. US5 (history) → Long-term value
7. US6 (cancellation) → Safety
8. US7 (export) → Shareability
9. US8 (policies) → Fine-tuning

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The crew library must be built (`npm run build` from repo root) before desktop app can run
