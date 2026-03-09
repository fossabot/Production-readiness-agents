# Tasks: Production Readiness Crew

**Input**: Design documents from `/specs/001-production-readiness-crew/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Deferred — test tasks are planned in plan.md (tests/ directory with vitest) but deferred to a subsequent iteration. Test file structure and vitest setup will be added after core implementation is validated.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, TypeScript configuration, and shared type definitions

- [X] T001 Initialize TypeScript project: create package.json with deepagents dependency and tsconfig.json with ES2022 target and strict mode at repository root
- [X] T002 Create directory structure: src/types.ts, src/contracts/, src/tracing/, src/report/, tests/unit/, tests/integration/ per plan.md
- [X] T003 [P] Define shared TypeScript enums and base types (Severity, EffortLevel, Evidence) in src/types.ts per data-model.md
- [X] T004 [P] Define SubagentOutput interface (summary, findings, evidence, uncertainties, handoff) in src/contracts/output-contract.ts per data-model.md entity 6

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts and schemas that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Define Finding interface (id, title, severity, category, description, evidence, recommendation, effort, source_agent) in src/contracts/output-contract.ts per data-model.md entity 7
- [X] T006 [P] Define ProjectManifest interface (appType, packageManager, entryPoints, configFiles, isMonorepo, subprojects, languages) in src/types.ts per data-model.md entity 8
- [X] T007 [P] Define ExecutionContext interface (commands, environment, constraints, allowedCommands) in src/types.ts per data-model.md entity 9
- [X] T008 [P] Define FinalReport interface (executiveSummary, overallScore, findings, observations, coverageReport, remediationPlan, gaps, metadata, tracing) in src/contracts/report-schema.ts per data-model.md entity 10
- [X] T009 Define PARENT_RESULT_CONTRACT constant as typed schema in src/contracts/output-contract.ts, extracting from existing string constant in production-readiness-crew.subagents.ts
- [X] T010 Define SHARED_SAFETY_RULES constant as typed schema in src/contracts/output-contract.ts, extracting from existing string constant in production-readiness-crew.subagents.ts

**Checkpoint**: Foundation ready — all interfaces and contracts defined. User story implementation can now begin.

---

## Phase 3: User Story 1+2 — فحص جاهزية شامل + الاستكشاف البنيوي (Priority: P1) MVP

**Goal**: supervisor يستقبل طلب فحص ويفوض structural-scout لإنتاج ProjectManifest وExecutionContext، ثم يفوض بقية الوكلاء ويُنتج تقريراً نهائياً.

**Independent Test**: توجيه النظام إلى مستودع حقيقي والتحقق من أن التقرير النهائي يحتوي على نتائج من جميع الوكلاء الثمانية.

### Implementation for User Stories 1+2

- [X] T011 [US1] Refactor production-readiness-crew.subagents.ts to import shared types from src/types.ts and src/contracts/output-contract.ts instead of inline definitions
- [X] T012 [US2] Enhance structural-scout systemPrompt to explicitly output ProjectManifest and ExecutionContext structures as defined in src/types.ts in production-readiness-crew.subagents.ts
- [X] T013 [P] [US1] Define ProductionReadinessCrewTools interface in src/types.ts, replacing inline definition in production-readiness-crew.subagents.ts
- [X] T014 [P] [US1] Define ProductionReadinessCrewModels interface in src/types.ts, replacing inline definition in production-readiness-crew.subagents.ts
- [X] T015 [P] [US1] Define ProductionReadinessCrewSkills interface in src/types.ts, replacing inline definition in production-readiness-crew.subagents.ts
- [X] T016 [P] [US1] Define ProductionReadinessCrewOptions interface in src/types.ts, replacing inline definition in production-readiness-crew.subagents.ts
- [X] T017 [US1] Update createProductionReadinessCrewSubagents() in production-readiness-crew.subagents.ts to use imported types from src/types.ts and validate that all 8+1 subagents have complete explicit definitions (FR-004)
- [X] T018 [US1] Add failure handling logic to supervisor systemPrompt: retry failed subagent once, then record as gap (FR-012) in production-readiness-crew.subagents.ts
- [X] T019 [US1] Add anti-fabrication rules to all subagent systemPrompts: enforce Uncertainties section when evidence is insufficient (FR-013) in production-readiness-crew.subagents.ts
- [X] T020 [US1] Create ./index.ts barrel export at repository root exporting createProductionReadinessCrewSubagents, all types, and all contracts

**Checkpoint**: User Stories 1+2 complete. structural-scout produces ProjectManifest/ExecutionContext. supervisor delegates to all 8 subagents with explicit definitions.

---

## Phase 4: User Story 3 — التدقيق التخصصي المتوازي (Priority: P2)

**Goal**: الوكلاء التخصصيون الخمسة (code-performance, security-resilience, testing, infrastructure, docs-compliance) يعملون بالتوازي بعد structural-scout ويلتزمون بعقد الإخراج الموحد.

**Independent Test**: تشغيل وكيلين تخصصيين بالتوازي والتحقق من إرجاع نتائج ضمن نطاقهما فقط بالصيغة المطلوبة.

### Implementation for User Story 3

- [X] T021 [US3] Verify and enhance code-performance-auditor systemPrompt to enforce output contract (Summary/Findings/Evidence/Uncertainties/Handoff) and scope boundary in production-readiness-crew.subagents.ts
- [X] T022 [P] [US3] Verify and enhance security-resilience-auditor systemPrompt to enforce output contract and scope boundary in production-readiness-crew.subagents.ts
- [X] T023 [P] [US3] Verify and enhance testing-auditor systemPrompt to enforce output contract and scope boundary in production-readiness-crew.subagents.ts
- [X] T024 [P] [US3] Verify and enhance infrastructure-auditor systemPrompt to enforce output contract and scope boundary in production-readiness-crew.subagents.ts
- [X] T025 [P] [US3] Verify and enhance docs-compliance-auditor systemPrompt to enforce output contract and scope boundary in production-readiness-crew.subagents.ts
- [X] T026 [US3] Add Finding ID prefix assignment (PERF, SEC, TEST, INFRA, DOCS) instructions to each specialist auditor systemPrompt per contracts/output-contract.md in production-readiness-crew.subagents.ts
- [X] T027 [US3] Update supervisor systemPrompt to instruct parallel delegation of specialist agents after structural-scout completes (FR-006) in production-readiness-crew.subagents.ts

**Checkpoint**: User Story 3 complete. All 5 specialist auditors enforce output contract with Finding ID prefixes and work in parallel.

---

## Phase 5: User Story 4 — التحقق التشغيلي الآمن (Priority: P2)

**Goal**: runtime-verifier ينفذ أوامر تشغيل محدودة (install, build, test, lint) ضمن السياسة المسموح بها فقط، ويرفض أي أمر غير مدرج.

**Independent Test**: تشغيل runtime-verifier بعد structural-scout والتحقق من تنفيذ الأوامر المسموح بها فقط.

### Implementation for User Story 4

- [X] T028 [US4] Enhance runtime-verifier systemPrompt to enforce allowedCommands policy from ExecutionContext (install, build, test, lint only), reject unauthorized commands, and classify failures as blocking vs informational in production-readiness-crew.subagents.ts
- [X] T029 [US4] Add safety gate instructions to supervisor systemPrompt: runtime-verifier must not start before structural-scout confirms ProjectManifest and ExecutionContext (FR-007) in production-readiness-crew.subagents.ts

**Checkpoint**: User Story 4 complete. runtime-verifier enforces safety gate and command policy.

---

## Phase 6: User Story 5 — تقرير نهائي موحد (Priority: P2)

**Goal**: report-synthesizer يدمج نتائج جميع الوكلاء ويُنتج تقريراً نهائياً بصيغتي Markdown و JSON بدون تكرارات ومع خطة معالجة مرحلية.

**Independent Test**: تمرير مخرجات وهمية من عدة وكلاء والتحقق من جودة التقرير النهائي.

### Implementation for User Story 5

- [X] T030 [US5] Enhance report-synthesizer systemPrompt to implement: deduplication, severity unification (4-level scale), conflict resolution with evidence-based selection, and gap declaration in production-readiness-crew.subagents.ts
- [X] T031 [US5] Add severity scale definitions (Critical/High/Medium/Low + Observations) to report-synthesizer systemPrompt per FR-014 in production-readiness-crew.subagents.ts
- [X] T032 [P] [US5] Implement markdown-renderer in src/report/markdown-renderer.ts: takes FinalReport object and produces Markdown string per contracts/output-contract.md section 2a
- [X] T033 [P] [US5] Implement json-renderer in src/report/json-renderer.ts: takes FinalReport object and produces JSON string per contracts/output-contract.md section 2b
- [X] T034 [US5] Add report validation utility in src/report/validator.ts: checks all validation rules from contracts/output-contract.md section 3 (coverage entries, evidence presence, no duplicate IDs, MD/JSON parity)

**Checkpoint**: User Story 5 complete. report-synthesizer produces dual-format report with deduplication and validation.

---

## Phase 7: User Story 6 — تكوين الفريق وتخصيص الأدوات والنماذج (Priority: P3)

**Goal**: دالة الإنشاء تقبل تكوينات مخصصة (أدوات، نماذج، مهارات) وتُنتج فريقاً يعكس التكوين بدقة، مع إمكانية تعطيل الوكيل الاحتياطي.

**Independent Test**: استدعاء دالة الإنشاء بتكوينات مختلفة والتحقق من أن كل وكيل يحصل على الأدوات والنماذج المحددة فقط.

### Implementation for User Story 6

- [X] T035 [US6] Validate that createProductionReadinessCrewSubagents() correctly applies custom models per-agent from options.models in production-readiness-crew.subagents.ts
- [X] T036 [US6] Validate that createProductionReadinessCrewSubagents() correctly applies custom skills per-agent from options.skills in production-readiness-crew.subagents.ts
- [X] T037 [US6] Validate that includeGeneralPurposeFallback=false excludes general-purpose agent and includeGeneralPurposeFallback=true includes it with restricted scope in production-readiness-crew.subagents.ts
- [X] T038 [US6] Add input validation to createProductionReadinessCrewSubagents(): verify all required tool fields are provided, throw descriptive error if missing in production-readiness-crew.subagents.ts

**Checkpoint**: User Story 6 complete. Factory function handles all configuration permutations correctly.

---

## Phase 8: Cross-Cutting Concerns (Tracing + Monorepo)

**Purpose**: FR-016 (execution tracing) and FR-018 (monorepo multi-pass) — affects all user stories

- [X] T039 [P] Implement event-based tracer in src/tracing/tracer.ts: TracingCollector class that records crew:start, agent:delegated, agent:completed, agent:failed, agent:retried, tool:called, crew:completed events per research.md R4
- [X] T040 Define TracingData interface in src/contracts/report-schema.ts (delegations array, tool_calls count, retries count, total_duration_ms) per data-model.md entity 10
- [X] T041 Integrate TracingCollector into createProductionReadinessCrewSubagents() as optional middleware parameter in production-readiness-crew.subagents.ts
- [X] T042 Add monorepo multi-pass instructions to supervisor systemPrompt: detect monorepo via ProjectManifest.isMonorepo, split subprojects into batches, preserve cumulative findings between passes, declare batch count in final report per FR-018 in production-readiness-crew.subagents.ts
- [X] T043 Update report-synthesizer systemPrompt to include tracing summary section and monorepo batch metadata in final report per FR-016 and FR-017 in production-readiness-crew.subagents.ts
- [X] T044 Ensure ./index.ts barrel export includes TracingCollector, TracingData, all report renderers, and validator

---

## Phase 9: Polish and Finalization

**Purpose**: Constitution compliance, documentation, and final validation

- [X] T045 [P] Add constitution compliance check to supervisor systemPrompt: reference .specify/memory/constitution.md as governing authority, flag violations per FR-015 in production-readiness-crew.subagents.ts
- [X] T046 [P] Update quickstart.md at specs/001-production-readiness-crew/quickstart.md with actual import paths and usage examples reflecting final API surface
- [X] T047 Validate all 9 subagent definitions have complete explicit fields (name, description, systemPrompt, tools) with no implicit inheritance per constitution principle II, and verify each agent receives only minimum necessary tools per FR-011 (no excess tools granted) in production-readiness-crew.subagents.ts
- [X] T048 Run TypeScript compilation (tsc --noEmit) and fix any type errors across all src/ files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories 1+2 (Phase 3)**: Depends on Foundational — MVP milestone
- **User Story 3 (Phase 4)**: Depends on Phase 3 (needs subagent definitions)
- **User Story 4 (Phase 5)**: Depends on Phase 3 (needs structural-scout outputs)
- **User Story 5 (Phase 6)**: Depends on Phase 4+5 (needs all audit outputs)
- **User Story 6 (Phase 7)**: Can start after Phase 3 (independent of other stories)
- **Cross-Cutting (Phase 8)**: Depends on Phase 6 (tracing integrates with report)
- **Polish (Phase 9)**: Depends on all previous phases

### User Story Dependencies

- **US1+US2 (P1)**: Can start after Foundational — No dependencies on other stories. **MVP target.**
- **US3 (P2)**: Depends on US1+US2 (needs subagent definitions to enhance)
- **US4 (P2)**: Depends on US1+US2 (needs structural-scout ExecutionContext)
- **US5 (P2)**: Depends on US3+US4 (needs audit outputs to synthesize)
- **US6 (P3)**: Can start after US1+US2 — Independent of US3/US4/US5

### Within Each User Story

- Models/types before services
- Services before integration
- Core implementation before polish
- Story complete before moving to next priority

### Parallel Opportunities

- T003, T004 can run in parallel (Setup phase)
- T006, T007, T008 can run in parallel (Foundational phase)
- T013, T014, T015, T016 can run in parallel (US1 type definitions)
- T022, T023, T024, T025 can run in parallel (US3 specialist auditors)
- T032, T033 can run in parallel (US5 report renderers)
- US6 (Phase 7) can run in parallel with US3/US4/US5

---

## Parallel Example: User Story 1+2

```bash
# Launch type definitions in parallel:
Task: "Define ProductionReadinessCrewTools interface in src/types.ts"
Task: "Define ProductionReadinessCrewModels interface in src/types.ts"
Task: "Define ProductionReadinessCrewSkills interface in src/types.ts"
Task: "Define ProductionReadinessCrewOptions interface in src/types.ts"
```

## Parallel Example: User Story 3

```bash
# Launch specialist auditor enhancements in parallel:
Task: "Enhance security-resilience-auditor systemPrompt in production-readiness-crew.subagents.ts"
Task: "Enhance testing-auditor systemPrompt in production-readiness-crew.subagents.ts"
Task: "Enhance infrastructure-auditor systemPrompt in production-readiness-crew.subagents.ts"
Task: "Enhance docs-compliance-auditor systemPrompt in production-readiness-crew.subagents.ts"
```

## Parallel Example: User Story 5

```bash
# Launch report renderers in parallel:
Task: "Implement markdown-renderer in src/report/markdown-renderer.ts"
Task: "Implement json-renderer in src/report/json-renderer.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1+2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Stories 1+2
4. **STOP and VALIDATE**: Test by pointing system at a real repository
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Stories 1+2 → Test independently → **MVP!**
3. Add User Story 3 (parallel auditors) → Test independently
4. Add User Story 4 (runtime verifier) → Test independently
5. Add User Story 5 (report synthesis) → Test independently
6. Add User Story 6 (configuration) → Test independently
7. Add Cross-Cutting (tracing + monorepo) → Full feature complete

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Stories 1+2 (MVP)
   - After MVP checkpoint:
     - Developer A: User Story 3 + User Story 5
     - Developer B: User Story 4 + User Story 6
     - Developer C: Cross-Cutting (Phase 8)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined because they share the same core (supervisor + structural-scout)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing code in production-readiness-crew.subagents.ts is the starting point — refactor, don't rewrite
- **Deferred**: Constitution §4 skill paths (/skills/production-readiness/*) and SKILL.md files — deferred to a subsequent iteration alongside §5 persistent memory. Skills infrastructure will be added when core crew functionality is stable.
