# Research: Desktop Production Hardening

**Feature**: Desktop Production Hardening  
**Branch**: `codex/004-production-hardening`  
**Date**: 2026-03-08

## 1. Real runtime execution strategy

- **Decision**: Integrate the Electron worker directly with the repository-root Production Readiness Crew library through a dedicated adapter that builds the subagent tool map, passes resolved model assignments, wires the `TracingCollector`, and converts final crew output into persisted run/report artifacts.
- **Rationale**: The placeholder in `desktop/electron/worker/crew-runtime.ts` already imports the root bundle; the missing piece is a real adapter. Keeping execution in-process preserves the constitution's command-execution boundary, avoids shelling out to a second CLI, and keeps trace events correlated with desktop run IDs.
- **Alternatives considered**:
  - Launching an external CLI process from Electron. Rejected because it duplicates runtime policy resolution, complicates cancellation, and weakens trace continuity.
  - Keeping a mock runtime and declaring production readiness via docs only. Rejected because it fails the core feature goal and leaves the primary user flow incomplete.

## 2. Runtime asset resolution for development and packaged builds

- **Decision**: Add a runtime-asset preparation step that ensures the root `dist/` bundle exists for development and copies the built crew-library assets into the desktop build output for packaged execution. Resolve runtime entry points via an explicit helper rather than `process.cwd()`.
- **Rationale**: The current worker uses `process.cwd()` to import `dist/index.js`, which is fragile in development and wrong in packaged apps. An explicit resolver plus staged assets makes packaged builds deterministic and keeps asset failures explainable.
- **Alternatives considered**:
  - Relying on `process.cwd()` and assuming the app launches from repo root. Rejected because packaged apps do not preserve that working directory.
  - Re-implementing the crew library inside the desktop project. Rejected because it forks the source of truth and risks breaking constitution-driven contracts.

## 3. Desktop verification stack

- **Decision**: Establish desktop-local Vitest with two modes: Node-environment tests for Electron main-process logic, stores, persistence, and worker adapters; and jsdom plus Testing Library for renderer pages and components. Keep root-library Vitest coverage at the repository root for contract, report, and tracing utilities.
- **Rationale**: The remaining blockers from `003-agent-model-policy` are overwhelmingly test infrastructure and behavior coverage. A split test harness matches the code layout and enables both regression protection and feature-level UI checks without introducing a full browser E2E dependency as a prerequisite.
- **Alternatives considered**:
  - Relying only on manual Electron checks. Rejected because it does not provide a release gate and cannot close the open automated-test tasks.
  - Going straight to Playwright or packaged-E2E coverage only. Rejected because it adds heavier tooling before the unit and integration basics exist.

## 4. Release gate orchestration

- **Decision**: Create one Node-based orchestration script at `desktop/scripts/release-gate.mjs` and expose it via `desktop/package.json` so a single command can run static checks, library build/tests, desktop typecheck/tests/build, packaging preparation, smoke validation, and documentation/sign-off verification.
- **Rationale**: Production readiness needs a repeatable gate that works for both developers and release operators on the current host platform. A Node script is cross-platform, can call both root and desktop commands, and can emit structured validation results for auditing.
- **Alternatives considered**:
  - PowerShell-only release automation. Rejected because it is less portable across the platforms already defined in the builder config.
  - CI-only release gating. Rejected because the spec requires an operator-friendly local workflow and packaged candidate validation record.

## 5. Packaged artifact smoke validation

- **Decision**: Produce a smoke-validation record from an unpacked packaged build generated for the current host platform, then optionally generate installer artifacts from the same candidate. Store validation output under `desktop/release/validation/<candidate-id>/`.
- **Rationale**: Unpacked packaged builds preserve the runtime asset layout needed to catch packaging bugs while remaining scriptable for smoke checks. This gives deterministic evidence without coupling validation to interactive installer UX.
- **Alternatives considered**:
  - Launching only the development app for smoke validation. Rejected because it misses packaged-path failures.
  - Validating installer artifacts directly. Rejected because installer automation is slower and platform-specific while the actual runtime layout can be validated earlier on unpacked output.

## 6. Handling open production blockers from `003-agent-model-policy`

- **Decision**: Treat the remaining unchecked tasks from the model-policy feature as hard dependencies of this feature and close them here through shared desktop test tooling, policy regression coverage, performance measurements, and documented smoke/usability evidence.
- **Rationale**: Those unchecked items are not optional polish; they are part of the production-readiness bar. Folding them into this feature prevents a split-brain release process where "ready for production" depends on work tracked elsewhere.
- **Alternatives considered**:
  - Leaving `003-agent-model-policy` open and treating this feature independently. Rejected because it would allow unresolved production blockers to linger.
  - Copying the old tasks unchanged without integrating them into the new release gate. Rejected because that would not create a single production-readiness workflow.

## 7. Permanent operational documentation

- **Decision**: Keep design-time usage notes in this feature's `quickstart.md`, but plan permanent operator documentation under `desktop/docs/production-readiness.md` and `desktop/docs/release-signoff.md`.
- **Rationale**: Spec artifacts are useful during delivery, but production readiness cannot depend on feature folders alone. Permanent docs need to live beside the desktop app and release scripts.
- **Alternatives considered**:
  - Keeping all operational instructions only in feature-spec artifacts. Rejected because operators should not depend on historical feature folders for release work.
  - Spreading release knowledge across comments and ad hoc notes. Rejected because the spec explicitly requires documented, repeatable sign-off.
