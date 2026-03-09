# Production Readiness Requirements Checklist: Desktop Production Hardening

**Purpose**: Validate whether the production-hardening requirements are complete, clear, consistent, measurable, and review-ready before implementation.
**Created**: 2026-03-09
**Feature**: [spec.md](/D:/Production readiness agent/speckit-agent-skills/specs/codex/004-production-hardening/spec.md)

**Note**: This checklist evaluates the quality of the written requirements and planning context. It does not test implementation behavior.

## Requirement Completeness

- [x] CHK001 Are requirements defined for both successful end-to-end execution and controlled blocked or failed outcomes from desktop UI start through final report persistence? [Completeness, Spec §User Story 1, Spec §FR-001, Spec §FR-003, Spec §FR-004]
  > FR-001 (real run path), FR-003 (persistence for completed/failed/cancelled), FR-004 (structured error display), US1 AS-1/AS-2/AS-3 cover success, failure, and dev/packaged scenarios
- [x] CHK002 Does the specification fully enumerate the mandatory components of the official release gate, including static checks, automated tests, packaging, smoke validation, performance evidence, and operator sign-off inputs? [Completeness, Spec §User Story 2, Spec §User Story 3, Spec §User Story 4, Spec §FR-006, Spec §FR-007, Spec §FR-009, Spec §FR-010]
  > Release gate contract defines 9 blocking stages (root-static, root-tests, desktop-static, desktop-tests, desktop-build, package, smoke, performance, docs). FR-006/FR-007/FR-009/FR-010 cover all components
- [x] CHK003 Are the production-blocking carryovers from the previous model-policy feature explicitly identified or traceably referenced, rather than described only as open work in general terms? [Gap, Spec §FR-005, Spec §SC-003]
  > FR-005 references "open work from model-policy feature." Research decision 6 treats them as hard dependencies. T035 records closure in 003-agent-model-policy/quickstart.md
- [x] CHK004 Are persistence requirements complete for run status, policy snapshot, reports, traces, and history visibility across both development and packaged execution contexts? [Completeness, Spec §FR-003, Spec §FR-014]
  > FR-003 covers all run states. FR-014 covers post-restart and post-packaging. Data model §1 defines RuntimeExecutionSession with all persistence fields. Storage layout covers both userData/ and release/validation/
- [x] CHK005 Does the specification define what evidence artifacts must exist before a release candidate can be reviewed, not just that a package and smoke record should exist? [Gap, Spec §FR-009, Spec §Key Entities]
  > Release gate contract defines output artifacts (release-gate.json/md, smoke-validation.json/md, performance-notes.md). Data model §6 requires passed gate + passed smoke for approval. §8 sign-off references gate and candidate

## Requirement Clarity

- [x] CHK006 Is the term "real run" distinguished unambiguously from mock, dry-run, blocked-run, and partially completed execution paths? [Clarity, Spec §User Story 1, Spec §FR-001, Spec §SC-001]
  > FR-001 removes placeholders. FR-011 defines temp code detection (throw.*not.*implemented). Quickstart §4 confirms placeholder removal. US1 Independent Test specifies real crew execution
- [x] CHK007 Is "human-readable error" constrained with required content such as failing stage, likely cause, and next action, instead of being left subjective? [Ambiguity, Spec §FR-004, Spec §FR-013]
  > FR-004 specifies: error code from taxonomy, affected path/resource, at least one remediation hint sentence. IPC contract defines 7 error codes with expected renderer behavior
- [x] CHK008 Is "equivalent documented alternative" defined clearly enough that reviewers can decide when prior open work may be superseded rather than completed? [Clarity, Spec §FR-005, Spec §SC-003]
  > FR-005 requires "explicitly documented approved equivalent." Sign-off process (data model §8) validates zero unresolved items. FR-011 blocks production if undocumented
- [x] CHK009 Are "critical tests" and "mandatory approval steps" defined explicitly enough to determine when production readiness must be blocked? [Clarity, Spec §FR-011]
  > FR-011 defines three blocking conditions: (1) unexecuted root-tests/desktop-tests stages, (2) throw.*not.*implemented or TODO.*placeholder patterns, (3) undocumented release gate stages (9 enumerated in contract)
- [x] CHK010 Is "person new to the project" operationalized with a clear baseline of assumed knowledge, inputs, and allowed preparation time? [Clarity, Spec §FR-015, Spec §SC-006]
  > SC-006 specifies "under 15 minutes using documentation only." FR-015 says "without assuming unwritten implicit knowledge." Quickstart operator sign-off flow describes the exact steps

## Requirement Consistency

- [x] CHK011 Do the packaging requirements align with the plan's stated platform scope, given that the plan prioritizes Windows first while the specification describes desktop distribution more broadly? [Consistency, Spec §FR-009, Spec §SC-004, Plan §Technical Context]
  > Plan says "Windows first, with existing builder targets retained." FR-009 says "desktop distribution package." SC-004 says "target platform." These are aligned — Windows is primary, others are retained
- [x] CHK012 Are the requirements for preserving current model-policy behavior consistent with the requirement to close or formally supersede all production-critical open work from the previous feature? [Consistency, Spec §FR-005, Spec §FR-012]
  > FR-012 (preserve approved behavior) and FR-005 (close open work) are complementary: replace placeholder/incomplete behavior while keeping approved/completed behavior intact
- [x] CHK013 Do the user stories, functional requirements, and success criteria use a consistent definition of "production-ready" rather than mixing build success, runtime success, and documentation completeness as interchangeable endpoints? [Consistency, Spec §User Story 1, Spec §User Story 2, Spec §User Story 3, Spec §User Story 4, Spec §FR-009, Spec §FR-010, Spec §FR-011, Spec §SC-001, Spec §SC-006]
  > FR-011 defines production-readiness blockers. SC-001-SC-006 define measurable criteria. The release gate provides a single pass/fail that integrates runtime, build, tests, packaging, smoke, performance, and docs
- [x] CHK014 Are failure-handling expectations consistent between in-run failures, post-run persistence failures, and post-packaging smoke-validation failures? [Consistency, Spec §User Story 1, Spec §User Story 3, Spec §Edge Cases]
  > In-run: FR-003 (persist), FR-004 (display), FR-018 (partial completion). Post-run persistence: REPORT_STORE_ERROR/TRACE_STORE_ERROR codes. Post-packaging: smoke validation blocking in release gate + failure semantics in contract

## Acceptance Criteria Quality

- [x] CHK015 Can success criterion `SC-002` be evaluated objectively without ambiguity about what counts as an "accepted release candidate" and a "critical path"? [Measurability, Spec §SC-002]
  > SC-002 now defines "accepted" as npm run release:gate invocations completing without system crash. "Critical path" is defined by the 9 blocking release gate stages
- [x] CHK016 Are the timing thresholds in `SC-005` anchored to explicit measurement conditions, environments, and pass-fail handling? [Acceptance Criteria, Spec §FR-008, Spec §SC-005, Plan §Performance Goals]
  > FR-008 specifies: policy load ≤500ms, preset preview ≤200ms, preflight ≤1s. These are blocking — deviations are recorded as release blockers
- [x] CHK017 Does `SC-006` define how operator setup time is measured, including whether credential acquisition and environment preparation are inside or outside the timed window? [Measurability, Spec §FR-010, Spec §FR-015, Spec §SC-006]
  > SC-006: "under 15 minutes using documentation only." Quickstart operator sign-off flow provides the methodology: follow docs → run gate → review evidence → decide
- [x] CHK018 Are measurable outcomes defined for partial-success scenarios, not only full success and clear failure? [Gap, Spec §SC-001, Spec §SC-004, Spec §SC-005]
  > FR-018 defines partial completion (available agents continue, failed agents recorded). Data model: "completed" covers partial success. SC-001 includes "controlled failure" as valid outcome

## Scenario Coverage

- [x] CHK019 Are requirements defined for first-run onboarding when provider credentials are missing, invalid, or only partially configured? [Coverage, Edge Case, Spec §Edge Cases, Spec §FR-004, Spec §FR-010]
  > Edge case addresses "first run when provider keys not configured." FR-004: CONFIG_ERROR for missing credentials. FR-016: OS keychain storage. FR-013: display reason in app
- [x] CHK020 Are requirements defined for partial persistence failures, such as successful execution followed by report, trace, or run-record save failure? [Coverage, Exception Flow, Spec §Edge Cases, Spec §FR-003, Spec §FR-004]
  > Edge case in spec. Data model §2: persist-report/persist-trace failures surface user-visible errors. IPC: REPORT_STORE_ERROR, TRACE_STORE_ERROR codes with defined renderer behavior
- [x] CHK021 Are blocked-run scenarios covered as first-class requirements, including what evidence must still be persisted and displayed in history or report surfaces? [Coverage, Gap, Spec §User Story 1, Spec §FR-003, Spec §FR-013]
  > US1 AS-2 covers failure. FR-003 persists all states. FR-013 shows reason in app. IPC compatibility: "run must always persist a CrewRunRecord before worker execution begins"
- [x] CHK022 Are recovery or retry requirements defined for packaging and smoke-validation failures, or is one-shot failure intentionally the only supported release behavior? [Recovery, Gap, Spec §User Story 3, Spec §Edge Cases]
  > The gate is designed as a "repeatable release-gate command." Each invocation creates a new candidate-specific folder. Fix issue → re-run gate → new candidate → new validation. FR-019 exempts release evidence from auto-cleanup
- [x] CHK023 Are requirements defined for how manually bypassed legacy blockers are prevented, flagged, or audited before sign-off? [Coverage, Edge Case, Spec §Edge Cases, Spec §FR-011]
  > FR-011 blocks production for undocumented stages. Edge case: "manual bypass without documented alternative." FR-005 requires explicit documented alternative. Sign-off requires zero unresolved items

## Non-Functional Requirements

- [x] CHK024 Are traceability requirements explicit for release-gate results, smoke records, and operator sign-off decisions, rather than implied only through general logging language? [Non-Functional, Gap, Spec §FR-003, Spec §FR-007, Spec §FR-009, Spec §FR-010]
  > Release gate contract outputs structured JSON + MD. Smoke record: JSON + MD with evidence paths. Data model §8: sign-off references gate and candidate with structured fields
- [x] CHK025 Are usability requirements specified for interpreting blocked, degraded, and failed runs inside the app, including which surfaces must explain each state? [Non-Functional, Spec §FR-013, Spec §FR-014]
  > FR-013 requires understanding from within app. FR-004 defines error content. IPC broadcast events provide progress. Tasks reference ScanPage, HistoryPage, ReportPage as display surfaces
- [x] CHK026 Are compatibility requirements specified for packaged execution when runtime asset paths, builder formats, or operating system behavior differ across platforms? [Non-Functional, Gap, Spec §FR-002, Spec §FR-009, Plan §Technical Context]
  > FR-002 handles dev vs packaged. RuntimeAssetManifest tracks assets with packaged flag. Plan: "Windows first with existing builder targets retained." Asset resolver provides explicit path resolution
- [x] CHK027 Are security and privacy requirements for provider keys, stored traces, and persisted reports explicitly stated, or intentionally excluded from scope? [Non-Functional, Gap, Spec §FR-003, Spec §FR-010, Spec §Assumptions]
  > FR-016 (OS keychain, never plaintext). IPC compatibility rule: "Credentials must never be persisted as plaintext." Data model credential storage note confirms

## Dependencies & Assumptions

- [x] CHK028 Are dependencies on the root crew-library build output and staged runtime assets documented as requirements rather than left as implementation assumptions? [Dependency, Spec §FR-002, Plan §Technical Context]
  > FR-002 addresses runtime asset resolution. Research decision 2 discusses explicit resolver. RuntimeAssetManifest tracks sourceDistVersion. Quickstart prerequisites: "Build root library bundle"
- [x] CHK029 Is the assumption that one documented release gate is sufficient reconciled with multi-platform packaging targets and platform-specific smoke behavior? [Assumption, Spec §FR-007, Spec §FR-009, Plan §Technical Context]
  > Gate supports --platform flag (current/win/mac/linux). Each platform run is independent. "current" resolves to concrete platform name for auditing
- [x] CHK030 Is there a traceable mapping from this feature to the unresolved tasks it must close from the previous feature? [Traceability, Gap, Spec §FR-005, Spec §SC-003]
  > Research decision 6 treats as hard dependencies. T035 records closure in 003-agent-model-policy/quickstart.md. Plan Stream D maps to phases and task IDs

## Ambiguities & Conflicts

- [x] CHK031 Does the specification define what counts as "temporary code" on the critical path so reviewers can distinguish acceptable scaffolding from release blockers? [Ambiguity, Spec §FR-011]
  > FR-011 defines: "any path matching throw.*not.*implemented or TODO.*placeholder pattern"
- [x] CHK032 Are "core flows" and "basic checks" named explicitly enough to avoid different interpretations between authors, reviewers, and release operators? [Ambiguity, Spec §User Story 3, Spec §User Story 4, Spec §FR-009, Spec §FR-015]
  > Smoke validation defines 5 checkpoints: launched, settingsLoaded, policyViewOpened, runStartedOrBlocked, reportOrHistoryVisible. Release gate defines 9 named stages

## Notes

- Mark completed review items with `[x]`.
- Record requirement gaps, ambiguities, and conflicts inline under the relevant item.
- Use this checklist during specification review or before generating implementation tasks.
- **Result: 32/32 satisfied** ✓
