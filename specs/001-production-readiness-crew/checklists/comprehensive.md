# Comprehensive Alignment Checklist: Production Readiness Crew

**Purpose**: Deep cross-artifact validation of requirements, contracts, orchestration, safety rules, tracing, monorepo behavior, and configuration.
**Created**: 2026-03-08
**Updated**: 2026-03-08
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md) | [output-contract.md](../contracts/output-contract.md) | [tasks.md](../tasks.md)
**Audience**: Author / Reviewer
**Depth**: Deep (47 items)
**Scope**: This checklist now tracks cross-artifact alignment, not spec-only purity. Code-level references are used only where the implementation currently carries the operational semantics that the spec delegates or leaves implicit.

## Validation Summary

- Checked: **14 / 47**
- Open: **33 / 47**
- Blocking or high-value open items: `CHK003`, `CHK006`, `CHK013`, `CHK015`, `CHK026`, `CHK029`, `CHK037`, `CHK038`, `CHK045`

## Multi-Agent Architecture Requirements

- [ ] CHK001 Are the exact responsibilities of each of the 8 specialist subagents explicitly bounded so that no two agents have overlapping audit scope? [Completeness, Spec §FR-002]
- [x] CHK002 Is the supervisor's role limited to planning and delegation only, with an explicit prohibition on direct task execution? [Clarity, Spec §FR-001, Constitution §I]  
  PASS: user story 1, FR-001, the constitution, and the exported supervisor prompt all keep the supervisor in orchestration-only mode.
- [ ] CHK003 Are the conditions under which structural-scout MUST complete before specialists can start explicitly defined, including the minimum ProjectManifest fields required? [Clarity, Spec §FR-005]
- [ ] CHK004 Is the parallel execution topology specified with enough detail to determine which agents CAN vs MUST run concurrently? [Ambiguity, Spec §FR-006]
- [x] CHK005 Are the SubAgent interface fields (name, description, systemPrompt, tools) documented as mandatory in both the spec and data model consistently? [Consistency, Spec §FR-004, Data Model §1]  
  PASS: FR-004 and data-model §1 align on the mandatory fields, and the current factory defines all subagents explicitly.
- [ ] CHK006 Does the spec define what happens when the supervisor receives a request outside the production readiness domain? [Gap, Edge Case]

## Output Contracts & Inter-Agent Communication

- [x] CHK007 Are the 5 required SubagentOutput fields (Summary, Findings, Evidence, Uncertainties, Handoff) defined with data types and constraints, not just field names? [Clarity, Spec §FR-008, Contract §1]  
  PASS: data-model §6 and the output contract define the fields and their expected structure.
- [ ] CHK008 Are the Finding ID prefix assignments (STR, PERF, SEC, TEST, INFRA, DOCS, RUN, GEN) documented in the spec or only in contracts/output-contract.md? [Traceability, Contract §1]
- [ ] CHK009 Is the maximum size or token budget for SubagentOutput defined to prevent context window overflow? [Gap, Constitution §III]
- [ ] CHK010 Is the Handoff field's expected content specified: free text, structured fields, or enumerated categories? [Ambiguity, Data Model §6]
- [ ] CHK011 Are the terms "عقد الإخراج الموحد", "PARENT_RESULT_CONTRACT", and "SubagentOutput" reconciled as a single canonical term? [Consistency, Spec / Plan / Data Model]

## Security & Safety Gates

- [x] CHK012 Is runtime-verifier's allowedCommands policy exhaustively enumerated (`install`, `build`, `test`, `lint`) with explicit exclusion of all other command types? [Completeness, Spec §FR-007]  
  PASS: FR-007 plus the runtime-verifier prompt explicitly restrict execution to the four allowed command classes and reject anything else.
- [ ] CHK013 Are the safety gate prerequisites for runtime-verifier quantified: which specific ProjectManifest fields must be present? [Clarity, Spec §FR-007, Constitution Workflow §3]
- [ ] CHK014 Is the anti-fabrication rule (FR-013) defined with measurable criteria for "insufficient evidence" rather than relying on agent judgment alone? [Measurability, Spec §FR-013]
- [ ] CHK015 Are the least-privilege tool assignments specified per-agent with explicit tool lists, not just the principle statement? [Completeness, Spec §FR-011, Constitution §III]
- [ ] CHK016 Is the behavior specified when runtime-verifier encounters a command that succeeds but produces suspicious output (for example unexpected file modifications)? [Gap, Edge Case]
- [ ] CHK017 Are data isolation requirements defined: can one subagent access another's intermediate results, or only via the supervisor? [Gap, Constitution §III]

## Report Quality & Dual Format

- [ ] CHK018 Are the Markdown report sections enumerated with required vs optional markers? [Completeness, Spec §FR-017, Contract §2a]
- [x] CHK019 Is the JSON schema (Contract §2b) referenced with a validation mechanism, or is it documentation-only? [Clarity, Contract §2b]  
  PASS: the current report surface includes JSON rendering, JSON parsing, and report validation rather than leaving the schema as prose only.
- [x] CHK020 Are the 7 validation rules (Contract §3) testable with specific pass / fail criteria for each? [Measurability, Contract §3]  
  PASS: the validator now encodes coverage, evidence, duplicate-id, tracing, and parity checks in executable form.
- [ ] CHK021 Is the deduplication algorithm for conflicting findings specified: by Finding ID, by description similarity, or by evidence overlap? [Ambiguity, Spec §FR-009]
- [ ] CHK022 Is the severity unification process defined when two agents rate the same issue differently? [Gap, Spec §FR-014, Edge Case §7]
- [ ] CHK023 Are the Observations section criteria defined: what distinguishes an Observation from a Low-severity Finding? [Clarity, Spec §FR-014]
- [ ] CHK024 Is the remediation plan prioritization algorithm specified: by severity alone, or by `(severity x impact x effort)`? [Ambiguity, Spec §FR-014]

## Tracing & Observability

- [x] CHK025 Are all 7 tracing event types (`crew:start`, `agent:delegated`, `agent:completed`, `agent:failed`, `agent:retried`, `tool:called`, `crew:completed`) defined with required payload fields? [Completeness, Spec §FR-016, Research §R4]  
  PASS: the tracing model and collector define all seven event types and their payloads.
- [ ] CHK026 Is "any run without tracing is considered incomplete" (FR-016) defined with an enforcement mechanism: does the system reject untraceable runs or just log a warning? [Clarity, Spec §FR-016]
- [ ] CHK027 Are tracing data retention and export requirements specified: ephemeral per-run only, or persistent across sessions? [Gap, Spec §FR-016]
- [x] CHK028 Is the TracingCollector integration point defined: middleware parameter, constructor injection, or event bus? [Clarity, Plan §Phase 8]  
  PASS: the integration point is now explicit as an optional `tracer` factory option that is attached to subagents through middleware.

## Monorepo Multi-Pass Strategy

- [ ] CHK029 Is the batch size determination algorithm specified: by subproject count, by estimated token budget, or by heuristic? [Ambiguity, Spec §FR-018]
- [ ] CHK030 Are the "cumulative findings preservation" requirements defined with a specific mechanism for cross-batch state transfer? [Clarity, Spec §FR-018]
- [ ] CHK031 Is the "cross-project correlation" requirement specified: what correlations should be detected and how? [Gap, Spec §FR-018]
- [ ] CHK032 Are the transparency requirements quantified: does "declare batch count" include per-batch timing, per-batch findings, or just total count? [Clarity, Spec §FR-018]

## Configuration & Extensibility

- [x] CHK033 Are the required vs optional fields in ProductionReadinessCrewOptions explicitly marked in both the data model and the spec? [Consistency, Data Model §5, Spec §FR-010]  
  PASS: the data model defines the optional fields and defaults clearly, and the public types match that shape.
- [x] CHK034 Is the behavior specified when a required tool field is missing: throw error, use defaults, or partial initialization? [Gap, Spec §FR-010]  
  PASS: the current factory throws a descriptive error for missing required tool lists instead of silently defaulting.
- [ ] CHK035 Are model selection guidelines (Constitution §7: faster for exploration, stronger for security) reflected in the spec as requirements or left as implementation guidance? [Consistency, Constitution §7, Spec]
- [x] CHK036 Is the general-purpose fallback agent's restricted scope defined: what tasks can it handle and what is explicitly excluded? [Clarity, Spec §FR-003, Constitution §1]  
  PASS: the current general-purpose prompt now states the allowed use cases and the explicit exclusions.

## Edge Cases & Failure Handling

- [ ] CHK037 Is the empty repository behavior specified: does structural-scout produce an empty ProjectManifest or abort with a specific error? [Gap, Spec Edge Cases]
- [ ] CHK038 Is the "all agents fail" scenario defined with a specific output: empty report with all gaps, or error state? [Gap, Spec Edge Cases]
- [x] CHK039 Is the retry policy quantified: "at least one retry" (FR-012), but is there a maximum retry count or timeout? [Ambiguity, Spec §FR-012]  
  PASS: the current orchestration guidance caps retry behavior at one additional attempt; timeout policy is still implicit.
- [ ] CHK040 Is the context window overflow handling defined for single-project (non-monorepo) repositories that exceed token limits? [Gap, Spec Edge Cases]
- [x] CHK041 Are the "unsupported programming language" handling requirements specified: partial analysis, skip with gap declaration, or error? [Gap, Spec Edge Cases]  
  PASS: the assumptions section allows partial analysis and requires declaring capability limits.

## Non-Functional Requirements

- [ ] CHK042 Is "single session without manual intervention" (SC-001) defined with session timeout or token budget constraints? [Measurability, Spec §SC-001]
- [ ] CHK043 Are performance targets specified for medium repositories (`< 50K LOC`) with an expected wall-clock time range? [Gap, Plan Technical Context]
- [ ] CHK044 Is the parallel execution performance improvement quantified: "reduces time compared to sequential" but by what factor? [Measurability, Spec §SC-004]

## Dependencies & Assumptions

- [ ] CHK045 Is the `deepagents` library version pinned or range-specified in requirements? [Gap, Plan Technical Context, Risk §R-003]
- [ ] CHK046 Are the assumptions about tool availability ("المستدعي يوفرها عبر واجهة التكوين") validated: what is the minimum tool set that must be provided? [Assumption, Spec Assumptions]
- [x] CHK047 Is the Node.js version requirement specified, given ES2022+ target? [Gap, Plan Technical Context]  
  PASS: the quickstart now specifies Node.js 18+ and the plan explicitly targets Node.js.

## Notes

- `[x]` means the requirement is explicitly covered or operationally pinned down by the current artifact set.
- `[ ]` means the behavior is still missing, distributed implicitly, or not precise enough to treat as fully specified.
- An unchecked item does not necessarily mean the implementation is absent; it means the contract is still under-specified or not centralized enough.
- The highest-value follow-up edits are to make runtime safety prerequisites explicit, define the monorepo batching heuristic, formalize out-of-domain behavior, and pin dependency/runtime assumptions.
