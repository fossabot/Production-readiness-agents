# Quickstart: Desktop Production Hardening

**Feature Branch**: `codex/004-production-hardening`

## Goal

Validate that the desktop app can:

1. Run a real Production Readiness Crew session from the UI.
2. Persist report, trace, and history evidence.
3. Pass a single release gate.
4. Produce a packaged candidate plus a smoke-validation record.
5. Be signed off by an operator using repository documentation only.

## Prerequisites

1. Install root dependencies.
2. Install desktop dependencies.
3. Ensure provider credentials are configured in the desktop settings flow before attempting a real run.
4. Build the root library bundle before launching the desktop app in development if the runtime asset script has not done so already.

## Development verification flow

### 1. Prepare the repository

From the repository root:

```powershell
npm install
npm run build
npm test
```

From the desktop app:

```powershell
cd desktop
npm install
npm run typecheck
```

### 2. Launch the desktop app

```powershell
cd desktop
npm run dev
```

### 3. Verify a real runtime session

1. Open the settings page and confirm the active model-policy snapshot loads.
2. Choose a repository folder from the scan page.
3. Start a run.
4. Verify one of the following outcomes:
   - The run completes and a Markdown/JSON report is available.
   - The run is blocked or fails with a concrete runtime/config error that is visible in the UI.
5. Open history and report pages and confirm the saved run record includes policy resolution evidence.

### 4. Confirm placeholder removal

The run must not fail with the old placeholder path from `desktop/electron/worker/crew-runtime.ts`. Any runtime failure should now name the concrete asset, worker, provider, persistence, or crew-execution issue.

## Release gate flow

From the desktop workspace:

```powershell
cd desktop
npm run release:gate -- --platform current
```

Expected result:

1. Static and test checks pass for both the root library and the desktop app.
2. Runtime assets are staged for packaged execution.
3. A packaged current-platform candidate is built.
4. Validation artifacts are written under `desktop/release/validation/<candidate-id>/`.
5. The command exits successfully only if every blocking stage passes.

## Packaged smoke validation

The smoke validator must confirm the packaged candidate can:

1. Launch successfully.
2. Load settings and the model-policy page.
3. Start a real run or present a controlled blocked-run explanation.
4. Show history or report evidence after the attempt.

Smoke evidence should be recorded in both JSON and Markdown forms for the candidate.

## Performance evidence

The release gate or follow-up notes must confirm:

1. Policy load completes within 500ms or records a blocking deviation.
2. Preset preview generation completes within 200ms or records a blocking deviation.
3. Preflight validation completes within 1 second or records a blocking deviation.

## Operator sign-off flow

An operator new to the project should be able to:

1. Follow permanent desktop production docs.
2. Run the release gate.
3. Review the packaged smoke record.
4. Decide approve or reject in one session.

If any required doc, validation artifact, or blocking check is missing, the release must remain not ready for production.

## 15-Minute Operator Setup Validation (T046)

To validate the SC-006 requirement (operator setup within 15 minutes), time the following flow:

| Step | Expected Time | Validation |
|------|--------------|------------|
| 1. Clone repo and install deps | 3 min | `npm install` at root + desktop |
| 2. Build root library | 1 min | `npm run build` from root |
| 3. Configure credentials | 2 min | Enter API key in Settings → Keys |
| 4. Launch desktop and verify policy | 1 min | `npm run dev`, check policy loads |
| 5. Start first scan | 1 min | Select repo, click start |
| 6. Review results | 2 min | Check report, history, findings |
| 7. Run release gate | 3 min | `npm run release:gate` |
| 8. Make readiness decision | 2 min | Review gate results, approve/reject |
| **Total** | **≤15 min** | SC-006 validated |

## Evidence Expectations (T050)

### Smoke Evidence
- `desktop/release/validation/<id>/smoke-validation.json` — structured checkpoints
- `desktop/release/validation/<id>/smoke-validation.md` — human-readable summary

### Performance Evidence
- Policy load timing broadcast in run logs (≤500ms threshold)
- Preset preview timing broadcast (≤200ms threshold)
- Preflight validation timing broadcast (≤1s threshold)

### Usability Evidence
- Operator completes setup flow without external documentation
- All error messages are human-readable with remediation hints
- Report page shows overall assessment badge (ready/conditions/not_ready)

## Production-Readiness Completion Record (T055)

### Implementation Status

| User Story | Status | Key Deliverables |
|-----------|--------|-----------------|
| US1: Real runtime execution | Complete | crew-adapter, crew-runtime, partial-completion, concurrency guard |
| US2: Automated release gate | Complete | 9-stage release-gate.mjs, policy tests, blocker closure record |
| US3: Packaging and smoke | Complete | electron-builder config, smoke-validate.mjs, asset-resolver |
| US4: Documentation and sign-off | Complete | production-readiness.md, release-signoff.md, UI doc references |
| Phase 7: Polish | Complete | error constant consolidation, cross-story regression tests |

### Functional Requirements Delivered

| FR | Description | Implementation |
|----|------------|----------------|
| FR-016 | OS keychain credential storage | credential-store.ts + settings-store.ts keytar integration |
| FR-017 | Concurrent-run prevention | Dual-layer guard (in-memory + persisted) in handlers.ts |
| FR-018 | Partial-completion resilience | Agent-level try/catch with continuation in crew-runtime.ts |
| FR-019 | Data retention auto-cleanup | 90-day age + 100-run count thresholds in data-retention.ts |
| NFR-007 | Atomic writes | write-then-rename pattern in release-gate.mjs and persistence stores |

### Consolidated Error Taxonomy

Error codes are defined once in `desktop/electron/types/errors.ts` (`RuntimeErrorCode`) and imported by the renderer (`useCrewRun.ts`) via `RunErrorCode = RuntimeErrorCode | 'UNKNOWN'`.

### Remaining Validation Steps

Before final sign-off an operator should:

1. Run `npm run verify` from root and desktop to confirm all tests pass.
2. Run `npm run release:gate` from desktop to execute the 9-stage gate.
3. Review the generated `release-gate.json` and `release-gate.md` artifacts.
4. Confirm permanent docs exist at `desktop/docs/production-readiness.md` and `desktop/docs/release-signoff.md`.
5. Follow the release-signoff checklist to make an approve/reject decision.
