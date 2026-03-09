# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Production Readiness Crew** — a multi-agent system that audits software repositories for production readiness using the `deepagents` framework (LangChain JS wrapper). Exports a factory function `createProductionReadinessCrewSubagents()` that creates 8+1 SubAgent instances (supervisor delegates to specialists).

This repository also serves as the canonical **Spec Kit agent skills** repository, providing reusable workflow skills across multiple AI runtimes (Claude Code, Codex CLI, Copilot CLI, Gemini CLI).

## Build & Development Commands

```bash
npm install                          # Install dependencies
npm run build                        # TypeScript compilation (tsc)
npm run typecheck                    # Type check without emitting (tsc --noEmit)
npm run test                         # Run all tests with coverage (vitest)
npm run test:unit                    # Unit tests only
npm run test:integration             # Integration tests only
npx vitest run tests/unit/foo.test.ts  # Run a single test file
```

**TypeScript config**: ES2022 target, NodeNext modules, strict mode, `exactOptionalPropertyTypes` enabled.

## Architecture

### Source Code (`src/`)

- **`production-readiness-crew.subagents.ts`** (root) — Main factory function. Defines all 9 subagents with Arabic system prompts, `PARENT_RESULT_CONTRACT`, and `SHARED_SAFETY_RULES`. This is the starting point for all crew logic.
- **`index.ts`** (root) — Barrel export for the library API.
- **`src/types.ts`** — Core interfaces: `Finding`, `Evidence`, `ProjectManifest`, `ExecutionContext`, `Severity`, `EffortLevel`, and all crew configuration types (`ProductionReadinessCrewTools/Models/Skills/Options`).
- **`src/contracts/output-contract.ts`** — `SubagentOutput` interface and `PARENT_RESULT_CONTRACT` typed schema.
- **`src/contracts/report-schema.ts`** — `FinalReport`, `TracingData`, `DelegationRecord` interfaces.
- **`src/tracing/tracer.ts`** — `TracingCollector` class for event-based execution tracing.
- **`src/report/markdown-renderer.ts`** — Renders `FinalReport` to Markdown string.
- **`src/report/json-renderer.ts`** — Renders `FinalReport` to JSON string.
- **`src/report/validator.ts`** — Report validation (coverage, evidence, deduplication, MD/JSON parity).

### Agent Execution Topology

1. `supervisor` plans and delegates (never executes directly)
2. `structural-scout` runs first — produces `ProjectManifest` + `ExecutionContext`
3. 5 specialist auditors run in parallel (code-performance, security-resilience, testing, infrastructure, docs-compliance)
4. `runtime-verifier` runs after safety gate (only agent allowed to execute commands)
5. `report-synthesizer` runs last — dual-format Markdown+JSON report

### Spec Kit Framework (`.specify/`)

- **`.specify/templates/`** — Templates for spec, plan, tasks, checklist, constitution, agent files
- **`.specify/scripts/`** — Bash and PowerShell helpers. Run from repo root; use `--json` flag for machine-readable output with absolute paths
- **`.specify/memory/constitution.md`** — Project constitution (governing authority for all crew behavior)

### Skills & Multi-Runtime Strategy

Skills live in `skills/` and are symlinked to `.claude/skills`, `.codex/skills`, and `.github/skills`. Edit skills in `skills/` only — never edit symlinked copies.

- **Claude Code commands**: `.claude/commands/speckit.*.md`
- **Skills**: `skills/speckit-*/SKILL.md` (YAML front matter + documentation)

### Spec Kit Workflow Sequence

```text
constitution → specify → clarify(optional) → plan → tasks → analyze(optional) → implement
```

Feature artifacts go in `specs/NNN-feature-name/` (spec.md, plan.md, tasks.md, research.md, data-model.md, contracts/, checklists/).

## Key Conventions

- **Arabic system prompts**: All subagent `systemPrompt` fields are in Arabic. Maintain this convention.
- **Constitution is non-negotiable**: `.specify/memory/constitution.md` is the governing authority. Spec, plan, and tasks must align with it.
- **Explicit agent definitions**: Every SubAgent must have `name`, `description`, `systemPrompt`, `tools` explicitly defined — no implicit inheritance from supervisor (Constitution Principle II).
- **Least privilege tools**: Each agent gets only the minimum tools needed for its role (Constitution Principle III).
- **Output contract**: All subagents return compressed executive summaries via `PARENT_RESULT_CONTRACT` (Summary, Findings, Evidence, Uncertainties, Handoff).
- **File naming**: Skills use `<tool>-<action>/` directories, commands use `<tool>.<action>.md`, kebab-case for multi-word names.
- **Commit style**: Short, imperative, sentence-case messages.
- **PRs**: Create as draft with appropriate labels by default.
- **Scripts**: `.specify/scripts/bash/*.sh` are canonical. Run from repo root. Windows users run via bash/WSL.
- **AGENTS.md**: Contains full repository guidelines including coding style, validation rules, and the complete Spec Kit workflow guide. Refer to it for detailed conventions.
