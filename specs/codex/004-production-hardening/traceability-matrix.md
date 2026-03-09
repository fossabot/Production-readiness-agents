# Traceability Matrix: Desktop Production Hardening

**Feature Branch**: `codex/004-production-hardening`
**Purpose**: Cross-document alignment between spec FRs, data model entities, IPC channels, release gate stages, tasks, and success criteria

## FR → SC → Data Model → IPC → Gate Stage → Tasks

| FR | Description | SC | Data Model Entity | IPC Channel/Event | Gate Stage | Primary Tasks |
|----|-------------|----|--------------------|-------------------|------------|---------------|
| FR-001 | Replace placeholder runtime | SC-001 | RuntimeExecutionSession, RuntimeExecutionStep | CREW_START_RUN | root-static, root-tests | T018, T019, T020, T021 |
| FR-002 | Runtime asset resolution | SC-001 | RuntimeAssetManifest | — | desktop-build | T008, T012, T039 |
| FR-003 | Persist run state/reports/traces | SC-001 | RuntimeExecutionSession | CREW_GET_RUN, CREW_LIST_RUNS | — | T011, T022 |
| FR-004 | Human-readable errors | SC-001 | RuntimeExecutionStep (error fields) | RunErrorEvent | — | T007, T023, T043 |
| FR-005 | Close 003 open work | SC-003 | — | — | root-tests, desktop-tests | T035, T050 |
| FR-006 | Automated verification suite | SC-002 | ReleaseGateCheck | — | All 9 stages | T025-T028, T033-T034 |
| FR-007 | Documented release gate | SC-002 | ReleaseGateResult | — | All 9 stages | T030, T031 |
| FR-008 | Performance thresholds | SC-005 | ReleaseGateCheck (performance) | — | performance | T032, T033 |
| FR-009 | Packaged distribution + smoke | SC-004 | ReleaseCandidateArtifact, SmokeValidationRecord | — | package, smoke | T040, T041, T042, T044 |
| FR-010 | Operational documentation | SC-006 | ReleaseSignOffChecklist | — | docs | T047, T048 |
| FR-011 | Block production readiness | SC-002 | ReleaseGateCheck | — | root-tests, desktop-tests, docs | T029, T030 |
| FR-012 | Preserve existing behavior | SC-001 | — | All existing channels | — | T054 |
| FR-013 | In-app error understanding | SC-001 | RuntimeExecutionStep | RunErrorEvent, AgentStatusEvent | — | T023, T024, T043 |
| FR-014 | Data survives restart/packaging | SC-001 | RuntimeExecutionSession | CREW_GET_RUN, CREW_GET_REPORT | — | T022, T053 |
| FR-015 | Sign-off by new person | SC-006 | ReleaseSignOffChecklist | — | docs | T048, T051 |
| FR-016 | OS keychain credentials | SC-001, SC-006 | — (external: OS keychain) | — | — | T056, T062, T063 |
| FR-017 | Concurrent run prevention | SC-001 | RuntimeExecutionSession (validation) | CREW_START_RUN (RUN_ALREADY_ACTIVE) | — | T058, T060 |
| FR-018 | Partial completion resilience | SC-001 | RuntimeExecutionSession (completed+partial) | RunLifecycleEvent | — | T059, T061 |
| FR-019 | Auto-cleanup retention | — | RuntimeExecutionSession | CREW_DELETE_RUN | — | T057, T064 |

## Data Model Entity → FR Coverage

| Entity | FRs Covered |
|--------|-------------|
| RuntimeExecutionSession | FR-001, FR-003, FR-017, FR-018 |
| RuntimeExecutionStep | FR-001, FR-003, FR-004, FR-013 |
| ReleaseGateResult | FR-007, FR-011 |
| ReleaseGateCheck | FR-006, FR-008, FR-011 |
| RuntimeAssetManifest | FR-002 |
| ReleaseCandidateArtifact | FR-009 |
| SmokeValidationRecord | FR-009 |
| ReleaseSignOffChecklist | FR-010, FR-015 |

## IPC Channel → FR Coverage

| Channel | FRs Covered |
|---------|-------------|
| CREW_START_RUN | FR-001, FR-017 |
| CREW_CANCEL_RUN | FR-003 |
| CREW_GET_RUN | FR-003, FR-014 |
| CREW_LIST_RUNS | FR-003 |
| CREW_GET_REPORT | FR-014 |
| CREW_EXPORT_REPORT | FR-014 |
| CREW_DELETE_RUN | FR-019 |

## Release Gate Stage → FR Coverage

| Stage | FRs Covered |
|-------|-------------|
| root-static | FR-001, FR-005, FR-011 |
| root-tests | FR-005, FR-006, FR-011 |
| desktop-static | FR-006, FR-011 |
| desktop-tests | FR-005, FR-006, FR-011 |
| desktop-build | FR-002, FR-006 |
| package | FR-009 |
| smoke | FR-009 |
| performance | FR-008 |
| docs | FR-010, FR-011, FR-015 |

## SC → FR Reverse Mapping

| SC | FRs Validated |
|----|---------------|
| SC-001 | FR-001, FR-002, FR-003, FR-004, FR-012, FR-013, FR-014, FR-016, FR-017, FR-018 |
| SC-002 | FR-006, FR-007, FR-011 |
| SC-003 | FR-005 |
| SC-004 | FR-009 |
| SC-005 | FR-008 |
| SC-006 | FR-010, FR-015, FR-016 |
